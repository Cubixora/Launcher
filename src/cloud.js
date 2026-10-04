// Cubixora bulut: Supabase (Auth + veritabanı) üzerinden hesaplar ve
// profil/mod eşitleme. Ayarlar src/cloud.json dosyasından okunur:
//   { "supabaseUrl": "https://xxxx.supabase.co", "supabaseKey": "anon/publishable anahtar" }
// Dosya boşsa bulut kapalıdır; launcher yerel hesaplarla çalışmaya devam eder.
//
// Buluta kaydedilenler: kullanıcı adı, oyun içi UUID, profiller ve her profilin mod listesi.
// Mod dosyalarının kendisi yüklenmez; Modrinth'teki adresleri kaydedilir ve başka bilgisayarda
// oradan indirilir. Modrinth'te olmayan (elle eklenmiş) modlar listede "yerel" olarak işaretlenir.

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const crypto = require('crypto');

module.exports = function createCloud(ctx) {
  const { DATA_DIR, getConfig, saveConfig, protect, unprotect, log, send, profileDir, downloadFile, UA } = ctx;
  const CACHE_FILE = path.join(DATA_DIR, 'modcache.json');
  const MODRINTH = 'https://api.modrinth.com/v2';

  // ------------------------------------------------------------ ayarlar
  let settings = null;
  function cfg() {
    if (settings) return settings;
    try { settings = JSON.parse(fs.readFileSync(path.join(__dirname, 'cloud.json'), 'utf8')); } catch { settings = {}; }
    return settings;
  }
  const enabled = () => !!(cfg().supabaseUrl && cfg().supabaseKey);
  const SB = () => String(cfg().supabaseUrl || '').replace(/\/+$/, '');

  // ------------------------------------------------------------ hata metinleri
  const AUTH_ERRORS = {
    user_already_exists: 'Bu e-posta ile zaten bir hesap var. Giriş yapmayı dene.',
    email_exists: 'Bu e-posta ile zaten bir hesap var. Giriş yapmayı dene.',
    invalid_credentials: 'E-posta veya şifre hatalı.',
    email_address_invalid: 'Geçerli bir e-posta adresi yaz.',
    validation_failed: 'Geçerli bir e-posta adresi ve en az 6 karakterli şifre yaz.',
    weak_password: 'Şifre en az 6 karakter olmalı.',
    user_banned: 'Bu hesap devre dışı bırakılmış.',
    over_request_rate_limit: 'Çok fazla deneme yapıldı. Biraz bekleyip tekrar dene.',
    over_email_send_rate_limit: 'Çok fazla e-posta istendi. Biraz bekleyip tekrar dene.',
    email_not_confirmed: 'E-posta adresin henüz doğrulanmamış. Gelen kutundaki bağlantıya tıkla.',
    signup_disabled: 'Şu an yeni hesap açılamıyor.',
    refresh_token_not_found: 'Oturumun süresi doldu, tekrar giriş yap.',
    refresh_token_already_used: 'Oturumun süresi doldu, tekrar giriş yap.',
    session_not_found: 'Oturumun süresi doldu, tekrar giriş yap.',
    provider_disabled: 'Google girişi Supabase\'de açılmamış (Authentication > Providers > Google).',
    bad_oauth_callback: 'Google girişi kabul edilmedi.',
    bad_jwt: 'Oturumun süresi doldu, tekrar giriş yap.'
  };
  function authError(body, status) {
    const code = (body && (body.error_code || body.code)) || '';
    if (AUTH_ERRORS[code]) return new Error(AUTH_ERRORS[code]);
    const raw = (body && (body.msg || body.message || body.error_description || body.error)) || String(status);
    if (/invalid login credentials/i.test(raw)) return new Error(AUTH_ERRORS.invalid_credentials);
    if (/already registered/i.test(raw)) return new Error(AUTH_ERRORS.user_already_exists);
    if (/invalid api key|no api key/i.test(raw)) return new Error('Bulut anahtarı (supabaseKey) geçersiz. src\\cloud.json dosyasını kontrol et.');
    return new Error(`Bulut hatası: ${raw}`);
  }

  // ------------------------------------------------------------ Supabase Auth (REST)
  async function authCall(pathQ, body, bearer, method = 'POST') {
    let r;
    try {
      r = await fetch(`${SB()}/auth/v1/${pathQ}`, {
        method, headers: { apikey: cfg().supabaseKey, Authorization: `Bearer ${bearer || cfg().supabaseKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body || {})
      });
    } catch { throw new Error('Bulut sunucusuna ulaşılamadı. İnternet bağlantını kontrol et.'); }
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw authError(j, r.status);
    return j;
  }

  // oyuncu kimliği: Firebase'den taşınan hesaplarda eski kimlik (app_metadata.fbuid, sadece sunucu yazabilir), yenilerde Supabase kimliği
  const uidOf = (user) => String((user && user.app_metadata && user.app_metadata.fbuid) || (user && user.id) || '');
  let idToken = null, idTokenExp = 0, refreshing = null;
  function remember(res) {
    idToken = res.access_token;
    idTokenExp = Date.now() + (Number(res.expires_in || 3600) - 120) * 1000;
    return { uid: uidOf(res.user), refresh: protect(res.refresh_token), sb: 1 };
  }

  async function token() {
    if (idToken && Date.now() < idTokenExp) return idToken;
    if (refreshing) return refreshing;
    refreshing = (async () => {
      const a = getConfig().account;
      if (!a || !a.cloud || !a.cloud.sb) throw new Error('Bulut oturumu yok.');
      const j = await authCall('token?grant_type=refresh_token', { refresh_token: unprotect(a.cloud.refresh) });
      a.cloud = { ...a.cloud, ...remember(j) };   // Supabase yenileme anahtarı her seferinde değişir: hemen kaydedilir
      saveConfig();
      return idToken;
    })().finally(() => { refreshing = null; });
    return refreshing;
  }

  // ------------------------------------------------------------ belgeler (Supabase; tek bağlantı launcher'ın her yerinde paylaşılır)
  let sbInst = null;
  const sb = () => {
    if (!enabled()) return null;
    if (!sbInst) sbInst = require('./sbdb')({ url: SB(), key: cfg().supabaseKey, token: () => token(), log });
    return sbInst;
  };
  const plain = (d) => { if (!d) return null; const { id, path: _p, _updated, ...rest } = d; void id; void _p; void _updated; return rest; };
  const getDoc = async (p, auth = true) => plain(await sb().get(p, auth));
  const setDoc = (p, obj) => sb().set(p, obj);
  const delDoc = (p) => sb().del(p);
  const createDoc = (col, id, obj) => sb().create(col, id, obj);

  // ------------------------------------------------------------ kullanıcı adları (herkese tekil)
  async function nameFree(name) {
    const d = await getDoc(`usernames/${name.toLowerCase()}`, false);
    return !d;
  }
  async function reserveName(name, uid) {
    if (await createDoc('usernames', name.toLowerCase(), { uid })) return true;
    const d = await getDoc(`usernames/${name.toLowerCase()}`);
    return !!(d && d.uid === uid);
  }

  // ------------------------------------------------------------ hesap işlemleri
  function sessionFrom(res, user, provider, email) {
    const cloud = remember(res);
    const needsNick = user.nick === 0 || (user.nick === undefined && provider === 'google');
    const meta = (res.user && res.user.user_metadata) || {};
    return { type: provider, id: cloud.uid, name: user.username, uuid: user.uuid, email: email || (res.user && res.user.email) || null, cloud, needsNick,
      googleName: meta.full_name || meta.name || null, photo: meta.avatar_url || meta.picture || null };
  }

  async function register({ username, email, password }) {
    if (!(await nameFree(username))) throw new Error('Bu kullanıcı adı alınmış, başka bir ad seç.');
    const res = await authCall('signup', { email, password });
    if (!res.access_token) throw new Error('Hesap açıldı. E-postana gelen doğrulama bağlantısına tıkla, sonra giriş yap.');
    remember(res);
    const uid = uidOf(res.user);
    if (!(await reserveName(username, uid))) throw new Error('Bu kullanıcı adı az önce alındı. Giriş yapıp başka bir ad seçebilirsin.');
    const user = { username, uuid: crypto.randomUUID().replace(/-/g, ''), nick: 1 };
    await setDoc(`users/${uid}`, { ...user, data: '', updated: 0 });
    return sessionFrom(res, user, 'local', email);
  }

  async function login({ email, password }) {
    const res = await authCall('token?grant_type=password', { email, password });
    remember(res);
    const uid = uidOf(res.user);
    let user = await getDoc(`users/${uid}`);
    if (!user) { // kayıt yarım kalmışsa
      user = { username: await pickName(String(res.user.email || email).split('@')[0], uid), uuid: crypto.randomUUID().replace(/-/g, ''), nick: 0 };
      await setDoc(`users/${uid}`, { ...user, data: '', updated: 0 });
    }
    return sessionFrom(res, user, 'local', res.user.email || email);
  }

  async function pickName(wanted, uid) {
    const TR = { ç: 'c', ğ: 'g', ı: 'i', İ: 'I', ö: 'o', ş: 's', ü: 'u', Ç: 'C', Ğ: 'G', Ö: 'O', Ş: 'S', Ü: 'U' };
    let base = String(wanted || 'Oyuncu').replace(/[çğıİöşüÇĞÖŞÜ]/g, (c) => TR[c])
      .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[.\s-]+/g, '_')
      .replace(/[^A-Za-z0-9_]/g, '').replace(/^_+|_+$/g, '').slice(0, 16);
    if (base.length < 3) base = 'Oyuncu';
    for (let n = 1; n < 200; n++) {
      const name = n === 1 ? base : base.slice(0, 16 - String(n).length) + n;
      if (await reserveName(name, uid)) return name;
    }
    throw new Error('Uygun bir kullanıcı adı bulunamadı.');
  }

  async function loginGoogle(googleIdToken, googleName) {
    const res = await authCall('token?grant_type=id_token', { provider: 'google', id_token: googleIdToken });
    remember(res);
    const uid = uidOf(res.user);
    let user = await getDoc(`users/${uid}`);
    let isNew = false;
    if (!user) {
      // Google adı geçici olarak ayrılır; oyuncu ilk OYNA'da kendi nickname'ini seçer
      user = { username: await pickName('Oyuncu_' + uid.replace(/-/g, '').slice(0, 6), uid), uuid: crypto.randomUUID().replace(/-/g, ''), nick: 0 };
      await setDoc(`users/${uid}`, { ...user, data: '', updated: 0 });
      isNew = true;
    }
    const acc = sessionFrom(res, user, 'google', res.user && res.user.email);
    acc.isNew = isNew;
    return acc;
  }

  async function rename(newName, keepOld) {
    const a = getConfig().account;
    if (newName.toLowerCase() !== a.name.toLowerCase()) {
      if (!(await reserveName(newName, a.id))) throw new Error('Bu ad başka bir hesapta kullanılıyor.');
    }
    const doc = (await getDoc(`users/${a.id}`)) || {};
    await setDoc(`users/${a.id}`, { username: newName, uuid: doc.uuid || a.uuid, data: doc.data || '', updated: doc.updated || 0, nick: 1 });
    if (keepOld !== true && newName.toLowerCase() !== a.name.toLowerCase()) await delDoc(`usernames/${a.name.toLowerCase()}`).catch(() => {});
  }

  // şifre sıfırlama: e-postaya 6 haneli kod gider (Supabase > Authentication > Emails > Reset Password şablonunda {{ .Token }}),
  // oyuncu kodu ve yeni şifresini launcher'a yazar. Tarayıcıda açılacak bir sayfa gerekmez.
  const resetPassword = (email) => authCall('recover', { email });
  async function resetConfirm({ email, code, password }) {
    if (!/^\d{6,8}$/.test(String(code || '').trim())) throw new Error('E-postadaki kodu yaz.');
    if (String(password || '').length < 6) throw new Error('Şifre en az 6 karakter olmalı.');
    const s = await authCall('verify', { type: 'recovery', email, token: String(code).trim() }).catch((e) => {
      throw /expired|invalid|otp/i.test(e.message) ? new Error('Kod hatalı ya da süresi dolmuş. Yeni kod iste.') : e;
    });
    await authCall('user', { password }, s.access_token, 'PUT');
    return true;
  }

  // ------------------------------------------------------------ mod tanıma (Modrinth hash)
  let cache = null;
  function loadCache() {
    if (!cache) { try { cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')); } catch { cache = {}; } }
    cache.files = cache.files || {}; cache.mods = cache.mods || {};
    return cache;
  }
  const saveCache = () => fsp.writeFile(CACHE_FILE, JSON.stringify(cache)).catch(() => {});

  function rememberMod(sha1, info) { loadCache().mods[sha1] = { ...info, checked: Date.now() }; saveCache(); }

  async function fileSha1(full, st) {
    const key = `${full}|${st.size}|${st.mtimeMs}`;
    const c = loadCache();
    if (c.files[key]) return c.files[key];
    const h = crypto.createHash('sha1').update(await fsp.readFile(full)).digest('hex');
    c.files[key] = h;
    return h;
  }

  async function identify(hashes) {
    const c = loadCache();
    const week = 7 * 24 * 3600 * 1000;
    const unknown = hashes.filter((h) => !c.mods[h] || (!c.mods[h].url && Date.now() - c.mods[h].checked > week));
    if (unknown.length) {
      try {
        const r = await fetch(`${MODRINTH}/version_files`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'User-Agent': UA },
          body: JSON.stringify({ hashes: unknown, algorithm: 'sha1' })
        });
        const found = r.ok ? await r.json() : {};
        for (const h of unknown) {
          const v = found[h];
          const f = v && v.files.find((x) => x.hashes && x.hashes.sha1 === h);
          c.mods[h] = f ? { url: f.url, projectId: v.project_id, versionId: v.id, checked: Date.now() } : { url: null, checked: Date.now() };
        }
        await saveCache();
      } catch (e) { log(`[bulut] Modrinth tanıma başarısız: ${e.message}`); }
    }
    return c.mods;
  }

  // ------------------------------------------------------------ anlık görüntü (yerel -> bulut)
  const PROFILE_KEYS = ['id', 'name', 'icon', 'version', 'loader', 'loaderVersion', 'ram', 'jvmArgs', 'fullscreen', 'created', 'lastPlayed'];

  async function snapshot() {
    const config = getConfig();
    const profiles = [];
    for (const p of config.profiles) {
      const out = Object.fromEntries(PROFILE_KEYS.filter((k) => p[k] !== undefined).map((k) => [k, p[k]]));
      out.mods = [];
      const dir = path.join(profileDir(p), 'mods');
      let names = [];
      try { names = await fsp.readdir(dir); } catch {}
      const entries = [];
      for (const n of names) {
        if (!n.endsWith('.jar') && !n.endsWith('.jar.disabled')) continue;
        if (n.startsWith('cubixora-cosmetics')) continue;
        const full = path.join(dir, n);
        const st = await fsp.stat(full);
        entries.push({ file: n.replace(/\.disabled$/, ''), enabled: !n.endsWith('.disabled'), sha1: await fileSha1(full, st) });
      }
      const known = await identify(entries.map((e) => e.sha1));
      for (const e of entries) {
        const k = known[e.sha1] || {};
        out.mods.push({ ...e, url: k.url || null, projectId: k.projectId || null });
      }
      profiles.push(out);
    }
    return { v: 1, profiles, selectedProfile: config.selectedProfile };
  }

  // ------------------------------------------------------------ uygula (bulut -> yerel)
  const SAFE_URL = /^https:\/\/cdn\.modrinth\.com\//;
  const safeName = (f) => { const b = path.basename(String(f || '')); return /\.jar$/i.test(b) ? b : null; };

  async function apply(data) {
    const config = getConfig();
    const local = new Map(config.profiles.map((p) => [p.id, p]));
    config.profiles = (data.profiles || []).map((cp) => {
      const { mods, ...rest } = cp;
      const lp = local.get(cp.id);
      return { ...(lp || {}), ...rest, lastPlayed: Math.max(rest.lastPlayed || 0, (lp && lp.lastPlayed) || 0) || undefined };
    });
    if (!config.profiles.some((p) => p.id === config.selectedProfile)) {
      config.selectedProfile = data.selectedProfile && config.profiles.some((p) => p.id === data.selectedProfile)
        ? data.selectedProfile : (config.profiles[0] ? config.profiles[0].id : null);
    }
    saveConfig();

    // indirilecek modları topla
    const jobs = [];
    for (const cp of data.profiles || []) {
      const p = config.profiles.find((x) => x.id === cp.id);
      const dir = path.join(profileDir(p), 'mods');
      await fsp.mkdir(dir, { recursive: true });
      const manifestPath = path.join(profileDir(p), '.cubixora-sync.json');
      let prev = [];
      try { prev = JSON.parse(await fsp.readFile(manifestPath, 'utf8')).files || []; } catch {}
      const wanted = new Set(); // sadece Modrinth'ten gelen (eşitlenebilen) modlar
      for (const m of cp.mods || []) {
        const name = safeName(m.file);
        if (!name || !m.url) continue;
        wanted.add(name);
        const on = path.join(dir, name), off = on + '.disabled';
        const want = m.enabled === false ? off : on, other = m.enabled === false ? on : off;
        if (fs.existsSync(other) && !fs.existsSync(want)) await fsp.rename(other, want).catch(() => {});
        if (!fs.existsSync(want) && m.url && SAFE_URL.test(m.url)) jobs.push({ url: m.url, dest: want, sha1: m.sha1, name });
      }
      // başka bilgisayarda silinen (daha önce eşitlenmiş) modları kaldır; elle eklenenlere dokunma
      for (const old of prev) {
        if (wanted.has(old)) continue;
        await fsp.rm(path.join(dir, old), { force: true });
        await fsp.rm(path.join(dir, old + '.disabled'), { force: true });
      }
      await fsp.writeFile(manifestPath, JSON.stringify({ files: [...wanted] }));
    }

    return jobs;
  }

  async function runJobs(jobs) {
    let done = 0;
    for (const j of jobs) {
      send('sync', { state: 'downloading', current: done, total: jobs.length, name: j.name });
      try { await downloadFile(j.url, j.dest, j.sha1); } catch (e) { log(`[bulut] ${j.name} indirilemedi: ${e.message}`); }
      done++;
    }
    return jobs.length;
  }

  // ------------------------------------------------------------ eşitleme
  let pushTimer = null, busy = Promise.resolve();
  const isCloudAccount = () => { const a = getConfig().account; return enabled() && !!(a && a.cloud && a.cloud.sb); };
  const queue = (fn) => (busy = busy.then(fn, fn));

  async function markManifest() {
    // yerelde şu an bulunan ve bulutta kaydı olan modlar artık "eşitlenmiş" sayılır
    const config = getConfig();
    const snap = await snapshot();
    for (const sp of snap.profiles) {
      const p = config.profiles.find((x) => x.id === sp.id);
      if (p) await fsp.writeFile(path.join(profileDir(p), '.cubixora-sync.json'), JSON.stringify({ files: sp.mods.filter((m) => m.url).map((m) => m.file) })).catch(() => {});
    }
    return snap;
  }

  const push = () => queue(pushNow);
  const lastPushed = {};
  async function pushNow() {
    {
      if (!isCloudAccount()) return;
      const config = getConfig();
      try {
        const snap = await markManifest();
        const a = config.account;
        const body = JSON.stringify(snap);
        if (body !== lastPushed[a.id]) {   // değişiklik yoksa buluta yazma (yazma kotası)
          await setDoc(`users/${a.id}`, { username: a.name, uuid: a.uuid, data: body, updated: Date.now() });
          lastPushed[a.id] = body;
        }
        config.sync = { ...(config.sync || {}), dirty: false, last: Date.now() };
        saveConfig();
        send('sync', { state: 'done', last: config.sync.last, local: countLocal(snap) });
      } catch (e) {
        config.sync = { ...(config.sync || {}), dirty: true };
        saveConfig();
        log(`[bulut] kaydedilemedi: ${e.message}`);
        send('sync', { state: 'error', message: e.message });
      }
    }
  }
  const countLocal = (snap) => snap.profiles.reduce((n, p) => n + p.mods.filter((m) => !m.url).length, 0);

  function schedulePush() {
    if (!isCloudAccount()) return;
    const config = getConfig();
    config.sync = { ...(config.sync || {}), dirty: true };
    saveConfig();
    clearTimeout(pushTimer);
    pushTimer = setTimeout(push, 8000);   // art arda değişiklikler tek yazmada birleşir
  }

  // pull(): { ready, done } döner. ready = profiller buluttan alınıp uygulandı (giriş bunu bekler),
  // done = mod indirmeleri de bitti. İndirmeler kuyrukta olduğu için bu sırada yapılan kayıtlar bekler.
  function pull() {
    let markReady;
    const ready = new Promise((r) => (markReady = r));
    const done = queue(async () => {
      try {
        if (!isCloudAccount()) return;
        const config = getConfig();
        send('sync', { state: 'syncing' });
        if (config.sync && config.sync.dirty) { markReady(); await pushNow(); return; } // çevrimdışı değişiklikler önce
        const doc = await getDoc(`users/${config.account.id}`);
        if (!doc || !doc.data) { markReady(); await pushNow(); return; } // bulut boş: bu bilgisayardakileri yükle
        const jobs = await apply(JSON.parse(doc.data));
        markReady();
        send('sync', { state: 'profiles', profiles: config.profiles, selectedProfile: config.selectedProfile });
        const downloaded = await runJobs(jobs);
        config.sync = { ...(config.sync || {}), dirty: false, last: Date.now() };
        saveConfig();
        send('sync', { state: 'done', last: config.sync.last, downloaded });
      } catch (e) {
        log(`[bulut] alınamadı: ${e.message}`);
        send('sync', { state: 'error', message: e.message });
      } finally { markReady(); }
    });
    return { ready, done };
  }

  function forget() { idToken = null; idTokenExp = 0; clearTimeout(pushTimer); }

  const idle = () => busy;

  // ------------------------------------------------------------ kozmetikler (herkese açık okuma)
  // cosmetics/{kullaniciadi}: oyun içi mod bu belgeyi okuyup oyuncunun skin/pelerin/kanadını çizer.
  async function saveCosmetics(name, c) {
    const a = getConfig().account;
    const { skin, capeTex, wingsTex, ...rest } = c;
    await setDoc(`cosmetics/${name.toLowerCase()}`, {
      uid: a.id, name, data: JSON.stringify(rest), skin: skin || '', updated: Date.now(),
      cape: rest.cape || '', wings: rest.wings || '', pet: !!rest.pet, hat: rest.hat || '', fly: rest.fly || '', capeTex: capeTex || '', wingsTex: wingsTex || ''
    });
  }
  async function loadCosmetics(name) {
    const d = await getDoc(`cosmetics/${name.toLowerCase()}`, false);
    if (!d) return null;
    let rest = {};
    try { rest = JSON.parse(d.data || '{}'); } catch {}
    return { ...rest, skin: d.skin || null };
  }
  async function setEmote(name, id) {
    const a = getConfig().account;
    await setDoc(`emotes/${name.toLowerCase()}`, { uid: a.id, name, id: id || '', t: Date.now() });
  }
  async function setSpray(name, p) {
    const a = getConfig().account;
    await setDoc(`sprays/${name.toLowerCase()}`, { uid: a.id, name, x: p.x, y: p.y, z: p.z, d: p.d, r: p.r, t: Date.now() });
  }
  const deleteCosmetics = (name) => delDoc(`cosmetics/${name.toLowerCase()}`).catch(() => {});
  // oyundaki mod için: bulut okumaları launcher'daki yerel köprüden yapılır (fsBase main.js'te eklenir)
  const publicConfig = () => (enabled() ? { projectId: 'cubixora', apiKey: 'local' } : null);
  const releaseName = (name) => delDoc(`usernames/${name.toLowerCase()}`).catch(() => {});
  const uid = () => { const a = getConfig().account; return a && a.cloud ? a.id : null; };
  return { token, uid, cfg, sb, releaseName, reserveName, nameFree, saveCosmetics, setEmote, setSpray, loadCosmetics, deleteCosmetics, publicConfig, idle, enabled, isCloudAccount, register, login, loginGoogle, rename, resetPassword, resetConfirm, push, pull, schedulePush, rememberMod, forget };
};

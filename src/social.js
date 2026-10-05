// Cubixora sosyal + ekonomi + admin (ana süreç).
// Kalıcı veriler Supabase veritabanında, anlık sinyaller (mesaj geldi, arama, istek, durum) Supabase Realtime'da.
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const crypto = require('crypto');

const ADMIN_EMAIL = 'cubixora@gmail.com';
const HANDLE_RE = /^[a-z0-9_.]{3,20}$/;
const TR = { ç: 'c', ğ: 'g', ı: 'i', İ: 'i', ö: 'o', ş: 's', ü: 'u', Ç: 'c', Ğ: 'g', Ö: 'o', Ş: 's', Ü: 'u' };
const slug = (s) => String(s || '').replace(/[çğıİöşüÇĞÖŞÜ]/g, (c) => TR[c]).toLowerCase().normalize('NFD')
  .replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9_.]/g, '').slice(0, 20);
const DAY = 24 * 3600 * 1000;

// varsayılan başarımlar (admin ilk girişte config/achievements yoksa yazılır; sonra admin panelinden değişir)
const DEFAULT_ACHIEVEMENTS = {
  first_launch: { title: 'İlk Adım', desc: "Cubixora Launcher'ı ilk kez başlat.", icon: 'rocket', coins: 25, lp: 25, order: 1 },
  first_game: { title: 'Oyun Zamanı', desc: "Minecraft'ı Cubixora ile ilk kez başlat.", icon: 'play', coins: 25, lp: 25, order: 2 },
  mod_hunter: { title: 'Mod Avcısı', desc: 'İlk modunu indir.', icon: 'cube', coins: 25, lp: 25, order: 3 },
  visual_feast: { title: 'Görsel Şölen', desc: "İlk doku paketini indir.", icon: 'image', coins: 25, lp: 25, order: 4 },
  light_master: { title: 'Işık Ustası', desc: "İlk shader'ını indir.", icon: 'sun', coins: 25, lp: 25, order: 5 },
  sponsor: { title: 'Sponsor Dostu', desc: 'Partner bir sunucuya katıl.', icon: 'star', coins: 75, lp: 75, order: 6 },
  first_friend: { title: 'İlk Dostluk', desc: 'İlk arkadaşını ekle.', icon: 'user-plus', coins: 50, lp: 50, order: 7 },
  social_butterfly: { title: 'Sosyal Kelebek', desc: '5 arkadaşa ulaş.', icon: 'users', coins: 100, lp: 100, goal: 5, stat: 'friends', order: 8 },
  hello_world: { title: 'Merhaba Dünya', desc: 'İlk mesajını gönder.', icon: 'message', coins: 25, lp: 25, order: 9 },
  chatterbox: { title: 'Geveze', desc: 'Toplam 100 mesaj gönder.', icon: 'messages', coins: 100, lp: 100, goal: 100, stat: 'messages', order: 10 },
  team_founder: { title: 'Ekip Kurucu', desc: 'Bir grup sohbeti kur.', icon: 'share', coins: 50, lp: 50, order: 11 },
  voice_hello: { title: 'Sesli Selam', desc: 'İlk sesli aramanı yap.', icon: 'phone', coins: 50, lp: 50, order: 12 },
  room_party: { title: 'Oda Partisi', desc: 'Bir gruba katıl.', icon: 'mic', coins: 25, lp: 25, order: 13 },
  explorer: { title: 'Kâşif', desc: 'Mod tarayıcısında ilk aramanı yap.', icon: 'search', coins: 25, lp: 25, order: 14 },
  task_me: { title: 'Görev Bende', desc: 'İlk görevini tamamla.', icon: 'check', coins: 25, lp: 25, order: 15 },
  task_crazy: { title: 'Görev Delisi', desc: 'Toplam 25 görev tamamla.', icon: 'list', coins: 250, lp: 250, goal: 25, stat: 'tasks', order: 16 },
  rookie: { title: 'Çaylak Değil', desc: "Seviye 10'a ulaş.", icon: 'chevrons', coins: 150, lp: 0, goal: 10, stat: 'level', order: 17 },
  veteran: { title: 'Cubixora Gazisi', desc: "Seviye 50'ye ulaş.", icon: 'crown', coins: 1000, lp: 0, goal: 50, stat: 'level', order: 18 },
  stylish: { title: 'Tarz Sahibi', desc: 'İlk kozmetiğini satın al.', icon: 'bag', coins: 25, lp: 25, order: 19 },
  framed: { title: 'Çerçeveli', desc: 'Bir profil çerçevesi tak.', icon: 'frame', coins: 25, lp: 25, order: 20 },
  sharer: { title: 'Paylaşımcı', desc: 'Bir arkadaşına sunucu ya da profil paylaş.', icon: 'share2', coins: 25, lp: 25, order: 21 },
  addicted: { title: 'Bağımlı', desc: 'Toplam 10 saat Minecraft oyna.', icon: 'clock', coins: 200, lp: 200, goal: 600, stat: 'minutes', order: 22 },
  image_lover: { title: 'Görsel Sever', desc: 'Sohbette bir görsel paylaş.', icon: 'gif', coins: 25, lp: 25, order: 23 },
  voice_note: { title: 'Ses Kaydı', desc: 'Sohbette sesli mesaj gönder.', icon: 'mic2', coins: 25, lp: 25, order: 24 },
  photographer: { title: 'Fotoğrafçı', desc: 'Oyunda ekran görüntüsü alıp sohbette paylaş.', icon: 'camera', coins: 25, lp: 25, order: 25 }
};
const DEFAULT_REWARDS = { hourly: 1, hourlyLp: 1 };
const DEFAULT_LIMITS = { bgMaxKB: 280, bgMaxW: 1920, bgMaxH: 1080, imageMaxKB: 650, voiceMaxSec: 120 };

// seviye: n. seviye için gereken toplam LP = 50 * n * (n - 1)
const levelOf = (lp) => { let n = 1; while (50 * (n + 1) * n <= lp) n++; return n; };
const lpFor = (n) => 50 * n * (n - 1);

module.exports = function createSocial(ctx) {
  const { cloud, getConfig, saveConfig, send, log, protect, unprotect, DATA_DIR, app } = ctx;
  // veritabanı: Supabase (bulut kapalıysa bağlanmayan boş bir istemci; sosyal özellikler zaten giriş ister)
  const db = cloud.sb() || require('./sbdb')({ url: 'https://bulut-kapali.invalid', key: '', token: async () => null });
  // GEÇİCİ: Firebase'den taşıma ve eski sürümlere son gönderim için (admin). Bkz. legacy-firebase.js
  const legacy = () => require('./legacy-firebase')(cloud.cfg().firebaseLegacy);

  const me = () => cloud.uid();
  const acct = () => getConfig().account;
  const isOwnerEmail = () => !!(acct() && acct().cloud && String(acct().email || '').toLowerCase() === ADMIN_EMAIL);
  // Kurucu rütbesi olan da admin sayılır (kurallar da aynı şeyi kontrol eder)
  const isAdmin = () => isOwnerEmail() || !!(cache.profile && (cache.profile.roles || []).includes('founder'));
  const ROLES = ['founder', 'partner', 'plus'];
  // Cubixora+ süreli verilebilir: plusUntil (ms) geçtiyse rütbe artık geçerli sayılmaz
  const plusLive = (p) => !!p && (p.roles || []).includes('plus') && !(p.plusUntil > 0 && p.plusUntil < Date.now());
  const rolesLive = (p) => ((p && p.roles) || []).filter((r) => ROLES.includes(r) && (r !== 'plus' || plusLive(p)));
  const hasPlusPerk = () => !!cache.profile && (isAdmin() || plusLive(cache.profile));   // kurucu ya da (süresi dolmamış) Cubixora+
  const boostOf = (roles) => ((roles || []).some((r) => ROLES.includes(r)) ? 2 : 1);
  const pair = (a, b) => (a < b ? `${a}_${b}` : `${b}_${a}`);
  const now = () => Date.now();
  const SERVER = ['at'];

  // ------------------------------------------------------------ önbellek ve uzaktan ayarlar
  const cache = { profile: null, wallet: null, inventory: null, privates: null, config: {}, profiles: new Map(), presence: {} };
  async function remote(name, fallback, maxAge = name === 'shop' ? 2 * 60 * 1000 : 10 * 60 * 1000) {   // okuma kotası için: mağaza 2 dk, diğer ayarlar 10 dk önbellekte (adminin kendi değişikliği anında yansır)
    const c = cache.config[name];
    if (c && now() - c.at < maxAge) return c.value;
    try {
      // Supabase: önce sadece değişiklik zamanına bak; değişmediyse büyük belge (mağaza görselleri) tekrar indirilmez
      if (c && db.stamps) {
        const st = await db.stamps([`config/${name}`], false);
        if ((st[`config/${name}`] || 0) === (c.stamp || 0)) { c.at = now(); return c.value; }
      }
      const d = await db.get(`config/${name}`, false);
      const value = d || fallback;
      cache.config[name] = { at: now(), value, stamp: d ? d._updated || 0 : 0 };
      return value;
    } catch (e) { return c ? c.value : fallback; }
  }
  const achievements = async () => ((await remote('achievements', null)) || {}).list || DEFAULT_ACHIEVEMENTS;
  const limits = async () => ({ ...DEFAULT_LIMITS, ...((await remote('limits', {})) || {}) });
  // coin satın alma penceresi (admin panelinden: açık/kapalı, başlık, metin, buton, bağlantı)
  const COINBUY_DEFAULT = { enabled: true, title: 'Coin satın al', text: 'Coin satın almak için Discord sunucumuza gir ve bir ticket aç. Ekibimiz ödemeni onaylayınca coinlerin hesabına eklenir.', button: "Discord'a git", url: 'https://discord.gg/Cubixora', shopButton: true };
  const coinBuy = async () => ({ ...COINBUY_DEFAULT, ...((await remote('coinbuy', {})) || {}) });
  const partners = async () => ((await remote('partners', {})) || {}).list || [];
  // herkese ücretsiz verilen eşyalar: satın almadan envanterde sayılır (kurallar da izin verir)
  const FREE_ITEMS = { 'cape-cubixora': true, 'emote-opucuk': true, 'spray-logo': true };
  const withFree = (items) => ({ ...(items || {}), ...FREE_ITEMS });
  // admin "herkese ver" modları: give:'all' = herkese süresiz, give:'allTimed' + giveUntil = herkese süreli
  let shopGive = {};
  const giveLive = () => Object.fromEntries(Object.entries(shopGive).filter(([, u]) => u === 0 || u > now()));
  const shop = async () => {
    const items = { ...(((await remote('shop', {})) || {}).items || {}) };
    for (const id of Object.keys(FREE_ITEMS)) if (items[id]) items[id] = { ...items[id], price: 0, free: true };
    shopGive = {};
    for (const [id, it] of Object.entries(items)) {
      if (it.give === 'all') { shopGive[id] = 0; items[id] = { ...it, price: 0, free: true }; }
      else if (it.give === 'allTimed' && it.giveUntil > now()) { shopGive[id] = it.giveUntil; items[id] = { ...it, price: 0, free: true, giveUntil: it.giveUntil }; }
    }
    return items;
  };
  const presets = async () => ((await remote('presets', {})) || {}).list || {};

  // ------------------------------------------------------------ profil
  function publicProfile(p) {
    if (!p) return null;
    const pr = cache.presence[p.id] || {};
    let status = pr.s || 'offline';
    if (!pr.t || (!db.rtLive && now() - pr.t > STALE_MS)) status = 'offline';   // Supabase'de kopanlar sunucudan anında düşer
    if (status === 'invisible') status = 'offline';
    return {
      uid: p.id, displayName: p.displayName, handle: p.handle, mcName: p.mcName || '', avatar: p.avatar || '',
      statusMsg: p.statusMsg || '', frame: p.frame || '', color: p.color || '', bg: p.bg || '',
      created: p.created || p._updated, badges: p.badges || [], banned: !!p.banned, roles: rolesLive(p), plusUntil: p.plusUntil || 0,
      status, game: status !== 'offline' ? (pr.g || '') : '', visibility: p.visibility || 'all'
    };
  }

  async function pickHandle(base) {
    let h = slug(base);
    if (h.length < 3) h = 'oyuncu';
    for (let n = 0; n < 50; n++) {
      const cand = n ? `${h.slice(0, 20 - String(n).length)}${n}` : h;
      const d = await db.get(`handles/${cand}`, false);
      if (!d) return cand;
    }
    return `${h.slice(0, 12)}${crypto.randomBytes(3).toString('hex')}`;
  }

  // girişten sonra: profil, cüzdan, envanter yoksa oluşturulur
  const banKey = (email) => String(email || '').toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 120);
  const banErr = (why) => Object.assign(new Error(`Bu hesap yasaklandı${why ? ': ' + why : '.'}`), { banned: true });
  async function checkBan() {
    const uid = me(), a = acct(); if (!uid) return;
    const email = String((a && a.email) || '').toLowerCase();
    if (email) { const b = await db.get(`bannedEmails/${banKey(email)}`, false).catch(() => null); if (b) throw banErr(b.reason); }
    const p = await db.get(`profiles/${uid}`, false).catch(() => null);
    if (p && p.banned) throw banErr(p.banReason);
  }
  async function ensureAccount() {
    const uid = me();
    if (!uid) return null;
    const a = acct();
    if (a && a.email) db.set(`emails/${uid}`, { email: String(a.email).toLowerCase() }).catch(() => {});   // admin yasaklama için
    let p = await db.get(`profiles/${uid}`);
    if (!p) {
      const handle = await pickHandle(a.googleName || a.name);
      await db.commit([
        { set: `handles/${handle}`, data: { uid }, exists: false },
        { set: `profiles/${uid}`, data: { displayName: (a.googleName || a.name || 'Oyuncu').slice(0, 24), handle, mcName: a.needsNick ? '' : a.name,
          avatar: '', statusMsg: '', frame: '', color: '', bg: '', visibility: 'all', created: db.ts(now()) },
          serverTime: ['displayNameAt', 'handleAt'] }
      ]);
      p = await db.get(`profiles/${uid}`);
    }
    if (!p.mcName && !a.needsNick) { await db.patch(`profiles/${uid}`, { mcName: a.name }).catch(() => {}); p.mcName = a.name; }
    cache.profile = p;
    let w = await db.get(`wallets/${uid}`);
    if (!w) { await db.create('wallets', uid, { coins: 0, lp: 0, lastOp: '' }).catch(() => {}); w = { coins: 0, lp: 0 }; }
    cache.wallet = w;
    let inv = await db.get(`inventory/${uid}`);
    if (!inv) { await db.create('inventory', uid, { items: {} }).catch(() => {}); inv = { items: {} }; }
    cache.inventory = inv;
    cache.privates = (await db.get(`privates/${uid}`)) || { stats: {}, betaKeys: [] };
    await loadTimed();
    if (isAdmin()) await seedConfig().catch((e) => log(`[admin] ayarlar yazılamadı: ${e.message}`));
    // kurucu hesabı her zaman Kurucu rütbesini taşır
    if (isOwnerEmail() && cache.profile && !(cache.profile.roles || []).includes('founder')) {
      const roles = [...new Set([...(cache.profile.roles || []), 'founder'])];
      await db.patch(`profiles/${me()}`, { roles }).then(() => { cache.profile.roles = roles; }).catch((e) => log(`[admin] rütbe yazılamadı: ${e.message}`));
    }
    return summary();
  }

  async function seedConfig() {
    const shopDoc = await db.get('config/shop', false);
    if (shopDoc && shopDoc.items && !shopDoc.items['plus-cubixora']) {
      await db.patch('config/shop', { items: { ...shopDoc.items, 'plus-cubixora': PLUS_ITEM } }).catch(() => {});
      cache.config = {};
    }
    if (shopDoc && shopDoc.items && !shopDoc.items['emote-opucuk']) {
      await db.patch('config/shop', { items: { ...shopDoc.items, 'emote-opucuk': EMOTE_ITEM } }).catch(() => {});
      cache.config = {};
    }
    if (shopDoc && shopDoc.items && !shopDoc.items['spray-logo']) {
      await db.patch('config/shop', { items: { ...shopDoc.items, 'spray-logo': SPRAY_ITEM } }).catch(() => {});
      cache.config = {};
    }
    if (shopDoc && shopDoc.items) {
      const missing = Object.fromEntries(Object.entries(PROP_ITEMS).filter(([id]) => !shopDoc.items[id]));
      if (Object.keys(missing).length) { await db.patch('config/shop', { items: { ...shopDoc.items, ...missing } }).catch(() => {}); Object.assign(shopDoc.items, missing); cache.config = {}; }
      // efektler (kırmızı / mavi ateş): bir kez eklenir; admin sonradan silerse geri gelmez
      if (!shopDoc.seedFx) {
        const fx = Object.fromEntries(Object.entries(EFFECT_ITEMS).filter(([id]) => !shopDoc.items[id]));
        await db.patch('config/shop', { items: { ...shopDoc.items, ...fx }, seedFx: true }).catch(() => {}); cache.config = {};
      }
    }
    const ach = await db.get('config/achievements', false);
    if (!ach) await db.set('config/achievements', { list: DEFAULT_ACHIEVEMENTS });
    if (!(await db.get('config/rewards', false))) await db.set('config/rewards', DEFAULT_REWARDS);
    if (!(await db.get('config/limits', false))) await db.set('config/limits', DEFAULT_LIMITS);
    if (!(await db.get('config/partners', false))) await db.set('config/partners', { list: [] });
    if (!(await db.get('config/shop', false))) await db.set('config/shop', { items: defaultShop() });
    if (!(await db.get('config/presets', false))) await db.set('config/presets', { list: {} });
    if (!(await db.get('config/quests', false))) await db.set('config/quests', { events: {} });
    cache.config = {};
  }
  const SPRAY_ITEM = { name: 'Cubixora Spreyi', type: 'spray', ref: 'logo', rarity: 'yaygin', price: 0, active: true,
    desc: 'Baktığın bloğun yüzüne Cubixora logosunu basar. 10 saniye kalır, 10 saniyede bir kullanılır. Oyunda B çarkından.' };
  const EMOTE_ITEM = { name: 'Öpücük Emotesi', type: 'emote', ref: 'kiss', rarity: 'destansi', price: 800, active: true,
    desc: 'Elini ağzına götürüp öpücük gönderir, etrafında kalpler uçuşur. Oyunda B çarkından kullanılır; Cubixora kullanan herkes anlık görür.' };
  const PROP_ITEMS = {
    'hat-kask': { name: 'Pembe Kedi Kaskı', type: 'hat', ref: 'kask', rarity: 'destansi', price: 700, active: true,
      desc: 'Kulaklı ve papyonlu sevimli bir kask. Başına takılır; oyunda Cubixora kullanan herkes görür.' },
    'hat-buyucu': { name: 'Büyücü Şapkası', type: 'hat', ref: 'buyucu', rarity: 'nadir', price: 450, active: true,
      desc: 'Yıldız süslemeli uzun büyücü şapkası. Başına takılır; oyunda Cubixora kullanan herkes görür.' },
    'fpet-ejder': { name: 'Mini Ejder', type: 'fpet', ref: 'ejder', rarity: 'efsanevi', price: 1500, active: true,
      desc: 'Arkandan ve yukarından seni takip eden, kanat çırparak uçan küçük bir ejder. Nereye gidersen peşinden gelir.' }
  };
  const EFFECT_ITEMS = {
    'effect-ates': { name: 'Kırmızı Ateş', type: 'effect', ref: 'ates', rarity: 'efsanevi', price: 1500, active: true,
      desc: 'Etrafında yükselen kırmızı alevler. Oyunda Cubixora kullanan herkes görür.' },
    'effect-ruh': { name: 'Mavi Ateş', type: 'effect', ref: 'ruh', rarity: 'efsanevi', price: 2000, active: true,
      desc: 'Etrafında yükselen mavi ruh alevleri. Oyunda Cubixora kullanan herkes görür.' }
  };
  const PLUS_ITEM = { name: 'Cubixora+', type: 'plus', ref: 'plus', rarity: 'ozel', price: 5000, active: true, order: -1,
    desc: 'Cubixora+ rozeti, saatlik coin ve LP ödülü 2 kat, sohbette altın renkli isim ve öncelikli destek.' };
  function defaultShop() {
    const items = {};
    items['plus-cubixora'] = PLUS_ITEM;
    const capes = { cubixora: ['Cubixora Pelerini', 'efsanevi', 1500], galaksi: ['Galaksi Pelerini', 'destansi', 900], lav: ['Lav Pelerini', 'destansi', 900],
      gunbatimi: ['Gün Batımı Pelerini', 'nadir', 450], buz: ['Buzul Pelerini', 'nadir', 450], zumrut: ['Zümrüt Pelerini', 'nadir', 450] };
    for (const [id, [name, rarity, price]] of Object.entries(capes)) items[`cape-${id}`] = { name, type: 'cape', ref: id, rarity, price, active: true };
    const wings = { ejderha: ['Ejderha Kanadı', 'efsanevi', 2000], melek: ['Melek Kanadı', 'efsanevi', 2000], gece: ['Gece Kanadı', 'destansi', 1200] };
    for (const [id, [name, rarity, price]] of Object.entries(wings)) items[`wings-${id}`] = { name, type: 'wings', ref: id, rarity, price, active: true };
    items['emote-opucuk'] = EMOTE_ITEM;
    items['spray-logo'] = SPRAY_ITEM;
    Object.assign(items, PROP_ITEMS, EFFECT_ITEMS);
    items['pet-mini'] = { name: 'Omuz Arkadaşı (Mini Ben)', type: 'pet', ref: 'mini', rarity: 'nadir', price: 600, active: true };
    const frames = { altin: ['Altın Çerçeve', '#f5c542', 400], neon: ['Neon Çerçeve', '#2de2e6', 400], ates: ['Ateş Çerçevesi', '#ff5a1f', 700] };
    for (const [id, [name, color, price]] of Object.entries(frames)) items[`frame-${id}`] = { name, type: 'frame', ref: id, color, rarity: 'nadir', price, active: true };
    const colors = { mor: ['Mor Renk Paketi', '#8b5cf6', 250], mavi: ['Mavi Renk Paketi', '#3b82f6', 250], yesil: ['Yeşil Renk Paketi', '#22c55e', 250], kirmizi: ['Kırmızı Renk Paketi', '#ef4444', 250] };
    for (const [id, [name, color, price]] of Object.entries(colors)) items[`color-${id}`] = { name, type: 'color', ref: id, color, rarity: 'yaygin', price, active: true };
    return items;
  }

  function summary() {
    const w = cache.wallet || { coins: 0, lp: 0 };
    const lvl = levelOf(w.lp || 0);
    return {
      uid: me(), admin: isAdmin(), profile: publicProfile(cache.profile ? { ...cache.profile, id: me() } : null),
      wallet: { coins: w.coins || 0, lp: w.lp || 0, level: lvl, next: lpFor(lvl + 1), cur: lpFor(lvl) },
      inventory: myInv(), timed: timedLive(), status: myStatus,
      displayNameAt: cache.profile && cache.profile.displayNameAt, handleAt: cache.profile && cache.profile.handleAt
    };
  }

  async function refreshMe() {
    const uid = me(); if (!uid) return null;
    const [p, w, inv] = await Promise.all([db.get(`profiles/${uid}`), db.get(`wallets/${uid}`), db.get(`inventory/${uid}`)]);
    if (p) cache.profile = p; if (w) cache.wallet = w; if (inv) cache.inventory = inv;
    await loadTimed();
    await shop().catch(() => {});   // "herkese ver" ürünleri envantere işlensin
    // süresi dolan Cubixora+: rütbeyi kendi hesabımızdan kaldır (kurallar bunu yalnızca süre dolunca kabul eder)
    if (p && (p.roles || []).includes('plus') && p.plusUntil > 0 && p.plusUntil < Date.now()) {
      const roles = p.roles.filter((r) => r !== 'plus');
      await db.patch(`profiles/${uid}`, { roles }).then(() => { cache.profile.roles = roles; }).catch(() => {});
    }
    return summary();
  }

  async function updateProfile(patchIn) {
    const uid = me(); if (!uid) throw new Error('Bu özellik için Google ya da e-posta ile giriş yapmalısın.');
    const p = cache.profile || (await db.get(`profiles/${uid}`));
    const allowed = ['displayName', 'statusMsg', 'frame', 'color', 'bg', 'avatar', 'visibility', 'mcName'];
    const data = {};
    for (const k of allowed) if (patchIn[k] !== undefined) data[k] = patchIn[k];
    const writes = [];
    const serverTime = [];
    if (data.displayName !== undefined) {
      data.displayName = String(data.displayName).trim().slice(0, 24);
      if (!data.displayName) throw new Error('Görünen ad boş olamaz.');
      if (data.displayName === p.displayName) delete data.displayName;
      else {
        const next = (p.displayNameAt || 0) + 15 * DAY;
        if (now() < next) throw new Error(`Görünen adını ${Math.ceil((next - now()) / DAY)} gün sonra tekrar değiştirebilirsin.`);
        serverTime.push('displayNameAt');
      }
    }
    if (patchIn.handle !== undefined) {
      const h = String(patchIn.handle).trim().toLowerCase().replace(/^@/, '');
      if (h !== p.handle) {
        if (!HANDLE_RE.test(h)) throw new Error('Kullanıcı adı 3-20 karakter olmalı; küçük harf, rakam, _ ve . kullanılabilir.');
        const next = (p.handleAt || 0) + 30 * DAY;
        if (now() < next) throw new Error(`Kullanıcı adını ${Math.ceil((next - now()) / DAY)} gün sonra tekrar değiştirebilirsin.`);
        const taken = await db.get(`handles/${h}`, false);
        if (taken && taken.uid !== uid) throw new Error('Bu kullanıcı adı başkası tarafından kullanılıyor.');
        data.handle = h; serverTime.push('handleAt');
        writes.push({ set: `handles/${h}`, data: { uid }, exists: false });
        writes.push({ delete: `handles/${p.handle}` });
      }
    }
    if (data.statusMsg !== undefined) data.statusMsg = String(data.statusMsg).replace(/\r/g, '').split('\n').map((l) => l.trimEnd()).slice(0, 4).join('\n').replace(/\n{2,}/g, '\n').trim().slice(0, 160);   // en fazla 4 satır
    if (data.bg !== undefined && data.bg) {
      const lim = await limits();
      if (!/^data:image\/(jpeg|png|webp);base64,/.test(data.bg)) throw new Error('Arka plan bir resim olmalı.');
      if (data.bg.length * 0.75 > lim.bgMaxKB * 1024) throw new Error(`Arka plan en fazla ${lim.bgMaxKB} KB olabilir.`);
    }
    const mask = Object.keys(data);
    if (!mask.length && !serverTime.length) return summary();
    // kurallar tüm profili kontrol eder; handle değişince yeni handles kaydı aynı işlemde oluşur
    writes.push({ set: `profiles/${uid}`, data, mask: [...mask, ...serverTime.filter((f) => !mask.includes(f))].filter((f) => !serverTime.includes(f)), serverTime });
    await db.commit(writes);
    if (data.frame) await claimAchievement('framed').catch(() => {});
    return refreshMe();
  }

  // Minecraft adı -> hesap kimliği (oyun içi ses için); usernames herkese açık okunur
  const uidCache = new Map();
  async function uidOf(name) {
    const k = String(name || '').toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (!k) return null;
    const c = uidCache.get(k);
    if (c && Date.now() - c.at < (c.uid ? 600000 : 45000)) return c.uid;
    let uid = null;
    try { const d = await db.get(`usernames/${k}`, false); uid = d && d.uid ? String(d.uid) : null; } catch { return c ? c.uid : null; }
    uidCache.set(k, { uid, at: Date.now() });
    return uid;
  }
  async function getProfile(uid) {
    const p = await db.get(`profiles/${uid}`);
    if (!p) throw new Error('Profil bulunamadı.');
    await loadPresence([uid]);
    const [w, inv] = await Promise.all([db.get(`wallets/${uid}`).catch(() => null), db.get(`inventory/${uid}`).catch(() => null)]);
    const lp = (w && w.lp) || 0;
    const out = publicProfile({ ...p, id: uid });
    out.level = levelOf(lp); out.lp = lp;
    out.inventory = withFree(inv && inv.items);
    out.friendship = uid === me() ? 'self' : friendState(uid);
    return out;
  }

  // ------------------------------------------------------------ anlık durum (presence)
  let myStatus = 'online', heart = null, gameText = '';
  const BEAT_MS = 30 * 1000, STALE_MS = 80 * 1000; // 30 sn'de bir "buradayım", 80 sn ses yoksa çevrimdışı
  // arkadaşların durumu anlık akıştan gelir (Realtime Presence); değişenler toplu olarak arayüze gönderilir
  let stopPresence = null, presTimer = null, presDirty = new Set(), lastShown = {};
  const shownStatus = (uid) => { const p = publicProfile({ id: uid }); return p ? `${p.status}|${p.game}` : ''; };
  function flushPresence() {
    presTimer = null;
    const out = [];
    for (const uid of presDirty) {
      const v = shownStatus(uid);
      if (lastShown[uid] !== v) { lastShown[uid] = v; const [status, game] = v.split('|'); out.push({ uid, status, game }); }
    }
    presDirty.clear();
    if (out.length) send('social:presence', out);
  }
  function markPresence(uids) { for (const u of uids) presDirty.add(u); if (!presTimer) presTimer = setTimeout(flushPresence, 400); }
  function listenPresence() {
    if (stopPresence) stopPresence();
    stopPresence = db.rtListen('presence', (ev) => {
      if (ev.path === '/') { cache.presence = ev.data || {}; markPresence(Object.keys(cache.presence)); return; }
      const parts = ev.path.slice(1).split('/');
      const uid = parts[0];
      if (parts.length === 1) { if (ev.data) cache.presence[uid] = ev.data; else delete cache.presence[uid]; }
      else { cache.presence[uid] = { ...(cache.presence[uid] || {}), [parts[1]]: ev.data }; }
      markPresence([uid]);
    });
  }
  // sessizce kapananlar (elektrik, internet) 80 sn sonra çevrimdışı görünsün
  let sweepTimer = null;
  function sweep() { markPresence(Object.keys(cache.presence)); }
  async function setStatus(s) {
    if (!['online', 'idle', 'dnd', 'invisible'].includes(s)) return;
    myStatus = s;
    const c = getConfig(); c.social = { ...(c.social || {}), status: s }; saveConfig();
    await beat();
    return s;
  }
  async function beat() {
    const uid = me(); if (!uid) return;
    const vis = (cache.profile && cache.profile.visibility) || 'all';
    const s = vis === 'none' ? 'invisible' : myStatus;
    await db.rtSet(`presence/${uid}`, { s, t: { '.sv': 'timestamp' }, g: s === 'invisible' ? '' : gameText }).catch((e) => log(`[sosyal] durum: ${e.message}`));
  }
  function setGame(text) { gameText = text || ''; beat(); }
  // Tüm "presence" tablosunu indirmek kullanıcı sayısıyla büyür; art arda gelen çağrılar (arkadaşlar, sohbetler, arama)
  // 10 sn içinde aynı sonucu paylaşır, aynı anda gelenler tek isteğe indirgenir.
  let presAt = 0, presInflight = null;
  async function loadPresence() {
    if (now() - presAt < 10000) return cache.presence;
    if (!presInflight) {
      presInflight = (async () => {
        try { cache.presence = (await db.rtGet('presence')) || {}; presAt = now(); } catch {}
      })().finally(() => { presInflight = null; });
    }
    await presInflight;
    return cache.presence;
  }

  // ------------------------------------------------------------ sinyaller (anlık olaylar)
  let stopListen = null;
  const seenSig = new Set();
  function listen() {
    if (stopListen) stopListen();
    const uid = me(); if (!uid) return;
    stopListen = db.rtListen(`sig/${uid}`, (ev) => {
      // ilk "put" tüm bekleyenleri getirir, sonra tek tek gelir
      const items = ev.path === '/' ? (ev.data || {}) : { [ev.path.slice(1).split('/')[0]]: ev.data };
      for (const [id, data] of Object.entries(items)) {
        if (!data || seenSig.has(id)) continue;
        seenSig.add(id);
        db.rtDel(`sig/${uid}/${id}`).catch(() => {});
        if (data.t && now() - data.t > 60 * 1000 && data.type === 'call') continue; // eski arama
        send('social:signal', data);
      }
    }, (state) => send('social:conn', state));
  }
  const signal = (to, payload) => db.rtPush(`sig/${to}`, { ...payload, from: me(), t: { '.sv': 'timestamp' } });

  // ------------------------------------------------------------ arkadaşlar
  let friendCache = { list: [], incoming: [], outgoing: [], at: 0 };
  function friendState(uid) {
    if (friendCache.list.some((f) => f.uid === uid)) return 'friend';
    if (friendCache.incoming.some((r) => r.from === uid)) return 'incoming';
    if (friendCache.outgoing.some((r) => r.to === uid)) return 'outgoing';
    return 'none';
  }
  async function loadProfiles(uids) {
    let need = uids.filter((u) => !cache.profiles.has(u) || now() - cache.profiles.get(u)._at > 5 * 60 * 1000);
    if (need.length && db.stamps) {
      // önbellekte olup değişmeyenler tekrar indirilmez (Supabase veri çıkışı kotası)
      const known = need.filter((u) => cache.profiles.has(u));
      if (known.length) {
        const st = await db.stamps(known.map((u) => `profiles/${u}`)).catch(() => null);
        if (st) for (const u of known) { const p = cache.profiles.get(u); if ((st[`profiles/${u}`] || -1) === p._updated) p._at = now(); }
        need = need.filter((u) => !cache.profiles.has(u) || now() - cache.profiles.get(u)._at > 5 * 60 * 1000);
      }
    }
    if (need.length) {
      const docs = await db.batchGet(need.map((u) => `profiles/${u}`), { omit: ['bg'] });   // arka plan sadece profil açılınca indirilir
      for (const d of docs) cache.profiles.set(d.id, { ...d, _at: now() });
    }
    return uids.map((u) => cache.profiles.get(u)).filter(Boolean);
  }
  async function friends() {
    const uid = me(); if (!uid) return { list: [], incoming: [], outgoing: [] };
    const [fs1, inc, out] = await Promise.all([
      db.query('friendships', { where: [['members', 'ARRAY_CONTAINS', uid]] }),
      db.query('friendRequests', { where: [['to', 'EQUAL', uid]] }),
      db.query('friendRequests', { where: [['from', 'EQUAL', uid]] })
    ]);
    await loadPresence();
    const ids = [...new Set([...fs1.map((f) => f.members.find((m) => m !== uid)), ...inc.map((r) => r.from), ...out.map((r) => r.to)])];
    await loadProfiles(ids);
    const prof = (u) => publicProfile(cache.profiles.get(u) ? { ...cache.profiles.get(u), id: u } : { id: u, displayName: 'Oyuncu', handle: '' });
    friendCache = {
      list: fs1.map((f) => ({ ...prof(f.members.find((m) => m !== uid)), since: f.since })),
      incoming: inc.map((r) => ({ ...prof(r.from), from: r.from, at: r.at })),
      outgoing: out.map((r) => ({ ...prof(r.to), to: r.to, at: r.at })),
      at: now()
    };
    bumpStat('friends', friendCache.list.length, true);
    return friendCache;
  }
  async function searchUsers(q, all = false) {
    q = String(q || '').trim().toLowerCase().replace(/^@/, '');
    let docs;
    if (q) docs = await db.query('profiles', { where: [['handle', 'GREATER_THAN_OR_EQUAL', q], ['handle', 'LESS_THAN', q + '']], orderBy: [['handle', 'asc']], limit: 30, omit: ['bg'] });
    else docs = await db.query('profiles', { orderBy: [['created', 'desc']], limit: 40, omit: ['bg'] });
    await loadPresence();
    return docs.filter((d) => all || (d.id !== me() && !d.banned)).map((d) => ({ ...publicProfile(d), banned: !!d.banned, self: d.id === me(), friendship: friendState(d.id) }));
  }
  async function sendRequest(to) {
    const uid = me();
    if (to === uid) throw new Error('Kendini ekleyemezsin.');
    // karşı taraf zaten istek göndermişse direkt kabul et
    if (friendCache.incoming.some((r) => r.from === to)) return acceptRequest(to);
    await db.commit([{ set: `friendRequests/${uid}_${to}`, data: { from: uid, to }, serverTime: ['at'] }]);
    await signal(to, { type: 'friend-request' }).catch(() => {});
    return friends();
  }
  async function acceptRequest(from) {
    const uid = me();
    const members = [uid, from].sort();
    await db.commit([{ set: `friendships/${members.join('_')}`, data: { members }, serverTime: ['since'] }]);
    await db.del(`friendRequests/${from}_${uid}`).catch(() => {});
    await db.del(`friendRequests/${uid}_${from}`).catch(() => {});
    await signal(from, { type: 'friend-accepted' }).catch(() => {});
    await claimAchievement('first_friend').catch(() => {});
    activity('friend', 'Yeni bir arkadaş edindi').catch(() => {});
    return friends();
  }
  async function declineRequest(uid2, outgoing) {
    const uid = me();
    await db.del(outgoing ? `friendRequests/${uid}_${uid2}` : `friendRequests/${uid2}_${uid}`).catch(() => {});
    return friends();
  }
  async function removeFriend(uid2) { await db.del(`friendships/${pair(me(), uid2)}`); return friends(); }

  // ------------------------------------------------------------ sohbetler (özel + grup)
  async function conversations() {
    const uid = me(); if (!uid) return [];
    const [chats, groups] = await Promise.all([
      db.query('chats', { where: [['members', 'ARRAY_CONTAINS', uid]] }),
      db.query('groups', { where: [['members', 'ARRAY_CONTAINS', uid]] })
    ]);
    const others = chats.map((c) => c.members.find((m) => m !== uid));
    await loadProfiles([...new Set([...others, ...groups.flatMap((g) => g.members)])]);
    await loadPresence();
    const reads = (getConfig().social || {}).reads || {};
    const out = [
      ...chats.map((c) => {
        const o = c.members.find((m) => m !== uid);
        const p = cache.profiles.get(o);
        return { id: c.id, kind: 'dm', other: o, title: p ? p.displayName : 'Oyuncu', peer: p ? publicProfile({ ...p, id: o }) : null,
          lastText: c.lastText || '', lastAt: c.lastAt || 0, lastFrom: c.lastFrom || '', unread: (c.lastAt || 0) > (reads[c.id] || 0) && c.lastFrom !== uid };
      }),
      ...groups.map((g) => ({ id: g.id, kind: 'group', title: g.name, icon: g.icon || '', owner: g.owner, members: g.members, settings: g.settings || {},
        memberProfiles: g.members.map((m) => cache.profiles.get(m)).filter(Boolean).map((p) => publicProfile(p)),
        lastText: g.lastText || '', lastAt: g.lastAt || g.created || 0, lastFrom: g.lastFrom || '', unread: (g.lastAt || 0) > (reads[g.id] || 0) && g.lastFrom !== uid }))
    ];
    return out.sort((a, b) => b.lastAt - a.lastAt);
  }
  const convPath = (kind, id) => (kind === 'group' ? `groups/${id}` : `chats/${id}`);
  async function messages(kind, id, { after, before } = {}) {
    const col = `${convPath(kind, id)}/messages`;
    let docs;
    if (after) docs = await db.query(col, { where: [['at', 'GREATER_THAN', db.ts(after)]], orderBy: [['at', 'asc']], limit: 100 });
    else {
      const q = () => db.query(col, { ...(before ? { where: [['at', 'LESS_THAN', db.ts(before)]] } : {}), orderBy: [['at', 'desc']], limit: 40 });
      try { docs = await q(); }
      catch (e) { // yeni kurulan grupta ilk okuma bazen reddedilir: bir kez daha dene
        log(`[sohbet] ${col} okunamadı: ${e.message} ${JSON.stringify(e.raw || {}).slice(0, 300)}`);
        await new Promise((r) => setTimeout(r, 1200));
        docs = await q();
      }
      docs.reverse();
    }
    const senders = [...new Set(docs.map((d) => d.from))];
    await loadProfiles(senders);
    markRead(id);
    return docs.map((d) => ({ id: d.id, from: d.from, text: d.deleted ? '' : d.text || '', image: d.deleted ? '' : d.image || '', audio: d.deleted ? '' : d.audio || '',
      dur: d.dur || 0, kind: d.kind || '', deleted: !!d.deleted, at: d.at,
      sender: cache.profiles.get(d.from) ? publicProfile({ ...cache.profiles.get(d.from), id: d.from }) : null }));
  }
  function markRead(id) {
    const c = getConfig(); c.social = c.social || {}; c.social.reads = { ...(c.social.reads || {}), [id]: now() }; saveConfig();
  }
  async function openDm(other) {
    const uid = me();
    const id = pair(uid, other);
    const existing = await db.get(`chats/${id}`).catch(() => null);
    if (!existing) await db.create('chats', id, { members: [uid, other].sort(), lastText: '', lastAt: db.ts(now()), lastFrom: '' });
    return id;
  }
  async function sendMessage(kind, id, msg) {
    const uid = me();
    const lim = await limits();
    const data = { from: uid };
    if (msg.text) data.text = String(msg.text).slice(0, 2000);
    if (msg.image) { if (msg.image.length * 0.75 > lim.imageMaxKB * 1024 * 1.4) throw new Error('Görsel çok büyük.'); data.image = msg.image; data.kind = msg.kind || 'image'; }
    if (msg.audio) { if ((msg.dur || 0) > lim.voiceMaxSec + 2) throw new Error(`Sesli mesaj en fazla ${lim.voiceMaxSec} saniye olabilir.`); data.audio = msg.audio; data.dur = Math.round(msg.dur || 0); }
    if (!data.text && !data.image && !data.audio) return null;
    const base = convPath(kind, id);
    const mid = crypto.randomBytes(10).toString('hex');
    const summaryText = data.text ? data.text.slice(0, 80) : data.image ? '📷 Görsel' : '🎤 Sesli mesaj';
    await db.commit([
      { set: `${base}/messages/${mid}`, data, serverTime: ['at'], exists: false },
      { set: base, data: { lastText: summaryText, lastFrom: uid }, mask: ['lastText', 'lastFrom'], serverTime: ['lastAt'] }
    ]);
    // alıcılara anlık haber
    let targets = [];
    if (kind === 'dm') targets = [id.split('_').find((x) => x !== uid)];
    else { const g = await db.get(`groups/${id}`); targets = (g.members || []).filter((m) => m !== uid); }
    for (const t of targets) signal(t, { type: 'message', kind, conv: id, preview: summaryText }).catch(() => {});
    bumpStat('messages', 1);
    claimAchievement('hello_world').catch(() => {});
    if (data.image) claimAchievement(msg.kind === 'screenshot' ? 'photographer' : 'image_lover').catch(() => {});
    if (data.audio) claimAchievement('voice_note').catch(() => {});
    markRead(id);
    return mid;
  }
  async function deleteMessage(kind, id, mid) {
    await db.patch(`${convPath(kind, id)}/messages/${mid}`, { deleted: true, text: '', image: '', audio: '' });
    return true;
  }

  // ---- gruplar
  async function createGroup({ name, members = [] }) {
    const uid = me();
    name = String(name || '').trim().slice(0, 40) || 'Yeni grup';
    const all = [...new Set([uid, ...members])].slice(0, 50);
    const gid = crypto.randomBytes(8).toString('hex');
    await db.commit([{ set: `groups/${gid}`, data: { name, owner: uid, members: all, settings: { canMessage: true, canInvite: false }, lastText: 'Grup oluşturuldu', lastFrom: uid }, serverTime: ['created', 'lastAt'], exists: false }]);
    for (const m of all) if (m !== uid) signal(m, { type: 'group', conv: gid, action: 'added' }).catch(() => {});
    claimAchievement('team_founder').catch(() => {});
    return gid;
  }
  async function groupAction(gid, action, arg) {
    const uid = me();
    const g = await db.get(`groups/${gid}`);
    if (!g) throw new Error('Grup bulunamadı.');
    const owner = g.owner === uid;
    const settings = g.settings || {};
    switch (action) {
      case 'invite': {
        if (!owner && !settings.canInvite) throw new Error('Bu grupta üye ekleme yetkin yok.');
        const add = (Array.isArray(arg) ? arg : [arg]).filter((m) => !g.members.includes(m));
        if (!add.length) return true;
        await db.patch(`groups/${gid}`, { members: [...g.members, ...add].slice(0, 50) });
        for (const m of add) signal(m, { type: 'group', conv: gid, action: 'added' }).catch(() => {});
        return true;
      }
      case 'kick':
        if (!owner) throw new Error('Sadece grup sahibi üye çıkarabilir.');
        if (arg === uid) throw new Error('Kendini çıkaramazsın, grubu silebilir ya da sahipliği devredebilirsin.');
        await db.patch(`groups/${gid}`, { members: g.members.filter((m) => m !== arg) });
        return true;
      case 'leave':
        if (owner) throw new Error('Grup sahibi ayrılamaz. Önce sahipliği başka birine devret ya da grubu sil.');
        await db.patch(`groups/${gid}`, { members: g.members.filter((m) => m !== uid) });
        return true;
      case 'transfer':
        if (!owner) throw new Error('Sadece grup sahibi yetki devredebilir.');
        if (!g.members.includes(arg)) throw new Error('Bu kişi grupta değil.');
        await db.patch(`groups/${gid}`, { owner: arg });
        signal(arg, { type: 'group', conv: gid, action: 'owner' }).catch(() => {});
        return true;
      case 'settings':
        if (!owner) throw new Error('Grup ayarlarını sadece grup sahibi değiştirebilir.');
        await db.patch(`groups/${gid}`, { settings: { canMessage: !!arg.canMessage, canInvite: !!arg.canInvite }, ...(arg.name ? { name: String(arg.name).slice(0, 40) } : {}) });
        for (const m of g.members) if (m !== uid) signal(m, { type: 'group', conv: gid, action: 'updated' }).catch(() => {}); // diğer üyelerde anında güncellensin
        return true;
      case 'delete':
        if (!owner) throw new Error('Grubu sadece sahibi silebilir.');
        await db.del(`groups/${gid}`);
        return true;
      default: throw new Error('Bilinmeyen işlem');
    }
  }

  // ------------------------------------------------------------ bildirimler
  let notifGlobal = { at: 0, list: [] };
  async function notifications() {
    const uid = me(); if (!uid) return [];
    const [global, inbox] = await Promise.all([
      (notifGlobal.at && now() - notifGlobal.at < 5 * 60 * 1000) ? notifGlobal.list
        : db.query('notifications', { orderBy: [['at', 'desc']], limit: 20 }).then((l) => { notifGlobal = { at: now(), list: l }; return l; }).catch(() => notifGlobal.list),
      db.query(`inbox/${uid}/items`, { orderBy: [['at', 'desc']], limit: 30 }).catch(() => [])
    ]);
    const seen = (getConfig().social || {}).notifSeen || 0;
    return [...global.map((n) => ({ ...n, scope: 'all', read: (n.at || 0) <= seen })), ...inbox.map((n) => ({ ...n, scope: 'me', read: !!n.read || (n.at || 0) <= seen }))]
      .sort((a, b) => (b.at || 0) - (a.at || 0));
  }
  function markNotificationsSeen() { const c = getConfig(); c.social = { ...(c.social || {}), notifSeen: now() }; saveConfig(); return true; }

  // ------------------------------------------------------------ coin, başarım, etkinlik
  async function activity(type, text, coins = 0, lp = 0) {
    const uid = me(); if (!uid) return;
    await db.commit([{ set: `activity/${uid}/items/${crypto.randomBytes(8).toString('hex')}`, data: { type, text, coins, lp }, serverTime: ['at'], exists: false }]);
  }
  async function activityOf(uid, limit = 20) {
    return db.query(`activity/${uid}/items`, { orderBy: [['at', 'desc']], limit });
  }
  async function claims(uid) {
    const list = await db.list(`claims/${uid || me()}/items`, { pageSize: 300 });
    return Object.fromEntries(list.map((c) => [c.id, c.at]));
  }
  let claimed = null;
  async function claimed$() { if (!claimed) claimed = await claims().catch(() => ({})); return claimed; }
  const claimQueue = { p: Promise.resolve() };
  function claimAchievement(id) {
    return (claimQueue.p = claimQueue.p.then(() => doClaim(id), () => doClaim(id)));
  }
  async function doClaim(id) {
    const uid = me(); if (!uid) return null;
    const list = await achievements();
    const a = list[id];
    if (!a) return null;
    const key = `ach:${id}`;
    const have = await claimed$();
    if (have[key]) return null;
    await db.commit([
      { set: `wallets/${uid}`, data: { lastOp: key }, mask: ['lastOp'], increments: { coins: a.coins || 0, lp: a.lp || 0 } },
      { set: `claims/${uid}/items/${key}`, data: {}, serverTime: ['at'], exists: false }
    ]);
    have[key] = now();
    await activity('achievement', `"${a.title}" başarımını kazandı`, a.coins || 0, a.lp || 0).catch(() => {});
    const before = levelOf((cache.wallet && cache.wallet.lp) || 0);
    await refreshMe();
    send('social:reward', { kind: 'achievement', id, title: a.title, desc: a.desc, coins: a.coins || 0, lp: a.lp || 0, icon: a.icon });
    bumpStat('tasks', 1);
    checkLevel(before);
    return true;
  }
  function checkLevel(before) {
    const lvl = levelOf((cache.wallet && cache.wallet.lp) || 0);
    if (lvl > before) send('social:reward', { kind: 'level', level: lvl });
    bumpStat('level', lvl, true);
  }
  // saatlik "launcher'da vakit geçirdi" ödülü
  async function hourly() {
    const uid = me(); if (!uid) return;
    const hour = Math.floor(now() / 3600000);
    const key = `time:${hour}`;
    const c = getConfig(); if ((c.social || {}).lastHour === hour) return;
    const r0 = await remote('rewards', DEFAULT_REWARDS);
    const k = boostOf(rolesLive(cache.profile));
    const r = { ...r0, hourly: (r0.hourly || 0) * k, hourlyLp: (r0.hourlyLp == null ? 1 : r0.hourlyLp) * k };
    try {
      await db.commit([
        { set: `wallets/${uid}`, data: { lastOp: key }, mask: ['lastOp'], increments: { coins: r.hourly || 0, lp: r.hourlyLp == null ? 1 : r.hourlyLp } },
        { set: `claims/${uid}/items/${key}`, data: {}, serverTime: ['at'], exists: false }
      ]);
      c.social = { ...(c.social || {}), lastHour: hour }; saveConfig();
      await activity('time', "Cubixora'da vakit geçirdi", r.hourly || 0, r.hourlyLp == null ? 1 : r.hourlyLp).catch(() => {});
      const before = levelOf((cache.wallet && cache.wallet.lp) || 0);
      await refreshMe();
      send('social:reward', { kind: 'hourly', coins: r.hourly || 0, lp: r.hourlyLp == null ? 1 : r.hourlyLp });
      checkLevel(before);
    } catch (e) {
      if (/izn/.test(e.message)) { c.social = { ...(c.social || {}), lastHour: hour }; saveConfig(); }
      log(`[sosyal] saatlik ödül: ${e.message}`);
    }
  }

  // privates belgesine yazma kotası: dakikalık sayaçlar (launcher/oyun süresi) her dakika yazılmaz,
  // en geç 5 dk'da bir toplu yazılır; görev/başarım tamamlanınca 2,5 sn içinde, launcher kapanırken de hemen yazılır
  let privPend = null, privTimer = null, privUrgent = false;
  function privSave(fields, urgent) {
    privPend = { ...(privPend || {}), ...fields };
    if (urgent && !privUrgent) { privUrgent = true; clearTimeout(privTimer); privTimer = null; }
    if (!privTimer) privTimer = setTimeout(flushPriv, urgent ? 2500 : 5 * 60 * 1000);
  }
  function flushPriv() {
    clearTimeout(privTimer); privTimer = null; privUrgent = false;
    const uid = me(), data = privPend; privPend = null;
    if (!uid || !data) return Promise.resolve();
    return db.patch(`privates/${uid}`, data).catch(() => {});
  }
  // istatistikler (hedefli başarımlar)
  function bumpStat(name, n, absolute) {
    if (!me() || !cache.privates) return;
    questBump(name, n, absolute);
    const st = cache.privates.stats = cache.privates.stats || {};
    const prev = st[name] || 0;
    st[name] = absolute ? Math.max(prev, n) : prev + n;
    if (st[name] === prev) return;   // değişmediyse yazma
    privSave({ stats: st }, false);
    achievements().then((list) => {
      for (const [id, a] of Object.entries(list)) if (a.stat === name && a.goal && st[name] >= a.goal) claimAchievement(id).catch(() => {});
    });
  }
  function track(event, n = 1) {
    const map = { launch: 'first_launch', game: 'first_game', mod: 'mod_hunter', resourcepack: 'visual_feast', shader: 'light_master',
      partner: 'sponsor', search: 'explorer', call: 'voice_hello', group_join: 'room_party', share: 'sharer' };
    if (event !== 'minutes') questBump(event, n);
    if (event === 'minutes') return bumpStat('minutes', n);
    if (map[event]) return claimAchievement(map[event]).catch(() => {});
  }
  async function achievementView(uid) {
    const list = await achievements();
    const have = uid && uid !== me() ? await claims(uid) : await claimed$();
    const st = uid && uid !== me() ? {} : ((cache.privates && cache.privates.stats) || {});
    return Object.entries(list).sort((a, b) => (a[1].order || 99) - (b[1].order || 99))
      .map(([id, a]) => ({ id, ...a, done: !!have[`ach:${id}`], at: have[`ach:${id}`] || null, progress: a.stat ? Math.min(a.goal || 0, st[a.stat] || 0) : null }));
  }

  // ------------------------------------------------------------ mağaza ve envanter
  async function buy(itemId) {
    const uid = me(); if (!uid) throw new Error('Mağaza için Google ya da e-posta ile giriş yapmalısın.');
    const items = await shop();
    const it = items[itemId];
    if (!it || it.active === false) throw new Error('Bu ürün satışta değil.');
    await refreshMe();
    if (it.questOnly) throw new Error('Bu ürün sadece görev ödülü olarak kazanılır.');
    if (myInv()[itemId]) throw new Error('Bu ürün zaten sende.');
    if ((cache.wallet.coins || 0) < it.price) throw new Error(`Yeterli coinin yok. ${it.price - (cache.wallet.coins || 0)} coin daha lazım.`);
    const key = `buy:${itemId}`;
    const have = await claimed$();
    if (have[key]) throw new Error('Bu ürünü daha önce almışsın.');
    await db.commit([
      { set: `wallets/${uid}`, data: { lastOp: key }, mask: ['lastOp'], increments: { coins: -it.price } },
      { set: `claims/${uid}/items/${key}`, data: {}, serverTime: ['at'], exists: false },
      { set: `inventory/${uid}`, data: { items: { [itemId]: true } }, mask: [`items.\`${itemId}\``] }
    ]);
    have[key] = now();
    if (it.type === 'plus') { // Cubixora+ alındı: rütbe profile eklenir
      const roles = [...new Set([...((cache.profile && cache.profile.roles) || []), 'plus'])];
      await db.patch(`profiles/${uid}`, { roles, plusUntil: 0 }).catch((e) => log(`[mağaza] Cubixora+ rütbesi yazılamadı: ${e.message}`));
    }
    await activity('purchase', `"${it.name}" satın aldı`).catch(() => {});
    await refreshMe();
    claimAchievement('stylish').catch(() => {});
    questBump('buy', 1);
    return summary();
  }
  async function redeem(code) {
    const uid = me(); if (!uid) throw new Error('Hediye kodu için giriş yapmalısın.');
    code = String(code || '').trim().toUpperCase();
    if (!/^[A-Z0-9-]{4,40}$/.test(code)) throw new Error('Geçersiz kod.');
    const g = await db.get(`giftCodes/${code}`).catch(() => null);
    if (!g || !g.active) throw new Error('Bu kod geçersiz ya da süresi dolmuş.');
    if (g.expires && now() > g.expires) throw new Error('Bu kodun süresi dolmuş.');
    const key = `gift:${code}`;
    const have = await claimed$();
    if (have[key]) throw new Error('Bu kodu zaten kullandın.');
    const items = (g.items || []).filter((i) => !(cache.inventory.items || {})[i]);
    const writes = [
      { set: `wallets/${uid}`, data: { lastOp: key }, mask: ['lastOp'], increments: { coins: g.coins || 0 } },
      { set: `claims/${uid}/items/${key}`, data: {}, serverTime: ['at'], exists: false }
    ];
    if (items.length) writes.push({ set: `inventory/${uid}`, data: { items: Object.fromEntries(items.map((i) => [i, true])) }, mask: items.map((i) => `items.\`${i}\``) });
    await db.commit(writes);
    have[key] = now();
    await activity('gift', `Hediye kodu kullandı`, g.coins || 0, 0).catch(() => {});
    await refreshMe();
    return { coins: g.coins || 0, items: g.items || [], summary: summary() };
  }

  // ------------------------------------------------------------ beta anahtarları
  async function addBetaKey(key) {
    const uid = me(); if (!uid) throw new Error('Giriş yapmalısın.');
    key = String(key || '').trim().toUpperCase();
    const k = await db.get(`betaKeys/${key}`).catch(() => null);
    if (!k || k.active === false) throw new Error('Bu beta anahtarı geçersiz.');
    const list = [...new Set([...((cache.privates && cache.privates.betaKeys) || []), key])];
    cache.privates = { ...(cache.privates || {}), betaKeys: list };
    await db.patch(`privates/${uid}`, { betaKeys: list });
    return betaInfo();
  }
  async function betaInfo() {
    const keys = (cache.privates && cache.privates.betaKeys) || [];
    const all = await presets();
    const out = [];
    for (const key of keys) {
      const k = await db.get(`betaKeys/${key}`).catch(() => null);
      if (!k) continue;
      out.push({ key, label: k.label || key, presets: (k.presets || []).map((id) => ({ id, ...(all[id] || {}) })).filter((p) => p.name) });
    }
    return out;
  }


  // ------------------------------------------------------------ süreli eşyalar (görev ödülü pelerinler)
  let timedCache = {};
  async function loadTimed() {
    const uid = me(); if (!uid) return;
    try { const l = await db.list(`timed/${uid}/items`, { pageSize: 60 }); timedCache = Object.fromEntries(l.map((d) => [d.id, d.until || 0])); } catch {}
  }
  const timedLive = () => {
    const t = Object.fromEntries(Object.entries(timedCache).filter(([, u]) => u > now()));
    for (const [k, u] of Object.entries(giveLive())) if (u > 0 && !(t[k] > u)) t[k] = u;   // herkese süreli verilenler de geri sayımla görünür
    return t;
  };
  const myInv = () => ({ ...withFree(cache.inventory && cache.inventory.items), ...Object.fromEntries(Object.keys(giveLive()).map((k) => [k, true])), ...Object.fromEntries(Object.keys(timedLive()).map((k) => [k, true])) });

  // ------------------------------------------------------------ haberler
  const news = async () => {
    const l = await db.list('news', { pageSize: 60 }, false).catch(() => []);
    return l.filter((n) => n.active !== false).sort((a, b) => (b.at || 0) - (a.at || 0));
  };
  async function adminNewsList() { needAdmin(); return (await db.list('news', { pageSize: 100 })).sort((a, b) => (b.at || 0) - (a.at || 0)); }
  async function adminNewsSave(n) {
    needAdmin();
    const id = /^[a-f0-9]{8,20}$/.test(n.id || '') ? n.id : crypto.randomBytes(6).toString('hex');
    const data = { tag: String(n.tag || 'Duyuru').slice(0, 24), title: String(n.title || '').slice(0, 120), text: String(n.text || '').slice(0, 4000),
      image: String(n.image || '').slice(0, 300000), active: n.active !== false, at: Number(n.at) || now() };
    if (!data.title) throw new Error('Haberin başlığı olmalı.');
    await db.set(`news/${id}`, data);
    return id;
  }
  async function adminNewsDelete(id) { needAdmin(); await db.del(`news/${String(id).replace(/[^a-z0-9]/gi, '')}`); return true; }

  // ------------------------------------------------------------ görevler ve seviye ağacı
  const levelCoins = (n) => (n % 5 === 0 ? 50 : 10);
  const TIERS = [['Bronz', 1], ['Gümüş', 10], ['Altın', 25], ['Platin', 50], ['Elmas', 100], ['Usta', 150], ['Efsane', 200]];
  const quests = async () => ((await remote('quests', { events: {} }, 5 * 60 * 1000)) || { events: {} });
  const eventLive = (e) => e && e.active !== false && (!e.startsAt || now() >= e.startsAt) && (!e.endsAt || now() < e.endsAt);
  async function questBump(stat, n = 1, absolute = false) {
    if (!me() || !cache.privates) return;
    const [cfg, gws] = await Promise.all([quests().catch(() => null), giveaways().catch(() => [])]);
    const qp = cache.privates.qp = cache.privates.qp || {};
    const gp = cache.privates.gp = cache.privates.gp || {};
    const upd = (o) => { const prev = o[stat] || 0, next = absolute ? Math.max(prev, n) : prev + n; if (next === prev) return null; o[stat] = next; return [prev, next]; };
    let changed = false, gwChanged = false, crossed = false;
    for (const [eid, e] of Object.entries((cfg && cfg.events) || {})) {
      const steps = Object.values(e.steps || {}).filter((s) => s.stat === stat);
      if (!eventLive(e) || !steps.length) continue;
      const r = upd(qp[eid] = qp[eid] || {});
      if (r) { changed = true; if (steps.some((st) => r[0] < (Number(st.goal) || 1) && r[1] >= (Number(st.goal) || 1))) crossed = true; }
    }
    // çekiliş koşulları: ilerleme çekiliş açıkken sayılır; bir koşul bitince launcher'da ve oyunda bildirim çıkar
    for (const g of gws) {
      if (!gwOpen(g)) continue;
      const conds = gwConds(g).filter((c) => c.stat === stat);
      if (!conds.length) continue;
      const o = gp[g.id] = gp[g.id] || {};
      const wasReady = gwReady(g, gp);
      const r = upd(o);
      if (!r) continue;
      gwChanged = true;
      for (const c of conds) if (r[0] < c.goal && r[1] >= c.goal) { crossed = true; gwToast('GÖREV TAMAMLANDI', c.title || STAT_TITLE(c.stat, c.goal)); }
      if (!wasReady && gwReady(g, gp)) setTimeout(() => gwToast('ÇEKİLİŞE KATILABİLİRSİN', `${g.title}: Görevler sayfasından katıl`, 'gwReady'), 1200);
    }
    if (!changed && !gwChanged) return;
    privSave({ qp, gp }, crossed);
    if (changed) send('social:quest', {});
    if (gwChanged) send('social:giveaways', {});
  }
  async function claimDocs(keys) {
    const uid = me();
    if (!keys.length) return {};
    const docs = await db.batchGet(keys.map((k) => `claims/${uid}/items/${k}`)).catch(() => []);
    return Object.fromEntries(docs.map((d) => [d.id, d.at || 1]));
  }
  async function questView() {
    const uid = me(); if (!uid) throw new Error('Görevler için giriş yapmalısın.');
    const cfg = await quests();
    const items = await shop().catch(() => ({}));
    const qp = (cache.privates && cache.privates.qp) || {};
    const evs = Object.entries(cfg.events || {}).filter(([, e]) => eventLive(e)).sort((a, b) => (a[1].order || 99) - (b[1].order || 99));
    const keys = [];
    for (const [eid, e] of evs) { keys.push(`qrw:${eid}`); for (const sid of Object.keys(e.steps || {})) keys.push(`qst:${eid}_${sid}`); }
    const have = await claimDocs(keys);
    const events = evs.map(([eid, e]) => {
      const steps = Object.entries(e.steps || {}).sort((a, b) => (a[1].order || 99) - (b[1].order || 99)).map(([sid, s]) => {
        const progress = Math.min(s.goal || 1, ((qp[eid] || {})[s.stat]) || 0);
        return { id: sid, title: s.title, desc: s.desc || '', goal: s.goal || 1, coins: s.coins || 0, lp: s.lp || 0, progress, claimed: !!have[`qst:${eid}_${sid}`], ready: progress >= (s.goal || 1) };
      });
      const it = e.rewardItem ? items[e.rewardItem] : null;
      return { id: eid, title: e.title, desc: e.desc || '', endsAt: e.endsAt || 0, steps, reward: e.rewardItem ? { item: e.rewardItem, days: e.rewardDays || 7, name: (it && it.name) || e.rewardItem, texture: (it && it.texture) || '', ref: (it && it.ref) || '', type: (it && it.type) || 'cape' } : null,
        rewardClaimed: !!have[`qrw:${eid}`], allClaimed: steps.length > 0 && steps.every((x) => x.claimed) };
    });
    return { events, level: await levelView(), serverNow: now() };
  }
  async function reward(kind, a) { send('social:reward', { kind, ...a }); }
  async function claimQuestStep(eid, sid) {
    await flushPriv();   // bekleyen ilerleme önce kaydedilsin
    const uid = me(); if (!uid) throw new Error('Giriş yapmalısın.');
    const cfg = await remote('quests', { events: {} }, 5 * 60 * 1000);
    const e = (cfg.events || {})[eid], s = e && (e.steps || {})[sid];
    if (!s || !eventLive(e)) throw new Error('Bu görev artık aktif değil.');
    const progress = ((((cache.privates && cache.privates.qp) || {})[eid]) || {})[s.stat] || 0;
    if (progress < (s.goal || 1)) throw new Error('Bu görev henüz tamamlanmadı.');
    const key = `qst:${eid}_${sid}`;
    const before = levelOf((cache.wallet && cache.wallet.lp) || 0);
    try {
      await db.commit([
        { set: `wallets/${uid}`, data: { lastOp: key }, mask: ['lastOp'], increments: { coins: s.coins || 0, lp: s.lp || 0 } },
        { set: `claims/${uid}/items/${key}`, data: {}, serverTime: ['at'], exists: false }
      ]);
    } catch (err) { throw new Error('Ödül alınamadı; zaten alınmış olabilir. Sayfayı yenile. (' + err.message + ')'); }
    // hızlı dönüş: cüzdanı yerelde güncelle, kalan işler arka planda
    if (cache.wallet) { cache.wallet.coins = (cache.wallet.coins || 0) + (s.coins || 0); cache.wallet.lp = (cache.wallet.lp || 0) + (s.lp || 0); }
    activity('achievement', `"${s.title}" görevini tamamladı`, s.coins || 0, s.lp || 0).catch(() => {});
    bumpStat('tasks', 1);
    send('social:reward', { kind: 'quest', title: s.title, coins: s.coins || 0, lp: s.lp || 0 });
    checkLevel(before);
    return { coins: s.coins || 0, lp: s.lp || 0 };
  }
  async function claimQuestReward(eid) {
    await flushPriv();   // bekleyen ilerleme önce kaydedilsin
    const uid = me(); if (!uid) throw new Error('Giriş yapmalısın.');
    const cfg = await remote('quests', { events: {} }, 5 * 60 * 1000);
    const e = (cfg.events || {})[eid];
    if (!e || !e.rewardItem) throw new Error('Bu görevin bir ödülü yok.');
    const sids = Object.keys(e.steps || {});
    const have = await claimDocs([`qrw:${eid}`, ...sids.map((x) => `qst:${eid}_${x}`)]);
    if (have[`qrw:${eid}`]) throw new Error('Ödülü zaten aldın.');
    if (!sids.length || !sids.every((x) => have[`qst:${eid}_${x}`])) throw new Error('Önce tüm adımları tamamlayıp ödüllerini almalısın.');
    const days = Math.max(1, Math.round(e.rewardDays || 7)), until = now() + days * DAY, key = `qrw:${eid}`;
    await db.commit([
      { set: `wallets/${uid}`, data: { lastOp: key }, mask: ['lastOp'], increments: { coins: 0, lp: 0 } },
      { set: `claims/${uid}/items/${key}`, data: {}, serverTime: ['at'], exists: false },
      { set: `timed/${uid}/items/${e.rewardItem}`, data: { until, event: eid }, serverTime: ['at'] }
    ]);
    timedCache[e.rewardItem] = until;
    activity('achievement', `"${e.title}" görev zincirini bitirip özel ödülü kazandı`).catch(() => {});
    shop().catch(() => ({})).then((items) => send('social:reward', { kind: 'questReward', title: e.title, item: (items[e.rewardItem] || {}).name || e.rewardItem, days }));
    return { until };
  }
  async function levelView() {
    const w = cache.wallet || { lp: 0 }, lvl = levelOf(w.lp || 0);
    const max = lvl + 14, keys = [];
    for (let n = 1; n <= lvl; n++) keys.push(`lvl:${n}`);
    const have = await claimDocs(keys.slice(Math.max(0, keys.length - 120)));
    const tier = [...TIERS].reverse().find(([, from]) => lvl >= from) || TIERS[0];
    const nextTier = TIERS.find(([, from]) => from > lvl) || null;
    const rows = [];
    for (let n = 1; n <= max; n++) rows.push({ n, coins: levelCoins(n), claimed: n <= lvl ? !!have[`lvl:${n}`] || n < keys.length - 119 : false, reachable: n <= lvl });
    return { level: lvl, lp: w.lp || 0, cur: lpFor(lvl), next: lpFor(lvl + 1), tier: tier[0], nextTier: nextTier ? { name: nextTier[0], left: nextTier[1] - lvl } : null, tiers: TIERS, rows };
  }
  async function claimLevel(n) {
    const uid = me(); if (!uid) throw new Error('Giriş yapmalısın.');
    n = Math.floor(Number(n));
    if (!cache.wallet) await refreshMe();
    const lvl = levelOf((cache.wallet && cache.wallet.lp) || 0);
    if (!(n >= 1 && n <= lvl)) throw new Error('Bu seviyeye henüz ulaşmadın.');
    const key = `lvl:${n}`;
    try {
      await db.commit([
        { set: `wallets/${uid}`, data: { lastOp: key }, mask: ['lastOp'], increments: { coins: levelCoins(n) } },
        { set: `claims/${uid}/items/${key}`, data: {}, serverTime: ['at'], exists: false }
      ]);
    } catch (err) { throw new Error('Ödül alınamadı; zaten alınmış olabilir. Sayfayı yenile. (' + err.message + ')'); }
    if (cache.wallet) cache.wallet.coins = (cache.wallet.coins || 0) + levelCoins(n);
    send('social:reward', { kind: 'hourly', coins: levelCoins(n), lp: 0 });
    return { coins: levelCoins(n), lp: 0 };
  }

  // ------------------------------------------------------------ ADMIN
  function needAdmin() { if (!isAdmin()) throw new Error('Bu işlem sadece admin hesabıyla yapılabilir.'); }
  async function adminGet(name) { needAdmin(); return db.get(`config/${name}`, false); }
  async function adminSet(name, value) {
    needAdmin();
    if (!/^(partners|shop|achievements|rewards|limits|presets|catalog|home|quests|branding|coinbuy)$/.test(name)) throw new Error('Bilinmeyen ayar.');
    if (name === 'shop' && value && typeof value === 'object') value = { ...value, seedFx: true };   // admin efekti silerse geri eklenmesin
    await db.set(`config/${name}`, value);
    cache.config = {};
    return true;
  }
  async function adminNotify({ title, text, level = 'info', to }) {
    needAdmin();
    const data = { title: String(title || '').slice(0, 100), text: String(text || '').slice(0, 1000), level };
    if (to) {
      await db.commit([{ set: `inbox/${to}/items/${crypto.randomBytes(8).toString('hex')}`, data: { ...data, read: false }, serverTime: ['at'], exists: false }]);
      signal(to, { type: 'notification', title: data.title }).catch(() => {});
    } else { await db.commit([{ set: `notifications/${crypto.randomBytes(8).toString('hex')}`, data, serverTime: ['at'], exists: false }]); notifGlobal.at = 0; }
    return true;
  }
  // hata bildirimleri (oyundaki "Hata Bildir")
  async function submitReport({ category, text, version }) {
    if (!me()) throw new Error('Önce giriş yapmalısın.');
    text = String(text || '').trim().slice(0, 1500);
    if (text.length < 5) throw new Error('Lütfen sorunu biraz daha ayrıntılı yaz.');
    const prof = cache.profile || {};
    await db.commit([{ set: `reports/${crypto.randomBytes(8).toString('hex')}`, data: { uid: me(), name: String(prof.displayName || '').slice(0, 24), category: String(category || 'Diğer').slice(0, 24), text, version: String(version || '').slice(0, 40), status: 'open' }, serverTime: ['at'], exists: false }]);
    return true;
  }
  async function adminReports() {
    needAdmin();
    const l = await db.list('reports', { pageSize: 100 });
    return l.sort((a, b) => (b.at || 0) - (a.at || 0));
  }
  async function adminDeleteReport(id) { needAdmin(); await db.del(`reports/${String(id).replace(/[^a-z0-9]/gi, '')}`); return true; }
  // ------------------------------------------------------------ Firebase -> Supabase taşıma (bir kez, admin)
  // Hesaplar eski kimlikleriyle taşındığı için (app_metadata.fbuid) tüm belgeler olduğu gibi kopyalanır.
  async function adminMigrate({ googleIdToken } = {}) {
    needAdmin();
    const lf = legacy();
    if (!lf) throw new Error('cloud.json içinde firebaseLegacy ayarı yok.');
    if (!googleIdToken) throw new Error('Önce eski Firebase hesabına Google ile bağlan.');
    await lf.signIn(googleIdToken);
    const fdb = lf.db;
    const TOP = ['config', 'news', 'notifications', 'giftCodes', 'betaKeys', 'users', 'emails', 'bannedEmails', 'usernames', 'handles', 'cosmetics',
      'profiles', 'giveaways', 'privates', 'wallets', 'inventory', 'friendRequests', 'friendships', 'chats', 'groups', 'reports'];
    const GROUPS = ['items', 'messages', 'entries'];
    let total = 0, buf = [], bytes = 0;
    const prog = (stage) => send('admin:migrate', { stage, total });
    const flush = async () => { if (!buf.length) return; await db.rpc('fs_import', { docs: buf }); buf = []; bytes = 0; prog('Yazılıyor'); };
    const push = async (d) => {
      const { id, path: p, _updated, ...data } = d; void id;
      if (!p || p.startsWith('bundle/')) return;
      if (p === 'config/app') { data.legacy = true; delete data.chunks; }   // sadece sürüm numarası taşınır (paket indirme adresi yok)
      const item = { path: p, data, updated: _updated || 0 };
      const sz = JSON.stringify(item).length;
      if (bytes && bytes + sz > 600000) await flush();
      buf.push(item); bytes += sz; total++;
    };
    for (const col of TOP) {
      let tok = '';
      do {
        prog(`Okunuyor: ${col}`);
        const j = await fdb.listPage(col, { pageSize: 300, pageToken: tok });
        for (const d of j.docs) await push(d);
        tok = j.next;
      } while (tok);
    }
    for (const g of GROUPS) {
      let after = '';
      for (;;) {
        prog(`Okunuyor: ${g}`);
        const docs = await fdb.queryGroup(g, { pageSize: 300, after });
        for (const d of docs) await push(d);
        if (docs.length < 300) break;
        after = docs[docs.length - 1].path;
      }
    }
    await flush();
    cache.config = {};
    log(`[taşıma] ${total} belge Supabase'e kopyalandı`);
    return { total };
  }
  async function adminDbStats() { needAdmin(); return { kind: 'supabase', legacy: !!legacy(), ...(await db.rpc('fs_stats')) }; }

  async function adminDeleteNotification(id) { needAdmin(); await db.del(`notifications/${id}`); notifGlobal.at = 0; return true; }
  async function adminUser(q) {
    needAdmin();
    q = String(q || '').trim().toLowerCase().replace(/^@/, '');
    const list = await searchUsers(q, true); // admin: kendisi ve yasaklılar da listelenir
    list.sort((a, b) => (b.self ? 1 : 0) - (a.self ? 1 : 0));
    const out = [];
    for (const u of list.slice(0, 20)) {
      const [w, inv, em] = await Promise.all([db.get(`wallets/${u.uid}`).catch(() => null), db.get(`inventory/${u.uid}`).catch(() => null), db.get(`emails/${u.uid}`, false).catch(() => null)]);
      out.push({ ...u, coins: (w && w.coins) || 0, lp: (w && w.lp) || 0, email: (em && em.email) || '', items: Object.keys((inv && inv.items) || {}).filter((k) => inv.items[k]) });
    }
    return out;
  }
  async function adminGrant(uid, { coins = 0, lp = 0, items = [], days = 0 }) {
    needAdmin();
    days = Math.max(0, Math.min(3650, Math.floor(Number(days) || 0)));
    if (days > 0 && items.length) {   // süreli: tek oyuncuya belirli gün
      for (const it of items) await db.set(`timed/${uid}/items/${it}`, { until: now() + days * 86400000, event: 'admin', at: now() });
      items = [];
    }
    const writes = [];
    if (coins || lp) writes.push({ set: `wallets/${uid}`, data: { lastOp: `admin:${now()}` }, mask: ['lastOp'], increments: { coins: Number(coins) || 0, lp: Number(lp) || 0 } });
    if (items.length) writes.push({ set: `inventory/${uid}`, data: { items: Object.fromEntries(items.map((i) => [i, true])) }, mask: items.map((i) => `items.\`${i}\``) });
    if (writes.length) await db.commit(writes);
    if (coins) await db.commit([{ set: `inbox/${uid}/items/${crypto.randomBytes(8).toString('hex')}`, data: { title: 'Hediye geldi!', text: `${coins} coin hesabına eklendi.`, level: 'success', read: false }, serverTime: ['at'], exists: false }]).catch(() => {});
    if (uid === me()) { await refreshMe(); send('social:me', summary()); } // kendine verdiysen hemen görünsün
    else signal(uid, { type: 'wallet' }).catch(() => {});
    return true;
  }
  // admin: oyuncudan coin / LP geri al (bakiyenin altına inmez; isteğe bağlı sebep oyuncuya bildirim olarak gider)
  async function adminTake(uid, { coins = 0, lp = 0, reason = '' }) {
    needAdmin();
    coins = Math.max(0, Math.floor(Number(coins) || 0)); lp = Math.max(0, Math.floor(Number(lp) || 0));
    if (!coins && !lp) throw new Error('Alınacak coin ya da LP gir.');
    const w = (await db.get(`wallets/${uid}`).catch(() => null)) || { coins: 0, lp: 0 };
    const c = Math.min(coins, Math.max(0, w.coins || 0)), l = Math.min(lp, Math.max(0, w.lp || 0));
    if (!c && !l) throw new Error('Oyuncunun bakiyesi zaten 0.');
    await db.commit([{ set: `wallets/${uid}`, data: { lastOp: `admin:${now()}` }, mask: ['lastOp'], increments: { coins: -c, lp: -l } }]);
    const why = String(reason || '').trim().slice(0, 140);
    const what = [c ? `${c} coin` : '', l ? `${l} LP` : ''].filter(Boolean).join(' ve ');
    await db.commit([{ set: `inbox/${uid}/items/${crypto.randomBytes(8).toString('hex')}`, data: { title: 'Bakiye düzenlendi', text: `Hesabından ${what} düşüldü.${why ? ' Sebep: ' + why : ''}`, level: 'warning', read: false }, serverTime: ['at'], exists: false }]).catch(() => {});
    if (uid === me()) { await refreshMe(); send('social:me', summary()); }
    else signal(uid, { type: 'wallet' }).catch(() => {});
    return { coins: c, lp: l };
  }
  async function adminRevoke(uid, item) {
    needAdmin();
    const inv = await db.get(`inventory/${uid}`);
    const items = { ...((inv && inv.items) || {}) }; delete items[item];
    await db.set(`inventory/${uid}`, { items });
    await db.del(`timed/${uid}/items/${item}`).catch(() => {});
    if (/^(cape|wings|pet)-/.test(item)) { // takılıysa oyunda da hemen kalksın: kozmetik kaydı oyuncunun launcher'ı tarafından temiz haliyle yeniden yazılır
      const p = await db.get(`profiles/${uid}`, false).catch(() => null);
      if (p && p.mcName) await db.del(`cosmetics/${String(p.mcName).toLowerCase()}`).catch(() => {});
    }
    signal(uid, { type: 'wallet' }).catch(() => {});
    return true;
  }
  async function adminSetRoles(uid, roles, plusDays) {
    needAdmin();
    roles = [...new Set((roles || []).filter((r) => ROLES.includes(r)))];
    const patch = { roles };
    if (!roles.includes('plus')) patch.plusUntil = 0;
    else if (plusDays > 0) patch.plusUntil = Date.now() + Math.min(3650, Math.floor(plusDays)) * 86400000;   // süreli
    else if (plusDays === 0) patch.plusUntil = 0;                                                         // kalıcı
    await db.patch(`profiles/${uid}`, patch);
    signal(uid, { type: 'wallet' }).catch(() => {});
    return true;
  }
  async function adminBan(uid, banned, reason) {
    needAdmin();
    if (uid === me()) throw new Error('Kendini yasaklayamazsın.');
    const p = await db.get(`profiles/${uid}`, false).catch(() => null);
    if (p && (p.roles || []).includes('founder')) throw new Error('Kurucu hesabı yasaklanamaz.');
    await db.patch(`profiles/${uid}`, { banned: !!banned, banReason: banned ? String(reason || '').slice(0, 120) : '' });
    const em = await db.get(`emails/${uid}`, false).catch(() => null);
    if (em && em.email) {
      if (banned) await db.set(`bannedEmails/${banKey(em.email)}`, { email: em.email, uid, reason: String(reason || '').slice(0, 120), at: now() });
      else await db.del(`bannedEmails/${banKey(em.email)}`).catch(() => {});
    }
    return { email: (em && em.email) || '' };
  }
  async function adminBannedEmails() { needAdmin(); return (await db.list('bannedEmails', { pageSize: 200 })).sort((a, b) => (b.at || 0) - (a.at || 0)); }
  async function adminBanEmail(email, reason) {
    needAdmin();
    email = String(email || '').trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('Geçerli bir e-posta yaz.');
    if (email === ADMIN_EMAIL) throw new Error('Kurucu e-postası yasaklanamaz.');
    await db.set(`bannedEmails/${banKey(email)}`, { email, reason: String(reason || '').slice(0, 120), at: now() });
    return true;
  }
  async function adminUnbanEmail(key) { needAdmin(); await db.del(`bannedEmails/${String(key).replace(/[^a-z0-9_]/g, '')}`); return true; }
  // oyuncunun tüm kaydını siler (hesap sıfırlanır; e-postası yasaklıysa tekrar giremez)
  async function adminDeleteUser(uid, alsoBan, reason) {
    needAdmin();
    if (!uid || uid === me()) throw new Error('Kendi hesabını silemezsin.');
    const p = await db.get(`profiles/${uid}`, false).catch(() => null);
    if (p && (p.roles || []).includes('founder')) throw new Error('Kurucu hesabı silinemez.');
    if (alsoBan) await adminBan(uid, true, reason || 'Hesap silindi');
    const dels = [];
    for (const sub of ['claims', 'timed', 'activity', 'inbox']) {
      const l = await db.list(`${sub}/${uid}/items`, { pageSize: 300 }).catch(() => []);
      for (const d of l) dels.push(`${sub}/${uid}/items/${d.id}`);
    }
    if (p && p.mcName) dels.push(`cosmetics/${String(p.mcName).toLowerCase()}`, `usernames/${String(p.mcName).toLowerCase()}`);
    if (p && p.handle) dels.push(`handles/${p.handle}`);
    dels.push(`wallets/${uid}`, `inventory/${uid}`, `privates/${uid}`, `users/${uid}`, `profiles/${uid}`);
    if (!alsoBan) dels.push(`emails/${uid}`);
    for (const path of dels) await db.del(path).catch((e) => log(`[admin] silinemedi ${path}: ${e.message}`));
    return { removed: dels.length };
  }
  async function adminCodes() { needAdmin(); return db.list('giftCodes', { pageSize: 200 }); }
  async function adminSaveCode(code, data) {
    needAdmin();
    code = String(code || '').trim().toUpperCase();
    if (!/^[A-Z0-9-]{4,40}$/.test(code)) throw new Error('Kod 4-40 karakter olmalı (harf, rakam, -).');
    await db.set(`giftCodes/${code}`, { coins: Number(data.coins) || 0, items: data.items || [], active: data.active !== false, label: data.label || '' });
    return true;
  }
  async function adminDeleteCode(code) { needAdmin(); await db.del(`giftCodes/${code}`); return true; }
  async function adminBetaKeys() { needAdmin(); return db.list('betaKeys', { pageSize: 200 }); }
  async function adminSaveBetaKey(key, data) {
    needAdmin();
    key = String(key || '').trim().toUpperCase();
    if (!/^[A-Z0-9-]{4,40}$/.test(key)) throw new Error('Anahtar 4-40 karakter olmalı (harf, rakam, -).');
    await db.set(`betaKeys/${key}`, { label: data.label || key, presets: data.presets || [], active: data.active !== false });
    return true;
  }
  async function adminDeleteBetaKey(key) { needAdmin(); await db.del(`betaKeys/${key}`); return true; }

  // güncelleme yayınla: klasördeki launcher kodunu paketler, gizli anahtarla imzalar
  // Güncelleme yayınla: paket imzalanır, GitHub Releases'a ("app-bundle" sürümü) yüklenir, sürüm bilgisi Supabase config/app'e yazılır.
  // legacyGoogleToken verilirse paket ayrıca eski (Firebase'li) launcher'lara da gönderilir (geçiş için, bir kez).
  const GH_REPO = 'Cubixora/Launcher', GH_TAG = 'app-bundle';
  async function ghCall(token, method, url, body, headers = {}) {
    const r = await fetch(url.startsWith('http') ? url : `https://api.github.com${url}`, {
      method, body, headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'Cubixora-Launcher', ...headers }
    });
    if (r.status === 404 && method === 'GET') return null;
    const j = r.status === 204 ? {} : await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(r.status === 401 ? 'GitHub anahtarı geçersiz ya da süresi dolmuş.' : r.status === 403 ? 'GitHub anahtarının bu depoya yazma izni yok (Contents: Read and write).' : `GitHub hatası: ${j.message || r.status}`);
    return j;
  }
  async function adminPublish({ dir, keyFile, notes, ghToken, legacyGoogleToken }) {
    needAdmin();
    const { createZip, collect } = require('./ziputil');
    if (!fs.existsSync(path.join(dir, 'main.js')) || !fs.existsSync(path.join(dir, 'renderer'))) throw new Error('Seçilen klasör launcher\'ın "src" klasörü değil.');
    const keyPem = fs.readFileSync(keyFile, 'utf8');
    const c = getConfig();
    const token = String(ghToken || '').trim() || (c.adminPublish && c.adminPublish.gh ? unprotect(c.adminPublish.gh) : '');
    if (!token) throw new Error('GitHub anahtarını yaz (bir kez yazman yeterli, sonra hatırlanır).');
    let lf = null;
    if (legacyGoogleToken) { lf = legacy(); if (!lf) throw new Error('cloud.json içinde firebaseLegacy ayarı yok.'); await lf.signIn(legacyGoogleToken); }
    const cur = await db.get('config/app', false);
    const old = lf ? await lf.db.get('config/app', false).catch(() => null) : null;
    const build = Math.max((cur && cur.build) || 0, (old && old.build) || 0, (global.__cubixora && global.__cubixora.build) || 0) + 1;
    const files = collect(dir, dir, (rel) => /(^|\/)(node_modules|\.git)(\/|$)/.test(rel) || /\.key$/i.test(rel));
    const bj = files.find((f) => f.name === 'build.json');
    const bjData = Buffer.from(JSON.stringify({ build }, null, 2));
    if (bj) bj.data = bjData; else files.push({ name: 'build.json', data: bjData });
    const zip = createZip(files);
    const sha = crypto.createHash('sha256').update(zip).digest('hex');
    const sig = crypto.sign(null, Buffer.from(`cubixora:${build}:${sha}`), keyPem).toString('base64');
    if (global.__cubixora && !global.__cubixora.verify(build, sha, sig)) throw new Error('Bu anahtar, launcher\'daki kilitle eşleşmiyor (yanlış anahtar dosyası).');
    // 1) GitHub: paket dosyası
    send('admin:publish', { stage: 'GitHub\'a yükleniyor', current: 0, total: 1 });
    let rel = await ghCall(token, 'GET', `/repos/${GH_REPO}/releases/tags/${GH_TAG}`);
    if (!rel) rel = await ghCall(token, 'POST', `/repos/${GH_REPO}/releases`, JSON.stringify({ tag_name: GH_TAG, target_commitish: 'main', name: 'Launcher güncelleme paketleri',
      body: 'Launcher\'ın otomatik güncelleme paketleri (launcher kendisi indirir). Kurulum için en son sürümdeki Cubixora-Launcher.exe dosyasını indirin.', prerelease: true }), { 'Content-Type': 'application/json' });
    const name = `cubixora-b${build}.zip`;
    for (const a of rel.assets || []) if (a.name === name) await ghCall(token, 'DELETE', `/repos/${GH_REPO}/releases/assets/${a.id}`);
    const up = await ghCall(token, 'POST', `https://uploads.github.com/repos/${GH_REPO}/releases/${rel.id}/assets?name=${encodeURIComponent(name)}`, zip, { 'Content-Type': 'application/zip' });
    const url = up.browser_download_url || `https://github.com/${GH_REPO}/releases/download/${GH_TAG}/${name}`;
    send('admin:publish', { stage: 'GitHub\'a yüklendi', current: 1, total: 1 });
    // 2) Supabase: sürüm bilgisi (launcher'lar bunu görüp paketi indirir)
    await db.set('config/app', { build, sha256: sha, sig, size: zip.length, url, notes: String(notes || '').slice(0, 500), at: db.ts(now()) });
    // eski paketleri temizle (son 2 kalır)
    for (const a of rel.assets || []) {
      const b = Number((/^cubixora-b(\d+)\.zip$/.exec(a.name) || [])[1] || 0);
      if (b && b < build - 1) await ghCall(token, 'DELETE', `/repos/${GH_REPO}/releases/assets/${a.id}`).catch(() => {});
    }
    // 3) GEÇİCİ: eski (Firebase'li) launcher'lara da gönder
    if (lf) {
      const b64 = zip.toString('base64'), CH = 900000, chunks = Math.ceil(b64.length / CH);
      for (let i = 0; i < chunks; i++) {
        await lf.db.set(`bundle/b${build}-${i}`, { data: b64.slice(i * CH, (i + 1) * CH) });
        send('admin:publish', { stage: 'Eski sürümlere gönderiliyor', current: i + 1, total: chunks });
      }
      await lf.db.set('config/app', { build, chunks, sha256: sha, sig, size: zip.length, notes: String(notes || '').slice(0, 500), at: lf.db.ts(now()) });
      if (old && old.build && old.chunks) for (let i = 0; i < old.chunks + 2; i++) lf.db.del(`bundle/b${old.build}-${i}`).catch(() => {});
    }
    c.adminPublish = { ...(c.adminPublish || {}), dir, keyFile, gh: protect(token) }; saveConfig();
    return { build, size: zip.length, files: files.length, legacy: !!lf };
  }

  // ------------------------------------------------------------ yaşam döngüsü
  let hourTimer = null, beatTimer = null;

  // ------------------------------------------------------------ çekilişler
  // giveaways/{id}: admin oluşturur (koşullar, ödül, açıklanma zamanı). Katılım: giveaways/{id}/entries/{uid}.
  // Kura admin'in launcher'ında yapılır (açıklanma zamanı gelince otomatik ya da "Şimdi çek" ile); açıklandıktan 1 gün sonra silinir.
  const GW_KEEP = DAY;
  const STAT_NAMES = {
    launcher_minutes: (g) => `Launcher'da ${fmtMin(g)} geçir`, partner_minutes: (g) => `Partner sunucularda ${fmtMin(g)} oyna`,
    minutes: (g) => `Oyunda ${fmtMin(g)} oyna`, launch: (g) => (g > 1 ? `Launcher'ı ${g} kez aç` : "Launcher'ı aç"),
    game: (g) => (g > 1 ? `Oyunu ${g} kez başlat` : 'Oyunu Cubixora ile başlat'), partner: (g) => (g > 1 ? `Partner sunuculara ${g} kez katıl` : 'Bir partner sunucuya katıl'),
    friends: (g) => `${g} arkadaşa ulaş`, messages: (g) => `${g} mesaj gönder`, level: (g) => `Seviye ${g}'e ulaş`, buy: (g) => `Mağazadan ${g} ürün al`,
    mod: (g) => `${g} mod indir`, call: (g) => `${g} sesli arama yap`
  };
  function fmtMin(m) { m = Math.round(m); if (m < 60) return `${m} dakika`; const h = Math.floor(m / 60), r = m % 60; return r ? `${h} saat ${r} dakika` : `${h} saat`; }
  const STAT_TITLE = (stat, goal) => (STAT_NAMES[stat] ? STAT_NAMES[stat](goal) : `${stat}: ${goal}`);
  let gwCache = { at: 0, list: [] }, gwInflight = null;
  async function giveaways(force, maxAge = 60 * 1000) {
    if (!force && gwCache.at && now() - gwCache.at < maxAge) return gwCache.list;
    if (gwInflight) return gwInflight;   // aynı anda gelen istekler tek sorguda birleşir
    gwInflight = db.query('giveaways').then((list) => { gwCache = { at: now(), list }; return list; })
      .catch((e) => { if (!gwCache.at) throw e; return gwCache.list; })
      .finally(() => { gwInflight = null; });
    return gwInflight;
  }
  const gwOpen = (g) => g && g.status !== 'drawn' && (!g.startsAt || now() >= g.startsAt) && now() < (g.drawAt || 0);
  const gwVisible = (g) => g && !(g.drawnAt && now() > g.drawnAt + GW_KEEP);
  const gwConds = (g) => Object.entries(g.conds || {}).sort((a, b) => (a[1].order || 99) - (b[1].order || 99))
    .map(([id, c]) => ({ id, stat: String(c.stat || 'launch'), goal: Math.max(1, Number(c.goal) || 1), title: String(c.title || '') }));
  const gwProg = (g, gp, c) => Math.min(c.goal, (((gp || {})[g.id] || {})[c.stat]) || 0);
  const gwReady = (g, gp) => gwConds(g).every((c) => gwProg(g, gp, c) >= c.goal);
  function gwToast(title, sub, kind = 'gwTask') {
    send('social:reward', { kind, title: sub, head: title });
    if (ctx.modToast) ctx.modToast(title, sub);
  }
  const myName = () => String((cache.profile && (cache.profile.displayName || cache.profile.handle)) || (acct() && acct().name) || 'Oyuncu').slice(0, 24);

  async function giveawayView() {
    const uid = me(); if (!uid) throw new Error('Çekilişler için giriş yapmalısın.');
    const list = (await giveaways()).filter(gwVisible);
    const gp = (cache.privates && cache.privates.gp) || {};
    const mine = await db.batchGet(list.map((g) => `giveaways/${g.id}/entries/${uid}`)).catch(() => []);
    const joined = new Set(mine.map((d) => String(d.path || '').split('/')[1]));
    const out = list.map((g) => {
      const conds = gwConds(g).map((c) => ({ title: c.title || STAT_TITLE(c.stat, c.goal), goal: c.goal, progress: gwProg(g, gp, c), stat: c.stat }));
      const winners = Array.isArray(g.winners) ? g.winners : [];
      return {
        id: g.id, title: g.title || 'Çekiliş', desc: g.desc || '', prize: g.prize || '', image: g.image || '', drawAt: g.drawAt || 0, startsAt: g.startsAt || 0,
        winnerCount: g.winnerCount || 1, entries: g.entries || 0, status: g.status === 'drawn' ? 'drawn' : gwOpen(g) ? 'open' : now() >= (g.drawAt || 0) ? 'pending' : 'soon',
        drawnAt: g.drawnAt || 0, deleteAt: g.drawnAt ? g.drawnAt + GW_KEEP : 0, conds, ready: conds.every((c) => c.progress >= c.goal), joined: joined.has(g.id),
        winners: winners.map((w) => String(w.name || 'Oyuncu')), won: winners.some((w) => w.uid === uid)
      };
    });
    const rank = (g) => (g.status === 'open' ? 0 : g.status === 'pending' ? 1 : g.status === 'soon' ? 2 : 3);
    out.sort((a, b) => rank(a) - rank(b) || a.drawAt - b.drawAt);
    return { list: out, serverNow: now() };
  }
  async function joinGiveaway(gid) {
    await flushPriv();   // bekleyen ilerleme önce kaydedilsin
    const uid = me(); if (!uid) throw new Error('Çekilişe katılmak için giriş yapmalısın.');
    const g = (await giveaways(true)).find((x) => x.id === gid);
    if (!g || !gwVisible(g)) throw new Error('Bu çekiliş artık yok.');
    if (!gwOpen(g)) throw new Error(g.status === 'drawn' ? 'Bu çekiliş sonuçlandı.' : 'Bu çekilişe katılım kapandı.');
    if (!gwReady(g, (cache.privates && cache.privates.gp) || {})) throw new Error('Önce çekilişin görevlerini tamamlamalısın.');
    try {
      await db.commit([
        { set: `giveaways/${gid}/entries/${uid}`, data: { uid, name: myName() }, serverTime: ['at'], exists: false },
        { set: `giveaways/${gid}`, data: {}, mask: [], exists: true, increments: { entries: 1 } }
      ]);
    } catch (e) {
      if (/ALREADY_EXISTS|already exists/i.test(e.message)) return { ok: true, already: true };
      throw new Error('Katılınamadı: ' + e.message);
    }
    g.entries = (g.entries || 0) + 1;
    gwSeen()[gid] = { joined: 1 }; saveConfig();
    return { ok: true };
  }
  const gwSeen = () => { const c = getConfig(); c.social = c.social || {}; return (c.social.gwSeen = c.social.gwSeen || {}); };

  // --- admin
  function cleanGiveaway(g) {
    const title = String(g.title || '').trim().slice(0, 80);
    if (!title) throw new Error('Çekilişe bir başlık yaz.');
    const drawAt = Math.round(Number(g.drawAt) || 0);
    if (!drawAt) throw new Error('Sonuçların açıklanacağı tarihi seç.');
    const conds = {};
    (Array.isArray(g.conds) ? g.conds : []).slice(0, 8).forEach((c, i) => {
      if (!STAT_NAMES[c.stat]) return;
      conds['c' + (i + 1)] = { stat: c.stat, goal: Math.max(1, Math.min(100000, Math.round(Number(c.goal) || 1))), title: String(c.title || '').trim().slice(0, 80), order: i + 1 };
    });
    const image = /^data:image\/(jpeg|png|webp);base64,/.test(String(g.image || '')) && String(g.image).length < 160000 ? g.image : '';
    return { title, desc: String(g.desc || '').trim().slice(0, 600), prize: String(g.prize || '').trim().slice(0, 120), image, drawAt,
      startsAt: Math.round(Number(g.startsAt) || 0), winnerCount: Math.max(1, Math.min(50, Math.round(Number(g.winnerCount) || 1))), conds };
  }
  async function adminGiveaways() { needAdmin(); return (await giveaways(true)).map((g) => ({ ...g, conds: gwConds(g) })).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)); }
  async function adminGiveawaySave(g) {
    needAdmin();
    const data = cleanGiveaway(g || {});
    if (g && g.id) {
      const cur = (await giveaways(true)).find((x) => x.id === g.id);
      if (!cur) throw new Error('Çekiliş bulunamadı.');
      if (cur.status === 'drawn') throw new Error('Sonuçlanan çekiliş düzenlenemez.');
      await db.patch(`giveaways/${g.id}`, data);
    } else {
      if (data.drawAt <= now() + 60 * 1000) throw new Error('Açıklanma zamanı ileri bir tarih olmalı.');
      await db.commit([{ set: `giveaways/g${crypto.randomBytes(6).toString('hex')}`, data: { ...data, status: 'open', entries: 0, winners: [], createdAt: now() }, exists: false }]);
    }
    gwCache.at = 0;
    return adminGiveaways();
  }
  async function gwEntries(gid) {
    const out = [];
    let pageToken = '';
    do {   // sayfa sayfa: kalabalık çekilişlerde de hepsi gelir
      const j = await db.listPage(`giveaways/${gid}/entries`, { pageSize: 300, pageToken });
      out.push(...j.docs); pageToken = j.next || '';
    } while (pageToken && out.length < 20000);
    return out;
  }
  async function adminGiveawayEntries(gid) {
    needAdmin();
    const list = await gwEntries(gid);
    const emails = await db.batchGet(list.map((e) => `emails/${e.id}`)).catch(() => []);
    const em = Object.fromEntries(emails.map((d) => [d.id, d.email || '']));
    return list.map((e) => ({ uid: e.id, name: e.name || '', email: em[e.id] || '', at: e.at || e._updated }))
      .sort((a, b) => a.at - b.at);
  }
  async function adminGiveawayDraw(gid) {
    needAdmin();
    const g = (await giveaways(true)).find((x) => x.id === gid);
    if (!g) throw new Error('Çekiliş bulunamadı.');
    if (g.status === 'drawn') throw new Error('Bu çekiliş zaten sonuçlandı.');
    const pool = await gwEntries(gid);
    const k = Math.min(pool.length, g.winnerCount || 1);
    for (let i = pool.length - 1; i > 0; i--) { const j = crypto.randomInt(i + 1); [pool[i], pool[j]] = [pool[j], pool[i]]; }   // adil karıştırma
    const winners = pool.slice(0, k).map((e) => ({ uid: e.id, name: String(e.name || 'Oyuncu').slice(0, 24) }));
    await db.patch(`giveaways/${gid}`, { status: 'drawn', winners, drawnAt: now() });
    for (const w of winners) adminNotify({ to: w.uid, title: '🎉 Çekilişi kazandın!', text: `"${g.title}" çekilişini kazandın${g.prize ? `: ${g.prize}` : ''}. Ayrıntılar Görevler > Çekilişler'de.`, level: 'success' }).catch(() => {});
    gwCache.at = 0;
    return { winners };
  }
  async function adminGiveawayDelete(gid) {
    needAdmin();
    const ents = await gwEntries(gid).catch(() => []);
    for (let i = 0; i < ents.length; i += 400) await db.commit(ents.slice(i, i + 400).map((e) => ({ delete: `giveaways/${gid}/entries/${e.id}` })));
    await db.del(`giveaways/${gid}`);
    gwCache.list = gwCache.list.filter((x) => x.id !== gid);
    return true;
  }
  // her dakika: sonuçlanan çekilişleri oyuncuya bildirir; admin ise zamanı gelen kurayı çeker ve süresi dolanı siler
  let gwBusy = false;
  async function gwTick() {
    if (!me() || gwBusy) return;
    gwBusy = true;
    try {
      const before = JSON.stringify(gwCache.list.map((g) => [g.id, g.status, g.entries]));
      // okuma kotası: normal oyuncu 10 dk'da bir, admin 2 dk'da bir; kura saati geçmiş çekiliş varsa 2 dk'da bir bakılır
      const due = gwCache.list.some((g) => g.status !== 'drawn' && g.drawAt && now() >= g.drawAt);
      const list = await giveaways(false, isAdmin() || due ? 2 * 60 * 1000 : 10 * 60 * 1000);
      if (isAdmin()) {
        for (const g of list) {
          if (g.status !== 'drawn' && g.drawAt && now() >= g.drawAt) await adminGiveawayDraw(g.id).catch((e) => log(`[çekiliş] kura: ${e.message}`));
          else if (g.drawnAt && now() > g.drawnAt + GW_KEEP) await adminGiveawayDelete(g.id).catch((e) => log(`[çekiliş] silme: ${e.message}`));
        }
      }
      const seen = gwSeen(); let dirty = false;
      for (const g of list) {
        const s = seen[g.id];
        if (!s || !s.joined || s.result || g.status !== 'drawn') continue;
        const won = (g.winners || []).some((w) => w.uid === me());
        s.result = won ? 'won' : 'lost'; dirty = true;
        if (won) gwToast('ÇEKİLİŞİ KAZANDIN! 🎉', g.prize ? `${g.title}: ${g.prize}` : g.title, 'gwWon');
        else send('social:reward', { kind: 'gwLost', title: g.title, head: 'ÇEKİLİŞ AÇIKLANDI' });
      }
      for (const id of Object.keys(seen)) if (!list.some((g) => g.id === id)) { delete seen[id]; dirty = true; }
      if (dirty) saveConfig();
      if (JSON.stringify(gwCache.list.map((g) => [g.id, g.status, g.entries])) !== before) send('social:giveaways', {});
    } catch (e) { log(`[çekiliş] ${e.message}`); }
    finally { gwBusy = false; }
  }
  // Launcher'da geçen süre (çekiliş/görev koşulu): pencere açık olsun olmasın, launcher çalıştıkça dakikada 1
  let minuteTimer = null;
  function minuteTick() { questBump('launcher_minutes', 1); }

  async function start() {
    if (!me()) return null;
    await checkBan();
    const c = getConfig();
    myStatus = (c.social && c.social.status) || 'online';
    const s = await ensureAccount();
    listen();
    beat();
    clearInterval(beatTimer); beatTimer = setInterval(beat, BEAT_MS);
    listenPresence();
    clearInterval(sweepTimer); sweepTimer = setInterval(sweep, 20 * 1000);
    clearInterval(hourTimer); hourTimer = setInterval(hourly, 5 * 60 * 1000);
    clearInterval(minuteTimer); minuteTimer = setInterval(() => { minuteTick(); gwTick(); }, 60 * 1000);
    setTimeout(hourly, 20000);
    setTimeout(gwTick, 8000);
    claimAchievement('first_launch').catch(() => {});
    questBump('launch', 1);
    friends().catch(() => {});
    return s;
  }
  function stop() {
    if (stopListen) stopListen(); stopListen = null;
    if (stopPresence) stopPresence(); stopPresence = null;
    clearInterval(beatTimer); clearInterval(hourTimer); clearInterval(sweepTimer); clearInterval(minuteTimer);
    const flushed = flushPriv();
    const uid = me();
    const off = uid ? db.rtSet(`presence/${uid}`, { s: 'offline', t: { '.sv': 'timestamp' }, g: '' }).catch(() => {}) : Promise.resolve();
    cache.profile = cache.wallet = cache.inventory = cache.privates = null; claimed = null;
    friendCache = { list: [], incoming: [], outgoing: [], at: 0 };
    return Promise.all([off, flushed]);
  }

  return {
    remote, start, stop, isAdmin, summary, refreshMe, updateProfile, getProfile, uidOf, setStatus, setGame, signal,
    friends, searchUsers, sendRequest, acceptRequest, declineRequest, removeFriend,
    conversations, messages, openDm, sendMessage, deleteMessage, createGroup, groupAction, markRead,
    notifications, markNotificationsSeen, activityOf, achievementView, claimAchievement, track,
    shop, buy, redeem, partners, limits, coinBuy, adminTake, achievements, addBetaKey, betaInfo, presets,
    submitReport, adminMigrate, adminDbStats, adminReports, adminDeleteReport, adminGet, adminSet, adminNotify, adminDeleteNotification, adminUser, adminGrant, adminRevoke, adminBan, adminBannedEmails, adminBanEmail, adminUnbanEmail, adminDeleteUser, adminSetRoles, hasPlusPerk,
    adminCodes, adminSaveCode, adminDeleteCode, adminBetaKeys, adminSaveBetaKey, adminDeleteBetaKey, adminPublish,
    levelOf, lpFor, inventory: myInv, timedLive, timedAll: () => ({ ...timedCache }),
    news, adminNewsList, adminNewsSave, adminNewsDelete, questView, claimQuestStep, claimQuestReward, levelView, claimLevel, quests,
    giveawayView, joinGiveaway, adminGiveaways, adminGiveawaySave, adminGiveawayEntries, adminGiveawayDraw, adminGiveawayDelete, partnerMinute: () => questBump('partner_minutes', 1)
  };
};

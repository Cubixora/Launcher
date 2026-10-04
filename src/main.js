// Cubixora Launcher - ana süreç
const { app, BrowserWindow, ipcMain, shell, safeStorage, Tray, Menu, Notification, globalShortcut, dialog, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const crypto = require('crypto');
const http = require('http');
const { Client } = require('minecraft-launcher-core');
const { Auth } = require('msmc');

const UA = 'Cubixora-Launcher/1.0';
const PREVIEW = process.env.CX_PREVIEW_DIR || '';   // Admin > Test et: ayrı veri klasöründe açılmış önizleme
const DATA_DIR = PREVIEW || path.join(app.getPath('appData'), '.cubixora');
// Kurulu sürümün Başlat menüsü kısayolu 'com.cubixora.launcher' kimliğini kullanır; geliştirme modu onunla karışmasın (menü başlığı simgesi o kısayoldan gelir)
// Not: EXE'yi 'Cubixora-xxx.exe' diye yeniden adlandırınca Electron kendini 'paketli' sanır; geliştirme modunu yoldan da anla
const IS_DEV = !app.isPackaged || /node_modules[\\/]electron[\\/]dist[\\/]/i.test(process.execPath);
const AUMID = IS_DEV ? 'com.cubixora.launcher.dev' : 'com.cubixora.launcher';
const MC_ROOT = path.join(DATA_DIR, 'minecraft');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
const RUNTIME_DIR = path.join(DATA_DIR, 'runtime');

const VERSION_MANIFEST = 'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json';
const JAVA_ALL = 'https://launchermeta.mojang.com/v1/products/java-runtime/2ec0cc96c44e5a76b9c8b7c39df7210883d12871/all.json';
const FABRIC_META = 'https://meta.fabricmc.net/v2';
const MODRINTH = 'https://api.modrinth.com/v2';

let win = null;
let gameRunning = false, gameChild = null, gameKilled = false;

// ---------------------------------------------------------------- config
const defaultConfig = () => ({
  account: null,
  selectedProfile: null,
  profiles: [],
  settings: {
    defaultRam: 4,
    minRam: 1,
    resolution: '',
    fullscreen: false,
    javaPath: '',
    closeOnLaunch: false,
    closeToTray: true,
    animations: true,
    showSnapshots: false,
    language: 'auto',
    notify: { friends: true, messages: true, calls: true, updates: true },
    sound: { micId: '', speakerId: '', micGain: 100, speakerVol: 100, noiseSuppression: true, echoCancellation: true, autoGain: false },
    sounds: { pet: 80, notification: 70, spray: 80, call: true, message: true, general: true, aura: 60, kill: 70, particle: 60 },
    capeWaving: true,
    presence: 'all',
    a11y: { fontScale: 100, bold: false, colorblind: 'off', contrast: false },
    autologin: [],
    usePremium: false
  }
});

function loadConfig() {
  try {
    const c = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    const d = defaultConfig();
    const st = { ...d.settings, ...(c.settings || {}) };
    for (const k of ['notify', 'sound', 'sounds', 'a11y']) st[k] = { ...d.settings[k], ...((c.settings || {})[k] || {}) };
    return { ...d, ...c, settings: st };
  } catch {
    return defaultConfig();
  }
}
let config = loadConfig();

function saveConfig() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

function protect(text) {
  if (safeStorage.isEncryptionAvailable()) return 'enc:' + safeStorage.encryptString(text).toString('base64');
  return 'raw:' + text;
}
function unprotect(text) {
  if (!text) return null;
  if (text.startsWith('enc:')) return safeStorage.decryptString(Buffer.from(text.slice(4), 'base64'));
  if (text.startsWith('raw:')) return text.slice(4);
  return text;
}

// ---------------------------------------------------------------- helpers
const _lastSend = {};
const send = (channel, payload) => {
  if (!win || win.isDestroyed()) return;
  // ilerleme olayları (indirme sırasında saniyede yüzlerce) arayüzü boğmasın: 10/sn
  if (channel === 'progress') {
    const n = Date.now(), last = _lastSend[channel] || 0;
    const final = payload && payload.total > 1 && payload.current >= payload.total;
    if (!final && n - last < 100) return;
    _lastSend[channel] = n;
  }
  win.webContents.send(channel, payload);
};
const log = (line) => send('log', String(line));

let launchAbort = null;   // "Durdur" düğmesi: hazırlık sırasında indirmeleri keser
const abortSig = () => (launchAbort ? launchAbort.signal : undefined);
const chk = () => { if (launchAbort && launchAbort.signal.aborted) throw new Error('Başlatma durduruldu.'); };
async function getJSON(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: abortSig() });
  if (!res.ok) throw new Error(`İstek başarısız (${res.status}): ${url}`);
  return res.json();
}

async function downloadFile(url, dest, sha1) {
  if (sha1 && fs.existsSync(dest)) {
    const hash = crypto.createHash('sha1').update(await fsp.readFile(dest)).digest('hex');
    if (hash === sha1) return;
  }
  await fsp.mkdir(path.dirname(dest), { recursive: true });
  const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: abortSig() });
  if (!res.ok) throw new Error(`İndirilemedi (${res.status}): ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await fsp.writeFile(dest, buf);
}

async function runPool(items, limit, worker) {
  let i = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      await worker(items[idx], idx);
    }
  });
  await Promise.all(runners);
}

const profileDir = (p) => path.join(MC_ROOT, 'profiles', p.id);
const findProfile = (id) => config.profiles.find((p) => p.id === id);

// ---------------------------------------------------------------- bulut (Firebase)
const cloud = require('./cloud')({
  DATA_DIR, UA, getConfig: () => config, saveConfig, protect, unprotect,
  log, send, profileDir, downloadFile
});

// oyun içi üst bildirimler (görev tamamlandı, çekiliş kazandın): mod 100 ms'de bir köprüye uğrar, kuyruktan birer birer alır
const modToasts = [];
const modToast = (t, s) => { if (gameRunning) { modToasts.push({ t: String(t || '').slice(0, 60), s: String(s || '').slice(0, 90) }); if (modToasts.length > 6) modToasts.shift(); } };
const social = require('./social')({ cloud, getConfig: () => config, saveConfig, send, log, protect, unprotect, DATA_DIR, app, modToast });
const discord = require('./discord')({ remote: (...a) => social.remote(...a), getSettings: () => config.settings, log });
const features = require('./features')({
  getJSON, downloadFile, profileDir, findProfile: (id) => findProfile(id), log, send, unprotect, UA,
  getConfig: () => config, rememberMod: (h, i) => cloud.rememberMod(h, i)
});
let socialReady = null;
function startSocial() {
  if (!cloud.isCloudAccount()) return null;
  socialReady = social.start().then((s) => { send('social:me', s); return s; })
    .catch((e) => {
      log(`[sosyal] başlatılamadı: ${e.message}`);
      if (e.banned) { try { social.stop(); } catch {} socialReady = null; cloud.forget(); config.account = null; saveConfig(); send('social:banned', e.message); return null; }
      send('social:error', e.message); return null;
    });
  return socialReady;
}

// Profiller hesaba bağlıdır: her hesap kendi profillerini görür.
// Etkin hesabın profilleri config.profiles içindedir, diğerleri config.profileSets'te bekler.
function accountKey(a) {
  if (!a) return null;
  if (a.cloud) return `fb:${a.id}`;
  if ((a.type || 'microsoft') === 'microsoft') return `ms:${a.uuid}`;
  return `${a.type}:${a.id}`;
}
function switchProfilesTo(key) {
  config.profileSets = config.profileSets || {};
  if (config.profilesOwner === key) return;
  if (config.profilesOwner) {
    config.profileSets[config.profilesOwner] = { profiles: config.profiles, selectedProfile: config.selectedProfile };
  }
  const set = config.profileSets[key];
  if (set) {
    config.profiles = set.profiles || [];
    config.selectedProfile = set.selectedProfile || null;
    delete config.profileSets[key];
  } else if (config.profilesOwner) {
    config.profiles = [];
    config.selectedProfile = null;
  } // sahibi olmayan (eski sürümden kalma) profiller ilk giriş yapan hesaba geçer
  config.profilesOwner = key;
}
async function activateAccount(acc) {
  switchProfilesTo(accountKey(acc));
  config.account = acc;
  if (acc.cloud) config.sync = { dirty: false };
  saveConfig();
  if (acc.cloud) await cloud.pull().ready;
  if (acc.cloud) startSocial();
  const out = publicAccount();
  if (acc.isNew) out.isNew = true;
  return out;
}

// ---------------------------------------------------------------- Minecraft versions
let manifestCache = null;
async function getManifest() {
  if (!manifestCache) manifestCache = await getJSON(VERSION_MANIFEST);
  return manifestCache;
}

async function getVersionJson(mcVersion) {
  const m = await getManifest();
  const v = m.versions.find((x) => x.id === mcVersion);
  if (!v) throw new Error(`Sürüm bulunamadı: ${mcVersion}`);
  return getJSON(v.url);
}

// ---------------------------------------------------------------- Java (Mojang runtime)
function javaPlatform() {
  const a = process.arch;
  if (process.platform === 'win32') return a === 'arm64' ? 'windows-arm64' : a === 'ia32' ? 'windows-x86' : 'windows-x64';
  if (process.platform === 'darwin') return a === 'arm64' ? 'mac-os-arm64' : 'mac-os';
  return a === 'ia32' ? 'linux-i386' : 'linux';
}

function javaExecutable(component) {
  const base = path.join(RUNTIME_DIR, component);
  if (process.platform === 'win32') return path.join(base, 'bin', 'javaw.exe');
  if (process.platform === 'darwin') return path.join(base, 'jre.bundle', 'Contents', 'Home', 'bin', 'java');
  return path.join(base, 'bin', 'java');
}

async function ensureJava(mcVersion) {
  if (config.settings.javaPath) return config.settings.javaPath;
  const vjson = await getVersionJson(mcVersion);
  const component = (vjson.javaVersion && vjson.javaVersion.component) || 'jre-legacy';
  const exe = javaExecutable(component);
  const marker = path.join(RUNTIME_DIR, component, '.cubixora-ok');
  if (fs.existsSync(exe) && fs.existsSync(marker)) return exe;

  send('progress', { stage: 'Java indiriliyor', current: 0, total: 1 });
  const all = await getJSON(JAVA_ALL);
  const entry = all[javaPlatform()] && all[javaPlatform()][component] && all[javaPlatform()][component][0];
  if (!entry) throw new Error(`Bu sistem için Java bulunamadı (${component}). Ayarlardan Java yolunu elle seçebilirsin.`);
  const manifest = await getJSON(entry.manifest.url);
  const base = path.join(RUNTIME_DIR, component);
  const files = Object.entries(manifest.files);

  for (const [rel, info] of files) {
    if (info.type === 'directory') await fsp.mkdir(path.join(base, rel), { recursive: true });
  }
  const toDownload = files.filter(([, info]) => info.type === 'file');
  let done = 0;
  await runPool(toDownload, 8, async ([rel, info]) => {
    const dest = path.join(base, rel);
    await downloadFile(info.downloads.raw.url, dest, info.downloads.raw.sha1);
    if (info.executable && process.platform !== 'win32') await fsp.chmod(dest, 0o755);
    done++;
    if (done % 10 === 0 || done === toDownload.length) {
      send('progress', { stage: 'Java indiriliyor', current: done, total: toDownload.length });
    }
  });
  if (process.platform !== 'win32') {
    for (const [rel, info] of files) {
      if (info.type === 'link') {
        const linkPath = path.join(base, rel);
        try { await fsp.unlink(linkPath); } catch {}
        try { await fsp.symlink(info.target, linkPath); } catch {}
      }
    }
  }
  await fsp.writeFile(marker, new Date().toISOString());
  return exe;
}

// ---------------------------------------------------------------- Fabric
async function fabricLoaders(mcVersion) {
  const list = await getJSON(`${FABRIC_META}/versions/loader/${encodeURIComponent(mcVersion)}`);
  return list.map((x) => ({ version: x.loader.version, stable: x.loader.stable }));
}

async function ensureFabric(mcVersion, loaderVersion) {
  if (!loaderVersion) {
    const loaders = await fabricLoaders(mcVersion);
    if (!loaders.length) throw new Error(`Fabric bu sürümü desteklemiyor: ${mcVersion}`);
    loaderVersion = (loaders.find((l) => l.stable) || loaders[0]).version;
  }
  const profile = await getJSON(`${FABRIC_META}/versions/loader/${encodeURIComponent(mcVersion)}/${encodeURIComponent(loaderVersion)}/profile/json`);
  const id = profile.id;
  const dir = path.join(MC_ROOT, 'versions', id);
  await fsp.mkdir(dir, { recursive: true });
  await fsp.writeFile(path.join(dir, `${id}.json`), JSON.stringify(profile, null, 2));
  return id;
}

// ---------------------------------------------------------------- Offline auth
// CmlLib.Core.Commons MSession.CreateOfflineSession(username) mantığının JS karşılığı (MIT):
//   Username = username, AccessToken = "access_token",
//   UUID = Guid.NewGuid() (tiresiz), UserType = "msa", ClientToken = null
// Fark: UUID her açılışta yeniden üretilmez, hesap başına bir kez üretilip saklanır;
// böylece dünyalardaki envanter/ilerleme kaybolmaz. Microsoft dışındaki tüm hesaplar
// (Cubixora, Google) oyuna bu offline oturumla girer.
const OFFLINE_NAME = /^[A-Za-z0-9_]{3,16}$/;

function createOfflineSession(username, uuid) {
  return {
    username,
    accessToken: 'access_token',
    uuid: uuid || crypto.randomUUID().replace(/-/g, ''),
    userType: 'msa',
    clientToken: null
  };
}

function offlineMclc(session) {
  return {
    access_token: session.accessToken,
    client_token: session.clientToken || session.uuid,
    uuid: session.uuid,
    name: session.username,
    user_properties: '{}',
    meta: { type: session.userType, demo: false }
  };
}

// ---------------------------------------------------------------- Cubixora hesapları (yerel)
// Hesaplar bu bilgisayarda %APPDATA%\.cubixora\accounts.json içinde tutulur.
// Şifreler asla düz yazılmaz: her hesap için rastgele tuz + scrypt özeti saklanır.
const ACCOUNTS_FILE = path.join(DATA_DIR, 'accounts.json');
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function loadAccounts() {
  try { return JSON.parse(fs.readFileSync(ACCOUNTS_FILE, 'utf8')); } catch { return { users: [] }; }
}
function saveAccounts(db) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(db, null, 2));
}
const hashPassword = (password, salt) => crypto.scryptSync(password, salt, 64).toString('hex');
const nameTaken = (db, name, exceptId) =>
  db.users.some((u) => u.id !== exceptId && u.username.toLowerCase() === name.toLowerCase());

function setSessionFromUser(u) {
  return activateAccount({ type: u.provider, id: u.id, name: u.username, uuid: u.uuid, email: u.email || null });
}

async function registerLocal({ username, email, password, password2 } = {}) {
  username = String(username || '').trim();
  email = String(email || '').trim().toLowerCase();
  password = String(password || '');
  if (!OFFLINE_NAME.test(username)) throw new Error('Kullanıcı adı 3-16 karakter olmalı ve sadece harf, rakam ve _ içermeli.');
  if (!EMAIL_RE.test(email)) throw new Error('Geçerli bir e-posta adresi yaz.');
  if (password.length < 6) throw new Error('Şifre en az 6 karakter olmalı.');
  if (password !== String(password2 || '')) throw new Error('Şifreler birbiriyle aynı değil.');
  if (cloud.enabled()) return activateAccount({ ...(await cloud.register({ username, email, password })), isNew: true });
  const db = loadAccounts();
  if (db.users.some((u) => u.provider === 'local' && u.email === email)) throw new Error('Bu e-posta ile zaten bir hesap var. Giriş yapmayı dene.');
  if (nameTaken(db, username)) throw new Error('Bu kullanıcı adı alınmış, başka bir ad seç.');
  const salt = crypto.randomBytes(16).toString('hex');
  const user = {
    id: crypto.randomUUID(), provider: 'local', username, email, salt,
    hash: hashPassword(password, salt), uuid: createOfflineSession(username).uuid, created: Date.now()
  };
  db.users.push(user);
  saveAccounts(db);
  return setSessionFromUser(user);
}

async function loginLocal({ login, password } = {}) {
  login = String(login || '').trim().toLowerCase();
  password = String(password || '');
  if (!login || !password) throw new Error('E-posta ve şifreni yaz.');
  if (cloud.enabled()) {
    if (!EMAIL_RE.test(login)) throw new Error('Giriş için e-posta adresini yaz.');
    return activateAccount(await cloud.login({ email: login, password }));
  }
  const db = loadAccounts();
  const u = db.users.find((x) => x.provider === 'local' && (x.email === login || x.username.toLowerCase() === login));
  const ok = u && crypto.timingSafeEqual(Buffer.from(hashPassword(password, u.salt), 'hex'), Buffer.from(u.hash, 'hex'));
  if (!ok) throw new Error('E-posta veya şifre hatalı.');
  return setSessionFromUser(u);
}

async function renameAccount(newName) {
  newName = String(newName || '').trim();
  const a = config.account;
  if (!a || a.type === 'microsoft') throw new Error('Microsoft hesaplarında ad Minecraft üzerinden değiştirilir.');
  if (!OFFLINE_NAME.test(newName)) throw new Error('Oyun içi ad 3-16 karakter olmalı ve sadece harf, rakam ve _ içermeli.');
  if (a.cloud) {
    const oldName = a.name;
    await cloud.rename(newName);
    a.name = newName;
    if (config.cosmetics && config.cosmetics[accountKey(a)]) {
      await cloud.saveCosmetics(newName, getCosmetics()).catch(() => {});
      await cloud.deleteCosmetics(oldName);
    }
    saveConfig();
    return publicAccount();
  }
  const db = loadAccounts();
  if (nameTaken(db, newName, a.id)) throw new Error('Bu ad başka bir hesapta kullanılıyor.');
  const u = db.users.find((x) => x.id === a.id);
  if (u) { u.username = newName; saveAccounts(db); }
  a.name = newName;
  saveConfig();
  return publicAccount();
}

// ---------------------------------------------------------------- Google (OAuth)
// İstemci bilgileri src/oauth.json dosyasından okunur (BENİ OKU > "Google girişi").
// Giriş, kullanıcının kendi tarayıcısında açılır; dönüş 127.0.0.1:53682 adresine gelir.
const OAUTH_PORT = 53682;
const OAUTH_REDIRECT = `http://127.0.0.1:${OAUTH_PORT}/callback`;
const PROVIDERS = {
  google: {
    label: 'Google',
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scope: 'openid email profile',
    async profile(token) {
      const r = await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error('Google profili alınamadı.');
      const p = await r.json();
      return { id: p.sub, name: p.given_name || p.name || (p.email || '').split('@')[0], email: p.email };
    }
  }
};

function oauthConfig(provider) {
  let all = {};
  try { all = JSON.parse(fs.readFileSync(path.join(__dirname, 'oauth.json'), 'utf8')); } catch {}
  const c = all[provider] || {};
  if (!c.clientId || !c.clientSecret) {
    throw new Error(`${PROVIDERS[provider].label} ile giriş henüz ayarlanmadı. BENİ OKU dosyasındaki "Google girişi" bölümüne bak.`);
  }
  return c;
}

const b64url = (buf) => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

function waitForOAuthCode(expectedState) {
  return new Promise((resolve, reject) => {
    const page = (title, text) => `<!doctype html><meta charset="utf-8"><title>Cubixora</title>
      <body style="margin:0;height:100vh;display:grid;place-items:center;background:#050506;color:#f4f4f6;font-family:Segoe UI,sans-serif;text-align:center">
      <div><h1 style="letter-spacing:.2em;font-size:22px">CUBIXORA</h1><h2 style="font-weight:600">${title}</h2><p style="color:#8b8b95">${text}</p></div>`;
    const server = http.createServer((req, res) => {
      const u = new URL(req.url, OAUTH_REDIRECT);
      if (u.pathname !== '/callback') { res.writeHead(404); res.end(); return; }
      const code = u.searchParams.get('code');
      const ok = code && u.searchParams.get('state') === expectedState;
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', Connection: 'close' });
      res.end(ok ? page('Giriş tamamlandı', 'Bu sekmeyi kapatıp launcher\'a dönebilirsin.')
                 : page('Giriş iptal edildi', 'Launcher\'a dönüp tekrar deneyebilirsin.'));
      finish(ok ? null : new Error('Giriş iptal edildi.'), code);
    });
    const timer = setTimeout(() => finish(new Error('Giriş zaman aşımına uğradı.')), 5 * 60 * 1000);
    let done = false;
    function finish(err, code) {
      if (done) return;
      done = true;
      clearTimeout(timer);
      server.close();
      if (server.closeAllConnections) setTimeout(() => server.closeAllConnections(), 500);
      err ? reject(err) : resolve(code);
    }
    server.on('error', (e) => finish(e.code === 'EADDRINUSE' ? new Error('Başka bir giriş işlemi zaten açık.') : e));
    server.listen(OAUTH_PORT, '127.0.0.1');
  });
}

async function loginSocial(provider) {
  const P = PROVIDERS[provider];
  if (!P) throw new Error('Bilinmeyen giriş yöntemi.');
  const c = oauthConfig(provider);
  const state = b64url(crypto.randomBytes(16));
  const verifier = b64url(crypto.randomBytes(32));
  const challenge = b64url(crypto.createHash('sha256').update(verifier).digest());
  const url = `${P.authUrl}?` + new URLSearchParams({
    client_id: c.clientId, redirect_uri: OAUTH_REDIRECT, response_type: 'code', scope: P.scope,
    state, code_challenge: challenge, code_challenge_method: 'S256', prompt: 'select_account'
  });
  const codePromise = waitForOAuthCode(state);
  await shell.openExternal(url);
  const code = await codePromise;
  const tr = await fetch(P.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: c.clientId, client_secret: c.clientSecret, grant_type: 'authorization_code',
      code, redirect_uri: OAUTH_REDIRECT, code_verifier: verifier
    })
  });
  const tok = await tr.json().catch(() => ({}));
  if (!tr.ok || !tok.access_token) throw new Error(`${P.label} girişi tamamlanamadı: ${tok.error_description || tok.error || tr.status}`);
  if (win && !win.isDestroyed()) { if (win.isMinimized()) win.restore(); win.focus(); }
  if (cloud.enabled() && provider === 'google') {
    if (!tok.id_token) throw new Error('Google kimlik bilgisi alınamadı.');
    return activateAccount(await cloud.loginGoogle(tok.id_token));
  }
  const prof = await P.profile(tok.access_token);

  const db = loadAccounts();
  let u = db.users.find((x) => x.provider === provider && x.providerId === prof.id);
  if (!u) {
    const TR = { ç: 'c', ğ: 'g', ı: 'i', İ: 'I', ö: 'o', ş: 's', ü: 'u', Ç: 'C', Ğ: 'G', Ö: 'O', Ş: 'S', Ü: 'U' };
    let base = String(prof.name || 'Oyuncu').replace(/[çğıİöşüÇĞÖŞÜ]/g, (c) => TR[c])
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[.\s-]+/g, '_')
      .replace(/[^A-Za-z0-9_]/g, '').replace(/^_+|_+$/g, '').slice(0, 16);
    if (base.length < 3) base = 'Oyuncu';
    let name = base, n = 1;
    while (nameTaken(db, name)) name = base.slice(0, 16 - String(++n).length) + n;
    u = { id: crypto.randomUUID(), provider, providerId: prof.id, username: name, email: prof.email || null,
          uuid: createOfflineSession(name).uuid, created: Date.now(), isNew: true };
    db.users.push(u);
    saveAccounts(db);
  }
  const isNew = !!u.isNew;
  if (isNew) { delete u.isNew; saveAccounts(db); }
  const acc = await setSessionFromUser(u);
  if (isNew) acc.isNew = true;
  return acc;
}

// ---------------------------------------------------------------- Microsoft auth
function newAuth() {
  return new Auth('select_account');
}

// Google / e-posta hesabına Microsoft (premium Minecraft) hesabı bağlar
async function linkMicrosoft() {
  if (!config.account) throw new Error('Önce giriş yapmalısın.');
  const xbox = await newAuth().launch('electron', { title: 'Cubixora - Microsoft hesabı bağla', width: 520, height: 700, resizable: false, parent: win, modal: true, autoHideMenuBar: true });
  const mc = await xbox.getMinecraft();
  if (!mc || !mc.profile) throw new Error('Bu Microsoft hesabında Minecraft Java Edition bulunamadı.');
  config.account.msLink = { name: mc.profile.name, uuid: mc.profile.id, refresh: protect(xbox.save()) };
  saveConfig();
  return publicAccount();
}
function unlinkMicrosoft() { if (config.account) { delete config.account.msLink; config.settings.usePremium = false; saveConfig(); } return publicAccount(); }

async function loginMicrosoft() {
  const authManager = newAuth();
  const xbox = await authManager.launch('electron', {
    title: 'Cubixora - Microsoft ile giriş',
    width: 520,
    height: 700,
    resizable: false,
    parent: win,
    modal: true,
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'assets', 'icon.png')
  });
  const mc = await xbox.getMinecraft();
  if (!mc || !mc.profile) throw new Error('Bu Microsoft hesabında Minecraft Java Edition bulunamadı.');
  return activateAccount({
    type: 'microsoft',
    name: mc.profile.name,
    uuid: mc.profile.id,
    refresh: protect(xbox.save())
  });
}

async function freshAuthorization() {
  if (!config.account) throw new Error('Önce giriş yapmalısın.');
  // bağlı Microsoft hesabıyla (premium) oynama: ya ayardan açılmıştır ya da oyun adı Microsoft hesabıyla aynıdır
  // (adlar aynıysa gerçek oturumla girmek hiçbir şeyi değiştirmez, premium sunuculara girilir)
  if (config.account.type !== 'microsoft' && config.account.msLink) {
    const l = config.account.msLink;
    const sameName = String(config.account.name || '').toLowerCase() === String(l.name || '').toLowerCase();
    if (config.settings.usePremium || sameName) {
      try {
        const xbox = await newAuth().refresh(unprotect(l.refresh));
        const mc = await xbox.getMinecraft();
        if (!mc || !mc.profile) throw new Error('Bağlı Microsoft hesabında Minecraft bulunamadı.');
        l.name = mc.profile.name; l.uuid = mc.profile.id; l.refresh = protect(xbox.save());
        saveConfig();
        return mc.mclc();
      } catch (e) {
        if (config.settings.usePremium) throw e;           // açıkça istenmişse hata ver
        log(`[premium] Microsoft oturumu yenilenemedi, çevrimdışı oturumla devam: ${e.message}`);   // otomatik durumda oyun yine açılsın
      }
    }
  }
  if ((config.account.type || 'microsoft') !== 'microsoft') {
    const a = config.account;
    return offlineMclc(createOfflineSession(a.name, a.uuid));
  }
  const authManager = newAuth();
  const xbox = await authManager.refresh(unprotect(config.account.refresh));
  const mc = await xbox.getMinecraft();
  if (!mc || !mc.profile) throw new Error('Bu hesapta Minecraft Java Edition bulunamadı.');
  config.account.name = mc.profile.name;
  config.account.uuid = mc.profile.id;
  config.account.refresh = protect(xbox.save());
  saveConfig();
  send('account', publicAccount());
  return mc.mclc();
}

function publicAccount() {
  const a = config.account;
  if (!a) return null;
  return { name: a.name, uuid: a.uuid, type: a.type || 'microsoft', email: a.email || null, cloud: !!a.cloud, uid: a.cloud ? a.id : null,
    needsNick: !!a.needsNick, admin: social.isAdmin(), nicks: a.nicks || [a.name], photo: a.photo || null,
    msLink: a.msLink ? { name: a.msLink.name, uuid: a.msLink.uuid } : null };
}

// ---- nickname (Google / e-posta hesapları için oyun içi ad)
async function setNick(name, { keepOld = false } = {}) {
  name = String(name || '').trim();
  const a = config.account;
  if (!a) throw new Error('Önce giriş yapmalısın.');
  if (a.type === 'microsoft') throw new Error('Microsoft hesaplarında ad Minecraft üzerinden değiştirilir.');
  if (!OFFLINE_NAME.test(name)) throw new Error('Nickname 3-16 karakter olmalı; sadece harf, rakam ve alt çizgi (_) kullan.');
  const old = a.name;
  if (a.cloud) {
    const owned = (a.nicks || []).some((n) => n.toLowerCase() === name.toLowerCase());
    if (!owned && !(await cloud.reserveName(name, a.id))) throw new Error('Bu nickname başka bir oyuncu tarafından kullanılıyor.');
    await cloud.rename(name, true);
    if (a.needsNick && old && old.toLowerCase() !== name.toLowerCase()) await cloud.releaseName(old);
  } else {
    const db = loadAccounts();
    if (nameTaken(db, name, a.id)) throw new Error('Bu nickname başka bir hesapta kullanılıyor.');
    const u = db.users.find((x) => x.id === a.id);
    if (u) { u.username = name; saveAccounts(db); }
  }
  const nicks = new Set((a.nicks || []).concat(a.needsNick ? [] : [old]).filter(Boolean));
  nicks.add(name);
  a.nicks = [...nicks];
  a.name = name;
  a.needsNick = false;
  // kozmetikler yeni ada taşınır
  if (a.cloud && old && old.toLowerCase() !== name.toLowerCase() && config.cosmetics && config.cosmetics[accountKey(a)]) {
    await cloud.saveCosmetics(name, await cosmeticsForCloud(getCosmetics())).catch(() => {});
  }
  saveConfig();
  if (a.cloud) social.updateProfile({ mcName: name }).catch(() => {});
  playerSkinCache = null;
  return publicAccount();
}
async function removeNick(name) {
  const a = config.account;
  if (!a || !a.nicks) return publicAccount();
  if (name.toLowerCase() === a.name.toLowerCase()) throw new Error('Kullandığın nickname silinemez. Önce başka bir nickname seç.');
  a.nicks = a.nicks.filter((n) => n.toLowerCase() !== name.toLowerCase());
  if (a.cloud) await cloud.releaseName(name);
  saveConfig();
  return publicAccount();
}

// ---------------------------------------------------------------- kozmetikler
const COSMETIC_DIR = path.join(__dirname, 'assets', 'cosmetics');
const COSMETIC_DEFAULT = { skin: null, slim: false, cape: '', wings: '', pet: false, hat: '', fly: '', effect: '', petSide: 'left', wingsOpen: true, capeWave: 1, wingSpeed: 1 };
// Oyun içi kozmetik modu: Minecraft sürümü -> derlenmiş mod klasörü (src/mod-jars/targets.json, 3-MOD-DERLE.bat üretir)
// sürüm haritası koda gömülü: targets.json eski kalsa bile her sürüm doğru moda gider
const BUILTIN_TARGETS = {"1.17":"v1_17","1.17.1":"v1_17","1.18":"v1_18","1.18.1":"v1_18","1.18.2":"v1_18","1.19":"v1_19","1.19.1":"v1_19","1.19.2":"v1_19","1.19.3":"v1_19_4","1.19.4":"v1_19_4","1.20":"v1_20_1","1.20.1":"v1_20_1","1.20.2":"v1_20_4","1.20.3":"v1_20_4","1.20.4":"v1_20_4","1.20.5":"v1_20_6","1.20.6":"v1_20_6","1.21":"v1_21_1","1.21.1":"v1_21_1","1.21.2":"v1_21_4","1.21.3":"v1_21_4","1.21.4":"v1_21_4","1.21.5":"v1_21_5","1.21.6":"v1_21_8","1.21.7":"v1_21_8","1.21.8":"v1_21_8","1.21.9":"v1_21_10","1.21.10":"v1_21_10","1.21.11":"v1_21_11","26.1":"v26_1","26.1.1":"v26_1","26.1.2":"v26_1","26.2":"v26_2","26.3":"v26_3"};
let MOD_TARGETS = { ...BUILTIN_TARGETS };
try { Object.assign(MOD_TARGETS, JSON.parse(fs.readFileSync(path.join(__dirname, 'mod-jars', 'targets.json'), 'utf8'))); } catch {}
for (const [k, v] of Object.entries(MOD_TARGETS)) if (!/^v\d/.test(v)) MOD_TARGETS[k] = BUILTIN_TARGETS[k]; // eski düzen (1.20.1/ gibi) klasörleri yok say
for (const k of Object.keys(MOD_TARGETS)) if (!MOD_TARGETS[k]) delete MOD_TARGETS[k];
const COSMETIC_MODS_DIR = path.join(DATA_DIR, 'cosmetic-mods');
const modJarFor = (version) => MOD_TARGETS[version] && path.join(__dirname, 'mod-jars', MOD_TARGETS[version], 'cubixora-cosmetics.jar');
function cosmeticVersions() {
  return Object.keys(MOD_TARGETS).filter((v) => fs.existsSync(modJarFor(v)));
}

let _assetsP = null;
function cosmeticAssets() { return (_assetsP = _assetsP || cosmeticAssetsLoad().catch((e) => { _assetsP = null; throw e; })); }
async function cosmeticAssetsLoad() {
  const b64 = async (f) => 'data:image/png;base64,' + (await fsp.readFile(f)).toString('base64');
  const out = { defaultSkin: null, capes: {}, wings: {}, wingPreviews: {}, props: {}, icons: {} };
  for (const f of await fsp.readdir(COSMETIC_DIR)) {
    if (!f.endsWith('.png')) continue;
    const url = await b64(path.join(COSMETIC_DIR, f));
    const id = f.slice(0, -4);
    if (id === 'default_skin') out.defaultSkin = url;
    else if (id.startsWith('cape_')) out.capes[id.slice(5)] = url;
    else if (id.startsWith('wings_')) out.wings[id.slice(6)] = url;
    else if (id.startsWith('wingsprev_')) out.wingPreviews[id.slice(10)] = url;
  }
  try {
    const PD = path.join(__dirname, 'assets', 'props');
    for (const f of await fsp.readdir(PD)) {
      if (f.startsWith('icon_') && f.endsWith('.png')) out.icons[f.slice(5, -4)] = await b64(path.join(PD, f));
      else if (f.endsWith('.json')) {
        const id = f.slice(0, -5);
        out.props[id] = { model: JSON.parse(await fsp.readFile(path.join(PD, f), 'utf8')), tex: await b64(path.join(PD, id + '.png')) };
      }
    }
  } catch {}
  return out;
}

function getCosmetics() {
  const key = accountKey(config.account);
  return { ...COSMETIC_DEFAULT, ...((config.cosmetics || {})[key] || {}) };
}

function cleanCosmetics(c) {
  const out = { ...COSMETIC_DEFAULT };
  if (typeof c.skin === 'string' && /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(c.skin)) {
    if (c.skin.length > 60000) throw new Error('Skin dosyası çok büyük.');
    out.skin = c.skin;
  }
  const exists = (kind, id) => !id || /^[a-z0-9_-]{1,40}$/.test(id);
  out.slim = !!c.slim;
  out.cape = exists('cape', c.cape) ? String(c.cape || '') : '';
  out.wings = exists('wings', c.wings) ? String(c.wings || '') : '';
  out.pet = !!c.pet;
  out.hat = /^[a-z0-9_]{1,24}$/.test(String(c.hat || '')) ? String(c.hat) : '';
  out.fly = /^[a-z0-9_]{1,24}$/.test(String(c.fly || '')) ? String(c.fly) : '';
  out.effect = /^[a-z0-9_]{1,24}$/.test(String(c.effect || '')) ? String(c.effect) : '';
  out.petSide = c.petSide === 'right' ? 'right' : 'left';
  out.wingsOpen = c.wingsOpen !== false;
  out.capeWave = Math.max(0, Math.min(2, Number(c.capeWave) || 0));
  out.wingSpeed = Math.max(0.2, Math.min(2.5, Number(c.wingSpeed) || 1));
  return out;
}

async function saveCosmetics(c) {
  if (!config.account) throw new Error('Önce giriş yapmalısın.');
  const clean = cleanCosmetics(c || {});
  config.cosmetics = config.cosmetics || {};
  config.cosmetics[accountKey(config.account)] = clean;
  saveConfig();
  let cloudSaved = false;
  if (cloud.isCloudAccount()) {
    try { await cloud.saveCosmetics(config.account.name, await cosmeticsForCloud(clean)); cloudSaved = true; }
    catch (e) {
      log(`[kozmetik] buluta kaydedilemedi: ${e.message}`);
      // kurallar (eski yayın) bir eşyayı reddettiyse en azından skin gitsin, oyun içi görünüm bozulmasın
      if (/izni reddedildi|PERMISSION/i.test(e.message)) {
        try { await cloud.saveCosmetics(config.account.name, { ...(await cosmeticsForCloud(clean)), cape: '', wings: '', pet: false, capeTex: '', wingsTex: '' }); } catch {}
        throw new Error('Seçimin bu bilgisayara kaydedildi ama diğer oyunculara gönderilemedi. Firebase kuralları güncel değil: firestore-kurallari.txt dosyasını Firebase > Firestore > Kurallar\'a yapıştırıp Yayınla.');
      }
      throw new Error('Kozmetikler bu bilgisayara kaydedildi ama buluta gönderilemedi: ' + e.message);
    }
  }
  return { cosmetics: clean, cloudSaved };
}

// Bulutta sadece sahip olunan kozmetikler takılı görünür (kurallar da bunu zorunlu kılar)
async function cosmeticsForCloud(c) {
  const inv = social.inventory();
  const out = { ...c };
  if (out.cape && !inv[`cape-${out.cape}`]) out.cape = '';
  if (out.wings && !inv[`wings-${out.wings}`]) out.wings = '';
  if (out.pet && !inv['pet-mini']) out.pet = false;
  if (out.hat && !inv[`hat-${out.hat}`]) out.hat = '';
  if (out.fly && !inv[`fpet-${out.fly}`]) out.fly = '';
  if (out.effect && !inv[`effect-${out.effect}`]) out.effect = '';
  // mağazadan gelen (EXE'de olmayan) pelerin/kanat dokuları da yazılır, oyundaki mod onları indirir
  try {
    const items = await social.shop();
    const cape = out.cape && items[`cape-${out.cape}`];
    const wings = out.wings && items[`wings-${out.wings}`];
    if (cape && cape.texture) out.capeTex = cape.texture;
    if (wings && wings.texture) out.wingsTex = wings.texture;
  } catch {}
  return out;
}

async function refreshCosmetics() {
  if (cloud.isCloudAccount()) {
    const c = await cloud.loadCosmetics(config.account.name);
    if (c) {
      config.cosmetics = config.cosmetics || {};
      config.cosmetics[accountKey(config.account)] = cleanCosmetics(c);
      saveConfig();
    }
  }
  return getCosmetics();
}

// ---- oyuncunun gerçek skini (kozmetik önizlemesi bununla gösterilir)
// Basit zip okuyucu: Minecraft istemci jar'ından varsayılan skin PNG'sini çıkarmak için.
function readZipEntry(file, wanted) {
  // Tüm jar'ı (25-30 MB) belleğe almadan, yalnızca dizin ve istenen kaydı okur: ana iş parçacığını dondurmaz
  const zlib = require('zlib');
  let fd;
  try {
    fd = fs.openSync(file, 'r');
    const size = fs.fstatSync(fd).size, tailLen = Math.min(size, 70000);
    const tail = Buffer.alloc(tailLen); fs.readSync(fd, tail, 0, tailLen, size - tailLen);
    let eocd = -1;
    for (let i = tailLen - 22; i >= 0; i--) if (tail.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) return null;
    const cdSize = tail.readUInt32LE(eocd + 12), cdOff = tail.readUInt32LE(eocd + 16), count = tail.readUInt16LE(eocd + 10);
    const cd = Buffer.alloc(cdSize); fs.readSync(fd, cd, 0, cdSize, cdOff);
    let p = 0;
    for (let n = 0; n < count && p + 46 <= cdSize && cd.readUInt32LE(p) === 0x02014b50; n++) {
      const method = cd.readUInt16LE(p + 10), csize = cd.readUInt32LE(p + 20);
      const nlen = cd.readUInt16LE(p + 28), elen = cd.readUInt16LE(p + 30), clen = cd.readUInt16LE(p + 32);
      const local = cd.readUInt32LE(p + 42), name = cd.toString('utf8', p + 46, p + 46 + nlen);
      if (name === wanted) {
        const lh = Buffer.alloc(30); fs.readSync(fd, lh, 0, 30, local);
        const start = local + 30 + lh.readUInt16LE(26) + lh.readUInt16LE(28);
        const data = Buffer.alloc(csize); fs.readSync(fd, data, 0, csize, start);
        return method === 8 ? zlib.inflateRawSync(data) : data;
      }
      p += 46 + nlen + elen + clen;
    }
    return null;
  } catch { return null; }
  finally { if (fd !== undefined) try { fs.closeSync(fd); } catch {} }
}

// Minecraft'ın UUID'ye göre seçtiği varsayılan skin (1.19.3+ kuralı: 9 skin x 2 kol modeli)
const DEFAULT_SKINS = ['alex', 'ari', 'efe', 'kai', 'makena', 'noor', 'steve', 'sunny', 'zuri'];
function defaultSkinFor(uuid) {
  const hex = String(uuid || '').replace(/-/g, '').padStart(32, '0').slice(0, 32);
  const most = BigInt.asIntN(64, BigInt('0x' + hex.slice(0, 16)));
  const least = BigInt.asIntN(64, BigInt('0x' + hex.slice(16)));
  const hilo = most ^ least;
  const hash = Number(BigInt.asIntN(32, hilo >> 32n) ^ BigInt.asIntN(32, hilo));
  const idx = ((hash % 18) + 18) % 18;
  return { name: DEFAULT_SKINS[idx % 9], slim: idx < 9 };
}

let playerSkinCache = null;
async function playerSkin() {
  const a = config.account;
  if (!a) return null;
  const key = `${a.type}:${a.uuid}`;
  if (playerSkinCache && playerSkinCache.key === key) return playerSkinCache.value;
  let value = null;
  try {
    if ((a.type || 'microsoft') === 'microsoft') {
      const prof = await getJSON(`https://sessionserver.mojang.com/session/minecraft/profile/${a.uuid.replace(/-/g, '')}`);
      const tex = JSON.parse(Buffer.from(prof.properties.find((x) => x.name === 'textures').value, 'base64').toString('utf8')).textures;
      if (tex.SKIN && tex.SKIN.url) {
        const r = await fetch(tex.SKIN.url.replace(/^http:/, 'https:'), { headers: { 'User-Agent': UA } });
        if (r.ok) value = { url: 'data:image/png;base64,' + Buffer.from(await r.arrayBuffer()).toString('base64'), slim: !!(tex.SKIN.metadata && tex.SKIN.metadata.model === 'slim'), source: 'microsoft' };
      }
    }
    if (!value) {
      const d = defaultSkinFor(a.uuid);
      const versionsDir = path.join(MC_ROOT, 'versions');
      const jars = fs.existsSync(versionsDir) ? fs.readdirSync(versionsDir).map((v) => path.join(versionsDir, v, `${v}.jar`)).filter((f) => fs.existsSync(f)) : [];
      for (const jar of jars) {
        const png = readZipEntry(jar, `assets/minecraft/textures/entity/player/${d.slim ? 'slim' : 'wide'}/${d.name}.png`);
        if (png) { value = { url: 'data:image/png;base64,' + png.toString('base64'), slim: d.slim, source: 'default', name: d.name }; break; }
      }
      if (!value) { // yalnızca eski (1.19.2 ve öncesi) sürümler kuruluysa: steve / alex
        const name = d.slim ? 'alex' : 'steve';
        for (const jar of jars) {
          const png = readZipEntry(jar, `assets/minecraft/textures/entity/player/${d.slim ? 'slim' : 'wide'}/${name}.png`) || readZipEntry(jar, `assets/minecraft/textures/entity/${name}.png`);
          if (png) { value = { url: 'data:image/png;base64,' + png.toString('base64'), slim: d.slim, source: 'default', name }; break; }
        }
      }
    }
  } catch (e) { log(`[kozmetik] oyuncu skini alınamadı: ${e.message}`); }
  if (value) playerSkinCache = { key, value };
  return value;
}

// Microsoft hesabının gerçek (Mojang) skinini değiştirir
async function uploadMojangSkin(dataUrl, slim) {
  if (!config.account || (config.account.type || 'microsoft') !== 'microsoft') throw new Error('Bunun için Microsoft hesabıyla giriş yapmalısın.');
  const m = /^data:image\/png;base64,(.+)$/.exec(String(dataUrl || ''));
  if (!m) throw new Error('Geçerli bir PNG skin seç.');
  const auth = await freshAuthorization();
  const form = new FormData();
  form.append('variant', slim ? 'slim' : 'classic');
  form.append('file', new Blob([Buffer.from(m[1], 'base64')], { type: 'image/png' }), 'skin.png');
  const r = await fetch('https://api.minecraftservices.com/minecraft/profile/skins', {
    method: 'POST', headers: { Authorization: `Bearer ${auth.access_token}` }, body: form
  });
  if (!r.ok) throw new Error(`Microsoft skini yüklenemedi (${r.status}).`);
  return true;
}

// Fabric API'yi (kozmetik modu ihtiyaç duyar) profilin mods klasörüne değil, launcher'ın kendi klasörüne indirir
async function ensureCosmeticFabricApi(version, dir) {
  if ((await fsp.readdir(dir)).some((f) => /^fabric-api.*\.jar$/i.test(f))) return;
  send('progress', { stage: 'Kozmetikler için Fabric API indiriliyor', current: 0, total: 1 });
  const versions = await getJSON(`${MODRINTH}/project/P7dR8mSH/version?loaders=${encodeURIComponent('["fabric"]')}&game_versions=${encodeURIComponent(JSON.stringify([version]))}`);
  const v = versions.find((x) => x.version_type === 'release') || versions[0];
  if (!v) throw new Error(`${version} için Fabric API bulunamadı`);
  const file = v.files.find((f) => f.primary) || v.files[0];
  await downloadFile(file.url, path.join(dir, 'fabric-api.jar'), file.hashes && file.hashes.sha1);
}

// Oyun başlarken kozmetik modunu hazırlar. Vanilla profillerde de çalışır: launcher oyunu arka planda
// Fabric ile açar ve modları -Dfabric.addMods ile yükler; profilin mods klasörüne hiçbir şey eklenmez.
// Döner: { addMods: klasör } ya da null (bu sürüm için mod yoksa).
async function prepareCosmetics(p, gameDir) {
  const modsDir = path.join(gameDir, 'mods');
  for (const f of await fsp.readdir(modsDir).catch(() => [])) { // eski sürümün mods klasörüne koyduğu kopya
    if (/^cubixora-cosmetics.*\.jar$/.test(f)) await fsp.rm(path.join(modsDir, f), { force: true });
  }
  const jar = modJarFor(p.version);
  if (!jar || !fs.existsSync(jar)) {
    log(`[kozmetik] ${p.version} için oyun içi kozmetik modu yok (hazır sürümler: ${cosmeticVersions().join(', ') || 'yok, 3-MOD-DERLE.bat çalıştırılmalı'})`);
    return null;
  }
  const dir = path.join(COSMETIC_MODS_DIR, p.version);
  await fsp.mkdir(dir, { recursive: true });
  await fsp.copyFile(jar, path.join(dir, 'cubixora-cosmetics.jar'));
  const userHasApi = p.loader === 'fabric' && (await fsp.readdir(modsDir).catch(() => [])).some((f) => /^fabric-api.*\.jar$/i.test(f));
  if (userHasApi) {
    for (const f of await fsp.readdir(dir)) if (/^fabric-api/i.test(f)) await fsp.rm(path.join(dir, f), { force: true }); // çift yüklenmesin
  } else {
    await ensureCosmeticFabricApi(p.version, dir);
  }
  const cfgDir = path.join(gameDir, 'config', 'cubixora');
  await fsp.mkdir(cfgDir, { recursive: true });
  // Oyunda da launcher önizlemesindeki skin görünsün: özel skin yoksa oyuncunun kendi skini
  // (Microsoft skini ya da UUID'ye göre varsayılan skin) mod'a verilir; böylece her sürümde aynı görünür.
  // sadece satın alınmış kozmetikler takılır (Microsoft/yerel hesaplarda mağaza olmadığı için kozmetik yok)
  const owned = cloud.isCloudAccount() ? await cosmeticsForCloud(getCosmetics()) : { ...getCosmetics(), cape: '', wings: '', pet: false, effect: '' };
  const self = { name: config.account.name, ...owned, capeWaving: config.settings.capeWaving !== false };
  if (!self.skin) {
    const base = await playerSkin().catch(() => null);
    if (base && base.url) { self.skin = base.url; self.slim = !!base.slim; }
    else { // önizlemedeki yedek skinle aynı
      const f = path.join(COSMETIC_DIR, 'default_skin.png');
      if (fs.existsSync(f)) { self.skin = 'data:image/png;base64,' + fs.readFileSync(f).toString('base64'); self.slim = false; }
    }
  }
  await fsp.writeFile(path.join(cfgDir, 'self.json'), JSON.stringify(self));
  await fsp.writeFile(path.join(cfgDir, 'cloud.json'), JSON.stringify(cloud.publicConfig() || {}));
  return { addMods: dir };
}



// ---------------------------------------------------------------- oyun köprüsü (Cubixora Client)
// Oyundaki gardrop/mağaza bu yerel sunucuyla konuşur (sadece 127.0.0.1, rastgele port + gizli anahtar).
// Çalan medya (Windows: SMTC). PowerShell her istekte açılmasın diye 2,5 sn önbellek.
let mediaCache = { at: 0, val: {} };
const MEDIA_PS_PARTS = [
  "[Console]::OutputEncoding=[Text.Encoding]::UTF8;",
  "Add-Type -AssemblyName System.Runtime.WindowsRuntime;",
  "$asTask=([System.WindowsRuntimeSystemExtensions].GetMethods()|?{$_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'})[0];",
  "function Await($t,$r){$m=$asTask.MakeGenericMethod($r);$n=$m.Invoke($null,@($t));$n.Wait(-1)|Out-Null;$n.Result};",
  "[Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager,Windows.Media.Control,ContentType=WindowsRuntime]|Out-Null;",
  "$mg=Await ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]);",
  "$s=$mg.GetCurrentSession();",
  "if($s){$p=Await ($s.TryGetMediaPropertiesAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties]);$st=$s.GetPlaybackInfo().PlaybackStatus;$t=$s.GetTimelineProperties();ConvertTo-Json @{title=[string]$p.Title;artist=[string]$p.Artist;playing=($st -eq 'Playing');pos=[double]$t.Position.TotalSeconds;dur=[double]($t.EndTime.TotalSeconds-$t.StartTime.TotalSeconds)} -Compress}else{'{}'}",
];
// PowerShell her istekte yeniden açılmasın (açılışı yüksek işlemci harcar): tek bir kalıcı süreç 1,5 sn'de bir
// çalan medyayı yazar; istek gelmediği 20 sn sonra süreç kapatılır.
const MEDIA_SETUP_N = 5;   // MEDIA_PS ilk 5 parça: kurulum; kalanı: oturum sorgusu
let mediaProc = null, mediaBuf = '', mediaSeen = 0;
function mediaEnsure() {
  if (mediaProc || process.platform !== 'win32') return;
  const parts = [...MEDIA_PS_PARTS];
  const script = parts.slice(0, MEDIA_SETUP_N).join('') + 'while($true){try{' + parts.slice(MEDIA_SETUP_N).join('') + '}catch{"{}"};[Console]::Out.Flush();Start-Sleep -Milliseconds 1500}';
  const enc = Buffer.from(script, 'utf16le').toString('base64');
  try {
    mediaProc = require('child_process').spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-EncodedCommand', enc], { windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] });
  } catch { mediaProc = null; return; }
  mediaBuf = '';
  const me = mediaProc;
  me.stdout.setEncoding('utf8');
  me.stdout.on('data', (d) => {
    mediaBuf += d;
    const lines = mediaBuf.split('\n'); mediaBuf = lines.pop();
    const line = lines.filter((l) => l.trim()).pop();
    if (!line) return;
    let v = {};
    try { v = JSON.parse(line.trim()); } catch { v = {}; }
    if (v && v.title) v.ad = /^(advertisement|reklam|sponsored|reklam arası)$/i.test(String(v.title).trim()) || (/^spotify$/i.test(String(v.title).trim()) && !v.artist);
    mediaCache = { at: Date.now(), val: v };
  });
  const done = () => { if (mediaProc === me) { mediaProc = null; mediaCache = { at: 0, val: {} }; } };
  me.on('exit', done); me.on('error', done);
}
function mediaStop() { if (mediaProc) { try { mediaProc.kill(); } catch {} mediaProc = null; mediaCache = { at: 0, val: {} }; } }
setInterval(() => { if (mediaProc && Date.now() - mediaSeen > 20000) mediaStop(); }, 10000);
app.on('will-quit', mediaStop);
function mediaNow() {
  if (process.platform !== 'win32') return Promise.resolve({});
  mediaSeen = Date.now(); mediaEnsure();
  return Promise.resolve(mediaCache.val);
}

let bridge = null;
function bridgeInfo() {
  if (bridge) return Promise.resolve(bridge.info);
  return new Promise((resolve) => {
    const token = crypto.randomBytes(16).toString('hex');
    const srv = http.createServer(async (req, res) => {
      const reply = (code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(obj)); };
      if (req.headers['x-cubixora'] !== token) return reply(403, { error: 'yetkisiz' });
      let body = '';
      req.on('data', (d) => { body += d; if (body.length > 3e5) req.destroy(); });
      req.on('end', async () => {
        try {
          const data = body ? JSON.parse(body) : {};
          if (req.url === '/state') return reply(200, await bridgeState());
          if (req.url === '/equip') {
            const c = { ...getCosmetics() };
            if (data.cape !== undefined) c.cape = data.cape || '';
            if (data.wings !== undefined) c.wings = data.wings || '';
            if (data.pet !== undefined) c.pet = !!data.pet;
            if (data.hat !== undefined) c.hat = String(data.hat || '');
            if (data.fly !== undefined) c.fly = String(data.fly || '');
            if (data.effect !== undefined) c.effect = String(data.effect || '');
            if (data.skin !== undefined) { c.skin = /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(String(data.skin || '')) ? data.skin : null; c.slim = !!data.slim; }
            await saveCosmetics(c).catch((e) => log(`[köprü] kozmetik: ${e.message}`));
            send('cosmetics:changed', getCosmetics());
            return reply(200, await bridgeState());
          }
          if (req.url === '/emote') {
            if (!cloud.isCloudAccount()) return reply(400, { error: 'Emote için hesap girişi gerekli.' });
            const id = String(data.id || '');
            const inv = social.inventory();
            if (id && !(id === 'kiss' && inv['emote-opucuk'])) return reply(403, { error: 'Bu emote sende yok.' });
            await cloud.setEmote(config.account.name, id);
            return reply(200, { ok: true });
          }
          if (req.url === '/spray') {
            if (!cloud.isCloudAccount()) return reply(400, { error: 'Sprey için hesap girişi gerekli.' });
            const ok = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
            if (!ok(data.x, -3e7, 3e7) || !ok(data.y, -2048, 2048) || !ok(data.z, -3e7, 3e7) || !ok(data.d, 0, 5) || !ok(data.r, 0, 7)) return reply(400, { error: 'Geçersiz konum.' });
            if (Date.now() - (global.__sprayAt || 0) < 9000) return reply(429, { error: 'Sprey beklemede.' });
            global.__sprayAt = Date.now();
            await cloud.setSpray(config.account.name, data);
            return reply(200, { ok: true });
          }
          if (req.url === '/cursor') {
            // imleç: oyunda seçilen launcher'a, launcher'da seçilen oyuna geçer
            if (typeof data.id === 'string' && /^[a-z0-9_]{0,24}$/.test(data.id) && data.id !== (config.settings.cursor || '')) {
              config.settings.cursor = data.id; saveConfig(); send('settings:cursor', data.id);
            }
            return reply(200, { cur: config.settings.cursor || '' });
          }
          if (req.url === '/report') {
            if (!cloud.isCloudAccount()) return reply(400, { error: 'Bildirim göndermek için Google ya da e-posta ile giriş yapmalısın.' });
            await social.submitReport({ category: data.category, text: data.text, version: data.version });
            return reply(200, { ok: true });
          }
          if (req.url === '/media') return reply(200, await mediaNow());
          if (req.url === '/voice/devices') {
            send('voice:devices-req', true);
            return reply(200, voiceDevices);
          }
          if (req.url === '/voice') {
            if (Array.isArray(data.mute)) { const k = data.mute.map((x) => String(x).toLowerCase()).sort().join(','); if (k !== voiceMuteKey) { voiceMuteKey = k; send('voice:mute', data.mute.map((x) => String(x).toLowerCase())); } }
            if (data.want) { const first = Date.now() - voiceWant > 4000; voiceWant = Date.now(); if (first) send('voice:want', true); }
            // oyun içi ses: mod her 100 ms'de oyuncu listesi ve ayarları gönderir; renderer ses ağını yönetir
            if (data.s) {
              if (!voiceCtlAt || Date.now() - voiceCtlAt > 8000) vlog(`mod bağlandı: mic=${data.s.mic} hear=${data.s.hear} prox=${data.s.prox} oyuncu=${(data.peers || []).length} hesap=${config.account ? config.account.name : '-'} bulut=${cloud.isCloudAccount()}`);
              if (data.d && Date.now() - (global.__vmodLog || 0) > 10000) { global.__vmodLog = Date.now(); vlog(`mod durum: ${JSON.stringify(data.d)} cevap.on=${voiceState.on} cevap.cx=${(voiceState.cx || []).length}`); }
              voiceCtlAt = Date.now();
              const ctl = { s: data.s, peers: Array.isArray(data.peers) ? data.peers.slice(0, 60) : [], ptt: !!data.ptt, mute: data.mute || [] };
              const key = JSON.stringify(ctl.s) + '|' + ctl.peers.map((x) => x.n + ':' + Math.round(x.d / 2)).join(',') + '|' + ctl.ptt;
              if (key !== voiceCtlKey || Date.now() - voiceCtlSent > 400) { voiceCtlKey = key; voiceCtlSent = Date.now(); send('voice:ctl', ctl); }
              if (!voiceThrottleOff) { voiceThrottleOff = true; try { win.webContents.setBackgroundThrottling(false); } catch {} }
            }
            if (typeof data.srv === 'string') partnerTick(data.srv);
            const vs = Date.now() - voiceState.at < 1500 ? voiceState : { on: false };
            return reply(200, modToasts.length ? { ...vs, toast: modToasts.shift() } : vs);
          }
          if (req.url === '/buy') {
            if (!cloud.isCloudAccount()) return reply(400, { error: 'Mağaza için Google ya da e-posta ile giriş yapmalısın.' });
            await social.buy(String(data.id || ''));
            send('social:me', social.summary());
            return reply(200, await bridgeState());
          }
          reply(404, { error: 'yok' });
        } catch (e) { reply(400, { error: e.message }); }
      });
    });
    srv.listen(0, '127.0.0.1', () => { bridge = { srv, info: { port: srv.address().port, token } }; resolve(bridge.info); });
    srv.on('error', () => resolve(null));
  });
}
async function bridgeState() {
  const inv = cloud.isCloudAccount() ? social.inventory() : {};
  let shop = {};
  if (cloud.isCloudAccount()) { try { shop = await social.shop(); } catch {} }
  const c = getCosmetics();
  let coins = 0; try { coins = (social.summary().wallet || {}).coins || 0; } catch {}
  const timed = (() => { try { return social.timedLive(); } catch { return {}; } })();
  const items = Object.entries(shop).filter(([id, it]) => (it.active !== false || inv[id]) && !(it.questOnly && !inv[id]) && ['cape', 'wings', 'pet', 'emote', 'spray', 'hat', 'fpet', 'effect'].includes(it.type))
    .map(([id, it]) => ({ id, name: it.name, type: it.type, ref: it.ref, price: it.price || 0, rarity: it.rarity || 'yaygin', owned: !!inv[id], free: !!it.free, until: timed[id] || 0, icon: /^data:image\/png;base64,/.test(it.icon || '') && it.icon.length < 60000 ? it.icon : '', tex: it.type === 'cape' && /^data:image\/png;base64,/.test(it.texture || '') && it.texture.length < 270000 ? it.texture : '' }));
  return { coins, equipped: { cape: c.cape || '', wings: c.wings || '', pet: !!c.pet, hat: c.hat || '', fly: c.fly || '', effect: c.effect || '' }, items };
}

// Cubixora Client (sadece "Cubixora" profilleri): oyundaki ana menü için arkadaşlar, haberler ve coin
async function writeClientJson(p, gameDir) {
  const f = path.join(gameDir, 'config', 'cubixora', 'client.json');
  if (p.preset !== 'cubixora') { await fsp.rm(f, { force: true }); return; }
  let friends = [], news = [], coins = 0, plus = false;
  if (cloud.isCloudAccount()) {
    try { plus = !!social.hasPlusPerk(); } catch {}
    try { const fr = await social.friends(); friends = (fr.list || []).map((x) => ({ name: x.displayName || x.handle || '', status: x.status || 'offline', game: x.game || '' })); } catch {}
    try { news = ((await social.notifications()) || []).filter((n) => n.scope !== 'me').slice(0, 6).map((n) => ({ title: n.title || '', text: n.text || '', at: n.at || 0 })); } catch {}
    try { coins = (social.summary().wallet || {}).coins || 0; } catch {}
  }
  await fsp.mkdir(path.dirname(f), { recursive: true });
  const br = await bridgeInfo();
  await fsp.writeFile(f, JSON.stringify({ enabled: true, name: config.account ? config.account.name : '', coins, plus, friends, news, bridge: br, cursor: config.settings.cursor || '' }));
}

// ---------------------------------------------------------------- launch
// Oyun içi "Yüklü Modlar" ekranında aç/kapat yapılan modlar: oyun açıkken dosya kilitli olduğundan bir sonraki açılıştan önce uygulanır
async function applyModsPending(gameDir) {
  const f = path.join(gameDir, 'config', 'cubixora', 'mods-pending.json');
  let want;
  try { want = JSON.parse(await fsp.readFile(f, 'utf8')); } catch { return; }
  const modsDir = path.join(gameDir, 'mods');
  for (const [file, on] of Object.entries(want || {})) {
    if (!/^[^\\/:*?"<>|]+\.jar$/i.test(file)) continue;
    const jar = path.join(modsDir, file), off = jar + '.disabled';
    try {
      if (on && fs.existsSync(off) && !fs.existsSync(jar)) await fsp.rename(off, jar);
      else if (!on && fs.existsSync(jar)) { await fsp.rm(off, { force: true }); await fsp.rename(jar, off); }
      log(`[modlar] ${file} ${on ? 'açıldı' : 'kapatıldı'}`);
    } catch (e) { log(`[modlar] ${file}: ${e.message}`); }
  }
  await fsp.rm(f, { force: true });
}

async function launchProfile(profileId, opt = {}) {
  if (gameRunning) throw new Error('Oyun zaten açık.');
  if (launchAbort) throw new Error('Hazırlık zaten sürüyor.');
  launchAbort = new AbortController();
  try { return await launchProfileInner(profileId, opt); }
  catch (e) { if (launchAbort && launchAbort.signal.aborted) throw new Error('Başlatma durduruldu.'); throw e; }
  finally { launchAbort = null; }
}
async function launchProfileInner(profileId, opt = {}) {
  const p = findProfile(profileId);
  if (!p) throw new Error('Profil bulunamadı.');
  if (config.account && config.account.needsNick) throw new Error('NEEDS_NICK');
  if (p.preset === 'cubixora' && p.loader === 'fabric' && p.optimizedFor !== p.version) {
    send('progress', { stage: 'Optimizasyon modları kuruluyor', current: 0, total: 1 });
    await runOptimize(p.id); chk();
  }

  if (cloud.isCloudAccount()) {
    send('progress', { stage: 'Modlar eşitleniyor', current: 0, total: 1 });
    await cloud.idle(); chk();
  }
  send('progress', { stage: 'Oturum doğrulanıyor', current: 0, total: 1 });
  const authorization = await freshAuthorization(); chk();

  const javaPath = await ensureJava(p.version); chk();

  const gameDir = profileDir(p);
  await fsp.mkdir(path.join(gameDir, 'mods'), { recursive: true });
  await applyModsPending(gameDir).catch((e) => log(`[modlar] bekleyen değişiklik uygulanamadı: ${e.message}`));
  send('progress', { stage: 'Kozmetikler hazırlanıyor', current: 0, total: 1 });
  let cos = await prepareCosmetics(p, gameDir).catch((e) => { if (launchAbort && launchAbort.signal.aborted) throw e; log(`[kozmetik] hazırlanamadı: ${e.message}`); return null; }); chk();
  await writeClientJson(p, gameDir).catch((e) => log(`[client] client.json yazılamadı: ${e.message}`));
  // vanilla profilde shader paketi varsa Iris + Sodium gizli klasöre eklenir
  if (p.loader !== 'fabric') {
    const dir = cos ? cos.addMods : path.join(COSMETIC_MODS_DIR, p.version);
    try {
      await fsp.mkdir(dir, { recursive: true });
      if (await features.ensureShaderSupport(p, dir)) { if (!cos) { await ensureCosmeticFabricApi(p.version, dir); cos = { addMods: dir }; } }
      else for (const f of ['iris.jar', 'sodium.jar']) await fsp.rm(path.join(dir, f), { force: true });
    } catch (e) { log(`[shader] ${e.message}`); }
  }
  await features.writeAutoLogin(gameDir, authorization.name).catch((e) => log(`[oto-login] ${e.message}`));

  let custom;
  if (p.loader === 'fabric') {
    send('progress', { stage: 'Fabric hazırlanıyor', current: 0, total: 1 });
    custom = await ensureFabric(p.version, p.loaderVersion || null);
  } else if (cos) {
    // vanilla profil: kozmetikler görünsün diye arka planda Fabric ile açılır
    try { custom = await ensureFabric(p.version, null); }
    catch (e) { log(`[kozmetik] Fabric hazırlanamadı, oyun kozmetiksiz açılıyor: ${e.message}`); }
  }

  chk();
  const m = await getManifest(); chk();
  const vInfo = m.versions.find((x) => x.id === p.version);

  const launcher = new Client();
  const opts = {
    authorization,
    root: MC_ROOT,
    javaPath,
    version: { number: p.version, type: vInfo ? vInfo.type : 'release', ...(custom ? { custom } : {}) },
    memory: { max: `${p.ram || config.settings.defaultRam}G`, min: `${Math.min(config.settings.minRam || 1, p.ram || config.settings.defaultRam)}G` },
    overrides: { gameDirectory: gameDir, detached: true },
    window: (p.fullscreen || config.settings.fullscreen) ? { fullscreen: true }
      : (/^\d+x\d+$/.test(config.settings.resolution || '') ? { width: Number(config.settings.resolution.split('x')[0]), height: Number(config.settings.resolution.split('x')[1]) } : undefined)
  };
  // partner sunucusuna direkt giriş
  if (opt.server) {
    const [host, port] = String(opt.server).split(':');
    opts.quickPlay = versionAtLeast(p.version, '1.20')
      ? { type: 'multiplayer', identifier: `${host}:${port || 25565}` }
      : { type: 'legacy', identifier: `${host}:${port || 25565}` };
  }
  opts.customArgs = p.jvmArgs ? p.jvmArgs.split(' ').filter(Boolean) : [];
  if (cos && custom) opts.customArgs.push(`-Dfabric.addMods=${cos.addMods}`);

  launcher.on('debug', (e) => log(`[debug] ${e}`));
  launcher.on('data', (e) => log(e));
  launcher.on('progress', (e) => { chk(); send('progress', { stage: `İndiriliyor: ${e.type}`, current: e.task, total: e.total }); });
  launcher.on('download-status', (e) => {
    chk();
    if (e.total > 1024 * 1024) send('progress', { stage: `İndiriliyor: ${e.name}`, current: e.current, total: e.total });
  });
  const started = Date.now();
  launcher.on('close', (code) => {
    gameRunning = false; gameChild = null;
    if (gameKilled) { code = 0; gameKilled = false; } // kullanıcı kapattı: hata sayılmaz
    social.setGame(''); discord.setMenu();
    const minutes = Math.round((Date.now() - started) / 60000);
    if (minutes > 0) social.track('minutes', minutes);
    // mod olmadan (Cubixora dışı profil) partner sunucusuna direkt girildiyse süreyi kapanışta say
    if (minutes > 0 && opt.server && !partnerSeen) social.track('partner_minutes', minutes);
    partnerSeen = false;
    send('game-state', { running: false, code });
    cloud.schedulePush();
    if (config.settings.closeOnLaunch && win && !win.isDestroyed()) win.show();
  });

  send('progress', { stage: 'Oyun başlatılıyor', current: 1, total: 1 });
  chk();
  const child = await launcher.launch(opts);
  if (launchAbort && launchAbort.signal.aborted) { try { child && child.kill(); } catch {} throw new Error('Başlatma durduruldu.'); }
  if (!child) throw new Error('Oyun başlatılamadı. Ayrıntılar için Ayarlar > Günlük bölümüne bak.');
  gameRunning = true; gameChild = child; gameKilled = false;
  p.lastPlayed = Date.now();
  saveConfig();
  discord.setGame(p.version, opt.serverName || '', (config.account && config.account.name) || '');
  social.setGame(opt.serverName ? `${opt.serverName} sunucusunda` : `Minecraft ${p.version} oynuyor`);
  social.track('game');
  // oyundaki Cubixora oyuncuları (TAB logosu, ses ağı) birbirini tanısın: hesap belgesi bulutta olsun
  if (cloud.isCloudAccount() && p.preset === 'cubixora') saveCosmetics(getCosmetics()).catch(() => {});
  if (opt.server) social.track('partner');
  send('game-state', { running: true });
  if (config.settings.closeOnLaunch && win) win.hide();
  return true;
}

function versionAtLeast(v, min) {
  if (/^\d{2}\./.test(v)) return true; // 26.x ve sonrası
  const a = v.split('.').map(Number), b = min.split('.').map(Number);
  for (let i = 0; i < 3; i++) { if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) > (b[i] || 0); }
  return true;
}

// ---------------------------------------------------------------- Modrinth
async function modSearch({ query, mcVersion, offset = 0 }) {
  const facets = [['project_type:mod'], ['categories:fabric'], [`versions:${mcVersion}`]];
  const url = `${MODRINTH}/search?limit=20&offset=${offset}&index=${query ? 'relevance' : 'downloads'}` +
    `&query=${encodeURIComponent(query || '')}&facets=${encodeURIComponent(JSON.stringify(facets))}`;
  const r = await getJSON(url);
  return {
    total: r.total_hits,
    hits: r.hits.map((h) => ({
      id: h.project_id, slug: h.slug, title: h.title, description: h.description,
      icon: h.icon_url, downloads: h.downloads, author: h.author
    }))
  };
}

async function installMod(profileId, projectId, seen = new Set()) {
  const p = findProfile(profileId);
  if (!p) throw new Error('Profil bulunamadı.');
  if (seen.has(projectId)) return [];
  seen.add(projectId);
  const versions = await getJSON(`${MODRINTH}/project/${projectId}/version?loaders=${encodeURIComponent('["fabric"]')}&game_versions=${encodeURIComponent(JSON.stringify([p.version]))}`);
  if (!versions.length) throw new Error('Bu mod, profilin sürümü için uygun değil.');
  const v = versions.find((x) => x.version_type === 'release') || versions[0];
  const file = v.files.find((f) => f.primary) || v.files[0];
  const modsDir = path.join(profileDir(p), 'mods');
  await downloadFile(file.url, path.join(modsDir, file.filename), file.hashes && file.hashes.sha1);
  if (file.hashes && file.hashes.sha1) cloud.rememberMod(file.hashes.sha1, { url: file.url, projectId: v.project_id, versionId: v.id });
  const installed = [file.filename];
  for (const dep of v.dependencies || []) {
    if (dep.dependency_type === 'required' && dep.project_id) {
      try { installed.push(...(await installMod(profileId, dep.project_id, seen))); }
      catch (e) { log(`Bağımlılık kurulamadı (${dep.project_id}): ${e.message}`); }
    }
  }
  return installed;
}

async function listMods(profileId) {
  const p = findProfile(profileId);
  if (!p) return [];
  const dir = path.join(profileDir(p), 'mods');
  await fsp.mkdir(dir, { recursive: true });
  const names = await fsp.readdir(dir);
  const mods = [];
  for (const n of names) {
    if (!n.endsWith('.jar') && !n.endsWith('.jar.disabled')) continue;
    if (n.startsWith('cubixora-cosmetics')) continue; // launcher'ın kendi modu
    const st = await fsp.stat(path.join(dir, n));
    mods.push({ file: n, name: n.replace(/\.disabled$/, '').replace(/\.jar$/, ''), enabled: !n.endsWith('.disabled'), size: st.size });
  }
  return mods.sort((a, b) => a.name.localeCompare(b.name));
}

// ---------------------------------------------------------------- window
function createWindow() {
  win = new BrowserWindow({
    width: 1180,
    height: 720,
    minWidth: 980,
    minHeight: 620,
    frame: false,
    backgroundColor: '#050506',
    show: false,
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
      backgroundThrottling: true,
      v8CacheOptions: 'bypassHeatCheck'
    }
  });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.once('ready-to-show', () => { win.show(); setTimeout(() => global.__cubixora && global.__cubixora.ok(), 8000); });
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  // X: ayara göre tepsiye küçült ya da kapat
  win.on('close', (e) => {
    if (!quitting && config.settings.closeToTray !== false) { e.preventDefault(); win.hide(); trayHint(); }
  });
  win.on('focus', () => win.flashFrame(false));
  // Görev çubuğu sağ-tık menüsünün başlık simgesi (ad + simge). Her adımın sonucu DATA_DIR\simge-log.txt dosyasına yazılır.
  if (process.platform === 'win32') {
    const L = [];
    const note = (m) => { L.push(m); try { fs.writeFileSync(path.join(DATA_DIR, 'simge-log.txt'), L.join('\n') + '\n'); } catch {} };
    const step = (name, fn) => { try { const r = fn(); note(`${name}: tamam${r === undefined ? '' : ' -> ' + r}`); return r; } catch (e) { note(`${name}: HATA ${e && e.message}`); } };
    note(`surum: dev=${IS_DEV} paketli=${app.isPackaged} exe=${process.execPath} aumid=${AUMID} electron=${process.versions.electron}`);
    let dst = '', png = '';
    step('dosyalar', () => {
      const icoBuf = fs.readFileSync(path.join(__dirname, 'assets', 'icon.ico'));
      const pngBuf = fs.readFileSync(path.join(__dirname, 'assets', 'icon-small.png'));
      const tag = require('crypto').createHash('md5').update(icoBuf).update(pngBuf).digest('hex').slice(0, 10);
      dst = path.join(DATA_DIR, `cubixora-${tag}.ico`); png = path.join(DATA_DIR, `cubixora-${tag}.png`);
      fs.mkdirSync(DATA_DIR, { recursive: true });
      for (const f of fs.readdirSync(DATA_DIR)) if (/^cubixora(-[0-9a-f]{10})?\.(ico|png)$/.test(f) && !f.includes(tag)) { try { fs.unlinkSync(path.join(DATA_DIR, f)); } catch {} }
      fs.writeFileSync(dst, icoBuf); fs.writeFileSync(png, pngBuf);
      return tag;
    });
    step('setIcon', () => { const img = nativeImage.createFromPath(dst); win.setIcon(img); return `bos=${img.isEmpty()} boyut=${JSON.stringify(img.getSize())}`; });
    step('setAppDetails', () => win.setAppDetails({ appId: AUMID, appIconPath: dst, appIconIndex: 0, relaunchCommand: `"${process.execPath}"${!IS_DEV ? '' : ' "' + app.getAppPath() + '"'}`, relaunchDisplayName: 'Cubixora Launcher' }));
    const key = 'HKCU\\Software\\Classes\\AppUserModelId\\' + AUMID;
    for (const [name, val] of [['DisplayName', 'Cubixora Launcher'], ['IconUri', png], ['IconBackgroundColor', '00000000']]) {
      require('child_process').execFile('reg.exe', ['add', key, '/v', name, '/t', 'REG_SZ', '/d', val, '/f'], { windowsHide: true }, (err, so, se) => note(`reg ${name}: ${err ? 'HATA ' + err.message + ' ' + se : 'tamam'}`));
    }
    if (IS_DEV) step('kisayol', () => {
      const dir = path.join(app.getPath('appData'), 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Cubixora Dev');
      fs.mkdirSync(dir, { recursive: true });
      const ok = shell.writeShortcutLink(path.join(dir, 'Cubixora Launcher.lnk'), 'create', { target: process.execPath, args: `"${app.getAppPath()}"`, cwd: app.getAppPath(), description: 'Cubixora Launcher', icon: process.execPath, iconIndex: 0, appUserModelId: AUMID });
      return `${dir} yazildi=${ok}`;
    });
  }
  // mikrofon izni (sesli mesaj / arama)
  win.webContents.session.setPermissionRequestHandler((_wc, perm, cb) => cb(['media', 'audioCapture', 'notifications', 'clipboard-sanitized-write'].includes(perm)));
}

let tray = null, quitting = false, trayHinted = false;
function createTray() {
  try {
    tray = new Tray(nativeImage.createFromPath(path.join(__dirname, 'assets', 'icon-small.png')).resize({ width: 16, height: 16 }));
    tray.setToolTip('Cubixora Launcher');
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: 'Cubixora Launcher\'ı aç', click: showWin },
      { type: 'separator' },
      { label: 'Çevrimiçi', click: () => social.setStatus('online') },
      { label: 'Boşta', click: () => social.setStatus('idle') },
      { label: 'Rahatsız etme', click: () => social.setStatus('dnd') },
      { label: 'Görünmez', click: () => social.setStatus('invisible') },
      { type: 'separator' },
      { label: 'Çıkış', click: () => { quitting = true; app.quit(); } }
    ]));
    tray.on('click', showWin);
  } catch (e) { log(`[tepsi] ${e.message}`); }
}
function showWin() { if (!win) return; if (win.isMinimized()) win.restore(); win.show(); win.focus(); }
function trayHint() {
  if (trayHinted || !Notification.isSupported()) return;
  trayHinted = true;
  new Notification({ title: 'Cubixora arka planda çalışıyor', body: 'Mesajlar ve aramalar gelmeye devam eder. Kapatmak için tepsideki simgeye sağ tıkla.', icon: path.join(__dirname, 'assets', 'icon.png') }).show();
}
function nativeNotify({ title, body, kind }) {
  if (!Notification.isSupported()) return false;
  const n = config.settings.notify || {};
  if (kind === 'message' && n.messages === false) return false;
  if (kind === 'friend' && n.friends === false) return false;
  if (kind === 'call' && n.calls === false) return false;
  if (win && win.isFocused() && kind !== 'call') return false;
  const no = new Notification({ title: String(title || 'Cubixora'), body: String(body || ''), icon: path.join(__dirname, 'assets', 'icon.png'), urgency: kind === 'call' ? 'critical' : 'normal' });
  no.on('click', () => { showWin(); send('notify:click', { kind }); });
  no.show();
  if (win && !win.isFocused()) win.flashFrame(true);
  return true;
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();
else {
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.show(); win.focus(); } });
  try { app.setAppUserModelId(AUMID); } catch {}
  try { app.commandLine.appendSwitch('force-webrtc-ip-handling-policy', 'default_public_interface_only'); } catch {}
  try { app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required'); } catch {}
  app.whenReady().then(() => {
    if (!PREVIEW) setTimeout(() => discord.start(), 4000);
    fs.mkdirSync(MC_ROOT, { recursive: true });
    // bulut öncesi eski yerel/Google oturumu: sosyal özellikler çalışmaz, yeniden giriş istenir
    if (config.account && cloud.enabled() && (config.account.type || 'microsoft') !== 'microsoft' && !config.account.cloud) {
      log('[hesap] eski oturum bulundu, yeniden giriş gerekiyor'); config.account = null; saveConfig();
    }
    // eski sürümden kalan oturum: profilleri o hesaba bağla
    if (config.account && !config.profilesOwner) { switchProfilesTo(accountKey(config.account)); saveConfig(); }
    if (PREVIEW) { config.settings.closeToTray = false; }
    createWindow();
    if (!PREVIEW) createTray();
    if (cloud.isCloudAccount()) win.webContents.once('did-finish-load', () => { startSocial(); setTimeout(() => cloud.pull(), 2500); });
    if (global.__cubixora) global.__cubixora.onUpdateReady((info) => send('app:update', info));
    // Anlık güncelleme: pencere açıkken 30 sn'de bir tek küçük belge sorgulanır; yeni paket varsa hemen indirilir
    if (global.__cubixora && !PREVIEW) {
      let chk = false;
      setInterval(async () => {
        if (chk || !win || win.isDestroyed() || !win.isVisible() || win.isMinimized()) return;
        chk = true;
        try { await global.__cubixora.checkUpdate(); } catch (e) { /* ağ yok: sonra tekrar */ }
        chk = false;
      }, 30 * 1000);
    }
  });
  // kapanırken "çevrimdışı" bilgisi gitsin diye en fazla 1.5 sn beklenir
  let quitDone = false;
  app.on('before-quit', (e) => {
    try { discord.stop(); } catch {}
    quitting = true;
    try { if (previewChild && previewChild.exitCode === null) previewChild.kill(); } catch {}
    if (quitDone) return;
    e.preventDefault(); quitDone = true;
    Promise.race([Promise.resolve().then(() => social.stop()).catch(() => {}), new Promise((r) => setTimeout(r, 1500))]).finally(() => app.quit());
  });
  app.on('window-all-closed', () => app.quit());
  app.on('will-quit', () => globalShortcut.unregisterAll());
}

// ---------------------------------------------------------------- IPC
const handle = (ch, fn) => ipcMain.handle(ch, async (_e, ...args) => {
  try { return { ok: true, data: await fn(...args) }; }
  catch (err) { log(`[hata] ${ch}: ${err && err.stack ? err.stack : err}`); return { ok: false, error: friendlyError(err) }; }
});

function friendlyError(err) {
  const msg = (err && (err.message || err.toString())) || 'Bilinmeyen hata';
  if (/error\.gui\.closed/i.test(msg)) return 'Giriş penceresi kapatıldı.';
  if (/error\.auth\.minecraft\.profile|NOT_FOUND/i.test(msg)) return 'Bu hesapta Minecraft Java Edition bulunamadı.';
  if (/ENOTFOUND|ECONNREFUSED|fetch failed/i.test(msg)) return 'İnternet bağlantısı kurulamadı.';
  return msg;
}

function vlog(m) {
  try {
    const f = path.join(DATA_DIR, 'ses-log.txt');
    try { if (fs.statSync(f).size > 150000) fs.writeFileSync(f, ''); } catch {}
    fs.appendFileSync(f, `[${new Date().toISOString().slice(11, 19)}] ${m}\n`);
  } catch {}
}
// Partner sunucusunda geçen süre: oyundaki mod bağlı olduğu sunucuyu bildirir, partner listesindeyse dakikada 1 sayılır
let partnerSeen = false, partnerAt = 0, partnerHosts = { at: 0, list: [] };
const hostOf = (a) => String(a || '').trim().toLowerCase().replace(/^\[|\]$/g, '').replace(/:\d+$/, '').replace(/\.$/, '');
async function isPartnerHost(h) {
  if (!h) return false;
  if (Date.now() - partnerHosts.at > 5 * 60 * 1000) {
    partnerHosts.at = Date.now();
    try { partnerHosts.list = ((await social.partners()) || []).filter((p) => p.active !== false).map((p) => hostOf(p.ip)).filter(Boolean); } catch {}
  }
  return partnerHosts.list.some((p) => h === p || h.endsWith('.' + p) || p.endsWith('.' + h));
}
function partnerTick(srv) {
  const now = Date.now();
  if (!partnerAt || now - partnerAt > 3 * 60 * 1000) { partnerAt = now; return; }   // ilk görüş / uzun aradan sonra: sayaç baştan
  if (now - partnerAt < 60 * 1000) return;
  partnerAt = now;
  isPartnerHost(hostOf(srv)).then((ok) => { if (ok) { partnerSeen = true; social.track('partner_minutes', 1); } }).catch(() => {});
}
let voiceState = { on: false, at: 0 }, voiceWant = 0, voiceMuteKey = '', voiceDevices = { inputs: [], outputs: [] }, voiceCtlAt = 0, voiceCtlKey = '', voiceCtlSent = 0, voiceThrottleOff = false;
// süreli (görev ödülü) pelerin/kanat süresi dolunca otomatik çıkarılır; oyundaki ve launcher'daki görünüm de güncellenir
setInterval(async () => {
  try {
    if (!config.account || !cloud.isCloudAccount() || !social.timedAll) return;
    const all = social.timedAll(), now = Date.now(), c = getCosmetics();
    const gone = (id) => all[id] != null && all[id] <= now;
    const n = { ...c }; let ch = false;
    if (c.cape && gone(`cape-${c.cape}`)) { n.cape = ''; ch = true; }
    if (c.wings && gone(`wings-${c.wings}`)) { n.wings = ''; ch = true; }
    if (!ch) return;
    await saveCosmetics(n);
    send('social:me', social.summary());
    send('timed:expired', {});
  } catch (e) { log(`[süreli eşya] ${e.message}`); }
}, 5000);
setInterval(() => { if (voiceWant && Date.now() - voiceWant > 4000) { voiceWant = 0; send('voice:want', false); } }, 1500);
ipcMain.on('voice:log', (_e, m) => vlog('[renderer] ' + m));
ipcMain.on('voice:state', (_e, v) => { voiceState = { ...(v || {}), at: Date.now() }; });
ipcMain.on('voice:devices', (_e, d) => { if (d && Array.isArray(d.inputs)) voiceDevices = { inputs: d.inputs.slice(0, 30), outputs: (d.outputs || []).slice(0, 30) }; });
// oyun ses isteği kesilince arka plan kısıtlaması geri açılır (gereksiz CPU harcama)
setInterval(() => { if (voiceThrottleOff && Date.now() - voiceCtlAt > 8000) { voiceThrottleOff = false; try { win && !win.isDestroyed() && win.webContents.setBackgroundThrottling(true); } catch {} } }, 4000);
ipcMain.on('win:minimize', () => win && win.minimize());
ipcMain.on('win:maximize', () => { if (!win) return; win.isMaximized() ? win.unmaximize() : win.maximize(); });
ipcMain.on('win:close', () => win && win.close());

handle('state:get', async () => ({
  build: global.__cubixora ? { build: global.__cubixora.build, source: global.__cubixora.source, rolledBack: global.__cubixora.rolledBack, pending: global.__cubixora.pendingBuild() } : { build: 0, source: 'dev' },
  // başlangıçtaki eski kopya değil, güncel özet (Ctrl+R / yeniden yükleme sonrası coin ve envanter geri sarmasın)
  social: socialReady ? ((await socialReady) ? social.summary() : null) : null,
  account: publicAccount(),
  profiles: config.profiles,
  selectedProfile: config.selectedProfile,
  settings: config.settings,
  gameRunning,
  cloud: { enabled: cloud.enabled(), last: (config.sync && config.sync.last) || null },
  cosmeticVersions: cosmeticVersions(),
  version: app.getVersion()
}));

handle('auth:login', loginMicrosoft);
handle('auth:register', registerLocal);
handle('auth:local', loginLocal);
handle('auth:social', loginSocial);
handle('auth:rename', renameAccount);
handle('auth:logout', async () => {
  if (cloud.isCloudAccount() && config.sync && config.sync.dirty) await cloud.push();
  social.stop(); socialReady = null;
  cloud.forget();
  config.account = null;
  saveConfig();
  return null;
});
handle('auth:reset', async (email) => {
  email = String(email || '').trim().toLowerCase();
  if (!cloud.enabled()) throw new Error('Şifre sıfırlama sadece bulut hesaplarında çalışır.');
  if (!EMAIL_RE.test(email)) throw new Error('Önce e-posta adresini yaz.');
  await cloud.resetPassword(email);
  return true;
});
handle('cosmetics:assets', async () => cosmeticAssets());
handle('cosmetics:get', async () => getCosmetics());
handle('cosmetics:save', saveCosmetics);
handle('cosmetics:refresh', refreshCosmetics);
handle('skin:mojang', async (u, slim) => { await uploadMojangSkin(u, slim); playerSkinCache = null; return true; });
handle('skin:player', playerSkin);

handle('sync:now', async () => {
  if (!cloud.isCloudAccount()) throw new Error('Bu hesapta bulut eşitleme yok.');
  await cloud.push();
  if (config.sync && config.sync.dirty) throw new Error('Buluta kaydedilemedi. İnternet bağlantını kontrol et.');
  return config.sync.last;
});

handle('versions:list', async (showSnapshots) => {
  const m = await getManifest();
  return m.versions
    .filter((v) => v.type === 'release' || (showSnapshots && v.type === 'snapshot'))
    .map((v) => ({ id: v.id, type: v.type }));
});
handle('fabric:loaders', fabricLoaders);

handle('profiles:save', async (profile) => {
  if (!profile.name || !profile.version) throw new Error('Profil adı ve sürüm gerekli.');
  if (profile.id) {
    const i = config.profiles.findIndex((p) => p.id === profile.id);
    if (i === -1) throw new Error('Profil bulunamadı.');
    config.profiles[i] = { ...config.profiles[i], ...profile };
  } else {
    profile.id = crypto.randomUUID();
    profile.created = Date.now();
    config.profiles.push(profile);
    if (!config.selectedProfile) config.selectedProfile = profile.id;
  }
  saveConfig();
  cloud.schedulePush();
  // Cubixora (optimize) profili: performans modları arka planda kurulur
  const saved = findProfile(profile.id);
  if (saved && saved.preset === 'cubixora' && saved.loader === 'fabric' && saved.optimizedFor !== saved.version) runOptimize(saved.id);
  return config.profiles;
});
async function runOptimize(id) {
  const p = findProfile(id); if (!p) return null;
  try {
    const r = await features.optimize(id, (st) => send('content:optimize', { id, ...st }));
    p.optimizedFor = p.version; saveConfig(); cloud.schedulePush();
    send('content:optimize', { id, finished: true, done: r.done, skipped: r.skipped });
    return r;
  } catch (e) { send('content:optimize', { id, finished: true, error: e.message }); return null; }
}
handle('content:optimize', (id) => runOptimize(id));
handle('profiles:delete', async (id, deleteFiles) => {
  const p = findProfile(id);
  config.profiles = config.profiles.filter((x) => x.id !== id);
  if (config.selectedProfile === id) config.selectedProfile = config.profiles[0] ? config.profiles[0].id : null;
  saveConfig();
  if (p && deleteFiles) await fsp.rm(profileDir(p), { recursive: true, force: true });
  cloud.schedulePush();
  return { profiles: config.profiles, selectedProfile: config.selectedProfile };
});
handle('profiles:select', async (id) => { config.selectedProfile = id; saveConfig(); return id; });
handle('profiles:openFolder', async (id) => {
  const p = findProfile(id);
  if (!p) return;
  await fsp.mkdir(profileDir(p), { recursive: true });
  await shell.openPath(profileDir(p));
});

handle('game:launch', launchProfile);
handle('game:cancelLaunch', async () => { if (launchAbort) launchAbort.abort(); return true; });

handle('mods:search', modSearch);
handle('mods:install', async (profileId, projectId) => { const r = await installMod(profileId, projectId); cloud.schedulePush(); return r; });
handle('mods:list', listMods);
handle('mods:toggle', async (profileId, file) => {
  const dir = path.join(profileDir(findProfile(profileId)), 'mods');
  const target = file.endsWith('.disabled') ? file.slice(0, -9) : file + '.disabled';
  await fsp.rename(path.join(dir, file), path.join(dir, target));
  cloud.schedulePush();
  return listMods(profileId);
});
handle('mods:delete', async (profileId, file) => {
  await fsp.rm(path.join(profileDir(findProfile(profileId)), 'mods', file), { force: true });
  cloud.schedulePush();
  return listMods(profileId);
});

handle('settings:save', async (s) => { config.settings = { ...config.settings, ...s }; saveConfig(); if ('discordPresence' in s) discord.refresh(); return config.settings; });
handle('shell:openData', async () => { await shell.openPath(DATA_DIR); });
handle('shell:openUrl', async (url) => {
  let u = String(url || '').trim();
  if (!u) return false;
  if (!/^[a-z]+:\/\//i.test(u)) u = 'https://' + u; // "site.com" yazılmışsa başına https:// eklenir
  if (!/^https?:\/\/[^\s]+$/i.test(u)) return false;
  await shell.openExternal(u);
  return true;
});

// ---------------------------------------------------------------- yeni özellikler (IPC)
handle('auth:setNick', (name) => setNick(name));
handle('auth:removeNick', (name) => removeNick(name));
// Microsoft ile girmiş oyuncu sosyal özellikler (arkadaş, sohbet, mağaza) için bir Cubixora hesabı kurar ya da bağlar.
// Microsoft (premium) bağlantısı ve profilleri yeni hesaba taşınır; oyuna yine gerçek Microsoft oturumuyla girilir.
async function upgradeMicrosoft(kind, data = {}) {
  const a = config.account;
  if (!a || a.type !== 'microsoft') throw new Error('Bu işlem yalnız Microsoft hesabıyla girişte kullanılır.');
  const ms = { name: a.name, uuid: a.uuid, refresh: a.refresh };
  const keep = { profiles: config.profiles || [], selectedProfile: config.selectedProfile || null };
  if (kind === 'google') await loginSocial('google');
  else await registerLocal({ username: ms.name, email: data.email, password: data.password, password2: data.password2 });
  if (!config.account || !config.account.cloud) throw new Error('Hesap bağlanamadı.');
  config.account.msLink = ms;
  if (!(config.profiles || []).length && keep.profiles.length) { config.profiles = keep.profiles; config.selectedProfile = keep.selectedProfile; }
  saveConfig();
  const out = publicAccount();
  send('account', out);
  return out;
}
handle('auth:upgradeMs', upgradeMicrosoft);
handle('auth:linkMs', linkMicrosoft);
handle('auth:unlinkMs', async () => unlinkMicrosoft());

// sosyal / ekonomi: izin verilen fonksiyonlar
const SOCIAL_API = ['summary', 'refreshMe', 'updateProfile', 'getProfile', 'setStatus', 'friends', 'searchUsers', 'sendRequest',
  'acceptRequest', 'declineRequest', 'removeFriend', 'conversations', 'messages', 'openDm', 'sendMessage', 'deleteMessage',
  'createGroup', 'groupAction', 'markRead', 'notifications', 'markNotificationsSeen', 'activityOf', 'achievementView',
  'shop', 'buy', 'redeem', 'partners', 'limits', 'addBetaKey', 'betaInfo', 'presets', 'track', 'signal',
  'adminReports', 'adminDeleteReport', 'adminGet', 'adminSet', 'adminNotify', 'adminDeleteNotification', 'adminUser', 'adminGrant', 'adminTake', 'coinBuy', 'adminRevoke', 'adminBan', 'adminBannedEmails', 'adminBanEmail', 'adminUnbanEmail', 'adminDeleteUser', 'adminSetRoles',
  'news', 'adminNewsList', 'adminNewsSave', 'adminNewsDelete', 'questView', 'claimQuestStep', 'claimQuestReward', 'levelView', 'claimLevel',
  'giveawayView', 'joinGiveaway', 'adminGiveaways', 'adminGiveawaySave', 'adminGiveawayEntries', 'adminGiveawayDraw', 'adminGiveawayDelete',
  'uidOf', 'adminCodes', 'adminSaveCode', 'adminDeleteCode', 'adminBetaKeys', 'adminSaveBetaKey', 'adminDeleteBetaKey', 'adminPublish'];
handle('social:call', async (fn, ...args) => {
  if (!SOCIAL_API.includes(fn)) throw new Error('Bilinmeyen işlem: ' + fn);
  if (!cloud.isCloudAccount()) {
    if (['partners', 'shop', 'limits', 'presets', 'news', 'coinBuy'].includes(fn)) return social[fn](...args);
    throw new Error('Bu özellik için bir Cubixora hesabı gerekli. Arkadaşlar sayfasındaki "Hesap bağla" ile Microsoft hesabını bağlayabilirsin.');
  }
  if (socialReady) await socialReady;
  return social[fn](...args);
});

const CONTENT_API = ['search', 'project', 'list', 'toggle', 'remove', 'readOptions', 'writeOptions', 'importSources'];
handle('content:call', async (fn, ...args) => {
  if (!CONTENT_API.includes(fn)) throw new Error('Bilinmeyen işlem: ' + fn);
  const r = await features[fn](...args);
  if (fn === 'search' && args[0] && args[0].query) social.track('search');
  if (['toggle', 'remove'].includes(fn)) cloud.schedulePush();
  return r;
});
handle('content:install', async (profileId, projectId, type) => {
  const r = await features.install(profileId, projectId, type);
  social.track(type === 'shader' ? 'shader' : type === 'resourcepack' ? 'resourcepack' : 'mod');
  cloud.schedulePush();
  return r;
});
handle('content:addFiles', async (profileId, type) => {
  const T = features.TYPES[type] || features.TYPES.mod;
  const r = await dialog.showOpenDialog(win, {
    title: type === 'mod' ? 'Mod dosyası seç' : type === 'shader' ? 'Shader paketi seç' : 'Doku paketi seç',
    properties: ['openFile', 'multiSelections'],
    filters: [type === 'mod' ? { name: 'Mod (.jar)', extensions: ['jar'] } : { name: 'Paket (.zip)', extensions: ['zip'] }]
  });
  if (r.canceled) return 0;
  const n = await features.addFiles(profileId, type, r.filePaths);
  cloud.schedulePush();
  return n;
});
handle('content:openFolder', async (profileId, type) => {
  const dir = features.folderOf(profileId, type);
  await fsp.mkdir(dir, { recursive: true });
  await shell.openPath(dir);
});
handle('content:import', async (profileId, dir, items) => features.importFrom(profileId, dir, items));


// ---------------------------------------------------------------- sunucu durumu (Minecraft Server List Ping)
// Oyuncu sayısını ve gecikmeyi gösterir. SRV kaydı (_minecraft._tcp) desteklenir; sonuçlar 45 sn önbellekte tutulur.
const pingCache = new Map();
function varint(n) { const out = []; do { let b = n & 0x7f; n >>>= 7; if (n) b |= 0x80; out.push(b); } while (n); return Buffer.from(out); }
function readVarint(buf, off) { let n = 0, shift = 0, b; do { if (off >= buf.length) return null; b = buf[off++]; n |= (b & 0x7f) << shift; shift += 7; } while (b & 0x80 && shift < 35); return [n, off]; }
async function resolveServer(addr) {
  let host = String(addr || '').trim(), port = 25565;
  const m = host.match(/^\[?([^\]]+?)\]?(?::(\d+))?$/); if (m) { host = m[1]; if (m[2]) port = Number(m[2]); }
  if (!m || !m[2]) {
    try { const srv = await require('dns').promises.resolveSrv(`_minecraft._tcp.${host}`); if (srv && srv[0]) return { host: srv[0].name, port: srv[0].port, shown: host }; } catch {}
  }
  return { host, port, shown: host };
}
async function pingServer(addr) {
  const key = String(addr || '').toLowerCase();
  const hit = pingCache.get(key);
  if (hit && Date.now() - hit.at < 45000) return hit.data;
  const { host, port, shown } = await resolveServer(addr);
  const data = await new Promise((resolve) => {
    const net = require('net');
    const sock = net.connect({ host, port });
    let buf = Buffer.alloc(0), t0 = 0, done = false;
    const finish = (r) => { if (done) return; done = true; try { sock.destroy(); } catch {} resolve(r); };
    sock.setTimeout(4000, () => finish({ online: false }));
    sock.on('error', () => finish({ online: false }));
    sock.on('connect', () => {
      const hostB = Buffer.from(shown, 'utf8');
      const portB = Buffer.alloc(2); portB.writeUInt16BE(port);
      const hs = Buffer.concat([varint(0x00), varint(767), varint(hostB.length), hostB, portB, varint(1)]);
      sock.write(Buffer.concat([varint(hs.length), hs]));
      sock.write(Buffer.from([0x01, 0x00]));
      t0 = Date.now();
    });
    sock.on('data', (d) => {
      buf = Buffer.concat([buf, d]);
      const a = readVarint(buf, 0); if (!a) return;
      const [len, o1] = a; if (buf.length < o1 + len) return;
      const b = readVarint(buf, o1); if (!b) return;
      const c = readVarint(buf, b[1]); if (!c) return;
      const json = buf.slice(c[1], c[1] + c[0]).toString('utf8');
      try {
        const j = JSON.parse(json);
        const motd = typeof j.description === 'string' ? j.description : (j.description && (j.description.text || (j.description.extra || []).map((x) => x.text || '').join(''))) || '';
        finish({ online: true, players: (j.players && j.players.online) || 0, max: (j.players && j.players.max) || 0, ping: Date.now() - t0,
          version: (j.version && j.version.name) || '', motd: String(motd).replace(/§./g, '').slice(0, 200) });
      } catch { finish({ online: false }); }
    });
  });
  pingCache.set(key, { at: Date.now(), data });
  return data;
}
handle('server:ping', (addr) => pingServer(addr));

// Oyunu kapat: Java işlemini (ve alt işlemlerini) sonlandırır
handle('game:kill', async () => {
  if (!gameChild || !gameRunning) return false;
  gameKilled = true;
  const pid = gameChild.pid;
  if (process.platform === 'win32' && pid) {
    await new Promise((r) => require('child_process').execFile('taskkill', ['/PID', String(pid), '/T', '/F'], { windowsHide: true }, () => r()));
  } else { try { gameChild.kill('SIGKILL'); } catch {} }
  return true;
});
handle('game:launchServer', async (profileId, server, serverName) => launchProfile(profileId, { server, serverName }));
handle('notify:show', async (n) => nativeNotify(n));
handle('app:restart', async () => { quitting = true; if (global.__cubixora) global.__cubixora.restart(); else { app.relaunch(); app.exit(0); } });
handle('app:checkUpdate', async () => (global.__cubixora ? global.__cubixora.checkUpdate() : null));
handle('app:quit', async () => { quitting = true; app.quit(); });
handle('dialog:image', async ({ maxKB = 300 } = {}) => {
  const r = await dialog.showOpenDialog(win, { title: 'Resim seç', properties: ['openFile'], filters: [{ name: 'Resim', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }] });
  if (r.canceled) return null;
  const f = r.filePaths[0];
  const st = await fsp.stat(f);
  const ext = path.extname(f).slice(1).toLowerCase().replace('jpg', 'jpeg');
  return { dataUrl: `data:image/${ext};base64,` + (await fsp.readFile(f)).toString('base64'), size: st.size, name: path.basename(f), tooBig: st.size > maxKB * 1024 * 8 };
});
handle('dialog:pick', async ({ kind, title }) => {
  const r = await dialog.showOpenDialog(win, kind === 'folder'
    ? { title: title || 'Klasör seç', properties: ['openDirectory'] }
    : { title: title || 'Dosya seç', properties: ['openFile'], filters: [{ name: 'Anahtar', extensions: ['key', 'pem'] }] });
  return r.canceled ? null : r.filePaths[0];
});
handle('storage:clearCache', async () => { await fsp.rm(path.join(DATA_DIR, 'modcache.json'), { force: true }); return true; });
handle('settings:autologinAdd', async (e) => {
  const entry = { server: String(e.server || '').trim().toLowerCase().slice(0, 100), name: String(e.name || '').trim().slice(0, 16), pass: protect(String(e.pass || '')) };
  if (!entry.server || !e.pass) throw new Error('Sunucu adresi ve şifre gerekli.');
  config.settings.autologin = [...(config.settings.autologin || []).filter((x) => !(x.server === entry.server && (x.name || '') === entry.name)), entry].slice(-50);
  saveConfig();
  return config.settings.autologin.map((x) => ({ server: x.server, name: x.name }));
});
handle('settings:autologinRemove', async (i) => {
  config.settings.autologin = (config.settings.autologin || []).filter((_, n) => n !== i);
  saveConfig();
  return config.settings.autologin.map((x) => ({ server: x.server, name: x.name }));
});
handle('settings:autologinList', async () => (config.settings.autologin || []).map((e) => ({ server: e.server, name: e.name, pass: '••••••••' })));
// gelen arama sırasında oyundayken kısayolla aç/kapat
handle('call:hotkeys', async (on) => {
  globalShortcut.unregister('CommandOrControl+Shift+A'); globalShortcut.unregister('CommandOrControl+Shift+D');
  if (on) {
    globalShortcut.register('CommandOrControl+Shift+A', () => send('call:hotkey', 'accept'));
    globalShortcut.register('CommandOrControl+Shift+D', () => send('call:hotkey', 'decline'));
  }
  return true;
});

// ---------------------------------------------------------------- Admin: güncelleme önizlemesi
// "Test et": launcher'ı ayrı bir veri klasöründe, EXE'deki (güncellenmemiş) kodla açar; yani başka bir bilgisayarda
// ilk kez açılmış gibi yayınlanan güncellemeyi indirir, uygular ve oyuncunun göreceği her şeyi gösterir.
let previewChild = null;
handle('app:previewInfo', async () => {
  const g = global.__cubixora || {};
  return { on: !!PREVIEW, build: g.build || 0, embedded: g.embeddedBuild || 0, source: g.source || 'exe', pending: g.pendingBuild ? g.pendingBuild() : null };
});
handle('preview:exit', async () => { if (PREVIEW) setTimeout(() => app.exit(0), 50); return true; });
handle('admin:previewState', async () => !!(previewChild && previewChild.exitCode === null));
handle('admin:previewStart', async (mode) => {
  if (PREVIEW) throw new Error('Önizleme içinden yeni önizleme açılamaz.');
  if (!social.isAdmin()) throw new Error('Bu işlem sadece admin hesabıyla yapılabilir.');
  if (previewChild && previewChild.exitCode === null) throw new Error('Önizleme zaten açık. Önce onu kapat ("Önizlemeden çık").');
  const dir = path.join(path.dirname(DATA_DIR), '.cubixora-onizleme');
  await fsp.rm(dir, { recursive: true, force: true });
  await fsp.mkdir(dir, { recursive: true });
  if (mode === 'account' && config.account) {
    // hesabınla: sadece oturum taşınır; profiller, kozmetikler vb. yeni bilgisayardaki gibi buluttan iner
    await fsp.writeFile(path.join(dir, 'config.json'), JSON.stringify({ account: config.account }, null, 2));
    try { await fsp.copyFile(ACCOUNTS_FILE, path.join(dir, 'accounts.json')); } catch {}
  }
  const env = { ...process.env, CX_PREVIEW_DIR: dir };
  delete env.ELECTRON_RUN_AS_NODE;
  const args = app.isPackaged && !IS_DEV ? [] : [app.getAppPath()];
  const child = require('child_process').spawn(process.execPath, args, { env, stdio: 'ignore', windowsHide: false });
  previewChild = child;
  child.on('exit', () => { send('preview:state', { running: false }); fsp.rm(dir, { recursive: true, force: true }).catch(() => {}); });
  child.on('error', (e) => { log(`[önizleme] ${e.message}`); send('preview:state', { running: false }); });
  send('preview:state', { running: true });
  return true;
});
handle('admin:publishInfo', async () => {
  const d = path.join(app.getPath('desktop'), 'cubixora-launcher');
  const c = config.adminPublish || {};
  return { dir: c.dir || path.join(d, 'src'), keyFile: c.keyFile || path.join(d, 'GIZLI-yayin-anahtari.key'),
    dirOk: fs.existsSync(path.join(c.dir || path.join(d, 'src'), 'main.js')), keyOk: fs.existsSync(c.keyFile || path.join(d, 'GIZLI-yayin-anahtari.key')),
    build: global.__cubixora ? global.__cubixora.build : 0 };
});

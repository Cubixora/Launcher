// Cubixora Launcher - başlatıcı (EXE'nin içindeki sabit kısım)
//
// Launcher'ın asıl kodu (arayüz, özellikler, oyun içi mod dosyaları) bir "paket" olarak gelir.
// Admin yeni bir paket yayınladığında (Admin paneli > Güncelleme yayınla) bu dosya sürüm bilgisini Supabase'den
// (config/app) okur, paketi GitHub Releases'tan indirir, imzasını doğrular ve bir sonraki açılışta onu çalıştırır.
// Böylece yeni EXE dağıtmadan her şey güncellenebilir.
//
// Güvenlik: paketler admin'in bilgisayarındaki gizli anahtarla imzalanır (ed25519). İmzası
// tutmayan paket asla çalıştırılmaz. Yeni paket açılışta çökerse otomatik olarak eskisine dönülür.
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const Module = require('module');

const PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAbMhVcSrL0Sv9bn97HYalOTh6rLyXjZiwaLPzpPZ74iM=
-----END PUBLIC KEY-----`;

// Önizleme modu (Admin > Test et): ayrı bir veri klasörü = "başka bir bilgisayarda ilk açılış" gibi
const PREVIEW_DIR = process.env.CX_PREVIEW_DIR || '';
if (PREVIEW_DIR) { try { app.setPath('userData', path.join(PREVIEW_DIR, 'electron')); } catch {} }
// Geliştirme modunda (1-BASLAT.bat / electron .) her zaman klasördeki kod çalışır; yayınlanmış paketler yalnızca
// kurulu EXE'de ve önizlemede devreye girer. Aksi halde yayınladığın eski paket, klasördeki yeni kodu gizlerdi.
const IS_DEV = !app.isPackaged || /node_modules[\\/]electron[\\/]dist[\\/]/i.test(process.execPath);
const DEV_LOCAL = IS_DEV && !PREVIEW_DIR;
const DATA_DIR = PREVIEW_DIR || path.join(app.getPath('appData'), '.cubixora');
const APP_DIR = path.join(DATA_DIR, 'app');
const STATE_FILE = path.join(APP_DIR, 'state.json');
const EMBEDDED_DIR = __dirname;
let EMBEDDED_BUILD = 0;
try { EMBEDDED_BUILD = JSON.parse(fs.readFileSync(path.join(EMBEDDED_DIR, 'build.json'), 'utf8')).build || 0; } catch {}

// paketlerdeki kod, EXE'deki kütüphaneleri (minecraft-launcher-core, msmc) kullanabilsin
const libDirs = [path.join(app.getAppPath(), 'node_modules'), path.join(path.dirname(EMBEDDED_DIR), 'node_modules')];
process.env.NODE_PATH = [...libDirs, process.env.NODE_PATH].filter(Boolean).join(path.delimiter);
Module._initPaths();

const readState = () => { try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch { return {}; } };
const writeState = (s) => { fs.mkdirSync(APP_DIR, { recursive: true }); fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2)); };

function verify(build, sha256, sig) {
  try {
    return crypto.verify(null, Buffer.from(`cubixora:${build}:${sha256}`), PUBLIC_KEY, Buffer.from(sig, 'base64'));
  } catch { return false; }
}

// hangi kod çalışacak?
function choose() {
  if (DEV_LOCAL) return { build: EMBEDDED_BUILD, dir: EMBEDDED_DIR, source: 'exe' };
  const s = readState();
  s.bad = s.bad || [];
  const dir = s.build && path.join(APP_DIR, `b${s.build}`);
  // Firebase döneminden kalan eski paket (cloud.json'da Supabase yok) asla çalıştırılmaz: kendini güncelleyemez, EXE'deki kod kullanılır
  const modern = (d) => { try { return !!JSON.parse(fs.readFileSync(path.join(d, 'cloud.json'), 'utf8')).supabaseUrl; } catch { return false; } };
  const usable = s.build > EMBEDDED_BUILD && !s.bad.includes(s.build) && dir && fs.existsSync(path.join(dir, 'main.js')) && modern(dir);
  if (!usable) return { build: EMBEDDED_BUILD, dir: EMBEDDED_DIR, source: 'exe' };
  // önceki açılış bu paketle tamamlanamadıysa (çöktüyse) bir kez daha dene, sonra vazgeç
  if (s.starting === s.build) {
    s.fails = (s.fails || 0) + 1;
    if (s.fails >= 2) {
      s.bad.push(s.build); s.starting = null; s.fails = 0; writeState(s);
      return { build: EMBEDDED_BUILD, dir: EMBEDDED_DIR, source: 'exe', rolledBack: true };
    }
  } else s.fails = 0;
  s.starting = s.build;
  writeState(s);
  return { build: s.build, dir, source: 'paket' };
}

let chosen = choose();
let readyListeners = [];
let pendingBuild = null;

const cloudCfg = () => { try { return JSON.parse(fs.readFileSync(path.join(chosen.dir, 'cloud.json'), 'utf8')); } catch { return {}; } };
const cloudOn = () => !!(cloudCfg().supabaseUrl && cloudCfg().supabaseKey);

// sürüm bilgisi: Supabase config/app (herkese açık okuma) -> { build, sha256, sig, url, notes }
async function getManifest() {
  const c = cloudCfg();
  const r = await fetch(`${String(c.supabaseUrl).replace(/\/+$/, '')}/rest/v1/rpc/fs_get`, {
    method: 'POST', headers: { apikey: c.supabaseKey, Authorization: `Bearer ${c.supabaseKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ paths: ['config/app'], omit: [] })
  });
  if (!r.ok) throw new Error(`güncelleme sunucusu ${r.status}`);
  const rows = await r.json();
  return (rows && rows[0] && rows[0].data) || null;
}

// Yeni paket var mı? Varsa indirir, doğrular ve kurar (bir sonraki açılışta çalışır).
let onProgress = null;   // ilk açılış penceresi için (indirilen parça / toplam)
async function checkUpdate() {
  if (DEV_LOCAL || !cloudOn()) return null;
  const f = await getManifest();
  if (!f || !f.url) return null;
  const build = Number(f.build) || 0, sha = f.sha256, sig = f.sig;
  const s = readState();
  if (!build || build <= Math.max(chosen.build, s.build || 0, pendingBuild || 0) || (s.bad || []).includes(build)) return null;
  if (!verify(build, sha, sig)) throw new Error('paket imzası geçersiz, yüklenmedi');
  if (!/^https:\/\/(github\.com|objects\.githubusercontent\.com|[a-z0-9-]+\.supabase\.co)\//.test(f.url)) throw new Error('paket adresi tanınmıyor');
  const r = await fetch(f.url, { redirect: 'follow', headers: { 'User-Agent': 'Cubixora-Launcher' } });
  if (!r.ok || !r.body) throw new Error(`paket indirilemedi (${r.status})`);
  const total = Number(r.headers.get('content-length')) || f.size || 0;
  const parts = []; let got = 0;
  const reader = r.body.getReader();
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    parts.push(Buffer.from(value)); got += value.length;
    if (onProgress && total) { try { onProgress(Math.min(got, total), total); } catch {} }
  }
  const zip = Buffer.concat(parts);
  if (crypto.createHash('sha256').update(zip).digest('hex') !== sha) throw new Error('paket bozuk indi');
  const { extractZip } = require(path.join(EMBEDDED_DIR, 'ziputil.js'));
  const tmp = path.join(APP_DIR, `b${build}.tmp`), dest = path.join(APP_DIR, `b${build}`);
  fs.rmSync(tmp, { recursive: true, force: true });
  extractZip(zip, tmp);
  if (!fs.existsSync(path.join(tmp, 'main.js'))) throw new Error('pakette main.js yok');
  fs.rmSync(dest, { recursive: true, force: true });
  fs.renameSync(tmp, dest);
  const ns = readState();
  ns.build = build; ns.starting = null; ns.fails = 0;
  writeState(ns);
  // eski paketleri temizle (şu an çalışan ve yeni olan kalır)
  for (const d of fs.readdirSync(APP_DIR)) {
    if (/^b\d+$/.test(d) && d !== `b${build}` && d !== path.basename(chosen.dir)) fs.rmSync(path.join(APP_DIR, d), { recursive: true, force: true });
  }
  pendingBuild = build;
  const info = { build, notes: f.notes || '' };
  readyListeners.forEach((fn) => { try { fn(info); } catch {} });
  return info;
}

global.__cubixora = {
  build: chosen.build,
  embeddedBuild: EMBEDDED_BUILD,
  source: chosen.source,
  rolledBack: !!chosen.rolledBack,
  dataDir: DATA_DIR,
  preview: !!PREVIEW_DIR,
  // ana pencere sorunsuz açılınca çağrılır: bu paket "sağlam" sayılır
  ok() { const s = readState(); if (s.starting) { s.starting = null; s.fails = 0; writeState(s); } },
  checkUpdate,
  onUpdateReady(fn) { readyListeners.push(fn); if (pendingBuild) fn({ build: pendingBuild }); },
  pendingBuild: () => pendingBuild,
  restart() { app.relaunch(); app.exit(0); },
  verify
};

function loadMain() {
  global.__cubixora.build = chosen.build; global.__cubixora.source = chosen.source; global.__cubixora.rolledBack = !!chosen.rolledBack;
  try {
    require(path.join(chosen.dir, 'main.js'));
  } catch (e) {
    // paket yüklenemedi: işaretle ve EXE'deki sürümle devam et
    if (chosen.source === 'paket') {
      const s = readState();
      s.bad = [...new Set([...(s.bad || []), chosen.build])]; s.starting = null; writeState(s);
      global.__cubixora.build = EMBEDDED_BUILD; global.__cubixora.source = 'exe'; global.__cubixora.rolledBack = true;
      require(path.join(EMBEDDED_DIR, 'main.js'));
    } else throw e;
  }
}

// İlk açılışta en güncel sürümle başla: eski bir EXE indirilmiş olsa bile oyuncu önce eski sürümü görüp sonra
// "güncelleme var" ile uğraşmasın. Bulutta daha yeni paket varsa launcher açılmadan önce küçük bir pencerede
// indirilir ve doğrudan o çalıştırılır. İnternet yoksa / çok yavaşsa en fazla birkaç saniye beklenir, sonra
// eldeki sürümle açılır (güncelleme her zamanki gibi arka planda iner).
function firstRunWindow() {
  const w = new BrowserWindow({ width: 360, height: 128, frame: false, resizable: false, show: false, backgroundColor: '#0c0c0f', alwaysOnTop: false, skipTaskbar: false, title: 'Cubixora', webPreferences: { sandbox: true, contextIsolation: true } });
  const html = `<!doctype html><html><body style="margin:0;background:#0c0c0f;color:#eee;font:600 13px Segoe UI,system-ui,sans-serif;display:flex;flex-direction:column;justify-content:center;height:100vh;padding:0 26px;box-sizing:border-box;-webkit-app-region:drag">
    <div style="letter-spacing:.2em;font-weight:800;font-size:15px">CUBIXORA</div>
    <div id="t" style="color:#9aa;margin:8px 0 12px;font-weight:500">En güncel sürüm hazırlanıyor...</div>
    <div style="height:5px;border-radius:5px;background:#222;overflow:hidden"><div id="b" style="height:100%;width:6%;background:#fff;border-radius:5px;transition:width .25s"></div></div></body></html>`;
  w.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
  w.once('ready-to-show', () => w.show());
  return w;
}

async function start() {
  if (DEV_LOCAL || !cloudOn()) return loadMain();
  if (!app.requestSingleInstanceLock()) { app.quit(); return; }   // güncelleme beklenirken ikinci tıklama ikinci launcher açmasın
  let win = null, done = false;
  const LIMIT = 25000;                     // indirme sürüyorsa en fazla bu kadar beklenir
  const timer = setTimeout(() => { done = true; }, LIMIT);
  try {
    // önce hızlı bakış: yeni sürüm yoksa pencere hiç açılmaz, gecikme ~0
    const f = await Promise.race([getManifest(), new Promise((r) => setTimeout(() => r(null), 3500))]);
    const cloudBuild = f && f.url ? Number(f.build) || 0 : 0, s = readState();
    if (cloudBuild && cloudBuild > Math.max(chosen.build, s.build || 0) && !(s.bad || []).includes(cloudBuild)) {
      await app.whenReady();
      win = firstRunWindow();
      onProgress = (i, n) => { try { win.webContents.executeJavaScript(`document.getElementById('b').style.width='${Math.round(6 + (i / n) * 94)}%';document.getElementById('t').textContent='Güncel sürüm indiriliyor... ${Math.round((i / n) * 100)}%'`); } catch {} };
      const info = await Promise.race([checkUpdate(), new Promise((r) => { const t = setInterval(() => { if (done) { clearInterval(t); r(null); } }, 200); })]);
      if (info && !done) { chosen = choose(); if (chosen.build === pendingBuild) pendingBuild = null; }   // yeni paketi şimdi çalıştır ("güncelleme hazır, yeniden başlat" çıkmasın)
    }
  } catch (e) { console.log('[ilk güncelleme]', e.message); }
  clearTimeout(timer); onProgress = null;
  loadMain();
  if (win) setTimeout(() => { try { win.close(); } catch {} }, 1200);   // ana pencere açılırken kapanır
}
start();

// açılıştan biraz sonra ve sonra saatte bir güncelleme kontrolü
const tick = () => checkUpdate().catch((e) => console.log('[güncelleme]', e.message));
app.whenReady().then(() => { setTimeout(tick, PREVIEW_DIR ? 3000 : 15000); setInterval(tick, 60 * 60 * 1000); });

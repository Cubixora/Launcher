// Launcher güncellemeleri (Supabase + GitHub Releases).
// Sürüm bilgisi Supabase'deki config/app belgesinde: { build, sha256, sig, url, notes }.
// Paket GitHub'dan indirilir, EXE'deki başlatıcının kilidiyle (ed25519) doğrulanır ve başlatıcının okuduğu
// klasöre (…/.cubixora/app/b<build>) kurulur; bir sonraki açılışta (ya da "Güncellemeyi uygula" ile) çalışır.
// Başlatıcının çökme koruması (state.json: starting/fails/bad) aynen geçerlidir.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

module.exports = function createUpdater({ getManifest, log = () => {} }) {
  const g = global.__cubixora;
  const APP_DIR = path.join(g.dataDir, 'app');
  const STATE = path.join(APP_DIR, 'state.json');
  const readState = () => { try { return JSON.parse(fs.readFileSync(STATE, 'utf8')); } catch { return {}; } };
  const writeState = (s) => { fs.mkdirSync(APP_DIR, { recursive: true }); fs.writeFileSync(STATE, JSON.stringify(s, null, 2)); };
  let pending = null, busy = null;
  const listeners = [];

  async function run() {
    const m = await getManifest();
    if (!m || !m.build || !m.url || !m.sha256 || !m.sig) return null;
    const s = readState();
    if (m.build <= Math.max(g.build || 0, s.build || 0, pending || 0) || (s.bad || []).includes(m.build)) return null;
    if (!g.verify(m.build, m.sha256, m.sig)) throw new Error('paket imzası geçersiz, yüklenmedi');
    if (!/^https:\/\/(github\.com|objects\.githubusercontent\.com|[a-z0-9-]+\.supabase\.co)\//.test(m.url)) throw new Error('paket adresi tanınmıyor');
    const r = await fetch(m.url, { redirect: 'follow', headers: { 'User-Agent': 'Cubixora-Launcher' } });
    if (!r.ok) throw new Error(`paket indirilemedi (${r.status})`);
    const zip = Buffer.from(await r.arrayBuffer());
    if (crypto.createHash('sha256').update(zip).digest('hex') !== m.sha256) throw new Error('paket bozuk indi');
    const { extractZip } = require('./ziputil');
    const tmp = path.join(APP_DIR, `b${m.build}.tmp`), dest = path.join(APP_DIR, `b${m.build}`);
    fs.rmSync(tmp, { recursive: true, force: true });
    extractZip(zip, tmp);
    if (!fs.existsSync(path.join(tmp, 'main.js'))) throw new Error('pakette main.js yok');
    fs.rmSync(dest, { recursive: true, force: true });
    fs.renameSync(tmp, dest);
    const ns = readState();
    ns.build = m.build; ns.starting = null; ns.fails = 0;
    writeState(ns);
    // eski paketleri temizle (şu an çalışan ve yeni olan kalır)
    for (const d of fs.readdirSync(APP_DIR)) {
      if (/^b\d+$/.test(d) && d !== `b${m.build}` && d !== `b${g.build}`) fs.rmSync(path.join(APP_DIR, d), { recursive: true, force: true });
    }
    pending = m.build;
    log(`[güncelleme] #${m.build} indirildi`);
    const info = { build: m.build, notes: m.notes || '' };
    listeners.forEach((fn) => { try { fn(info); } catch {} });
    return info;
  }
  const checkUpdate = () => (busy || (busy = run().finally(() => { busy = null; })));
  return {
    checkUpdate,
    pendingBuild: () => pending,
    onUpdateReady(fn) { listeners.push(fn); if (pending) fn({ build: pending }); }
  };
};

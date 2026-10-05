/* Cubixora Launcher - arayüz (çekirdek) */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ICONS = ['⛏️', '🗡️', '🏹', '🧱', '🌲', '🔥', '💎', '🐉', '🌙', '⚡', '🏰', '🧪'];

const S = { account: null, profiles: [], selectedProfile: null, settings: {}, gameRunning: false, busy: false, versions: null, me: null, social: false };

// ------------------------------------------------------------ yardımcılar
function toast(msg, type = '') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  $('#toasts').appendChild(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 320); }, type === 'error' ? 6500 : 3500);
}
const fmtNum = (n) => n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(n >= 1e4 ? 0 : 1) + 'K' : String(n);
const headUrl = (name, size = 64) => `https://mc-heads.net/avatar/${encodeURIComponent(name || 'MHF_Steve')}/${size}`;
function avatarOf(p, size = 64) {
  if (!p) return headUrl('MHF_Steve', size);
  if (p.avatar) return p.avatar;
  return headUrl(p.mcName || p.name || 'MHF_Steve', size);
}
// profil çerçeveleri: mağazadaki çerçeve renkleri (tek sefer yüklenir, yönetici değiştirince canlı kontrolde yenilenir)
const FRAMES = {};
function setFrames(shop) {
  let changed = false;
  const seen = {};
  for (const it of Object.values(shop || {})) if (it && it.type === 'frame' && it.ref) { seen[it.ref] = it.color || '#ffffff'; if (FRAMES[it.ref] !== seen[it.ref]) changed = true; }
  for (const k of Object.keys(FRAMES)) if (!(k in seen)) { delete FRAMES[k]; changed = true; }
  Object.assign(FRAMES, seen);
  if (changed) paintFrames();
}
const frameColor = (p) => (p && p.frame && FRAMES[p.frame]) || '';
/** ava-wrap için sınıf + stil: çerçeve takılıysa etrafında parlayan halka çizilir */
function avaAttrs(p, cls = 'ava-wrap') { const c = frameColor(p); return c ? `class="${cls} framed" style="--frame:${c}"` : `class="${cls}"`; }
function frameEl(el, p) { if (!el) return; const c = frameColor(p); el.classList.toggle('framed', !!c); if (c) el.style.setProperty('--frame', c); else el.style.removeProperty('--frame'); }
function paintFrames() {
  const me = S.me && S.me.profile;
  frameEl($('#meAvatar') && $('#meAvatar').parentElement, me); frameEl($('#mePopAvatar') && $('#mePopAvatar').parentElement, me);
  if (window.Social && Social.repaint) Social.repaint();
}
let framesAt = 0;
async function loadFrames(force) { if (!force && Date.now() - framesAt < 15000) return; framesAt = Date.now(); try { setFrames(await sc('shop')); } catch (e) { framesAt = 0; } }

// coin satın alma penceresi (metin, bağlantı, açık/kapalı: admin panelinden)
async function openCoinBuy() {
  let c;
  try { c = await sc('coinBuy'); } catch (e) { c = null; }
  if (!c || c.enabled === false) { go('shop'); return; }
  $('#cbTitle').textContent = c.title || 'Coin satın al';
  $('#cbText').textContent = c.text || '';
  $('#cbBtn').textContent = c.button || "Discord'a git";
  $('#cbBal').textContent = fmtNum((S.me && S.me.wallet && S.me.wallet.coins) || 0);
  const w = $('#coinWin');
  w.classList.remove('hidden');
  const close = () => w.classList.add('hidden');
  $('#cbClose').onclick = close;
  w.onclick = (e) => { if (e.target === w) close(); };
  $('#cbShop').onclick = () => { close(); go('shop'); };
  $('#cbGo').classList.toggle('hidden', !c.url);
  $('#cbGo').onclick = () => { if (c.url) cx.openUrl(c.url); };
}

// kırık avatar/görsel -> logo (CSP satır içi onerror'a izin vermediği için tek bir genel dinleyici; data-fb işaretli resimler)
document.addEventListener('error', (e) => { const t = e.target; if (t && t.tagName === 'IMG' && t.hasAttribute('data-fb')) { t.removeAttribute('data-fb'); t.src = '../assets/icon.png'; } }, true);
function setImg(img, url) { img.onerror = () => { img.onerror = null; img.src = '../assets/icon.png'; }; img.src = url; }
const selected = () => S.profiles.find((p) => p.id === S.selectedProfile) || null;
function timeAgo(t) {
  if (!t) return 'Hiç oynanmadı';
  const m = Math.floor((Date.now() - t) / 60000);
  if (m < 1) return 'Az önce';
  if (m < 60) return `${m} dakika önce`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} saat önce`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} gün önce`;
  return new Date(t).toLocaleDateString('tr-TR');
}
const STATUS_TXT = { online: 'Çevrimiçi', idle: 'Boşta', dnd: 'Rahatsız Etme', invisible: 'Görünmez', offline: 'Çevrimdışı' };
function confirmBox(title, text, yes = 'Onayla') {
  return new Promise((res) => {
    $('#cfTitle').textContent = title; $('#cfText').textContent = text; $('#cfYes').textContent = yes;
    $('#confirmWin').classList.remove('hidden');
    const done = (v) => { $('#confirmWin').classList.add('hidden'); $('#cfYes').onclick = $('#cfNo').onclick = null; res(v); };
    $('#cfYes').onclick = () => done(true);
    $('#cfNo').onclick = () => done(false);
  });
}
async function sc(fn, ...args) { return cx.social(fn, ...args); }

// Sosyal özellik gerektiren bir yere Microsoft (bulutsuz) hesapla girilirse hata yerine hesap bağlama penceresi açılır
function needCloud(msg) {
  if (S.account && S.account.type === 'microsoft') { openUpgrade(); return; }
  toast(msg, 'error');
}
function openUpgrade() {
  const w = $('#upWin');
  if (!w) return;
  $('#upForm').classList.add('hidden');
  w.classList.remove('hidden');
  if (w.dataset.bound) return;
  w.dataset.bound = '1';
  const close = () => w.classList.add('hidden');
  const done = async (p) => {
    try {
      S.account = await p;
      const st = await cx.state();
      S.profiles = st.profiles; S.selectedProfile = st.selectedProfile; S.cloud = st.cloud;
      close(); renderAccount(); renderHome(); Social.start();
      toast('Hesabın bağlandı. Arkadaş ekleyebilir, mağazayı kullanabilirsin.', 'success');
    } catch (e) { toast(e.message, 'error'); }
  };
  $('#upClose').onclick = close;
  $('#upMailBtn').onclick = () => { $('#upForm').classList.remove('hidden'); $('#upMail').focus(); };
  $('#upGoogle').onclick = async () => { const b = $('#upGoogle'); b.classList.add('loading'); toast('Giriş tarayıcında açılıyor...'); await done(cx.upgradeMs('google')); b.classList.remove('loading'); };
  $('#upForm').onsubmit = async (e) => {
    e.preventDefault();
    const mail = $('#upMail').value.trim(), p1 = $('#upPass').value, p2 = $('#upPass2').value;
    if (!MAIL_RE.test(mail)) return toast('Geçerli bir e-posta adresi yaz.', 'error');
    if (p1.length < 8) return toast('Şifre en az 8 karakter olmalı.', 'error');
    if (p1 !== p2) return toast('Şifreler birbiriyle aynı değil.', 'error');
    const b = $('#upGo'); b.classList.add('loading');
    await done(cx.upgradeMs('mail', { email: mail, password: p1, password2: p2 }));
    b.classList.remove('loading'); $('#upPass').value = $('#upPass2').value = '';
  };
}

const loaderLabel = (p) => (p.preset === 'cubixora' ? 'Cubixora ⚡' : p.loader === 'fabric' ? 'Fabric' : 'Vanilla');

// ------------------------------------------------------------ rütbe etiketleri
const ROLE_TAGS = { founder: 'Kurucu', partner: 'Partner', plus: 'Cubixora+' };
function roleTags(p) { return ((p && p.roles) || []).filter((r) => ROLE_TAGS[r]).map((r) => `<span class="rtag r-${r}">${ROLE_TAGS[r]}</span>`).join(''); }
function nameCls(p) { const r = (p && p.roles) || []; return r.includes('founder') ? 'n-founder' : r.includes('partner') ? 'n-partner' : r.includes('plus') ? 'n-plus' : ''; }

// ------------------------------------------------------------ kaydedilmemiş değişiklik çubuğu
// [data-track] alanları değişince altta "Değişiklikleri kaydet / Sıfırla" çıkar; kaydetmeden çıkılamaz.
const SaveBar = (() => {
  const hosts = new Set();
  const val = (el) => (el.type === 'checkbox' ? (el.checked ? '1' : '0') : String(el.value));
  const fields = (h) => [...h.querySelectorAll('[data-track]')];
  function mark(h) { fields(h).forEach((el) => (el.dataset.orig = val(el))); update(h); }
  function dirty(h) { return !!h && h.isConnected && fields(h).some((el) => el.dataset.orig !== undefined && val(el) !== el.dataset.orig); }
  function update(h) { const b = h._sbBar; if (b) b.classList.toggle('show', dirty(h)); }
  function watch(h, { save, reset } = {}) {
    if (h._sbBar) h._sbBar.remove();
    h._sb = { save, reset };
    const bar = document.createElement('div');
    bar.className = 'savebar';
    bar.innerHTML = `<span class="sb-txt"><b>Dikkat!</b> Kaydedilmemiş değişikliklerin var.</span><div class="sb-btns"><button class="btn btn-ghost small sb-reset">Sıfırla</button><button class="btn btn-primary small sb-save">Değişiklikleri kaydet</button></div>`;
    h.appendChild(bar); h._sbBar = bar;
    bar.querySelector('.sb-reset').onclick = () => doReset(h);
    bar.querySelector('.sb-save').onclick = () => doSave(h);
    if (!h._sbBound) {
      h._sbBound = true;
      h.addEventListener('input', () => update(h));
      h.addEventListener('change', () => update(h));
      h.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.matches && e.target.matches('input[data-track]') && dirty(h)) { e.preventDefault(); doSave(h); } });
    }
    hosts.add(h);
    mark(h);
  }
  async function doSave(h) {
    const b = h._sbBar.querySelector('.sb-save');
    if (b.disabled) return;
    b.disabled = true; b.classList.add('loading');
    try { const ok = await h._sb.save(); if (ok !== false) mark(h); }
    catch (e) { toast(e.message, 'error'); }
    finally { b.disabled = false; b.classList.remove('loading'); }
  }
  function doReset(h) {
    for (const el of fields(h)) {
      if (el.dataset.orig === undefined) continue;
      if (el.type === 'checkbox') el.checked = el.dataset.orig === '1'; else el.value = el.dataset.orig;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }
    if (h._sb.reset) h._sb.reset();
    update(h);
  }
  /** Kaydedilmemiş değişiklik varsa çubuğu sallar ve true döner (çıkışı engelle). */
  function block(h) {
    const list = h ? [h] : [...hosts];
    const d = list.filter((x) => dirty(x));
    if (!d.length) return false;
    for (const x of d) { const b = x._sbBar; b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake'); }
    return true;
  }
  return { watch, mark, dirty, block, update };
})();

// ------------------------------------------------------------ arka plan küpleri
function startBackground() {
  return; // performans: hareketli arka plan kaldırıldı (sabit koyu arka plan)
  const c = $('#bg'), ctx = c.getContext('2d');
  let w, h, cubes = [], mx = 0, my = 0;
  const resize = () => { w = c.width = innerWidth * devicePixelRatio; h = c.height = innerHeight * devicePixelRatio; };
  resize(); addEventListener('resize', resize);
  addEventListener('mousemove', (e) => { mx = e.clientX / innerWidth - 0.5; my = e.clientY / innerHeight - 0.5; });
  for (let i = 0; i < 34; i++) cubes.push(newCube(true));
  function newCube(initial) {
    const z = Math.random();
    return { x: Math.random(), y: initial ? Math.random() : 1.1, s: 12 + z * 38, z, v: 0.00008 + z * 0.00022, r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.002 };
  }
  function cube(x, y, s, a, alpha) {
    const pts = [];
    for (let i = 0; i < 6; i++) { const ang = a + (Math.PI / 3) * i; pts.push([x + Math.cos(ang) * s, y + Math.sin(ang) * s]); }
    ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
    ctx.fillStyle = `rgba(255,255,255,${alpha * 0.18})`;
    ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(...p) : ctx.moveTo(...p))); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath();
    [0, 2, 4].forEach((i) => { ctx.moveTo(x, y); ctx.lineTo(...pts[i]); });
    ctx.stroke();
  }
  (function frame() {
    // oyun açıkken arka plan animasyonu durur (ekran kartı oyuna kalsın), saniyede bir kontrol edilir
    if (window.CX_SUSPEND) { setTimeout(() => requestAnimationFrame(frame), 1000); return; }
    if (!document.hidden) {
      ctx.clearRect(0, 0, w, h);
      ctx.lineWidth = devicePixelRatio;
      for (const q of cubes) {
        q.y -= q.v; q.r += q.vr;
        if (q.y < -0.1) Object.assign(q, newCube(false));
        cube(q.x * w + mx * 40 * q.z * devicePixelRatio, q.y * h + my * 40 * q.z * devicePixelRatio, q.s * devicePixelRatio, q.r, 0.04 + q.z * 0.1);
      }
    }
    requestAnimationFrame(frame);
  })();
}

function splash() {
  const word = 'CUBIXORA';
  $('#splashWord').innerHTML = [...word].map((ch, i) => `<span style="animation-delay:${0.55 + i * 0.07}s">${ch}</span>`).join('');
  return new Promise((r) => setTimeout(() => { const sp = $('#splash'); sp.classList.add('done'); setTimeout(() => { sp.style.display = 'none'; }, 700); r(); }, S.settings.animations === false ? 200 : 2100));   // söndükten sonra tamamen kaldır: logo parıltısı arka planda sonsuza dek boyanmasın
}

// ------------------------------------------------------------ gezinme
const PAGE_TITLES = { home: 'Ana Sayfa', servers: 'Sunucular', profiles: 'Profiller', content: 'İçerik', cosmetics: 'Kozmetik', shop: 'Mağaza', inventory: 'Envanter', news: 'Haberler', quests: 'Görevler', admin: 'Admin Paneli' };
// kenar çubuğundaki beyaz gösterge: düğmenin o anki boyutuna ve yerine uyar (pencere küçülüp büyüyünce bozulmasın)
let navNow = null;
function placeNav(btn) {
  btn = btn || navNow || $('.nav-item.active');
  if (!btn) return;
  navNow = btn;
  const ind = $('.nav-indicator');
  ind.style.height = btn.offsetHeight + 'px';
  ind.style.transform = `translateY(${btn.offsetTop - 14}px)`;
}
window.addEventListener('resize', () => requestAnimationFrame(() => placeNav()));
let curPage = 'home';
function go(page) {
  if (!PAGE_TITLES[page]) page = 'home';
  curPage = page;
  $$('.nav-item[data-page]').forEach((b) => b.classList.toggle('active', b.dataset.page === page));
  $$('.page').forEach((p) => p.classList.toggle('active', p.dataset.page === page));
  const btn = $(`.nav-item[data-page="${page}"]`);
  placeNav(btn);
  $('#tbPage').textContent = PAGE_TITLES[page];
  if (page === 'home') { Content.renderInstalled(); Social.renderPartners(); }
  if (page === 'profiles') renderProfileGrid();
  if (page === 'servers') Servers.enter();
  if (page === 'content') Content.enter();
  if (page === 'cosmetics') Cosmetics.enter();
  if (page === 'shop') Store.enterShop();
  if (page === 'inventory') Store.enterInventory();
  if (page === 'news') News.enter();
  if (page === 'quests') Quests.enter();
  if (page === 'admin') Admin.enter();
}

// ------------------------------------------------------------ hesap
function renderAccount() {
  const a = S.account;
  $('#login').classList.toggle('hidden', !!a);
  $('#app').classList.toggle('hidden', !a);
  if (!a) return;
  S.social = !!a.cloud;
  const me = S.me && S.me.profile;
  const display = me ? me.displayName : a.name;
  $('#meName').textContent = display;
  $('#mePopName').textContent = display;
  $('#mePopHandle').textContent = me ? `@${me.handle}` : (a.type === 'microsoft' ? 'Microsoft hesabı' : a.email || '');
  const ava = me ? avatarOf({ ...me, mcName: me.mcName || a.name }, 64) : headUrl(a.type === 'microsoft' ? a.uuid : a.name, 64);
  setImg($('#meAvatar'), ava); setImg($('#mePopAvatar'), ava);
  frameEl($('#meAvatar').parentElement, me); frameEl($('#mePopAvatar').parentElement, me);
  if (S.social) loadFrames();
  $('#navAdmin').classList.toggle('hidden', !a.admin);
  $('#spLocked').classList.toggle('hidden', S.social);
  $('#coinPill').classList.toggle('hidden', !S.social);
  const needLink = a.type === 'microsoft' && !S.social;
  $('#linkPill').classList.toggle('hidden', !needLink);
  if (needLink && !S._upAuto) { S._upAuto = true; setTimeout(() => { if (S.account && S.account.type === 'microsoft' && !S.social) openUpgrade(); }, 1800); }   // giriş sonrası bir kez kendiliğinden sor
  $('#bellBtn').classList.toggle('hidden', !S.social);
  $('#statusGrid').classList.toggle('hidden', !S.social);
  $('#mpProfile').classList.toggle('hidden', !S.social);
  renderWallet();
  renderMyStatus();
}
function renderWallet() {
  const w = S.me && S.me.wallet;
  $('#coinCount').textContent = w ? fmtNum(w.coins) : '0';
  const sc2 = $('#shopCoins'); if (sc2) sc2.textContent = w ? w.coins.toLocaleString('tr-TR') : '0';
}
function renderMyStatus() {
  const s = (S.settings && S.settings._status) || (S.me && S.me.status) || 'online';
  for (const id of ['#meDot', '#mePopDot']) $(id).className = `st-dot ${S.social ? s : 'online'}`;
  $$('#statusGrid button').forEach((b) => b.classList.toggle('active', b.dataset.s === s));
}

// ---- giriş / kayıt
const NAME_RE = /^[A-Za-z0-9_]{3,16}$/;
const MAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
function setAuthView(view) {
  $('#authCard').dataset.view = view;
  $$('.auth-tabs button').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
  $$('.auth-view').forEach((f) => f.classList.toggle('active', f.dataset.view === view));
  $$('.fld .input').forEach((i) => i.classList.remove('bad'));
  setTimeout(() => $(view === 'login' ? '#liLogin' : '#rgName').focus(), 120);
}
function fail(input, msg) { input.classList.add('bad'); input.focus(); toast(msg, 'error'); return false; }

async function afterLogin(acc) {
  S.account = acc;
  const st = await cx.state();
  S.profiles = st.profiles; S.selectedProfile = st.selectedProfile; S.cloud = st.cloud;
  renderAccount();
  toast(acc.isNew ? `Hesabın hazır! Hoş geldin.` : `Hoş geldin, ${acc.name}!`, 'success');
  if (!S.profiles.length) await createDefaultProfile();
  renderHome();
  requestAnimationFrame(() => go('home'));
  maybeTour();
  Social.start();
}
function maybeTour() { if (S.account && !S.settings.tourDone) setTimeout(() => { if (!Tour.isActive()) Tour.start(); }, 900); }

async function runAuth(btn, fn) {
  if (btn.classList.contains('loading')) return;
  $$('#login button').forEach((b) => (b.disabled = true));
  btn.disabled = false; btn.classList.add('loading');
  try { await afterLogin(await fn()); }
  catch (e) { toast(e.message, 'error'); }
  finally { btn.classList.remove('loading'); $$('#login button').forEach((b) => (b.disabled = false)); }
}
function submitLogin(e) {
  e.preventDefault();
  const login = $('#liLogin'), pass = $('#liPass');
  if (!login.value.trim()) return fail(login, 'E-posta adresini ya da kullanıcı adını yaz.');
  if (!pass.value) return fail(pass, 'Şifreni yaz.');
  runAuth($('#liBtn'), async () => { const acc = await cx.loginLocal({ login: login.value, password: pass.value }); pass.value = ''; return acc; });
}
function submitRegister(e) {
  e.preventDefault();
  const name = $('#rgName'), mail = $('#rgMail'), p1 = $('#rgPass'), p2 = $('#rgPass2');
  if (!NAME_RE.test(name.value.trim())) return fail(name, 'Kullanıcı adı 3-16 karakter olmalı; sadece harf, rakam ve _ kullan.');
  if (!MAIL_RE.test(mail.value.trim())) return fail(mail, 'Geçerli bir e-posta adresi yaz.');
  const min = S.cloud && S.cloud.enabled ? 8 : 6;
  if (p1.value.length < min) return fail(p1, `Şifre en az ${min} karakter olmalı.`);
  if (p1.value !== p2.value) return fail(p2, 'Şifreler birbiriyle aynı değil.');
  runAuth($('#rgBtn'), async () => {
    const acc = await cx.register({ username: name.value, email: mail.value, password: p1.value, password2: p2.value });
    p1.value = p2.value = ''; acc.isNew = true; return acc;
  });
}
function socialLogin(btn) {
  const provider = btn.dataset.provider;
  if (provider !== 'microsoft') toast('Giriş tarayıcında açılıyor...');
  runAuth(btn, () => (provider === 'microsoft' ? cx.login() : cx.loginSocial(provider)));
}
async function logout() {
  await cx.logout();
  Social.stop();
  S.account = null; S.me = null;
  renderAccount();
  toast('Çıkış yapıldı.');
  setAuthView('login');
}

async function createDefaultProfile() {
  try {
    const versions = await getVersions();
    const latest = versions.find((v) => v.type === 'release');
    S.profiles = await cx.saveProfile({ name: 'En Son Sürüm', icon: '⛏️', version: latest.id, loader: 'vanilla', ram: S.settings.defaultRam });
    const st = await cx.state();
    S.selectedProfile = st.selectedProfile;
  } catch (e) { toast('Sürüm listesi alınamadı: ' + e.message, 'error'); }
}
async function getVersions(force) {
  if (!S.versions || force) S.versions = await cx.versions(!!S.settings.showSnapshots);
  return S.versions;
}

// ------------------------------------------------------------ nickname penceresi
let nickResolve = null;
function askNick() {
  return new Promise((res) => {
    nickResolve = res;
    $('#nickInput').value = '';
    $('#nickCount').textContent = '0/16';
    $('#nickWin').classList.remove('hidden');
    setTimeout(() => $('#nickInput').focus(), 80);
  });
}
function closeNick(v) { $('#nickWin').classList.add('hidden'); if (nickResolve) nickResolve(v); nickResolve = null; }
async function saveNick() {
  const v = $('#nickInput').value.trim();
  if (!NAME_RE.test(v)) { toast('Nickname 3-16 karakter olmalı; sadece harf, rakam ve _ kullan.', 'error'); return; }
  const b = $('#nickSave'); b.classList.add('loading');
  try {
    S.account = await cx.setNick(v);
    renderAccount();
    toast(`Nickname'in "${v}" oldu.`, 'success');
    closeNick(true);
  } catch (e) { toast(e.message, 'error'); }
  finally { b.classList.remove('loading'); }
}

// ------------------------------------------------------------ ana sayfa
function profileCard(p, { actions = false } = {}) {
  const el = document.createElement('div');
  el.className = 'pcard' + (p.id === S.selectedProfile ? ' selected' : '');
  el.dataset.id = p.id;
  el.innerHTML = `
    <div class="picon">${esc(p.icon || '⛏️')}</div>
    <div class="pname">${esc(p.name)}</div>
    <div class="pmeta">${esc(p.version)} <span class="tag ${p.loader === 'fabric' ? 'fabric' : ''}">${loaderLabel(p)}</span></div>
    <div class="pmeta">${esc(timeAgo(p.lastPlayed))} · ${p.ram || S.settings.defaultRam} GB</div>
    ${actions ? `<div class="pactions"><button data-act="play">Oyna</button><button data-act="edit">Düzenle</button><button data-act="folder">Klasör</button><button data-act="del" class="pdel" title="Profili sil">Sil</button></div>` : ''}`;
  return el;
}
function renderHome() { updatePlayButton(); Content.renderInstalled(); }

async function selectProfile(id) {
  S.selectedProfile = id;
  await cx.selectProfile(id);
  $$('.pcard[data-id]').forEach((c) => c.classList.toggle('selected', c.dataset.id === id));
  updatePlayButton();
  Content.renderInstalled();
}
function stepProfile(dir) {
  if (!S.profiles.length) return;
  let i = S.profiles.findIndex((p) => p.id === S.selectedProfile);
  i = (i + dir + S.profiles.length) % S.profiles.length;
  selectProfile(S.profiles[i].id);
}

function renderPicker() {
  const p = selected();
  $('#pickIc').textContent = p ? (p.icon || '⛏️') : '+';
  $('#pickName').textContent = p ? p.name : 'Profil yok';
  $('#pickMeta').textContent = p ? `${loaderLabel(p)} - ${p.version}` : 'Oluşturmak için tıkla';
  $('#pickMenu').innerHTML = '<div class="pick-title">Profil değiştir</div>' + S.profiles.map((x) => `
    <button class="pick-opt ${x.id === S.selectedProfile ? 'on' : ''}" data-id="${esc(x.id)}">
      <span class="pick-ic">${esc(x.icon || '⛏️')}</span>
      <span class="pick-txt"><b>${esc(x.name)}</b><small>${loaderLabel(x)} - ${esc(x.version)}</small></span>
      <svg viewBox="0 0 24 24" class="pick-tick"><path d="M5 12l5 5 9-10" /></svg>
    </button>`).join('') + '<button class="pick-add" data-add="1">+ Profil Ekle</button>';
}
function togglePicker(force) {
  const m = $('#pickMenu');
  const open = force !== undefined ? force : m.classList.contains('hidden');
  if (open && !S.profiles.length) { openProfileModal(); return; }
  m.classList.toggle('hidden', !open);
  $('#pick').classList.toggle('open', open);
}
function updatePlayButton() {
  renderPicker();
  const b = $('#playBtn'), label = $('.play-label', b);
  b.classList.remove('busy', 'running');
  const stop = $('#stopBtn'); if (stop) { stop.parentNode.classList.toggle('prep', !!S.busy && !S.gameRunning); if (!S.busy) stop.classList.remove('wait'); }
  if (S.gameRunning) { b.classList.add('running'); label.textContent = 'OYUNU KAPAT'; }
  else if (S.busy) { b.classList.add('busy'); label.textContent = 'HAZIRLANIYOR'; }
  else label.textContent = 'OYUNU BAŞLAT';
  if (!S.busy && !S.gameRunning) {
    const p = selected();
    $('#playStage').textContent = p ? `${p.name} · Minecraft ${p.version}${p.loader === 'fabric' ? ' · Fabric' : ''}` : 'Önce bir profil oluştur';
  }
}
// Oyun açılırken/açıkken launcher'ın tüm sürekli animasyonları durur: işlemci oyuna kalır
function setSuspend(on) { window.CX_SUSPEND = !!on; try { document.body.classList.toggle('suspended', !!on); } catch {} }
document.addEventListener('visibilitychange', () => { try { document.body.classList.toggle('suspended', document.hidden || !!window.CX_SUSPEND); } catch {} });
// Zayıf bilgisayar algılama: ilk saniyelerde kare süresi uzunsa süreli efektler (parıltı, kenburns, bulanıklık) kapatılır
(function perfGovernor() {
  let n = 0, slow = 0, last = 0;
  function f(t) {
    if (document.hidden) { last = 0; requestAnimationFrame(f); return; }
    if (last) { n++; if (t - last > 26) slow++; }
    last = t;
    if (n < 150) return requestAnimationFrame(f);
    if (slow / n > 0.35) document.body.classList.add('lowfx');
  }
  setTimeout(() => requestAnimationFrame(f), 4000);
})();
function setProgress({ stage, current, total }) {
  $('#playStage').textContent = stage;
  const bar = $('.progress');
  if (!total || total <= 1) { bar.classList.add('indeterminate'); return; }
  bar.classList.remove('indeterminate');
  $('#progressFill').style.width = `${Math.min(100, (current / total) * 100)}%`;
}

async function killGame() {
  if (!(await confirmBox('Oyun kapatılsın mı?', 'Minecraft hemen kapanır. Kaydedilmemiş ilerleme (tek oyunculu dünyada son birkaç saniye) kaybolabilir.', 'Oyunu kapat'))) return;
  try { await cx.killGame(); toast('Oyun kapatıldı.', 'success'); } catch (e) { toast(e.message, 'error'); }
}
// server: { ip, name } partner sunucusuna direkt girmek için
async function play(server) {
  let p = selected();
  if (!p) { openProfileModal(); return; }
  if (S.gameRunning && !server) { killGame(); return; }
  if (S.busy || S.gameRunning) { if (S.gameRunning) toast('Oyun zaten açık. Önce OYUNU KAPAT ile kapat.'); return; }
  if (S.account && S.account.needsNick) {
    const ok = await askNick();
    if (!ok) return;
  }
  if (server && server.version && server.version !== p.version) {
    const match = S.profiles.find((x) => x.version === server.version);
    if (match) { await selectProfile(match.id); p = match; }
  }
  S.busy = true; setSuspend(true); updatePlayButton();
  setProgress({ stage: 'Başlatılıyor...', current: 0, total: 0 });
  try {
    if (server) await cx.launchServer(p.id, server.ip, server.name);
    else await cx.launch(p.id);
    p.lastPlayed = Date.now();
    toast(server ? `${server.name} sunucusuna bağlanılıyor. İyi oyunlar!` : `${p.name} başlatıldı. İyi oyunlar!`, 'success');
  } catch (e) {
    if (e.message === 'NEEDS_NICK') { S.busy = false; updatePlayButton(); if (await askNick()) play(server); return; }
    if (/durduruldu/i.test(e.message)) { toast('Hazırlık durduruldu.'); $('#playStage').textContent = 'Durduruldu'; }
    else { toast(e.message, 'error'); $('#playStage').textContent = 'Başlatılamadı'; }
  } finally {
    S.busy = false; setSuspend(!!S.gameRunning);
    $('.progress').classList.remove('indeterminate');
    $('#progressFill').style.width = '0';
    updatePlayButton();
  }
}
function heroParallax() {
  return; // performans: fare takibi kaldırıldı
  const hero = $('#hero'), bg = $('#heroBg');
  hero.addEventListener('mousemove', (e) => {
    const r = hero.getBoundingClientRect();
    bg.style.translate = `${((e.clientX - r.left) / r.width - 0.5) * -18}px ${((e.clientY - r.top) / r.height - 0.5) * -12}px`;
  });
  hero.addEventListener('mouseleave', () => { bg.style.translate = '0 0'; });
}

// ------------------------------------------------------------ profiller sayfası
function renderProfileGrid() {
  const g = $('#profileGrid');
  g.innerHTML = '';
  S.profiles.forEach((p, i) => {
    const el = profileCard(p, { actions: true });
    el.style.animationDelay = `${i * 0.04}s`;
    el.onclick = (e) => {
      const act = e.target.dataset.act;
      if (act === 'play') { selectProfile(p.id); go('home'); play(); }
      else if (act === 'edit') openProfileModal(p);
      else if (act === 'folder') cx.openProfileFolder(p.id);
      else if (act === 'del') { editing = p; deleteProfileModal(); }
      else selectProfile(p.id);
    };
    g.appendChild(el);
  });
  const add = document.createElement('div');
  add.className = 'pcard add';
  add.innerHTML = '<div><div class="plus">+</div>Yeni profil</div>';
  add.onclick = () => openProfileModal();
  g.appendChild(add);
}

// ------------------------------------------------------------ profil penceresi
let editing = null, pmLoader = 'vanilla', pmIcon = ICONS[0];
async function openProfileModal(p = null, presetLoader = null) {
  editing = p;
  $('#pmTitle').textContent = p ? 'Profili düzenle' : 'Yeni profil';
  $('#pmName').value = p ? p.name : '';
  $('#pmRam').value = p ? (p.ram || S.settings.defaultRam) : S.settings.defaultRam;
  $('#pmRamVal').textContent = `${$('#pmRam').value} GB`;
  $('#pmJvm').value = p ? (p.jvmArgs || '') : '';
  $('#pmFull').checked = p ? !!p.fullscreen : false;
  $('#pmDelete').classList.toggle('hidden', !p);
  pmIcon = p ? (p.icon || ICONS[0]) : ICONS[Math.floor(Math.random() * ICONS.length)];
  $('#pmIcons').innerHTML = ICONS.map((ic) => `<button type="button" class="${ic === pmIcon ? 'active' : ''}">${ic}</button>`).join('');
  setLoader(presetLoader || (p ? (p.preset === 'cubixora' ? 'cubixora' : p.loader) : 'vanilla'), false);
  $('#profileModal').classList.remove('hidden');
  $('#pmName').focus();
  const sel = $('#pmVersion');
  sel.innerHTML = '<option>Yükleniyor...</option>';
  try {
    const versions = await getVersions();
    let betas = [];
    if (S.social) betas = await sc('betaInfo').catch(() => []);
    const betaOpts = betas.flatMap((b) => b.presets.map((pr) => `<option value="${esc(pr.version)}" data-beta="${esc(pr.id)}">★ ${esc(pr.name)} (${esc(pr.version)}${pr.loader === 'fabric' ? ', Fabric' : ''})</option>`)).join('');
    sel.innerHTML = (betaOpts ? `<optgroup label="Beta sürümler">${betaOpts}</optgroup><optgroup label="Minecraft">` : '') +
      versions.map((v) => `<option value="${esc(v.id)}">${esc(v.id)}${v.type === 'snapshot' ? ' (snapshot)' : ''}</option>`).join('') + (betaOpts ? '</optgroup>' : '');
    sel.value = p ? p.version : versions.find((v) => v.type === 'release').id;
    pmAllVersions = null; applyVersionList();
    if (pmLoader === 'fabric') loadFabricVersions(p ? p.loaderVersion : null);
  } catch (e) { sel.innerHTML = '<option>Sürümler alınamadı</option>'; toast(e.message, 'error'); }
}
// Cubixora Client profili: sadece desteklenen sürümler, yükleyici sabit (oyuncu değiştiremez)
const CX_VERSIONS = ['1.21.1', '1.21.4', '1.21.8', '1.21.11', '26.1.2'];
let pmAllVersions = null;
function applyVersionList() {
  const sel = $('#pmVersion');
  if (pmLoader === 'cubixora') {
    if (pmAllVersions === null) pmAllVersions = sel.innerHTML;
    const cur = sel.value;
    sel.innerHTML = CX_VERSIONS.map((v) => `<option value="${v}">${v}</option>`).join('');
    sel.value = CX_VERSIONS.includes(cur) ? cur : '1.21.8';
  } else if (pmAllVersions !== null) {
    const cur = sel.value; sel.innerHTML = pmAllVersions; pmAllVersions = null; sel.value = cur;
  }
  const lv = $('#pmLoaderVer');
  lv.disabled = pmLoader === 'cubixora';
  if (pmLoader === 'cubixora') lv.innerHTML = '<option value="">Cubixora Client · ÖNERİLEN</option>';
}
function setLoader(v, load = true) {
  pmLoader = v;
  applyVersionList();
  $$('#pmLoader button').forEach((b) => b.classList.toggle('active', b.dataset.v === v));
  $('#pmLoaderVerWrap').classList.toggle('hidden', v === 'vanilla');
  $('#pmCxHint').classList.toggle('hidden', v !== 'cubixora');
  if (v === 'fabric' && load) loadFabricVersions();
}
async function loadFabricVersions(current) {
  const sel = $('#pmLoaderVer');
  sel.innerHTML = '<option>Yükleniyor...</option>';
  try {
    const list = await cx.fabricLoaders($('#pmVersion').value);
    if (!list.length) { sel.innerHTML = '<option value="">Bu sürüm Fabric desteklemiyor</option>'; return; }
    sel.innerHTML = `<option value="">Otomatik (en son kararlı)</option>` + list.slice(0, 30).map((l) => `<option value="${esc(l.version)}">${esc(l.version)}${l.stable ? '' : ' (beta)'}</option>`).join('');
    sel.value = current || '';
  } catch { sel.innerHTML = '<option value="">Fabric listesi alınamadı</option>'; }
}
function closeProfileModal() { $('#profileModal').classList.add('hidden'); editing = null; }
async function saveProfileModal() {
  const name = $('#pmName').value.trim();
  if (!name) { toast('Profil adı yazmalısın.', 'error'); $('#pmName').focus(); return; }
  if (pmLoader === 'fabric' && /desteklemiyor|alınamadı/.test($('#pmLoaderVer').selectedOptions[0]?.textContent || '')) { toast('Bu Minecraft sürümü Fabric ile kullanılamıyor.', 'error'); return; }
  const opt = $('#pmVersion').selectedOptions[0];
  const data = {
    ...(editing ? { id: editing.id } : {}),
    name, icon: pmIcon, version: $('#pmVersion').value, loader: pmLoader === 'vanilla' ? 'vanilla' : 'fabric', preset: pmLoader === 'cubixora' ? 'cubixora' : null,
    loaderVersion: pmLoader === 'fabric' ? ($('#pmLoaderVer').value || null) : null,
    ram: Number($('#pmRam').value), jvmArgs: $('#pmJvm').value.trim(), fullscreen: $('#pmFull').checked,
    ...(opt && opt.dataset.beta ? { beta: opt.dataset.beta } : {})
  };
  try {
    S.profiles = await cx.saveProfile(data);
    const st = await cx.state();
    S.selectedProfile = st.selectedProfile;
    if (!editing) await selectProfile(S.profiles[S.profiles.length - 1].id);
    toast(editing ? 'Profil güncellendi.' : 'Profil oluşturuldu.', 'success');
    closeProfileModal();
    refreshViews();
  } catch (e) { toast(e.message, 'error'); }
}
async function deleteProfileModal() {
  if (!editing) return;
  if (!(await confirmBox('Profil silinsin mi?', `"${editing.name}" profili ve içindeki dünyalar, modlar silinecek. Bu geri alınamaz.`, 'Sil'))) return;
  const r = await cx.deleteProfile(editing.id, true);
  editing = null;
  S.profiles = r.profiles; S.selectedProfile = r.selectedProfile;
  toast('Profil silindi.');
  closeProfileModal();
  refreshViews();
}
function refreshViews() {
  renderHome();
  const active = $('.page.active').dataset.page;
  if (active === 'profiles') renderProfileGrid();
  if (active === 'content') Content.enter();
}

// ------------------------------------------------------------ bulut eşitleme olayları
function onSync(ev) {
  if (ev.state === 'profiles') { S.profiles = ev.profiles; S.selectedProfile = ev.selectedProfile; if (S.account) refreshViews(); }
  if (ev.state === 'done' && ev.downloaded) toast(`Buluttan ${ev.downloaded} mod indirildi.`, 'success');
  if (ev.state === 'downloading' && !S.busy && !S.gameRunning) $('#playStage').textContent = `Modlar indiriliyor ${ev.current + 1}/${ev.total}`;
  if (ev.state === 'done' && !S.busy && !S.gameRunning) updatePlayButton();
  if (window.Settings) Settings.onSync(ev);
}
async function saveSetting(patch) {
  S.settings = await cx.saveSettings(patch);
  applyLook();
  return S.settings;
}
// erişilebilirlik ve görünüm
function applyLook() {
  const s = S.settings || {};
  document.body.classList.toggle('no-anim', s.animations === false);
  const a = s.a11y || {};
  document.documentElement.style.fontSize = `${a.fontScale || 100}%`;
  document.body.style.zoom = String((a.fontScale || 100) / 100);
  document.body.classList.toggle('a11y-bold', !!a.bold);
  document.body.classList.toggle('a11y-contrast', !!a.contrast);
  document.body.dataset.cb = a.colorblind || 'off';
  if (S.me && S.me.profile && S.me.profile.color) document.body.dataset.accent = S.me.profile.color; else delete document.body.dataset.accent;
}

// ------------------------------------------------------------ bağlama
function bind() {
  $$('.tb-buttons button').forEach((b) => (b.onclick = () => cx.win[b.dataset.win]()));
  $$('.auth-tabs button, .auth-switch button').forEach((b) => (b.onclick = () => setAuthView(b.dataset.view || b.dataset.go)));
  $('#loginForm').onsubmit = submitLogin;
  $('#registerForm').onsubmit = submitRegister;
  $$('.soc').forEach((b) => (b.onclick = () => socialLogin(b)));
  $$('.pw-eye').forEach((b) => (b.onclick = () => {
    const on = b.classList.toggle('on');
    const inputs = b.closest('form').id === 'registerForm' ? [$('#rgPass'), $('#rgPass2')] : [$('#liPass')];
    inputs.forEach((i) => (i.type = on ? 'text' : 'password'));
  }));
  $$('.fld .input').forEach((i) => i.addEventListener('input', () => i.classList.remove('bad')));
  $$('.nav-item[data-page]').forEach((b) => (b.onclick = () => go(b.dataset.page)));
  $('#navSettings').onclick = () => Settings.open();
  $('#playBtn').onclick = () => play();
  $('#stopBtn').onclick = () => { const b = $('#stopBtn'); if (b.classList.contains('wait')) return; b.classList.add('wait'); $('#playStage').textContent = 'Durduruluyor...'; cx.cancelLaunch().catch(() => {}); };
  $('#pickBtn').onclick = (e) => { e.stopPropagation(); togglePicker(); };
  $('#pickMenu').onclick = (e) => {
    e.stopPropagation();
    const opt = e.target.closest('.pick-opt');
    if (opt) { selectProfile(opt.dataset.id); togglePicker(false); }
    if (e.target.closest('.pick-add')) { togglePicker(false); openProfileModal(); }
  };
  document.addEventListener('click', (e) => {
    togglePicker(false);
    if (!e.target.closest('#mePop, #meBtn')) $('#mePop').classList.add('hidden');
    if (!e.target.closest('#notifPop, #bellBtn')) $('#notifPop').classList.add('hidden');
    if (!e.target.closest('#addPop, #spAdd')) $('#addPop').classList.add('hidden');
  });
  $('#heroFolder').onclick = () => { const p = selected(); if (p) cx.openProfileFolder(p.id); };
  $('#heroEdit').onclick = () => { const p = selected(); if (p) openProfileModal(p); };
  $('#heroLog').onclick = () => Settings.open('log');
  $('#newProfileBtn').onclick = () => openProfileModal();
  $('#coinPill').onclick = () => openCoinBuy();
  $('#shopBuyCoin').onclick = () => openCoinBuy();
  $('#linkPill').onclick = () => openUpgrade();
  $('#meBtn').onclick = (e) => { e.stopPropagation(); $('#mePop').classList.toggle('hidden'); $('#notifPop').classList.add('hidden'); };
  $('#mpSettings').onclick = () => { $('#mePop').classList.add('hidden'); Settings.open(); };
  $('#mpProfile').onclick = () => { $('#mePop').classList.add('hidden'); Profile.open(S.me && S.me.uid); };
  $('#mpLogout').onclick = () => { $('#mePop').classList.add('hidden'); logout(); };
  $$('#statusGrid button').forEach((b) => (b.onclick = async () => {
    S.settings._status = b.dataset.s; renderMyStatus();
    try { await sc('setStatus', b.dataset.s); } catch (e) { toast(e.message, 'error'); }
  }));
  $('#updatePill').onclick = () => cx.restart();

  // nickname
  $('#nickInput').oninput = (e) => { $('#nickCount').textContent = `${e.target.value.length}/16`; };
  $('#nickInput').onkeydown = (e) => { if (e.key === 'Enter') saveNick(); if (e.key === 'Escape') closeNick(false); };
  $('#nickSave').onclick = saveNick;
  $('#nickCancel').onclick = $('#nickClose').onclick = () => closeNick(false);

  // profil penceresi
  $('#pmCancel').onclick = closeProfileModal;
  $('#pmSave').onclick = saveProfileModal;
  $('#pmDelete').onclick = deleteProfileModal;
  $('#profileModal').onclick = (e) => { if (e.target.id === 'profileModal') closeProfileModal(); };
  $('#pmRam').oninput = () => ($('#pmRamVal').textContent = `${$('#pmRam').value} GB`);
  $$('#pmLoader button').forEach((b) => (b.onclick = () => setLoader(b.dataset.v)));
  $('#pmVersion').onchange = () => { if (pmLoader !== 'vanilla') loadFabricVersions(); };
  $('#pmIcons').onclick = (e) => {
    if (e.target.tagName !== 'BUTTON') return;
    pmIcon = e.target.textContent;
    $$('#pmIcons button').forEach((b) => b.classList.toggle('active', b === e.target));
  };
  $('#imgView').onclick = () => $('#imgView').classList.add('hidden');

  addEventListener('keydown', (e) => {
    if (Tour.isActive()) return;
    if (e.key === 'Escape') {
      for (const id of ['#imgView', '#coinWin', '#confirmWin', '#nickWin', '#profileView', '#settingsWin', '#chatWin']) {
        const el = $(id);
        if (el && !el.classList.contains('hidden')) { if (SaveBar.block(id === '#settingsWin' ? $('#swContent') : id === '#profileView' ? $('#pvCard') : id === '#chatWin' ? $('#groupInfo') : null)) return; if (id === '#nickWin') closeNick(false); else if (id === '#confirmWin') $('#cfNo').click(); else el.classList.add('hidden'); return; }
      }
    }
    if (!$('#profileModal').classList.contains('hidden')) {
      if (e.key === 'Escape') closeProfileModal();
      if (e.key === 'Enter' && e.target.tagName === 'INPUT') saveProfileModal();
      return;
    }
    if (!S.account || $('.page.active')?.dataset.page !== 'home' || /INPUT|TEXTAREA/.test(e.target.tagName)) return;
    if (!$('#chatWin').classList.contains('hidden')) return;
    if (e.key === 'ArrowRight') stepProfile(1);
    if (e.key === 'ArrowLeft') stepProfile(-1);
    if (e.key === 'Enter') play();
  });

  cx.on('progress', setProgress);
  cx.on('social:banned', (m) => { try { Social.stop(); } catch {} S.account = null; S.me = null; renderAccount(); setAuthView('login'); toast(m || 'Bu hesap yasaklandı.', 'error'); });
  cx.on('game-state', ({ running, code }) => {
    S.gameRunning = running; setSuspend(!!(running || S.busy));
    updatePlayButton();
    if (!running && code && code !== 0) toast(`Oyun bir hatayla kapandı (kod ${code}). Ayarlar > Günlük bölümüne bak.`, 'error');
    if (!running) renderHome();
  });
  cx.on('account', (a) => { S.account = a; renderAccount(); });
  cx.on('sync', onSync);
  cx.on('app:update', (info) => {
    $('#updatePill').classList.remove('hidden');
    if (S.gameRunning) { toast('Launcher için yeni bir güncelleme hazır. Oyun kapanınca "Güncellemeyi uygula"ya bas.', 'success'); return; }
    toast('Yeni güncelleme geldi · launcher birkaç saniye içinde yenileniyor...', 'success');
    setTimeout(() => { if (!S.gameRunning) cx.restart(); }, 5000);   // oyun açık değilse kendiliğinden uygula
  });
  // şifre sıfırlama cubixora.com'da (hesap siteyle ortak); yeni şifreyle launcher'a da girilir
  $('#forgotBtn').onclick = async () => {
    try { await cx.forgotPassword(); toast('Şifre sıfırlama sayfası tarayıcında açıldı. Yeni şifreni belirleyip buradan giriş yap.', 'success'); }
    catch (e) { toast(e.message, 'error'); }
  };
}
// Önizleme (Admin > Test et): başka bir bilgisayarda açılmış gibi çalışan ayrı pencere; üstte çıkış çubuğu görünür
function mountPreviewBar(info) {
  const st = document.createElement('style');
  st.textContent = '#pvBar{position:fixed;top:8px;left:50%;transform:translateX(-50%);z-index:2147483647;display:flex;align-items:center;gap:10px;padding:5px 6px 5px 14px;border-radius:999px;background:rgba(255,59,107,.96);color:#fff;font:600 12px system-ui,sans-serif;box-shadow:0 8px 28px rgba(255,59,107,.45);max-width:calc(100vw - 280px);white-space:nowrap;-webkit-app-region:no-drag}#pvBar b{letter-spacing:.08em}#pvBar span{opacity:.92;overflow:hidden;text-overflow:ellipsis}#pvBar button{all:unset;cursor:pointer;padding:5px 12px;border-radius:999px;background:#fff;color:#c4143f;font-weight:700;transition:transform .15s}#pvBar button:hover{transform:scale(1.05)}';
  document.head.appendChild(st);
  const el = document.createElement('div'); el.id = 'pvBar';
  el.innerHTML = '<b>ÖNİZLEME</b><span id="pvTxt"></span><button id="pvExit">Önizlemeden çık</button>';
  document.body.appendChild(el);
  $('#pvExit').onclick = () => cx.previewExit();
  const paint = (i) => {
    $('#pvTxt').textContent = i.pending ? `Yeni bilgisayar · güncelleme #${i.pending} indi — "Güncellemeyi uygula"ya bas` : `Yeni bilgisayar · sürüm #${i.build} (${i.source === 'paket' ? 'güncelleme paketi' : 'EXE'}) · güncelleme aranıyor...`;
  };
  paint(info);
  setInterval(() => cx.previewInfo().then((i) => i && paint(i)).catch(() => {}), 2000);
}

window.addEventListener('DOMContentLoaded', async function init() {
  try { await boot(); }
  catch (e) { console.error(e); toast('Başlatma hatası: ' + e.message, 'error'); $('#splash').classList.add('done'); setTimeout(() => { $('#splash').style.display = 'none'; }, 700); }
});

async function boot() {
  const st = await cx.state();
  Object.assign(S, st);
  S.me = st.social || null;
  applyLook();
  try { const pv = await cx.previewInfo(); if (pv && pv.on) mountPreviewBar(pv); } catch {}
  const b = st.build || {};
  $('#buildTag').textContent = b.build ? `#${b.build}` : '';
  $('#buildTag').title = b.source === 'paket' ? `Güncelleme paketi #${b.build}` : `EXE sürümü #${b.build || 0}`;
  if (b.pending) $('#updatePill').classList.remove('hidden');
  $('#swVersion').textContent = `v${st.version} · paket #${b.build || 0}`;
  bind();
  const cloudOn = !!(S.cloud && S.cloud.enabled);
  $('#liLabel').textContent = 'E-posta veya kullanıcı adı';
  if (cloudOn) { $('#rgPass').placeholder = 'En az 8 karakter'; $('#rgSub').textContent = 'Hesabın cubixora.com ile ortak: sitede de aynı bilgilerle giriş yaparsın.'; }
  $('#forgotBtn').classList.toggle('hidden', !cloudOn);
  startBackground();
  heroParallax();
  renderAccount();
  if (S.account && !S.profiles.length) await createDefaultProfile();
  renderHome();
  await splash();
  requestAnimationFrame(() => go('home'));
  if (S.account) { maybeTour(); Social.start(); }
  cx.on('content:optimize', (st) => {
    if (st.finished) {
      if (st.error) toast('Optimizasyon modları kurulamadı: ' + st.error, 'error');
      else toast(`Cubixora optimizasyonu hazır: ${st.done.length} mod kuruldu${st.skipped.length ? `, ${st.skipped.length} tanesi bu sürümde yok` : ''}.`, 'success');
      if (window.Content) Content.renderInstalled();
    } else if (st.label && !S.busy) { $('#playStage').textContent = `Optimize ediliyor: ${st.label} (${st.i + 1}/${st.total})`; }
    else if (!st.label && !S.busy) $('#playStage').textContent = 'Hazır';
  });
  if (b.rolledBack) toast('Son güncelleme açılırken sorun çıktı, önceki sürüme dönüldü.', 'error');
}


// ---------------------------------------------------------------- canlı geri sayım (data-until / data-ends)
function fmtLeft(ms) {
  if (ms <= 0) return 'Süresi doldu';
  const s = Math.floor(ms / 1000), d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  const p2 = (n) => String(n).padStart(2, '0');
  return d > 0 ? `${d}g ${p2(h)}sa ${p2(m)}dk ${p2(x)}sn` : h > 0 ? `${h}sa ${p2(m)}dk ${p2(x)}sn` : `${m}dk ${p2(x)}sn`;
}
setInterval(() => {
  if (document.hidden) return;                 // pencere gizliyken sayaç yazmaya gerek yok
  const now = Date.now();
  const put = (el, t) => { if (el.textContent !== t) el.textContent = t; };   // aynı yazıyı yeniden yazıp stil hesaplatma
  document.querySelectorAll('[data-until]').forEach((el) => {
    const left = Number(el.dataset.until) - now;
    put(el, left > 0 ? `⏳ ${fmtLeft(left)}` : 'Süresi doldu');
    if (left <= 0 && !el.classList.contains('expired')) el.classList.add('expired');
  });
  document.querySelectorAll('[data-ends]').forEach((el) => {
    const left = Number(el.dataset.ends) - now;
    put(el, left > 0 ? `${fmtLeft(left)} kaldı` : 'Süre doldu');
  });
  document.querySelectorAll('[data-left]').forEach((el) => { const left = Number(el.dataset.left) - now; put(el, left > 0 ? fmtLeft(left) : 'birazdan'); });
}, 1000);


// ------------------------------------------------------------ yönetici değişiklikleri canlı yansır
// Mağaza / pelerin ayarı değiştiyse açık sayfa kendiliğinden yenilenir (dakikada bir hafif kontrol; mağaza ayarı 2 dk önbellekte).
(() => {
  let sig = null, busy = false;
  const live = ['shop', 'inventory', 'cosmetics'];
  setInterval(async () => {
    if (busy || document.hidden || !S.account || !live.includes(curPage)) return;
    if (window.Store && Store.previewOpen && Store.previewOpen()) return;
    busy = true;
    try {
      const shopNow = await sc('shop');
      setFrames(shopNow);
      const now = JSON.stringify(shopNow);
      if (sig !== null && now !== sig) {
        if (curPage === 'shop') Store.enterShop(); else if (curPage === 'inventory') Store.enterInventory(); else Cosmetics.enter();
      }
      sig = now;
    } catch (e) { /* ağ yok: sonra tekrar */ }
    busy = false;
  }, 60000);
})();

/* Cubixora - Kozmetik sayfası (Gardrop + Skin) */
(function () {
  const CAPES = [
    { id: 'cubixora', name: 'Cubixora', rarity: 'efsanevi' },
    { id: 'galaksi', name: 'Galaksi', rarity: 'destansi' },
    { id: 'lav', name: 'Lav', rarity: 'destansi' },
    { id: 'gunbatimi', name: 'Gün Batımı', rarity: 'nadir' },
    { id: 'buz', name: 'Buzul', rarity: 'nadir' },
    { id: 'zumrut', name: 'Zümrüt', rarity: 'nadir' }
  ];
  const WINGS = [
    { id: 'ejderha', name: 'Ejderha Kanadı', rarity: 'efsanevi' },
    { id: 'melek', name: 'Melek Kanadı', rarity: 'efsanevi' },
    { id: 'gece', name: 'Gece Kanadı', rarity: 'destansi' }
  ];
  const RARITY = { nadir: 'Nadir', destansi: 'Destansı', efsanevi: 'Efsanevi' };

  let assets = null, viewer = null, C = null, saveTimer = null, ready = false, base = null;

  const status = (t, cls = '') => { const s = $('#cosStatus'); s.textContent = t; s.className = 'cos-status ' + cls; };

  // mağazadaki ürünler (uzaktan eklenenler dahil) ve sahiplik
  let shop = {};
  const ownedItem = (kind, id) => !!((S.me && S.me.inventory) || {})[`${kind}-${id}`];
  function card(item, kind, url) {
    const el = document.createElement('button');
    const own = ownedItem(kind, item.id);
    el.className = `cos-item r-${item.rarity} ${own ? '' : 'locked'}`;
    el.dataset.id = item.id;
    el.dataset.locked = own ? '' : '1';
    if (!own) el.title = item.price ? `${item.price} coin · Mağazadan satın al` : 'Mağazadan satın al';
    const thumb = kind === 'cape'
      ? `<div class="cos-thumb cape" style="background-image:url('${url}')"></div>`
      : `<div class="cos-thumb wings" style="background-image:url('${url}')"></div>`;
    el.innerHTML = `${thumb}<div class="cos-name">${esc(item.name)}</div><span class="cos-rar">${RARITY[item.rarity] || ''}</span><span class="cos-check">✓</span>${own ? '' : `<span class="cos-lock"><svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>${item.price ? `<i class="coin-ic">C</i><b>${Number(item.price).toLocaleString('tr-TR')}</b>` : ''}</span>`}`;
    if (kind === 'cape' && url) { const im = new Image(); im.onload = () => { if (im.width > 64) { const t = el.querySelector('.cos-thumb'); if (t) t.style.imageRendering = 'auto'; } }; im.src = url; }
    return el;
  }

  function noneCard(label) {
    const el = document.createElement('button');
    el.className = 'cos-item none';
    el.dataset.id = '';
    el.innerHTML = `<div class="cos-thumb empty"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" /><path d="M6.5 17.5l11-11" /></svg></div><div class="cos-name">${label}</div><span class="cos-check">✓</span>`;
    return el;
  }

  // şapka / uçan pet / efekt: mağazadaki ürünlerden; sahip olunanlar takılır, olmayanlar kilitli görünür
  const EXTRA = [
    { type: 'hat', key: 'hat', grid: '#gridHats', none: 'Şapka yok' },
    { type: 'fpet', key: 'fly', grid: '#gridFly', none: 'Uçan pet yok' },
    { type: 'effect', key: 'effect', grid: '#gridFx', none: 'Efekt yok' }
  ];
  const hasItem = (id) => !!(((S.me && S.me.inventory) || {})[id] || (shop[id] && shop[id].free));
  function extraCard(id, it) {
    const own = hasItem(id);
    const el = document.createElement('button');
    el.className = `cos-item r-${it.rarity || 'nadir'} ${own ? '' : 'locked'}`;
    el.dataset.id = it.ref; el.dataset.locked = own ? '' : '1';
    if (!own) el.title = it.price ? `${it.price} coin · Mağazadan satın al` : 'Mağazadan satın al';
    // mağazadaki gibi 3B model (ortak WebGL çizici; imleç üstüne gelince yerinde döner, efektte parçacık saçar)
    const kind = it.type === 'hat' ? 'hat' : it.type === 'fpet' ? 'fly' : 'fx';
    el.dataset.pid = id; el.dataset.kind = kind;
    el.innerHTML = `<div class="cos-thumb live3d"></div><div class="cos-name">${esc(it.name)}</div><span class="cos-rar">${RARITY[it.rarity] || ''}</span><span class="cos-check">✓</span>${own ? '' : `<span class="cos-lock"><svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>${it.price ? `<i class="coin-ic">C</i><b>${Number(it.price).toLocaleString('tr-TR')}</b>` : ''}</span>`}`;
    return el;
  }
  // kart görünür olunca 3B modeli kur (görünmeyenler hiç iş yapmaz)
  const live3dIO = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver((list) => {
    for (const en of list) if (en.isIntersecting) { live3dIO.unobserve(en.target); mount3d(en.target); }
  }, { rootMargin: '120px' }) : null;
  function mount3d(el) {
    if (el._pc) return;
    const it = shop[el.dataset.pid]; if (!it) return;
    const host = el.querySelector('.live3d'); if (!host) return;
    const layer = document.createElement('div'); layer.className = 'pv-live on'; host.appendChild(layer);
    try {
      if (el.dataset.kind === 'fx') {
        const sk = (viewer && viewer.skin) || assets.defaultSkin;
        el._pc = new CxPropCard(layer, { skin: sk, slim: !!(viewer && viewer.slim), fx: it.ref }, 'fx', 72, it);
      } else {
        const entry = (assets.props || {})[it.ref];
        if (!entry) { layer.remove(); host.innerHTML = `<img src="${esc(it.icon || (assets.icons || {})[`${it.type}_${it.ref}`] || '../assets/logo-white.png')}" alt="" />`; return; }
        el._pc = new CxPropCard(layer, entry, el.dataset.kind, 84, it);
      }
    } catch { layer.remove(); }
  }
  function buildExtra() {
    for (const x of EXTRA) {
      const g = $(x.grid); if (!g) continue;
      g.innerHTML = '';
      g.appendChild(noneCard(x.none));
      Object.entries(shop).filter(([, it]) => it.type === x.type && it.active !== false && it.ref)
        .sort((a, b) => (a[1].price || 0) - (b[1].price || 0)).forEach(([id, it]) => g.appendChild(extraCard(id, it)));
      g.querySelectorAll('.cos-item[data-pid]').forEach((c) => { if (live3dIO) live3dIO.observe(c); else mount3d(c); });
      g.onmouseover = (e) => { const c = e.target.closest('.cos-item'); if (c && c._pc) c._pc.start(); };
      g.onmouseout = (e) => { const c = e.target.closest('.cos-item'); if (!c || (e.relatedTarget && c.contains(e.relatedTarget))) return; if (c._pc) c._pc.stop(); };
      g.onclick = (e) => {
        const b = e.target.closest('.cos-item'); if (!b) return;
        if (b.dataset.locked === '1') { toast(S.social ? 'Bu eşya sende yok. Mağazadan satın alabilirsin; önizlemede görebilirsin ama oyunda görünmez.' : 'Mağaza için Google ya da e-posta hesabıyla giriş yap.', 'error'); }
        C[x.key] = b.dataset.id; apply();
        if (b.dataset.locked !== '1') save();   // sahip olunmayan yalnız önizlenir, kaydedilmez
      };
    }
  }

  function buildGrids() {
    const gc = $('#gridCapes'), gw = $('#gridWings');
    gc.innerHTML = ''; gw.innerHTML = '';
    gc.appendChild(noneCard('Pelerin yok'));
    gw.appendChild(noneCard('Kanat yok'));
    // EXE'deki dokular + mağazaya sonradan eklenenler
    const capeList = new Map(CAPES.map((c) => [c.id, c])), wingList = new Map(WINGS.map((w) => [w.id, w]));
    for (const [id, it] of Object.entries(shop)) {
      if (it.active === false) continue;
      if (it.type === 'cape') { capeList.set(it.ref, { id: it.ref, name: it.name, rarity: it.rarity || 'nadir', price: it.price, tex: it.texture }); if (it.texture) assets.capes[it.ref] = it.texture; }
      if (it.type === 'wings') { wingList.set(it.ref, { id: it.ref, name: it.name, rarity: it.rarity || 'nadir', price: it.price }); if (it.texture) assets.wings[it.ref] = it.texture; if (it.preview) assets.wingPreviews[it.ref] = it.preview; }
    }
    capeList.forEach((c) => assets.capes[c.id] && gc.appendChild(card(c, 'cape', assets.capes[c.id])));
    wingList.forEach((w) => assets.wings[w.id] && gw.appendChild(card(w, 'wings', (assets.wingPreviews || {})[w.id] || assets.wings[w.id])));
    const lockedClick = (b, kind) => {
      if (b.dataset.locked !== '1') return false;
      if (S.social) toast('Bu kozmetik sende yok. Mağazadan satın alabilirsin; önizlemede deneyebilirsin ama oyunda görünmez.', 'error'); else needCloud('Kozmetikler mağazadan satın alınır. Google ya da e-posta hesabıyla giriş yap.');
      return true;
    };
    buildExtra();
    gc.onclick = (e) => { const b = e.target.closest('.cos-item'); if (!b) return; const lk = lockedClick(b, 'cape'); C.cape = b.dataset.id; apply(); if (!lk) save(); };
    gw.onclick = (e) => { const b = e.target.closest('.cos-item'); if (!b) return; const lk = lockedClick(b, 'wings'); C.wings = b.dataset.id; if (C.wings) C.wingsOpen = true; apply(); if (!lk) save(); };
  }

  function markSelected() {
    $$('#gridCapes .cos-item').forEach((b) => b.classList.toggle('sel', b.dataset.id === (C.cape || '')));
    $$('#gridWings .cos-item').forEach((b) => b.classList.toggle('sel', b.dataset.id === (C.wings || '')));
    for (const x of EXTRA) $$(`${x.grid} .cos-item`).forEach((b) => b.classList.toggle('sel', b.dataset.id === (C[x.key] || '')));
    const petOwned = ownedItem('pet', 'mini');
    $('#petOn').checked = !!C.pet && petOwned;
    $('#petOn').disabled = !petOwned;
    $('#petRow').classList.toggle('locked', !petOwned);
    $('#petLock').classList.toggle('hidden', petOwned);
    $$('#petSide button').forEach((b) => b.classList.toggle('active', b.dataset.v === C.petSide));
    $$('#skinModel button').forEach((b) => b.classList.toggle('active', b.dataset.v === (C.slim ? 'slim' : 'classic')));
    $('#capeWave').value = C.capeWave; $('#capeWaveVal').textContent = Number(C.capeWave).toFixed(1);
    $('#wingSpeed').value = C.wingSpeed; $('#wingSpeedVal').textContent = Number(C.wingSpeed).toFixed(1) + '×';
    $('#wingsOpenDef').checked = C.wingsOpen !== false;
    $('#cosWingToggle').classList.toggle('hidden', !C.wings);
  }

  async function apply({ skinChanged } = {}) {
    // yüklenmiş Cubixora skini > oyuncunun gerçek skini (Microsoft ya da oyundaki varsayılan) > yedek
    const src = C.skin || (base && base.url) || assets.defaultSkin;
    const slim = C.skin ? !!C.slim : !!(base && base.slim);
    if (skinChanged || !viewer.skin) await viewer.setSkin(src, { slim });
    viewer.slim = slim;
    viewer.capeUrl = C.cape ? assets.capes[C.cape] : null;
    viewer.wingsUrl = C.wings ? assets.wings[C.wings] : null;
    viewer.pet = { on: !!C.pet, side: C.petSide };
    viewer.hatEntry = C.hat ? (assets.props || {})[C.hat] : null;
    viewer.flyEntry = C.fly ? (assets.props || {})[C.fly] : null;
    viewer.effect = C.effect || null;
    viewer._build();
    viewer.options.capeWave = Number(C.capeWave);
    viewer.options.wingSpeed = Number(C.wingSpeed);
    markSelected();
  }

  function save() {
    clearTimeout(saveTimer);
    status('Kaydediliyor...');
    saveTimer = setTimeout(async () => {
      try {
        const r = await cx.saveCosmetics(C);
        C = r.cosmetics;
        status(r.cloudSaved ? 'Kaydedildi · bulutta ✓' : 'Kaydedildi ✓', 'ok');
      } catch (e) { status('Kaydedilemedi', 'err'); toast(e.message, 'error'); }
    }, 500);
  }

  function updateHint() {
    const p = selected();
    const vers = S.cosmeticVersions || [];
    const ok = p && vers.includes(p.version);
    $('#cosHint').innerHTML = !vers.length
      ? 'Oyun içi kozmetik modu bu kurulumda bulunamadı. Launcher güncellenince otomatik gelir.'
      : ok
        ? `Oyunda görünecek: <b>${esc(p.name)}</b> (${esc(p.version)}) · Fabric gerekmez · sadece sahip olduğun kozmetikler`
        : `Oyunda görmek için şu sürümlerden biriyle oyna: <b>${esc(vers.join(', '))}</b>`;
    $('#cosHint').classList.toggle('warn', !ok);
    const ms = S.account && S.account.type === 'microsoft';
    $('#msSkinCard').classList.toggle('dim', !ms);
    $('#msSkinBtn').disabled = !ms || !C.skin;
    $('#msSkinText').textContent = ms
      ? 'Microsoft hesabının gerçek skinini de değiştirir; Cubixora kullanmayanlar da görür.'
      : 'Microsoft hesabıyla giriş yaptığında kullanılabilir.';
  }

  async function loadSkinFile(file) {
    if (!file) return;
    if (file.type !== 'image/png') { toast('Skin PNG dosyası olmalı.', 'error'); return; }
    if (file.size > 40 * 1024) { toast('Skin dosyası çok büyük (en fazla 40 KB).', 'error'); return; }
    const url = await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(file); });
    try {
      const n = await CxViewer.normalizeSkin(url);
      C.skin = n.url; C.slim = n.slim;
      await apply({ skinChanged: true });
      toast(`Skin yüklendi${n.slim ? ' (ince kol modeli algılandı)' : ''}.`, 'success');
      save();
    } catch (e) { toast(e.message, 'error'); }
  }

  function bindOnce() {
    viewer = new CxViewer($('#cosViewer'), { scale: 9 });
    buildGrids();
    $$('#cosTabs button').forEach((b) => (b.onclick = () => {
      $$('#cosTabs button').forEach((x) => x.classList.toggle('active', x === b));
      $$('.cos-tab').forEach((t) => t.classList.toggle('active', t.dataset.t === b.dataset.t));
    }));
    $$('#cosAnim button').forEach((b) => (b.onclick = () => {
      $$('#cosAnim button').forEach((x) => x.classList.toggle('active', x === b));
      viewer.setAnimation(b.dataset.a);
    }));
    $('#cosWingToggle').onclick = () => {
      viewer.setWingsOpen(!viewer.wingsOpen);
      $('#cosWingToggle').textContent = viewer.wingsOpen ? 'Kanatları kapat' : 'Kanatları aç';
    };
    $('#petOn').onchange = (e) => {
      if (!ownedItem('pet', 'mini')) { e.target.checked = false; toast('Omuz arkadaşı mağazadan satın alınır.', 'error'); return; }
      C.pet = e.target.checked; apply(); save();
    };
    $('#petLock').onclick = () => go('shop');
    $$('#petSide button').forEach((b) => (b.onclick = () => { if (!ownedItem('pet', 'mini')) return; C.petSide = b.dataset.v; apply(); save(); }));
    $$('#skinModel button').forEach((b) => (b.onclick = () => { C.slim = b.dataset.v === 'slim'; apply({ skinChanged: true }); save(); }));
    $('#capeWave').oninput = (e) => { C.capeWave = Number(e.target.value); viewer.options.capeWave = C.capeWave; $('#capeWaveVal').textContent = C.capeWave.toFixed(1); };
    $('#capeWave').onchange = save;
    $('#wingSpeed').oninput = (e) => { C.wingSpeed = Number(e.target.value); viewer.options.wingSpeed = C.wingSpeed; $('#wingSpeedVal').textContent = C.wingSpeed.toFixed(1) + '×'; };
    $('#wingSpeed').onchange = save;
    $('#wingsOpenDef').onchange = (e) => { C.wingsOpen = e.target.checked; viewer.setWingsOpen(C.wingsOpen); save(); };
    $('#skinFile').onchange = (e) => { loadSkinFile(e.target.files[0]); e.target.value = ''; };
    $('#skinReset').onclick = async () => { C.skin = null; C.slim = false; await apply({ skinChanged: true }); save(); };
    $('#cosRefresh').onclick = async () => {
      const b = $('#cosRefresh'); b.classList.add('loading');
      try { C = await cx.refreshCosmetics(); await apply({ skinChanged: true }); status('Güncel ✓', 'ok'); }
      catch (e) { toast(e.message, 'error'); }
      finally { b.classList.remove('loading'); }
    };
    $('#msSkinBtn').onclick = async () => {
      const b = $('#msSkinBtn'); b.classList.add('loading');
      try { await cx.uploadMojangSkin(C.skin, C.slim); toast('Microsoft hesabının skini değiştirildi.', 'success'); }
      catch (e) { toast(e.message, 'error'); }
      finally { b.classList.remove('loading'); }
    };
  }

  async function enter() {
    try {
      if (!assets) assets = await cx.cosmeticAssets();
      shop = await sc('shop').catch(() => ({}));
      if (!ready) { bindOnce(); ready = true; } else buildGrids();
      C = await cx.getCosmetics();
      base = await cx.playerSkin().catch(() => null);
      viewer.skin = null;
      await apply({ skinChanged: true });
      viewer.setWingsOpen(C.wingsOpen !== false);
      $('#cosWingToggle').textContent = viewer.wingsOpen ? 'Kanatları kapat' : 'Kanatları aç';
      status('');
      updateHint();
    } catch (e) { toast('Kozmetikler yüklenemedi: ' + e.message, 'error'); }
  }

  // oyundaki gardroptan değişiklik gelince sayfa açıksa yenilenir
  cx.on('cosmetics:changed', () => { if (ready && document.querySelector('.page[data-page=cosmetics].active')) enter(); });
  window.Cosmetics = { enter };
})();

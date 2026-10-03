/* Mağaza ve envanter */
const Store = (() => {
  let items = {}, assets = null, shopTab = 'all', invTab = 'all', bound = false;
  const RAR = { yaygin: 'Yaygın', nadir: 'Nadir', destansi: 'Destansı', efsanevi: 'Efsanevi', ozel: 'Özel' };
  const TYPE = { plus: 'Üyelik', cape: 'Pelerin', wings: 'Kanat', pet: 'Omuz arkadaşı', hat: 'Şapka', fpet: 'Uçan pet', effect: 'Efekt', emote: 'Emote', spray: 'Sprey', frame: 'Çerçeve', color: 'Renk paketi', other: 'Diğer' };
  const RC = { plus: '#f5c542', yaygin: '#8b8b95', nadir: '#5aa9ff', destansi: '#b27bff', efsanevi: '#ffb13b', ozel: '#ff5ab8' };
  const DESC = { cape: 'Sırtında dalgalanan bir pelerin. Oyunda Cubixora kullanan herkes görür.', wings: 'Açılıp kapanan kanatlar. Oyunda kısayol tuşuyla (varsayılan K, Cubixora Ayarlarından değişir) açıp kapatabilirsin.',
    hat: 'Başına takılan şapka ya da kask. Oyunda Cubixora kullanan herkes görür.', fpet: 'Arkandan ve yukarından seni takip eden, kanat çırpan küçük bir yoldaş. Oyunda herkes görür.',
    pet: 'Omzunda duran, seni taklit eden küçük bir kopyan. Oyunda herkes görür.', plus: 'Cubixora+ rozeti, saatlik coin ve LP ödülü 2 kat, sohbette altın renkli isim.', emote: 'Oyunda B çarkından kullanılır. Cubixora kullanan herkes anlık görür.', spray: 'Baktığın bloğun yüzüne Cubixora logosunu basar. 10 saniye kalır, 10 saniyede bir kullanılır.', frame: 'Profil resminin etrafında parlayan bir çerçeve.', color: 'Profilinin vurgu rengini değiştirir.', other: '' };
  const typeOf = (it) => (TYPE[it.type] ? it.type : 'other');
  const inv = () => (S.me && S.me.inventory) || {};

  async function load() {
    if (!assets) assets = await cx.cosmeticAssets().catch(() => ({ capes: {}, wings: {}, wingPreviews: {} }));
    items = await sc('shop').catch(() => ({}));
    return items;
  }
  // emoji yerine marka görselleri
  const PLUS_BADGE = '<div class="sh-prev pv-plus"><div class="cxp"><img src="../assets/logo-white.png" alt="" /><b>+</b></div></div>';
  const LOGO_PREV = '<div class="sh-prev pv-logo"><img src="../assets/logo-white.png" alt="" /></div>';
  function preview(id, it) {
    const t = typeOf(it);
    if (t === 'plus' || /^plus-/.test(id)) return PLUS_BADGE;
    if (t === 'cape') { const src = it.texture || (assets.capes || {})[it.ref]; return src ? `<div class="sh-prev pv-cape" data-src="${esc(src)}"><canvas></canvas></div>` : LOGO_PREV; }
    if (t === 'wings') {
      const prev = it.preview || (assets.wingPreviews || {})[it.ref];
      if (prev) return `<div class="sh-prev pv-wings" data-src="${esc(prev)}"><canvas class="wl"></canvas><canvas class="wr"></canvas></div>`;
      const tex = it.texture || (assets.wings || {})[it.ref];
      return tex ? `<div class="sh-prev wings" style="background-image:url('${tex}')"></div>` : LOGO_PREV;
    }
    if ((t === 'hat' || t === 'fpet') && (assets.props || {})[it.ref]) return `<div class="sh-prev pv-prop" data-prop="${esc(it.ref)}" data-kind="${t === 'hat' ? 'hat' : 'fly'}"></div>`;
    const ic = it.icon || (assets.icons || {})[`${t}_${it.ref}`];
    if (ic && (t === 'hat' || t === 'fpet' || it.icon)) return `<div class="sh-prev pv-icon"><img src="${esc(ic)}" alt="" /></div>`;
    if (t === 'pet') return '<div class="sh-prev pv-prop" data-kind="player"></div>';
    if (t === 'effect') return `<div class="sh-prev pv-prop pv-fx" data-kind="fx" data-fx="${esc(it.ref || '')}"></div>`;   // üstüne gelince oyuncunun etrafında parçacıklar   // ejder/şapka kartları gibi 3B, yerinde döner
    if (t === 'frame') return `<div class="sh-prev frame-prev" style="--frame:${esc(it.color || '#fff')}"><span><img src="${esc(avatarOf(S.me && S.me.profile, 64))}" alt="" /></span></div>`;
    if (t === 'spray') return '<div class="sh-prev pv-spray"><img src="../assets/icon.png" alt="" /></div>';
    if (t === 'emote') return '<div class="sh-prev pv-emote"><span>😘</span><i>❤️</i><i>❤️</i><i>❤️</i></div>';
    if (t === 'color') return `<div class="sh-prev"><span class="swatch big" style="background:${esc(it.color)}"></span></div>`;
    return it.image ? `<div class="sh-prev" style="background-image:url('${it.image}')"></div>` : LOGO_PREV;
  }
  function card(id, it, mode) {
    const owned = !!inv()[id];
    const t = typeOf(it);
    let action;
    if (mode === 'shop') action = it.free ? '<button class="btn btn-ghost small" disabled>Ücretsiz · Sende ✓</button>' : owned ? '<button class="btn btn-ghost small" disabled>Sende ✓</button>' : `<button class="btn btn-primary small" data-buy="${esc(id)}"><i class="coin-ic">C</i>${it.price.toLocaleString('tr-TR')}</button>`;
    else if (t === 'plus') action = '<button class="btn btn-ghost small" disabled>Aktif ✓</button>';
    else if (t === 'emote' || t === 'spray') action = `<button class="btn btn-primary small" data-preview="${esc(id)}">Önizle</button>`;
    else action = equipped(id, it) ? '<button class="btn btn-ghost small" data-unequip="' + esc(id) + '">Çıkar</button>' : `<button class="btn btn-primary small" data-equip="${esc(id)}">Tak</button>`;
    return `<div data-id="${esc(id)}" title="Önizlemek için tıkla" class="sh-item r-${esc(it.rarity || 'yaygin')} ${owned && mode === 'shop' ? 'owned' : ''} ${mode === 'inv' && equipped(id, it) ? 'equipped' : ''}">
      ${preview(id, it)}
      <div class="sh-info"><b>${esc(it.name)}</b><small>${TYPE[t]} · <span class="rar">${RAR[it.rarity] || 'Yaygın'}</span></small>${S.me && S.me.timed && S.me.timed[id] ? `<span class="tleft" data-until="${S.me.timed[id]}"></span>` : ''}${it.desc ? `<p>${esc(it.desc)}</p>` : ''}</div>
      ${action}</div>`;
  }
  let cos = null;
  function equipped(id, it) {
    const t = typeOf(it), p = (S.me && S.me.profile) || {};
    if (t === 'cape') return cos && cos.cape === it.ref;
    if (t === 'wings') return cos && cos.wings === it.ref;
    if (t === 'pet') return cos && cos.pet;
    if (t === 'hat') return cos && cos.hat === it.ref;
    if (t === 'fpet') return cos && cos.fly === it.ref;
    if (t === 'effect') return cos && cos.effect === it.ref;
    if (t === 'frame') return p.frame === it.ref;
    if (t === 'color') return p.color === it.ref;
    return false;
  }

  function locked(box) {
    box.innerHTML = '<div class="empty"><div class="empty-ic">🔒</div><h3>Mağaza kapalı</h3><p>Coin kazanmak ve alışveriş yapmak için bir Cubixora hesabı gerekir.</p>' + (S.account && S.account.type === 'microsoft' ? '<button class="btn btn-primary" id="shopLink">Hesap bağla</button>' : '') + '</div>';
    const lb = box.querySelector('#shopLink'); if (lb) lb.onclick = () => needCloud('');
  }

  async function enterShop() {
    bindOnce();
    const box = $('#shopGrid');
    renderWallet();
    if (!S.social) { locked(box); return; }
    box.innerHTML = '<div class="skeleton"></div>'.repeat(3);
    await load();
    renderShop();
  }
  function setShopTab(t) { shopTab = t; $$('#shopTabs button').forEach((b) => b.classList.toggle('active', b.dataset.t === t)); renderShop(); }
  function renderShop() {
    const box = $('#shopGrid');
    const list = Object.entries(items).filter(([, it]) => it.active !== false && !it.questOnly && (shopTab === 'all' || typeOf(it) === shopTab || (shopTab === 'other' && typeOf(it) === 'plus')))
      .sort((a, b) => (a[1].order || 0) - (b[1].order || 0) || a[1].price - b[1].price);
    box.innerHTML = list.length ? list.map(([id, it]) => card(id, it, 'shop')).join('') : '<div class="empty"><h3>Burada henüz ürün yok</h3><p>Yeni ürünler eklendiğinde bu kategoride görünecek.</p></div>';
    hydrate(box);
  }

  // ---------------------------------------------------------- canlı önizlemeler
  const imgCache = {};
  const loadImg = (src) => imgCache[src] || (imgCache[src] = new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = src; }));
  const blitCache = new Map();   // aynı doku parçası bir kez kesilir, sonra hazır kopyadan çizilir (sayfa geçişleri hızlı)
  function blit(cv, img, sx, sy, sw, sh, k, mirror) {
    // yüksek çözünürlüklü dokularda gerçek piksel sayısıyla çiz ki bulanık/kutu kutu görünmesin
    const hd = k > 1.01;
    const m = hd ? Math.min(k, 8) : 1;
    const W = Math.round(sw * m), H = Math.round(sh * m);
    const key = (img.currentSrc || img.src) + '|' + sx + ',' + sy + ',' + sw + ',' + sh + ',' + k + ',' + (mirror ? 1 : 0);
    let src = blitCache.get(key);
    if (!src) {
      src = document.createElement('canvas'); src.width = W; src.height = H;
      const g = src.getContext('2d'); g.imageSmoothingEnabled = hd; if (hd) g.imageSmoothingQuality = 'high';
      if (mirror) { g.translate(W, 0); g.scale(-1, 1); }
      g.drawImage(img, sx * k, sy * k, sw * k, sh * k, 0, 0, W, H);
      if (blitCache.size > 400) blitCache.delete(blitCache.keys().next().value);
      blitCache.set(key, src);
    }
    cv.width = W; cv.height = H;
    cv.style.imageRendering = hd ? 'auto' : '';
    cv.getContext('2d').drawImage(src, 0, 0);
  }
  let skinSrc = null;
  async function mySkin() {
    if (skinSrc) return skinSrc;
    const c = await cx.getCosmetics().catch(() => ({}));
    if (c && c.skin) return (skinSrc = { url: c.skin, slim: !!c.slim });
    const b = await cx.playerSkin().catch(() => null);
    if (b && b.url) return (skinSrc = { url: b.url, slim: !!b.slim });
    return (skinSrc = { url: assets.defaultSkin, slim: false });
  }
  // ---------------------------------------------------------- 3D mini oyuncu (CSS küpleri, WebGL yok)
  // Minecraft skin dokusundan her parçanın 6 yüzü kesilir; böylece gerçek bir insan gibi döner.
  function face(img, k, u, v, w, h, mirror) {
    const c = document.createElement('canvas');
    blit(c, img, u, v, w, h, k, mirror);
    return c;
  }
  // u,v: parçanın dokudaki sol üst köşesi; w,h,d: genişlik, yükseklik, derinlik (piksel)
  function box(img, k, u, v, w, h, d, cls, mirror, grow = 0) {
    const P = 'var(--p)';
    const b = document.createElement('div');
    b.className = 'm-box ' + cls;
    b.style.cssText = `width:calc(${w} * ${P});height:calc(${h} * ${P});`;
    const faces = [
      ['front', u + d, v + d, w, h, `translateZ(calc(${d / 2 + grow} * ${P}))`],
      ['back', u + 2 * d + w, v + d, w, h, `rotateY(180deg) translateZ(calc(${d / 2 + grow} * ${P}))`],
      [mirror ? 'left' : 'right', u, v + d, d, h, `rotateY(-90deg) translateZ(calc(${w / 2 + grow} * ${P}))`],
      [mirror ? 'right' : 'left', u + d + w, v + d, d, h, `rotateY(90deg) translateZ(calc(${w / 2 + grow} * ${P}))`],
      ['top', u + d, v, w, d, `rotateX(90deg) translateZ(calc(${h / 2 + grow} * ${P}))`],
      ['bottom', u + d + w, v, w, d, `rotateX(-90deg) translateZ(calc(${h / 2 + grow} * ${P}))`]
    ];
    for (const [name, fu, fv, fw, fh, tr] of faces) {
      const c = face(img, k, fu, fv, fw, fh, mirror);
      c.className = 'm-face';
      const fwPx = name === 'right' || name === 'left' ? d : w, fhPx = name === 'top' || name === 'bottom' ? d : h;
      c.style.cssText = `width:calc(${fwPx} * ${P});height:calc(${fhPx} * ${P});left:calc(${(w - fwPx) / 2} * ${P});top:calc(${(h - fhPx) / 2} * ${P});transform:${tr} scale(${1 + 0.45 / fwPx}, ${1 + 0.45 / fhPx});`;
      b.appendChild(c);
    }
    return b;
  }
  function buildMini(model, img, k, old, aw) {
    model.innerHTML = '';
    const part = (cls, x, y, ...boxes) => {
      const g = document.createElement('div');
      g.className = 'm-part ' + cls;
      g.style.cssText = `left:calc(${x} * var(--p));top:calc(${y} * var(--p));`;
      boxes.forEach((b) => g.appendChild(b));
      model.appendChild(g);
    };
    const head = box(img, k, 0, 0, 8, 8, 8, 'b-head');
    const hat = box(img, k, 32, 0, 8, 8, 8, 'b-hat', false, 0.5);
    part('p-head', 4, 0, head, hat);
    part('p-body', 4, 8, box(img, k, 16, 16, 8, 12, 4, 'b-body'));
    part('p-ra', 4 - aw, 8, box(img, k, 40, 16, aw, 12, 4, 'b-arm'));
    part('p-la', 12, 8, old ? box(img, k, 40, 16, aw, 12, 4, 'b-arm', true) : box(img, k, 32, 48, aw, 12, 4, 'b-arm'));
    part('p-rl', 4, 20, box(img, k, 0, 16, 4, 12, 4, 'b-leg'));
    part('p-ll', 8, 20, old ? box(img, k, 0, 16, 4, 12, 4, 'b-leg', true) : box(img, k, 16, 48, 4, 12, 4, 'b-leg'));
  }

  async function hydrate(root) {
    for (const el of root.querySelectorAll('.pv-prop')) { if (propIO) propIO.observe(el); else mountProp(el); }
    for (const el of root.querySelectorAll('.pv-cape')) {
      loadImg(el.dataset.src).then((img) => blit(el.querySelector('canvas'), img, 1, 1, 10, 16, img.width / 64)).catch(() => {});
    }
    for (const el of root.querySelectorAll('.pv-wings')) {
      loadImg(el.dataset.src).then((img) => {
        const h = Math.floor(img.width / 2);
        blit(el.querySelector('.wl'), img, 0, 0, h, img.height, 1);
        blit(el.querySelector('.wr'), img, img.width - h, 0, h, img.height, 1);
      }).catch(() => {});
    }
    const minis = root.querySelectorAll('.pv-mini');
    if (!minis.length) return;
    const sk = await mySkin();
    if (!sk.url) return;
    const img = await loadImg(sk.url).catch(() => null);
    if (!img) return;
    const k = img.width / 64, old = img.height * 2 === img.width, aw = sk.slim ? 3 : 4;
    for (const el of minis) buildMini(el.querySelector('.m-model'), img, k, old, aw);
  }
  async function buy(id) {
    const it = items[id]; if (!it) return;
    const coins = (S.me && S.me.wallet.coins) || 0;
    if (coins < it.price) { toast(`Yeterli coinin yok. ${it.price - coins} coin daha gerekiyor. Başarımları tamamlayarak ve launcher'da vakit geçirerek coin kazanırsın.`, 'error'); return; }
    if (!(await confirmBox('Satın alınsın mı?', `${it.name} — ${it.price.toLocaleString('tr-TR')} coin. Bakiyen: ${coins.toLocaleString('tr-TR')} coin.`, 'Satın al'))) return;
    try {
      S.me = await sc('buy', id);
      renderWallet();
      toast(`${it.name} artık senin! Envanterden takabilirsin.`, 'success');
      renderShop();
    } catch (e) { toast(e.message, 'error'); }
  }

  async function enterInventory() {
    bindOnce();
    const box = $('#invGrid');
    if (!S.social) { locked(box); return; }
    box.innerHTML = '<div class="skeleton"></div>'.repeat(3);
    await load();
    cos = await cx.getCosmetics().catch(() => ({}));
    renderInv();
  }
  function renderInv() {
    const box = $('#invGrid');
    const own = inv();
    const list = Object.entries(items).filter(([id, it]) => own[id] && (invTab === 'all' || typeOf(it) === invTab));
    box.innerHTML = list.length ? list.map(([id, it]) => card(id, it, 'inv')).join('') : `<div class="empty"><div class="empty-ic">🎒</div><h3>Envanterin boş</h3><p>Mağazadan aldığın pelerin, kanat, emote, sprey, çerçeve ve diğer ürünler burada görünür. Buradan istediğini takıp çıkarabilirsin.</p><button class="btn btn-primary" id="invToShop">Mağazaya git</button></div>`;
    hydrate(box);
    const b = $('#invToShop'); if (b) b.onclick = () => go('shop');
  }
  async function equip(id, on) {
    const it = items[id]; if (!it) return;
    const t = typeOf(it);
    try {
      if (t === 'cape' || t === 'wings' || t === 'pet' || t === 'hat' || t === 'fpet' || t === 'effect') {
        const c = await cx.getCosmetics();
        if (t === 'hat') c.hat = on ? it.ref : '';
        if (t === 'fpet') c.fly = on ? it.ref : '';
        if (t === 'effect') c.effect = on ? it.ref : '';
        if (t === 'cape') c.cape = on ? it.ref : '';
        if (t === 'wings') { c.wings = on ? it.ref : ''; if (on) c.wingsOpen = true; }
        if (t === 'pet') c.pet = on;
        const r = await cx.saveCosmetics(c);
        cos = r.cosmetics;
      } else if (t === 'frame') S.me = await sc('updateProfile', { frame: on ? it.ref : '' });
      else if (t === 'color') S.me = await sc('updateProfile', { color: on ? it.ref : '' });
      applyLook(); renderAccount();
      toast(on ? `${it.name} takıldı.` : `${it.name} çıkarıldı.`, 'success');
      renderInv();
    } catch (e) { toast(e.message, 'error'); }
  }

  // ---------------------------------------------------------- ürün önizleme penceresi
  let pv = null, pvViewer = null, pvId = null;
  function previewEl() {
    if (pv) return pv;
    pv = document.createElement('div');
    pv.className = 'overlay hidden'; pv.id = 'itemPreview';
    pv.innerHTML = `<div class="ip">
      <button class="icon-btn small ip-close" title="Kapat"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" /></svg></button>
      <div class="ip-stage"><div class="ip-glow"></div><div class="ip-view" id="ipView"></div><div class="ip-prof hidden" id="ipProf"></div>
        <div class="ip-anim seg small" id="ipAnim"><button data-a="wave" class="active">Selam</button><button data-a="walk">Yürü</button><button data-a="idle">Dur</button></div>
        <small class="ip-hint">Sürükleyerek çevirebilirsin</small></div>
      <div class="ip-info" id="ipInfo"></div></div>`;
    document.body.appendChild(pv);
    const close = () => pv.classList.add('hidden');
    pv.querySelector('.ip-close').onclick = close;
    pv.onclick = (e) => { if (e.target === pv) close(); };
    addEventListener('keydown', (e) => { if (e.key === 'Escape' && !pv.classList.contains('hidden')) close(); });
    pv.querySelectorAll('#ipAnim button').forEach((b) => (b.onclick = () => {
      pv.querySelectorAll('#ipAnim button').forEach((x) => x.classList.toggle('active', x === b));
      pvViewer && pvViewer.setAnimation(b.dataset.a);
    }));
    pv.querySelector('#ipInfo').onclick = (e) => {
      const b = e.target.closest('[data-buy]'); if (b) { close(); buy(b.dataset.buy); }
      const q = e.target.closest('[data-equip]'); if (q) { close(); equip(q.dataset.equip, true); }
      const u = e.target.closest('[data-unequip]'); if (u) { close(); equip(u.dataset.unequip, false); }
    };
    return pv;
  }
  // Şapka / kask / uçan pet kartları: eşyanın kendisi 3B görünür, imleç üstüne gelince döner
  function bindProps(grid) {
    const pcOf = (e) => { const h = e.target.closest && e.target.closest('.pv-prop'); const c = e.target.closest && e.target.closest('.sh-item'); return c && c.querySelector('.pv-prop') ? c.querySelector('.pv-prop')._pc : (h && h._pc); };
    grid.addEventListener('mouseover', (e) => { const pc = pcOf(e); if (pc) pc.start(); });
    grid.addEventListener('mouseout', (e) => {
      const c = e.target.closest && e.target.closest('.sh-item'); if (!c) return;
      if (e.relatedTarget && c.contains(e.relatedTarget)) return;
      const h = c.querySelector('.pv-prop'); if (h && h._pc) h._pc.stop();
    });
  }
  const propIO = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver((list) => {
    for (const en of list) if (en.isIntersecting) { propIO.unobserve(en.target); mountProp(en.target); }
  }, { rootMargin: '120px' }) : null;
  const viewOf = (host) => { const c = host.closest('[data-id]'); return (c && items[c.dataset.id]) || null; };   // admin panelindeki kart açısı / yakınlığı
  function mountProp(host) {
    if (host._pc || host._pcWait) return;
    if (host.dataset.kind === 'player' || host.dataset.kind === 'fx') {   // omuz arkadaşı (mini) / efekt (normal oyuncu + parçacık): oyuncunun kendi skiniyle
      host._pcWait = true;
      mySkin().then((sk) => CxViewer.normalizeSkin(sk.url).then((n) => {
        host._pcWait = false;
        if (!host.isConnected || host._pc) return;
        const layer = document.createElement('div'); layer.className = 'pv-live on';
        host.appendChild(layer);
        try { host._pc = new CxPropCard(layer, { skin: n.url, slim: sk.slim, fx: host.dataset.fx || '' }, host.dataset.kind, 88, viewOf(host)); host.classList.add('live'); } catch { layer.remove(); }
      })).catch(() => { host._pcWait = false; });
      return;
    }
    const entry = (assets.props || {})[host.dataset.prop]; if (!entry) return;
    const layer = document.createElement('div'); layer.className = 'pv-live on';
    host.appendChild(layer);
    try { host._pc = new CxPropCard(layer, entry, host.dataset.kind, 88, viewOf(host)); host.classList.add('live'); } catch { layer.remove(); }
  }
  async function openPreview(id) {
    const it = items[id]; if (!it) return;
    const el = previewEl(); pvId = id;
    const t = typeOf(it), three = t === 'cape' || t === 'wings' || t === 'pet' || t === 'emote' || t === 'hat' || t === 'fpet' || t === 'effect';
    const owned = !!inv()[id];
    let act;
    if (it.free) act = owned && !equipped(id, it) ? `<button class="btn btn-primary" data-equip="${esc(id)}">Ücretsiz · Tak</button>` : '<button class="btn btn-ghost" disabled>Ücretsiz · Sende ✓</button>';
    else if (!owned) act = `<button class="btn btn-primary" data-buy="${esc(id)}"><i class="coin-ic">C</i>${it.price.toLocaleString('tr-TR')} · Satın al</button>`;
    else if (t === 'plus') act = '<button class="btn btn-ghost" disabled>Cubixora+ aktif ✓</button>';
    else if (t === 'emote' || t === 'spray') act = '<button class="btn btn-ghost" disabled>Oyunda B çarkından kullan</button>';
    else act = equipped(id, it) ? `<button class="btn btn-ghost" data-unequip="${esc(id)}">Çıkar</button>` : `<button class="btn btn-primary" data-equip="${esc(id)}">Tak</button>`;
    el.querySelector('#ipInfo').innerHTML = `<small class="ip-type">${TYPE[t]}</small><h2>${esc(it.name)}</h2>
      <span class="ip-rar r-${esc(it.rarity || 'yaygin')}">${RAR[it.rarity] || 'Yaygın'}</span>
      <p>${esc(it.desc || DESC[t] || '')}</p>
      ${owned ? '<div class="ip-own">✓ Bu ürün sende</div>' : `<div class="ip-price"><i class="coin-ic big">C</i><b>${it.free ? 'Ücretsiz' : it.price.toLocaleString('tr-TR')}</b></div>`}
      <div class="ip-act">${act}</div>`;
    el.querySelector('.ip').style.setProperty('--rc', RC[it.rarity] || '#8b8b95');
    el.querySelector('#ipView').classList.toggle('hidden', !three);
    el.querySelector('#ipAnim').classList.toggle('hidden', !three || t === 'emote');
    el.querySelector('.ip-hint').classList.toggle('hidden', !three);
    el.querySelector('#ipProf').classList.toggle('hidden', three);
    el.querySelector('.ip-glow').classList.toggle('hidden', !three);
    el.classList.remove('hidden');
    if (three) {
      if (!pvViewer) pvViewer = new CxViewer(el.querySelector('#ipView'), { scale: 10 });
      const sk = await mySkin();
      if (pvId !== id) return;
      await pvViewer.setSkin(sk.url, { slim: sk.slim });
      pvViewer.capeUrl = t === 'cape' ? (it.texture || (assets.capes || {})[it.ref]) : null;
      pvViewer.wingsUrl = t === 'wings' ? (it.texture || (assets.wings || {})[it.ref]) : null;
      pvViewer.pet = { on: t === 'pet', side: 'left' };
      pvViewer.hatEntry = t === 'hat' ? (assets.props || {})[it.ref] : null;
      pvViewer.flyEntry = t === 'fpet' ? (assets.props || {})[it.ref] : null;
      pvViewer.effect = t === 'effect' ? it.ref : null;
      pvViewer.setWingsOpen(true);
      pvViewer.setAnimation(t === 'emote' ? 'kiss' : 'idle');
      pvViewer.S = t === 'hat' ? 13 : t === 'cape' ? 15 : 10;   // pelerinde pelerinin kendisi öne çıkar      // şapka/kask: kafaya yakınlaş
      pvViewer.stage.style.transform = t === 'hat' ? `translateY(${Math.round(12 * 13 * 0.95)}px)` : '';
      pvViewer.yaw = t === 'cape' ? 172 : t === 'wings' || t === 'fpet' ? 155 : t === 'emote' ? -48 : -20; // pelerin/kanat arkadan görünsün
      if (t === 'hat') pvViewer.pitch = -6;
      pvViewer._build();
    } else {
      const p = (S.me && S.me.profile) || {};
      const ava = esc(avatarOf(p, 96));
      const col = t === 'color' ? it.color : '#ffffff', fr = t === 'frame' ? it.color : '';
      if (t === 'spray') el.querySelector('#ipProf').innerHTML = '<div class="ip-spray"><div class="ip-wall"><img src="../assets/icon.png" alt="" /></div><span class="ipp-note">Blok yüzüne böyle basılır</span></div>';
      else el.querySelector('#ipProf').innerHTML = `<div class="ipp" style="--accent:${esc(col)}">
        <div class="ipp-banner"></div>
        <div class="ipp-ava ${fr ? 'framed' : ''}" style="${fr ? `--frame:${esc(fr)}` : ''}"><img src="${ava}" alt="" data-fb /></div>
        <b class="${t === 'plus' ? 'n-plus' : ''}">${esc(p.displayName || (S.account && S.account.name) || 'Oyuncu')}${t === 'plus' ? '<span class="rtag r-plus">Cubixora+</span>' : ''}</b><small>@${esc(p.handle || 'oyuncu')}</small>
        <div class="ipp-bar"><i></i></div><span class="ipp-note">Profilin böyle görünecek</span></div>`;
    }
  }

  function bindOnce() {
    if (bound) return; bound = true;
    bindProps($('#shopGrid')); bindProps($('#invGrid'));
    $$('#shopTabs button').forEach((b) => (b.onclick = () => setShopTab(b.dataset.t)));
    $$('#invTabs button').forEach((b) => (b.onclick = () => { invTab = b.dataset.t; $$('#invTabs button').forEach((x) => x.classList.toggle('active', x === b)); renderInv(); }));
    $('#shopGrid').onclick = (e) => {
      const b = e.target.closest('[data-buy]'); if (b) { buy(b.dataset.buy); return; }
      const c = e.target.closest('.sh-item'); if (c && !e.target.closest('button')) openPreview(c.dataset.id);
    };
    $('#invGrid').onclick = (e) => {
      const pv = e.target.closest('[data-preview]'); if (pv) { openPreview(pv.dataset.preview); return; }
      const b = e.target.closest('[data-equip]'); if (b) equip(b.dataset.equip, true);
      const u = e.target.closest('[data-unequip]'); if (u) equip(u.dataset.unequip, false);
      const c = e.target.closest('.sh-item'); if (c && !e.target.closest('button')) openPreview(c.dataset.id);
    };
  }

  return { previewOpen: () => !!(pv && !pv.classList.contains('hidden')), enterShop, enterInventory, setShopTab, load, hydrate, items: () => items };
})();

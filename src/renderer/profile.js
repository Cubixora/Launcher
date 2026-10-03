/* Profil penceresi: etkinlik, başarımlar, kişiselleştirme (çerçeve, arka plan, renk) */
const Profile = (() => {
  let P = null, tab = 'activity', shopItems = {};
  const DAY = 864e5;
  const ICON = { rocket: '🚀', play: '▶️', cube: '📦', image: '🖼️', sun: '☀️', star: '⭐', 'user-plus': '🤝', users: '👥', message: '💬', messages: '🗨️',
    share: '🧑‍🤝‍🧑', phone: '📞', mic: '🎙️', search: '🔍', check: '✅', list: '📋', chevrons: '⏫', crown: '👑', bag: '🛍️', frame: '🖼️', share2: '🔗',
    clock: '⏰', gif: '🎞️', mic2: '🎤', camera: '📷' };
  const frameStyle = (id) => { const it = shopItems[`frame-${id}`]; return it ? `--frame:${it.color || '#fff'}` : ''; };

  async function open(uid) {
    if (!S.social) { needCloud('Profil için Google ya da e-posta ile giriş yap.'); return; }
    uid = uid || (S.me && S.me.uid);
    $('#pvCard').innerHTML = '<div class="pv-loading">Yükleniyor...</div>';
    $('#profileView').classList.remove('hidden');
    try {
      [P, shopItems] = await Promise.all([sc('getProfile', uid), sc('shop').catch(() => ({}))]);
      P.self = uid === (S.me && S.me.uid);
      tab = 'activity';
      render();
    } catch (e) { $('#pvCard').innerHTML = `<div class="pv-loading">${esc(e.message)}</div>`; }
  }

  function render() {
    const p = P, self = p.self;
    const lvlTo = 50 * (p.level + 1) * p.level, lvlFrom = 50 * p.level * (p.level - 1);
    const pct = Math.round(((p.lp - lvlFrom) / Math.max(1, lvlTo - lvlFrom)) * 100);
    const color = p.color && shopItems[`color-${p.color}`] ? shopItems[`color-${p.color}`].color : '';
    const acc = S.account || {};
    $('#pvCard').innerHTML = `
      <div class="pv-banner" style="${p.bg ? `background-image:url('${p.bg}')` : ''}${color ? `;--accent:${color}` : ''}">${self ? '<button class="pv-banner-edit" id="pvBannerEdit"><svg viewBox="0 0 24 24"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4z" /></svg>Banner\'ı değiştir</button>' : ''}
        <button class="icon-btn small pv-close"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" /></svg></button>
      </div>
      <div class="pv-grid" style="${color ? `--accent:${color}` : ''}">
        <div class="pv-left">
          <div class="pv-ava ${p.frame ? 'framed' : ''}" style="${frameStyle(p.frame)}"><img src="${esc(avatarOf(p, 128))}" alt="" data-fb /><i class="st ${p.status}"></i></div>
          <div class="pv-name">${self ? `<button class="pv-edit" id="pvEditName" title="Görünen adı değiştir (15 günde bir)"><b class="${nameCls(p)}">${esc(p.displayName)}</b><svg viewBox="0 0 24 24"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4z" /></svg></button>` : `<b class="${nameCls(p)}">${esc(p.displayName)}</b>`}</div>
          <div class="pv-handle">${self ? `<button class="pv-edit small" id="pvEditHandle" title="Kullanıcı adını değiştir (30 günde bir)">@${esc(p.handle)}</button>` : `@${esc(p.handle)}`}<span class="badge">Seviye ${p.level}</span>${roleTags(p)}${(p.badges || []).map((b) => `<span class="badge gold">${esc(b)}</span>`).join('')}</div>
          <div class="pv-box"><small>DURUM</small><div><i class="st ${p.status}"></i> ${esc(p.game || STATUS_TXT[p.status] || 'Çevrimdışı')}</div></div>
          <div class="pv-box"><small>DURUM MESAJI</small>${self ? `<textarea class="input pv-status" id="pvStatusMsg" maxlength="160" rows="2" placeholder="Bir durum mesajı yaz... (Enter ile alt satıra geç)" spellcheck="false">${esc(p.statusMsg)}</textarea>` : `<div class="pv-status-txt">${esc(p.statusMsg || '—')}</div>`}</div>
          <div class="pv-box"><small>ŞU TARİHTEN BERİ ÜYE</small><div><b>${esc(new Date(p.created || Date.now()).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' }))}</b></div></div>
          ${p.mcName ? `<div class="pv-box"><small>MINECRAFT</small><div><b>${esc(p.mcName)}</b></div></div>` : ''}
          ${self ? `<div class="pv-sec">BAĞLANTILAR</div>
            <div class="pv-link"><span class="g">G</span><b>${acc.type === 'google' ? 'Google' : 'Cubixora (e-posta)'}</b><em>✓</em></div>
            <div class="pv-link"><span class="m">▦</span><b>Microsoft${acc.msLink ? ` · ${esc(acc.msLink.name)}` : ''}</b><em>${acc.msLink ? '✓' : '—'}</em></div>` : ''}
          <div class="pv-stats"><div><small>SEVİYE</small><b>${p.level}</b><span>${p.lp} LP</span><div class="lvl-bar"><i style="width:${pct}%"></i></div></div><div><small>GÖREVLER</small><b id="pvTasks">–</b><span>Tamamlandı</span></div></div>
          ${!self ? actionButtons(p) : ''}
        </div>
        <div class="pv-right">
          <div class="pv-tabs">
            <button data-t="activity" class="${tab === 'activity' ? 'active' : ''}">Etkinlik</button>
            <button data-t="achievements" class="${tab === 'achievements' ? 'active' : ''}">Başarımlar</button>
            ${self ? `<button data-t="custom" class="${tab === 'custom' ? 'active' : ''}">Profili Kişiselleştir</button>` : ''}
          </div>
          <div class="pv-tab-body" id="pvBody"><div class="muted">Yükleniyor...</div></div>
        </div>
      </div>`;
    const card = $('#pvCard');
    $('.pv-close', card).onclick = () => { if (SaveBar.block(card)) return; $('#profileView').classList.add('hidden'); };
    $$('.pv-tabs button', card).forEach((b) => (b.onclick = () => { tab = b.dataset.t; $$('.pv-tabs button', card).forEach((x) => x.classList.toggle('active', x === b)); renderTab(); }));
    if (self) {
      $('#pvBannerEdit').onclick = async () => {
        const lim = await sc('limits').catch(() => ({ bgMaxKB: 280 }));
        uploadBanner(lim, async (patch, msg) => { try { S.me = await sc('updateProfile', patch); Object.assign(P, patch); toast(msg, 'success'); render(); } catch (e) { toast(e.message, 'error'); } });
      };
      // ad / kullanıcı adı / durum mesajı: yerinde düzenlenir, alttaki çubukla kaydedilir
      const inline = (btnId, field, cur, max, lastAt, days, label, prefix) => {
        const b = $('#' + btnId);
        b.onclick = () => {
          const next = (lastAt || 0) + days * DAY;
          if (Date.now() < next) { toast(`${label} ${Math.ceil((next - Date.now()) / DAY)} gün sonra değiştirilebilir (${days} günde bir).`, 'error'); return; }
          const w = document.createElement('div');
          w.className = 'pv-inline' + (prefix ? ' handle' : '');
          w.innerHTML = `${prefix ? '<span>@</span>' : ''}<input class="input" data-track data-field="${field}" maxlength="${max}" spellcheck="false" />`;
          const inp = w.querySelector('input');
          inp.value = cur; inp.dataset.orig = cur;
          b.replaceWith(w); inp.focus(); inp.select();
          SaveBar.update(card);
        };
      };
      inline('pvEditName', 'displayName', p.displayName, 24, S.me.displayNameAt, 15, 'Görünen ad');
      inline('pvEditHandle', 'handle', p.handle, 20, S.me.handleAt, 30, 'Kullanıcı adı', true);
      { const sm = $('#pvStatusMsg'); sm.setAttribute('data-track', ''); sm.dataset.field = 'statusMsg'; sm.dataset.orig = sm.value;
        // en fazla 4 satır; yükseklik içeriğe göre büyür (kaydırma çubuğu çıkmaz)
        const fit = () => { sm.style.height = 'auto'; sm.style.height = Math.min(110, sm.scrollHeight + 2) + 'px'; };
        sm.addEventListener('keydown', (e) => { if (e.key === 'Enter' && sm.value.split('\n').length >= 4) e.preventDefault(); });
        sm.addEventListener('input', fit); requestAnimationFrame(fit); }
      SaveBar.watch(card, {
        save: async () => {
          const patch = {};
          card.querySelectorAll('[data-track][data-field]').forEach((el) => { if (el.value !== el.dataset.orig) patch[el.dataset.field] = el.value.trim(); });
          if (!Object.keys(patch).length) return;
          if ('displayName' in patch && !patch.displayName) { toast('Görünen ad boş olamaz.', 'error'); return false; }
          S.me = await sc('updateProfile', patch);
          toast('Değişiklikler kaydedildi.', 'success');
          renderAccount();
          setTimeout(() => open(S.me.uid), 0);
        },
        reset: () => setTimeout(() => open(P.uid), 0)
      });
    } else bindActions(p);
    renderTab();
    sc('achievementView', self ? null : p.uid).then((list) => { const el = $('#pvTasks'); if (el) el.textContent = list.filter((a) => a.done).length; }).catch(() => {});
  }

  function actionButtons(p) {
    const f = p.friendship;
    return `<div class="pv-actions">
      ${f === 'friend' ? '<button class="btn btn-primary" data-a="msg">Mesaj</button><button class="btn btn-ghost" data-a="call">Sesli ara</button><button class="btn btn-danger" data-a="remove">Arkadaşlıktan çıkar</button>'
        : f === 'incoming' ? '<button class="btn btn-primary" data-a="accept">İsteği kabul et</button><button class="btn btn-ghost" data-a="decline">Reddet</button>'
        : f === 'outgoing' ? '<button class="btn btn-ghost" disabled>İstek gönderildi</button>'
        : '<button class="btn btn-primary" data-a="add">Arkadaş ekle</button>'}</div>`;
  }
  function bindActions(p) {
    $$('[data-a]', $('#pvCard')).forEach((b) => (b.onclick = async () => {
      try {
        const a = b.dataset.a;
        if (a === 'msg') { $('#profileView').classList.add('hidden'); Chat.openDm(p.uid); return; }
        if (a === 'call') { $('#profileView').classList.add('hidden'); Call.start(p.uid); return; }
        if (a === 'add') { await sc('sendRequest', p.uid); toast('Arkadaşlık isteği gönderildi.', 'success'); }
        if (a === 'accept') { await sc('acceptRequest', p.uid); toast('Artık arkadaşsınız.', 'success'); }
        if (a === 'decline') await sc('declineRequest', p.uid, false);
        if (a === 'remove') { if (!(await confirmBox('Arkadaşlıktan çıkarılsın mı?', p.displayName, 'Çıkar'))) return; await sc('removeFriend', p.uid); }
        Social.refreshFriends();
        open(p.uid);
      } catch (e) { toast(e.message, 'error'); }
    }));
  }

  async function editField(field, label, cur, max, lastAt, days, hint) {
    const next = (lastAt || 0) + days * DAY;
    if (Date.now() < next) { toast(`${label} ${Math.ceil((next - Date.now()) / DAY)} gün sonra değiştirilebilir.`, 'error'); return; }
    $('#cfTitle').textContent = `${label} değiştir`;
    $('#cfText').innerHTML = `${esc(hint)}<input class="input" id="cfInput" maxlength="${max}" value="${esc(cur)}" style="margin-top:12px;width:100%" />`;
    $('#cfYes').textContent = 'Kaydet';
    $('#confirmWin').classList.remove('hidden');
    setTimeout(() => $('#cfInput').focus(), 50);
    const done = () => { $('#confirmWin').classList.add('hidden'); $('#cfYes').onclick = $('#cfNo').onclick = null; };
    $('#cfNo').onclick = done;
    $('#cfYes').onclick = async () => {
      const v = $('#cfInput').value.trim();
      try { S.me = await sc('updateProfile', { [field]: v }); done(); toast(`${label} değişti.`, 'success'); renderAccount(); open(S.me.uid); }
      catch (e) { toast(e.message, 'error'); }
    };
  }

  async function renderTab() {
    const body = $('#pvBody'); if (!body) return;
    if (tab === 'activity') {
      const list = await sc('activityOf', P.uid).catch(() => []);
      body.innerHTML = list.length ? `<div class="pv-sec">SON ETKİNLİK</div>` + list.map((a) => `<div class="act-row"><div class="act-ic">${a.type === 'achievement' ? '🏆' : a.type === 'time' ? '🕒' : a.type === 'purchase' ? '🛍️' : a.type === 'friend' ? '🤝' : a.type === 'gift' ? '🎁' : '•'}</div>
        <div><b>${esc(a.type === 'time' ? "Cubixora'da vakit geçirdi" : a.type === 'achievement' ? 'Bir başarım kazandı' : a.text)}</b><small>${esc(a.type === 'achievement' ? a.text : timeAgo(a.at))}${a.type === 'achievement' ? ' · ' + esc(timeAgo(a.at)) : ''}</small></div>
        ${a.coins ? `<span class="coin-chip"><i class="coin-ic">C</i>+${Number(a.coins).toLocaleString('tr-TR')}</span>` : (a.lp ? `<span class="coin-chip lp">+${a.lp} LP</span>` : '')}</div>`).join('')
        : '<div class="sp-empty">Henüz etkinlik yok.</div>';
    }
    if (tab === 'achievements') {
      const list = await sc('achievementView', P.self ? null : P.uid).catch(() => []);
      const done = list.filter((a) => a.done).length;
      body.innerHTML = `<div class="pv-sec">BAŞARIMLAR <span>${done}/${list.length} başarım açıldı</span></div><div class="ach-grid">` + list.map((a) => `<div class="ach ${a.done ? 'done' : ''}">
        <div class="ach-ic">${ICON[a.icon] || '🏅'}</div><div class="ach-txt"><b>${esc(a.title)}</b><small>${esc(a.desc)}</small>
        ${a.done ? `<em>${esc(timeAgo(a.at))}</em>` : a.goal ? `<div class="lvl-bar"><i style="width:${Math.round(((a.progress || 0) / a.goal) * 100)}%"></i></div><em>${a.progress || 0}/${a.goal}</em>` : ''}
        </div><span class="coin-chip"><i class="coin-ic">C</i>+${Number(a.coins || 0).toLocaleString('tr-TR')}</span></div>`).join('') + '</div>';
    }
    if (tab === 'custom') renderCustom(body);
  }

  async function renderCustom(body) {
    const inv = (S.me && S.me.inventory) || {};
    const owned = (type) => Object.entries(shopItems).filter(([id, it]) => it.type === type && inv[id]);
    const lim = await sc('limits').catch(() => ({ bgMaxKB: 300, bgMaxW: 1920, bgMaxH: 1080 }));
    const frames = owned('frame'), colors = owned('color');
    body.innerHTML = `
      <div class="pv-sec">ÇERÇEVE</div>
      <div class="cust-row">
        <button class="cust ${!P.frame ? 'on' : ''}" data-frame="">⊘<small>Yok</small></button>
        ${frames.map(([id, it]) => `<button class="cust frame-prev ${P.frame === it.ref ? 'on' : ''}" data-frame="${esc(it.ref)}" style="--frame:${esc(it.color || '#fff')}"><span></span><small>${esc(it.name)}</small></button>`).join('')}
        <button class="cust add" data-go="frame">+<small>Mağaza</small></button>
      </div>
      <div class="pv-sec">BANNER <span>İstediğin resmi yükle, sürükleyip yakınlaştırarak ayarla</span></div>
      <div class="cust-row">
        <button class="cust ${!P.bg ? 'on' : ''}" data-bg="none">⊘<small>Yok</small></button>
        ${P.bg ? `<button class="cust on bg-prev" style="background-image:url('${P.bg}')"><small>Şu anki</small></button>` : ''}
        <button class="cust add" id="bgUpload">+<small>Banner yükle</small></button>
      </div>
      <div class="pv-sec">RENK PAKETİ</div>
      <div class="cust-row">
        <button class="cust ${!P.color ? 'on' : ''}" data-color="">⊘<small>Yok</small></button>
        ${colors.map(([id, it]) => `<button class="cust ${P.color === it.ref ? 'on' : ''}" data-color="${esc(it.ref)}"><span class="swatch" style="background:${esc(it.color)}"></span><small>${esc(it.name)}</small></button>`).join('')}
        <button class="cust add" data-go="color">+<small>Mağaza</small></button>
      </div>
      <div class="pv-sec">PROFİL RESMİ</div>
      <div class="cust-row">
        <button class="cust ${!P.avatar ? 'on' : ''}" data-ava="none"><img src="${esc(headUrl(P.mcName || S.account.name, 48))}" alt="" /><small>Skin yüzüm</small></button>
        <button class="cust add" id="avaUpload">+<small>Resim yükle</small></button>
      </div>`;
    const save = async (patch, msg) => {
      try { S.me = await sc('updateProfile', patch); Object.assign(P, patch); toast(msg || 'Kaydedildi.', 'success'); renderAccount(); applyLook(); render(); tab = 'custom'; renderTab(); }
      catch (e) { toast(e.message, 'error'); }
    };
    // çerçeve / renk: beklemeden, animasyonla hemen uygulanır; kayıt arka planda (olmazsa geri alınır)
    const instant = (b, key, attr) => {
      const val = b.dataset[attr], prev = P[key];
      if (prev === val || (prev || '') === val) return;
      const row = b.closest('.cust-row');
      $$(`[data-${attr}]`, row).forEach((x) => x.classList.toggle('on', x === b));
      b.classList.remove('picked'); void b.offsetWidth; b.classList.add('picked');
      P[key] = val; paintLook();
      sc('updateProfile', { [key]: val }).then((me) => { S.me = me; renderAccount(); applyLook(); })
        .catch((e) => { P[key] = prev; paintLook(); $$(`[data-${attr}]`, row).forEach((x) => x.classList.toggle('on', (x.dataset[attr] || '') === (prev || ''))); toast(e.message, 'error'); });
    };
    const paintLook = () => {
      const ava = $('#pvCard .pv-ava');
      if (ava) {
        ava.classList.toggle('framed', !!P.frame);
        ava.style.cssText = frameStyle(P.frame);
        ava.classList.remove('look-pop'); void ava.offsetWidth; ava.classList.add('look-pop');
      }
      const it = P.color && shopItems[`color-${P.color}`], col = it ? it.color : '';
      for (const el of $$('#pvCard .pv-banner, #pvCard .pv-grid')) { if (col) el.style.setProperty('--accent', col); else el.style.removeProperty('--accent'); }
    };
    $$('[data-frame]', body).forEach((b) => (b.onclick = () => instant(b, 'frame', 'frame')));
    $$('[data-color]', body).forEach((b) => (b.onclick = () => instant(b, 'color', 'color')));
    $$('[data-go]', body).forEach((b) => (b.onclick = () => { $('#profileView').classList.add('hidden'); go('shop'); Store.setShopTab(b.dataset.go); }));
    const none = $('[data-bg="none"]', body); if (none) none.onclick = () => save({ bg: '' }, 'Arka plan kaldırıldı.');
    $('[data-ava="none"]', body).onclick = () => save({ avatar: '' }, 'Profil resmi skin yüzün oldu.');
    $('#bgUpload').onclick = () => uploadBanner(lim, save);
    $('#avaUpload').onclick = async () => {
      const r = await cx.pickImage({ maxKB: 2000 }).catch(() => null);
      if (!r) return;
      try { const img = await loadImg(r.dataUrl); save({ avatar: await fit(img, 128, 128, 12, true) }, 'Profil resmi değişti.'); }
      catch (e) { toast(e.message, 'error'); }
    };
  }
  // ---------------------------------------------------------- banner kırpıcı: sürükle + yakınlaştır
  const BW = 1400, BH = 216; // profil banner oranı
  async function uploadBanner(lim, save) {
    const r = await cx.pickImage({ maxKB: 8000 }).catch(() => null);
    if (!r) return;
    let img;
    try { img = await loadImg(r.dataUrl); } catch (e) { toast(e.message, 'error'); return; }
    const out = await cropper(img);
    if (!out) return;
    try { save({ bg: await bannerFit(out, lim.bgMaxKB || 280) }, 'Banner değişti.'); } catch (e) { toast(e.message, 'error'); }
  }
  function cropper(img) {
    return new Promise((done) => {
      const w = document.createElement('div');
      w.className = 'overlay'; w.style.zIndex = 95;
      w.innerHTML = `<div class="crop"><b>Banner'ı ayarla</b><small>Sürükleyerek konumlandır, kaydırıcıyla yakınlaştır.</small>
        <div class="crop-frame"><canvas></canvas></div>
        <div class="crop-zoom"><span>−</span><input type="range" min="100" max="400" value="100" /><span>+</span></div>
        <div class="nick-actions"><button class="btn btn-ghost" data-no>Vazgeç</button><button class="btn btn-primary" data-ok>Banner olarak kaydet</button></div></div>`;
      document.body.appendChild(w);
      const cv = w.querySelector('canvas'), frame = w.querySelector('.crop-frame'), zoom = w.querySelector('input');
      cv.width = BW; cv.height = BH;
      const g = cv.getContext('2d');
      const base = Math.max(BW / img.width, BH / img.height);
      let z = 1, cx0 = img.width / 2, cy0 = img.height / 2;
      const draw = () => {
        const s = base * z, vw = BW / s, vh = BH / s;
        cx0 = Math.min(Math.max(cx0, vw / 2), img.width - vw / 2);
        cy0 = Math.min(Math.max(cy0, vh / 2), img.height - vh / 2);
        g.clearRect(0, 0, BW, BH);
        g.drawImage(img, cx0 - vw / 2, cy0 - vh / 2, vw, vh, 0, 0, BW, BH);
      };
      draw();
      let drag = null;
      frame.onpointerdown = (e) => { drag = { x: e.clientX, y: e.clientY, cx: cx0, cy: cy0 }; frame.setPointerCapture(e.pointerId); };
      frame.onpointermove = (e) => {
        if (!drag) return;
        const k = (BW / frame.clientWidth) / (base * z);
        cx0 = drag.cx - (e.clientX - drag.x) * k; cy0 = drag.cy - (e.clientY - drag.y) * k; draw();
      };
      frame.onpointerup = frame.onpointercancel = () => (drag = null);
      frame.onwheel = (e) => { e.preventDefault(); zoom.value = Math.min(400, Math.max(100, +zoom.value - Math.sign(e.deltaY) * 15)); zoom.oninput(); };
      zoom.oninput = () => { z = zoom.value / 100; draw(); };
      const end = (v) => { w.remove(); done(v); };
      w.querySelector('[data-no]').onclick = () => end(null);
      w.querySelector('[data-ok]').onclick = () => end(cv);
    });
  }
  async function bannerFit(cv, maxKB) {
    let q = 0.88, c = cv;
    for (let n = 0; n < 12; n++) {
      const out = c.toDataURL('image/jpeg', q);
      if (out.length * 0.75 <= maxKB * 1024) return out;
      if (q > 0.55) q -= 0.08;
      else { const s = document.createElement('canvas'); s.width = Math.round(c.width * 0.85); s.height = Math.round(c.height * 0.85); s.getContext('2d').drawImage(c, 0, 0, s.width, s.height); c = s; }
    }
    throw new Error('Banner yeterince küçültülemedi, başka bir resim dene.');
  }
  const loadImg = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('Resim açılamadı.')); i.src = src; });
  async function fit(img, maxW, maxH, maxKB, square) {
    const c = document.createElement('canvas');
    let scale = Math.min(1, maxW / img.width, maxH / img.height), q = 0.86;
    for (let n = 0; n < 10; n++) {
      if (square) { const s = Math.min(img.width, img.height); c.width = c.height = Math.round(Math.min(maxW, s)); c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, c.width, c.height); }
      else { c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); }
      const out = c.toDataURL('image/jpeg', q);
      if (out.length * 0.75 <= maxKB * 1024) return out;
      if (q > 0.5) q -= 0.1; else scale *= 0.85;
    }
    throw new Error(`Resim ${maxKB} KB sınırının altına indirilemedi. Daha küçük bir resim seç.`);
  }

  return { open };
})();

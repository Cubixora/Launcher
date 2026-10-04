/* Sosyal panel: arkadaşlar, gruplar, istekler, bildirimler, ödüller, partner sunucular */
const Social = (() => {
  let timers = [], F = { list: [], incoming: [], outgoing: [] }, convs = [], bound = false, spTab = 'friends', notifs = [];

  const statusDot = (s) => `<i class="st ${s === 'invisible' ? 'offline' : s || 'offline'}"></i>`;
  function personRow(p, extra = '') {
    return `<div class="person" data-uid="${esc(p.uid)}">
      <div ${avaAttrs(p)}><img src="${esc(avatarOf(p, 48))}" alt="" data-fb />${statusDot(p.status)}</div>
      <div class="person-txt"><b class="${nameCls(p)}">${esc(p.displayName || 'Oyuncu')}${roleTags(p)}</b><small>${esc(p.game || (p.statusMsg ? p.statusMsg.replace(/\n+/g, ' · ') : STATUS_TXT[p.status] || 'Çevrimdışı'))}</small></div>
      ${extra}</div>`;
  }

  // ---------------------------------------------------------- başlat / durdur
  async function start() {
    bindOnce();
    stop();
    if (!S.account || !S.account.cloud) { renderLocked(); renderPartners(); return; }
    try {
      { const fresh = await sc('summary'); if (fresh && fresh.profile) S.me = fresh; else S.me = S.me || fresh; }   // her zaman güncel özet
      if (!S.me || !S.me.profile) S.me = await sc('refreshMe');
    } catch (e) { console.warn(e); }
    renderAccount(); applyLook();
    refreshAll();
    // Okuma kotası: anlık değişiklikler (mesaj, istek, grup, bildirim) sinyalle hemen gelir; buradaki yoklamalar sadece yedek.
    // Pencere gizliyken hiç sorgu atılmaz, pencere geri açılınca süresi geçenler bir kez yenilenir.
    const last = { f: Date.now(), c: Date.now(), n: Date.now() };
    const every = { f: 3 * 60000, c: 3 * 60000, n: 10 * 60000 };
    const run = { f: refreshFriends, c: refreshConvs, n: refreshNotifs };
    const due = (force) => { if (document.hidden) return; const t = Date.now(); for (const k of Object.keys(run)) if (force ? t - last[k] > 60000 : t - last[k] >= every[k]) { last[k] = t; run[k](); } };
    timers.push(setInterval(() => due(false), 30000));
    visDue = due;
    if (!visBound) { visBound = true; document.addEventListener('visibilitychange', () => { if (!document.hidden && timers.length && visDue) visDue(true); }); }
    renderPartners();
  }
  let visBound = false, visDue = null;
  function stop() { timers.forEach(clearInterval); timers = []; }
  function renderLocked() {
    $('#spLocked').classList.toggle('hidden', !!(S.account && S.account.cloud));
  }
  async function refreshAll() { await Promise.all([refreshFriends(), refreshConvs(), refreshNotifs()]); }

  // ---------------------------------------------------------- arkadaşlar
  async function refreshFriends() {
    try { F = await sc('friends'); } catch (e) { return; }
    renderFriends(); renderRequests();
    const online = F.list.filter((f) => f.status !== 'offline').length;
    $('#onlineCount').textContent = `${online} arkadaş çevrimiçi`;
  }
  function renderFriends() {
    const box = $('#friendList');
    const f = ($('#friendFilter').value || '').toLowerCase();
    const order = { online: 0, idle: 1, dnd: 2, offline: 3 };
    const list = F.list.filter((p) => !f || (p.displayName || '').toLowerCase().includes(f) || (p.handle || '').includes(f))
      .sort((a, b) => (order[a.status] ?? 3) - (order[b.status] ?? 3) || (a.displayName || '').localeCompare(b.displayName || ''));
    if (!list.length) { box.innerHTML = `<div class="sp-empty">${F.list.length ? 'Sonuç yok.' : 'Henüz arkadaşın yok. Sağ üstteki + ile ekleyebilirsin.'}</div>`; return; }
    box.innerHTML = list.map((p) => personRow(p, `<div class="person-act"><button class="icon-btn tiny" data-act="msg" title="Mesaj"><svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg></button><button class="icon-btn tiny" data-act="call" title="Sesli ara"><svg viewBox="0 0 24 24"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z" /></svg></button></div>`)).join('');
  }
  function renderRequests() {
    const box = $('#requestList');
    const n = F.incoming.length;
    $('#reqBadge').textContent = n; $('#reqBadge').classList.toggle('hidden', !n);
    if (!n && !F.outgoing.length) { box.innerHTML = `<div class="sp-empty"><svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="4" /><path d="M2 21a7 7 0 0 1 14 0M19 8v6M16 11h6" /></svg>Bekleyen istek yok</div>`; return; }
    box.innerHTML = (n ? '<div class="sp-sub"><span>GELEN</span></div>' : '') + F.incoming.map((p) => personRow(p, `<div class="person-act"><button class="btn btn-primary tiny" data-act="accept">Kabul</button><button class="icon-btn tiny" data-act="decline" title="Reddet"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" /></svg></button></div>`)).join('') +
      (F.outgoing.length ? '<div class="sp-sub"><span>GÖNDERİLEN</span></div>' + F.outgoing.map((p) => personRow(p, `<div class="person-act"><button class="btn btn-ghost tiny" data-act="cancel">İptal</button></div>`)).join('') : '');
  }
  async function personAction(uid, act) {
    try {
      if (act === 'msg') { Chat.openDm(uid); return; }
      if (act === 'call') { Call.start(uid); return; }
      if (act === 'accept') { F = await sc('acceptRequest', uid); toast('Arkadaş eklendi.', 'success'); }
      if (act === 'decline') F = await sc('declineRequest', uid, false);
      if (act === 'cancel') F = await sc('declineRequest', uid, true);
      if (act === 'add') { F = await sc('sendRequest', uid); toast('Arkadaşlık isteği gönderildi.', 'success'); searchUsers(); }
      renderFriends(); renderRequests();
    } catch (e) { toast(e.message, 'error'); }
  }

  // ---------------------------------------------------------- kullanıcı arama (+)
  let searchTimer = null;
  async function searchUsers() {
    const box = $('#userResults');
    box.innerHTML = '<div class="sp-empty">Aranıyor...</div>';
    try {
      const list = await sc('searchUsers', $('#userSearch').value);
      if (!list.length) { box.innerHTML = '<div class="sp-empty">Kimse bulunamadı.</div>'; return; }
      box.innerHTML = list.map((p) => {
        const st = p.friendship;
        const btn = st === 'friend' ? '<span class="muted">Arkadaş</span>' : st === 'outgoing' ? '<span class="muted">İstek gitti</span>'
          : st === 'incoming' ? '<button class="btn btn-primary tiny" data-act="accept">Kabul</button>'
          : '<button class="icon-btn tiny solid" data-act="add" title="Arkadaşlık isteği gönder"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg></button>';
        return personRow({ ...p, game: '@' + p.handle }, `<div class="person-act">${btn}</div>`);
      }).join('');
    } catch (e) { box.innerHTML = `<div class="sp-empty">${esc(e.message)}</div>`; }
  }

  // ---------------------------------------------------------- sohbet listesi
  let convT = null;
  function convSoon() { clearTimeout(convT); convT = setTimeout(refreshConvs, 2500); }   // art arda gelen mesajlar tek sorguda birleşir
  async function refreshConvs() {
    try { convs = await sc('conversations'); } catch { return; }
    renderGroups(); renderRecent();
    if (window.Chat) Chat.setConvs(convs);
  }
  function renderGroups() {
    const box = $('#groupList');
    const groups = convs.filter((c) => c.kind === 'group');
    if (!groups.length) { box.innerHTML = `<div class="sp-empty"><svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2.5" /><path d="M3 20a6 6 0 0 1 12 0M14 20a4.5 4.5 0 0 1 8 0" /></svg>Henüz bir grupta değilsin.<button class="btn btn-ghost small" id="emptyNewGroup">Grup oluştur</button></div>`; $('#emptyNewGroup').onclick = () => Chat.newGroup(); return; }
    box.innerHTML = groups.map((g) => `<div class="person" data-conv="${esc(g.id)}">
      <div class="group-ava">${esc((g.title || '?').slice(0, 1).toUpperCase())}</div>
      <div class="person-txt"><b>${esc(g.title)}</b><small>${g.members.length} üye${g.unread ? ' · <em>yeni mesaj</em>' : ''}</small></div></div>`).join('');
  }
  function renderRecent() {
    const box = $('#recentChats');
    const list = convs.filter((c) => c.lastText).slice(0, 3);
    if (!list.length) { box.innerHTML = '<div class="sp-empty small">Henüz mesajın yok.</div>'; return; }
    box.innerHTML = list.map((c) => `<div class="recent-item ${c.unread ? 'unread' : ''}" data-conv="${esc(c.id)}">
      ${c.kind === 'dm' ? `<img src="${esc(avatarOf(c.peer, 32))}" alt="" data-fb />` : `<div class="group-ava small">${esc((c.title || '?')[0].toUpperCase())}</div>`}
      <div><b>${esc(c.title)}</b><small>${esc(c.lastText)}</small></div></div>`).join('');
  }

  // ---------------------------------------------------------- bildirimler
  async function refreshNotifs() {
    try { notifs = await sc('notifications'); } catch { return; }
    $('#bellDot').classList.toggle('hidden', !notifs.some((n) => !n.read));
    renderNotifs();
  }
  function renderNotifs() {
    const box = $('#notifList');
    if (!notifs.length) { box.innerHTML = '<div class="sp-empty">Yeni bildirim yok</div>'; return; }
    box.innerHTML = notifs.map((n) => `<div class="notif ${n.level || 'info'} ${n.read ? '' : 'new'}">
      <b>${esc(n.title || 'Bildirim')}</b><p>${esc(n.text || '')}</p><small>${esc(timeAgo(n.at))}${n.scope === 'me' ? ' · sana özel' : ''}</small></div>`).join('');
  }

  // ---------------------------------------------------------- ödüller (başarım / coin / seviye)
  function reward(r) {
    if (r.kind === 'achievement') {
      top(`<div class="rw-ic">🏆</div><div><small>BAŞARIM TAMAMLANDI</small><b>${esc(r.title)}</b><span>${esc(r.desc || '')}</span></div>`);
      side(r.coins, r.lp);
      Sound.play('achievement');
    } else if (r.kind === 'quest') {
      top(`<div class="rw-ic">🎯</div><div><small>GÖREV TAMAMLANDI</small><b>${esc(r.title)}</b><span>Ödülün hesabına eklendi</span></div>`);
      side(r.coins, r.lp);
      Sound.play('achievement');
    } else if (r.kind === 'questReward') {
      top(`<div class="rw-ic">🧥</div><div><small>ÖZEL ÖDÜL KAZANDIN</small><b>${esc(r.item)}</b><span>${r.days} gün süreli · Envanterden tak</span></div>`);
      Sound.play('achievement');
    } else if (r.kind === 'gwTask') {
      top(`<div class="rw-ic">✅</div><div><small>${esc(r.head || 'GÖREV TAMAMLANDI')}</small><b>${esc(r.title)}</b><span>Çekiliş görevi</span></div>`);
      Sound.play('notification');
    } else if (r.kind === 'gwReady') {
      top(`<div class="rw-ic">🎟️</div><div><small>ÇEKİLİŞE KATILABİLİRSİN</small><b>${esc(r.title)}</b><span>Görevler sayfasından katıl</span></div>`, () => go('quests'));
      Sound.play('achievement');
    } else if (r.kind === 'gwWon') {
      top(`<div class="rw-ic">🏆</div><div><small>ÇEKİLİŞİ KAZANDIN!</small><b>${esc(r.title)}</b><span>Tebrikler! Ayrıntılar Görevler sayfasında</span></div>`, () => go('quests'));
      Sound.play('achievement');
    } else if (r.kind === 'gwLost') {
      top(`<div class="rw-ic">🎁</div><div><small>ÇEKİLİŞ AÇIKLANDI</small><b>${esc(r.title)}</b><span>Sonucu görmek için tıkla</span></div>`, () => go('quests'));
    } else if (r.kind === 'hourly') {
      side(r.coins, r.lp, "Cubixora'da vakit geçirdin");
    } else if (r.kind === 'level') {
      top(`<div class="rw-ic">⭐</div><div><small>SEVİYE ATLADIN</small><b>Seviye ${r.level}</b><span>Tebrikler!</span></div>`);
      Sound.play('achievement');
    }
    sc('summary').then((s) => { S.me = s; renderWallet(); }).catch(() => {});
  }
  function top(html, onClick) {
    const el = document.createElement('div');
    el.className = 'rw-top'; el.innerHTML = html;
    if (onClick) { el.classList.add('click'); el.onclick = () => { onClick(); el.classList.add('out'); }; }
    $('#rewardTop').appendChild(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 500); }, 4200);
  }
  function side(coins, lp, why) {
    if (!coins && !lp) return;
    const box = $('#rewardSide');
    while (box.children.length >= 3) box.firstElementChild.remove();
    const el = document.createElement('div');
    el.className = 'rw-side';
    el.innerHTML = `<div class="rw-coin-ic"><i class="coin-ic big">C</i></div>
      <div class="rw-body"><small>ÖDÜL KAZANDIN</small>
        <div class="rw-vals">${coins ? `<b class="rw-coin">+${Number(coins).toLocaleString('tr-TR')} coin</b>` : ''}${lp ? `<b class="rw-lp">+${Number(lp).toLocaleString('tr-TR')} LP</b>` : ''}</div>
        ${why ? `<span>${esc(why)}</span>` : ''}</div>
      <button class="rw-x" title="Kapat"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" /></svg></button>`;
    const close = () => { if (el.classList.contains('out')) return; el.classList.add('out'); setTimeout(() => el.remove(), 400); };
    el.querySelector('.rw-x').onclick = close;
    box.appendChild(el);
    setTimeout(close, 7000);
  }

  // ---------------------------------------------------------- sinyaller
  function onSignal(sig) {
    switch (sig.type) {
      case 'message':
        Chat.onIncoming(sig);
        convSoon();
        break;
      case 'call': Call.onSignal(sig); break;
      case 'voice': if (window.GameVoice) GameVoice.onSignal(sig); break;
      case 'friend-request':
        refreshFriends();
        toast('Yeni bir arkadaşlık isteğin var.', 'success');
        cx.notify({ title: 'Arkadaşlık isteği', body: 'Biri seni arkadaş olarak eklemek istiyor.', kind: 'friend' });
        Sound.play('notification');
        break;
      case 'friend-accepted': refreshFriends(); toast('Arkadaşlık isteğin kabul edildi.', 'success'); Sound.play('notification'); break;
      case 'group': refreshConvs(); if (sig.action === 'added') { toast('Bir gruba eklendin.', 'success'); sc('track', 'group_join').catch(() => {}); } if (sig.action === 'owner') toast('Bir grubun yöneticisi oldun.', 'success'); break;
      case 'notification': refreshNotifs(); toast(sig.title || 'Yeni bildirim', 'success'); cx.notify({ title: 'Cubixora', body: sig.title || 'Yeni bildirim', kind: 'notification' }); Sound.play('notification'); break;
      case 'wallet': sc('refreshMe').then((s) => { S.me = s; renderWallet(); }).catch(() => {}); break;
    }
  }

  // ---------------------------------------------------------- partner sunucular (ana sayfa)
  async function renderPartners() {
    const box = $('#partners');
    let list = [];
    try { list = await sc('partners'); } catch {}
    list = (list || []).filter((p) => p.active !== false);
    if (!list.length) { box.innerHTML = '<div class="muted">Henüz partner sunucu yok.</div>'; return; }
    box.innerHTML = list.map((p, i) => `<button class="partner-logo" data-i="${i}" data-tip="${esc(p.name)} • Tıkla, hızlıca katıl!">
      ${p.logo ? `<img src="${esc(p.logo)}" alt="${esc(p.name)}" draggable="false" />` : `<span class="pl-ph">${esc((p.name || '?')[0])}</span>`}</button>`).join('');
    $$('.partner-logo', box).forEach((b) => {
      const p = list[Number(b.dataset.i)];
      b.onclick = () => joinPartner(p);
      b.oncontextmenu = (e) => { e.preventDefault(); go('servers'); }; // sağ tık: sunucular sayfası
    });
  }
  function joinPartner(p) { go('home'); play({ ip: p.ip, name: p.name, version: p.version }); }
  function partnerCard(p) {
    $('#pvCard').innerHTML = `<div class="partner-card">
      <button class="icon-btn small pv-close"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" /></svg></button>
      ${p.banner ? `<img class="pc-banner" src="${esc(p.banner)}" alt="" />` : ''}
      <div class="pc-head">${p.logo ? `<img src="${esc(p.logo)}" alt="" />` : ''}<div><b>${esc(p.name)}</b><code>${esc(p.ip)}</code></div></div>
      <p>${esc(p.desc || '')}</p>
      <div class="pc-meta">${p.version ? `<span class="tag">Sürüm ${esc(p.version)}</span>` : ''}${p.discord ? `<a class="tag" data-url="${esc(p.discord)}">Discord</a>` : ''}${p.website ? `<a class="tag" data-url="${esc(p.website)}">Web sitesi</a>` : ''}</div>
      <div class="nick-actions"><button class="btn btn-ghost" data-copy>IP'yi kopyala</button><button class="btn btn-primary" data-join>Sunucuya gir</button></div></div>`;
    $('#profileView').classList.remove('hidden');
    $('.pv-close', $('#pvCard')).onclick = () => $('#profileView').classList.add('hidden');
    $('[data-copy]', $('#pvCard')).onclick = () => { navigator.clipboard.writeText(p.ip); toast('IP kopyalandı.'); };
    $('[data-join]', $('#pvCard')).onclick = () => { $('#profileView').classList.add('hidden'); go('home'); play({ ip: p.ip, name: p.name, version: p.version }); };
    $$('[data-url]', $('#pvCard')).forEach((a) => (a.onclick = () => cx.openUrl(a.dataset.url)));
  }

  // ---------------------------------------------------------- bağla
  function bindOnce() {
    if (bound) return; bound = true;
    $$('#spTabs button').forEach((b) => (b.onclick = () => {
      spTab = b.dataset.t;
      $$('#spTabs button').forEach((x) => x.classList.toggle('active', x === b));
      $$('.sp-tab').forEach((t) => t.classList.toggle('active', t.dataset.t === spTab));
    }));
    $('#friendFilter').oninput = renderFriends;
    $('#spAdd').onclick = (e) => {
      e.stopPropagation();
      if (!S.social) { needCloud('Arkadaş eklemek için Google ya da e-posta ile giriş yap.'); return; }
      $('#addPop').classList.toggle('hidden');
      if (!$('#addPop').classList.contains('hidden')) { $('#userSearch').value = ''; $('#userSearch').focus(); searchUsers(); }
    };
    $('#userSearch').oninput = () => { clearTimeout(searchTimer); searchTimer = setTimeout(searchUsers, 300); };
    const onPerson = (e) => {
      const row = e.target.closest('.person'); if (!row) return;
      const act = e.target.closest('[data-act]');
      if (row.dataset.conv) { Chat.open(row.dataset.conv); return; }
      if (act) { e.stopPropagation(); personAction(row.dataset.uid, act.dataset.act); return; }
      Profile.open(row.dataset.uid);
    };
    ['#friendList', '#requestList', '#userResults', '#groupList'].forEach((id) => $(id).addEventListener('click', onPerson));
    $('#recentChats').onclick = (e) => { const r = e.target.closest('[data-conv]'); if (r) Chat.open(r.dataset.conv); };
    $('#openChat').onclick = () => { if (!S.social) { needCloud('Sohbet için Google ya da e-posta ile giriş yap.'); return; } Chat.open(); };
    $('#newGroupBtn').onclick = () => Chat.newGroup();
    $('#spCollapse').onclick = () => setPanel(false);
    $('#spOpen').onclick = () => setPanel(true);
    $('#bellBtn').onclick = (e) => {
      e.stopPropagation();
      $('#notifPop').classList.toggle('hidden'); $('#mePop').classList.add('hidden');
      if (!$('#notifPop').classList.contains('hidden')) { sc('markNotificationsSeen').catch(() => {}); $('#bellDot').classList.add('hidden'); }
    };
    cx.on('social:me', (s) => { S.me = s; renderAccount(); renderWallet(); applyLook(); });
    cx.on('social:signal', onSignal);
    // arkadaş durumları anlık: sadece değişen satırlar güncellenir
    cx.on('social:presence', (list) => {
      let changed = false;
      for (const u of list) {
        const f = F.list.find((x) => x.uid === u.uid);
        if (f && (f.status !== u.status || (f.game || '') !== (u.game || ''))) { f.status = u.status; f.game = u.game; changed = true; }
        for (const c of convs) if (c.peer && c.peer.uid === u.uid) { c.peer.status = u.status; c.peer.game = u.game; }
      }
      if (changed) {
        renderFriends();
        $('#onlineCount').textContent = `${F.list.filter((f) => f.status !== 'offline').length} arkadaş çevrimiçi`;
        if (window.Chat) Chat.setConvs(convs);
      }
    });
    cx.on('social:reward', reward);
    cx.on('social:error', (m) => console.warn('[sosyal]', m));
    try { if (localStorage.getItem('cx.panel') === '0') setPanel(false); } catch {}
  }
  function setPanel(open) {
    $('#app').classList.toggle('panel-closed', !open);
    $('#spOpen').classList.toggle('hidden', open);
    try { localStorage.setItem('cx.panel', open ? '1' : '0'); } catch {}
  }

  return { joinPartner, start, stop, refreshFriends, repaint: () => { if (F.list.length) { renderFriends(); renderRequests(); } }, refreshConvs, renderPartners, getFriends: () => F, getConvs: () => convs, reward };
})();

/* Basit ses efektleri (Cubixora Ayarları > ses seviyeleri) */
const Sound = (() => {
  let ctx = null;
  function tone(freqs, dur, vol) {
    try {
      ctx = ctx || new AudioContext();
      const g = ctx.createGain(); g.gain.value = vol; g.connect(ctx.destination);
      freqs.forEach((f, i) => {
        const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
        const t = ctx.currentTime + i * dur;
        const gg = ctx.createGain(); gg.gain.setValueAtTime(0, t); gg.gain.linearRampToValueAtTime(1, t + 0.01); gg.gain.exponentialRampToValueAtTime(0.001, t + dur);
        o.connect(gg); gg.connect(g); o.start(t); o.stop(t + dur + 0.02);
      });
    } catch {}
  }
  function play(kind) {
    const s = (S.settings && S.settings.sounds) || {};
    const v = (s.notification ?? 70) / 100 * 0.25;
    if (kind === 'message' && s.message !== false) tone([880, 1175], 0.09, v);
    if (kind === 'notification' && s.general !== false) tone([660, 990], 0.12, v);
    if (kind === 'achievement' && s.general !== false) tone([523, 659, 784, 1047], 0.11, v);
  }
  let ringTimer = null;
  function ring(on) {
    clearInterval(ringTimer);
    const s = (S.settings && S.settings.sounds) || {};
    if (!on || s.call === false) return;
    const v = (s.notification ?? 70) / 100 * 0.3;
    // 'out' = arayan tarafın çalma sesi (yumuşak, uzun aralıklı), aksi halde gelen arama zili
    const once = on === 'out' ? () => tone([440, 480], 0.5, v * 0.8) : () => tone([784, 988, 784, 988], 0.16, v);
    once(); ringTimer = setInterval(once, on === 'out' ? 3000 : 1800);
  }
  return { play, ring };
})();

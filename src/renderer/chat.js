/* Sohbet penceresi: özel mesajlar, gruplar, görsel, sesli mesaj, grup ayarları */
const Chat = (() => {
  let convs = [], active = null, msgs = [], poll = null, bound = false, rec = null, loadingOlder = false, stick = true, noOlder = false, progUntil = 0;
  const EMOJI = '😀 😂 🤣 😊 😍 😘 😎 🤩 🥳 😇 🙂 😉 😜 🤔 😴 😢 😭 😡 🤯 😱 👍 👎 👏 🙌 🙏 💪 🔥 ✨ ⭐ 💯 ❤️ 💔 💙 💚 💜 🖤 🎉 🎮 ⛏️ 🗡️ 🏹 🛡️ 💎 🧱 🌲 🐷 🐔 🐺 🐉 👑 💀 👀 ✅ ❌ ⚡ 🌙 ☀️ 🍕 🍔 🍪 ☕'.split(' ');

  const me = () => S.me && S.me.uid;
  const isOwner = () => active && active.kind === 'group' && active.owner === me();

  function setConvs(list) {
    convs = list;
    if (active) { const a = list.find((c) => c.id === active.id); if (a) active = { ...active, ...a }; }
    if (!$('#chatWin').classList.contains('hidden')) renderList();
  }

  async function open(id) {
    bindOnce();
    $('#chatWin').classList.remove('hidden');
    if (!convs.length) { try { convs = await sc('conversations'); } catch (e) { toast(e.message, 'error'); } }
    renderList();
    if (id) select(id);
    else if (!active && convs[0]) select(convs[0].id);
  }
  async function openDm(uid) {
    try {
      const id = await sc('openDm', uid);
      convs = await sc('conversations');
      open(id);
    } catch (e) { toast(e.message, 'error'); }
  }
  function close() { if (SaveBar.block($('#groupInfo'))) return; $('#chatWin').classList.add('hidden'); clearInterval(poll); poll = null; }

  function renderList() {
    const f = ($('#convFilter').value || '').toLowerCase();
    const box = $('#convList');
    const list = convs.filter((c) => !f || (c.title || '').toLowerCase().includes(f));
    if (!list.length) { box.innerHTML = '<div class="sp-empty">Henüz sohbet yok. Arkadaş listesinden birine mesaj at ya da grup kur.</div>'; return; }
    box.innerHTML = list.map((c) => `<div class="conv ${active && active.id === c.id ? 'on' : ''} ${c.unread ? 'unread' : ''}" data-id="${esc(c.id)}">
      ${c.kind === 'dm' ? `<div ${avaAttrs(c.peer)}><img src="${esc(avatarOf(c.peer, 40))}" alt="" data-fb /><i class="st ${c.peer ? c.peer.status : 'offline'}"></i></div>` : `<div class="group-ava">${esc((c.title || '?')[0].toUpperCase())}</div>`}
      <div class="conv-txt"><b>${esc(c.title)}</b><small>${c.lastFrom === me() ? 'Sen: ' : ''}${esc(c.lastText || '')}</small></div>
      <span class="conv-time">${c.lastAt ? esc(shortTime(c.lastAt)) : ''}</span></div>`).join('');
  }
  const shortTime = (t) => { const d = new Date(t); const today = new Date().toDateString() === d.toDateString(); return today ? d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }); };

  async function select(id) {
    const c = convs.find((x) => x.id === id);
    if (!c) return;
    if (active && active.id !== id && SaveBar.block($('#groupInfo'))) return;
    active = c;
    c.unread = false;
    renderList();
    $('#groupInfo').classList.add('hidden');
    renderHead();
    noOlder = false; stick = true;
    $('#chatMsgs').innerHTML = '<div class="chat-empty"><span>Yükleniyor...</span></div>';
    try { msgs = await sc('messages', c.kind, c.id, {}); } catch (e) { $('#chatMsgs').innerHTML = `<div class="chat-empty"><span>${esc(e.message)}</span></div>`; return; }
    renderMsgs(true);
    const canWrite = c.kind === 'dm' || (c.settings || {}).canMessage !== false || c.owner === me();
    $('#chatInput').classList.toggle('hidden', !canWrite);
    $('#chatLocked').classList.toggle('hidden', canWrite);
    if (canWrite) $('#chatText').focus();
    clearInterval(poll);
    poll = setInterval(() => { if (!document.hidden) fetchNew(); }, 45000);   // yeni mesajlar sinyalle anında gelir; bu sadece yedek
  }
  function renderHead() {
    const c = active;
    if (c.kind === 'dm') {
      const p = c.peer || {};
      $('#chatPeer').innerHTML = `<div ${avaAttrs(p)}><img src="${esc(avatarOf(p, 40))}" alt="" data-fb /><i class="st ${p.status || 'offline'}"></i></div>
        <div><b>${esc(c.title)}</b><small>${esc(p.game || STATUS_TXT[p.status] || 'Çevrimdışı')}</small></div>`;
      $('#chatPeer').onclick = () => Profile.open(c.other);
    } else {
      $('#chatPeer').innerHTML = `<div class="group-ava">${esc((c.title || '?')[0].toUpperCase())}</div><div><b>${esc(c.title)}</b><small>${c.members.length} üye</small></div>`;
      $('#chatPeer').onclick = () => toggleInfo();
    }
    $('#chatCall').classList.toggle('hidden', c.kind !== 'dm');
    $('#chatInfo').classList.toggle('hidden', c.kind !== 'group');
  }

  function msgHtml(m, prev) {
    const mine = m.from === me();
    const grouped = prev && prev.from === m.from && m.at - prev.at < 5 * 60 * 1000;
    const p = m.sender || {};
    const canDel = !m.deleted && (mine || isOwner());
    let body = '';
    if (m.deleted) body = '<i class="muted">Bu mesaj silindi</i>';
    else {
      if (m.image) body += `<img class="msg-img" src="${esc(m.image)}" alt="" />`;
      if (m.audio) body += `<div class="voice"><button class="voice-play">▶</button><div class="voice-bar"><span></span></div><em>${fmtDur(m.dur)}</em><audio src="${esc(m.audio)}" preload="none"></audio></div>`;
      if (m.text) body += `<div class="msg-text">${linkify(esc(m.text))}</div>`;
    }
    return `<div class="msg ${mine ? 'mine' : ''} ${grouped ? 'grouped' : ''}" data-id="${esc(m.id)}">
      ${!grouped ? `<img class="msg-ava" src="${esc(avatarOf(p, 40))}" alt="" data-fb data-uid="${esc(m.from)}" />` : '<div class="msg-ava ph"></div>'}
      <div class="msg-col">
        ${!grouped ? `<div class="msg-meta"><b class="${nameCls(p)}" data-uid="${esc(m.from)}">${esc(p.displayName || 'Oyuncu')}</b>${roleTags(p)}<span>${esc(shortTime(m.at))}</span></div>` : ''}
        <div class="msg-bubble">${body}${canDel ? '<button class="msg-del" title="Sil">✕</button>' : ''}</div>
      </div></div>`;
  }
  const fmtDur = (s) => `${Math.floor((s || 0) / 60)}:${String(Math.round(s || 0) % 60).padStart(2, '0')}`;
  const linkify = (t) => t.replace(/(https?:\/\/[^\s<]+)/g, '<a data-url="$1">$1</a>');
  // Mesajlar: ilk açılışta tamamı çizilir, sonra gelenler yalnız sona eklenir (resimler yeniden yüklenmez, liste zıplamaz).
  // "stick": kullanıcı en alttaysa (ya da mesaj gönderdiyse) yeni mesajda / resim yüklenince hep en altta kalınır.
  const dayOf = (m) => new Date(m.at || Date.now()).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
  function htmlFrom(start) {
    let html = '', lastDay = start > 0 ? dayOf(msgs[start - 1]) : '';
    for (let i = start; i < msgs.length; i++) {
      const m = msgs[i], day = dayOf(m);
      if (day !== lastDay) { html += `<div class="day-sep"><span>${esc(day)}</span></div>`; lastDay = day; }
      html += msgHtml(m, i && msgs[i - 1].at && new Date(msgs[i - 1].at).toDateString() === new Date(m.at).toDateString() ? msgs[i - 1] : null);
    }
    return html;
  }
  // programla kaydırma: hemen ardından gelen scroll olayı "kullanıcı yukarı çıktı" sanılmasın
  function setTop(box, v) { progUntil = performance.now() + 250; box.scrollTop = v; }
  function toBottom() {
    const box = $('#chatMsgs');
    setTop(box, box.scrollHeight);
    requestAnimationFrame(() => { if (stick) setTop(box, box.scrollHeight); });   // yerleşim bitince bir kez daha
  }
  function renderMsgs(scroll) {
    const box = $('#chatMsgs');
    if (scroll) stick = true;
    if (!msgs.length) { box.innerHTML = `<div class="chat-empty"><b>Sohbetin başlangıcı</b><span>${active.kind === 'dm' ? 'İlk mesajı sen gönder!' : 'Gruba ilk mesajı yaz!'}</span></div>`; return; }
    box.innerHTML = htmlFrom(0);
    if (stick) toBottom();
  }
  /** Son n mesajı listenin sonuna ekler (gerisi olduğu gibi kalır). */
  function appendMsgs(n) {
    const box = $('#chatMsgs');
    if (!n) return;
    if (msgs.length === n || box.querySelector('.chat-empty')) { renderMsgs(); return; }
    box.insertAdjacentHTML('beforeend', htmlFrom(msgs.length - n));
    if (stick) toBottom();
  }
  function dropMsg(m) {
    const i = msgs.indexOf(m); if (i < 0) return;
    msgs.splice(i, 1);
    const el = $('#chatMsgs').querySelector(`.msg[data-id="${CSS.escape(m.id)}"]`);
    if (el && i === msgs.length) {   // sondaki geçici mesaj: yalnız onu (ve tek başına kalan gün ayracını) kaldır
      const prev = el.previousElementSibling; el.remove();
      if (prev && prev.classList.contains('day-sep') && !prev.nextElementSibling) prev.remove();
      if (!msgs.length) renderMsgs();
    } else renderMsgs();
  }
  async function fetchNew() {
    if (!active) return;
    const conv = active.id;
    const last = [...msgs].reverse().find((m) => !m.pending && !m.local);
    try {
      const fresh = await sc('messages', active.kind, active.id, last ? { after: last.at } : {});
      if (!active || active.id !== conv) return;   // bu arada başka sohbete geçildi
      const ids = new Set(msgs.map((m) => m.id));
      const add = fresh.filter((m) => !ids.has(m.id));
      if (!add.length) return;
      const pend = msgs.filter((m) => m.pending);
      pend.forEach(dropMsg);                         // gönderilmekte olan varsa önce kalksın, sıra bozulmasın
      msgs = [...msgs, ...add];
      appendMsgs(add.length);
      const keep = pend.filter((m) => !m.done);      // gönderimi biten geçici kopya geri eklenmez (gerçeği geldi)
      if (keep.length) { msgs.push(...keep); appendMsgs(keep.length); }
    } catch {}
  }
  async function loadOlder() {
    if (loadingOlder || noOlder || !active || !msgs.length) return;
    loadingOlder = true;
    const conv = active.id;
    try {
      const older = await sc('messages', active.kind, active.id, { before: msgs[0].at });
      if (!active || active.id !== conv) return;
      if (!older.length) { noOlder = true; return; }
      const box = $('#chatMsgs'); const h = box.scrollHeight, top = box.scrollTop;
      msgs = [...older, ...msgs]; renderMsgs(); setTop(box, box.scrollHeight - h + top);
    } catch {} finally { loadingOlder = false; }
  }

  // ---------------------------------------------------------- gönderme
  async function send(extra = {}) {
    if (!active) return;
    const text = $('#chatText').value.trim();
    if (!text && !extra.image && !extra.audio) return;
    $('#chatText').value = ''; autosize();
    const temp = { id: 'tmp' + Date.now(), from: me(), text, image: extra.image || '', audio: extra.audio || '', dur: extra.dur || 0, at: Date.now(), sender: S.me.profile, pending: true };
    stick = true;
    msgs.push(temp); appendMsgs(1);
    try {
      const mid = await sc('sendMessage', active.kind, active.id, { text, ...extra });
      temp.done = true;
      await fetchNew();
      if (msgs.includes(temp)) {   // sunucu henüz döndürmediyse: geçici kopya kalıcı olur (gerçek kimliğiyle; sonra gelen kopya tekrar eklenmez)
        temp.pending = false; temp.local = true; if (mid) temp.id = mid;
        const el = $('#chatMsgs').querySelector('.msg[data-id^="tmp"]'); if (el) { el.dataset.id = temp.id; el.classList.remove('pending'); }
      }
      if (stick) toBottom();
      Social.refreshConvs();
    } catch (e) {
      dropMsg(temp);
      toast(e.message, 'error');
      if (text) $('#chatText').value = text;
    }
  }
  // görseli küçültüp JPEG'e çevirir (sınır: admin ayarı)
  async function compress(dataUrl, maxKB = 700) {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = dataUrl; });
    let w = img.width, h = img.height, q = 0.85, scale = Math.min(1, 1600 / Math.max(w, h));
    const c = document.createElement('canvas');
    for (let n = 0; n < 8; n++) {
      c.width = Math.round(w * scale); c.height = Math.round(h * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      const out = c.toDataURL('image/jpeg', q);
      if (out.length * 0.75 <= maxKB * 1024) return out;
      if (q > 0.55) q -= 0.12; else scale *= 0.8;
    }
    throw new Error('Görsel çok büyük, küçültülemedi.');
  }
  async function sendImage(dataUrl, kind) {
    try {
      const lim = await sc('limits').catch(() => ({ imageMaxKB: 700 }));
      const image = await compress(dataUrl, lim.imageMaxKB || 700);
      await send({ image, kind });
    } catch (e) { toast(e.message, 'error'); }
  }

  // ---- sesli mesaj
  async function startRec() {
    if (rec) return;
    try {
      const snd = (S.settings && S.settings.sound) || {};
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: snd.micId ? { exact: snd.micId } : undefined, noiseSuppression: snd.noiseSuppression !== false, echoCancellation: snd.echoCancellation !== false, autoGainControl: !!snd.autoGain } });
      const lim = await sc('limits').catch(() => ({ voiceMaxSec: 120 }));
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 24000 });
      const chunks = [];
      mr.ondataavailable = (e) => chunks.push(e.data);
      rec = { mr, stream, chunks, started: Date.now(), max: lim.voiceMaxSec || 120, cancel: false };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const r = rec; rec = null;
        $('#recBar').classList.add('hidden'); clearInterval(r.timer);
        if (r.cancel) return;
        const dur = (Date.now() - r.started) / 1000;
        if (dur < 0.8) return;
        const blob = new Blob(r.chunks, { type: 'audio/webm' });
        const audio = await new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(blob); });
        send({ audio, dur });
      };
      mr.start();
      $('#recBar').classList.remove('hidden');
      rec.timer = setInterval(() => {
        const s = (Date.now() - rec.started) / 1000;
        $('#recTime').textContent = fmtDur(s);
        if (s >= rec.max) stopRec(false);
      }, 250);
    } catch (e) { toast('Mikrofona erişilemedi: ' + e.message, 'error'); }
  }
  function stopRec(cancel) { if (!rec) return; rec.cancel = cancel; rec.mr.stop(); }

  // ---------------------------------------------------------- grup bilgisi ve ayarları
  function toggleInfo() { const g = $('#groupInfo'); if (g.classList.contains('hidden')) renderInfo(); else { if (SaveBar.block(g)) return; g.classList.add('hidden'); } }
  function renderInfo() {
    const c = active; if (!c || c.kind !== 'group') return;
    const owner = isOwner();
    const st = c.settings || {};
    const box = $('#groupInfo');
    box.classList.remove('hidden');
    box.innerHTML = `<div class="gi-head"><div class="group-ava big">${esc((c.title || '?')[0].toUpperCase())}</div>
        ${owner ? `<input class="input" id="giName" data-track value="${esc(c.title)}" maxlength="40" placeholder="Grup adı" />` : `<b>${esc(c.title)}</b>`}
        <small>${c.members.length} üye</small></div>
      ${owner ? `<div class="gi-sec">GRUP AYARLARI</div>
        <label class="gi-row"><span>Üyeler mesaj yazabilsin</span><label class="switch small"><input type="checkbox" id="giMsg" data-track ${st.canMessage !== false ? 'checked' : ''} /><span></span></label></label>
        <label class="gi-row"><span>Üyeler kişi ekleyebilsin</span><label class="switch small"><input type="checkbox" id="giInv" data-track ${st.canInvite ? 'checked' : ''} /><span></span></label></label>` : ''}
      <div class="gi-sec">ÜYELER ${owner || st.canInvite ? '<button class="btn btn-ghost tiny" id="giAdd">+ Ekle</button>' : ''}</div>
      <div class="gi-members">${(c.memberProfiles || []).map((p) => `<div class="person" data-uid="${esc(p.uid)}">
        <div ${avaAttrs(p)}><img src="${esc(avatarOf(p, 32))}" alt="" data-fb /><i class="st ${p.status}"></i></div>
        <div class="person-txt"><b class="${nameCls(p)}">${esc(p.displayName)}${p.uid === c.owner ? ' <span class="badge gold">Yönetici</span>' : ''}${roleTags(p)}</b><small>@${esc(p.handle)}</small></div>
        ${owner && p.uid !== me() ? `<div class="person-act"><button class="btn btn-ghost tiny" data-act="owner" title="Yönetici yap">👑</button><button class="btn btn-danger tiny" data-act="kick">At</button></div>` : ''}</div>`).join('')}</div>
      <div class="gi-actions">${owner ? '<button class="btn btn-danger btn-block" id="giDelete">Grubu sil</button>' : '<button class="btn btn-danger btn-block" id="giLeave">Gruptan ayrıl</button>'}</div>`;
    const act = async (action, arg, msg) => {
      try { await sc('groupAction', c.id, action, arg); if (msg) toast(msg, 'success'); await Social.refreshConvs(); active = convs.find((x) => x.id === c.id) || null; if (active) { renderHead(); renderInfo(); } else { $('#groupInfo').classList.add('hidden'); clearView(); } }
      catch (e) { toast(e.message, 'error'); }
    };
    if (owner) {
      SaveBar.watch(box, { save: async () => {
        const name = $('#giName').value.trim();
        if (!name) { toast('Grup adı boş olamaz.', 'error'); return false; }
        // listede ve başlıkta hemen görünsün
        c.title = name; const li = convs.find((x) => x.id === c.id); if (li) li.title = name; renderList(); renderHead();
        await act('settings', { canMessage: $('#giMsg').checked, canInvite: $('#giInv').checked, name }, 'Grup ayarları kaydedildi.');
      } });
      $('#giDelete').onclick = async () => { if (await confirmBox('Grup silinsin mi?', 'Grup ve tüm mesajlar herkes için silinir.', 'Sil')) act('delete', null, 'Grup silindi.'); };
    } else $('#giLeave').onclick = async () => { if (await confirmBox('Gruptan ayrılmak istiyor musun?', c.title, 'Ayrıl')) act('leave', null, 'Gruptan ayrıldın.'); };
    const add = $('#giAdd'); if (add) add.onclick = () => pickFriends(c.members, (sel) => act('invite', sel, 'Üyeler eklendi.'));
    box.querySelector('.gi-members').onclick = async (e) => {
      const row = e.target.closest('.person'); if (!row) return;
      const b = e.target.closest('[data-act]');
      if (!b) { Profile.open(row.dataset.uid); return; }
      const p = (c.memberProfiles || []).find((x) => x.uid === row.dataset.uid) || {};
      if (b.dataset.act === 'kick' && await confirmBox('Üye atılsın mı?', `${p.displayName} gruptan çıkarılacak.`, 'At')) act('kick', row.dataset.uid, 'Üye gruptan atıldı.');
      if (b.dataset.act === 'owner' && await confirmBox('Yöneticiliği devret?', `${p.displayName} grubun yöneticisi olacak ve SEN yöneticiliği kaybedeceksin. Bu işlemi geri alamazsın, sadece yeni yönetici geri verebilir.`, 'Devret')) act('transfer', row.dataset.uid, 'Yöneticilik devredildi.');
    };
  }
  function clearView() { active = null; $('#chatMsgs').innerHTML = '<div class="chat-empty"><b>Bir sohbet seç</b></div>'; $('#chatInput').classList.add('hidden'); $('#chatPeer').innerHTML = ''; renderList(); }

  // arkadaş seçici (grup kurma / üye ekleme)
  function pickFriends(exclude, cb, withName) {
    const friends = Social.getFriends().list.filter((f) => !exclude.includes(f.uid));
    $('#pvCard').innerHTML = `<div class="pick-friends">
      <button class="icon-btn small pv-close"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" /></svg></button>
      <b>${withName ? 'Grup oluştur' : 'Üye ekle'}</b>
      ${withName ? '<input class="input" id="pfName" placeholder="Grup adı" maxlength="40" />' : ''}
      <div class="pf-list">${friends.length ? friends.map((f) => `<label class="person"><input type="checkbox" value="${esc(f.uid)}" />
        <div class="ava-wrap"><img src="${esc(avatarOf(f, 32))}" alt="" data-fb /></div><div class="person-txt"><b>${esc(f.displayName)}</b><small>@${esc(f.handle)}</small></div></label>`).join('')
        : '<div class="sp-empty">Eklenecek arkadaş yok. Önce arkadaş ekle.</div>'}</div>
      <div class="nick-actions"><button class="btn btn-ghost" data-no>İptal</button><button class="btn btn-primary" data-yes>${withName ? 'Oluştur' : 'Ekle'}</button></div></div>`;
    $('#profileView').classList.remove('hidden');
    const closeIt = () => $('#profileView').classList.add('hidden');
    $('.pv-close', $('#pvCard')).onclick = $('[data-no]', $('#pvCard')).onclick = closeIt;
    $('[data-yes]', $('#pvCard')).onclick = () => {
      const sel = $$('.pf-list input:checked', $('#pvCard')).map((i) => i.value);
      if (!withName && !sel.length) { toast('En az bir kişi seç.', 'error'); return; }
      closeIt(); cb(sel, withName ? $('#pfName').value.trim() : null);
    };
  }
  function newGroup() {
    if (!S.social) { needCloud('Grup kurmak için Google ya da e-posta ile giriş yap.'); return; }
    pickFriends([], async (sel, name) => {
      try {
        const gid = await sc('createGroup', { name: name || 'Yeni grup', members: sel });
        toast('Grup oluşturuldu.', 'success');
        convs = await sc('conversations');
        open(gid);
      } catch (e) { toast(e.message, 'error'); }
    }, true);
  }

  // ---------------------------------------------------------- gelen mesaj
  function onIncoming(sig) {
    const visible = !$('#chatWin').classList.contains('hidden') && active && active.id === sig.conv;
    if (visible && document.hasFocus()) { fetchNew(); return; }
    if (visible) fetchNew();
    const c = convs.find((x) => x.id === sig.conv);
    const who = c ? c.title : 'Yeni mesaj';
    toast(`${who}: ${sig.preview || ''}`);
    cx.notify({ title: 'Cubixora', body: `${who}: ${sig.preview || 'Yeni mesaj'}`, kind: 'message' });
    Sound.play('message');
  }

  function autosize() { const t = $('#chatText'); t.style.height = 'auto'; t.style.height = Math.min(140, t.scrollHeight) + 'px'; }

  function bindOnce() {
    if (bound) return; bound = true;
    $('#chatClose').onclick = close;
    $('#chatWin').onclick = (e) => { if (e.target.id === 'chatWin') close(); };
    $('#convFilter').oninput = renderList;
    $('#convList').onclick = (e) => { const c = e.target.closest('.conv'); if (c) select(c.dataset.id); };
    $('#chatNewGroup').onclick = newGroup;
    $('#chatInfo').onclick = toggleInfo;
    $('#chatCall').onclick = () => active && active.kind === 'dm' && Call.start(active.other);
    $('#chatSend').onclick = () => send();
    $('#chatText').onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } };
    $('#chatText').oninput = autosize;
    $('#chatText').onpaste = (e) => {
      const item = [...(e.clipboardData || {}).items || []].find((i) => i.type.startsWith('image/'));
      if (!item) return;
      e.preventDefault();
      const fr = new FileReader(); fr.onload = () => sendImage(fr.result, 'screenshot'); fr.readAsDataURL(item.getAsFile());
    };
    $('#chatImage').onclick = async () => {
      const r = await cx.pickImage({ maxKB: 5000 }).catch((e) => { toast(e.message, 'error'); return null; });
      if (r) sendImage(r.dataUrl, /screenshot|ekran|\d{4}-\d{2}-\d{2}_\d{2}/i.test(r.name) ? 'screenshot' : 'image');
    };
    $('#chatMic').onclick = () => (rec ? stopRec(false) : startRec());
    $('#recCancel').onclick = () => stopRec(true);
    $('#recSend').onclick = () => stopRec(false);
    $('#emojiPop').innerHTML = EMOJI.map((e) => `<button>${e}</button>`).join('');
    $('#chatEmoji').onclick = (e) => { e.stopPropagation(); $('#emojiPop').classList.toggle('hidden'); };
    $('#emojiPop').onclick = (e) => {
      if (e.target.tagName !== 'BUTTON') return;
      const t = $('#chatText'); const pos = t.selectionStart || t.value.length;
      t.value = t.value.slice(0, pos) + e.target.textContent + t.value.slice(pos); t.focus();
    };
    document.addEventListener('click', (e) => { if (!e.target.closest('#emojiPop, #chatEmoji')) $('#emojiPop').classList.add('hidden'); });
    {
      const box = $('#chatMsgs');
      box.addEventListener('scroll', () => {
        const atEnd = box.scrollHeight - box.scrollTop - box.clientHeight < 60;
        if (performance.now() < progUntil) { if (atEnd) stick = true; return; }   // kendi kaydırmamız: yapışkanlık bozulmaz
        stick = atEnd;
        // eski mesajlar yalnız kullanıcı gerçekten yukarı kaydırınca yüklenir (en alta inerken / kısa sohbette değil)
        if (!stick && box.scrollTop < 40 && box.scrollHeight > box.clientHeight + 40) loadOlder();
      }, { passive: true });
      // resim / avatar yüklenince yükseklik değişir: en alttaysak altta kal
      const keep = () => { if (stick) setTop(box, box.scrollHeight); };
      box.addEventListener('load', keep, true);
      box.addEventListener('error', keep, true);                  // avatar yedeğe düşünce de boy değişebilir
      new ResizeObserver(keep).observe(box);                      // pencere / yazı kutusu boyu değişince
      if (document.fonts) document.fonts.addEventListener('loadingdone', keep);
      // kullanıcı gerçekten yukarı kaydırırsa (tekerlek / sürükleme / tuş) yapışkanlık hemen kalkar
      box.addEventListener('wheel', (e) => { if (e.deltaY < 0) { stick = false; progUntil = 0; } }, { passive: true });
      box.addEventListener('pointerdown', () => { progUntil = 0; }, { passive: true });
    }
    $('#chatMsgs').onclick = async (e) => {
      const img = e.target.closest('.msg-img');
      if (img) { $('#imgViewImg').src = img.src; $('#imgView').classList.remove('hidden'); return; }
      const link = e.target.closest('[data-url]'); if (link) { cx.openUrl(link.dataset.url); return; }
      const who = e.target.closest('[data-uid]'); if (who) { Profile.open(who.dataset.uid); return; }
      const play = e.target.closest('.voice-play');
      if (play) {
        const v = play.closest('.voice'), a = v.querySelector('audio'), bar = v.querySelector('.voice-bar span');
        if (a.paused) {
          $$('.voice audio').forEach((x) => { if (x !== a) { x.pause(); } });
          a.play(); play.textContent = '❚❚';
          a.ontimeupdate = () => { bar.style.width = `${(a.currentTime / (a.duration || 1)) * 100}%`; };
          a.onended = () => { play.textContent = '▶'; bar.style.width = '0'; };
        } else { a.pause(); play.textContent = '▶'; }
        return;
      }
      const del = e.target.closest('.msg-del');
      if (del) {
        const id = del.closest('.msg').dataset.id;
        if (!(await confirmBox('Mesaj silinsin mi?', 'Bu mesaj herkes için silinir.', 'Sil'))) return;
        try { await sc('deleteMessage', active.kind, active.id, id); const m = msgs.find((x) => x.id === id); if (m) { m.deleted = true; m.text = m.image = m.audio = ''; } renderMsgs(); }
        catch (err) { toast(err.message, 'error'); }
      }
    };
  }

  return { open, openDm, close, setConvs, onIncoming, newGroup };
})();

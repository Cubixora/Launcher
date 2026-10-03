/* Sesli arama (WebRTC, birebir). Sinyalleşme Realtime Database üzerinden. Oyundayken de çalışır:
   launcher arka planda açık kalır; gelen aramada Windows bildirimi çıkar, Ctrl+Shift+A açar, Ctrl+Shift+D kapatır. */
const Call = (() => {
  const ICE = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] }];
  let c = null, bound = false;  // { id, peer, peerProfile, pc, stream, state, incoming, offer, timer, startedAt, muted }

  const peerName = () => (c && c.peerProfile ? c.peerProfile.displayName : 'Oyuncu');

  async function micStream() {
    const s = (S.settings && S.settings.sound) || {};
    const stream = await navigator.mediaDevices.getUserMedia({ audio: {
      deviceId: s.micId ? { exact: s.micId } : undefined, noiseSuppression: s.noiseSuppression !== false,
      echoCancellation: s.echoCancellation !== false, autoGainControl: !!s.autoGain } });
    // mikrofon kazancı
    const gain = (s.micGain ?? 100) / 100;
    if (gain !== 1) {
      const ac = new AudioContext(); const src = ac.createMediaStreamSource(stream); const g = ac.createGain(); g.gain.value = gain;
      const dst = ac.createMediaStreamDestination(); src.connect(g); g.connect(dst);
      dst.stream.__orig = stream; return dst.stream;
    }
    return stream;
  }
  function newPc() {
    const pc = new RTCPeerConnection({ iceServers: ICE });
    pc.ontrack = (e) => {
      const a = $('#callAudio');
      a.srcObject = e.streams[0]; if (c) c.remote = e.streams[0];
      const s = (S.settings && S.settings.sound) || {};
      a.volume = Math.min(1, (s.speakerVol ?? 100) / 100);
      if (s.speakerId && a.setSinkId) a.setSinkId(s.speakerId).catch(() => {});
    };
    pc.onconnectionstatechange = () => {
      if (!c) return;
      if (pc.connectionState === 'connected') setState('connected');
      if (['failed', 'disconnected', 'closed'].includes(pc.connectionState) && c.state === 'connected') {
        if (pc.connectionState === 'failed') toast('Arama bağlantısı koptu.', 'error');
        end(false);
      }
    };
    return pc;
  }
  // tüm ağ adayları toplanana kadar bekler (en fazla 3 sn) - tek mesajda gönderilir
  const gathered = (pc) => new Promise((res) => {
    if (pc.iceGatheringState === 'complete') return res();
    const t = setTimeout(res, 3000);
    pc.addEventListener('icegatheringstatechange', () => { if (pc.iceGatheringState === 'complete') { clearTimeout(t); res(); } });
  });
  const sig = (to, payload) => sc('signal', to, { type: 'call', ...payload });

  async function profileOf(uid) {
    const f = Social.getFriends().list.find((x) => x.uid === uid);
    if (f) return f;
    try { return await sc('getProfile', uid); } catch { return { uid, displayName: 'Oyuncu' }; }
  }

  // ---------------------------------------------------------- arayan
  async function start(uid) {
    bindOnce();
    if (c) { toast('Zaten bir aramadasın.', 'error'); return; }
    try {
      c = { id: Math.random().toString(36).slice(2), peer: uid, incoming: false, state: 'calling' };
      c.peerProfile = await profileOf(uid);
      show(); Sound.ring('out');
      c.stream = await micStream(); startMeter();
      c.pc = newPc();
      c.stream.getTracks().forEach((t) => c.pc.addTrack(t, c.stream));
      await c.pc.setLocalDescription(await c.pc.createOffer());
      await gathered(c.pc);
      await sig(uid, { action: 'offer', callId: c.id, sdp: c.pc.localDescription.sdp });
      c.timer = setTimeout(() => { if (c && c.state === 'calling') { toast(`${peerName()} cevap vermedi.`); sig(uid, { action: 'end', callId: c.id }).catch(() => {}); end(false); } }, 40000);
    } catch (e) { toast('Arama başlatılamadı: ' + e.message, 'error'); end(false); }
  }

  // ---------------------------------------------------------- gelen sinyaller
  async function onSignal(s) {
    bindOnce();
    if (s.action === 'offer') {
      if (c) { sig(s.from, { action: 'busy', callId: s.callId }).catch(() => {}); return; }
      c = { id: s.callId, peer: s.from, incoming: true, state: 'ringing', offer: s.sdp };
      c.peerProfile = await profileOf(s.from);
      show();
      Sound.ring(true);
      cx.callHotkeys(true);
      cx.notify({ title: `${peerName()} seni arıyor`, body: 'Açmak için Ctrl+Shift+A, reddetmek için Ctrl+Shift+D', kind: 'call' });
      c.timer = setTimeout(() => { if (c && c.state === 'ringing') { toast(`${peerName()} aradı, cevap verilmedi.`); end(false); } }, 40000);
      return;
    }
    if (!c || s.callId !== c.id) return;
    if (s.action === 'answer') { clearTimeout(c.timer); await c.pc.setRemoteDescription({ type: 'answer', sdp: s.sdp }).catch((e) => toast(e.message, 'error')); setState('connecting'); }
    if (s.action === 'busy') { toast(`${peerName()} şu an başka bir aramada.`); end(false); }
    if (s.action === 'decline') { toast(`${peerName()} aramayı reddetti.`); end(false); }
    if (s.action === 'end') { if (c.state === 'connected') toast('Arama bitti.'); end(false); }
  }

  async function accept() {
    if (!c || !c.incoming || c.state !== 'ringing') return;
    clearTimeout(c.timer); Sound.ring(false);
    try {
      setState('connecting');
      c.stream = await micStream(); startMeter();
      c.pc = newPc();
      c.stream.getTracks().forEach((t) => c.pc.addTrack(t, c.stream));
      await c.pc.setRemoteDescription({ type: 'offer', sdp: c.offer });
      await c.pc.setLocalDescription(await c.pc.createAnswer());
      await gathered(c.pc);
      await sig(c.peer, { action: 'answer', callId: c.id, sdp: c.pc.localDescription.sdp });
    } catch (e) { toast('Arama açılamadı: ' + e.message, 'error'); end(true); }
  }
  function decline() { if (!c) return; sig(c.peer, { action: c.incoming && c.state === 'ringing' ? 'decline' : 'end', callId: c.id }).catch(() => {}); end(false); }
  // ---- oyun içi konuşma göstergesi: yerel ve karşı taraf ses seviyesini ölçüp launcher köprüsüne bildirir
  let meter = null, mutedNames = [];
  const applyMute = () => { const a = $('#callAudio'); if (a) a.muted = !!(c && mutedNames.includes(String(peerName()).toLowerCase())); };
  function level(an, buf) { an.getByteTimeDomainData(buf); let m = 0; for (let i = 0; i < buf.length; i++) { const v = Math.abs(buf[i] - 128) / 128; if (v > m) m = v; } return m; }
  function startMeter() {
    stopMeter(true); window.__inCall = true;
    try {
      const ac = new AudioContext();
      const mk = (st) => { const an = ac.createAnalyser(); an.fftSize = 512; ac.createMediaStreamSource(st).connect(an); return { an, buf: new Uint8Array(an.fftSize) }; };
      const local = mk(c.stream.__orig || c.stream);
      let remote = null, hold = 0, rhold = 0;
      const thr = Math.max(0.008, (((S.settings && S.settings.sound) || {}).vad ?? 5) / 100 * 0.3);
      const t = setInterval(() => {
        if (!c) return;
        if (!remote && c.remote) { try { remote = mk(c.remote); } catch {} }
        const now = Date.now(); applyMute();
        const ll = c.muted ? 0 : level(local.an, local.buf), rl = remote && !($('#callAudio') || {}).muted ? level(remote.an, remote.buf) : 0;
        if (ll > thr) hold = now + 450;
        if (rl > 0.01) rhold = now + 450;
        window.cx.voiceState({ on: c.state === 'connected', muted: !!c.muted, speaking: hold > now, level: ll, peer: peerName(), peerSpeaking: rhold > now, peerLevel: rl });
      }, 60);
      meter = { ac, t };
    } catch {}
  }
  function stopMeter(silent) {
    if (!meter) return;
    clearInterval(meter.t); try { meter.ac.close(); } catch {}
    meter = null; window.__inCall = false;
    if (!silent) try { window.cx.voiceState({ on: false }); } catch {}
  }

  function end(notify = true) {
    stopMeter();
    if (!c) return;
    if (notify) sig(c.peer, { action: 'end', callId: c.id }).catch(() => {});
    clearTimeout(c.timer); clearInterval(c.tick);
    Sound.ring(false);
    cx.callHotkeys(false);
    try { c.pc && c.pc.close(); } catch {}
    try { c.stream && c.stream.getTracks().forEach((t) => t.stop()); if (c.stream && c.stream.__orig) c.stream.__orig.getTracks().forEach((t) => t.stop()); } catch {}
    $('#callAudio').srcObject = null;
    c = null;
    $('#callCard').classList.add('hidden');
  }
  function mute() {
    if (!c || !c.stream) return;
    c.muted = !c.muted;
    c.stream.getAudioTracks().forEach((t) => (t.enabled = !c.muted));
    $('#callMute').classList.toggle('on', c.muted);
  }

  // ---------------------------------------------------------- arayüz
  function setState(st) {
    if (!c) return;
    c.state = st;
    if (st === 'connecting') Sound.ring(false);
    if (st === 'connected') {
      Sound.ring(false); cx.callHotkeys(true);
      c.startedAt = Date.now();
      clearInterval(c.tick);
      c.tick = setInterval(() => { if (c) $('#callState').textContent = fmt((Date.now() - c.startedAt) / 1000); }, 1000);
      sc('track', 'call').catch(() => {});
    }
    show();
  }
  const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  function show() {
    if (!c) return;
    const card = $('#callCard');
    card.classList.remove('hidden');
    card.dataset.state = c.state;
    setImg($('#callAvatar'), avatarOf(c.peerProfile, 64));
    $('#callName').textContent = peerName();
    const txt = { calling: 'Aranıyor...', ringing: 'Seni arıyor...', connecting: 'Bağlanıyor...', connected: '0:00' };
    if (c.state !== 'connected' || !c.startedAt) $('#callState').textContent = txt[c.state] || '';
    $('#callAccept').classList.toggle('hidden', !(c.incoming && c.state === 'ringing'));
    $('#callMute').classList.toggle('hidden', c.state === 'ringing');
  }
  function bindOnce() {
    if (bound) return; bound = true;
    $('#callAccept').onclick = accept;
    $('#callEnd').onclick = decline;
    $('#callMute').onclick = mute;
    cx.on('call:hotkey', (k) => { if (k === 'accept') accept(); else decline(); });
    addEventListener('beforeunload', () => { if (c) end(true); });
  }
  return { start, onSignal, end, active: () => !!c };
})();

/* Oyun içi mikrofon izleme: mod "Yakınlık Sohbeti" açıkken köprü üzerinden ister; ses seviyesi oyuna iletilir.
   Mikrofon yalnızca oyun isterken açılır, istek kesilince hemen kapanır. Aramadayken arama ölçümü öncelikli. */
(() => {
  let m = null;
  async function start() {
    if (m) return;
    m = { dead: false };
    try {
      const s = (S.settings && S.settings.sound) || {};
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: s.micId ? { exact: s.micId } : undefined, noiseSuppression: s.noiseSuppression !== false, echoCancellation: s.echoCancellation !== false, autoGainControl: !!s.autoGain } });
      if (!m || m.dead) { stream.getTracks().forEach((t) => t.stop()); return; }
      const ac = new AudioContext(); const an = ac.createAnalyser(); an.fftSize = 512;
      ac.createMediaStreamSource(stream).connect(an);
      const buf = new Uint8Array(an.fftSize), gain = (s.micGain ?? 100) / 100;
      m.stream = stream; m.ac = ac;
      m.t = setInterval(() => {
        if (window.__inCall) return;
        an.getByteTimeDomainData(buf);
        let mx = 0; for (let i = 0; i < buf.length; i++) { const v = Math.abs(buf[i] - 128) / 128; if (v > mx) mx = v; }
        window.cx.voiceState({ on: true, mon: true, level: Math.min(1, mx * gain), muted: false });
      }, 60);
    } catch { m = null; }
  }
  function stop() {
    if (!m) return;
    m.dead = true; clearInterval(m.t);
    try { m.stream && m.stream.getTracks().forEach((t) => t.stop()); } catch {}
    try { m.ac && m.ac.close(); } catch {}
    m = null;
    if (!window.__inCall) try { window.cx.voiceState({ on: false }); } catch {}
  }
  window.cx.on('voice:mute', (l) => { mutedNames = Array.isArray(l) ? l : []; applyMute(); });
  // oyun içi ses artık gamevoice.js tarafından yönetilir (voice:want kullanılmıyor)
})();

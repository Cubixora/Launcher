/* Oyun içi sesli sohbet (WebRTC mesh). Mod her 100 ms'de oyuncu listesini ve ses ayarlarını launcher'a gönderir (voice:ctl);
   burada Cubixora hesabı olan oyunculara bağlanılır, sesler yakınlığa/susturmaya göre karıştırılır ve konuşan kişiler oyuna bildirilir.
   Sinyalleşme: mevcut sig/{uid} kanalı (type:'voice'). Mikrofon yalnızca mod "mikrofon açık" derse alınır. */
const GameVoice = (() => {
  const ICE = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] }];
  const MAX_PEERS = 8;
  let ctl = null, ctlAt = 0;
  let ac = null, dest = null, outTrack = null, micNode = null, micKey = '', micStarting = false;
  let micMax = 0, wasOn = false, gateOpen = false, gateHold = 0, micLevel = 0, micFailAt = 0;
  const peers = new Map();            // küçük harfli ad -> eş
  const uids = new Map();             // küçük harfli ad -> { uid, at, busy }
  const retryAt = new Map();          // ad -> bu zamandan önce yeniden bağlanma
  const seenLog = new Map();
  const L = (m, every = 0) => { const n = Date.now(); if (every && n - (seenLog.get(m) || 0) < every) return; seenLog.set(m, n); try { window.cx.voiceLog(m); } catch {} };
  let status = '', lastSummary = 0;
  const lc = (n) => String(n || '').toLowerCase();
  const myUid = () => (S.account && S.account.uid) || null;
  const myName = () => (S.account && S.account.name) || '';
  const sig = (to, payload) => sc('signal', to, { type: 'voice', name: myName(), ...payload });

  const settings = () => (ctl && ctl.s) || {};
  const hearOk = (name, uid) => {
    const h = settings().hear;
    if (h === 1) return true;
    if (h === 2) return false;
    try { return Social.getFriends().list.some((f) => f.uid === uid); } catch { return false; }
  };
  const active = () => !!ctl && Date.now() - ctlAt < 3000 && !!myUid() && (settings().hear !== 2 || settings().mic > 0);
  const listed = (name) => !!ctl && ctl.peers.find((p) => lc(p.n) === name);

  // ------------------------------------------------------------ ses grafiği
  function ensureAudio() {
    if (ac && ac.state !== 'closed') { if (ac.state === 'suspended') ac.resume().catch(() => {}); return; }
    ac = new AudioContext({ latencyHint: 'interactive' });
    dest = ac.createMediaStreamDestination();
    outTrack = dest.stream.getAudioTracks()[0]; outTrack.enabled = false;
    micNode = null; micKey = '';
    applySink();
  }
  let sinkId = '';
  async function resolveDevice(label, kind) {
    if (!label) return '';
    try { const l = await navigator.mediaDevices.enumerateDevices(); const d = l.find((x) => x.kind === kind && x.label === label); return d ? d.deviceId : ''; } catch { return ''; }
  }
  async function applySink() {
    const id = await resolveDevice(settings().outDev, 'audiooutput');
    if (id === sinkId && ac) return;
    sinkId = id;
    try { if (ac && ac.setSinkId) await ac.setSinkId(id || ''); } catch {}
  }

  async function startMic() {
    const s = settings();
    const key = [s.micDev, s.aec, s.ans, s.agc].join('|');
    if (micNode && micKey === key) return;
    if (micStarting || Date.now() - micFailAt < 5000) return;
    micStarting = true;
    try {
      stopMic();
      const id = await resolveDevice(s.micDev, 'audioinput');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: id ? { exact: id } : undefined, echoCancellation: s.aec !== false, noiseSuppression: s.ans !== false, autoGainControl: s.agc !== false } });
      ensureAudio();
      const src = ac.createMediaStreamSource(stream), an = ac.createAnalyser(); an.fftSize = 512;
      const gain = ac.createGain();
      src.connect(an); src.connect(gain); gain.connect(dest);
      micNode = { stream, src, an, gain, buf: new Uint8Array(an.fftSize) };
      micKey = key; status = ''; L('mikrofon açıldı');
    } catch (e) { micNode = null; micKey = ''; micFailAt = Date.now(); status = 'Mikrofon açılamadı'; L('mikrofon hata: ' + (e && e.name) + ' ' + (e && e.message), 4000); }
    micStarting = false;
  }
  function stopMic() {
    if (!micNode) return;
    try { micNode.stream.getTracks().forEach((t) => t.stop()); micNode.src.disconnect(); micNode.gain.disconnect(); } catch {}
    micNode = null; micKey = '';
    if (outTrack) outTrack.enabled = false;
    gateOpen = false;
  }
  function level(an, buf) { an.getByteTimeDomainData(buf); let m = 0; for (let i = 0; i < buf.length; i++) { const v = Math.abs(buf[i] - 128) / 128; if (v > m) m = v; } return m; }

  // ------------------------------------------------------------ eş bağlantıları
  const gathered = (pc) => new Promise((res) => {
    if (pc.iceGatheringState === 'complete') return res();
    const t = setTimeout(res, 2500);
    pc.addEventListener('icegatheringstatechange', () => { if (pc.iceGatheringState === 'complete') { clearTimeout(t); res(); } });
  });

  function makePeer(name, uid, vid) {
    ensureAudio();
    const pc = new RTCPeerConnection({ iceServers: ICE });
    const P = { name, uid, vid, pc, born: Date.now(), connected: false, lastSeen: Date.now(), speakUntil: 0, lv: 0 };
    pc.addTrack(outTrack, dest.stream);
    pc.ontrack = (e) => {
      const stream = e.streams[0];
      if (!stream || P.src) return;
      // Chromium: uzak akış bir medya öğesine bağlı olmadan WebAudio'ya akmaz
      L(`${name}: ses akışı geldi`);
      P.el = new Audio(); P.el.srcObject = stream; P.el.muted = true; P.el.play().catch(() => {});
      P.src = ac.createMediaStreamSource(stream);
      P.an = ac.createAnalyser(); P.an.fftSize = 512; P.buf = new Uint8Array(P.an.fftSize);
      P.gain = ac.createGain(); P.gain.gain.value = 0;
      P.src.connect(P.an); P.src.connect(P.gain); P.gain.connect(ac.destination);
    };
    pc.onconnectionstatechange = () => {
      const st = pc.connectionState; L(`${name}: bağlantı ${st}`);
      if (st === 'connected') {
        P.connected = true;
        try { const snd = pc.getSenders().find((x) => x.track === outTrack); if (snd) { const p = snd.getParameters(); if (!p.encodings || !p.encodings.length) p.encodings = [{}]; p.encodings[0].maxBitrate = Math.max(8, settings().bitrate || 24) * 1000; snd.setParameters(p).catch(() => {}); } } catch {}
      }
      if (st === 'failed' || st === 'closed') drop(name, 8000);
      if (st === 'disconnected') setTimeout(() => { const c = peers.get(name); if (c === P && pc.connectionState !== 'connected') drop(name, 8000); }, 6000);
    };
    peers.set(name, P);
    L(`eş oluşturuldu: ${name} (${vid})`);
    return P;
  }
  function drop(name, cooldown = 0, notify = true) {
    const P = peers.get(name);
    if (!P) return;
    L(`eş kapandı: ${name} (bekleme ${cooldown}ms)`);
    peers.delete(name);
    if (cooldown) retryAt.set(name, Date.now() + cooldown);
    if (notify && P.uid) sig(P.uid, { action: 'bye', vid: P.vid }).catch(() => {});
    try { P.pc.close(); } catch {}
    try { P.src && P.src.disconnect(); P.gain && P.gain.disconnect(); } catch {}
    try { if (P.el) { P.el.srcObject = null; } } catch {}
  }
  function dropAll() { for (const n of [...peers.keys()]) drop(n, 0, true); }

  async function offerTo(name, uid) {
    if (peers.has(name)) return;
    const vid = Math.random().toString(36).slice(2);
    const P = makePeer(name, uid, vid);
    try {
      await P.pc.setLocalDescription(await P.pc.createOffer());
      await gathered(P.pc);
      if (peers.get(name) !== P) return;
      await sig(uid, { action: 'offer', vid, sdp: P.pc.localDescription.sdp });
      L(`teklif gönderildi -> ${name}`);
      setTimeout(() => { const c = peers.get(name); if (c === P && !P.connected) drop(name, 2500); }, 9000);
    } catch (e) { L(`teklif hata ${name}: ${e && e.message}`); drop(name, 10000, false); }
  }

  async function onSignal(s) {
    const me = myUid();
    if (!me || !s || !s.from) return;
    const from = s.from, name = lc(s.name);
    L(`sinyal: ${s.action} <- ${name}`);
    if (s.t && Date.now() - s.t > 25000 && s.action !== 'bye') return;   // eski sinyal
    if (s.action === 'bye') {
      for (const [n, P] of peers) if (P.uid === from && (!s.vid || s.vid === P.vid)) drop(n, 3000, false);
      return;
    }
    if (!name || !active() || !listed(name)) return;   // yalnızca aynı sunucudaki oyuncular
    if (s.action === 'want') {                 // büyük kimlikli taraf, küçük kimlikliden bağlantı başlatmasını ister
      if (me < from && !peers.has(name)) { uids.set(name, { uid: from, at: Date.now() }); offerTo(name, from); }
      return;
    }
    if (s.action === 'offer') {
      const old = peers.get(name);
      if (old) drop(name, 0, false);
      const P = makePeer(name, from, s.vid);
      uids.set(name, { uid: from, at: Date.now() });
      try {
        await P.pc.setRemoteDescription({ type: 'offer', sdp: s.sdp });
        await P.pc.setLocalDescription(await P.pc.createAnswer());
        await gathered(P.pc);
        if (peers.get(name) !== P) return;
        await sig(from, { action: 'answer', vid: s.vid, sdp: P.pc.localDescription.sdp });
        L(`cevap gönderildi -> ${name}`);
        setTimeout(() => { const c = peers.get(name); if (c === P && !P.connected) drop(name, 2500); }, 9000);
      } catch { drop(name, 10000, false); }
      return;
    }
    if (s.action === 'answer') {
      const P = peers.get(name);
      if (!P || P.vid !== s.vid || P.pc.signalingState !== 'have-local-offer') return;
      P.pc.setRemoteDescription({ type: 'answer', sdp: s.sdp }).catch(() => drop(name, 10000, false));
    }
  }

  // ------------------------------------------------------------ ad -> hesap
  function resolve(name) {
    const c = uids.get(name);
    if (c && (c.busy || Date.now() - c.at < (c.uid ? 600000 : 45000))) return c.uid;
    if ([...uids.values()].filter((x) => x.busy).length >= 4) return c ? c.uid : null;
    const e = { uid: c ? c.uid : null, at: Date.now(), busy: true };
    uids.set(name, e);
    sc('uidOf', name).then((u) => { e.uid = u || null; L(`uid ${name} -> ${u || 'yok (Cubixora hesabı değil?)'}`, 30000); }).catch((er) => { L(`uidOf hata ${name}: ${er && er.message}`, 30000); }).finally(() => { e.busy = false; e.at = Date.now(); });
    return e.uid;
  }

  // ------------------------------------------------------------ ana döngü
  function manage() {
    const now = Date.now();
    if (!ctl || now - ctlAt > 3000 || !myUid()) {
      if (peers.size) dropAll();
      if (micNode) stopMic();
      return;
    }
    const s = settings();
    if (!active()) { dropAll(); stopMic(); status = !myUid() ? 'Hesap girişi yok (Cubixora hesabı gerekli)' : 'Ses kapalı'; return; }
    ensureAudio();
    if (s.mic > 0) startMic(); else stopMic();
    applySink();
    const me = myUid(), meName = lc(myName());
    // hedef eş kümesi
    const want = [];
    const sorted = [...ctl.peers].filter((p) => lc(p.n) !== meName).sort((a, b) => (a.d < 0 ? 1e9 : a.d) - (b.d < 0 ? 1e9 : b.d));
    for (const p of sorted) {
      const n = lc(p.n);
      const uid = resolve(n);
      if (!uid || uid === me) continue;
      if (s.prox && (p.d < 0 || p.d > (s.range || 48) + 16) && !(peers.has(n) && p.d >= 0 && p.d <= (s.range || 48) + 40)) continue;
      if (!hearOk(n, uid) && !(s.mic > 0)) continue;
      want.push({ n, uid });
      if (want.length >= MAX_PEERS) break;
    }
    const wantSet = new Set(want.map((w) => w.n));
    const resolved = ctl.peers.filter((p) => { const c = uids.get(lc(p.n)); return c && c.uid; }).length;
    if (!status || /bağlı/.test(status) || /Cubixora/.test(status)) status = want.length ? `${[...peers.values()].filter((p) => p.connected).length}/${want.length} oyuncuya bağlı` : (resolved ? 'Bağlanılacak oyuncu yok' : 'Sunucuda başka Cubixora oyuncusu bulunamadı');
    if (now - lastSummary > 10000) { lastSummary = now; const pl = [...peers.values()].map((p) => `${p.name}:${p.connected ? 'bağlı' : 'bekliyor'} lvMax=${(p.maxLv || 0).toFixed(3)} ses=${(p.g || 0).toFixed(2)}`).join(' '); const mm = micMax; micMax = 0; for (const p of peers.values()) p.maxLv = 0; L(`ses: mikMax=${mm.toFixed(3)} kapı=${gateOpen} ptt=${ctl && ctl.ptt} iz=${outTrack && outTrack.enabled} eşler=[${pl}]`); L(`özet: liste=${ctl.peers.length} cubixora=${resolved} hedef=${want.length} bağlı=${[...peers.values()].filter((p) => p.connected).length} mic=${s.mic} hear=${s.hear} ac=${ac && ac.state}`); }
    for (const [n, P] of peers) {
      if (wantSet.has(n)) { P.lastSeen = now; continue; }
      if (now - P.lastSeen > 4000) drop(n, 0, true);
    }
    for (const w of want) {
      if (peers.has(w.n) || (retryAt.get(w.n) || 0) > now) continue;
      if (me < w.uid) offerTo(w.n, w.uid);
      else {
        const k = 'w' + w.n, last = retryAt.get(k) || 0;
        if (now - last > 5000) { retryAt.set(k, now); L(`want gönderildi -> ${w.n}`, 20000); sig(w.uid, { action: 'want' }).catch((e) => L(`sinyal hata: ${e && e.message}`, 10000)); }
      }
    }
  }

  function tick() {
    if (!ctl || Date.now() - ctlAt > 3000 || !ac) { if (wasOn) { wasOn = false; publish(false); } return; }
    wasOn = true;
    const s = settings(), now = Date.now(), thr = Math.max(0.008, (s.vad ?? 5) / 100 * 0.3);
    // mikrofon geçidi
    micLevel = 0;
    if (micNode) {
      micLevel = level(micNode.an, micNode.buf); if (micLevel > micMax) micMax = micLevel;
      let open = false;
      if (s.mic === 2) open = !!ctl.ptt;
      else if (s.mic === 1) { if (micLevel > thr) gateHold = now + 450; open = gateHold > now; }
      gateOpen = open;
      if (outTrack) outTrack.enabled = open;
      micNode.gain.gain.value = Math.max(0, (s.micVol ?? 100) / 100);
    } else if (outTrack) { outTrack.enabled = false; gateOpen = false; }
    // eşler: ses seviyesi + yakınlık
    const speakers = [];
    const range = s.range || 48, outVol = Math.max(0, (s.outVol ?? 100) / 100);
    const mute = new Set((ctl.mute || []).map(lc));
    for (const [n, P] of peers) {
      if (!P.gain) continue;
      const info = listed(n), d = info ? info.d : -1;
      let g = hearOk(n, P.uid) && !mute.has(n) ? 1 : 0;
      if (g && s.prox) { if (d < 0) g = 0; else { const t = Math.max(0, 1 - d / range); g = d < 3 ? 1 : t * t; } }   // yakında tam ses, uzaklaştıkça azalır, menzilde sıfır
      g *= outVol;
      P.gain.gain.setTargetAtTime(g, ac.currentTime, 0.06);
      P.lv = level(P.an, P.buf);
      if (P.lv > 0.012) P.speakUntil = now + 450;
      P.maxLv = Math.max(P.maxLv || 0, P.lv); P.g = g;
      if (P.connected && g > 0.02) speakers.push({ n: (info && info.n) || n, lv: Math.min(1, P.lv * Math.max(0.3, Math.min(1, g))), sp: P.speakUntil > now });
    }
    publish(true, speakers);
  }

  function publish(on, speakers = []) {
    if (window.__inCall) return;           // 1'e 1 arama kendi ölçümünü gönderir
    try {
      const s = settings(), top = speakers.filter((x) => x.sp).sort((a, b) => b.lv - a.lv)[0];
      window.cx.voiceState({
        on, mon: false, muted: false, level: micLevel,
        speaking: !!on && s.mic > 0 && gateOpen && s.mic !== 2 ? true : false,
        peer: top ? top.n : '', peerSpeaking: !!top, peerLevel: top ? top.lv : 0,
        speakers: speakers.slice(0, 5),
        cx: [...uids.entries()].filter(([, v]) => v.uid).map(([k]) => k).slice(0, 80),
        conn: [...peers.values()].filter((p) => p.connected).length, status
      });
    } catch {}
  }

  async function sendDevices() {
    try {
      let list = await navigator.mediaDevices.enumerateDevices();
      if (list.some((d) => !d.label)) {
        try { const st = await navigator.mediaDevices.getUserMedia({ audio: true }); st.getTracks().forEach((t) => t.stop()); list = await navigator.mediaDevices.enumerateDevices(); } catch {}
      }
      const pick = (k) => list.filter((d) => d.kind === k && d.label && d.deviceId !== 'default' && d.deviceId !== 'communications').map((d) => ({ label: d.label }));
      window.cx.voiceDevices({ inputs: pick('audioinput'), outputs: pick('audiooutput') });
    } catch {}
  }

  window.cx.on('voice:ctl', (c) => { if (!ctl || Date.now() - ctlAt > 5000) L(`ctl alındı: oyuncu=${c.peers.length} uid=${myUid() || 'YOK'}`); ctl = c; ctlAt = Date.now(); });
  window.cx.on('voice:devices-req', () => sendDevices());
  setInterval(manage, 500);
  setInterval(tick, 80);
  addEventListener('beforeunload', () => { try { dropAll(); } catch {} });
  return { onSignal };
})();
window.GameVoice = GameVoice;

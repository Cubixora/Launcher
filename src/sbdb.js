// Supabase istemcisi: belge deposu (docs tablosu) + anlık kanallar.
// Giriş Supabase Auth ile yapılır; oturum anahtarı her istekte gönderilir.
// Tüm okuma/yazmalar sunucudaki fs_* fonksiyonlarından geçer ve orada kurallarla denetlenir (supabase/cubixora.sql).
const tls = require('tls');
const crypto = require('crypto');
const { EventEmitter } = require('events');

// ------------------------------------------------------------ küçük WebSocket istemcisi (Node 20'de yerleşik yok)
class MiniWS extends EventEmitter {
  constructor(url) {
    super();
    const u = new URL(url);
    this.open = false; this.closed = false;
    this.sock = tls.connect({ host: u.hostname, port: Number(u.port) || 443, servername: u.hostname, ALPNProtocols: ['http/1.1'] });
    const key = crypto.randomBytes(16).toString('base64');
    let head = Buffer.alloc(0), upgraded = false, buf = Buffer.alloc(0), frags = [];
    this.sock.setNoDelay(true);
    this.sock.setKeepAlive(true, 20000);
    this.sock.on('secureConnect', () => {
      this.sock.write(`GET ${u.pathname}${u.search} HTTP/1.1\r\nHost: ${u.host}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n` +
        `Sec-WebSocket-Key: ${key}\r\nSec-WebSocket-Version: 13\r\nUser-Agent: Cubixora-Launcher\r\n\r\n`);
    });
    this.sock.on('data', (chunk) => {
      if (!upgraded) {
        head = Buffer.concat([head, chunk]);
        const i = head.indexOf('\r\n\r\n');
        if (i < 0) { if (head.length > 16384) this._fail(new Error('geçersiz yanıt')); return; }
        const status = head.slice(0, head.indexOf('\r\n')).toString();
        if (!/^HTTP\/1\.1 101/.test(status)) return this._fail(new Error(`bağlantı reddedildi (${status.slice(9, 12)})`));
        upgraded = true; this.open = true;
        chunk = head.slice(i + 4); head = null;
        this.emit('open');
        if (!chunk.length) return;
      }
      buf = Buffer.concat([buf, chunk]);
      for (;;) {
        if (buf.length < 2) return;
        const fin = buf[0] & 0x80, opcode = buf[0] & 0x0f, masked = buf[1] & 0x80;
        let len = buf[1] & 0x7f, off = 2;
        if (len === 126) { if (buf.length < 4) return; len = buf.readUInt16BE(2); off = 4; }
        else if (len === 127) { if (buf.length < 10) return; len = Number(buf.readBigUInt64BE(2)); off = 10; }
        const mk = masked ? 4 : 0;
        if (buf.length < off + mk + len) return;
        let payload = buf.slice(off + mk, off + mk + len);
        if (masked) { const m = buf.slice(off, off + 4); payload = Buffer.from(payload.map((b, j) => b ^ m[j & 3])); }
        buf = buf.slice(off + mk + len);
        if (opcode === 0x8) { this._frame(0x8, Buffer.alloc(0)); this.sock.end(); return; }
        if (opcode === 0x9) { this._frame(0xA, payload); continue; }
        if (opcode === 0xA) continue;
        if (opcode === 0x1 || opcode === 0x2 || opcode === 0x0) {
          frags.push(payload);
          if (fin) { const msg = Buffer.concat(frags).toString('utf8'); frags = []; this.emit('message', msg); }
        }
      }
    });
    this.sock.on('error', (e) => this._fail(e));
    this.sock.on('close', () => this._fail(null));
  }
  _fail(e) {
    if (this.closed) return;
    this.closed = true; this.open = false;
    try { this.sock.destroy(); } catch {}
    this.emit('close', e);
  }
  _frame(op, data) {
    if (this.closed) return;
    const len = data.length, mask = crypto.randomBytes(4);
    const hdr = len < 126 ? Buffer.from([0x80 | op, 0x80 | len])
      : len < 65536 ? Buffer.from([0x80 | op, 0x80 | 126, len >> 8, len & 255])
        : (() => { const b = Buffer.alloc(10); b[0] = 0x80 | op; b[1] = 0x80 | 127; b.writeBigUInt64BE(BigInt(len), 2); return b; })();
    const body = Buffer.from(data.map((b, j) => b ^ mask[j & 3]));
    this.sock.write(Buffer.concat([hdr, mask, body]));
  }
  send(text) { if (this.open) this._frame(0x1, Buffer.from(text, 'utf8')); }
  close() { try { this._frame(0x8, Buffer.alloc(0)); } catch {} this._fail(null); }
}

const instances = new Map();

module.exports = function createSbDb({ url, key, token, log = () => {} }) {
  const base = String(url).replace(/\/+$/, '');
  if (instances.has(base)) return instances.get(base);

  // ------------------------------------------------------------ değer dönüşümü (zaman damgaları milisaniye sayı olarak tutulur)
  function enc(v) {
    if (v === null || v === undefined) return v;
    if (v instanceof Date) return v.getTime();
    if (typeof v === 'object' && v.__ts !== undefined) return Number(v.__ts);
    if (Array.isArray(v)) return v.map(enc);
    if (typeof v === 'object') { const o = {}; for (const [k, x] of Object.entries(v)) if (x !== undefined) o[k] = enc(x); return o; }
    if (typeof v === 'number' && !Number.isFinite(v)) return null;
    return v;
  }
  const decDoc = (r) => r && ({ id: r.path.split('/').pop(), path: r.path, ...(r.data || {}), _updated: Number(r.updated) || 0 });

  // ------------------------------------------------------------ istek
  const ERR = {
    PERMISSION_DENIED: 'Bu işlem için iznin yok.',
    ALREADY_EXISTS: 'Bulut hatası: Document already exists',
    NOT_FOUND: 'Bulut hatası: No document to update',
    INVALID_ARGUMENT: 'Bulut hatası: geçersiz istek'
  };
  async function bearer(auth) {
    if (!auth) return key;
    try { const t = await token(); return t || key; } catch { return key; }
  }
  async function rpc(name, args, auth = true) {
    let r, j;
    for (let attempt = 0; ; attempt++) {
      try {
        r = await fetch(`${base}/rest/v1/rpc/${name}`, {
          method: 'POST',
          headers: { apikey: key, Authorization: `Bearer ${await bearer(auth)}`, 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(args || {})
        });
      } catch (e) {
        if (attempt < 1) { await new Promise((ok) => setTimeout(ok, 800)); continue; }
        throw new Error('Bulut sunucusuna ulaşılamadı. İnternet bağlantını kontrol et.');
      }
      j = await r.json().catch(() => null);
      if (r.status >= 500 && attempt < 1) { await new Promise((ok) => setTimeout(ok, 800)); continue; }
      break;
    }
    if (!r.ok) {
      const code = String((j && j.message) || r.status);
      const st = ERR[code] ? code : r.status === 401 || r.status === 403 ? 'PERMISSION_DENIED' : code;
      const e = new Error(ERR[st] || `Bulut hatası: ${code}${j && j.hint ? ' (' + j.hint + ')' : ''}`);
      e.status = st; e.raw = j;
      throw e;
    }
    return j;
  }

  const fsGet = async (paths, auth = true, omit = []) => {
    const out = [];
    for (let i = 0; i < paths.length; i += 300) {
      const rows = await rpc('fs_get', { paths: paths.slice(i, i + 300), omit }, auth);
      for (const r of rows || []) out.push(decDoc(r));
    }
    return out;
  };
  const get = async (p, auth = true) => (await fsGet([p], auth))[0] || null;
  const batchGet = (paths, { omit = [] } = {}) => (paths.length ? fsGet(paths, true, omit) : Promise.resolve([]));
  // { yol: son değişiklik (ms) } — veri indirmeden önbellek kontrolü
  async function stamps(paths, auth = true) {
    const out = {};
    for (let i = 0; i < paths.length; i += 300) {
      const rows = await rpc('fs_stamps', { paths: paths.slice(i, i + 300) }, auth);
      for (const r of rows || []) out[r.path] = Number(r.updated) || 0;
    }
    return out;
  }

  // "items.`cape-x`" -> ["items", "cape-x"]
  function fieldPath(s) {
    const out = []; let cur = '', q = false;
    for (const ch of String(s)) {
      if (ch === '`') { q = !q; continue; }
      if (ch === '.' && !q) { out.push(cur); cur = ''; continue; }
      cur += ch;
    }
    out.push(cur);
    return out;
  }
  async function commit(writes) {
    const w = writes.map((x) => {
      if (x.delete) return { delete: x.delete };
      const o = { set: x.set, data: enc(x.data || {}) };
      if (x.mask) o.mask = x.mask.map(fieldPath);
      if (x.exists !== undefined) o.exists = !!x.exists;
      if (x.increments) o.increments = x.increments;
      if (x.serverTime) o.serverTime = x.serverTime;
      return o;
    });
    return rpc('fs_commit', { writes: w });
  }
  const set = (p, data) => commit([{ set: p, data }]);
  const patch = (p, data) => commit([{ set: p, data, mask: Object.keys(data).map((k) => '`' + k + '`') }]);
  const del = (p) => commit([{ delete: p }]);
  async function create(col, id, data) {
    try { await commit([{ set: `${col}/${id}`, data, exists: false }]); return true; }
    catch (e) { if (e.status === 'ALREADY_EXISTS') return false; throw e; }
  }
  async function add(col, data) {
    const id = crypto.randomBytes(15).toString('base64').replace(/[^A-Za-z0-9]/g, '').slice(0, 20);
    await commit([{ set: `${col}/${id}`, data, exists: false }]);
    return id;
  }
  async function query(col, { where = [], orderBy = [], limit, omit = [] } = {}, auth = true) {
    const rows = await rpc('fs_query', { col, filters: where.map(([f, op, v]) => [f, op, enc(v)]), orders: orderBy, lim: limit || null, start_after: null, omit }, auth);
    return (rows || []).map(decDoc);
  }
  async function list(col, { pageSize = 100, orderBy } = {}, auth = true) {
    const ord = orderBy ? [String(orderBy).trim().split(/\s+/)] : [];
    const rows = await rpc('fs_query', { col, filters: [], orders: ord, lim: pageSize, start_after: null, omit: [] }, auth);
    return (rows || []).map(decDoc);
  }
  async function listPage(col, { pageSize = 300, pageToken = '' } = {}) {
    const rows = await rpc('fs_query', { col, filters: [], orders: [], lim: pageSize, start_after: pageToken || null, omit: [] });
    const docs = (rows || []).map(decDoc);
    return { docs, next: docs.length >= pageSize ? docs[docs.length - 1].id : '' };
  }

  // ------------------------------------------------------------ Realtime (presence, sinyaller, oyun içi efektler)
  const RT = `${base.replace(/^http/, 'ws')}/realtime/v1/websocket?apikey=${encodeURIComponent(key)}&vsn=1.0.0`;
  let ws = null, ref = 0, hb = null, retry = 1000, connecting = false, tokenTimer = null, lastToken = '';
  const chans = new Map();   // topic -> { config, joined, priv, handlers, onState, pendingJoin }
  const nextRef = () => String(++ref);
  const sendRaw = (topic, event, payload, joinRef) => { if (ws && ws.open) ws.send(JSON.stringify({ topic, event, payload, ref: nextRef(), join_ref: joinRef })); };
  const anyChans = () => [...chans.values()].some((c) => c.want);

  async function connect() {
    if (connecting || (ws && !ws.closed) || !anyChans()) return;
    connecting = true;
    try { lastToken = await bearer(true); } catch { lastToken = key; }
    const sock = new MiniWS(RT);
    ws = sock;
    sock.on('open', () => {
      connecting = false; retry = 1000;
      clearInterval(hb);
      hb = setInterval(() => sendRaw('phoenix', 'heartbeat', {}), 25000);
      for (const c of chans.values()) if (c.want) join(c);
      clearInterval(tokenTimer);
      // oturum anahtarı saatte bir yenilenir: açık kanallara yenisi bildirilir
      tokenTimer = setInterval(async () => {
        const t = await bearer(true).catch(() => null);
        if (!t || t === lastToken) return;
        lastToken = t;
        for (const c of chans.values()) if (c.joined) sendRaw(c.topic, 'access_token', { access_token: t }, c.joinRef);
      }, 5 * 60 * 1000);
    });
    sock.on('message', (m) => { try { onMsg(JSON.parse(m)); } catch {} });
    sock.on('close', (e) => {
      if (ws !== sock) return;
      connecting = false; ws = null; clearInterval(hb); clearInterval(tokenTimer);
      for (const c of chans.values()) { if (c.joined) { c.joined = false; c.onState('closed', e); } }
      if (!anyChans()) return;
      setTimeout(connect, retry);
      retry = Math.min(retry * 2, 30000);
    });
  }
  function join(c) {
    c.joinRef = nextRef();
    const payload = { config: { broadcast: { ack: false, self: false }, presence: { key: c.presenceKey || '', enabled: !!c.presenceKey }, postgres_changes: [], private: c.priv }, access_token: lastToken };
    if (ws && ws.open) ws.send(JSON.stringify({ topic: c.topic, event: 'phx_join', payload, ref: c.joinRef, join_ref: c.joinRef }));
  }
  function onMsg(m) {
    const c = chans.get(m.topic);
    if (!c) return;
    if (m.event === 'phx_reply' && m.ref === c.joinRef) {
      const ok = m.payload && m.payload.status === 'ok';
      if (ok) { c.joined = true; c.onState('open'); if (c.afterJoin) c.afterJoin(); return; }
      // özel kanal açılamadıysa (izin ayarı) herkese açık kanalla devam et
      if (c.priv) { log(`[anlık] ${c.topic} özel kanal reddedildi: ${JSON.stringify(m.payload && m.payload.response || {}).slice(0, 200)}`); c.priv = false; setTimeout(() => join(c), 300); }
      else log(`[anlık] ${c.topic} katılınamadı: ${JSON.stringify(m.payload || {}).slice(0, 200)}`);
      return;
    }
    if (m.event === 'phx_error' || m.event === 'phx_close') { if (c.joined) { c.joined = false; c.onState('closed'); setTimeout(() => { if (c.want) join(c); }, 2000); } return; }
    if (m.event === 'system' && m.payload && m.payload.status === 'error') { log(`[anlık] ${c.topic}: ${JSON.stringify(m.payload).slice(0, 200)}`); return; }
    c.handlers.forEach((h) => { try { h(m.event, m.payload || {}); } catch {} });
  }
  function channel(name, { presenceKey } = {}) {
    const topic = `realtime:${name}`;
    let c = chans.get(topic);
    if (!c) { c = { topic, priv: true, joined: false, want: false, handlers: new Set(), states: new Set(), presenceKey }; c.onState = (s, e) => c.states.forEach((f) => { try { f(s, e); } catch {} }); chans.set(topic, c); }
    if (presenceKey) c.presenceKey = presenceKey;
    return c;
  }
  function subscribe(c, handler, onState) {
    c.handlers.add(handler); if (onState) c.states.add(onState);
    if (!c.want) { c.want = true; if (ws && ws.open) join(c); else connect(); }
    else if (c.joined && onState) onState('open');
    return () => {
      c.handlers.delete(handler); if (onState) c.states.delete(onState);
      if (!c.handlers.size) {
        c.want = false;
        if (c.joined) sendRaw(c.topic, 'phx_leave', {}, c.joinRef);
        c.joined = false;
        if (!anyChans() && ws) { const s = ws; ws = null; clearInterval(hb); clearInterval(tokenTimer); s.close(); }
      }
    };
  }
  const bpayload = (p) => (p && p.payload !== undefined ? p.payload : p);

  // --- çevrimiçi durumu: Realtime Presence. Bağlantı kopunca sunucu herkese otomatik "ayrıldı" der.
  let pres = {}, presReady = false, presWaiters = [], myTrack = null, myKey = '', presHold = null;
  const strip = (meta) => { const o = { ...meta }; delete o.phx_ref; delete o.phx_ref_prev; o.t = Date.now(); return o; };
  function presenceChan(uid) {
    myKey = uid || myKey;
    const c = channel('presence', { presenceKey: myKey });
    c.afterJoin = () => { if (myTrack) sendRaw(c.topic, 'presence', { type: 'presence', event: 'track', payload: myTrack }, c.joinRef); };
    return c;
  }
  function rtListen(p, onEvent, onState = () => {}) {
    if (p === 'presence') {
      const c = presenceChan();
      return subscribe(c, (event, payload) => {
        if (event === 'presence_state') {
          pres = {};
          for (const [k, v] of Object.entries(payload)) if (v && v.metas && v.metas.length) pres[k] = strip(v.metas[v.metas.length - 1]);
          presReady = true; presWaiters.splice(0).forEach((f) => f());
          onEvent({ event: 'put', path: '/', data: { ...pres } });
        } else if (event === 'presence_diff') {
          for (const [k, v] of Object.entries(payload.leaves || {})) {
            if (!(payload.joins || {})[k]) { delete pres[k]; onEvent({ event: 'put', path: `/${k}`, data: null }); }
            void v;
          }
          for (const [k, v] of Object.entries(payload.joins || {})) {
            if (v && v.metas && v.metas.length) { pres[k] = strip(v.metas[v.metas.length - 1]); onEvent({ event: 'put', path: `/${k}`, data: pres[k] }); }
          }
        }
      }, onState);
    }
    const sig = /^sig\/([^/]+)$/.exec(p);
    if (sig) {
      return subscribe(channel(`sig:${sig[1]}`), (event, payload) => {
        if (event !== 'broadcast') return;
        const data = bpayload(payload);
        if (!data || typeof data !== 'object') return;
        onEvent({ event: 'put', path: `/${crypto.randomBytes(8).toString('hex')}`, data });
      }, onState);
    }
    throw new Error(`desteklenmeyen anlık yol: ${p}`);
  }
  async function rtGet(p) {
    if (p !== 'presence') return null;
    if (!presReady) await new Promise((ok) => { presWaiters.push(ok); setTimeout(ok, 3000); });
    return { ...pres };
  }
  async function rtSet(p, v) {
    const m = /^presence\/([^/]+)$/.exec(p);
    if (!m) return null;
    const c = presenceChan(m[1]);
    if (!v || v.s === 'offline') {
      myTrack = null;
      if (c.joined) sendRaw(c.topic, 'presence', { type: 'presence', event: 'untrack' }, c.joinRef);
      if (presHold) { const u = presHold; presHold = null; setTimeout(u, 300); }
      return null;
    }
    const next = { s: String(v.s || 'online').slice(0, 20), g: String(v.g || '').slice(0, 80) };
    if (myTrack && myTrack.s === next.s && myTrack.g === next.g) return null;   // değişmediyse gönderme (mesaj kotası)
    myTrack = next;
    if (c.joined) sendRaw(c.topic, 'presence', { type: 'presence', event: 'track', payload: next }, c.joinRef);
    else if (!c.want && !presHold) presHold = subscribe(c, () => {});
    return null;
  }
  async function rtPush(p, v) {
    const m = /^sig\/([^/]+)$/.exec(p);
    if (!m) return null;
    const payload = { ...v }; delete payload.from; delete payload.t;
    await rpc('fs_signal', { target: m[1], payload: enc(payload) });
    return { name: crypto.randomBytes(8).toString('hex') };
  }
  const rtDel = async () => null;      // sinyaller saklanmaz, silmeye gerek yok
  const rtPatch = async () => null;

  // --- oyun içi emote/sprey/kozmetik değişiklikleri (oyun açıkken dinlenir)
  function fxListen(onFx, onState) {
    return subscribe(channel('fx'), (event, payload) => {
      if (event !== 'broadcast') return;
      const d = bpayload(payload);
      if (d && d.path) onFx(d);
    }, onState);
  }

  const api = {
    kind: 'supabase', rtLive: true, get, set, patch, del, create, add, list, listPage, batchGet, stamps, query, commit, rpc, enc,
    dec: (x) => x, ts: (ms) => ({ __ts: ms }), rtGet, rtSet, rtPush, rtPatch, rtDel, rtListen, fxListen
  };
  instances.set(base, api);
  return api;
};
module.exports.MiniWS = MiniWS;

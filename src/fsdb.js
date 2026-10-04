// Firestore REST istemcisi (tam veri tipleri, sorgu, toplu yazma) + Realtime Database (anlık sinyaller)
module.exports = function createDb({ projectId, apiKey, token, rtdbUrl }) {
  const BASE = () => `https://firestore.googleapis.com/v1/projects/${projectId()}/databases/(default)/documents`;
  const NAME = (p) => `projects/${projectId()}/databases/(default)/documents/${p}`;

  // ------------------------------------------------------------ değer dönüşümü
  function enc(v) {
    if (v === null || v === undefined) return { nullValue: null };
    if (v instanceof Date) return { timestampValue: v.toISOString() };
    if (v && v.__ts) return { timestampValue: new Date(v.__ts).toISOString() };
    if (Array.isArray(v)) return { arrayValue: { values: v.map(enc) } };
    switch (typeof v) {
      case 'boolean': return { booleanValue: v };
      case 'number': return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
      case 'string': return { stringValue: v };
      case 'object': return { mapValue: { fields: encFields(v) } };
      default: return { stringValue: String(v) };
    }
  }
  const encFields = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined).map(([k, v]) => [k, enc(v)]));
  function dec(v) {
    if (!v) return null;
    if ('stringValue' in v) return v.stringValue;
    if ('integerValue' in v) return Number(v.integerValue);
    if ('doubleValue' in v) return v.doubleValue;
    if ('booleanValue' in v) return v.booleanValue;
    if ('timestampValue' in v) return Date.parse(v.timestampValue);
    if ('nullValue' in v) return null;
    if ('arrayValue' in v) return (v.arrayValue.values || []).map(dec);
    if ('mapValue' in v) return decFields(v.mapValue.fields || {});
    if ('referenceValue' in v) return v.referenceValue;
    return null;
  }
  const decFields = (f = {}) => Object.fromEntries(Object.entries(f).map(([k, v]) => [k, dec(v)]));
  const decDoc = (d) => d && ({ id: d.name.split('/').pop(), path: d.name.split('/documents/')[1], ...decFields(d.fields), _updated: Date.parse(d.updateTime || d.createTime || 0) });

  // ------------------------------------------------------------ istek
  async function call(method, url, body, auth = true) {
    const headers = { 'Content-Type': 'application/json' };
    if (auth) { const t = await token().catch(() => null); if (t) headers.Authorization = `Bearer ${t}`; }
    const sep = url.includes('?') ? '&' : '?';
    const r = await fetch(auth ? url : `${url}${sep}key=${encodeURIComponent(apiKey())}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
    if (r.status === 404 && method === 'GET') return { __notFound: true };
    let j = await r.json().catch(() => ({}));
    if (Array.isArray(j) && j[0] && j[0].error) j = j[0]; // runQuery hataları dizi içinde gelir
    if (!r.ok) {
      const st = (j.error && j.error.status) || (r.status === 403 ? 'PERMISSION_DENIED' : r.status);
      const e = new Error(st === 'PERMISSION_DENIED' ? 'Bu işlem için iznin yok.' : st === 'FAILED_PRECONDITION' ? 'İşlem yapılamadı, tekrar dene.' : `Bulut hatası: ${(j.error && j.error.message) || st}`);
      e.status = st; e.raw = j;
      throw e;
    }
    return j;
  }

  const get = async (p, auth = true) => { const j = await call('GET', `${BASE()}/${p}`, null, auth); return j.__notFound ? null : decDoc(j); };
  const set = (p, data) => call('PATCH', `${BASE()}/${p}`, { fields: encFields(data) });
  // sadece verilen alanları değiştirir
  const patch = (p, data) => {
    const mask = Object.keys(data).map((k) => `updateMask.fieldPaths=${encodeURIComponent('`' + k + '`')}`).join('&');
    return call('PATCH', `${BASE()}/${p}?${mask}`, { fields: encFields(data) });
  };
  const del = (p) => call('DELETE', `${BASE()}/${p}`);
  async function create(col, id, data) {
    try { await call('POST', `${BASE()}/${col}${id ? `?documentId=${encodeURIComponent(id)}` : ''}`, { fields: encFields(data) }); return true; }
    catch (e) { if (e.status === 'ALREADY_EXISTS') return false; throw e; }
  }
  async function add(col, data) {
    const j = await call('POST', `${BASE()}/${col}`, { fields: encFields(data) });
    return j.name.split('/').pop();
  }
  async function list(col, { pageSize = 100, orderBy } = {}) {
    const j = await call('GET', `${BASE()}/${col}?pageSize=${pageSize}${orderBy ? `&orderBy=${encodeURIComponent(orderBy)}` : ''}`);
    return (j.documents || []).map(decDoc);
  }
  // tek sayfa + sonraki sayfanın anahtarı (alt koleksiyonlarda da çalışır)
  async function listPage(col, { pageSize = 300, pageToken = '' } = {}) {
    const j = await call('GET', `${BASE()}/${col}?pageSize=${pageSize}${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`);
    return { docs: (j.documents || []).map(decDoc), next: j.nextPageToken || '' };
  }
  async function batchGet(paths) {
    if (!paths.length) return [];
    const out = [];
    for (let i = 0; i < paths.length; i += 100) {
      const r = await fetch(`${BASE()}:batchGet`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await token()}` },
        body: JSON.stringify({ documents: paths.slice(i, i + 100).map(NAME) })
      });
      const arr = await r.json();
      if (!r.ok) throw new Error('Bulut hatası: ' + ((arr.error && arr.error.message) || r.status));
      for (const x of arr) if (x.found) out.push(decDoc(x.found));
    }
    return out;
  }

  // where: [['field', 'EQUAL'|'ARRAY_CONTAINS'|'GREATER_THAN'|..., value], ...]
  async function query(col, { where = [], orderBy = [], limit, parent = '' } = {}) {
    const filters = where.map(([field, op, value]) => ({ fieldFilter: { field: { fieldPath: field }, op, value: enc(value) } }));
    const sq = { from: [{ collectionId: col.split('/').pop() }] };
    if (filters.length === 1) sq.where = filters[0];
    else if (filters.length > 1) sq.where = { compositeFilter: { op: 'AND', filters } };
    if (orderBy.length) sq.orderBy = orderBy.map(([f, d]) => ({ field: { fieldPath: f }, direction: d === 'desc' ? 'DESCENDING' : 'ASCENDING' }));
    if (limit) sq.limit = limit;
    const parentPath = col.includes('/') ? `${BASE()}/${col.split('/').slice(0, -1).join('/')}` : BASE();
    const j = await call('POST', `${parentPath}:runQuery`, { structuredQuery: sq });
    return (Array.isArray(j) ? j : []).filter((x) => x.document).map((x) => decDoc(x.document));
  }

  // writes: [{ set: path, data, mask? , exists? }, { delete: path }, { transform: path, increments: {field: n}, serverTime: [fields] }]
  async function commit(writes) {
    const body = {
      writes: writes.map((w) => {
        if (w.delete) return { delete: NAME(w.delete) };
        const out = { update: { name: NAME(w.set), fields: encFields(w.data || {}) } };
        if (w.mask) out.updateMask = { fieldPaths: w.mask };
        if (w.exists !== undefined) out.currentDocument = { exists: w.exists };
        const tr = [];
        for (const [f, n] of Object.entries(w.increments || {})) tr.push({ fieldPath: f, increment: enc(n) });
        for (const f of w.serverTime || []) tr.push({ fieldPath: f, setToServerValue: 'REQUEST_TIME' });
        if (tr.length) out.updateTransforms = tr;
        return out;
      })
    };
    return call('POST', `${BASE()}:commit`, body);
  }

  // ------------------------------------------------------------ Realtime Database
  const rt = (p) => `${rtdbUrl()}/${p}.json`;
  async function rtCall(method, p, body) {
    const t = await token();
    const r = await fetch(`${rt(p)}?auth=${encodeURIComponent(t)}`, { method, headers: { 'Content-Type': 'application/json' }, body: body !== undefined ? JSON.stringify(body) : undefined });
    const j = await r.json().catch(() => null);
    if (!r.ok) throw new Error('Anlık bağlantı hatası: ' + ((j && j.error) || r.status));
    return j;
  }
  const rtGet = (p) => rtCall('GET', p);
  const rtSet = (p, v) => rtCall('PUT', p, v);
  const rtPush = (p, v) => rtCall('POST', p, v);
  const rtPatch = (p, v) => rtCall('PATCH', p, v);
  const rtDel = (p) => rtCall('DELETE', p);

  // Sunucudan gelen olay akışı (EventSource). onEvent({ event, path, data }). Kopunca yeniden bağlanır.
  function rtListen(p, onEvent, onState = () => {}) {
    let stopped = false, ctrl = null, retry = 1000;
    (async function loop() {
      while (!stopped) {
        try {
          const t = await token();
          ctrl = new AbortController();
          const r = await fetch(`${rt(p)}?auth=${encodeURIComponent(t)}`, { headers: { Accept: 'text/event-stream' }, signal: ctrl.signal, redirect: 'follow' });
          if (!r.ok || !r.body) throw new Error('akış ' + r.status);
          onState('open'); retry = 1000;
          const reader = r.body.getReader();
          const dec = new TextDecoder();
          let buf = '';
          for (;;) {
            const { value, done } = await reader.read();
            if (done) break;
            buf += dec.decode(value, { stream: true });
            let i;
            while ((i = buf.indexOf('\n\n')) >= 0) {
              const block = buf.slice(0, i); buf = buf.slice(i + 2);
              const ev = (block.match(/^event: (.*)$/m) || [])[1];
              const data = (block.match(/^data: (.*)$/m) || [])[1];
              if (ev === 'auth_revoked' || ev === 'cancel') { ctrl.abort(); break; }
              if ((ev === 'put' || ev === 'patch') && data) { try { onEvent({ event: ev, ...JSON.parse(data) }); } catch {} }
            }
          }
        } catch (e) { if (stopped) return; onState('closed', e); }
        if (stopped) return;
        await new Promise((r) => setTimeout(r, retry));
        retry = Math.min(retry * 2, 30000);
      }
    })();
    return () => { stopped = true; if (ctrl) ctrl.abort(); };
  }

  return { get, set, patch, del, create, add, list, listPage, batchGet, query, commit, enc, dec, ts: (ms) => ({ __ts: ms }),
    rtGet, rtSet, rtPush, rtPatch, rtDel, rtListen };
};

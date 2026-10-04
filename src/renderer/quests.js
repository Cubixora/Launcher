/* Görevler & Seviye: seviye ağacı + etkinlik görev zincirleri (admin panelinden yönetilir) */
const Quests = (() => {
  let data = null, busy = false, treeFrom = null;
  const TIER_COL = { Bronz: '#c98a4b', Gümüş: '#b9c2cc', Altın: '#f5c542', Platin: '#7fe3d6', Elmas: '#6cc4ff', Usta: '#c08bff', Efsane: '#ff6a5c' };
  const coinIc = '<i class="coin-ic">C</i>';

  async function enter(silent) {
    const body = $('#questBody');
    if (typeof Giveaways !== 'undefined') Giveaways.enter(silent);
    if (!S.social) { body.innerHTML = '<div class="empty"><div class="empty-ic">🔒</div><h3>Görevler kapalı</h3><p>Görev yapmak için Google ya da Cubixora (e-posta) hesabıyla giriş yap.</p></div>'; return; }
    if (!silent) body.innerHTML = '<div class="skeleton"></div>'.repeat(2);
    try { data = await sc('questView'); } catch (e) { body.innerHTML = `<div class="empty"><p>${esc(e.message)}</p></div>`; return; }
    render();
  }

  // yuvarlatılmış altıgen rozet: dış çizgi seviye ilerlemesini gösterir
  const HEX = (() => {   // simetrik, köşeleri yumuşatılmış altıgen
    const cx = 36, cy = 40, R = 37, r = 7, P = [];
    for (let i = 0; i < 6; i++) { const a = ((-90 + i * 60) * Math.PI) / 180; P.push([cx + R * Math.cos(a), cy + R * Math.sin(a)]); }
    let d = '';
    P.forEach((v, i) => {
      const p = P[(i + 5) % 6], n = P[(i + 1) % 6], L = Math.hypot(p[0] - v[0], p[1] - v[1]), t = r / L;
      const a = [v[0] + (p[0] - v[0]) * t, v[1] + (p[1] - v[1]) * t], b = [v[0] + (n[0] - v[0]) * t, v[1] + (n[1] - v[1]) * t];
      d += `${i ? 'L' : 'M'}${a[0].toFixed(2)} ${a[1].toFixed(2)}Q${v[0].toFixed(2)} ${v[1].toFixed(2)} ${b[0].toFixed(2)} ${b[1].toFixed(2)}`;
    });
    return d + 'Z';
  })();
  function hexBadge(L, col, pct) {
    return `<div class="lv-hex" style="--c:${col}"><svg viewBox="0 0 72 80" aria-hidden="true">
      <defs><linearGradient id="hxg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${col}" stop-opacity=".30"/><stop offset="1" stop-color="#0b0f0d"/></linearGradient></defs>
      <path d="${HEX}" class="hx-bg" fill="url(#hxg)"/><path d="${HEX}" class="hx-track" pathLength="100"/><path d="${HEX}" class="hx-fill" pathLength="100" style="--p:${pct.toFixed(1)}"/></svg><span>${L.level}</span></div>`;
  }
  function levelCard(L) {
    const col = TIER_COL[L.tier] || '#ccc';
    const pct = Math.max(0, Math.min(100, ((L.lp - L.cur) / Math.max(1, L.next - L.cur)) * 100));
    // kademe çizgisinin doluluğu
    const T = L.tiers; let idx = 0; T.forEach(([, from], i) => { if (L.level >= from) idx = i; });
    const frac = idx >= T.length - 1 ? 1 : (idx + Math.min(1, (L.level - T[idx][1]) / (T[idx + 1][1] - T[idx][1]))) / (T.length - 1);
    const tiers = T.map(([n, from], i) => `<div class="tr-i ${L.level >= from ? 'on' : ''} ${i === idx ? 'cur' : ''}" style="--c:${TIER_COL[n] || '#ccc'}"><i></i><b>${esc(n)}</b><small>Sv ${from}+</small></div>`).join('');
    const nxt = L.nextTier ? `<div class="lv-nt"><small>SONRAKİ KADEME</small><b style="color:${TIER_COL[L.nextTier.name] || '#fff'}">${esc(L.nextTier.name)}</b><small>${L.nextTier.left} seviye kaldı</small></div>` : '<div class="lv-nt"><small>KADEME</small><b>En üst</b></div>';
    return `<div class="lv-card" style="--c:${col}">
      <div class="lv-top">${hexBadge(L, col, pct)}
        <div class="lv-info"><div class="lv-name"><b>Seviye ${L.level}</b><span class="lv-tier">${esc(L.tier)}</span></div>
          <div class="lv-bar"><i style="--w:${pct.toFixed(1)}%"></i></div>
          <div class="lv-sub"><span>Toplam <b>${L.lp.toLocaleString('tr-TR')} LP</b></span><span>${(L.lp - L.cur).toLocaleString('tr-TR')} / ${(L.next - L.cur).toLocaleString('tr-TR')} LP → Sv ${L.level + 1}</span></div></div>
        ${nxt}</div>
      <div class="lv-tiers"><div class="tr-track"><i style="--f:${(frac * 100).toFixed(1)}%"></i></div>${tiers}</div></div>`;
  }

  function tree(L) {
    const rows = L.rows;
    const start = treeFrom == null ? Math.max(1, L.level - 4) : treeFrom;
    const view = rows.slice(start - 1, start - 1 + 13);
    const pending = rows.filter((r) => r.reachable && !r.claimed);
    const nodes = view.map((r) => {
      const st = r.reachable ? (r.claimed ? 'done' : 'ready') : 'locked';
      return `<div class="tn ${st}" data-n="${r.n}"><div class="tn-c">${r.n}</div><div class="tn-s">${st === 'ready' ? `<button class="claim-btn" data-lvl="${r.n}" data-coins="${r.coins}"><span>AL</span><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></button><small>${r.coins} coin</small>` : st === 'done' ? '<small class="ok">✓ Alındı</small>' : `<small>${r.coins} coin</small>`}</div></div>`;
    }).join('');
    return `<div class="lt-head"><div><b>SEVİYE AĞACI</b><span>Her seviyede coin ödülü; her 5. seviyede büyük ödül</span></div><div class="lt-ctl">
      ${pending.length ? `<button class="claim-btn wide" id="lvAll"><span>Tümünü Al (${pending.length})</span><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></button>` : ''}<button class="icon-btn small" id="lvPrev" ${start <= 1 ? 'disabled' : ''}>‹</button><button class="icon-btn small" id="lvNext">›</button></div></div>
      <div class="lt-row">${nodes}</div>`;
  }

  function rewardCard(e) {
    const r = e.reward; if (!r) return '';
    const can = e.allClaimed && !e.rewardClaimed;
    const prev = r.texture ? `<div class="sh-prev pv-cape" data-src="${esc(r.texture)}"><canvas></canvas></div>` : '<div class="sh-prev">🧥</div>';
    return `<div class="q-reward ${e.rewardClaimed ? 'got' : ''}">${prev}
      <div class="q-rw-t"><small>ZİNCİRİN ÖDÜLÜ · ${r.days} GÜN SÜRELİ</small><b>${esc(r.name)}</b>
        <p>${e.rewardClaimed ? 'Ödülü aldın! Envanterinden takabilirsin; süresi dolunca otomatik çıkar.' : `Tüm adımları bitirip ödüllerini alınca ${esc(r.name)} senin olur. Aldığın andan itibaren ${r.days} gün kullanabilirsin.`}</p></div>
      ${e.rewardClaimed ? '<button class="btn btn-ghost small" disabled>Alındı ✓</button>' : `<button class="btn ${can ? 'btn-primary' : 'btn-ghost'} small" data-rw="${esc(e.id)}" ${can ? '' : 'disabled'}>Ödülü Al</button>`}</div>`;
  }

  function step(e, s, i) {
    const pct = Math.min(100, (s.progress / s.goal) * 100);
    const state = s.claimed ? 'done' : s.ready ? 'ready' : '';
    const chips = `${s.lp ? `<span class="chip">+${s.lp} LP</span>` : ''}${s.coins ? `<span class="chip">${coinIc}${s.coins}</span>` : ''}`;
    return `<div class="q-step ${state}" data-sk="${esc(e.id)}:${esc(s.id)}"><div class="q-n">${s.claimed ? '✓' : i + 1}</div>
      <div class="q-main"><div class="q-t"><b>${esc(s.title)}</b><div class="q-chips">${chips}</div></div>${s.desc ? `<small>${esc(s.desc)}</small>` : ''}
        <div class="q-bar"><i style="width:${pct}%"></i></div></div>
      <div class="q-side"><small>${s.progress} / ${s.goal}</small>${s.claimed ? '<span class="ok">Alındı</span>' : s.ready ? `<button class="claim-btn" data-st="${esc(e.id)}:${esc(s.id)}" data-coins="${s.coins}"><span>AL</span><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></button>` : ''}</div></div>`;
  }

  function eventCard(e) {
    const done = e.steps.filter((s) => s.claimed).length;
    return `<div class="q-event" data-ev="${esc(e.id)}"><small class="q-kicker">ETKİNLİK GÖREVLERİ</small>
      <div class="q-head"><div><h2>${esc(e.title)}</h2>${e.desc ? `<p>${esc(e.desc)}</p>` : ''}</div>
        <div class="q-meta"><span class="chip big q-cnt">${done} / ${e.steps.length} adım</span>${e.endsAt ? `<span class="chip big" data-ends="${e.endsAt}"></span>` : ''}</div></div>
      <div class="q-prog"><i style="width:${e.steps.length ? (done / e.steps.length) * 100 : 0}%"></i></div>
      ${rewardCard(e)}<div class="q-steps">${e.steps.map((s, i) => step(e, s, i)).join('')}</div></div>`;
  }

  function render() {
    const body = $('#questBody');
    if (!Array.isArray(data.events)) data.events = [];
    const evs = data.events.length ? data.events.map(eventCard).join('') : '<div class="empty small"><div class="empty-ic">🎯</div><h3>Şu an aktif etkinlik görevi yok</h3><p>Yeni görevler eklendiğinde burada görünecek.</p></div>';
    body.innerHTML = levelCard(data.level) + `<div class="lt-wrap">${tree(data.level)}</div>` + evs;
    Store.hydrate(body);
    bind(body);
  }

  // ---- anlık (iyimser) alma: animasyon hemen başlar, sunucu arka planda onaylar
  function burst(btn, coins) {
    const host = btn.closest('.tn, .q-step') || btn.parentNode, hr = host.getBoundingClientRect(), br = btn.getBoundingClientRect();
    const cx0 = br.left - hr.left + br.width / 2, cy0 = br.top - hr.top + br.height / 2;
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
    const layer = document.createElement('div'); layer.className = 'cl-fx'; layer.style.cssText = `left:${cx0}px;top:${cy0}px`;
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + Math.random() * 0.5, d = 34 + Math.random() * 30, p = document.createElement('i');
      p.style.cssText = `--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d - 14}px;--r:${(Math.random() * 360) | 0}deg;animation-delay:${(i * 12)}ms`;
      layer.appendChild(p);
    }
    if (coins) { const t = document.createElement('b'); t.textContent = `+${coins}`; layer.appendChild(t); }
    host.appendChild(layer); setTimeout(() => layer.remove(), 1100);
  }
  function tweenCoins(from, to) {
    const el = $('#coinCount'); if (!el || from === to) return;
    const t0 = performance.now(), D = 650; el.classList.add('bump');
    const f = (t) => { const k = Math.min(1, (t - t0) / D), e = 1 - Math.pow(1 - k, 3); el.textContent = fmtNum(Math.round(from + (to - from) * e)); if (k < 1) requestAnimationFrame(f); else { el.classList.remove('bump'); renderWallet(); } };
    requestAnimationFrame(f);
  }
  async function claim(btn, fn, apply) {
    if (btn.classList.contains('claiming')) return;
    const coins = Number(btn.dataset.coins) || 0;
    btn.classList.add('claiming'); burst(btn, coins);
    const had = S.me && S.me.wallet ? S.me.wallet.coins : 0;
    try {
      const r = await fn();
      if (S.me && S.me.wallet) { S.me.wallet.coins = had + (r && r.coins != null ? r.coins : coins); S.me.wallet.lp = (S.me.wallet.lp || 0) + ((r && r.lp) || 0); tweenCoins(had, S.me.wallet.coins); }
      apply(btn);
    } catch (e) { btn.classList.remove('claiming'); toast(e.message, 'error'); enter(true); }
  }
  function patchStep(btn) {
    const [eid, sid] = btn.dataset.st.split(':'), ev = data.events.find((x) => x.id === eid), st = ev && ev.steps.find((x) => x.id === sid);
    if (st) { st.claimed = true; st.ready = false; }
    const row = btn.closest('.q-step');
    setTimeout(() => {
      row.classList.remove('ready'); row.classList.add('done', 'just');
      row.querySelector('.q-n').textContent = '✓';
      btn.replaceWith(Object.assign(document.createElement('span'), { className: 'ok', textContent: 'Alındı' }));
      if (ev) refreshEvent(ev);
    }, 520);
  }
  function refreshEvent(ev) {
    const card = $(`.q-event[data-ev="${ev.id}"]`); if (!card) return;
    const done = ev.steps.filter((x) => x.claimed).length; ev.allClaimed = done === ev.steps.length;
    card.querySelector('.q-cnt').textContent = `${done} / ${ev.steps.length} adım`;
    card.querySelector('.q-prog i').style.width = `${(done / ev.steps.length) * 100}%`;
    const rb = card.querySelector('[data-rw]');
    if (rb && ev.allClaimed && !ev.rewardClaimed) { rb.disabled = false; rb.className = 'btn btn-primary small rw-ready'; }
  }
  function patchLevel(btn) {
    const n = Number(btn.dataset.lvl), row = data.level.rows[n - 1]; if (row) row.claimed = true;
    const node = btn.closest('.tn');
    setTimeout(() => {
      node.classList.remove('ready'); node.classList.add('done', 'just');
      node.querySelector('.tn-s').innerHTML = '<small class="ok">✓ Alındı</small>';
      const left = data.level.rows.filter((r) => r.reachable && !r.claimed).length, all = $('#lvAll');
      if (all) { if (left) all.querySelector('span').textContent = `Tümünü Al (${left})`; else all.remove(); }
    }, 520);
  }
  async function run(fn, okMsg) {
    if (busy) return; busy = true;
    try { await fn(); if (okMsg) toast(okMsg, 'success'); } catch (e) { toast(e.message, 'error'); }
    busy = false;
    try { S.me = await sc('refreshMe'); renderWallet(); } catch {}
    enter(true);
  }
  function bind(body) {
    $$('[data-st]', body).forEach((b) => (b.onclick = () => { const [e, s] = b.dataset.st.split(':'); claim(b, () => sc('claimQuestStep', e, s), patchStep); }));
    $$('[data-rw]', body).forEach((b) => (b.onclick = () => { b.classList.add('claiming'); run(() => sc('claimQuestReward', b.dataset.rw)); }));
    $$('[data-lvl]', body).forEach((b) => (b.onclick = () => claim(b, () => sc('claimLevel', Number(b.dataset.lvl)), patchLevel)));
    const all = $('#lvAll', body);
    if (all) all.onclick = async () => {
      if (all.classList.contains('claiming')) return; all.classList.add('claiming');
      const btns = $$('[data-lvl]', body);
      for (const b of btns) { await claim(b, () => sc('claimLevel', Number(b.dataset.lvl)), patchLevel); await new Promise((r) => setTimeout(r, 90)); }
    };
    const prev = $('#lvPrev', body), next = $('#lvNext', body);
    const base = () => (treeFrom == null ? Math.max(1, data.level.level - 4) : treeFrom);
    if (prev) prev.onclick = () => { treeFrom = Math.max(1, base() - 6); render(); };
    if (next) next.onclick = () => { treeFrom = Math.min(data.level.rows.length - 12, base() + 6); render(); };
  }

  // ilerleme ya da süre değişince sayfa açıksa yenile
  if (typeof cx !== 'undefined') {
    cx.on('social:quest', () => { const p = $('.page.active'); if (p && p.dataset.page === 'quests') enter(true); });
    cx.on('timed:expired', () => {
      toast('Süreli kozmetiğinin süresi doldu; otomatik çıkarıldı.', '');
      sc('refreshMe').then((s) => { S.me = s; renderWallet(); const p = $('.page.active'); if (p && p.dataset.page === 'inventory') Store.enterInventory(); if (p && p.dataset.page === 'quests') enter(true); }).catch(() => {});
    });
  }
  return { enter };
})();

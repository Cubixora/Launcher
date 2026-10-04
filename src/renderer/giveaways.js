/* Çekilişler: Görevler sayfasının üstünde. Admin çekilişi koşullarla açar; oyuncu görevleri bitirince katılır,
   sonuç açıklanınca kazanıp kazanmadığını görür. Sadece bu bölüm yeniden çizilir; sayfanın geri kalanına dokunulmaz. */
const Giveaways = (() => {
  let data = null, gen = 0, busy = false;
  const box = () => $('#gwBody');
  const fmtDate = (t) => new Date(t).toLocaleString('tr-TR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
  const reduce = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const CHECK = '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

  async function enter(silent) {
    const el = box(); if (!el) return;
    if (!S.social) { el.innerHTML = ''; return; }
    const g = ++gen;
    if (!silent && !data) el.innerHTML = '<div class="skeleton gw-sk"></div>';
    try { const d = await sc('giveawayView'); if (g !== gen) return; data = d; }
    catch (e) { if (g !== gen) return; if (!data) el.innerHTML = ''; return; }
    render();
  }

  function statusPill(g) {
    if (g.status === 'drawn') return g.won ? '<span class="gw-pill win">🏆 KAZANDIN</span>' : '<span class="gw-pill done">AÇIKLANDI</span>';
    if (g.status === 'pending') return '<span class="gw-pill wait"><i class="gw-dot"></i>AÇIKLANIYOR</span>';
    if (g.status === 'soon') return '<span class="gw-pill soon">YAKINDA</span>';
    return '<span class="gw-pill live"><i class="gw-dot"></i>AKTİF</span>';
  }
  function cond(c) {
    const pct = Math.min(100, (c.progress / c.goal) * 100), done = c.progress >= c.goal;
    const val = /minutes$/.test(c.stat) ? `${fmtMins(c.progress)} / ${fmtMins(c.goal)}` : `${c.progress} / ${c.goal}`;
    return `<div class="gw-cond ${done ? 'done' : ''}"><i class="gw-ck">${done ? CHECK : ''}</i>
      <div class="gw-cm"><div class="gw-ct"><b>${esc(c.title)}</b><small>${done ? 'Tamamlandı' : val}</small></div>
      <div class="gw-bar"><i style="--w:${pct.toFixed(1)}%"></i></div></div></div>`;
  }
  const fmtMins = (m) => (m < 60 ? `${m} dk` : `${Math.floor(m / 60)} sa${m % 60 ? ` ${m % 60} dk` : ''}`);

  function action(g) {
    const doneN = g.conds.filter((c) => c.progress >= c.goal).length;
    if (g.status === 'drawn') {
      const list = g.winners.length ? `<div class="gw-winners"><small>KAZANAN${g.winners.length > 1 ? 'LAR' : ''}</small>${g.winners.map((w) => `<span>${esc(w)}</span>`).join('')}</div>` : '<div class="gw-winners"><small>Katılımcı olmadığı için kazanan çıkmadı.</small></div>';
      const me = g.won ? '<div class="gw-result win"><b>🎉 Tebrikler, çekilişi kazandın!</b><span>Ödülün için yetkililer seninle iletişime geçecek.</span></div>'
        : g.joined ? '<div class="gw-result lose"><b>Bu sefer kazanamadın</b><span>Katıldığın için teşekkürler, bir sonrakinde şansın bol olsun!</span></div>' : '';
      return `${me}${list}<div class="gw-foot">Bu çekiliş <b data-left="${g.deleteAt}"></b> sonra kaldırılacak.</div>`;
    }
    if (g.status === 'pending') return `<div class="gw-result wait"><b>Sonuçlar açıklanıyor…</b><span>${g.joined ? 'Katılımın kayıtlı. Kazananlar birazdan burada görünecek.' : 'Katılım süresi doldu.'}</span></div>`;
    if (g.status === 'soon') return `<div class="gw-foot">Çekiliş <b>${fmtDate(g.startsAt)}</b> tarihinde başlayacak.</div>`;
    if (g.joined) return `<div class="gw-joined"><i>${CHECK}</i><div><b>Çekilişe katıldın!</b><span>Sonuçlar <b>${fmtDate(g.drawAt)}</b> tarihinde açıklanacak · <b data-ends="${g.drawAt}"></b></span></div></div>`;
    if (g.ready) return `<button class="gw-join" data-join="${esc(g.id)}"><span>Görevleri tamamladın · Çekilişe katılmak için tıkla</span><i class="gw-shine"></i></button>`;
    return `<button class="gw-join locked" disabled><span>Görevleri tamamla (${doneN} / ${g.conds.length})</span></button>`;
  }

  function card(g, i) {
    const art = g.image ? `<div class="gw-art" style="background-image:url('${esc(g.image)}')"></div>` : '<div class="gw-art gw-art-def"><span>🎁</span></div>';
    const cls = ['gw-card', g.status, g.ready && g.status === 'open' && !g.joined ? 'ready' : '', g.joined ? 'joined' : '', g.won ? 'won' : ''].join(' ');
    return `<article class="${cls}" data-gw="${esc(g.id)}" style="--d:${i * 60}ms">
      <div class="gw-glow"></div>${art}
      <div class="gw-main">
        <div class="gw-top"><small class="gw-kick">ÇEKİLİŞ</small>${statusPill(g)}</div>
        <h2>${esc(g.title)}</h2>${g.desc ? `<p class="gw-desc">${esc(g.desc)}</p>` : ''}
        <div class="gw-meta">${g.prize ? `<span class="gw-chip prize">🏆 ${esc(g.prize)}</span>` : ''}
          <span class="gw-chip">👥 ${g.entries.toLocaleString('tr-TR')} katılımcı</span>
          <span class="gw-chip">🎟️ ${g.winnerCount} kazanan</span>
          ${g.status === 'open' ? `<span class="gw-chip time">⏱ <b data-ends="${g.drawAt}"></b></span>` : ''}</div>
        ${g.status === 'drawn' || g.status === 'pending' ? '' : `<div class="gw-conds">${g.conds.map(cond).join('')}</div>`}
        <div class="gw-act">${action(g)}</div>
      </div></article>`;
  }

  // ilk çizimde kartlar sırayla belirir; sonraki güncellemelerde sadece değişen kart yenilenir (ilerleme çubukları kaymadan dolar)
  const shown = new Map();
  function render() {
    const el = box(); if (!el || !data) return;
    const list = data.list || [];
    if (!list.length) { el.innerHTML = ''; shown.clear(); return; }
    let listEl = el.querySelector('.gw-list');
    const first = !listEl;
    if (first) {
      el.innerHTML = '<div class="gw-head"><b>ÇEKİLİŞLER</b><span>Görevleri tamamla, katıl, kazan</span></div><div class="gw-list"></div>';
      listEl = el.querySelector('.gw-list'); shown.clear();
    }
    const ids = new Set(list.map((g) => g.id));
    for (const c of [...listEl.children]) if (!ids.has(c.dataset.gw)) { c.remove(); shown.delete(c.dataset.gw); }
    list.forEach((g, i) => {
      const html = card(g, i);
      let cur = listEl.querySelector(`[data-gw="${CSS.escape(g.id)}"]`);
      if (!cur || shown.get(g.id) !== html) {
        const t = document.createElement('template'); t.innerHTML = html.trim();
        const node = t.content.firstElementChild;
        if (!first) node.classList.add('still');
        if (cur) cur.replaceWith(node); else listEl.appendChild(node);
        shown.set(g.id, html); cur = node;
      }
      if (listEl.children[i] !== cur) listEl.insertBefore(cur, listEl.children[i] || null);
    });
  }

  function confetti(host) {
    if (reduce()) return;
    const r = host.getBoundingClientRect(), layer = document.createElement('div');
    layer.className = 'gw-confetti';
    const cols = ['#f5c542', '#ffffff', '#3ddc84', '#6cc4ff', '#ff6a9a'];
    const frag = document.createDocumentFragment();
    for (let i = 0; i < 28; i++) {
      const p = document.createElement('i'), a = Math.random() * Math.PI * 2, d = 60 + Math.random() * 120;
      p.style.cssText = `--x:${Math.cos(a) * d}px;--y:${Math.sin(a) * d - 60}px;--r:${(Math.random() * 720) | 0}deg;background:${cols[i % cols.length]};animation-delay:${(Math.random() * 90) | 0}ms`;
      frag.appendChild(p);
    }
    layer.appendChild(frag);
    layer.style.left = `${r.width / 2}px`; layer.style.top = `${r.height / 2}px`;
    host.appendChild(layer);
    setTimeout(() => layer.remove(), 1400);
  }

  async function join(btn) {
    if (busy) return; busy = true;
    const id = btn.dataset.join, g = data && data.list.find((x) => x.id === id);
    btn.disabled = true; btn.classList.add('loading'); btn.querySelector('span').textContent = 'Katılınıyor…';
    try {
      await sc('joinGiveaway', id);
      if (g) { g.joined = true; g.entries += 1; }
      const cardEl = btn.closest('.gw-card');
      if (cardEl && g) {
        cardEl.classList.remove('ready'); cardEl.classList.add('joined', 'just');
        cardEl.querySelector('.gw-act').innerHTML = action(g);
        const chip = cardEl.querySelectorAll('.gw-chip')[g.prize ? 1 : 0]; if (chip) chip.textContent = `👥 ${g.entries.toLocaleString('tr-TR')} katılımcı`;
        confetti(cardEl);
      }
      toast('Çekilişe katıldın! Bol şans 🍀', 'success');
      if (typeof Sound !== 'undefined') Sound.play('achievement');
    } catch (e) {
      toast(e.message, 'error');
      btn.disabled = false; btn.classList.remove('loading'); btn.querySelector('span').textContent = 'Görevleri tamamladın · Çekilişe katılmak için tıkla';
    }
    busy = false;
  }

  function bindOnce() {
    const el = box(); if (!el || el.dataset.bound) return;
    el.dataset.bound = '1';
    el.addEventListener('click', (e) => { const b = e.target.closest('[data-join]'); if (b && !b.disabled) join(b); });
  }

  // görev ilerledi / çekiliş açıklandı: sayfa açıksa sadece bu bölüm yenilenir (1,5 sn içindeki istekler birleşir)
  let pend = null;
  function refreshSoon() {
    clearTimeout(pend);
    pend = setTimeout(() => { const p = $('.page.active'); if (p && p.dataset.page === 'quests' && !document.hidden) enter(true); }, 1500);
  }
  if (typeof cx !== 'undefined') cx.on('social:giveaways', refreshSoon);

  return { enter: (s) => { bindOnce(); return enter(s); } };
})();

/* Sunucular sayfası: partner sunucular (admin ekler) ve oyuncunun kendi kaydettiği sunucular */
const Servers = (() => {
  let list = [], bound = false, q = '', cat = '', lang = '';
  const has = (v) => !!String(v || '').trim();
  const tagsOf = (p) => String(p.tags || '').split(',').map((t) => t.trim()).filter(Boolean);

  async function enter() {
    bindOnce();
    $('#svGrid').innerHTML = '<div class="skeleton sv-sk"></div>'.repeat(3);
    try { list = ((await sc('partners')) || []).filter((p) => p.active !== false); } catch { list = []; }
    fillFilters();
    render();
  }
  function fillFilters() {
    const cats = [...new Set(list.flatMap(tagsOf))].sort((a, b) => a.localeCompare(b, 'tr'));
    const langs = [...new Set(list.map((p) => (p.lang || 'TR').toUpperCase()))].sort();
    $('#svCat').innerHTML = '<option value="">Tüm Kategoriler</option>' + cats.map((c) => `<option ${c === cat ? 'selected' : ''}>${esc(c)}</option>`).join('');
    $('#svLang').innerHTML = '<option value="">Tüm Diller</option>' + langs.map((l) => `<option ${l === lang ? 'selected' : ''}>${esc(l)}</option>`).join('');
  }
  function card(p, i) {
    const tags = tagsOf(p);
    return `<div class="sv-card" data-i="${i}" style="animation-delay:${i * 0.04}s">
      <div class="sv-banner" style="${p.banner ? `background-image:url('${esc(p.banner)}')` : ''}">
        <span class="sv-badge"><i></i>Partner</span>
        <span class="sv-count" data-ping="${esc(p.ip)}"><i></i><b>…</b></span>
      </div>
      <div class="sv-body">
        <div class="sv-id">${p.logo ? `<img src="${esc(p.logo)}" alt="" draggable="false" />` : `<span class="sv-ph">${esc((p.name || '?')[0])}</span>`}
          <div><b>${esc(p.name)}</b><code>${esc(p.ip)}</code></div></div>
        ${p.desc ? `<p class="sv-desc">${esc(p.desc)}</p>` : ''}
        <div class="sv-tags"><span class="sv-tag lang">🌐 ${esc((p.lang || 'TR').toUpperCase())}</span>${tags.map((t) => `<span class="sv-tag">${esc(t)}</span>`).join('')}</div>
        <div class="sv-actions">
          ${has(p.website) ? `<button class="btn btn-ghost sv-web" data-web><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></svg>Web Sitesi</button>` : ''}
          ${has(p.discord) ? '<button class="btn btn-ghost sv-web" data-discord>Discord</button>' : ''}
          <button class="btn btn-primary sv-join" data-join><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>Katıl</button>
        </div>
      </div></div>`;
  }
  function render() {
    const box = $('#svGrid'), f = q.toLowerCase();
    const shown = list.map((p, i) => [p, i]).filter(([p]) => (!cat || tagsOf(p).includes(cat)) && (!lang || (p.lang || 'TR').toUpperCase() === lang)
      && (!f || (p.name || '').toLowerCase().includes(f) || (p.ip || '').toLowerCase().includes(f) || tagsOf(p).some((t) => t.toLowerCase().includes(f))));
    box.innerHTML = shown.length ? shown.map(([p, i]) => card(p, i)).join('')
      : `<div class="empty sv-empty"><div class="empty-ic">🎮</div><h3>${list.length ? 'Sonuç bulunamadı' : 'Henüz partner sunucu yok'}</h3><p>${list.length ? 'Filtreleri değiştirip tekrar dene.' : 'Partner sunucular eklendiğinde burada görünecek.'}</p></div>`;
    pingAll();
  }
  // oyuncu sayıları: ekrandaki kartlar için sırayla sorulur (sonuçlar 45 sn önbellekte)
  async function pingAll() {
    for (const el of $$('#svGrid [data-ping]')) {
      cx.pingServer(el.dataset.ping).then((r) => {
        if (!el.isConnected) return;
        el.classList.toggle('off', !r.online);
        el.querySelector('b').textContent = r.online ? `${r.players.toLocaleString('tr-TR')} / ${r.max.toLocaleString('tr-TR')}` : 'Kapalı';
        el.title = r.online ? `${r.ping} ms${r.version ? ' · ' + r.version : ''}` : 'Sunucuya ulaşılamadı';
      }).catch(() => {});
    }
  }
  function bindOnce() {
    if (bound) return; bound = true;
    $('#svSearch').oninput = (e) => { q = e.target.value; render(); };
    $('#svCat').onchange = (e) => { cat = e.target.value; render(); };
    $('#svLang').onchange = (e) => { lang = e.target.value; render(); };
    $('#svGrid').onclick = async (e) => {
      const c = e.target.closest('.sv-card'); if (!c) return;
      const i = Number(c.dataset.i);
      const p = list[i]; if (!p) return;
      if (e.target.closest('[data-web]')) return cx.openUrl(p.website);
      if (e.target.closest('[data-discord]')) return cx.openUrl(p.discord);
      if (e.target.closest('[data-join]')) Social.joinPartner(p);
    };
  }
  return { enter };
})();

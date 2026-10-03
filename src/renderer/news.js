/* Haberler sayfası: admin panelinden yayınlanan duyurular kart olarak görünür */
const News = (() => {
  let list = [];
  const date = (t) => { try { return new Date(t).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }); } catch { return ''; } };
  const card = (n) => `<article class="news-card" data-id="${esc(n.id)}">
    <div class="news-img" style="${n.image ? `background-image:url('${esc(n.image)}')` : ''}">${n.image ? '' : '<span>Cubixora</span>'}</div>
    <div class="news-body"><span class="news-tag t-${esc(String(n.tag || '').toLowerCase().replace(/[^a-zçğıöşü]/g, ''))}">${esc(n.tag || 'Duyuru')}</span>
      <h3>${esc(n.title)}</h3><small>${esc(date(n.at))}</small><p>${esc(n.text)}</p></div></article>`;
  function open(n) {
    const m = document.createElement('div');
    m.className = 'news-modal';
    m.innerHTML = `<div class="news-sheet"><button class="icon-btn news-x" title="Kapat"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" /></svg></button>
      ${n.image ? `<div class="news-hero" style="background-image:url('${esc(n.image)}')"></div>` : ''}
      <div class="news-full"><span class="news-tag">${esc(n.tag || 'Duyuru')}</span><h2>${esc(n.title)}</h2><small>${esc(date(n.at))}</small>
      <div class="news-text">${esc(n.text).replace(/\n/g, '<br>')}</div></div></div>`;
    const close = () => { m.classList.remove('in'); setTimeout(() => m.remove(), 180); };
    m.onclick = (e) => { if (e.target === m || e.target.closest('.news-x')) close(); };
    document.body.appendChild(m);
    requestAnimationFrame(() => m.classList.add('in'));
  }
  async function enter() {
    const box = $('#newsGrid');
    box.innerHTML = '<div class="skeleton"></div>'.repeat(3);
    try { list = await sc('news'); } catch (e) { box.innerHTML = `<div class="empty"><p>${esc(e.message)}</p></div>`; return; }
    box.innerHTML = list.length ? list.map(card).join('') : '<div class="empty"><div class="empty-ic">📰</div><h3>Henüz haber yok</h3><p>Yeni duyurular burada görünecek.</p></div>';
    box.onclick = (e) => { const c = e.target.closest('.news-card'); if (c) { const n = list.find((x) => x.id === c.dataset.id); if (n) open(n); } };
  }
  return { enter };
})();

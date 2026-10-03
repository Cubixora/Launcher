/* İçerik: Modrinth tarayıcısı (mod / doku paketi / shader) ve ana sayfadaki "Yüklü İçerik" */
const Content = (() => {
  const NAMES = { mod: 'mod', resourcepack: 'doku paketi', shader: 'shader' };
  let tab = 'mod', offset = 0, query = '', req = 0, timer = null, bound = false;
  let instTab = 'mod', instFilter = '', instOpen = true, instCache = {};

  const ctProfile = () => S.profiles.find((p) => p.id === $('#ctProfile').value) || selected();

  // ---------------------------------------------------------- tarayıcı
  function enter(type) {
    bindOnce();
    if (type) tab = type;
    const sel = $('#ctProfile');
    const prev = sel.value;
    sel.innerHTML = S.profiles.map((p) => `<option value="${esc(p.id)}">${esc(p.icon || '')} ${esc(p.name)} · ${esc(p.version)} · ${loaderLabel(p)}</option>`).join('');
    sel.value = S.profiles.some((p) => p.id === prev) ? prev : (S.selectedProfile || (S.profiles[0] && S.profiles[0].id));
    setTab(tab);
  }
  // Vanilla profilde mod yoktur: sadece doku paketi ve shader gösterilir
  function modsAllowed(p) { return !!p && p.loader === 'fabric'; }
  function syncTabs(sel, p) {
    const ok = modsAllowed(p);
    $$(sel + ' button[data-t="mod"]').forEach((b) => b.classList.toggle('hidden', !ok));
    return ok;
  }
  function setTab(t) {
    if (t === 'mod' && !syncTabs('#ctTabs', ctProfile())) t = 'resourcepack';
    syncTabs('#ctTabs', ctProfile());
    tab = t;
    $$('#ctTabs button').forEach((b) => b.classList.toggle('active', b.dataset.t === t));
    $('#ctSearch').placeholder = t === 'mod' ? 'Mod ara... (ör. sodium, journeymap)' : t === 'shader' ? 'Shader ara... (ör. complementary, bsl)' : 'Doku paketi ara... (ör. faithful, fresh animations)';
    const p = ctProfile();
    const note = $('#ctNote');
    if (p && t === 'shader') { note.textContent = p.loader === 'fabric' ? 'Shader kurunca Iris ve Sodium da otomatik kurulur.' : 'Vanilla profilde de çalışır: oyun açılırken Iris ve Sodium arka planda otomatik eklenir.'; note.classList.remove('hidden'); }
    else note.classList.add('hidden');
    search(true);
  }
  async function search(reset) {
    const p = ctProfile(); if (!p) { $('#ctResults').innerHTML = '<div class="empty"><p>Önce bir profil oluştur.</p></div>'; return; }
    const box = $('#ctResults');
    if (reset) { offset = 0; box.innerHTML = '<div class="skeleton"></div>'.repeat(5); }
    const my = ++req;
    try {
      const r = await cx.content('search', { type: tab, query, mcVersion: p.version, offset, sort: $('#ctSort').value || '' });
      if (my !== req) return;
      if (reset) box.innerHTML = '';
      if (!r.hits.length && reset) box.innerHTML = '<div class="empty"><p>Sonuç bulunamadı.</p></div>';
      const instList = await cx.content('list', p.id, tab).catch(() => []);
      const installed = new Set(instList.map((m) => m.name.toLowerCase()));
      r.hits.forEach((m, i) => {
        const el = document.createElement('div');
        el.className = 'mod';
        el.style.animationDelay = `${i * 0.03}s`;
        const match = (n) => n.includes(m.slug.toLowerCase()) || n.includes(m.title.toLowerCase().replace(/\s+/g, '-'));
        const has = [...installed].some(match);
        el.innerHTML = `
          ${m.icon ? `<img src="${esc(m.icon)}" alt="" loading="lazy" />` : '<div class="mod-ph"></div>'}
          <div class="mod-body">
            <div class="mod-title">${esc(m.title)}<small>${esc(m.author)} · ${fmtNum(m.downloads)} indirme</small></div>
            <div class="mod-desc">${esc(m.description)}</div>
            <div class="mod-tags">${(m.categories || []).slice(0, 4).map((c) => `<span class="tag">${esc(c)}</span>`).join('')}</div>
          </div>
          <button class="btn ${has ? 'btn-ghost' : 'btn-primary'}">${has ? 'Kurulu ✓' : 'Kur'}</button>`;
        const b = el.querySelector('button');
        if (has) {
          // kurulu: üstüne gelince "Kaldır" olur; tıklayınca yeniden kurmaz, onayla siler
          b.title = 'Kurulu. Kaldırmak için tıkla.';
          b.onmouseenter = () => { if (!b.disabled && b.dataset.done !== '1') b.textContent = 'Kaldır'; };
          b.onmouseleave = () => { if (!b.disabled && b.dataset.done !== '1') b.textContent = 'Kurulu ✓'; };
          b.onclick = async () => {
            const files = instList.filter((f) => match(f.name.toLowerCase()));
            if (!(await confirmBox('Kaldırılsın mı?', `${m.title} bu profilde kurulu. Kaldırmak istiyor musun?`, 'Kaldır'))) return;
            b.disabled = true; b.textContent = 'Kaldırılıyor...';
            try {
              for (const f of files) await cx.content('remove', p.id, tab, f.file);
              toast(`${m.title} kaldırıldı.`, 'success');
              b.disabled = false; b.className = 'btn btn-primary'; b.textContent = 'Kur'; b.onmouseenter = b.onmouseleave = null;
              instCache = {};
              b.onclick = null; if (p.id === S.selectedProfile) renderInstalled();
              search(true);
            } catch (e) { b.disabled = false; b.textContent = 'Kurulu ✓'; toast(e.message, 'error'); }
          };
          box.appendChild(el);
          return;
        }
        b.onclick = async () => {
          if (tab === 'mod' && p.loader !== 'fabric') { toast('Mod kurmak için profilin Fabric olmalı.', 'error'); return; }
          b.disabled = true; b.textContent = 'Kuruluyor...';
          try {
            const files = await cx.installContent(p.id, m.id, tab);
            b.textContent = 'Kuruldu ✓'; b.className = 'btn btn-ghost';
            toast(files.length > 1 ? `${m.title} ve ${files.length - 1} gerekli dosya kuruldu.` : `${m.title} kuruldu.`, 'success');
            instCache = {};
            if (p.id === S.selectedProfile) renderInstalled();
          } catch (e) { b.disabled = false; b.textContent = 'Kur'; toast(e.message, 'error'); }
        };
        box.appendChild(el);
      });
      offset += r.hits.length;
      $('#ctMore').classList.toggle('hidden', offset >= r.total || !r.hits.length);
    } catch (e) { if (my === req) box.innerHTML = `<div class="empty"><p>${esc(e.message)}</p></div>`; }
  }

  // ---------------------------------------------------------- ana sayfa: yüklü içerik
  async function renderInstalled() {
    bindOnce();
    const p = selected();
    const list = $('#instList');
    if (instTab === 'mod' && !syncTabs('#instTabs', p)) { instTab = 'resourcepack'; $$('#instTabs button').forEach((x) => x.classList.toggle('active', x.dataset.t === instTab)); }
    syncTabs('#instTabs', p);
    $('#instProfile').textContent = p ? `${p.name}` : '';
    if (!p) { list.innerHTML = '<div class="inst-empty">Önce bir profil oluştur.</div>'; $('#instCount').textContent = '0/0'; return; }
    let items = [];
    try { items = await cx.content('list', p.id, instTab); } catch {}
    instCache[instTab] = items;
    const on = items.filter((m) => m.enabled).length;
    $('#instCount').textContent = `${on}/${items.length}`;
    const f = instFilter.toLowerCase();
    const shown = items.filter((m) => !f || m.name.toLowerCase().includes(f));
    if (!shown.length) {
      list.innerHTML = `<div class="inst-empty"><b>Bu profilde henüz ${NAMES[instTab]} yok.</b><button class="btn btn-ghost small" data-add>İçerik Ekle</button></div>`;
      list.querySelector('[data-add]').onclick = () => { go('content'); enter(instTab); };
      return;
    }
    list.innerHTML = '';
    for (const m of shown) {
      const el = document.createElement('div');
      el.className = 'inst-item' + (m.enabled ? '' : ' off');
      el.innerHTML = `<div class="inst-ic">${instTab === 'mod' ? '🧩' : instTab === 'shader' ? '✨' : '🎨'}</div>
        <div class="inst-name"><b>${esc(m.name)}</b><small>${m.dir ? 'Klasör' : (m.size / 1024 / 1024).toFixed(2) + ' MB'}${m.enabled ? '' : ' · kapalı'}</small></div>
        <label class="switch small" title="Aç/kapat"><input type="checkbox" ${m.enabled ? 'checked' : ''} ${m.dir ? 'disabled' : ''} /><span></span></label>
        <button class="icon-btn small danger" title="Sil"><svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" /></svg></button>`;
      el.querySelector('input').onchange = async () => { await cx.content('toggle', p.id, instTab, m.file); renderInstalled(); };
      el.querySelector('button').onclick = async () => {
        if (!(await confirmBox('Silinsin mi?', `${m.name} bu profilden silinecek.`, 'Sil'))) return;
        await cx.content('remove', p.id, instTab, m.file); toast(`${m.name} silindi.`); renderInstalled();
      };
      list.appendChild(el);
    }
  }

  function bindOnce() {
    if (bound) return; bound = true;
    $$('#ctTabs button').forEach((b) => (b.onclick = () => setTab(b.dataset.t)));
    $('#ctProfile').onchange = () => setTab(tab);
    $('#ctSort').onchange = () => search(true);
    $('#ctSearch').oninput = (e) => { clearTimeout(timer); timer = setTimeout(() => { query = e.target.value.trim(); search(true); }, 350); };
    $('#ctMore').onclick = () => search(false);
    $$('#instTabs button').forEach((b) => (b.onclick = () => {
      instTab = b.dataset.t;
      $$('#instTabs button').forEach((x) => x.classList.toggle('active', x === b));
      renderInstalled();
    }));
    $('#instSearch').oninput = (e) => { instFilter = e.target.value.trim(); renderInstalled(); };
    $('#instRefresh').onclick = () => { renderInstalled(); toast('Yenilendi.'); };
    $('#instFolder').onclick = () => { const p = selected(); if (p) cx.openContentFolder(p.id, instTab); };
    $('#instFile').onclick = async () => {
      const p = selected(); if (!p) return;
      try { const n = await cx.addContentFiles(p.id, instTab); if (n) { toast(`${n} dosya eklendi.`, 'success'); renderInstalled(); } }
      catch (e) { toast(e.message, 'error'); }
    };
    $('#instAdd').onclick = () => { go('content'); enter(instTab); };
    $('#instToggle').onclick = () => { instOpen = !instOpen; $('#installed').classList.toggle('closed', !instOpen); };
  }

  return { enter, renderInstalled };
})();

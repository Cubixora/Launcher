/* Cubixora - ilk girişte tanıtım turu */
(function () {
  const STEPS = [
    { title: "Cubixora'ya hoş geldin! 👋", text: 'Sana launcher\'ı kısaca tanıtalım. Soldaki butonların her birinin ne işe yaradığını tek tek göstereceğiz.' },
    { el: '.nav-item[data-page="home"]', page: 'home', title: 'Ana Sayfa', text: 'Oyunu buradan başlatırsın. Profillerin ve OYNA butonu burada.' },
    { el: '#carousel', page: 'home', title: 'Profillerin', text: 'Her profilin kendi sürümü, modları ve dünyaları var. Klavyede ← → ile de gezinebilirsin.' },
    { el: '#pick', page: 'home', title: 'Profil seçici', text: 'Oynamadan önce hangi profille gireceğini buradan hızlıca seç ya da yeni profil ekle.' },
    { el: '#playBtn', page: 'home', title: 'Oyna', text: 'Tek tık yeter: doğru Java, oyun dosyaları ve modlar otomatik hazırlanır.' },
    { el: '.nav-item[data-page="profiles"]', title: 'Profiller', text: 'Profilleri oluştur, düzenle, RAM ve sürüm ayarlarını değiştir.' },
    { el: '.nav-item[data-page="mods"]', title: 'Modlar', text: 'Fabric profillerine Modrinth\'ten tek tıkla mod kur; gerekenler de otomatik gelir.' },
    { el: '.nav-item[data-page="cosmetics"]', title: 'Kozmetik', text: 'Skinini yükle; pelerin, kanat ve omuz arkadaşı seç. Oyunda Cubixora kullananlar görür.' },
    { el: '.nav-item[data-page="settings"]', title: 'Ayarlar', text: 'Bellek, Java, bulut eşitleme ve diğer ayarlar burada. Bu turu da buradan tekrar başlatabilirsin.' },
    { el: '#navAccount', title: 'Hesabın', text: 'Hesap bilgilerin ve çıkış burada.' },
    { title: 'Hazırsın! 🎉', text: 'İyi oyunlar. Bir profil seç ve OYNA\'ya bas.', last: true }
  ];
  let i = 0, active = false;

  function place() {
    if (!active) return;
    const s = STEPS[i], hole = $('#tourHole'), card = $('#tourCard');
    $('#tourStep').textContent = `ADIM ${i + 1} / ${STEPS.length}`;
    $('#tourTitle').textContent = s.title;
    $('#tourText').textContent = s.text;
    $('#tourDots').innerHTML = STEPS.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('');
    $('#tourBack').classList.toggle('hidden', i === 0);
    $('#tourNext').textContent = s.last ? 'Bitir' : 'İleri';
    const target = s.el && document.querySelector(s.el);
    const W = innerWidth, H = innerHeight, cw = 330, ch = card.offsetHeight || 190, gap = 16;
    if (!target) {
      hole.classList.add('center');
      Object.assign(hole.style, { left: W / 2 + 'px', top: H / 2 + 'px', width: '0px', height: '0px' });
      card.style.left = (W - cw) / 2 + 'px'; card.style.top = (H - ch) / 2 + 'px';
      return;
    }
    hole.classList.remove('center');
    const r = target.getBoundingClientRect(), pad = 6;
    Object.assign(hole.style, { left: r.left - pad + 'px', top: r.top - pad + 'px', width: r.width + pad * 2 + 'px', height: r.height + pad * 2 + 'px' });
    let x, y;
    if (r.right + gap + cw < W) { x = r.right + gap; y = r.top + r.height / 2 - ch / 2; }       // sağa
    else if (r.top - gap - ch > 0) { x = r.left + r.width / 2 - cw / 2; y = r.top - gap - ch; } // üste
    else { x = r.left + r.width / 2 - cw / 2; y = r.bottom + gap; }                              // alta
    card.style.left = Math.max(12, Math.min(W - cw - 12, x)) + 'px';
    card.style.top = Math.max(50, Math.min(H - ch - 12, y)) + 'px';
  }

  function show(k) {
    i = Math.max(0, Math.min(STEPS.length - 1, k));
    const s = STEPS[i];
    if (s.page && $('.page.active')?.dataset.page !== s.page) go(s.page);
    $('#tourCard').classList.remove('pop'); void $('#tourCard').offsetWidth; $('#tourCard').classList.add('pop');
    requestAnimationFrame(() => requestAnimationFrame(place));
  }

  function end() {
    active = false;
    $('#tour').classList.add('hidden');
    removeEventListener('resize', place);
    removeEventListener('keydown', keys, true);
    saveSetting({ tourDone: true });
  }

  function keys(e) {
    if (!active) return;
    if (e.key === 'Escape') end();
    else if (e.key === 'ArrowRight' || e.key === 'Enter') STEPS[i].last ? end() : show(i + 1);
    else if (e.key === 'ArrowLeft') show(i - 1);
    else return;
    e.preventDefault(); e.stopPropagation();
  }

  function start() {
    active = true;
    $('#tour').classList.remove('hidden');
    $('#tourSkip').onclick = end;
    $('#tourBack').onclick = () => show(i - 1);
    $('#tourNext').onclick = () => (STEPS[i].last ? end() : show(i + 1));
    addEventListener('resize', place);
    addEventListener('keydown', keys, true);
    show(0);
  }

  window.Tour = { start, isActive: () => active };
})();

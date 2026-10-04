/* Ayarlar penceresi */
const Settings = (() => {
  let tab = 'game', logBuf = '', bound = false, micTest = null;
  const sw = (id, on) => `<label class="switch"><input type="checkbox" id="${id}" ${on ? 'checked' : ''} /><span></span></label>`;
  const row = (title, sub, ctl) => `<div class="s-row"><div><b>${title}</b>${sub ? `<small>${sub}</small>` : ''}</div><div class="s-ctl">${ctl}</div></div>`;
  const sec = (t) => `<div class="s-sec">${t}</div>`;
  const card = (h) => `<div class="s-card">${h}</div>`;
  const opt = (v, cur, label) => `<option value="${esc(v)}" ${String(v) === String(cur) ? 'selected' : ''}>${esc(label)}</option>`;
  const slider = (id, v, min = 0, max = 100, unit = '%') => `<div class="s-slider"><input type="range" id="${id}" min="${min}" max="${max}" value="${v}" /><span id="${id}Val">${v}${unit}</span></div>`;
  const st = () => S.settings;

  function open(t) {
    bindOnce();
    $('#settingsWin').classList.remove('hidden');
    show(t || tab);
  }
  function close() { if (SaveBar.block($('#swContent'))) return; $('#settingsWin').classList.add('hidden'); stopMicTest(); }
  function show(t) {
    if (tab !== t && !$('#settingsWin').classList.contains('hidden') && SaveBar.block($('#swContent'))) return;
    tab = t;
    $$('#swNav button').forEach((b) => b.classList.toggle('active', b.dataset.t === t));
    const box = $('#swContent');
    stopMicTest();
    box.scrollTop = 0;
    (RENDER[t] || RENDER.game)(box);
    // "Kaydet" butonu olan sekmeler: değişiklik olunca alttaki çubuk çıkar, buton gizlenir
    const saveBtn = box.querySelector('.s-save .btn-primary');
    if (box._sbBar) { box._sbBar.remove(); box._sbBar = null; }
    if (saveBtn) {
      box.querySelectorAll('input:not([type=file]):not([type=button]), select, textarea').forEach((el) => { if (!el.closest('.auto-form, .s-inline, .imp')) el.setAttribute('data-track', ''); });
      saveBtn.style.display = 'none';
      const wrap = saveBtn.parentElement; if (![...wrap.children].some((x) => x.style.display !== 'none')) wrap.style.display = 'none';
      SaveBar.watch(box, { save: async () => { await saveBtn.onclick(); } });
    }
  }
  async function save(patch, msg) {
    try { await saveSetting(patch); if (msg) toast(msg, 'success'); } catch (e) { toast(e.message, 'error'); }
  }
  function bindSlider(id, unit, onChange) {
    const el = $('#' + id); if (!el) return;
    el.oninput = () => ($('#' + id + 'Val').textContent = el.value + unit);
    el.onchange = () => onChange(Number(el.value));
  }

  const RENDER = {
    // ------------------------------------------------------------ Oyun
    game(box) {
      const s = st();
      const ram = (sel) => Array.from({ length: 16 }, (_, i) => i + 1).map((n) => opt(n, sel, `${n}G`)).join('');
      const res = ['', '854x480', '1280x720', '1366x768', '1600x900', '1920x1080', '2560x1440'];
      box.innerHTML = sec('PERFORMANS') + card(
        row('Maksimum RAM', "Minecraft'a ayrılan maksimum bellek (profilde ayrıca belirtilmediyse)", `<select class="select" id="sRam">${ram(s.defaultRam)}</select>`) +
        row('Minimum RAM', 'Başlangıç bellek tahsisi', `<select class="select" id="sMinRam">${ram(s.minRam || 1)}</select>`)) +
        sec('GÖRÜNÜM') + card(
        row('Pencere Çözünürlüğü', 'Minecraft pencere boyutu', `<select class="select" id="sRes">${res.map((r) => opt(r, s.resolution || '', r ? r.replace('x', '×') : 'Otomatik')).join('')}</select>`) +
        row('Tam Ekran Başlat', 'Oyun açılırken tam ekran moduna geç', sw('sFull', s.fullscreen)) +
        row("Oyun açılınca launcher'ı gizle", 'Oyun kapanınca geri gelir', sw('sHide', s.closeOnLaunch)) +
        row('Snapshot sürümleri göster', 'Deneysel Minecraft sürümleri', sw('sSnap', s.showSnapshots))) +
        sec('GELİŞMİŞ') + card(`<div class="s-row col"><div><b>Java Yolu</b><small>Boş bırakırsan her sürüm için doğru Java otomatik indirilir</small></div><input class="input" id="sJava" placeholder="C:\\Program Files\\Java\\jdk-21\\bin\\java.exe" value="${esc(s.javaPath || '')}" /></div>`) +
        '<div class="s-save"><button class="btn btn-primary" id="sSave">Kaydet</button></div>';
      $('#sSave').onclick = async () => {
        await save({ defaultRam: Number($('#sRam').value), minRam: Number($('#sMinRam').value), resolution: $('#sRes').value, fullscreen: $('#sFull').checked,
          closeOnLaunch: $('#sHide').checked, showSnapshots: $('#sSnap').checked, javaPath: $('#sJava').value.trim() }, 'Oyun ayarları kaydedildi.');
        S.versions = null;
      };
    },

    // ------------------------------------------------------------ Minecraft (options.txt)
    async minecraft(box) {
      const p = selected();
      if (!p) { box.innerHTML = '<div class="s-empty">Önce bir profil oluştur.</div>'; return; }
      const o = await cx.content('readOptions', p.id).catch(() => null);
      if (!o) {
        box.innerHTML = sec('OYUN AYARLARI') + `<div class="s-empty big"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /></svg><b>options.txt henüz oluşmamış</b><span>Oyun ayarlarını düzenlemek için "${esc(p.name)}" profiliyle Minecraft'ı en az bir kez başlatman gerekiyor.</span></div>`;
        return;
      }
      const num = (k, d) => (o[k] !== undefined ? Number(o[k]) : d);
      const bool = (k) => o[k] === 'true';
      box.innerHTML = sec(`OYUN AYARLARI · ${esc(p.name)}`) + card(
        row('Görüş Mesafesi', 'Chunk cinsinden', slider('mRd', num('renderDistance', 12), 2, 32, '')) +
        row('Simülasyon Mesafesi', '', slider('mSd', num('simulationDistance', 12), 5, 32, '')) +
        row('FOV', 'Görüş açısı', slider('mFov', Math.round(70 + num('fov', 0) * 40), 30, 110, '°')) +
        row('Maksimum FPS', '260 = sınırsız', slider('mFps', num('maxFps', 120), 10, 260, '')) +
        row('Arayüz Boyutu', '0 = otomatik', `<select class="select" id="mGui">${[0, 1, 2, 3, 4].map((n) => opt(n, num('guiScale', 0), n ? String(n) : 'Otomatik')).join('')}</select>`) +
        row('Parlaklık', '', slider('mGamma', Math.round(num('gamma', 0.5) * 100), 0, 100, '%')) +
        row('Dikey Senkron (VSync)', '', sw('mVsync', bool('enableVsync'))) +
        row('Otomatik Zıplama', '', sw('mJump', bool('autoJump'))) +
        row('Fare Hassasiyeti', '', slider('mMouse', Math.round(num('mouseSensitivity', 0.5) * 200), 0, 200, '%')) +
        row('Ana Ses', '', slider('mVol', Math.round(num('soundCategory_master', 1) * 100), 0, 100, '%')) +
        row('Oyun Dili', '', `<select class="select" id="mLang">${[['tr_tr', 'Türkçe'], ['en_us', 'English'], ['de_de', 'Deutsch'], ['az_az', 'Azərbaycanca'], ['ru_ru', 'Русский']].map(([v, l]) => opt(v, o.lang || 'en_us', l)).join('')}</select>`)) +
        '<div class="s-save"><button class="btn btn-ghost" id="mOpen">options.txt\'yi aç</button><button class="btn btn-primary" id="mSave">Kaydet</button></div>';
      ['mRd', 'mSd', 'mFps'].forEach((id) => bindSlider(id, '', () => {}));
      bindSlider('mFov', '°', () => {}); ['mGamma', 'mMouse', 'mVol'].forEach((id) => bindSlider(id, '%', () => {}));
      $('#mOpen').onclick = () => cx.openProfileFolder(p.id);
      $('#mSave').onclick = async () => {
        try {
          await cx.content('writeOptions', p.id, {
            renderDistance: $('#mRd').value, simulationDistance: $('#mSd').value, fov: ((Number($('#mFov').value) - 70) / 40).toFixed(4),
            maxFps: $('#mFps').value, guiScale: $('#mGui').value, gamma: (Number($('#mGamma').value) / 100).toFixed(2), enableVsync: String($('#mVsync').checked),
            autoJump: String($('#mJump').checked), mouseSensitivity: (Number($('#mMouse').value) / 200).toFixed(4), soundCategory_master: (Number($('#mVol').value) / 100).toFixed(2), lang: $('#mLang').value
          });
          toast('Minecraft ayarları kaydedildi. Oyun bir sonraki açılışta bunları kullanır.', 'success');
        } catch (e) { toast(e.message, 'error'); }
      };
    },

    // ------------------------------------------------------------ Genel
    async general(box) {
      const s = st();
      box.innerHTML = sec('DİL') + card(row('Arayüz dili', 'Değişiklikler anında uygulanır', `<select class="select" id="gLang">${opt('auto', s.language, 'Otomatik (Sistem)')}${opt('tr', s.language, 'Türkçe')}${opt('en', s.language, 'English (yakında)')}</select>`)) +
        sec('LAUNCHER İMPORT') + card(row("Başka Launcher'dan Aktar", 'Bir klasör seç; içindeki oyun ayarları, sunucu listesi, doku paketleri, shaderlar, dünyalar ve modlar seçili profile aktarılır', '<button class="btn btn-ghost" id="gImport">Klasör Seç</button>') + '<div id="gImportBox"></div>') +
        sec('PENCERE DAVRANIŞI') + card(row('X butonuna basınca', 'Pencere kapatma tuşunun davranışı', `<select class="select" id="gClose">${opt('tray', s.closeToTray !== false ? 'tray' : 'quit', 'Tepsiye küçült (önerilen)')}${opt('quit', s.closeToTray !== false ? 'tray' : 'quit', 'Tamamen kapat')}</select>`) +
          row('Arayüz Animasyonları', 'Buton, pencere ve sayfa geçiş efektleri (kapatırsan her şey anında açılır)', sw('gAnim', s.animations !== false))) +
        sec('DISCORD') + card(row('Discord Etkinliği', '"Cubixora Launcher oynuyor" durumunu Discord profilinde göster', sw('gDiscord', s.discordPresence !== false))) +
        sec('ÖĞRETİCİ TUR') + card(row('Arayüz Turu', 'İlk açılışta gösterilen tanıtım turunu tekrar başlat', '<button class="btn btn-ghost" id="gTour">Turu Göster</button>')) +
        sec('GÜNCELLEME') + card(row('Güncelleme Kontrolü', 'Yeni sürüm olup olmadığını kontrol et. Güncellemeler yeni EXE indirmeden otomatik gelir.', '<button class="btn btn-ghost" id="gUpd">Kontrol Et</button>'));
      $('#gLang').onchange = (e) => { save({ language: e.target.value }, e.target.value === 'en' ? 'İngilizce arayüz yakında geliyor; şimdilik Türkçe.' : 'Dil kaydedildi.'); };
      $('#gClose').onchange = (e) => save({ closeToTray: e.target.value === 'tray' }, 'Kaydedildi.');
      $('#gDiscord').onchange = (e) => save({ discordPresence: e.target.checked });
      $('#gAnim').onchange = (e) => save({ animations: e.target.checked });
      $('#gTour').onclick = () => { close(); go('home'); setTimeout(() => Tour.start(), 250); };
      $('#gUpd').onclick = async () => {
        const b = $('#gUpd'); b.classList.add('loading');
        try { const r = await cx.checkUpdate(); toast(r ? `Yeni güncelleme indirildi (#${r.build}). Uygulamak için yeniden başlat.` : 'Launcher güncel.', 'success'); if (r) $('#updatePill').classList.remove('hidden'); }
        catch (e) { toast('Kontrol edilemedi: ' + e.message, 'error'); } finally { b.classList.remove('loading'); }
      };
      $('#gImport').onclick = async () => {
        const dir = await cx.pick({ kind: 'folder', title: 'Aktarılacak klasörü seç (.minecraft gibi)' }).catch(() => null);
        if (!dir) return;
        const list = await cx.content('importSources', dir).catch(() => []);
        const p = selected();
        const NAMES = { 'options.txt': 'Oyun ayarları', 'servers.dat': 'Sunucu listesi', resourcepacks: 'Doku paketleri', shaderpacks: 'Shaderlar', saves: 'Dünyalar', mods: 'Modlar' };
        $('#gImportBox').innerHTML = !list.length ? '<div class="s-empty">Seçtiğin klasörde aktarılabilecek bir şey bulunamadı (options.txt, servers.dat, resourcepacks, shaderpacks, saves, mods).</div>' : list.map((l, i) => `<div class="imp" data-i="${i}">
          <b>${esc(l.name)}</b><small>${esc(l.dir)}</small>
          <div class="imp-items">${l.items.map((it) => `<label><input type="checkbox" value="${esc(it)}" ${it !== 'mods' && it !== 'saves' ? 'checked' : ''} /> ${esc(NAMES[it] || it)}</label>`).join('')}</div>
          <button class="btn btn-primary small" data-imp="${i}">"${esc(p ? p.name : '')}" profiline aktar</button></div>`).join('');
        $$('[data-imp]').forEach((b) => (b.onclick = async () => {
          if (!p) { toast('Önce bir profil seç.', 'error'); return; }
          const l = list[Number(b.dataset.imp)];
          const items = $$(`.imp[data-i="${b.dataset.imp}"] input:checked`).map((x) => x.value);
          b.classList.add('loading');
          try { const done = await cx.importContent(p.id, l.dir, items); toast(`${l.name}'dan aktarıldı: ${done.map((d) => NAMES[d] || d).join(', ') || 'hiçbir şey'}`, 'success'); Content.renderInstalled(); }
          catch (e) { toast(e.message, 'error'); } finally { b.classList.remove('loading'); }
        }));
      };
    },

    // ------------------------------------------------------------ Hesap
    async account(box) {
      const a = S.account || {};
      const me = S.me && S.me.profile;
      box.innerHTML = `<div class="s-user"><img src="${esc(me ? avatarOf({ ...me, mcName: me.mcName || a.name }, 64) : headUrl(a.name, 64))}" alt="" /><div><b>${esc(me ? me.displayName : a.name)}</b><small>${me ? '@' + esc(me.handle) : esc(a.type === 'microsoft' ? 'Microsoft hesabı' : a.email || '')}</small></div></div>` +
        (S.social ? sec('HEDİYE KODU') + card(`<div class="s-row col"><div><b>Hediye Kodu Kullan</b><small>Coin ya da özel kozmetikler kazanmak için hediye kodunu gir</small></div><div class="s-inline"><input class="input" id="aCode" placeholder="Örn: GIFT-XXXX-XXXX" spellcheck="false" /><button class="btn btn-primary" id="aRedeem">Kullan</button></div></div>`) : '') +
        (a.type !== 'microsoft' ? sec('MİNECRAFT PROFİLLERİ') + card(`<div class="s-inline"><input class="input" id="aNick" maxlength="16" placeholder="Yeni nickname ekle..." spellcheck="false" /><button class="btn btn-ghost" id="aNickAdd">Ekle</button></div><div id="aNicks" class="nick-list"></div>`) : '') +
        `<div class="s-divider"></div>` + sec('OYUN İÇİ OTO-LOGİN ŞİFRELERİ') +
        `<p class="s-p">Sunucularda otomatik /login ya da /register yapılır: oyun o sunucuda "giriş yap" mesajı gösterdiği anda şifren hemen yazılır. Şifreler sadece bu bilgisayarda şifreli olarak saklanır.</p>` +
        `<div id="aAuto" class="auto-list"></div>` +
        card(`<div class="s-sec small">YENİ OTO-LOGİN EKLE</div><div class="auto-form"><label>SUNUCU<input class="input" id="alServer" placeholder="play.example.com" spellcheck="false" /></label><label>OYUNCU ADI<input class="input" id="alName" placeholder="${esc(a.name || '')}" maxlength="16" spellcheck="false" /></label><label>ŞİFRE<input class="input" id="alPass" type="password" placeholder="••••••••" /></label><button class="btn btn-primary" id="alAdd">Ekle</button></div>`);
      const code = $('#aRedeem');
      if (code) code.onclick = async () => {
        code.classList.add('loading');
        try { const r = await sc('redeem', $('#aCode').value); S.me = r.summary; renderWallet(); toast(`Kod kullanıldı!${r.coins ? ` +${r.coins} coin` : ''}${r.items.length ? ` · ${r.items.length} eşya` : ''}`, 'success'); $('#aCode').value = ''; }
        catch (e) { toast(e.message, 'error'); } finally { code.classList.remove('loading'); }
      };
      const renderNicks = () => {
        const box2 = $('#aNicks'); if (!box2) return;
        const nicks = (S.account.nicks || [S.account.name]).filter(Boolean);
        box2.innerHTML = !nicks.length || S.account.needsNick ? '<div class="s-empty">Henüz profil yok. Aktif olarak kullandığın nickname otomatik eklenecek.</div>'
          : nicks.map((n) => `<div class="nick-item ${n === S.account.name ? 'on' : ''}"><img src="${esc(headUrl(n, 32))}" alt="" /><b>${esc(n)}</b>${n === S.account.name ? '<span class="badge">Aktif</span>' : `<button class="btn btn-ghost tiny" data-use="${esc(n)}">Kullan</button><button class="icon-btn tiny danger" data-del="${esc(n)}">✕</button>`}</div>`).join('');
        $$('[data-use]', box2).forEach((b) => (b.onclick = async () => { try { S.account = await cx.setNick(b.dataset.use); renderAccount(); renderNicks(); toast(`Artık "${b.dataset.use}" olarak oynuyorsun.`, 'success'); } catch (e) { toast(e.message, 'error'); } }));
        $$('[data-del]', box2).forEach((b) => (b.onclick = async () => { if (!(await confirmBox('Nickname silinsin mi?', `"${b.dataset.del}" serbest kalır, başkası alabilir.`, 'Sil'))) return; try { S.account = await cx.removeNick(b.dataset.del); renderNicks(); } catch (e) { toast(e.message, 'error'); } }));
      };
      renderNicks();
      const add = $('#aNickAdd');
      if (add) add.onclick = async () => {
        const v = $('#aNick').value.trim();
        if (!NAME_RE.test(v)) { toast('Nickname 3-16 karakter; harf, rakam ve _ olmalı.', 'error'); return; }
        add.classList.add('loading');
        try { S.account = await cx.setNick(v); renderAccount(); $('#aNick').value = ''; renderNicks(); toast(`"${v}" eklendi ve aktif oldu.`, 'success'); }
        catch (e) { toast(e.message, 'error'); } finally { add.classList.remove('loading'); }
      };
      let auto = await cx.autologinList().catch(() => []);
      const renderAuto = () => {
        $('#aAuto').innerHTML = auto.length ? auto.map((e, i) => `<div class="auto-item"><b>${esc(e.server)}</b><span>${esc(e.name || 'tüm adlar')}</span><code>••••••••</code><button class="icon-btn tiny danger" data-i="${i}">✕</button></div>`).join('')
          : '<div class="s-empty">Kayıtlı oto-login şifresi yok. Bir sunucuda /login yaptığında buraya ekleyebilirsin.</div>';
        $$('#aAuto [data-i]').forEach((b) => (b.onclick = async () => { auto = await cx.autologinRemove(Number(b.dataset.i)).catch(() => auto); renderAuto(); }));
      };
      renderAuto();
      $('#alAdd').onclick = async () => {
        const server = $('#alServer').value.trim().toLowerCase(), name = $('#alName').value.trim(), pass = $('#alPass').value;
        if (!server || !pass) { toast('Sunucu adresi ve şifre gerekli.', 'error'); return; }
        try {
          auto = await cx.autologinAdd({ server, name, pass });
          $('#alServer').value = $('#alName').value = $('#alPass').value = '';
          renderAuto(); toast('Oto-login eklendi.', 'success');
        } catch (e) { toast(e.message, 'error'); }
      };
    },

    // ------------------------------------------------------------ Ses
    async sound(box) {
      const s = st().sound || {};
      let devs = [];
      try { await navigator.mediaDevices.getUserMedia({ audio: true }).then((x) => x.getTracks().forEach((t) => t.stop())); devs = await navigator.mediaDevices.enumerateDevices(); } catch {}
      const ins = devs.filter((d) => d.kind === 'audioinput'), outs = devs.filter((d) => d.kind === 'audiooutput');
      box.innerHTML = sec('GİRİŞ (MİKROFON)') + card(
        row('Giriş Cihazı', 'Aramada ve sesli mesajda kullanılacak mikrofon', `<select class="select wide" id="snMic">${opt('', s.micId, 'Sistem Varsayılanı')}${ins.filter((d) => d.deviceId !== 'default').map((d) => opt(d.deviceId, s.micId, d.label || 'Mikrofon')).join('')}</select>`) +
        row('Giriş Sesi', 'Mikrofon kazanç seviyesi', slider('snGain', s.micGain ?? 100, 0, 200)) +
        row('Gürültü Engelleme', 'Arka plan seslerini filtreler', sw('snNoise', s.noiseSuppression !== false)) +
        row('Yankı Engelleme', 'Hoparlör yankısını önler', sw('snEcho', s.echoCancellation !== false)) +
        row('Otomatik Ses Dengesi', 'Mikrofon seviyesini otomatik ayarlar', sw('snAgc', !!s.autoGain))) +
        sec('ÇIKIŞ (HOPARLÖR)') + card(
        row('Çıkış Cihazı', 'Arama sesinin çalacağı cihaz', `<select class="select wide" id="snSpk">${opt('', s.speakerId, 'Sistem Varsayılanı')}${outs.filter((d) => d.deviceId !== 'default').map((d) => opt(d.deviceId, s.speakerId, d.label || 'Hoparlör')).join('')}</select>`) +
        row('Çıkış Sesi', 'Gelen ses seviyesi', slider('snVol', s.speakerVol ?? 100))) +
        sec('TEST') + card(row('Mikrofon Testi', 'Mikrofonunu hoparlörden dinleyerek test et', '<button class="btn btn-ghost" id="snTest">▷ Başlat</button>') + '<div class="mic-meter"><i id="snMeter"></i></div>') +
        '<div class="s-save"><button class="btn btn-primary" id="snSave">Kaydet</button></div>';
      bindSlider('snGain', '%', () => {}); bindSlider('snVol', '%', () => {});
      $('#snSave').onclick = () => save({ sound: { micId: $('#snMic').value, speakerId: $('#snSpk').value, micGain: Number($('#snGain').value), speakerVol: Number($('#snVol').value),
        noiseSuppression: $('#snNoise').checked, echoCancellation: $('#snEcho').checked, autoGain: $('#snAgc').checked } }, 'Ses ayarları kaydedildi.');
      $('#snTest').onclick = () => (micTest ? stopMicTest() : startMicTest());
    },

    // ------------------------------------------------------------ Depolama
    storage(box) {
      box.innerHTML = sec('OYUN DİZİNİ') + card(row('Veri Klasörü', '%AppData%\\.cubixora', '<button class="btn btn-ghost" id="stOpen">📁 Klasörü Aç</button>')) +
        sec('ÖNBELLEK') + card(row('Modrinth Önbelleği', 'İndirilen içerik meta verileri', '<button class="btn btn-danger" id="stClear">Temizle</button>'));
      $('#stOpen').onclick = () => cx.openData();
      $('#stClear').onclick = async () => { await cx.clearCache(); toast('Önbellek temizlendi.', 'success'); };
    },

    // ------------------------------------------------------------ Bildirimler
    notifications(box) {
      const n = st().notify || {};
      box.innerHTML = sec('BİLDİRİMLER') + card(
        row('Arkadaş İstekleri', 'Yeni arkadaş isteklerini bildir', sw('nF', n.friends !== false)) +
        row('Mesajlar', 'Yeni mesaj geldiğinde bildir', sw('nM', n.messages !== false)) +
        row('Sesli Arama', 'Gelen aramalarda zil sesi çal ve bildir', sw('nC', n.calls !== false)) +
        row('Launcher Güncellemeleri', 'Yeni sürüm bildirimlerini göster', sw('nU', n.updates !== false))) +
        '<div class="s-save"><button class="btn btn-primary" id="nSave">Kaydet</button></div>';
      $('#nSave').onclick = () => save({ notify: { friends: $('#nF').checked, messages: $('#nM').checked, calls: $('#nC').checked, updates: $('#nU').checked } }, 'Bildirim ayarları kaydedildi.');
    },

    // ------------------------------------------------------------ Bağlı hesaplar
    linked(box) {
      const a = S.account || {};
      box.innerHTML = sec('BAĞLI HESAPLAR') + card(
        `<div class="s-row"><div class="lk"><span class="lk-ic g">G</span><div><b>Google</b><small>${a.type === 'google' ? 'Bağlı · ' + esc(a.email || '') : 'Bağlı değil'}</small></div></div>${a.type === 'google' ? '<span class="badge">Giriş yöntemi</span>' : ''}</div>` +
        `<div class="s-row"><div class="lk"><span class="lk-ic m">▦</span><div><b>Microsoft</b><small>${a.type === 'microsoft' ? 'Bağlı · ' + esc(a.name) : a.msLink ? 'Bağlı · ' + esc(a.msLink.name) : 'Bağlı değil'}</small></div></div>
          ${a.type === 'microsoft' ? '<span class="badge">Giriş yöntemi</span>' : a.msLink ? '<button class="btn btn-danger small" id="lkUn">Kaldır</button>' : '<button class="btn btn-ghost small" id="lkMs">Bağla</button>'}</div>`) +
        (a.msLink && String(a.name || '').toLowerCase() === String(a.msLink.name || '').toLowerCase() ? `<p class="set-note">Oyun adın Microsoft hesabınla aynı (<b>${esc(a.msLink.name)}</b>): premium sunuculara otomatik girersin.</p>` : '') + (a.msLink ? card(row('Premium hesapla oyna', `Oyuna Microsoft hesabındaki "${esc(a.msLink.name)}" adı ve skiniyle gir (premium sunucular için)`, sw('lkPrem', st().usePremium))) : '') +
        '<p class="s-p">Microsoft hesabını bağlarsan, satın aldığın Minecraft hesabıyla premium sunuculara da girebilirsin. Sosyal özellikler, coin ve kozmetikler Cubixora hesabında kalır.</p>';
      const ms = $('#lkMs'); if (ms) ms.onclick = async () => { ms.classList.add('loading'); try { S.account = await cx.linkMicrosoft(); toast('Microsoft hesabı bağlandı.', 'success'); show('linked'); } catch (e) { toast(e.message, 'error'); } finally { ms.classList.remove('loading'); } };
      const un = $('#lkUn'); if (un) un.onclick = async () => { S.account = await cx.unlinkMicrosoft(); S.settings.usePremium = false; show('linked'); };
      const pr = $('#lkPrem'); if (pr) pr.onchange = (e) => save({ usePremium: e.target.checked }, e.target.checked ? 'Artık premium hesabınla oynayacaksın.' : 'Cubixora nickname\'inle oynayacaksın.');
    },

    // ------------------------------------------------------------ Gizlilik
    privacy(box) {
      const v = (S.me && S.me.profile && S.me.profile.visibility) || 'all';
      box.innerHTML = sec('GÖRÜNÜRLÜK') + card(row('Durum Görünürlüğü', 'Çevrimiçi/oyunda durumunu kimler görebilir', `<select class="select" id="pvVis">${opt('all', v, 'Herkes')}${opt('friends', v, 'Sadece arkadaşlar')}${opt('none', v, 'Hiç kimse')}</select>`));
      $('#pvVis').onchange = async (e) => {
        if (!S.social) { toast('Bu ayar için giriş yapmalısın.', 'error'); return; }
        try { S.me = await sc('updateProfile', { visibility: e.target.value }); await sc('setStatus', S.me.status || 'online'); toast('Kaydedildi.', 'success'); } catch (err) { toast(err.message, 'error'); }
      };
    },

    // ------------------------------------------------------------ Erişilebilirlik
    a11y(box) {
      const a = st().a11y || {};
      box.innerHTML = sec('YAZI TİPİ') + card(
        row('Yazı Boyutu', 'Tüm arayüz metinlerini ölçeklendirir', `<select class="select" id="xFont">${[[90, 'Küçük (90%)'], [100, 'Normal (100%)'], [110, 'Büyük (110%)'], [120, 'Çok Büyük (120%)']].map(([v, l]) => opt(v, a.fontScale || 100, l)).join('')}</select>`) +
        row('Kalın Metin', 'Tüm metinlerin kalınlığını artırır', sw('xBold', a.bold))) +
        sec('GÖRSEL FİLTRELER') + card(
        row('Renk Körü Modu', 'Renk körlerine yönelik filtreleme uygular', `<select class="select" id="xCb">${[['off', 'Kapalı'], ['protanopia', 'Protanopi (kırmızı-yeşil)'], ['deuteranopia', 'Deuteranopi (yeşil-kırmızı)'], ['tritanopia', 'Tritanopi (mavi-sarı)']].map(([v, l]) => opt(v, a.colorblind || 'off', l)).join('')}</select>`) +
        row('Yüksek Kontrast', 'Arka plan ve metin kontrastını artırır', sw('xCon', a.contrast)));
      const upd = () => save({ a11y: { fontScale: Number($('#xFont').value), bold: $('#xBold').checked, colorblind: $('#xCb').value, contrast: $('#xCon').checked } });
      ['#xFont', '#xBold', '#xCb', '#xCon'].forEach((id) => ($(id).onchange = upd));
    },

    // ------------------------------------------------------------ Cubixora ayarları
    cubixora(box) {
      const s = st().sounds || {};
      box.innerHTML = sec('PET &amp; BİLDİRİMLER') + card(
        row('Pet Sesleri', 'Omuz arkadaşının çıkardığı seslerin seviyesi', slider('cxPet', s.pet ?? 80)) +
        row('Bildirim Sesleri', 'Bildirimlerde çalınan ses seviyesi', slider('cxNotif', s.notification ?? 70)) +
        row('Sprey Sesleri', 'Sprey basma sesinin seviyesi', slider('cxSpray', s.spray ?? 80))) +
        sec('BİLDİRİM SES TÜRLERİ') + card(
        row('📞 Arama Sesi', 'Gelen aramalar', sw('cxCall', s.call !== false)) +
        row('💬 Mesaj Sesi', 'Yeni mesajlar', sw('cxMsg', s.message !== false)) +
        row('🔔 Bildirim Sesi', 'Genel bildirimler', sw('cxGen', s.general !== false))) +
        sec('OYUN İÇİ SES EFEKTLERİ') + card(
        row('Aura Efekt Sesleri', 'Aura kozmetiklerinin efekt sesleri', slider('cxAura', s.aura ?? 60)) +
        row('Öldürme Ses Efektleri', 'Oyuncu öldürüldüğünde çalınan ses', slider('cxKill', s.kill ?? 70)) +
        row('Partikül Efekt Sesleri', 'Partikül ve görsel efektlerin sesleri', slider('cxPart', s.particle ?? 60))) +
        sec('GÖRSEL ÖZELLİKLER') + card(row('Dalgalanan Pelerinler', 'Pelerinlerin rüzgar etkisiyle dalgalanmasını etkinleştir', sw('cxWave', st().capeWaving !== false))) +
        '<div class="s-save"><button class="btn btn-ghost" id="cxTest">Sesi dene</button><button class="btn btn-primary" id="cxSave">Kaydet</button></div>';
      ['cxPet', 'cxNotif', 'cxSpray', 'cxAura', 'cxKill', 'cxPart'].forEach((id) => bindSlider(id, '%', () => {}));
      $('#cxTest').onclick = () => { S.settings.sounds = { ...(S.settings.sounds || {}), notification: Number($('#cxNotif').value) }; Sound.play('notification'); };
      $('#cxSave').onclick = () => save({ sounds: { pet: +$('#cxPet').value, notification: +$('#cxNotif').value, spray: +$('#cxSpray').value, call: $('#cxCall').checked, message: $('#cxMsg').checked, general: $('#cxGen').checked,
        aura: +$('#cxAura').value, kill: +$('#cxKill').value, particle: +$('#cxPart').value }, capeWaving: $('#cxWave').checked }, 'Cubixora ayarları kaydedildi.');
    },

    // ------------------------------------------------------------ Betalar
    async betas(box) {
      box.innerHTML = `<div class="s-card beta-hero"><div class="beta-ic">🚀</div><div><b>Beta Erişimi</b><small>Beta anahtarını girerek özel Cubixora sürümlerine erişebilirsin. Anahtar hesabına bağlanır ve profil oluşturma ekranında o sürümler belirir.</small></div></div>` +
        sec('YENİ ANAHTAR EKLE') + card('<div class="s-inline"><input class="input" id="bKey" placeholder="Örn: BETA-A1B2-C3D4" spellcheck="false" /><button class="btn btn-primary" id="sbAdd">Doğrula &amp; Ekle</button></div>') +
        sec('AKTİF ANAHTARLAR') + '<div id="sbList"></div>';
      const list = async () => {
        if (!S.social) { $('#sbList').innerHTML = '<div class="s-empty">Beta anahtarları için Google ya da e-posta ile giriş yap.</div>'; return; }
        const keys = await sc('betaInfo').catch(() => []);
        $('#sbList').innerHTML = keys.length ? keys.map((k) => `<div class="s-card"><b>${esc(k.label)}</b> <code>${esc(k.key)}</code><div class="muted">${k.presets.map((p) => esc(p.name)).join(', ') || 'Sürüm yok'}</div></div>`).join('') : '<div class="s-empty">Henüz eklenmiş bir beta anahtarı yok.</div>';
      };
      list();
      $('#sbAdd').onclick = async () => {
        try { await sc('addBetaKey', $('#bKey').value); toast('Beta anahtarı eklendi. Yeni profil oluştururken beta sürümleri görebilirsin.', 'success'); $('#bKey').value = ''; list(); }
        catch (e) { toast(e.message, 'error'); }
      };
    },

    // ------------------------------------------------------------ Günlük
    log(box) {
      box.innerHTML = sec('GÜNLÜK') + `<div class="s-save left"><button class="btn btn-ghost small" id="lgClear">Temizle</button><button class="btn btn-ghost small" id="lgCopy">Kopyala</button></div><pre class="log" id="log"></pre>`;
      const el = $('#log'); el.textContent = logBuf; el.scrollTop = el.scrollHeight;
      $('#lgClear').onclick = () => { logBuf = ''; el.textContent = ''; };
      $('#lgCopy').onclick = () => { navigator.clipboard.writeText(logBuf); toast('Günlük kopyalandı.'); };
    }
  };

  // ---------------------------------------------------------- mikrofon testi
  async function startMicTest() {
    try {
      const s = st().sound || {};
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: $('#snMic') && $('#snMic').value ? { exact: $('#snMic').value } : undefined, noiseSuppression: $('#snNoise').checked, echoCancellation: $('#snEcho').checked } });
      const ac = new AudioContext();
      const src = ac.createMediaStreamSource(stream);
      const g = ac.createGain(); g.gain.value = Number($('#snGain').value) / 100;
      const an = ac.createAnalyser(); an.fftSize = 512;
      const dst = ac.createMediaStreamDestination();
      src.connect(g); g.connect(an); g.connect(dst);
      const audio = new Audio(); audio.srcObject = dst.stream; audio.volume = Number($('#snVol').value) / 100;
      if ($('#snSpk').value && audio.setSinkId) await audio.setSinkId($('#snSpk').value).catch(() => {});
      audio.play();
      const data = new Uint8Array(an.frequencyBinCount);
      micTest = { stream, ac, audio, raf: 0 };
      const loop = () => { if (!micTest) return; an.getByteTimeDomainData(data); let m = 0; for (const v of data) m = Math.max(m, Math.abs(v - 128)); const el = $('#snMeter'); if (el) el.style.width = Math.min(100, m * 1.6) + '%'; micTest.raf = requestAnimationFrame(loop); };
      loop();
      $('#snTest').textContent = '■ Durdur';
      void s;
    } catch (e) { toast('Mikrofon açılamadı: ' + e.message, 'error'); }
  }
  function stopMicTest() {
    if (!micTest) return;
    cancelAnimationFrame(micTest.raf);
    micTest.stream.getTracks().forEach((t) => t.stop());
    micTest.audio.pause(); micTest.ac.close();
    micTest = null;
    const b = $('#snTest'); if (b) b.textContent = '▷ Başlat';
    const m = $('#snMeter'); if (m) m.style.width = '0';
  }

  function onSync() {}
  function bindOnce() {
    if (bound) return; bound = true;
    $$('#swNav button').forEach((b) => (b.onclick = () => show(b.dataset.t)));
    $('#swClose').onclick = close;
    $('#settingsWin').onclick = (e) => { if (e.target.id === 'settingsWin') close(); };
  }
  cx.on('log', (line) => {
    logBuf += line.replace(/\s+$/, '') + '\n';
    if (logBuf.length > 200000) logBuf = logBuf.slice(-150000);
    const el = $('#log');
    if (el && !$('#settingsWin').classList.contains('hidden') && tab === 'log') { el.textContent = logBuf; el.scrollTop = el.scrollHeight; }
  });
  return { open, close, onSync };
})();

/* Admin paneli: her şey Supabase'deki config belgelerine yazılır ve tüm oyunculara anında gider */
const Admin = (() => {
  let tab = 'partners', bound = false, data = {};
  const box = () => $('#adBody');
  const field = (label, html) => `<label class="ad-f"><span>${label}</span>${html}</label>`;
  const inp = (k, v, ph = '', type = 'text') => `<input class="input" data-k="${k}" type="${type}" value="${esc(v ?? '')}" placeholder="${esc(ph)}" />`;
  const RAR = [['yaygin', 'Yaygın'], ['nadir', 'Nadir'], ['destansi', 'Destansı'], ['efsanevi', 'Efsanevi'], ['ozel', 'Özel']];
  const GIVE = [['', 'Mağazada sat'], ['all', 'Herkese ücretsiz (süresiz)'], ['allTimed', 'Herkese süreli']];
  const DESIGNS = { emote: [['kiss', 'Öpücük']], spray: [['logo', 'Cubixora logosu']], hat: [['kask', 'Pembe Kedi Kaskı'], ['buyucu', 'Büyücü Şapkası']], fpet: [['ejder', 'Mini Ejder']], effect: [['ates', 'Kırmızı Ateş'], ['ruh', 'Mavi Ateş']] };
  const FIXED_DESIGN = ['hat', 'fpet', 'effect'];   // kimlik = tür-tasarım (ör. hat-kask); tek ürün
  const TYPES = [['cape', 'Pelerin'], ['wings', 'Kanat'], ['pet', 'Omuz arkadaşı'], ['hat', 'Şapka / kask'], ['fpet', 'Uçan pet'], ['effect', 'Efekt (parçacık)'], ['emote', 'Emote'], ['spray', 'Sprey'], ['frame', 'Çerçeve'], ['color', 'Renk paketi'], ['other', 'Diğer']];
  const sel = (k, v, opts) => `<select class="select" data-k="${k}">${opts.map(([a, b]) => `<option value="${a}" ${a === v ? 'selected' : ''}>${b}</option>`).join('')}</select>`;
  const readCard = (el) => Object.fromEntries($$('[data-k]', el).map((i) => [i.dataset.k, i.type === 'checkbox' ? i.checked : i.type === 'number' ? Number(i.value) : i.value]));
  const saveBar = (id, label = 'Kaydet ve herkese gönder') => `<div class="ad-save"><button class="btn btn-primary" id="${id}">${label}</button></div>`;

  async function enter() {
    if (!S.account || !S.account.admin) { box().innerHTML = '<div class="empty"><p>Bu sayfa sadece admin hesabı içindir.</p></div>'; return; }
    bindOnce();
    show(tab);
  }
  let showGen = 0;
  function show(t) {
    tab = t;
    $$('#adTabs button').forEach((b) => b.classList.toggle('active', b.dataset.t === t));
    box().innerHTML = '<div class="skeleton"></div>';
    const g = ++showGen;
    // sekme hızlı değiştirilirse (ya da aynı sekme iki kez açılırsa) eski yüklemenin hatası yenisinin üstüne yazılmaz
    (R[t] || R.partners)().catch((e) => { if (g !== showGen) return; console.warn(e); box().innerHTML = `<div class="empty"><p>${esc(e.message)}</p></div>`; });
  }
  async function pickBanner() {
    const r = await cx.pickImage({ maxKB: 8000 });
    if (!r) return null;
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = r.dataUrl; });
    const W = 800, H = 250, s = Math.max(W / img.width, H / img.height);
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const sw = W / s, sh = H / s;
    c.getContext('2d').drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, 0, 0, W, H);
    let q = 0.85, out = c.toDataURL('image/jpeg', q);
    while (out.length > 110000 && q > 0.4) { q -= 0.08; out = c.toDataURL('image/jpeg', q); }
    return out;
  }
  // Kart simgesi: her zaman 64x64 şeffaf PNG (oyundaki mod bu boyutu bekler)
  async function pickIcon() {
    const r = await cx.pickImage({ maxKB: 5000 });
    if (!r) return null;
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = r.dataUrl; });
    const c = document.createElement('canvas'); c.width = 64; c.height = 64;
    const x = c.getContext('2d'); x.imageSmoothingQuality = 'high';
    const s = Math.min(64 / img.width, 64 / img.height);
    x.drawImage(img, (64 - img.width * s) / 2, (64 - img.height * s) / 2, img.width * s, img.height * s);
    return c.toDataURL('image/png');
  }
  async function pickSmallImage(maxW, maxH, keepPng) {
    const r = await cx.pickImage({ maxKB: 5000 });
    if (!r) return null;
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = r.dataUrl; });
    if (keepPng) return { dataUrl: r.dataUrl, w: img.width, h: img.height };
    const scale = Math.min(1, maxW / img.width, maxH / img.height);
    const c = document.createElement('canvas'); c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return { dataUrl: c.toDataURL('image/png'), w: c.width, h: c.height };
  }

  const R = {
    // ---------------------------------------------------------- partner sunucular
    async partners() {
      const d = (await sc('adminGet', 'partners')) || { list: [] };
      data.partners = d.list || [];
      const render = () => {
        box().innerHTML = `<p class="ad-p">Ana sayfada sadece arka plansız logo görünür (tıklayınca oyun direkt sunucuya girer). "Sunucular" sayfasında banner, logo, açıklama, etiketler, oyuncu sayısı ve Web Sitesi / Katıl butonlarıyla kart olarak görünür. Logo için arka planı şeffaf PNG kullan; banner geniş (yaklaşık 16:5) kırpılır.</p>
          <div id="adList">${data.partners.map((p, i) => `<div class="ad-card" data-i="${i}">
            <div class="ad-logo">${p.logo ? `<img src="${esc(p.logo)}" alt="" />` : '?'}<button class="btn btn-ghost tiny" data-logo>Logo</button>
              <div class="ad-banner" style="${p.banner ? `background-image:url('${esc(p.banner)}')` : ''}">${p.banner ? '' : 'Banner yok'}</div><button class="btn btn-ghost tiny" data-banner>Banner</button>${p.banner ? '<button class="btn btn-ghost tiny" data-nobanner>Kaldır</button>' : ''}</div>
            <div class="ad-fields">${field('Ad', inp('name', p.name, 'Sunucu adı'))}${field('IP', inp('ip', p.ip, 'play.ornek.com'))}${field('Sürüm', inp('version', p.version, '1.21.1 (boş = profilin sürümü)'))}
              ${field('Açıklama', inp('desc', p.desc, 'Kısa açıklama'))}${field('Dil', inp('lang', p.lang || 'TR', 'TR'))}${field('Kategoriler (virgülle)', inp('tags', p.tags, 'Survival, Skyblock, Towny'))}${field('Discord', inp('discord', p.discord, 'https://discord.gg/...'))}${field('Web sitesi', inp('website', p.website, 'https://...'))}
              <label class="ad-chk"><input type="checkbox" data-k="active" ${p.active !== false ? 'checked' : ''} /> Aktif</label></div>
            <div class="ad-ctl"><button class="icon-btn tiny" data-up>↑</button><button class="icon-btn tiny" data-down>↓</button><button class="icon-btn tiny danger" data-del>✕</button></div></div>`).join('') || '<div class="s-empty">Henüz partner yok.</div>'}</div>
          <button class="btn btn-ghost" id="adAdd">+ Partner ekle</button>${saveBar('adSave')}`;
        const sync = () => $$('.ad-card', box()).forEach((el) => { const i = Number(el.dataset.i); data.partners[i] = { ...data.partners[i], ...readCard(el) }; });
        $('#adAdd').onclick = () => { sync(); data.partners.push({ name: '', ip: '', active: true }); render(); };
        $$('.ad-card', box()).forEach((el) => {
          const i = Number(el.dataset.i);
          $('[data-del]', el).onclick = () => { sync(); data.partners.splice(i, 1); render(); };
          $('[data-up]', el).onclick = () => { sync(); if (i > 0) [data.partners[i - 1], data.partners[i]] = [data.partners[i], data.partners[i - 1]]; render(); };
          $('[data-down]', el).onclick = () => { sync(); if (i < data.partners.length - 1) [data.partners[i + 1], data.partners[i]] = [data.partners[i], data.partners[i + 1]]; render(); };
          $('[data-logo]', el).onclick = async () => { const r = await pickSmallImage(160, 160); if (r) { sync(); data.partners[i].logo = r.dataUrl; render(); } }; // PNG: şeffaflık korunur
          // dikey kart banner'ı: 3:4 oranına kırpılır, JPEG ile küçültülür
          $('[data-banner]', el).onclick = async () => { const r = await pickBanner(); if (r) { sync(); data.partners[i].banner = r; render(); } };
          const nb = $('[data-nobanner]', el); if (nb) nb.onclick = () => { sync(); data.partners[i].banner = ''; render(); };
        });
        $('#adSave').onclick = async () => {
          sync();
          const bad = data.partners.find((p) => !p.name || !p.ip);
          if (bad) { toast('Her partnerin adı ve IP adresi olmalı.', 'error'); return; }
          try { await sc('adminSet', 'partners', { list: data.partners }); toast('Partnerler kaydedildi. Tüm oyunculara gitti.', 'success'); Social.renderPartners(); } catch (e) { toast(e.message, 'error'); }
        };
      };
      render();
    },

    // ---------------------------------------------------------- mağaza
    async shop() {
      const d = (await sc('adminGet', 'shop')) || { items: {} };
      data.shop = d.items || {};
      // efektler mağazada yoksa hazır ekle (Kaydet'e basınca herkese gider)
      const seed = { 'effect-ates': { name: 'Kırmızı Ateş', type: 'effect', ref: 'ates', price: 1500, rarity: 'efsanevi', active: true, desc: 'Etrafında yükselen kırmızı alevler. Oyunda Cubixora kullanan herkes görür.' },
        'effect-ruh': { name: 'Mavi Ateş', type: 'effect', ref: 'ruh', price: 2000, rarity: 'efsanevi', active: true, desc: 'Etrafında yükselen mavi ruh alevleri. Oyunda Cubixora kullanan herkes görür.' } };
      const added = Object.keys(seed).filter((k) => !data.shop[k]);
      for (const k of added) data.shop[k] = seed[k];
      if (added.length) setTimeout(() => toast('Kırmızı Ateş ve Mavi Ateş mağaza listesine eklendi. Yayına almak için en alttaki "Kaydet ve herkese gönder"e bas.', 'success'), 300);
      const gd0 = Object.fromEntries(Object.entries(data.shop).map(([k, v]) => [k, v.giveDays]));   // yüklenirkenki gün sayıları
      const assets = await cx.cosmeticAssets().catch(() => ({ capes: {}, wings: {} }));
      const render = () => {
        const ids = Object.keys(data.shop).sort((a, b) => (data.shop[a].type || '').localeCompare(data.shop[b].type || '') || (data.shop[a].price || 0) - (data.shop[b].price || 0));
        box().innerHTML = `<p class="ad-p">Ürün kimliği "tür-ad" şeklindedir (ör. <code>cape-galaksi</code>). Yeni pelerin için 64×32 PNG, yeni kanat için 128×128 PNG yükle; oyundaki mod dokuyu kendisi indirir. Fiyatı 0 yaparsan ürün ücretsiz olur. <b>Dağıtım</b>: ürünü herkese süresiz ya da belirli gün süreli verebilirsin; tek oyuncuya vermek için Kullanıcılar sekmesinde eşyayı seçip gün yaz (boş = süresiz). Emote ve sprey ürünlerinde oyun içi tasarımı sen seçersin.</p>
          <div id="adList">${ids.map((id) => { const it = data.shop[id]; const tex = it.texture || (it.type === 'cape' ? assets.capes[it.ref] : it.type === 'wings' ? (assets.wingPreviews || {})[it.ref] || assets.wings[it.ref] : '');
            return `<div class="ad-card" data-id="${esc(id)}">
              <div class="ad-logo">${it.icon ? `<img src="${esc(it.icon)}" alt="" />` : tex ? `<img src="${esc(tex)}" alt="" class="pix" />` : (assets.icons || {})[`${it.type}_${it.ref}`] ? `<img src="${esc(assets.icons[`${it.type}_${it.ref}`])}" alt="" />` : it.color ? `<span class="swatch big" style="background:${esc(it.color)}"></span>` : '🎁'}${['cape', 'wings'].includes(it.type) ? '<button class="btn btn-ghost tiny" data-tex>Doku</button>' : ''}<button class="btn btn-ghost tiny" data-icon title="Oyun içi gardrop ve mağazada görünen 64x64 simge">Simge</button>${it.icon ? '<button class="btn btn-ghost tiny" data-noicon>Simgeyi kaldır</button>' : ''}</div>
              <div class="ad-fields"><div class="ad-id"><code>${esc(id)}</code></div>${field('Ad', inp('name', it.name))}${field('Tür', sel('type', it.type, TYPES))}${field('Fiyat (coin)', inp('price', it.price, '0', 'number'))}
                ${field('Nadirlik', sel('rarity', it.rarity || 'nadir', RAR))}${['frame', 'color'].includes(it.type) ? field('Renk', `<input class="input" type="color" data-k="color" value="${esc(it.color || '#ffffff')}" />`) : ''}${field('Açıklama', inp('desc', it.desc, ''))}
                ${['emote', 'spray'].includes(it.type) ? field('Oyun içi tasarım', sel('ref', it.ref || DESIGNS[it.type][0][0], DESIGNS[it.type])) : ''}
                ${['pet', 'hat', 'fpet', 'effect'].includes(it.type) ? field('Kart açısı (°)', inp('viewYaw', it.viewYaw ?? '', 'otomatik')) + field('Kart eğimi (°)', inp('viewPitch', it.viewPitch ?? '', 'otomatik')) + field('Kart yakınlığı (×)', inp('viewZoom', it.viewZoom ?? '', 'otomatik · 1 = normal')) : ''}
                ${field('Dağıtım', sel('give', it.give || '', GIVE))}${(it.give === 'allTimed') ? field('Kaç gün (herkese)', inp('giveDays', it.giveDays || 7, '7', 'number')) + `<small class="ad-hint">${it.giveUntil > Date.now() ? 'Bitiş: ' + new Date(it.giveUntil).toLocaleString('tr-TR') : (it.giveUntil ? 'Süresi doldu' : 'Kaydedince başlar')}</small>` : ''}
                <label class="ad-chk"><input type="checkbox" data-k="active" ${it.active !== false ? 'checked' : ''} /> Satışta</label></div>
              <div class="ad-ctl"><button class="icon-btn tiny danger" data-del>✕</button></div></div>`; }).join('')}</div>
          <div class="ad-new">${field('Yeni ürün türü', sel('ntype', 'cape', TYPES))}${field('Kısa ad (a-z, 0-9)', '<input class="input" id="adNewRef" placeholder="ör. ejder2" />')}<button class="btn btn-ghost" id="adAdd">+ Ürün ekle</button></div>${saveBar('adSave')}`;
        const sync = () => $$('.ad-card', box()).forEach((el) => { const id = el.dataset.id; data.shop[id] = { ...data.shop[id], ...readCard(el) }; });
        $('#adAdd').onclick = () => {
          sync();
          const type = $('[data-k="ntype"]', box()).value, ref = $('#adNewRef').value.trim().toLowerCase();
          if (!/^[a-z0-9_]{2,30}$/.test(ref)) { toast('Kısa ad 2-30 karakter: küçük harf, rakam, _', 'error'); return; }
          if (FIXED_DESIGN.includes(type) && !DESIGNS[type].some((d) => d[0] === ref)) { toast(`Bu tür için kısa ad bir tasarım olmalı: ${DESIGNS[type].map((d) => d[0]).join(', ')}`, 'error'); return; }
          const id = `${type}-${ref}`;
          if (data.shop[id]) { toast('Bu kimlikte ürün zaten var.', 'error'); return; }
          data.shop[id] = { name: FIXED_DESIGN.includes(type) ? DESIGNS[type].find((d) => d[0] === ref)[1] : ref, type, ref: FIXED_DESIGN.includes(type) ? ref : DESIGNS[type] ? DESIGNS[type][0][0] : ref, price: 500, rarity: 'nadir', active: true, ...(type === 'frame' || type === 'color' ? { color: '#ffffff' } : {}) };
          render();
        };
        $$('.ad-card', box()).forEach((el) => {
          const id = el.dataset.id;
          const gv = $('[data-k="give"]', el); if (gv) gv.onchange = () => { sync(); render(); };
          const tv = $('[data-k="type"]', el); if (tv) tv.onchange = () => { sync(); render(); };
          $('[data-del]', el).onclick = async () => { if (!(await confirmBox('Ürün silinsin mi?', `${id} mağazadan kaldırılır (alanların envanterinde kalır ama mağazada görünmez).`, 'Sil'))) return; sync(); delete data.shop[id]; render(); };
          const ic = $('[data-icon]', el); if (ic) ic.onclick = async () => { const u = await pickIcon(); if (!u) return; if (u.length > 40000) { toast('Simge çok büyük.', 'error'); return; } sync(); data.shop[id].icon = u; render(); };
          const nic = $('[data-noicon]', el); if (nic) nic.onclick = () => { sync(); delete data.shop[id].icon; render(); };
          const tex = $('[data-tex]', el);
          if (tex) tex.onclick = async () => {
            const it = data.shop[id];
            const r = await pickSmallImage(256, 256, true);
            if (!r) return;
            if (it.type === 'cape' && !(r.w % 64 === 0 && r.w <= 512 && r.h === r.w / 2)) { toast(`Pelerin dokusu 64×32 ya da katı olmalı (kare olmaz): 128×64, 256×128, 512×256 (seçtiğin: ${r.w}×${r.h}).`, 'error'); return; }
            if (it.type === 'wings' && !(r.w === 128 && r.h === 128) && !(r.w === 64 && r.h === 64)) { toast(`Kanat dokusu 128×128 olmalı (seçtiğin: ${r.w}×${r.h}).`, 'error'); return; }
            if (r.dataUrl.length > 270000) { toast('Doku dosyası çok büyük (en fazla ~190 KB). PNG’yi küçült ya da 256×128 kullan.', 'error'); return; }
            sync(); data.shop[id].texture = r.dataUrl; render();
          };
        });
        $('#adSave').onclick = async () => {
          sync();
          for (const [id, it] of Object.entries(data.shop)) {
            it.price = Math.max(0, Math.round(Number(it.price) || 0)); if (!it.ref) it.ref = '';
            if (it.give === 'allTimed') { const d = Math.max(1, Math.min(3650, Math.floor(Number(it.giveDays) || 7))); if (!it.giveUntil || it.giveUntil < Date.now() || gd0[id] !== d) it.giveUntil = Date.now() + d * 86400000; it.giveDays = d; }
            else { delete it.giveUntil; delete it.giveDays; if (!it.give) delete it.give; }
            gd0[id] = it.giveDays;
          }
          try { await sc('adminSet', 'shop', { items: data.shop }); toast('Mağaza kaydedildi. Tüm oyunculara gitti.', 'success'); } catch (e) { toast(e.message, 'error'); }
        };
      };
      render();
    },


    // ---------------------------------------------------------- haberler
    async news() {
      let list = await sc('adminNewsList');
      const TAGS = ['Güncelleme', 'Duyuru', 'Etkinlik'];
      const tagSel = (v) => `<select class="select" data-k="tag">${TAGS.map((t) => `<option ${t === v ? 'selected' : ''}>${t}</option>`).join('')}</select>`;
      const render = () => {
        box().innerHTML = `<p class="ad-p">Burada yayınladığın haberler launcher'daki <b>Haberler</b> sayfasında kart olarak görünür. Görsel geniş (16:5) kırpılır. Her haberi ayrı ayrı kaydedersin.</p>
          <div id="adList">${list.map((n, i) => `<div class="ad-card" data-i="${i}">
            <div class="ad-logo"><div class="ad-banner" style="${n.image ? `background-image:url('${esc(n.image)}')` : ''}">${n.image ? '' : 'Görsel yok'}</div><button class="btn btn-ghost tiny" data-img>Görsel</button>${n.image ? '<button class="btn btn-ghost tiny" data-noimg>Kaldır</button>' : ''}</div>
            <div class="ad-fields">${field('Etiket', tagSel(n.tag || 'Duyuru'))}${field('Başlık', inp('title', n.title, 'Haber başlığı'))}
              <label class="ad-f" style="grid-column:1/-1"><span>Metin</span><textarea class="input" data-k="text" rows="5" placeholder="Haberin tam metni">${esc(n.text || '')}</textarea></label>
              <label class="ad-chk"><input type="checkbox" data-k="active" ${n.active !== false ? 'checked' : ''} /> Yayında</label></div>
            <div class="ad-ctl"><button class="btn btn-primary tiny" data-save>Kaydet</button><button class="icon-btn tiny danger" data-del>✕</button></div></div>`).join('') || '<div class="s-empty">Henüz haber yok.</div>'}</div>
          <button class="btn btn-ghost" id="adAdd">+ Haber ekle</button>`;
        const sync = () => $$('.ad-card', box()).forEach((el) => { const i = Number(el.dataset.i); list[i] = { ...list[i], ...readCard(el) }; });
        $('#adAdd').onclick = () => { sync(); list.unshift({ tag: 'Duyuru', title: '', text: '', active: true, isNew: true }); render(); };
        $$('.ad-card', box()).forEach((el) => {
          const i = Number(el.dataset.i);
          $('[data-img]', el).onclick = async () => { const r = await pickBanner(); if (r) { sync(); list[i].image = r; render(); } };
          const ni = $('[data-noimg]', el); if (ni) ni.onclick = () => { sync(); list[i].image = ''; render(); };
          $('[data-save]', el).onclick = async () => {
            sync();
            try { const id = await sc('adminNewsSave', { ...list[i], id: list[i].isNew ? undefined : list[i].id }); list[i].id = id; list[i].isNew = false; list[i].at = list[i].at || Date.now(); toast('Haber kaydedildi. Herkese gitti.', 'success'); }
            catch (e) { toast(e.message, 'error'); }
          };
          $('[data-del]', el).onclick = async () => {
            if (!(await confirmBox('Haber silinsin mi?', 'Bu haber herkesten kaldırılır.', 'Sil'))) return;
            try { if (!list[i].isNew && list[i].id) await sc('adminNewsDelete', list[i].id); sync(); list.splice(i, 1); render(); } catch (e) { toast(e.message, 'error'); }
          };
        });
      };
      render();
    },

    // ---------------------------------------------------------- görevler
    async quests() {
      const d = (await sc('adminGet', 'quests')) || { events: {} };
      const shopCfg = (await sc('adminGet', 'shop')) || { items: {} };
      const rewardItems = Object.entries(shopCfg.items || {}).filter(([, it]) => ['cape', 'wings', 'emote', 'spray'].includes(it.type));
      const STATS = [['launch', "Launcher'a gir"], ['game', 'Oyunu Cubixora ile başlat'], ['minutes', 'Oyunda dakika geçir'], ['mod', 'Mod indir'], ['resourcepack', 'Doku paketi indir'], ['shader', 'Shader indir'],
        ['partner', 'Partner sunucuya katıl'], ['search', 'İçerik ara'], ['call', 'Sesli arama yap'], ['group_join', 'Gruba katıl'], ['share', 'Paylaşım yap'], ['friends', 'Arkadaş sayısına ulaş'],
        ['messages', 'Mesaj gönder'], ['buy', 'Mağazadan satın al'], ['level', 'Seviyeye ulaş'], ['launcher_minutes', "Launcher'da dakika geçir"], ['partner_minutes', 'Partner sunucularda dakika oyna']];
      const rid = (p) => p + Math.random().toString(16).slice(2, 8);
      let events = Object.entries(d.events || {}).sort((a, b) => (a[1].order || 99) - (b[1].order || 99)).map(([id, e]) => ({ id, ...e, steps: Object.entries(e.steps || {}).sort((a, b) => (a[1].order || 99) - (b[1].order || 99)).map(([sid, s]) => ({ id: sid, ...s })) }));
      const toLocal = (t) => (t ? new Date(t - new Date(t).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '');
      const fromLocal = (v) => (v ? new Date(v).getTime() : 0);
      const render = () => {
        box().innerHTML = `<p class="ad-p">Her etkinlik bir görev zinciridir: oyuncu adımları yapıp tek tek <b>Al</b>'a basarak coin/LP kazanır, hepsi bitince zincirin ödülü olan <b>süreli</b> pelerini alır (süre, ödülü aldığı andan başlar). Ödül pelerin için önce <b>Mağaza</b> sekmesinde bir pelerin ekleyip dokusunu yükle; mağazada satılmasın diye ürünün "Satışta" kutusunu kapat (görev ödülü olarak yine verilir). Haftalık yeni pelerin için yeni bir etkinlik ekle, eskisini "Aktif" kutusundan kapat.</p>
          <div id="adList">${events.map((e, i) => `<div class="ad-card q-ad" data-i="${i}">
            <div class="ad-fields wide">
              ${field('Etkinlik adı', inp('title', e.title, 'Okula Dönüş'))}${field('Açıklama', inp('desc', e.desc, 'Kısa açıklama'))}
              ${field('Başlangıç (boş = hemen)', `<input class="input" type="datetime-local" data-k="startsAt" value="${toLocal(e.startsAt)}" />`)}${field('Bitiş (boş = süresiz)', `<input class="input" type="datetime-local" data-k="endsAt" value="${toLocal(e.endsAt)}" />`)}
              ${field('Ödül (süreli kozmetik)', `<select class="select" data-k="rewardItem"><option value="">— ödül yok —</option>${rewardItems.map(([id, it]) => `<option value="${esc(id)}" ${id === e.rewardItem ? 'selected' : ''}>${esc(it.name)} (${esc(id)})</option>`).join('')}</select>`)}
              ${field('Ödül süresi (gün)', inp('rewardDays', e.rewardDays || 7, '7', 'number'))}
              <label class="ad-chk"><input type="checkbox" data-k="active" ${e.active !== false ? 'checked' : ''} /> Aktif</label></div>
            <div class="q-ad-steps"><b>Adımlar</b><div class="q-ad-step q-ad-head"><span>Adım adı</span><span>Açıklama</span><span>Görev türü</span><span>Hedef</span><span>Coin</span><span>LP</span><span></span></div>${e.steps.map((s, j) => `<div class="q-ad-step" data-j="${j}">
              ${inp('title', s.title, 'Adım adı')}${inp('desc', s.desc, 'Açıklama')}${sel('stat', s.stat || 'launch', STATS)}
              ${inp('goal', s.goal || 1, 'Hedef', 'number')}${inp('coins', s.coins || 0, 'Coin', 'number')}${inp('lp', s.lp || 0, 'LP', 'number')}<button class="icon-btn tiny danger" data-sdel>✕</button></div>`).join('')}
              <button class="btn btn-ghost tiny" data-sadd>+ Adım ekle</button></div>
            <div class="ad-ctl"><button class="icon-btn tiny" data-up>↑</button><button class="icon-btn tiny" data-down>↓</button><button class="icon-btn tiny danger" data-del>✕</button></div></div>`).join('') || '<div class="s-empty">Henüz etkinlik yok.</div>'}</div>
          <button class="btn btn-ghost" id="adAdd">+ Etkinlik ekle</button>${saveBar('adSave')}`;
        const sync = () => $$('.ad-card', box()).forEach((el) => {
          const i = Number(el.dataset.i), top = readCard($('.ad-fields', el));
          const steps = $$('.q-ad-step', el).map((se, j) => ({ ...events[i].steps[j], ...readCard(se) }));
          events[i] = { ...events[i], ...top, startsAt: fromLocal(top.startsAt), endsAt: fromLocal(top.endsAt), steps };
        });
        $('#adAdd').onclick = () => { sync(); events.push({ id: rid('e'), title: '', desc: '', active: true, rewardDays: 7, steps: [{ id: rid('s'), title: '', stat: 'launch', goal: 1, coins: 10, lp: 10 }] }); render(); };
        $$('.ad-card', box()).forEach((el) => {
          const i = Number(el.dataset.i);
          $('[data-del]', el).onclick = async () => { if (!(await confirmBox('Etkinlik silinsin mi?', 'Görev zinciri kaldırılır.', 'Sil'))) return; sync(); events.splice(i, 1); render(); };
          $('[data-up]', el).onclick = () => { sync(); if (i > 0) [events[i - 1], events[i]] = [events[i], events[i - 1]]; render(); };
          $('[data-down]', el).onclick = () => { sync(); if (i < events.length - 1) [events[i + 1], events[i]] = [events[i], events[i + 1]]; render(); };
          $('[data-sadd]', el).onclick = () => { sync(); events[i].steps.push({ id: rid('s'), title: '', stat: 'launch', goal: 1, coins: 10, lp: 10 }); render(); };
          $$('[data-sdel]', el).forEach((b) => (b.onclick = () => { sync(); events[i].steps.splice(Number(b.closest('.q-ad-step').dataset.j), 1); render(); }));
        });
        $('#adSave').onclick = async () => {
          sync();
          const out = {};
          for (const [i, e] of events.entries()) {
            if (!e.title) { toast('Her etkinliğin adı olmalı.', 'error'); return; }
            if (!e.steps.length) { toast(`"${e.title}" için en az bir adım ekle.`, 'error'); return; }
            const steps = {};
            for (const [j, s] of e.steps.entries()) {
              if (!s.title) { toast(`"${e.title}" içinde adı boş bir adım var.`, 'error'); return; }
              steps[s.id] = { title: s.title, desc: s.desc || '', stat: s.stat, goal: Math.max(1, Math.round(Number(s.goal) || 1)), coins: Math.max(0, Math.round(Number(s.coins) || 0)), lp: Math.max(0, Math.round(Number(s.lp) || 0)), order: j + 1 };
            }
            out[e.id] = { title: e.title, desc: e.desc || '', active: e.active !== false, startsAt: e.startsAt || 0, endsAt: e.endsAt || 0, order: i + 1, steps, ...(e.rewardItem ? { rewardItem: e.rewardItem, rewardDays: Math.max(1, Math.round(Number(e.rewardDays) || 7)) } : {}) };
          }
          try { await sc('adminSet', 'quests', { events: out }); toast('Görevler kaydedildi. Tüm oyunculara gitti.', 'success'); } catch (e) { toast(e.message, 'error'); }
        };
      };
      render();
    },

    // ---------------------------------------------------------- çekilişler
    async giveaways() {
      const GSTATS = [['launcher_minutes', "Launcher'da dakika geçir"], ['partner_minutes', 'Partner sunucularda dakika oyna'], ['minutes', 'Oyunda dakika oyna'],
        ['launch', "Launcher'ı aç"], ['game', 'Oyunu Cubixora ile başlat'], ['partner', 'Partner sunucuya katıl'], ['friends', 'Arkadaş sayısına ulaş'],
        ['messages', 'Mesaj gönder'], ['level', 'Seviyeye ulaş'], ['buy', 'Mağazadan ürün al'], ['mod', 'Mod indir'], ['call', 'Sesli arama yap']];
      const toLocal = (t) => (t ? new Date(t - new Date(t).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '');
      const fromLocal = (v) => (v ? new Date(v).getTime() : 0);
      const fmt = (t) => (t ? new Date(t).toLocaleString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
      let list = await sc('adminGiveaways');
      let form = null;   // düzenlenen / yeni çekiliş
      const open = new Set();
      const blank = () => ({ title: '', desc: '', prize: '', image: '', winnerCount: 1, startsAt: 0, drawAt: Date.now() + 7 * 864e5, conds: [{ stat: 'launcher_minutes', goal: 60, title: '' }, { stat: 'partner_minutes', goal: 15, title: '' }] });
      const stLabel = (g) => (g.status === 'drawn' ? `Açıklandı · ${(g.winners || []).length} kazanan` : Date.now() >= g.drawAt ? 'Kura bekliyor' : 'Aktif');
      const formHtml = (f) => `<div class="ad-card gw-form">
        <div class="gw-fh"><span class="gw-fh-ic">🎁</span><div><b>${f.id ? 'Çekilişi düzenle' : 'Yeni çekiliş'}</b><small>Bilgileri doldur, koşulları seç, başlat. Kaydettiğin an herkese gider.</small></div></div>
        <div class="gw-left">
        <div class="ad-fields" id="gwF">
          ${field('Başlık', inp('title', f.title, 'Ekim Çekilişi'))}${field('Ödül', inp('prize', f.prize, 'Cubixora+ 1 ay / 500 coin / VIP'))}
          ${field('Açıklama', inp('desc', f.desc, 'Kısa açıklama'))}${field('Kazanan sayısı', inp('winnerCount', f.winnerCount, '1', 'number'))}
          ${field('Başlangıç (boş = hemen)', `<input class="input" type="datetime-local" data-k="startsAt" value="${toLocal(f.startsAt)}" />`)}
          ${field('Sonuçların açıklanacağı zaman', `<input class="input" type="datetime-local" data-k="drawAt" value="${toLocal(f.drawAt)}" />`)}
        </div>
        <div class="gw-ad-img ${f.image ? 'has' : ''}" id="gwImg" style="${f.image ? `background-image:url('${f.image}')` : ''}">${f.image ? '<span class="gw-img-chg">Görseli değiştir</span>' : '<span><b>＋</b> Görsel seç (isteğe bağlı)<small>800×250 önerilir</small></span>'}</div>
        </div>
        <div class="gw-ad-conds"><b>Katılma koşulları (görevler)</b><small class="muted">Süre koşullarında hedef <b>dakika</b> cinsindendir (1 saat = 60). İlerleme çekiliş başladıktan sonra sayılır. Başlık boşsa otomatik yazılır.</small>
          ${f.conds.map((c, j) => `<div class="gw-ad-cond" data-j="${j}">${sel('stat', c.stat, GSTATS)}${inp('goal', c.goal, 'Hedef', 'number')}${inp('title', c.title, 'Başlık (isteğe bağlı)')}<button class="icon-btn tiny danger" data-cdel>✕</button></div>`).join('')}
          <button class="btn btn-ghost tiny" id="gwCAdd">+ Koşul ekle</button></div>
        <div class="ad-save"><button class="btn btn-ghost" id="gwCancel">Vazgeç</button><button class="btn btn-primary" id="gwSave">${f.id ? 'Kaydet' : 'Çekilişi başlat'}</button></div></div>`;
      const syncForm = () => {
        if (!form) return;
        const top = readCard($('#gwF'));
        form = { ...form, ...top, startsAt: fromLocal(top.startsAt), drawAt: fromLocal(top.drawAt), conds: $$('.gw-ad-cond', box()).map((el) => readCard(el)) };
      };
      const entriesHtml = (g, rows) => {
        const win = new Set((g.winners || []).map((w) => w.uid));
        return `<div class="gw-ad-ents"><table><thead><tr><th>#</th><th>OYUNCU</th><th>E-POSTA</th><th>KATILMA</th></tr></thead><tbody>${rows.map((r, i) => `<tr><td>${i + 1}</td><td class="${win.has(r.uid) ? 'win' : ''}">${win.has(r.uid) ? '🏆 ' : ''}${esc(r.name)}</td><td>${esc(r.email || '—')}</td><td>${fmt(r.at)}</td></tr>`).join('') || '<tr><td colspan="4" class="muted">Henüz katılan yok.</td></tr>'}</tbody></table></div>`;
      };
      const render = () => {
        box().innerHTML = `<p class="ad-p">Çekiliş aç, katılma koşullarını (görevleri) belirle. Oyuncular görevleri bitirince <b>Görevler</b> sayfasından katılır; görev tamamlanınca launcher'da ve oyunda bildirim çıkar. Açıklanma zamanı gelince kura <b>bu launcher açıksa otomatik</b> çekilir (istersen "Şimdi çek"). Kazananlara bildirim gider; çekiliş açıklandıktan 1 gün sonra kendiliğinden silinir.</p>
          ${form ? formHtml(form) : '<button class="btn btn-primary" id="gwNew">+ Yeni çekiliş</button>'}
          <div class="gw-ad-list" style="margin-top:14px">${list.map((g) => `<div class="gw-ad-row" data-id="${esc(g.id)}">
            <div><b>${esc(g.title)}</b><small>${stLabel(g)} · ${g.entries || 0} katılımcı · ${g.winnerCount || 1} kazanan · açıklanma: ${fmt(g.drawAt)}${g.prize ? ` · ödül: ${esc(g.prize)}` : ''}</small>
              ${g.status === 'drawn' && (g.winners || []).length ? `<small>Kazanan: <b>${g.winners.map((w) => esc(w.name)).join(', ')}</b></small>` : ''}</div>
            <div class="gw-ad-btns"><button class="btn btn-ghost tiny" data-ents>${open.has(g.id) ? 'Gizle' : 'Katılımcılar'}</button>
              ${g.status !== 'drawn' ? '<button class="btn btn-ghost tiny" data-edit>Düzenle</button><button class="btn btn-ghost tiny" data-draw>Şimdi çek</button>' : ''}
              <button class="btn btn-ghost tiny danger" data-del>Sil</button></div>
            ${open.has(g.id) ? '<div class="gw-ad-ents" data-slot><div class="skeleton" style="height:60px"></div></div>' : ''}</div>`).join('') || '<div class="s-empty">Şu an çekiliş yok.</div>'}</div>`;
        if (!form) $('#gwNew').onclick = () => { form = blank(); render(); };
        else {
          $('#gwCancel').onclick = () => { form = null; render(); };
          $('#gwCAdd').onclick = () => { syncForm(); if (form.conds.length >= 8) return toast('En fazla 8 koşul.', 'error'); form.conds.push({ stat: 'launch', goal: 1, title: '' }); render(); };
          $$('[data-cdel]', box()).forEach((b) => (b.onclick = () => { syncForm(); form.conds.splice(Number(b.closest('.gw-ad-cond').dataset.j), 1); render(); }));
          $('#gwImg').onclick = async () => { syncForm(); const img = await pickBanner(); if (img) { form.image = img; render(); } };
          $('#gwSave').onclick = async (e) => {
            syncForm();
            if (!form.title.trim()) return toast('Başlık yaz.', 'error');
            if (!form.drawAt || form.drawAt < Date.now() + 60000) return toast('Açıklanma zamanı ileri bir tarih olmalı.', 'error');
            e.target.disabled = true;
            try { list = await sc('adminGiveawaySave', form); form = null; toast('Çekiliş kaydedildi, herkese gitti.', 'success'); render(); }
            catch (err) { toast(err.message, 'error'); e.target.disabled = false; }
          };
        }
        $$('.gw-ad-row', box()).forEach((row) => {
          const id = row.dataset.id, g = list.find((x) => x.id === id);
          $('[data-ents]', row).onclick = () => { if (open.has(id)) open.delete(id); else open.add(id); render(); };
          const ed = $('[data-edit]', row); if (ed) ed.onclick = () => { form = { ...g, conds: (g.conds || []).map((c) => ({ stat: c.stat, goal: c.goal, title: c.title })) }; render(); box().scrollTop = 0; };
          const dr = $('[data-draw]', row);
          if (dr) dr.onclick = async () => {
            if (!(await confirmBox('Kura şimdi çekilsin mi?', `"${g.title}" için ${g.winnerCount || 1} kazanan rastgele seçilir ve çekiliş kapanır.`, 'Çek'))) return;
            dr.disabled = true;
            try { const r = await sc('adminGiveawayDraw', id); toast(r.winners.length ? `Kazanan: ${r.winners.map((w) => w.name).join(', ')}` : 'Katılımcı yoktu, kazanan çıkmadı.', 'success'); list = await sc('adminGiveaways'); open.add(id); render(); }
            catch (err) { toast(err.message, 'error'); dr.disabled = false; }
          };
          $('[data-del]', row).onclick = async () => {
            if (!(await confirmBox('Çekiliş silinsin mi?', 'Çekiliş ve tüm katılımlar kalıcı olarak silinir.', 'Sil'))) return;
            try { await sc('adminGiveawayDelete', id); list = list.filter((x) => x.id !== id); open.delete(id); toast('Çekiliş silindi.', 'success'); render(); } catch (err) { toast(err.message, 'error'); }
          };
          const slot = $('[data-slot]', row);
          if (slot) sc('adminGiveawayEntries', id).then((rows) => {
            slot.outerHTML = entriesHtml(g, rows) + (rows.length ? `<div class="gw-ad-btns" style="grid-column:1/-1;justify-content:flex-start"><button class="btn btn-ghost tiny" data-copy>E-postaları kopyala (${rows.filter((r) => r.email).length})</button></div>` : '');
            const cp = $('[data-copy]', row); if (cp) cp.onclick = () => { navigator.clipboard.writeText(rows.map((r) => r.email).filter(Boolean).join('\n')).then(() => toast('Kopyalandı.', 'success')).catch(() => {}); };
          }).catch((err) => { slot.innerHTML = `<p class="muted" style="padding:10px">${esc(err.message)}</p>`; });
        });
      };
      render();
    },

    // ---------------------------------------------------------- başarımlar
    async achievements() {
      const d = (await sc('adminGet', 'achievements')) || { list: {} };
      data.ach = d.list || {};
      const ids = Object.keys(data.ach).sort((a, b) => (data.ach[a].order || 99) - (data.ach[b].order || 99));
      box().innerHTML = `<p class="ad-p">Coin ve LP ödüllerini buradan değiştirebilirsin. Hedefli başarımlarda (ör. 100 mesaj) "Hedef" sayısını değiştir.</p>
        <div class="ad-table"><div class="ad-tr head"><span>Başarım</span><span>Açıklama</span><span>Coin</span><span>LP</span><span>Hedef</span></div>
        ${ids.map((id) => { const a = data.ach[id]; return `<div class="ad-tr" data-id="${esc(id)}">${inp('title', a.title)}${inp('desc', a.desc)}${inp('coins', a.coins, '0', 'number')}${inp('lp', a.lp, '0', 'number')}${a.goal ? inp('goal', a.goal, '', 'number') : '<span class="muted">—</span>'}</div>`; }).join('')}</div>${saveBar('adSave')}`;
      $('#adSave').onclick = async () => {
        $$('.ad-tr[data-id]', box()).forEach((el) => { const id = el.dataset.id; data.ach[id] = { ...data.ach[id], ...readCard(el) }; });
        try { await sc('adminSet', 'achievements', { list: data.ach }); toast('Başarımlar kaydedildi.', 'success'); } catch (e) { toast(e.message, 'error'); }
      };
    },

    // ---------------------------------------------------------- bildirim gönder
    async notify() {
      const recent = await sc('notifications').catch(() => []);
      box().innerHTML = `<div class="ad-card col">
          ${field('Başlık', '<input class="input" id="nTitle" maxlength="100" placeholder="Ör: Yeni güncelleme!" />')}
          ${field('Mesaj', '<textarea class="input" id="nText" rows="4" maxlength="1000" placeholder="Oyunculara gidecek mesaj"></textarea>')}
          <div class="ad-row">${field('Tür', `<select class="select" id="nLevel"><option value="info">Bilgi</option><option value="success">Müjde</option><option value="warning">Uyarı</option><option value="danger">Önemli uyarı</option></select>`)}
          ${field('Kime', '<select class="select" id="nTo"><option value="">Herkese</option><option value="user">Tek bir oyuncuya</option></select>')}
          <label class="ad-f hidden" id="nUserWrap"><span>Oyuncu (@kullanıcı adı)</span><input class="input" id="nUser" placeholder="@kullanici" /></label></div>
          <div class="ad-save"><button class="btn btn-primary" id="nSend">Gönder</button></div></div>
        <div class="s-sec">SON GÖNDERİLENLER</div>
        ${recent.filter((n) => n.scope === 'all').map((n) => `<div class="notif ${esc(n.level)}"><b>${esc(n.title)}</b><p>${esc(n.text)}</p><small>${esc(timeAgo(n.at))}</small><button class="icon-btn tiny danger" data-del="${esc(n.id)}">✕</button></div>`).join('') || '<div class="s-empty">Henüz bildirim yok.</div>'}`;
      $('#nText').onkeydown = (e) => e.stopPropagation();   // Enter her zaman alt satıra geçer
      $('#nTo').onchange = (e) => $('#nUserWrap').classList.toggle('hidden', e.target.value !== 'user');
      $('#nSend').onclick = async () => {
        const title = $('#nTitle').value.trim(), text = $('#nText').value.replace(/\r\n?/g, '\n').trim();
        if (!title) { toast('Başlık yaz.', 'error'); return; }
        let to = null;
        if ($('#nTo').value === 'user') {
          const u = (await sc('adminUser', $('#nUser').value)).find((x) => x.handle === $('#nUser').value.trim().replace(/^@/, '').toLowerCase());
          if (!u) { toast('Oyuncu bulunamadı. Tam @kullanıcı adını yaz.', 'error'); return; }
          to = u.uid;
        }
        try { await sc('adminNotify', { title, text, level: $('#nLevel').value, to }); toast('Bildirim gönderildi.', 'success'); show('notify'); } catch (e) { toast(e.message, 'error'); }
      };
      $$('[data-del]', box()).forEach((b) => (b.onclick = async () => { await sc('adminDeleteNotification', b.dataset.del); show('notify'); }));
    },

    // ---------------------------------------------------------- hata bildirimleri (oyundan)
    async reports() {
      const list = await sc('adminReports');
      box().innerHTML = `<p class="ad-p">Oyundaki "Hata Bildir" düğmesinden gelen bildirimler. Çözülenleri ✕ ile sil.</p>` + (list.map((r) => `<div class="notif info"><b>${esc(r.category || 'Diğer')} · ${esc(r.name || '?')}</b><p>${esc(r.text || '')}</p><small>${esc(r.version || '')} · ${esc(timeAgo(r.at))}</small><button class="icon-btn tiny danger" data-rdel="${esc(r.id)}">✕</button></div>`).join('') || '<div class="s-empty">Henüz bildirim yok.</div>');
      $$('[data-rdel]', box()).forEach((b) => (b.onclick = async () => { await sc('adminDeleteReport', b.dataset.rdel); show('reports'); }));
    },

    // ---------------------------------------------------------- kullanıcılar
    async users() {
      box().innerHTML = `<div class="search"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path d="M21 21l-5-5" /></svg><input id="uQ" placeholder="@kullanıcı adı ara (boş = en yeni üyeler)" /></div><div id="uList" class="ad-users"></div>
        <div class="ad-ban-box"><b>Yasaklı e-postalar</b><small>Bu adreslerle giriş yapılamaz ve yeni hesap açılamaz.</small>
          <div class="ad-ban-add"><input class="input" id="bEmail" placeholder="ornek@gmail.com" spellcheck="false" /><input class="input" id="bWhy" placeholder="Sebep (isteğe bağlı)" /><button class="btn btn-danger" id="bAdd">E-postayı Yasakla</button></div>
          <div id="bList" class="ad-users"></div></div>`;
      const loadBans = async () => {
        const l = await sc('adminBannedEmails').catch(() => []);
        if (!$('#bList')) return;
        $('#bList').innerHTML = l.map((b) => `<div class="ad-user" data-k="${esc(b.id)}"><div class="grow"><b>${esc(b.email)}</b> <small>${esc(b.reason || '')}</small></div><button class="btn btn-ghost tiny" data-unban>Yasağı kaldır</button></div>`).join('') || '<div class="s-empty">Yasaklı e-posta yok.</div>';
        $$('[data-unban]', $('#bList')).forEach((bt) => (bt.onclick = async () => { try { await sc('adminUnbanEmail', bt.closest('.ad-user').dataset.k); toast('Yasak kaldırıldı.', 'success'); loadBans(); } catch (e) { toast(e.message, 'error'); } }));
      };
      $('#bAdd').onclick = async () => { try { await sc('adminBanEmail', $('#bEmail').value, $('#bWhy').value); $('#bEmail').value = ''; $('#bWhy').value = ''; toast('E-posta yasaklandı.', 'success'); loadBans(); } catch (e) { toast(e.message, 'error'); } };
      loadBans();
      const shop = (await sc('adminGet', 'shop').catch(() => null)) || { items: {} };
      if (!$('#uQ')) return;   // bu arada başka sekmeye geçildi
      let loadGen = 0;
      const load = async () => {
        const lg = ++loadGen;
        const q = $('#uQ'); if (!q) return;
        const list = await sc('adminUser', q.value).catch((e) => { toast(e.message, 'error'); return []; });
        if (lg !== loadGen || !$('#uList')) return;   // daha yeni bir arama geldi ya da sekme değişti
        $('#uList').innerHTML = list.map((u) => `<div class="ad-user" data-uid="${esc(u.uid)}">
          <img src="${esc(avatarOf(u, 40))}" alt="" data-fb /><div class="grow"><b>${esc(u.displayName)}</b>${u.self ? ' <span class="badge gold">Sen</span>' : ''} <small>@${esc(u.handle)} · ${esc(u.mcName || '')}</small><div class="muted"><i class="coin-ic">C</i>${u.coins} · ${u.lp} LP${u.banned ? ' · <b class="danger">YASAKLI</b>' : ''}</div><div class="muted">${u.email ? esc(u.email) : 'E-posta: henüz kayıtlı değil (oyuncu yeni sürümle giriş yapınca görünür)'}</div></div>
          <input class="input tiny" type="number" placeholder="coin" data-coins /><input class="input tiny" type="number" placeholder="LP" data-lp />
          <select class="select tiny" data-item><option value="">Eşya ver...</option>${Object.entries(shop.items || {}).map(([id, it]) => `<option value="${esc(id)}">${esc(it.name)}</option>`).join('')}</select>
          <input class="input tiny" type="number" min="0" max="3650" placeholder="gün" title="Eşya kaç gün kalsın? Boş/0 = süresiz" data-days style="width:62px" /><button class="btn btn-primary tiny" data-give>Ver</button>
          <input class="input tiny" placeholder="sebep (isteğe bağlı)" title="Coin/LP alınırken oyuncuya bildirimde gösterilir" data-why style="width:130px" /><button class="btn btn-danger tiny" data-takecoin title="Yukarıdaki coin / LP kadarını oyuncudan geri al">Coin Al</button>
          <select class="select tiny" data-take><option value="">Eşya al...</option>${(u.items || []).map((id) => `<option value="${esc(id)}">${esc(((shop.items || {})[id] || {}).name || id)}</option>`).join('')}</select>
          <button class="btn btn-danger tiny" data-takebtn>Eşyayı Al</button>
          <div class="ad-roles">${[['founder', 'Kurucu'], ['partner', 'Partner'], ['plus', 'Cubixora+']].map(([r, l]) => `<label class="rtag-sel r-${r} ${(u.roles || []).includes(r) ? 'on' : ''}"><input type="checkbox" data-role="${r}" ${(u.roles || []).includes(r) ? 'checked' : ''} />${l}</label>`).join('')}<input class="input tiny" type="number" min="0" max="3650" value="30" data-plusdays title="Cubixora+ kaç gün sürsün? 0 = kalıcı" style="width:64px" /><small>${u.plusUntil > 0 ? (u.plusUntil > Date.now() ? 'Plus: ' + Math.ceil((u.plusUntil - Date.now()) / 86400000) + ' gün kaldı' : 'Plus süresi doldu') : ((u.roles || []).includes('plus') ? 'Plus: kalıcı' : 'Plus gün sayısı')}</small></div><button class="btn ${u.banned ? 'btn-ghost' : 'btn-danger'} tiny" data-ban>${u.banned ? 'Yasağı kaldır' : 'Yasakla'}</button><button class="btn btn-danger tiny" data-del>Kaydı Sil</button></div>`).join('') || '<div class="s-empty">Kimse bulunamadı.</div>';
        $$('.ad-user', box()).forEach((el) => {
          const uid = el.dataset.uid;
          $('[data-give]', el).onclick = async () => {
            const coins = Number($('[data-coins]', el).value) || 0, lp = Number($('[data-lp]', el).value) || 0, item = $('[data-item]', el).value;
            if (!coins && !lp && !item) { toast('Coin, LP ya da eşya seç.', 'error'); return; }
            try { await sc('adminGrant', uid, { coins, lp, items: item ? [item] : [], days: Number($('[data-days]', el).value) || 0 }); toast(item && Number($('[data-days]', el).value) > 0 ? `Verildi (${Number($('[data-days]', el).value)} gün).` : 'Verildi.', 'success'); load(); } catch (e) { toast(e.message, 'error'); }
          };
          $('[data-takecoin]', el).onclick = async () => {
            const coins = Math.abs(Math.floor(Number($('[data-coins]', el).value) || 0)), lp = Math.abs(Math.floor(Number($('[data-lp]', el).value) || 0));
            if (!coins && !lp) { toast('Alınacak coin ya da LP miktarını yaz.', 'error'); return; }
            const name = $('.grow b', el).textContent, what = [coins ? coins + ' coin' : '', lp ? lp + ' LP' : ''].filter(Boolean).join(' ve ');
            if (!(await confirmBox('Coin geri alınsın mı?', `${name} adlı oyuncudan ${what} alınacak. Bakiyesi yetmezse sıfıra kadar alınır. Oyuncuya bildirim gider.`, 'Geri al'))) return;
            try { const r = await sc('adminTake', uid, { coins, lp, reason: $('[data-why]', el).value }); toast(`Alındı: ${[r.coins ? r.coins + ' coin' : '', r.lp ? r.lp + ' LP' : ''].filter(Boolean).join(' ve ')}.`, 'success'); load(); } catch (e) { toast(e.message, 'error'); }
          };
          $$('[data-role]', el).forEach((cb) => (cb.onchange = async () => {
            const roles = $$('[data-role]', el).filter((x) => x.checked).map((x) => x.dataset.role);
            if (cb.dataset.role === 'founder' && cb.checked && !(await confirmBox('Kurucu rütbesi verilsin mi?', 'Kurucu, admin panelinin tamamına erişir: coin verir, ürün ve partner ekler, oyuncu yasaklar.', 'Kurucu yap'))) { cb.checked = false; return; }
            try { await sc('adminSetRoles', uid, roles, cb.dataset.role === 'plus' ? Math.max(0, Math.floor(Number($('[data-plusdays]', el).value) || 0)) : undefined); if (cb.dataset.role === 'plus') load(); cb.closest('label').classList.toggle('on', cb.checked); toast('Rütbe güncellendi.', 'success'); } catch (e) { toast(e.message, 'error'); cb.checked = !cb.checked; }
          }));
          $('[data-takebtn]', el).onclick = async () => {
            const item = $('[data-take]', el).value;
            if (!item) { toast('Önce alınacak eşyayı seç.', 'error'); return; }
            if (!(await confirmBox('Eşya geri alınsın mı?', `${((shop.items || {})[item] || {}).name || item} oyuncunun envanterinden silinir.`, 'Eşyayı al'))) return;
            try { await sc('adminRevoke', uid, item); toast('Eşya alındı.', 'success'); load(); } catch (e) { toast(e.message, 'error'); }
          };
          $('[data-ban]', el).onclick = async () => {
            const banned = $('[data-ban]', el).textContent === 'Yasakla';
            if (banned && !(await confirmBox('Oyuncu yasaklansın mı?', 'Hesabı ve e-postası yasaklanır; launcher\'a giriş yapamaz. Profili aramalarda görünmez.', 'Yasakla'))) return;
            try { const r = await sc('adminBan', uid, banned, banned ? 'Admin tarafından yasaklandı' : ''); toast(banned ? (r && r.email ? `Yasaklandı (${r.email}).` : 'Yasaklandı. E-posta bilinmediği için yalnız hesap yasaklandı; e-postayı aşağıdaki listeden ekleyebilirsin.') : 'Yasak kaldırıldı.', 'success'); load(); loadBans(); } catch (e) { toast(e.message, 'error'); }
          };
          $('[data-del]', el).onclick = async () => {
            if (!(await confirmBox('Oyuncunun kaydı silinsin mi?', 'Profil, coin, envanter, ilerleme ve kozmetik kayıtları kalıcı olarak silinir. Bu geri alınamaz. Ardından e-postası da yasaklanır.', 'Kaydı sil ve yasakla'))) return;
            try { const r = await sc('adminDeleteUser', uid, true, 'Hesap silindi'); toast(`Kayıt silindi (${r.removed} belge).`, 'success'); load(); loadBans(); } catch (e) { toast(e.message, 'error'); }
          };
        });
      };
      let t = null;
      $('#uQ').oninput = () => { clearTimeout(t); t = setTimeout(load, 350); };
      load();
    },

    // ---------------------------------------------------------- hediye kodları
    async codes() {
      const [codes, shop] = await Promise.all([sc('adminCodes'), sc('adminGet', 'shop').catch(() => ({ items: {} }))]);
      const items = Object.entries((shop && shop.items) || {});
      box().innerHTML = `<div class="ad-card col"><div class="ad-row">${field('Kod', '<input class="input" id="cCode" placeholder="GIFT-XXXX-XXXX" />')}<button class="btn btn-ghost small" id="cRand">Rastgele</button>${field('Coin', '<input class="input" id="cCoins" type="number" value="100" />')}${field('Etiket', '<input class="input" id="cLabel" placeholder="Ör: Discord çekilişi" />')}</div>
          <div class="ad-items">${items.map(([id, it]) => `<label><input type="checkbox" value="${esc(id)}" /> ${esc(it.name)}</label>`).join('')}</div>
          <div class="ad-save"><button class="btn btn-primary" id="cSave">Kodu oluştur</button></div></div>
        <div class="s-sec">KODLAR</div>
        ${codes.map((c) => `<div class="ad-code"><code>${esc(c.id)}</code><span>${esc(c.label || '')}</span><span><i class="coin-ic">C</i>${c.coins || 0}${(c.items || []).length ? ` · ${c.items.length} eşya` : ''}</span><span class="${c.active ? 'ok' : 'muted'}">${c.active ? 'aktif' : 'kapalı'}</span>
          <button class="btn btn-ghost tiny" data-tog="${esc(c.id)}">${c.active ? 'Kapat' : 'Aç'}</button><button class="icon-btn tiny danger" data-del="${esc(c.id)}">✕</button></div>`).join('') || '<div class="s-empty">Henüz kod yok.</div>'}`;
      $('#cRand').onclick = () => { $('#cCode').value = 'GIFT-' + Math.random().toString(36).slice(2, 6).toUpperCase() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase(); };
      $('#cSave').onclick = async () => {
        try { await sc('adminSaveCode', $('#cCode').value, { coins: Number($('#cCoins').value) || 0, label: $('#cLabel').value, items: $$('.ad-items input:checked', box()).map((i) => i.value), active: true }); toast('Kod oluşturuldu.', 'success'); show('codes'); }
        catch (e) { toast(e.message, 'error'); }
      };
      $$('[data-del]', box()).forEach((b) => (b.onclick = async () => { await sc('adminDeleteCode', b.dataset.del); show('codes'); }));
      $$('[data-tog]', box()).forEach((b) => (b.onclick = async () => { const c = codes.find((x) => x.id === b.dataset.tog); await sc('adminSaveCode', c.id, { ...c, active: !c.active }); show('codes'); }));
    },

    // ---------------------------------------------------------- beta
    async betas() {
      const [presetsDoc, keys] = await Promise.all([sc('adminGet', 'presets'), sc('adminBetaKeys')]);
      data.presets = (presetsDoc && presetsDoc.list) || {};
      const render = () => {
        const ids = Object.keys(data.presets);
        box().innerHTML = `<p class="ad-p">Beta sürüm = özel bir profil hazır ayarı (Minecraft sürümü + yükleyici). Anahtarı olan oyuncular profil oluştururken bu sürümleri görür.</p>
          <div class="s-sec">BETA SÜRÜMLERİ</div>
          ${ids.map((id) => { const p = data.presets[id]; return `<div class="ad-card" data-id="${esc(id)}"><div class="ad-fields"><div class="ad-id"><code>${esc(id)}</code></div>${field('Ad', inp('name', p.name))}${field('Minecraft sürümü', inp('version', p.version, '1.21.1'))}${field('Yükleyici', sel('loader', p.loader || 'vanilla', [['vanilla', 'Vanilla'], ['fabric', 'Fabric']]))}</div><div class="ad-ctl"><button class="icon-btn tiny danger" data-del>✕</button></div></div>`; }).join('') || '<div class="s-empty">Beta sürüm yok.</div>'}
          <div class="ad-new">${field('Yeni beta kimliği', '<input class="input" id="pNew" placeholder="ör. cubixora_pvp" />')}<button class="btn btn-ghost" id="pAdd">+ Beta sürüm ekle</button><button class="btn btn-primary" id="pSave">Beta sürümleri kaydet</button></div>
          <div class="s-sec">BETA ANAHTARLARI</div>
          <div class="ad-card col"><div class="ad-row">${field('Anahtar', '<input class="input" id="kKey" placeholder="BETA-XXXX-XXXX" />')}${field('Etiket', '<input class="input" id="kLabel" placeholder="Ör: Test ekibi" />')}</div>
            <div class="ad-items">${ids.map((id) => `<label><input type="checkbox" value="${esc(id)}" /> ${esc(data.presets[id].name || id)}</label>`).join('') || '<span class="muted">Önce beta sürüm ekle.</span>'}</div>
            <div class="ad-save"><button class="btn btn-ghost small" id="kRand">Rastgele</button><button class="btn btn-primary" id="kSave">Anahtar oluştur</button></div></div>
          ${keys.map((k) => `<div class="ad-code"><code>${esc(k.id)}</code><span>${esc(k.label || '')}</span><span>${(k.presets || []).join(', ')}</span><button class="icon-btn tiny danger" data-kdel="${esc(k.id)}">✕</button></div>`).join('')}`;
        const sync = () => $$('.ad-card[data-id]', box()).forEach((el) => { data.presets[el.dataset.id] = { ...data.presets[el.dataset.id], ...readCard(el) }; });
        $('#pAdd').onclick = () => { const id = $('#pNew').value.trim().toLowerCase(); if (!/^[a-z0-9_]{2,30}$/.test(id)) { toast('Kimlik: küçük harf, rakam, _', 'error'); return; } sync(); data.presets[id] = { name: id, version: '', loader: 'vanilla' }; render(); };
        $$('.ad-card[data-id]', box()).forEach((el) => ($('[data-del]', el).onclick = () => { sync(); delete data.presets[el.dataset.id]; render(); }));
        $('#pSave').onclick = async () => { sync(); try { await sc('adminSet', 'presets', { list: data.presets }); toast('Beta sürümler kaydedildi.', 'success'); } catch (e) { toast(e.message, 'error'); } };
        $('#kRand').onclick = () => { $('#kKey').value = 'BETA-' + Math.random().toString(36).slice(2, 6).toUpperCase() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase(); };
        $('#kSave').onclick = async () => { try { await sc('adminSaveBetaKey', $('#kKey').value, { label: $('#kLabel').value, presets: $$('.ad-items input:checked', box()).map((i) => i.value) }); toast('Anahtar oluşturuldu.', 'success'); show('betas'); } catch (e) { toast(e.message, 'error'); } };
        $$('[data-kdel]', box()).forEach((b) => (b.onclick = async () => { await sc('adminDeleteBetaKey', b.dataset.kdel); show('betas'); }));
      };
      render();
    },

    // ---------------------------------------------------------- ödüller ve sınırlar
    async settings() {
      const [rw, lim, cbRaw, cbDef] = await Promise.all([sc('adminGet', 'rewards'), sc('adminGet', 'limits'), sc('adminGet', 'coinbuy').catch(() => null), sc('coinBuy').catch(() => ({}))]);
      const r = rw || { hourly: 1, hourlyLp: 1 }, l = lim || {}, cb = { ...cbDef, ...(cbRaw || {}) };
      box().innerHTML = `<div class="s-sec">ETKİNLİK ÖDÜLLERİ</div><div class="ad-card col"><div class="ad-row">
          ${field("Launcher'da geçirilen her saat için coin", `<input class="input" id="rH" type="number" value="${r.hourly ?? 1}" />`)}${field('Her saat için LP', `<input class="input" id="rL" type="number" value="${r.hourlyLp ?? 1}" />`)}</div></div>
        <div class="s-sec">COİN SATIN ALMA</div><div class="ad-card col"><p class="ad-p">Oyuncu üstteki coin sayacına ya da mağazadaki "Coin Al" düğmesine basınca açılan pencere. Ödemeyi Discord ticket'ında alırsın, coini <b>Oyuncular</b> sekmesinden verirsin (ya da hediye kodu oluşturursun).</p>
          <div class="ad-row">${field('Pencere', `<select class="select" id="acbOn"><option value="1" ${cb.enabled === false ? '' : 'selected'}>Açık</option><option value="0" ${cb.enabled === false ? 'selected' : ''}>Kapalı (sayaç mağazaya gider)</option></select>`)}${field('Mağazada "Coin Al" düğmesi', `<select class="select" id="acbShop"><option value="1" ${cb.shopButton === false ? '' : 'selected'}>Göster</option><option value="0" ${cb.shopButton === false ? 'selected' : ''}>Gizle</option></select>`)}</div>
          <div class="ad-row">${field('Başlık', `<input class="input" id="acbTitle" maxlength="60" value="${esc(cb.title || '')}" />`)}${field('Buton yazısı', `<input class="input" id="acbBtn" maxlength="40" value="${esc(cb.button || '')}" />`)}</div>
          <div class="ad-row">${field('Bağlantı (Discord daveti vb.)', `<input class="input" id="acbUrl" spellcheck="false" value="${esc(cb.url || '')}" />`)}</div>
          <div class="ad-row">${field('Açıklama (alt satıra geçebilirsin)', `<textarea class="input" id="acbText" rows="3" maxlength="400" style="resize:vertical;min-height:70px">${esc(cb.text || '')}</textarea>`)}</div></div>
        <div class="s-sec">SINIRLAR</div><div class="ad-card col"><div class="ad-row">
          ${field('Profil arka planı en fazla (KB)', `<input class="input" id="lKB" type="number" value="${l.bgMaxKB ?? 280}" max="480" />`)}${field('Arka plan en fazla genişlik', `<input class="input" id="lW" type="number" value="${l.bgMaxW ?? 1920}" />`)}${field('Arka plan en fazla yükseklik', `<input class="input" id="lH" type="number" value="${l.bgMaxH ?? 1080}" />`)}</div>
          <div class="ad-row">${field('Sohbette görsel en fazla (KB)', `<input class="input" id="lI" type="number" value="${l.imageMaxKB ?? 650}" max="680" />`)}${field('Sesli mesaj en fazla (saniye)', `<input class="input" id="lV" type="number" value="${l.voiceMaxSec ?? 120}" max="240" />`)}</div></div>${saveBar('rSave')}`;
      $('#rSave').onclick = async () => {
        try {
          await sc('adminSet', 'rewards', { hourly: Math.max(0, +$('#rH').value || 0), hourlyLp: Math.max(0, +$('#rL').value || 0) });
          const cbUrl = $('#acbUrl').value.trim();
          if (cbUrl && !/^(https?:\/\/)?[^\s]+\.[^\s]+$/i.test(cbUrl)) { toast('Bağlantı geçersiz.', 'error'); return; }
          await sc('adminSet', 'coinbuy', { enabled: $('#acbOn').value === '1', shopButton: $('#acbShop').value === '1', title: $('#acbTitle').value.trim().slice(0, 60), button: $('#acbBtn').value.trim().slice(0, 40), url: cbUrl, text: $('#acbText').value.trim().slice(0, 400) });
          await sc('adminSet', 'limits', { bgMaxKB: Math.min(480, +$('#lKB').value || 280), bgMaxW: +$('#lW').value || 1920, bgMaxH: +$('#lH').value || 1080, imageMaxKB: Math.min(680, +$('#lI').value || 650), voiceMaxSec: Math.min(240, +$('#lV').value || 120) });
          toast('Kaydedildi.', 'success');
        } catch (e) { toast(e.message, 'error'); }
      };
    },

    // ---------------------------------------------------------- discord etkinliği
    async branding() {
      const b = (await sc('adminGet', 'branding')) || {};
      const v = (k, d = '') => esc(b[k] ?? d);
      box().innerHTML = `<p class="ad-p">Oyuncuların Discord profilinde görünen etkinlik. Discord Developer Portal'da bir uygulama oluştur (adı "Cubixora Launcher" olursa "Cubixora Launcher oynuyor" yazar), Application ID'yi buraya yapıştır. Metinlerde {surum}, {sunucu}, {oyuncu} kullanılabilir.</p>
        <div class="ad-card col"><div class="ad-row">${field('Discord Application ID', `<input class="input" id="dId" value="${v('discordId')}" />`)}${field('Etkinlik açık', `<select class="select" id="dOn"><option value="1" ${b.discordEnabled === false ? '' : 'selected'}>Açık</option><option value="0" ${b.discordEnabled === false ? 'selected' : ''}>Kapalı</option></select>`)}</div>
          <div class="ad-row">${field('Menüde: üst satır', `<input class="input" id="dMD" value="${v('discordMenuDetails', 'Cubixora Launcher oynuyor')}" />`)}${field('Menüde: alt satır', `<input class="input" id="dMS" value="${v('discordMenuState', 'Menüde')}" />`)}</div>
          <div class="ad-row">${field('Oyunda: üst satır', `<input class="input" id="dGD" value="${v('discordGameDetails', 'Minecraft {surum} oynuyor')}" />`)}${field('Oyunda: alt satır', `<input class="input" id="dGS" value="${v('discordGameState', 'Cubixora Client ile')}" />`)}</div>
          <div class="ad-row">${field('Sunucudayken alt satır', `<input class="input" id="dSS" value="${v('discordServerState', '{sunucu} sunucusunda')}" />`)}${field('Büyük görsel anahtarı (Art Assets adı)', `<input class="input" id="dImg" value="${v('discordImage')}" />`)}</div>
          <div class="ad-row">${field('Görsel yazısı', `<input class="input" id="dImgT" value="${v('discordImageText', 'Cubixora Launcher')}" />`)}${field('Buton yazısı (isteğe bağlı)', `<input class="input" id="dBL" value="${v('discordButtonLabel')}" />`)}${field('Buton bağlantısı', `<input class="input" id="dBU" value="${v('discordButtonUrl')}" />`)}</div></div>${saveBar('dSave')}`;
      $('#dSave').onclick = async () => {
        try {
          await sc('adminSet', 'branding', { discordId: $('#dId').value.trim(), discordEnabled: $('#dOn').value === '1', discordMenuDetails: $('#dMD').value, discordMenuState: $('#dMS').value, discordGameDetails: $('#dGD').value, discordGameState: $('#dGS').value, discordServerState: $('#dSS').value, discordImage: $('#dImg').value.trim(), discordImageText: $('#dImgT').value, discordButtonLabel: $('#dBL').value, discordButtonUrl: $('#dBU').value.trim() });
          toast('Kaydedildi. Oyuncularda en geç 1 dakikada, yeni açılışta anında görünür.', 'success');
        } catch (e) { toast(e.message, 'error'); }
      };
    },

    // ---------------------------------------------------------- güncelleme yayınla
    async publish() {
      const info = await cx.publishInfo();
      box().innerHTML = `<p class="ad-p">Launcher'ın kodunu (arayüz, özellikler, oyun içi mod dosyaları) değiştirdikten sonra buradan yayınla: tüm oyuncuların launcher'ı bir sonraki açılışta (ya da "Güncellemeyi uygula" ile hemen) yeni sürüme geçer. Yeni EXE gerekmez.</p>
        <div class="ad-card col">
          ${field('Kod klasörü (cubixora-launcher\\src)', `<div class="s-inline"><input class="input" id="puDir" value="${esc(info.dir)}" /><button class="btn btn-ghost small" id="puDirB">Seç</button></div>`)}
          <small class="${info.dirOk ? 'ok' : 'danger'}">${info.dirOk ? '✓ Klasör bulundu' : '✕ Bu klasörde main.js yok'}</small>
          ${field('Gizli yayın anahtarı (GIZLI-yayin-anahtari.key)', `<div class="s-inline"><input class="input" id="puKey" value="${esc(info.keyFile)}" /><button class="btn btn-ghost small" id="puKeyB">Seç</button></div>`)}
          <small class="${info.keyOk ? 'ok' : 'danger'}">${info.keyOk ? '✓ Anahtar bulundu' : '✕ Anahtar dosyası bulunamadı'}</small>
          ${field('Güncelleme notu (oyunculara gösterilir)', '<textarea class="input" id="puNotes" rows="3" placeholder="Ör: Yeni kozmetikler ve hata düzeltmeleri"></textarea>')}
          ${field('GitHub anahtarı (paketler GitHub Releases\'a yüklenir)', `<input class="input" id="puGh" type="password" placeholder="${info.ghSaved ? 'Kayıtlı (değiştirmek için yeni anahtarı yaz)' : 'github_pat_... (Cubixora/Launcher, Contents: Read and write)'}" autocomplete="off" />`)}
          ${info.legacy ? field('Eski sürümlere de gönder (geçiş için) — Firebase admin şifren', '<input class="input" id="puLegacy" type="password" placeholder="Boş bırakırsan sadece yeni sürümlere gider" autocomplete="off" />') : ''}
          <div class="ad-save"><span class="muted" id="puProg">Şu anki sürüm: #${info.build}</span><button class="btn btn-primary" id="puGo">Güncellemeyi yayınla</button></div>
        </div>
        <p class="ad-p danger">⚠ GIZLI-yayin-anahtari.key dosyasını kimseyle paylaşma ve kaybetme. Bu anahtar olmadan güncelleme yayınlanamaz; başkasının eline geçerse adına güncelleme çıkarabilir.</p>
        <div class="ad-card col">
          <b>Test et (önizleme)</b>
          <p class="ad-p">Başka bir bilgisayarda launcher'ı ilk kez açan bir oyuncu gibi ayrı bir pencere açar: yayınlanmış güncellemeyi indirir, uygular ve oyuncunun göreceği her şeyi gösterir. Yukarıdaki "Önizlemeden çık" ile kapanır, bilgisayarındaki verilere dokunmaz.</p>
          <div class="ad-save"><span class="muted" id="pvState"></span>
            <button class="btn btn-ghost" id="pvNew">Hesapsız önizle</button>
            <button class="btn btn-primary" id="pvAcc">Hesabımla önizle</button></div>
        </div>
        <div class="ad-card col">
          <b>Veritabanı</b>
          <p class="ad-p" id="dbInfo">Kontrol ediliyor...</p>
          ${info.legacy ? `<p class="ad-p">Firebase'deki tüm verileri (profiller, coinler, envanterler, arkadaşlıklar, sohbetler, çekilişler) Supabase'e kopyalar. Firebase'deki veriler silinmez. Tekrar çalıştırmak güvenlidir: aynı belgeler üzerine yazılır.</p>
          ${field('Firebase admin şifren (eski hesabının şifresi)', '<input class="input" id="mgPass" type="password" autocomplete="off" />')}
          <div class="ad-save"><span class="muted" id="mgProg"></span><button class="btn btn-ghost" id="mgGo">Firebase'den Supabase'e taşı</button></div>` : ''}
        </div>`;
      sc('adminDbStats').then((r) => {
        const el = $('#dbInfo'); if (!el) return;
        el.textContent = `Supabase · ${r.docs} belge · ${(r.bytes / 1048576).toFixed(1)} MB / 500 MB`;
      }).catch((e) => { const el = $('#dbInfo'); if (el) el.textContent = e.message; });
      if ($('#mgGo')) $('#mgGo').onclick = async () => {
        if (!(await confirmBox('Veriler taşınsın mı?', "Firebase'deki tüm belgeler Supabase'e kopyalanacak. Bu işlem Firebase okuma kotası kullanır; kota yeni sıfırlandığında yap.", 'Taşı'))) return;
        const b = $('#mgGo'); b.classList.add('loading');
        try { const r = await sc('adminMigrate', { password: $('#mgPass').value }); $('#mgPass').value = ''; toast(`${r.total} belge Supabase'e taşındı.`, 'success'); $('#mgProg').textContent = `Bitti: ${r.total} belge`; }
        catch (e) { toast(e.message, 'error'); } finally { b.classList.remove('loading'); }
      };
      const pvGo = async (mode) => {
        try { await cx.previewStart(mode); toast('Önizleme penceresi açılıyor...', 'success'); }
        catch (e) { toast(e.message, 'error'); }
      };
      $('#pvNew').onclick = () => pvGo('new');
      $('#pvAcc').onclick = () => pvGo('account');
      cx.previewState().then((r) => { const el = $('#pvState'); if (el && r) el.textContent = 'Önizleme şu an açık'; }).catch(() => {});
      $('#puDirB').onclick = async () => { const p = await cx.pick({ kind: 'folder', title: 'cubixora-launcher\\src klasörünü seç' }); if (p) $('#puDir').value = p; };
      $('#puKeyB').onclick = async () => { const p = await cx.pick({ kind: 'file', title: 'Yayın anahtarını seç' }); if (p) $('#puKey').value = p; };
      $('#puGo').onclick = async () => {
        if (!(await confirmBox('Güncelleme yayınlansın mı?', 'Tüm oyunculara gidecek. Yayınlamadan önce launcher\'ı kendi bilgisayarında 1-BASLAT.bat ile denediğinden emin ol.', 'Yayınla'))) return;
        const b = $('#puGo'); b.classList.add('loading');
        try {
          const r = await sc('adminPublish', { dir: $('#puDir').value.trim(), keyFile: $('#puKey').value.trim(), notes: $('#puNotes').value,
            ghToken: $('#puGh').value.trim(), legacyPassword: $('#puLegacy') ? $('#puLegacy').value : '' });
          $('#puGh').value = ''; if ($('#puLegacy')) $('#puLegacy').value = '';
          toast(`Güncelleme #${r.build} yayınlandı (${r.files} dosya, ${(r.size / 1024).toFixed(0)} KB)${r.legacy ? ' · eski sürümlere de gönderildi' : ''}.`, 'success');
          $('#puProg').textContent = `Yayınlandı: #${r.build}`;
        } catch (e) { toast(e.message, 'error'); } finally { b.classList.remove('loading'); }
      };
    }
  };

  function bindOnce() {
    if (bound) return; bound = true;
    $$('#adTabs button').forEach((b) => (b.onclick = () => show(b.dataset.t)));
    cx.on('preview:state', (p) => { const el = $('#pvState'); if (el) el.textContent = p && p.running ? 'Önizleme şu an açık' : ''; });
    cx.on('admin:publish', (p) => { const el = $('#puProg'); if (el) el.textContent = `${p.stage} ${p.current}/${p.total}`; });
    cx.on('admin:migrate', (p) => { const el = $('#mgProg'); if (el) el.textContent = `${p.stage} · ${p.total} belge`; });
  }
  return { enter };
})();

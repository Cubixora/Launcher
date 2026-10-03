/* Cubixora 3D karakter görüntüleyici (CSS 3D, kütüphanesiz)
   Minecraft skin (64x64 veya eski 64x32) + pelerin + kanat + omuz arkadaşı.
   Kullanım:
     const v = new CxViewer(elem, { scale: 9 });
     await v.setSkin(dataUrl, { slim });  v.setCape(url|null);  v.setWings(url|null);
     v.setPet(true, 'left');  v.setAnimation('wave'|'walk'|'idle');  v.setWingsOpen(true);
     v.options.capeWave = 1; v.options.wingSpeed = 1;
*/
(function () {
  const TAU = Math.PI * 2;

  // ---------------------------------------------------------------- skin yardımcıları
  function loadImage(src) {
    return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
  }

  // eski 64x32 skinleri 64x64'e çevirir (sol kol/bacak = sağın aynası)
  function mirrorBox(ctx, img, su, sv, du, dv, w, h, d) {
    const faces = {
      top: [d, 0, w, d], bottom: [d + w, 0, w, d], right: [0, d, d, h],
      front: [d, d, w, h], left: [d + w, d, d, h], back: [2 * d + w, d, w, h]
    };
    const map = { top: 'top', bottom: 'bottom', right: 'left', left: 'right', front: 'front', back: 'back' };
    for (const [dst, src] of Object.entries(map)) {
      const [sx, sy, sw, sh] = faces[src], [dx, dy] = faces[dst];
      ctx.save();
      ctx.translate(du + dx + sw, dv + dy);
      ctx.scale(-1, 1);
      ctx.drawImage(img, su + sx, sv + sy, sw, sh, 0, 0, sw, sh);
      ctx.restore();
    }
  }

  const skinCache = new Map();   // aynı skin bir kez işlenir (her sayfa geçişinde piksel okuma yapılmaz)
  function normalizeSkin(src) {
    let p = skinCache.get(src);
    if (!p) { p = normalizeSkinRaw(src); skinCache.set(src, p); p.catch(() => skinCache.delete(src)); if (skinCache.size > 20) skinCache.delete(skinCache.keys().next().value); }
    return p;
  }
  async function normalizeSkinRaw(src) {
    const img = await loadImage(src);
    if (img.width !== 64 || (img.height !== 64 && img.height !== 32)) throw new Error('Skin 64x64 ya da 64x32 boyutunda olmalı.');
    const c = document.createElement('canvas');
    c.width = 64; c.height = 64;
    const ctx = c.getContext('2d', { willReadFrequently: true });   // piksel okunacak: ekran kartından geri okuma beklemesin
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, 0, 0);
    if (img.height === 32) {
      mirrorBox(ctx, img, 0, 16, 16, 48, 4, 12, 4);  // bacak
      mirrorBox(ctx, img, 40, 16, 32, 48, 4, 12, 4); // kol
    }
    // ince (Alex) kol tespiti: sağ kolun 4. sütunu boşsa ince modeldir
    const px = ctx.getImageData(54, 20, 2, 12).data;
    let empty = true;
    for (let i = 3; i < px.length; i += 4) if (px[i] !== 0) { empty = false; break; }
    return { url: c.toDataURL('image/png'), slim: empty };
  }

  // ---------------------------------------------------------------- kutu (6 yüz)
  // aynı değeri tekrar yazma: gereksiz stil geçersizleştirmesini önler
  function setT(e, v) { if (e._t !== v) { e._t = v; e.style.transform = v; } }

  function el(cls, parent) { const d = document.createElement('div'); d.className = cls; if (parent) parent.appendChild(d); return d; }

  function face(parent, tex, texW, texH, S, fu, fv, fw, fh, transform, flipY) {
    const f = el('cx-face', parent);
    f.style.width = fw * S + 'px';
    f.style.height = fh * S + 'px';
    f.style.marginLeft = -fw * S / 2 + 'px';
    f.style.marginTop = -fh * S / 2 + 'px';
    f.style.backgroundImage = `url("${tex}")`;
    f.style.backgroundSize = `${texW * S}px ${texH * S}px`;
    f.style.backgroundPosition = `${-fu * S}px ${-fv * S}px`;
    // yüz kenarlarını yarım piksel taşır: birleşim yerlerinde arka plan (siyah çizgi) görünmesin
    f.style.transform = transform + (flipY ? ' scaleY(-1)' : '') + ` scale(${1 + 1.1 / Math.max(1, fw * S)}, ${1 + 1.1 / Math.max(1, fh * S)})`;
    return f;
  }

  // Minecraft kutu UV düzeni: [sağ][ön][sol][arka] şeridi, üstte [üst][alt]
  function box(parent, tex, texW, texH, S, u, v, w, h, d, inflate = 0) {
    const b = el('cx-box', parent);
    const W = w * S, H = h * S, D = d * S;
    face(b, tex, texW, texH, S, u + d, v + d, w, h, `translateZ(${D / 2}px)`);
    face(b, tex, texW, texH, S, u + 2 * d + w, v + d, w, h, `rotateY(180deg) translateZ(${D / 2}px)`);
    face(b, tex, texW, texH, S, u, v + d, d, h, `rotateY(-90deg) translateZ(${W / 2}px)`);
    face(b, tex, texW, texH, S, u + d + w, v + d, d, h, `rotateY(90deg) translateZ(${W / 2}px)`);
    face(b, tex, texW, texH, S, u + d, v, w, d, `rotateX(90deg) translateZ(${H / 2}px)`);
    face(b, tex, texW, texH, S, u + d + w, v, w, d, `rotateX(-90deg) translateZ(${H / 2}px)`, true);
    if (inflate) b.style.transform = `scale3d(${(w + inflate * 2) / w}, ${(h + inflate * 2) / h}, ${(d + inflate * 2) / d})`;
    return b;
  }

  // ---------------------------------------------------------------- oyuncu modeli
  // Koordinatlar Minecraft pikseli; CSS'te y aşağı doğru. Kökeni vücudun ortası (MC y=16).
  function buildPlayer(root, skin, slim, S) {
    const P = {};
    const T = (x, y, z) => `translate3d(${x * S}px, ${y * S}px, ${z * S}px)`;
    const part = (name, pivot, boxes) => {
      const g = el('cx-part', root);
      g.dataset.part = name;
      g.dataset.pivot = pivot.join(',');
      for (const [u, v, w, h, d, off, inf] of boxes) {
        const holder = el('cx-part', g);
        holder.style.transform = T(...off);
        box(holder, skin, 64, 64, S, u, v, w, h, d, inf);
      }
      P[name] = { g, pivot, rx: 0, ry: 0, rz: 0 };
      return P[name];
    };
    const aw = slim ? 3 : 4, ax = slim ? 5.5 : 6;
    part('head', [0, -8, 0], [[0, 0, 8, 8, 8, [0, -4, 0]], [32, 0, 8, 8, 8, [0, -4, 0], 0.5]]);
    part('body', [0, -2, 0], [[16, 16, 8, 12, 4, [0, 0, 0]], [16, 32, 8, 12, 4, [0, 0, 0], 0.25]]);
    part('rarm', [-ax, -6, 0], [[40, 16, aw, 12, 4, [0, 4, 0]], [40, 32, aw, 12, 4, [0, 4, 0], 0.25]]);
    part('larm', [ax, -6, 0], [[32, 48, aw, 12, 4, [0, 4, 0]], [48, 48, aw, 12, 4, [0, 4, 0], 0.25]]);
    part('rleg', [-2, 4, 0], [[0, 16, 4, 12, 4, [0, 6, 0]], [0, 32, 4, 12, 4, [0, 6, 0], 0.25]]);
    part('lleg', [2, 4, 0], [[16, 48, 4, 12, 4, [0, 6, 0]], [0, 48, 4, 12, 4, [0, 6, 0], 0.25]]);
    return P;
  }

  function pose(P, S) {
    for (const k in P) {
      const p = P[k];
      setT(p.g, `translate3d(${p.pivot[0] * S}px, ${p.pivot[1] * S}px, ${p.pivot[2] * S}px) rotateX(${p.rx.toFixed(2)}deg) rotateY(${p.ry.toFixed(2)}deg) rotateZ(${p.rz.toFixed(2)}deg)${p.sc ? ` scale3d(${p.sc}, ${p.sc}, ${p.sc})` : ''}`);
    }
  }

  // ---------------------------------------------------------------- eklemli kanat
  // Mod ile aynı geometri (Minecraft pikseli). Sağ kanat −x yönüne uzanır; sol kanat aynasıdır.
  // Kök, sırtın 3.5 piksel arkasında: kanat hiçbir açıda vücudun içine girmez.
  const WING_SEGMENTS = [
    { pivot: [0, 0, 0], parts: [[20, 0, 7, 1, 1, [-3.5, 0, 0], 1], [0, 0, 8, 12, 1, [-4, 6.5, 0], 0.3], [20, 10, 7, 6, 1, [-3.5, 3.5, -0.45], 0.3]] },
    { pivot: [-7, 0, 0], parts: [[20, 3, 6, 1, 1, [-3, 0, 0], 1], [0, 14, 7, 12, 1, [-3.5, 6.5, 0], 0.3], [20, 18, 6, 7, 1, [-3, 4, -0.45], 0.3], [40, 0, 1, 2, 1, [0, -1.5, 0], 1]] },
    { pivot: [-6, 0, 0], parts: [[20, 6, 6, 1, 1, [-3, 0, 0], 1], [0, 28, 6, 11, 1, [-3, 6, 0], 0.3]] }
  ];
  function buildWing(parent, tex, side, S) {
    const root = el('cx-part', parent);
    root.style.transform = `translate3d(${side * 1.5 * S}px, ${-6.5 * S}px, ${-5.5 * S}px)`;
    const mirror = el('cx-part cx-wingbox', root);
    mirror.style.transform = `scale3d(${side < 0 ? 0.9 : -0.9}, 0.9, 0.9)`;
    let host = mirror;
    const segs = [];
    for (const seg of WING_SEGMENTS) {
      const g = el('cx-part', host);
      for (const [u, v, w, h, d, off, zs] of seg.parts) {
        const holder = el('cx-part', g);
        holder.style.transform = `translate3d(${off[0] * S}px, ${off[1] * S}px, ${off[2] * S}px) scale3d(1, 1, ${zs})`;
        box(holder, tex, 64, 64, S, u, v, w, h, d);
      }
      segs.push({ g, pivot: seg.pivot });
      host = g;
    }
    return segs;
  }
  // açıklık (0 kapalı - 1 açık), zaman, hız -> her bölümün [roll, yaw] açısı (derece)
  function wingPose(open, t, speed, extra = 0) {
    const p = t * 3.0 * speed * (1 + extra);
    const s = (x) => Math.sin(x + 0.4 * Math.sin(x)); // aşağı vuruş hızlı, yukarı kalkış yavaş
    const L = (a, b) => a + (b - a) * open;
    return [
      [L(-15, 8 + 30 * s(p)), L(75, 26)],
      [L(-6, 22 * s(p - 0.55)), L(14, 4)],
      [L(-4, 16 * s(p - 1.1)), L(10, 2)]
    ];
  }
  function poseWing(segs, pose, S) {
    segs.forEach((sg, i) => {
      const [roll, yaw] = pose[i];
      setT(sg.g, `translate3d(${sg.pivot[0] * S}px, ${sg.pivot[1] * S}px, ${sg.pivot[2] * S}px) rotateZ(${roll.toFixed(2)}deg) rotateY(${(-yaw).toFixed(2)}deg)`);
    });
  }

  // ---------------------------------------------------------------- şapka / uçan pet (mod ile aynı model JSON'u)
  // Mod koordinatları: ön = -z. Görüntüleyicide ön = +z olduğundan z işareti çevrilir (açılar buna göre).
  function buildProp(parent, entry, S) {
    const m = entry.model, nodes = { root: { g: el('cx-part', parent), pv: [0, 0, 0], rot: [0, 0, 0] } };
    for (const p of m.parts) {
      const g = el('cx-part', nodes[p.p].g);
      for (const [x, y, z, w, h, d, dil, u, v] of p.b) {
        const holder = el('cx-part', g);
        holder.style.transform = `translate3d(${(x + w / 2) * S}px, ${(y + h / 2) * S}px, ${-(z + d / 2) * S}px)`;
        box(holder, entry.tex, m.tex[0], m.tex[1], S, u, v, w, h, d, dil);
      }
      nodes[p.n] = { g, pv: p.pv, rot: p.rot };
    }
    return nodes;
  }
  function poseProp(nodes, S, over) {
    const deg = 180 / Math.PI;
    for (const n in nodes) {
      if (n === 'root') continue;
      const nd = nodes[n], r = (over && over[n]) || nd.rot;
      setT(nd.g, `translate3d(${nd.pv[0] * S}px, ${nd.pv[1] * S}px, ${-nd.pv[2] * S}px) rotateZ(${(r[2] * deg).toFixed(2)}deg) rotateY(${(-r[1] * deg).toFixed(2)}deg) rotateX(${(-r[0] * deg).toFixed(2)}deg)`);
    }
  }
  // CxProps.placeFly / pose (Java) ile aynı hareket
  const clampf = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  const wrapA = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
  const burstAt = (t) => clampf((Math.sin(t * 0.72) + Math.sin(t * 0.31 + 1.0) - 1.5) * 3, 0, 1);
  function flyBrain(f, t, dt, limb) {
    const S = Math.sin, C = Math.cos, lerp = (a, b, k) => a + (b - a) * k;
    f.speed = lerp(f.speed, clampf(limb, 0, 1), 1 - Math.exp(-dt * 3));
    const v = f.speed * 5.6;
    const ang = S(t * 0.29) * 1.75 + S(t * 0.71 + 1) * 0.45, rad = 1.35 + 0.28 * S(t * 0.47 + 2) + f.speed * 0.5;
    const tx = S(ang) * rad, tz = C(ang) * rad;
    const ty = -1.15 + 0.14 * S(t * 1.9) + 0.2 * S(t * 0.63) - f.speed * 0.08;
    if (!f.init) { f.x = tx; f.y = ty; f.z = tz; f.init = true; }
    if (dt > 0) {
      f.z += v * dt;
      const w = 3.3, z2 = 0.8;
      f.vx += ((tx - f.x) * w * w - 2 * z2 * w * f.vx) * dt;
      f.vy += ((ty - f.y) * w * w * 1.3 - 2 * 0.9 * w * f.vy) * dt;
      f.vz += ((tz - f.z) * w * w - 2 * z2 * w * f.vz) * dt;
      f.x += f.vx * dt; f.y += f.vy * dt; f.z += f.vz * dt; f.z = Math.min(f.z, 3.2);
      const wx = f.vx, wz = f.vz - v, sp = Math.hypot(wx, wz);
      const la = Math.atan2(f.x, f.z) + S(t * 0.9) * 0.6;
      let desired = la;
      if (sp > 0.05) { const ma = Math.atan2(-wx, -wz), wg = clampf((sp - 0.4) / 1.2, 0, 1); desired = la + wrapA(ma - la) * wg; }
      const old = f.heading;
      f.heading = wrapA(f.heading + wrapA(desired - f.heading) * (1 - Math.exp(-dt * 3.5)));
      f.lastDh = lerp(f.lastDh, wrapA(f.heading - old) / dt, 1 - Math.exp(-dt * 6));
      f.bank = clampf(-f.lastDh * 0.28, -0.5, 0.5);
      f.phase += dt * (4.2 + f.speed * 1.6 + burstAt(t) * 13);
    }
    f.burst = burstAt(t); f.vyo = clampf(-f.vy, -1.5, 1.5);
  }
  function flyPose(nodes, f, t) {
    const S = Math.sin, ph = f.phase, sp = f.speed, br = f.burst, s = S(ph), c = Math.cos(ph), o = {};
    const set = (n, p, y, r) => { const nd = nodes[n]; if (nd) o[n] = [nd.rot[0] + p, nd.rot[1] + y, nd.rot[2] + r]; };
    const amp = 0.62 + br * 0.22;
    set('body', 0.1 + sp * 0.22 + f.vyo * 0.12 - s * 0.04, S(t * 0.8 + 1.2) * 0.06, f.bank);
    set('neck1', S(t * 1.3) * 0.05, S(t * 1.1) * 0.12, 0);
    set('neck2', S(t * 1.3 + 0.7) * 0.06 - sp * 0.15, S(t * 1.1 + 0.9) * 0.16, 0);
    set('head', S(t * 1.9) * 0.06 + sp * 0.1, S(t * 0.7) * 0.3, S(t * 0.9) * 0.05);
    set('jaw', Math.pow(Math.max(0, S(t * 0.5 + 2)), 8) * 0.3 + br * 0.12, 0, 0);
    const fl = S(t * 5) * 0.1; set('finL', 0, 0, fl); set('finR', 0, 0, -fl);
    for (let i = 1; i <= 5; i++) set('tail' + i, S(t * 1.9 - i * 0.5) * 0.05 + sp * 0.04, S(t * 2.6 - i * 0.7) * (0.18 + 0.06 * i) + f.bank * -0.3 * i * 0.3, 0);
    const sh = -0.12 + s * amp, el = -0.2 - c * 0.38 * (0.7 + br * 0.4), sweep = s * 0.1;
    set('wingL', 0, -0.22 - sweep, sh); set('wingR', 0, 0.22 + sweep, -sh);
    set('wingAL', 0, 0, el); set('wingAR', 0, 0, -el);
    for (let i = 1; i <= 3; i++) { const cur = -c * 0.16 * i; set('f' + i + 'L', 0, 0, cur); set('f' + i + 'R', 0, 0, -cur); }
    const tuck = sp * 0.3; set('thighL', tuck + S(t * 1.5) * 0.06, 0, 0); set('thighR', tuck + S(t * 1.5 + 0.5) * 0.06, 0, 0);
    return o;
  }

  // ---------------------------------------------------------------- görüntüleyici
  // ---------------------------------------------------------------- efekt parçacıkları (launcher önizlemesi)
  // Oyundaki CxEffects ile aynı efektler; elle çizilir (emoji yok). Karakterin arkasındakiler arka tuvale,
  // önündekiler ön tuvale çizilir. En fazla 70 parçacık; görünmezken hiç çalışmaz.
  const FX = {
    ates:     { rate: 32, life: [0.8, 1.3], spawn: 'ring',  vy: 0.95, size: 0.21, col: ['fire'], shape: 'fire' },
    ruh:      { rate: 30, life: [0.8, 1.3], spawn: 'ring',  vy: 0.9,  size: 0.2, col: ['soul'], shape: 'fire' },
  };
  // 🔥 tarzı alev resmi: bir kez çizilip önbelleğe alınır; her parçacık bunun ölçeklenmiş kopyası (gölge/bulanıklık her karede hesaplanmaz)
  const FLAME_SPRITES = {};
  function flameSprite(kind) {
    if (FLAME_SPRITES[kind]) return FLAME_SPRITES[kind];
    const P = kind === 'soul'
      ? [['#0077a8', '#00b4e0', 'rgba(80,220,255,0.85)', 'rgba(0,190,255,0.9)'], ['#19c6f0', '#6fe7ff', '#b8f6ff'], ['#e8fdff', '#c4f6ff', '#ffffff']]
      : [['#ff2a00', '#ff5a00', 'rgba(255,120,0,0.85)', 'rgba(255,110,0,0.9)'], ['#ff8a00', '#ffb300', '#ffd54f'], ['#fff3c4', '#ffe082', '#fff8e1']];
    const W = 64, H = 96, c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d'), s = 30;
    g.translate(W / 2, H * 0.68);
    const layer = (w, h, c0, c1, c2) => {
      const gr = g.createLinearGradient(0, h * 0.4, 0, -h); gr.addColorStop(0, c0); gr.addColorStop(0.55, c1); gr.addColorStop(1, c2);
      g.fillStyle = gr; g.beginPath(); g.moveTo(0, -h);
      g.bezierCurveTo(w * 0.55, -h * 0.55, w * 1.05, -h * 0.05, w * 0.72, h * 0.22); g.bezierCurveTo(w * 0.5, h * 0.45, -w * 0.5, h * 0.45, -w * 0.72, h * 0.22);
      g.bezierCurveTo(-w * 1.05, -h * 0.05, -w * 0.55, -h * 0.55, 0, -h); g.fill();
    };
    g.shadowColor = P[0][3]; g.shadowBlur = s * 0.6;
    layer(s * 0.62, s * 1.35, P[0][0], P[0][1], P[0][2]);
    g.shadowBlur = 0;
    layer(s * 0.44, s * 0.98, P[1][0], P[1][1], P[1][2]);
    layer(s * 0.24, s * 0.55, P[2][0], P[2][1], P[2][2]);
    return (FLAME_SPRITES[kind] = c);
  }
  class FxLayer {
    constructor(container) {
      this.c = container;
      const mk = (z) => { const cv = document.createElement('canvas'); cv.style.cssText = `position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;z-index:${z}`; return cv; };
      this.back = mk(0); this.front = mk(2);
      container.insertBefore(this.back, container.firstChild); container.appendChild(this.front);
      this.p = []; this.acc = 0; this.id = ''; this.t = 0;
    }
    set(id) { this.id = FX[id] ? id : ''; if (!this.id) this.clear(); }
    clear() { this.p.length = 0; for (const cv of [this.back, this.front]) { const x = cv.getContext('2d'); x.clearRect(0, 0, cv.width, cv.height); } }
    active() { return !!this.id || this.p.length > 0; }
    _spawn(d) {
      const R = Math.random, a = R() * Math.PI * 2, r = 0.45 + R() * 0.3;
      let x = Math.cos(a) * r, z = Math.sin(a) * r, y = 0.1 + R() * 0.4, vx = 0, vz = 0;
      if (d.spawn === 'head') { x *= 0.7; z *= 0.7; y = 2.0 + R() * 0.25; }
      else if (d.spawn === 'above') { x *= 1.7; z *= 1.7; y = 2.3 + R() * 0.4; vx = (R() - 0.5) * 0.3; }
      else if (d.spawn === 'body') { y = 0.2 + R() * 1.7; }
      else if (d.spawn === 'orbitIn') { x *= 2.1; z *= 2.1; y = 0.4 + R() * 1.6; vx = -x * 1.1; vz = -z * 1.1; }
      else if (d.spawn === 'spiral') { const ang = this.t * 3.2; x = Math.cos(ang) * 0.78; z = Math.sin(ang) * 0.78; y = (this.t * 0.9) % 2; }
      else { vx = -x * 0.25; vz = -z * 0.25; }
      const life = d.life[0] + R() * (d.life[1] - d.life[0]);
      this.p.push({ x, y, z, vx, vy: d.vy * (0.7 + R() * 0.6), vz, life, age: 0, col: d.col[(R() * d.col.length) | 0], rot: R() * 6.28, spin: (R() - 0.5) * 4, seed: R(), shape: d.shape, size: d.size * (d.shape === 'fire' ? 0.75 + R() * 0.5 : 1) });
    }
    // cx, feetY: ayakların ekran konumu; bs: bir blok kaç piksel; yaw: karakterin dönüşü (derece)
    step(dt, cx, feetY, bs, yaw, emit) {
      const d = FX[this.id];
      this.t += dt;
      if (d && emit) { this.acc += dt * d.rate; while (this.acc >= 1 && this.p.length < 70) { this._spawn(d); this.acc -= 1; } if (this.acc > 1) this.acc = 0; }
      const W = this.c.clientWidth, H = this.c.clientHeight, dpr = Math.min(2, window.devicePixelRatio || 1);
      for (const cv of [this.back, this.front]) { const pw = Math.round(W * dpr), ph = Math.round(H * dpr); if (cv.width !== pw || cv.height !== ph) { cv.width = pw; cv.height = ph; } }
      const bx = this.back.getContext('2d'), fx = this.front.getContext('2d');
      for (const x of [bx, fx]) { x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, x.canvas.width, x.canvas.height); x.setTransform(dpr, 0, 0, dpr, 0, 0); }
      const ry = (yaw * Math.PI) / 180, cs = Math.cos(ry), sn = Math.sin(ry);
      let w = 0;
      for (let i = 0; i < this.p.length; i++) {
        const q = this.p[i];
        q.age += dt; if (q.age >= q.life) continue;
        q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt; q.rot += q.spin * dt;
        if (q.shape === 'petal') q.x += Math.sin(this.t * 2 + q.seed * 9) * 0.25 * dt;
        this.p[w++] = q;
        const X = q.x * cs + q.z * sn, Z = -q.x * sn + q.z * cs;
        const persp = 1 + Z * 0.06, sx = cx + X * bs * persp, sy = feetY - q.y * bs * persp;
        const k = q.age / q.life, alpha = k < 0.15 ? k / 0.15 : 1 - Math.max(0, (k - 0.55) / 0.45);
        this._draw(Z >= 0 ? fx : bx, q.shape, sx, sy, q.size * bs * persp, q, alpha, k);
      }
      this.p.length = w;
    }
    _draw(g, shape, x, y, s, q, a, k) {
      g.globalAlpha = Math.max(0, Math.min(1, a));
      g.fillStyle = q.col; g.strokeStyle = q.col;
      if (shape === 'fire') {   // önbellekteki alev resmi: titrer, sallanır, yükseldikçe küçülür
        const spr = flameSprite(q.col), sc = (s / 30) * (1 - k * 0.55);
        const flick = 1 + Math.sin(this.t * 18 + q.seed * 20) * 0.09, sway = Math.sin(this.t * 6 + q.seed * 9) * 0.06;
        g.save(); g.translate(x, y); g.rotate(sway); g.scale(sc, sc * flick);
        g.drawImage(spr, -32, -96 * 0.68);
        g.restore();
      } else if (shape === 'flame') {
        const r = s * (1 - k * 0.55);
        const grd = g.createRadialGradient(x, y, 0, x, y, r * 1.6);
        grd.addColorStop(0, '#ffffff'); grd.addColorStop(0.35, q.col); grd.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = grd; g.beginPath(); g.arc(x, y, r * 1.6, 0, 6.283); g.fill();
      } else if (shape === 'heart') {
        g.save(); g.translate(x, y); g.scale(s / 10, s / 10);
        g.beginPath(); g.moveTo(0, 4); g.bezierCurveTo(-10, -4, -5, -11, 0, -5); g.bezierCurveTo(5, -11, 10, -4, 0, 4); g.fill(); g.restore();
      } else if (shape === 'rune') {
        g.save(); g.translate(x, y); g.rotate(q.rot); g.shadowColor = q.col; g.shadowBlur = s * 1.5;
        g.fillRect(-s / 2, -s / 2, s, s); g.restore();
      } else if (shape === 'star') {
        g.save(); g.translate(x, y); g.rotate(q.rot * 0.3); g.shadowColor = '#fff6c0'; g.shadowBlur = s * 1.2;
        g.beginPath(); for (let i = 0; i < 8; i++) { const r = i % 2 ? s * 0.28 : s; const an = (i * Math.PI) / 4; g.lineTo(Math.cos(an) * r, Math.sin(an) * r); } g.closePath(); g.fill(); g.restore();
      } else if (shape === 'petal') {
        g.save(); g.translate(x, y); g.rotate(q.rot); g.beginPath(); g.ellipse(0, 0, s * 0.55, s * 0.28, 0, 0, 6.283); g.fill(); g.restore();
      } else if (shape === 'note') {
        g.save(); g.translate(x, y); g.lineWidth = Math.max(1, s * 0.14);
        g.beginPath(); g.ellipse(-s * 0.18, s * 0.3, s * 0.22, s * 0.16, -0.4, 0, 6.283); g.fill();
        g.beginPath(); g.moveTo(s * 0.02, s * 0.28); g.lineTo(s * 0.02, -s * 0.45); g.lineTo(s * 0.32, -s * 0.3); g.stroke(); g.restore();
      } else if (shape === 'zap') {
        g.save(); g.translate(x, y); g.rotate(q.rot); g.lineWidth = Math.max(1, s * 0.12); g.shadowColor = q.col; g.shadowBlur = s;
        g.beginPath(); g.moveTo(-s / 2, 0); g.lineTo(-s / 6, -s / 4); g.lineTo(s / 6, s / 4); g.lineTo(s / 2, 0); g.stroke(); g.restore();
      } else {
        const grd = g.createRadialGradient(x, y, 0, x, y, s * 1.8);
        grd.addColorStop(0, '#ffffff'); grd.addColorStop(0.3, q.col); grd.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = grd; g.beginPath(); g.arc(x, y, s * 1.8, 0, 6.283); g.fill();
      }
      g.globalAlpha = 1;
    }
    destroy() { this.back.remove(); this.front.remove(); }
  }

  // ---------------------------------------------------------------- WebGL çizici
  // Model yine aynı div ağacıyla kurulur ve aynı kodla pozlanır (transform yazıları); ama tarayıcı onları
  // yüzlerce ayrı 3B katman olarak birleştirmek yerine, bu sınıf hepsini tek bir tuvale tek seferde çizer.
  // Ejder + kanat + mini ben ile ~700 yüz: CSS'te zayıf ekran kartlarını takar, WebGL'de birkaç çizim çağrısıdır.
  const GL_VS = `attribute vec3 p;attribute vec2 uv;uniform vec4 vp;uniform float d;varying vec2 vUv;
void main(){float w=(d-p.z)/d;float x=(vp.z*w+p.x-vp.z)*2.0/vp.x-w;float y=-((vp.w*w+p.y-vp.w)*2.0/vp.y-w);
float R=d*0.9;float wn=(d-R)/d;float wf=(d+R)/d;float b=-2.0/(1.0/wn-1.0/wf);float a=-1.0-b/wn;
gl_Position=vec4(x,y,a*w+b,w);vUv=uv;}`;
  const GL_FS = `precision mediump float;uniform sampler2D t;uniform float cut;varying vec2 vUv;
void main(){vec4 c=texture2D(t,vUv);if(c.a<cut)discard;gl_FragColor=vec4(c.rgb*c.a,c.a);}`;
  const IDENT = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  function mmul(a, b, o) {
    for (let c = 0; c < 4; c++) {
      const b0 = b[c * 4], b1 = b[c * 4 + 1], b2 = b[c * 4 + 2], b3 = b[c * 4 + 3];
      o[c * 4] = a[0] * b0 + a[4] * b1 + a[8] * b2 + a[12] * b3;
      o[c * 4 + 1] = a[1] * b0 + a[5] * b1 + a[9] * b2 + a[13] * b3;
      o[c * 4 + 2] = a[2] * b0 + a[6] * b1 + a[10] * b2 + a[14] * b3;
      o[c * 4 + 3] = a[3] * b0 + a[7] * b1 + a[11] * b2 + a[15] * b3;
    }
    return o;
  }
  function matOf(node) {
    const s = node._t !== undefined ? node._t : node.style.transform;
    if (node._ms !== s) { node._ms = s; node._mm = s && s !== 'none' ? new DOMMatrix(s).toFloat32Array() : IDENT; }
    return node._mm;
  }
  function det3(a, b, c, d, e, f, g, h, i) { return a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g); }
  function invM33Positive(F) {
    // sütun-öncelikli F[col*4+row]; tersinin (2,2) elemanı = minor22 / det → işareti yeter (bellek ayırmadan)
    const a00 = F[0], a10 = F[1], a20 = F[2], a30 = F[3], a01 = F[4], a11 = F[5], a21 = F[6], a31 = F[7];
    const a02 = F[8], a12 = F[9], a22 = F[10], a32 = F[11], a03 = F[12], a13 = F[13], a23 = F[14], a33 = F[15];
    const minor22 = det3(a00, a01, a03, a10, a11, a13, a30, a31, a33);
    const det = a00 * det3(a11, a12, a13, a21, a22, a23, a31, a32, a33) - a01 * det3(a10, a12, a13, a20, a22, a23, a30, a32, a33)
      + a02 * det3(a10, a11, a13, a20, a21, a23, a30, a31, a33) - a03 * det3(a10, a11, a12, a20, a21, a22, a30, a31, a32);
    return minor22 * det > 0;
  }
  class CxGL {
    constructor(v, shared) {
      this.v = v; this.shared = !!shared;
      const cv = document.createElement('canvas');
      cv.className = 'cx-gl';
      cv.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none';
      const gl = cv.getContext('webgl', { alpha: true, antialias: true, premultipliedAlpha: true, depth: true, powerPreference: 'low-power', preserveDrawingBuffer: false });
      if (!gl) throw new Error('webgl yok');
      const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
      const pr = gl.createProgram();
      gl.attachShader(pr, sh(gl.VERTEX_SHADER, GL_VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, GL_FS)); gl.linkProgram(pr);
      if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error('program');
      gl.useProgram(pr);
      this.gl = gl; this.cv = cv;
      this.aP = gl.getAttribLocation(pr, 'p'); this.aUv = gl.getAttribLocation(pr, 'uv');
      this.uVp = gl.getUniformLocation(pr, 'vp'); this.uD = gl.getUniformLocation(pr, 'd'); this.uCut = gl.getUniformLocation(pr, 'cut');
      this.vbo = gl.createBuffer(); this.ibo = gl.createBuffer();
      const MAXQ = 8000, idx = new Uint16Array(MAXQ * 6);
      for (let q = 0; q < MAXQ; q++) { idx.set([q * 4, q * 4 + 1, q * 4 + 2, q * 4, q * 4 + 2, q * 4 + 3], q * 6); }
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
      gl.enableVertexAttribArray(this.aP); gl.enableVertexAttribArray(this.aUv);
      gl.vertexAttribPointer(this.aP, 3, gl.FLOAT, false, 20, 0); gl.vertexAttribPointer(this.aUv, 2, gl.FLOAT, false, 20, 12);
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL);
      gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
      this.tex = new Map();
      this.batches = new Map();      // doku -> { a: Float32Array, n: kullanılan float }
      this.tmp = []; for (let i = 0; i < 24; i++) this.tmp.push(new Float32Array(16));
      this.P = new Float32Array(16); this.F = new Float32Array(16);
      this.shadowTex = this._shadowTexture();
      cv.addEventListener('webglcontextlost', (e) => { e.preventDefault(); if (this.shared) { CxGL._shared = null; for (const c of [...CxGL.cards]) c._glLost(); for (const x of [...CxGL.views]) x._glLost(); } else v._glLost(); });
      if (!this.shared) {
        v.c.insertBefore(cv, v.c.firstChild);
        v.stage.style.display = 'none';           // div ağacı yalnızca veri: tarayıcı onu artık çizmez
      }
    }
    warm() {
      try { const gl = this.gl; gl.bindTexture(gl.TEXTURE_2D, this.shadowTex.t); gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(20), gl.STREAM_DRAW); gl.uniform1f(this.uCut, 0.1); gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0); gl.finish(); } catch {}
    }
    // mağaza kartları için tek ortak çizici (WebGL bağlam sayısı sınırlı; kartlar çizilip kendi tuvallerine kopyalanır)
    static shared() {
      if (CxGL._shared === undefined || CxGL._shared === null) { try { CxGL._shared = window.CX_NO_GL ? false : new CxGL(null, true); CxGL._shared.warm(); } catch { CxGL._shared = false; } }
      return CxGL._shared || null;
    }
    _shadowTexture() {
      const c = document.createElement('canvas'); c.width = 128; c.height = 32;
      const x = c.getContext('2d'), g = x.createRadialGradient(64, 16, 0, 64, 16, 64);
      g.addColorStop(0, 'rgba(0,0,0,0.55)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      x.setTransform(1, 0, 0, 0.25, 0, 12); x.fillStyle = g; x.fillRect(0, -48, 128, 128);
      return this._upload(c, true);
    }
    _upload(img, linear) {
      const gl = this.gl, t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      const f = linear ? gl.LINEAR : gl.NEAREST;
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, f); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, f);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return { t, ready: true, linear: !!linear };
    }
    _texFor(url, linear) {
      let e = this.tex.get(url);
      if (!e) {
        e = { t: null, ready: false, linear: false };
        this.tex.set(url, e);
        const im = new Image();
        if (/^https?:/i.test(url)) im.crossOrigin = 'anonymous';
        im.onload = () => { if (this.dead) return; let u; try { u = this._upload(im, e.wantLinear); } catch (err) { if (this.shared) { for (const c of [...CxGL.cards]) c._glLost(); for (const x of [...CxGL.views]) x._glLost(); } else this.v._glLost(); return; }   // başka siteden izinsiz doku: eski çizime dön
          e.t = u.t; e.ready = true; e.linear = u.linear; if (this.shared) { for (const c of CxGL.cards) c._paint(); for (const x of CxGL.views) x._glDirty = true; } else this.v._glDirty = true; };
        im.src = url;
        if (this.tex.size > 48) { for (const [k, x] of this.tex) { if (k !== url) { if (x.t) this.gl.deleteTexture(x.t); this.tex.delete(k); break; } } }
      }
      if (linear && !e.linear) { e.wantLinear = true; if (e.ready) { const gl = this.gl; gl.bindTexture(gl.TEXTURE_2D, e.t); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); e.linear = true; } }
      return e;
    }
    _faceInfo(f) {
      let i = f._gi;
      if (!i) {
        const st = f.style, m = /url\(["']?(.*?)["']?\)$/.exec(st.backgroundImage || '');
        const w = parseFloat(st.width) || 0, h = parseFloat(st.height) || 0;
        const bs = (st.backgroundSize || '').split(' ').map(parseFloat), bp = (st.backgroundPosition || '').split(' ').map(parseFloat);
        const bw = bs[0] || w, bh = bs[1] || h, bx = -(bp[0] || 0), by = -(bp[1] || 0);
        i = f._gi = { url: m ? m[1] : '', w, h, u0: bx / bw, v0: by / bh, u1: (bx + w) / bw, v1: (by + h) / bh, two: !!f.closest('.cx-wingbox, .cx-wing') };
      }
      return i;
    }
    _push(tex, M, w, h, u0, v0, u1, v1) {
      let b = this.batches.get(tex);
      if (!b) { b = { a: new Float32Array(2000), n: 0 }; this.batches.set(tex, b); }
      if (b.n + 20 > b.a.length) { const na = new Float32Array(b.a.length * 2); na.set(b.a); b.a = na; }
      const a = b.a, hw = w / 2, hh = h / 2, n0 = b.n;
      const C = this._C || (this._C = new Float32Array(16));
      C[0] = -hw; C[1] = -hh; C[2] = u0; C[3] = v0; C[4] = hw; C[5] = -hh; C[6] = u1; C[7] = v0; C[8] = hw; C[9] = hh; C[10] = u1; C[11] = v1; C[12] = -hw; C[13] = hh; C[14] = u0; C[15] = v1;
      for (let k = 0; k < 16; k += 4) {
        const x = C[k], y = C[k + 1], iw = 1 / (M[3] * x + M[7] * y + M[15] || 1);
        a[b.n++] = (M[0] * x + M[4] * y + M[12]) * iw;
        a[b.n++] = (M[1] * x + M[5] * y + M[13]) * iw;
        a[b.n++] = (M[2] * x + M[6] * y + M[14]) * iw;
        a[b.n++] = C[k + 2]; a[b.n++] = C[k + 3];
      }
      // neredeyse yandan görünen yüz (ekranda 1 pikselden ince uzun çizgi): CSS'te tarayıcı bunları çizmez, burada da atla
      const d = this.persp, ox = this._ox, oy = this._oy;
      const X = (j) => ox + (a[n0 + j * 5] - ox) * d / (d - a[n0 + j * 5 + 2]), Y = (j) => oy + (a[n0 + j * 5 + 1] - oy) * d / (d - a[n0 + j * 5 + 2]);   // perspektifli ekran konumu
      const area = Math.abs((X(0) * Y(1) - X(1) * Y(0)) + (X(1) * Y(2) - X(2) * Y(1)) + (X(2) * Y(3) - X(3) * Y(2)) + (X(3) * Y(0) - X(0) * Y(3))) / 2;
      const e1 = Math.hypot(X(1) - X(0), Y(1) - Y(0)), e2 = Math.hypot(X(3) - X(0), Y(3) - Y(0));
      if (area / Math.max(1, e1, e2) < 1.2) b.n = n0;
    }
    _walk(node, M, depth) {
      const kids = node.children;
      for (let i = 0; i < kids.length; i++) {
        const ch = kids[i];
        let k = ch._k;
        if (k === undefined) k = ch._k = ch.classList.contains('cx-face') ? 1 : ch.classList.contains('cx-shadow') ? 3 : ch.classList.contains('cx-hearts') ? 0 : 2;
        if (k === 0 || k === 3) continue;
        const out = this.tmp[Math.min(depth, 23)];
        mmul(M, matOf(ch), out);
        if (k === 1) {
          const fi = this._faceInfo(ch);
          if (!fi.url || fi.w <= 0 || fi.h <= 0) continue;
          if (!fi.two && !invM33Positive(mmul(this.P, out, this.F))) continue;   // CSS backface-visibility: hidden ile aynı
          if (!fi.lin && ch.style.imageRendering === 'auto') fi.lin = true;
          const te = this._texFor(fi.url, !!fi.lin);
          if (!te.ready) continue;
          this._push(te, out, fi.w, fi.h, fi.u0, fi.v0, fi.u1, fi.v1);
        } else this._walk(ch, out, depth + 1);
      }
    }
    render(target) {
      const gl = this.gl, v = target || this.v, cv = this.cv;
      const W = v._glW || v.c.clientWidth, H = v._glH || v.c.clientHeight;
      if (!W || !H) return false;
      if (v._glPersp === undefined) { v._glPersp = parseFloat(getComputedStyle(v.c).perspective) || 1400; v._glTop = v.c.classList.contains('cx-propcard') ? 0.5 : 0.52; }
      this.persp = v._glPersp; this.topR = v._glTop;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const pw = Math.round(W * dpr), ph = Math.round(H * dpr);
      // tuval yalnız büyür (kart / önizleme arasında her karede yeniden boyutlanıp çerçeve tamponu baştan ayrılmasın);
      // çizim sol üst köşedeki pw x ph bölgesine yapılır, kopyalayan da o bölgeyi alır
      if (cv.width < pw || cv.height < ph) { cv.width = Math.max(cv.width, pw); cv.height = Math.max(cv.height, ph); }
      const vy = cv.height - ph;
      gl.viewport(0, vy, pw, ph);
      gl.enable(gl.SCISSOR_TEST); gl.scissor(0, vy, pw, ph);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.uniform4f(this.uVp, W, H, W / 2, H / 2); gl.uniform1f(this.uD, this.persp); this._ox = W / 2; this._oy = H / 2;
      // CSS perspektifi (kap merkezli): T(ox,oy) * perspective(d) * T(-ox,-oy) — arka yüz testi için
      { const d = this.persp, ox = W / 2, oy = H / 2, P = this.P; P.set(IDENT); P[11] = -1 / d; P[8] = -ox / d * -1 * -1; P[9] = -oy / d * -1 * -1;
        // T(o)*Pd*T(-o): sütun 2 = (ox*(-1/d)... ) hesaplamayı açıkça yap
        const T1 = new Float32Array(IDENT); T1[12] = ox; T1[13] = oy; const Pd = new Float32Array(IDENT); Pd[11] = -1 / d; const T2 = new Float32Array(IDENT); T2[12] = -ox; T2[13] = -oy;
        mmul(mmul(T1, Pd, new Float32Array(16)), T2, P); }
      for (const b of this.batches.values()) b.n = 0;
      // sahne kökü: .cx-stage (left 50%, top 52%) + kendi transformu
      const base = new Float32Array(IDENT); base[12] = W / 2; base[13] = H * this.topR;
      const S0 = mmul(base, matOf(v.stage), new Float32Array(16));
      // gölge: ayakların altında yatay elips (CSS: 150x34, top 150, rotateX(90) translateZ(-2))
      if (v.shadow && !v._noShadow && !v.c.closest('.pv-live')) {
        const t1 = new Float32Array(IDENT); t1[13] = 167;
        const M = mmul(mmul(S0, t1, new Float32Array(16)), (this._shM || (this._shM = new DOMMatrix('rotateX(90deg) translateZ(-2px)').toFloat32Array())), new Float32Array(16));
        this.batches.set(this.shadowTex, this.batches.get(this.shadowTex) || { a: new Float32Array(40), n: 0 });
        this._push(this.shadowTex, M, 150, 34, 0, 0, 1, 1);
      }
      this._walk(v.stage, S0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
      // önce gölge (derinlik yazmadan, yumuşak kenar), sonra model (kesik alfa, derinlik testi)
      const sb = this.batches.get(this.shadowTex);
      if (sb && sb.n) { gl.depthMask(false); gl.uniform1f(this.uCut, 0.0); gl.bindTexture(gl.TEXTURE_2D, this.shadowTex.t); gl.bufferData(gl.ARRAY_BUFFER, sb.a.subarray(0, sb.n), gl.STREAM_DRAW); gl.drawElements(gl.TRIANGLES, (sb.n / 20) * 6, gl.UNSIGNED_SHORT, 0); gl.depthMask(true); }
      gl.uniform1f(this.uCut, 0.1);
      for (const [te, b] of this.batches) {
        if (te === this.shadowTex || !b.n) continue;
        gl.bindTexture(gl.TEXTURE_2D, te.t);
        gl.bufferData(gl.ARRAY_BUFFER, b.a.subarray(0, b.n), gl.STREAM_DRAW);
        gl.drawElements(gl.TRIANGLES, (b.n / 20) * 6, gl.UNSIGNED_SHORT, 0);
      }
      return true;
    }
    destroy() { this.dead = true; try { const x = this.gl.getExtension('WEBGL_lose_context'); if (x) x.loseContext(); } catch {} this.cv.remove(); }
  }

  CxGL.cards = new Set(); CxGL.views = new Set();
  class CxViewer {
    constructor(container, opts = {}) {
      this.c = container;
      this.S = opts.scale || 9;
      this.options = { capeWave: 1, wingSpeed: 1, autoRotate: true, ...opts };
      this.anim = 'wave';
      this.yaw = -25; this.pitch = -8;
      this.wingsOpen = true; this.wingOpenAmt = 1;
      this.pet = { on: false, side: 'left' };
      this.hatEntry = null; this.flyEntry = null;
      this.skin = null; this.slim = false; this.capeUrl = null; this.wingsUrl = null;
      this.t0 = performance.now();
      container.classList.add('cx-viewer');
      this.stage = el('cx-stage', container);
      this.rig = el('cx-rig', this.stage);
      this.shadow = el('cx-shadow', this.stage);
      // ortak WebGL çizici (tek bağlam, açılışta boş zamanda hazırlanır): div ağacı gizlenir, kendi tuvaline kopyalanır
      const g = window.CX_NO_GL ? null : CxGL.shared();
      if (g) {
        this._gl = g;
        this._cv = document.createElement('canvas');
        this._cv.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none';
        container.insertBefore(this._cv, container.firstChild);
        this.stage.style.display = 'none';
        CxGL.views.add(this);
      }
      this._bindDrag();
      this._frame = this._frame.bind(this);
      requestAnimationFrame(this._frame);
    }

    async setSkin(src, { slim } = {}) {
      const n = await normalizeSkin(src);
      this.skin = n.url;
      this.slim = slim === undefined ? n.slim : slim;
      this._build();
      return n;
    }
    setCape(url) { this.capeUrl = url; this._build(); }
    setWings(url) { this.wingsUrl = url; this._build(); }
    setPet(on, side = 'left') { this.pet = { on, side }; this._build(); }
    setProps(hat, fly) { this.hatEntry = hat || null; this.flyEntry = fly || null; this._build(); }
    setAnimation(a) { this.anim = a; }
    setWingsOpen(v) { this.wingsOpen = v; }

    _build() {
      this._needsPose = true;
      if (!this.skin) return;
      const S = this.S;
      this.rig.innerHTML = '';
      this.P = buildPlayer(this.rig, this.skin, this.slim, S);

      this.cape = null;
      if (this.capeUrl) {
        const g = el('cx-part', this.rig);
        const h = el('cx-part', g);
        h.style.transform = `translate3d(0, ${8 * S}px, ${-0.5 * S}px) rotateY(180deg)`;
        const dim = (CxViewer._capeDim = CxViewer._capeDim || new Map()).get(this.capeUrl);
        box(h, this.capeUrl, 64, dim ? 64 * dim.h / dim.w : 32, S, 0, 0, 10, 16, 1);
        if (dim) { if (dim.w > 64) h.querySelectorAll('.cx-face').forEach((f) => { f.style.imageRendering = 'auto'; }); }
        else {
          const url = this.capeUrl, im = new Image();
          im.onload = () => {
            if (CxViewer._capeDim.size > 40) CxViewer._capeDim.clear();
            CxViewer._capeDim.set(url, { w: im.width, h: im.height });
            if (this.capeUrl === url && !this._dead && im.height !== im.width / 2) this._build();   // oran 2:1 değilse (kare vb.) doğru ölçekle yeniden kur
            else if (im.width > 64 && this.capeUrl === url) h.querySelectorAll('.cx-face').forEach((f) => { f.style.imageRendering = 'auto'; });
          };
          im.src = url;
        }
        this.cape = { g, pivot: [0, -8, -2.05], rx: 0, ry: 0, rz: 0 };
      }

      this.wings = null;
      if (this.wingsUrl) this.wings = [buildWing(this.rig, this.wingsUrl, -1, S), buildWing(this.rig, this.wingsUrl, 1, S)];

      this.hat = this.fly = null;
      if (this.hatEntry) { const g = this.P.head.g; this.hat = buildProp(g, this.hatEntry, S); poseProp(this.hat, S); }
      if (this.flyEntry) {
        const g = el('cx-part', this.rig);
        this.fly = { g, nodes: buildProp(g, this.flyEntry, S), x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, heading: 0, bank: 0, lastDh: 0, phase: 0, speed: 0, burst: 0, vyo: 0, init: false };
        this._flyT = null;
      }

      this.mini = null;
      if (this.pet.on) {
        const g = el('cx-part', this.rig);
        const inner = el('cx-part', g);
        this.mini = { g, inner, P: buildPlayer(inner, this.skin, this.slim, S) };
      }
    }

    _bindDrag() {
      let down = null;
      this.c.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, yaw: this.yaw, pitch: this.pitch }; this.c.setPointerCapture(e.pointerId); this.dragging = true; });
      this.c.addEventListener('pointermove', (e) => {
        if (!down) return;
        this.yaw = down.yaw + (e.clientX - down.x) * 0.6;
        this.pitch = Math.max(-35, Math.min(25, down.pitch - (e.clientY - down.y) * 0.3));
      });
      const up = () => { down = null; this.dragging = false; this.lastDrag = performance.now(); };
      this.c.addEventListener('pointerup', up);
      this.c.addEventListener('pointercancel', up);
    }

    // öpücük emotesinde elden saçılan gerçek emoji kalpler
    _hearts(t, S) {
      if (this.anim !== 'kiss') { if (this.heartEls) this.heartEls.forEach((d) => (d.style.opacity = 0)); return; }
      if (!this.heartEls) {
        this.heartLayer = el('cx-hearts', this.c);
        this.heartEls = [];
        for (let i = 0; i < 9; i++) { const d = el('cx-heart', this.heartLayer); d.textContent = '\u2764\uFE0F'; this.heartEls.push(d); }
      }
      const u = t % 3.6, rnd = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
      const yaw = (this.yaw * Math.PI) / 180, W = this.c.clientWidth, H = this.c.clientHeight;
      const fx = Math.sin(yaw), hx = (-4 * Math.cos(yaw) + 9.2 * fx) * S;     // elin ekrandaki yeri
      this.heartEls.forEach((d, i) => {
        const age = (u - (1.75 + i * 0.1)) / 1.5;
        if (age < 0 || age > 1) { d.style.opacity = 0; return; }
        const sp = (rnd(i) - 0.5) * 2, dir = fx >= 0 ? 1 : -1;
        const x = W / 2 + hx + dir * age * (60 + rnd(i + 9) * 120) * (S / 11) + sp * 26;
        const y = H / 2 - 10.5 * S - age * (60 + rnd(i + 4) * 110) * (S / 11) + Math.sin(age * 6 + i) * 8 + sp * 34;
        d.style.opacity = age < 0.15 ? age / 0.15 : 1 - Math.max(0, (age - 0.6) / 0.4);
        d.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${0.5 + Math.sin(Math.min(1, age * 3) * Math.PI / 2) * 0.8}) rotate(${(rnd(i + 3) - 0.5) * 40}deg)`;
      });
    }

    destroy() { this._dead = true; CxGL.views.delete(this); if (this.c && this.c.parentNode) this.c.remove(); }
    _glLost() { this._gl = null; if (this._cv) { this._cv.remove(); this._cv = null; } CxGL.views.delete(this); this.stage.style.display = ''; }   // ekran kartı bağlamı düştüyse eski (CSS) çizime dön

    _paintGL() {
      const g = this._gl, W = this.c.clientWidth, H = this.c.clientHeight;
      if (!g || !W || !H) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1), pw = Math.round(W * dpr), ph = Math.round(H * dpr);
      this._glW = W; this._glH = H;
      if (this._cv.width !== pw || this._cv.height !== ph) { this._cv.width = pw; this._cv.height = ph; }
      if (!g.render(this)) return;
      const x = this._ctx || (this._ctx = this._cv.getContext('2d'));
      x.clearRect(0, 0, pw, ph);
      x.drawImage(g.cv, 0, 0, pw, ph, 0, 0, pw, ph);
    }

    _frame(now) {
      if (this._dead) return;
      requestAnimationFrame(this._frame);
      if (this._step(now) && this._gl) this._paintGL();
    }

    _step(now) {
      // oyun açıkken animasyonlar durur (işlemci oyuna kalsın); ama yeni kurulan model bir kez pozlanır, yoksa kanat/ejder ham (düz levha) görünür
      if (this._page === undefined) this._page = this.c.closest('.page') || null;
      const idle = document.hidden || !this.c.isConnected || this.c.offsetParent === null || (this._page && !this._page.classList.contains('active'));   // başka sayfadayken hiç çizme
      if (!this.P || idle) { this._last = 0; return false; }
      // oyun açıkken önizleme daha düşük hızda canlı kalır (WebGL ile ~30, eski çizimle ~11 kare/sn): düğmeler çalışır, işlemci oyuna kalır
      if (window.CX_SUSPEND && !this._needsPose && this._last && now - this._last < (this._gl ? 33 : 90)) { const d = this._glDirty; this._glDirty = false; return !!d; }
      this._needsPose = false;
      const t = this.timeOverride != null ? this.timeOverride : (now - this.t0) / 1000, S = this.S, P = this.P;
      if (this.options.autoRotate && !this.dragging && (!this.lastDrag || now - this.lastDrag > 2500)) this.yaw += 0.18;
      const zoom = this.flyEntry ? 0.7 : 1;   // uçan pet kafanın üstünde süzülür: kadraja sığsın diye küçült
      setT(this.rig, `${this.flyEntry ? `translateY(${46 * S / 9}px) scale(${zoom}) ` : ''}rotateX(${this.pitch.toFixed(2)}deg) rotateY(${this.yaw.toFixed(2)}deg)`);
      // sürüklerken yalnızca döndür (GPU'da ucuz); pozlar donar, bırakınca devam eder
      if (!this._gl && this.dragging && this.timeOverride == null) { this.t0 += now - (this._last || now); this._last = now; return true; }
      // eski (CSS) çizimde animasyonlar 30 fps; WebGL'de her kare (ucuz, akıcı)
      if (!this._gl && this.timeOverride == null && this._last && now - this._last < 30) return true;
      this._last = now;

      // gövde animasyonu
      for (const k in P) { P[k].rx = P[k].ry = P[k].rz = 0; }
      const breathe = Math.sin(t * 2) * 1.5;
      P.head.rx = Math.sin(t * 0.7) * 4; P.head.ry = Math.sin(t * 0.5) * 12;
      P.larm.rz = -3 - breathe; P.rarm.rz = 3 + breathe;
      let moving = 0;
      if (this.anim === 'wave') {
        P.rarm.rz = 155 + Math.sin(t * 7) * 18;
        P.rarm.rx = -10;
      } else if (this.anim === 'kiss') {
        const e = (x) => x * x * (3 - 2 * x), q = (a, b, u) => e(Math.max(0, Math.min(1, (u - a) / (b - a))));
        const u = t % 3.6;
        const up = q(0.4, 1.0, u) - q(2.6, 3.2, u);               // elin ağza gidişi / dönüşü
        const blow = q(1.5, 1.85, u) - q(1.85, 2.4, u);            // öpücüğü savurma
        P.rarm.rx = 112 * up + 22 * blow; P.rarm.rz = 3 + (-34 * up) + 52 * blow;
        P.head.rx = 8 * (q(1.1, 1.5, u) - q(1.5, 1.9, u)) - 5 * blow; P.head.rz = -8 * up;
        P.body.rx = -4 * blow; P.lleg.rx = -14 * blow; P.larm.rz = -3 - 6 * up;
      } else if (this.anim === 'walk') {
        const s = Math.sin(t * 6);
        P.rarm.rx = s * 35; P.larm.rx = -s * 35; P.rleg.rx = -s * 35; P.lleg.rx = s * 35;
        moving = 1;
      }
      pose(P, S);
      this._hearts(t, S);

      // pelerin: yürürken daha çok açılır, dururken hafif dalgalanır
      if (this.cape) {
        const w = this.options.capeWave;
        this.cape.rx = -(6 + moving * 22 + (Math.sin(t * 2.6) * 5 + Math.sin(t * 4.3) * 2.5) * w);
        const c = this.cape;
        setT(c.g, `translate3d(0, ${c.pivot[1] * S}px, ${c.pivot[2] * S}px) rotateX(${c.rx.toFixed(2)}deg) rotateZ(${(Math.sin(t * 1.7) * 2 * w).toFixed(2)}deg)`);
      }

      // kanatlar: açık/kapalı arası yumuşak geçiş + eklemli çırpma
      if (this.wings) {
        this.wingOpenAmt += ((this.wingsOpen ? 1 : 0) - this.wingOpenAmt) * 0.05;
        const pose = wingPose(this.wingOpenAmt, t, this.options.wingSpeed, moving ? 0.3 : 0);
        for (const w of this.wings) poseWing(w, pose, S);
      }

      // uçan pet: kendi fiziğiyle oyuncunun etrafında dolaşır (mod ile aynı hesap)
      if (this.fly) {
        const f = this.fly, dt = this._flyT == null ? 0.016 : clampf(t - this._flyT, 0, 0.08);
        this._flyT = t;
        flyBrain(f, t, dt, moving ? 0.6 : 0);
        const k = 0.8;
        setT(f.g, `translate3d(${(f.x * 16 * S).toFixed(2)}px, ${((-8 + f.y * 16) * S).toFixed(2)}px, ${(-f.z * 16 * S).toFixed(2)}px) scale3d(${k}, ${k}, ${k}) rotateY(${(-f.heading * 180 / Math.PI).toFixed(2)}deg)`);
        poseProp(f.nodes, S, flyPose(f.nodes, f, t));
      }

      // omuz arkadaşı: omzun üstünde küçük, hafif zıplayan ve etrafa bakan mini karakter
      if (this.mini) {
        const side = this.pet.side === 'right' ? -1 : 1, k = 0.32;
        const bob = Math.abs(Math.sin(t * 3)) * 0.8;
        // baş döndükçe köşeleri dışarı taşar; mini kopya da o kadar dışarı kayar (içe girmesin)
        const hy = (P.head.ry * Math.PI) / 180;
        const px = 3.6 + 4.5 * (Math.abs(Math.cos(hy)) + Math.abs(Math.sin(hy)));
        setT(this.mini.g, `translate3d(${(side * px * S).toFixed(2)}px, ${((-8 - 16 * k - bob) * S).toFixed(2)}px, 0) scale3d(${k}, ${k}, ${k}) rotateY(${(Math.sin(t * 0.8) * 8).toFixed(2)}deg)`);
        const m = this.mini.P;
        for (const kk in m) { m[kk].rx = m[kk].ry = m[kk].rz = 0; }
        m.head.ry = Math.sin(t * 1.3) * 30; m.head.rx = Math.sin(t * 0.9) * 8;
        m.rarm.rz = 6 + Math.sin(t * 5) * 5; m.larm.rz = -6 - Math.sin(t * 5) * 5;
        m.rleg.rx = -8; m.lleg.rx = 8;
        m.head.sc = 1.9;   // büyük kafa, küçük gövde
        pose(m, S);
      }
      // efekt parçacıkları (takılı efekt ya da önizlenen)
      if (this.effect || (this._fx && this._fx.active())) {
        if (!this._fx) this._fx = new FxLayer(this.c);
        if (this._fxId !== (this.effect || '')) { this._fxId = this.effect || ''; this._fx.set(this._fxId); }
        const W = this.c.clientWidth, H = this.c.clientHeight, zoom = this.flyEntry ? 0.7 : 1, off = this.flyEntry ? 46 * S / 9 : 0;
        const dtf = this._fxT ? Math.min(0.1, (now - this._fxT) / 1000) : 0.016; this._fxT = now;
        this._fx.step(dtf, W / 2, H * 0.52 + off + 16 * S * zoom, 16 * S * zoom, this.yaw, !!this.effect);
      }
      return true;
    }
  }

  // ---------------------------------------------------------------- mağaza kartı: yalnızca eşyanın kendisi (şapka / kask / uçan pet)
  // Kartta durağan, güzel bir açıyla durur; imleç üstüne gelince döner (pet kanat çırpar). Boştayken hiç iş yapmaz.
  class CxPropCard {
    constructor(container, entry, kind, size = 96, view = null) {
      this.c = container; this.kind = kind; this.entry = entry;
      const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : null; };
      this.view = { yaw: num(view && view.viewYaw), pitch: num(view && view.viewPitch), zoom: num(view && view.viewZoom) };   // admin panelinden elle ayar (boşsa otomatik)
      if (kind === 'player' || kind === 'fx') { this._initPlayer(container, entry, size, kind === 'player'); return; }
      // modelin gerçek sınırlarını bul → kutuya sığacak ölçek
      const parts = entry.model.parts, byName = {}; parts.forEach((p) => (byName[p.n] = p));
      const abs = (p) => { let x = 0, y = 0, z = 0, q = p; while (q) { x += q.pv[0]; y += q.pv[1]; z += q.pv[2]; q = byName[q.p]; } return [x, y, z]; };
      let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
      for (const p of parts) { const o = abs(p); for (const [x, y, z, w, h, d] of p.b) { const a = [x + o[0], y + o[1], z + o[2]], b = [a[0] + w, a[1] + h, a[2] + d]; for (let i = 0; i < 3; i++) { mn[i] = Math.min(mn[i], a[i]); mx[i] = Math.max(mx[i], b[i]); } } }
      const bw = mx[0] - mn[0], bh = mx[1] - mn[1], bd = mx[2] - mn[2];
      const ext = Math.max(bh, Math.max(bw, bd) * 0.9);
      this.S = Math.max(1.5, (size * (kind === 'fly' ? 1.45 : 0.95)) / (ext || 1)) * Math.max(0.3, Math.min(3, this.view.zoom || 1));
      this.cx = (mn[0] + mx[0]) / 2; this.cy = (mn[1] + mx[1]) / 2; this.cz = -(mn[2] + mx[2]) / 2;
      container.classList.add('cx-viewer', 'cx-propcard');
      this.stage = el('cx-stage', container);
      this.rig = el('cx-rig', this.stage);
      this.inner = el('cx-part', this.rig);
      this.nodes = buildProp(this.inner, entry, this.S);
      this.inner.style.transform = `translate3d(${-this.cx * this.S}px, ${-this.cy * this.S}px, ${-this.cz * this.S}px)`;
      this.baseYaw = kind === 'fly' ? -38 : -32; this.basePitch = kind === 'fly' ? -10 : -3;   // ejder yüzü bize dönük, 3/4 açı
      this._common(container);
    }
    // mini oyuncu (omuz arkadaşı) kartı: aynı ortak çizici, yalnız yerinde döner
    _initPlayer(container, entry, size, bigHead = true) {
      // omuz arkadaşı: oyundaki gibi büyük kafa (1.9x), küçük gövde (yükseklik 39.2 piksel); efekt kartı: normal oyuncu (32 piksel)
      const tall = bigHead ? 39.2 : 32;
      this.S = Math.max(1.2, (size * (bigHead ? 1.12 : 0.92)) / tall) * Math.max(0.3, Math.min(3, this.view.zoom || 1));
      container.classList.add('cx-viewer', 'cx-propcard');
      this.stage = el('cx-stage', container);
      this.rig = el('cx-rig', this.stage);
      this.inner = el('cx-part', this.rig);
      this.P = buildPlayer(this.inner, entry.skin, !!entry.slim, this.S);
      if (bigHead) this.P.head.sc = 1.9;
      pose(this.P, this.S);
      if (bigHead) this.inner.style.transform = `translate3d(0, ${(3.6 * this.S).toFixed(2)}px, 0)`;   // büyüyen kafayla birlikte ortala
      if (this.kind === 'fx') { this._fx = new FxLayer(container); this._fx.set(entry.fx); this._fx.set(''); this._fxId = entry.fx; }
      this.nodes = null;
      this.baseYaw = -28; this.basePitch = -6;
      this._common(container);
    }
    _common(container) {
      if (this.view.yaw !== null) this.baseYaw = this.view.yaw;
      if (this.view.pitch !== null) this.basePitch = this.view.pitch;
      this.yaw = this.baseYaw; this.pitch = this.basePitch;
      this.f = { phase: 0, speed: 0, burst: 0, vyo: 0, bank: 0 };
      this.t = 0; this.running = false; this.hover = false;
      this._tick = this._tick.bind(this);
      // ortak WebGL çizici varsa: div ağacı gizlenir, kart kendi küçük tuvaline kopyalanır (yüzlerce CSS katmanı yerine tek resim)
      const g = CxGL.shared();
      if (g) {
        this._cv = document.createElement('canvas');
        this._cv.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none';
        container.insertBefore(this._cv, container.firstChild);
        this.stage.style.display = 'none';
        this._noShadow = true;
        CxGL.cards.add(this);
      }
      this._draw(0);
    }
    _draw(t) {
      setT(this.rig, `rotateX(${this.pitch.toFixed(2)}deg) rotateY(${this.yaw.toFixed(2)}deg)`);
      if (this.nodes) poseProp(this.nodes, this.S, this.kind === 'fly' ? flyPose(this.nodes, this.f, t) : undefined);
      this._paint();
    }
    _paint() {
      if (!this._cv || this._dead) return;
      if (!this.c.isConnected) { CxGL.cards.delete(this); if (this._ro) { this._ro.disconnect(); this._ro = null; } return; }   // karttan çıkıldıysa (ızgara yenilendi) bırak
      const g = CxGL.shared();
      if (!g) { this._glLost(); return; }
      const W = this.c.clientWidth, H = this.c.clientHeight;
      if (!W || !H) {   // görünmüyor (sayfa gizli): her karede yoklama yerine görünür olunca bir kez çiz
        if (!this._ro && window.ResizeObserver) { this._ro = new ResizeObserver(() => { if (this.c.clientWidth && this.c.clientHeight) this._paint(); }); this._ro.observe(this.c); }
        return;
      }
      const dpr = Math.min(2, window.devicePixelRatio || 1), pw = Math.round(W * dpr), ph = Math.round(H * dpr);
      this._glW = W; this._glH = H;
      if (this._cv.width !== pw || this._cv.height !== ph) { this._cv.width = pw; this._cv.height = ph; }
      if (!g.render(this)) return;
      const x = this._ctx || (this._ctx = this._cv.getContext('2d'));
      x.clearRect(0, 0, pw, ph);
      x.drawImage(g.cv, 0, 0, pw, ph, 0, 0, pw, ph);
    }
    _glLost() { if (this._cv) { this._cv.remove(); this._cv = null; } this.stage.style.display = ''; CxGL.cards.delete(this); }
    start() { this.hover = true; if (!this.running && !this._dead) { this.running = true; this._last = performance.now(); requestAnimationFrame(this._tick); } }
    stop() { this.hover = false; }
    _tick(now) {
      if (this._dead || !this.c.isConnected) { this.running = false; return; }
      const dt = Math.min(0.05, (now - this._last) / 1000); this._last = now;
      if (this._fx) {   // efekt kartı: üstüne gelince parçacık saçar, bırakınca kalanlar söner
        if (this.hover && this._fx.id !== this._fxId) this._fx.set(this._fxId);
        if (!this.hover && this._fx.id) this._fx.id = '';
        const W = this.c.clientWidth, H = this.c.clientHeight;
        this._fx.step(dt, W / 2, H * 0.5 + 16 * this.S, 16 * this.S, this.yaw, this.hover);
      }
      if (this.hover) {
        this.yaw += 70 * dt; this.t += dt;
        if (this.kind === 'fly') { this.f.phase += dt * (4.2 + 4); this.f.burst = 0.15; }
      } else {
        // bırakınca başlangıç açısına yumuşakça dön
        const target = this.baseYaw + Math.round((this.yaw - this.baseYaw) / 360) * 360 + (this.yaw - this.baseYaw > 0 ? 0 : 0);
        const diff = ((target - this.yaw) % 360 + 540) % 360 - 180;
        this.yaw += diff * Math.min(1, dt * 7); this.pitch += (this.basePitch - this.pitch) * Math.min(1, dt * 7);
        if (this.kind === 'fly') this.f.phase += dt * 3;
        if (Math.abs(diff) < 0.4 && Math.abs(this.pitch - this.basePitch) < 0.3 && !(this._fx && this._fx.active())) { this.yaw = target; this.running = false; this.f.phase = 0; this._draw(this.t); return; }
      }
      this._draw(this.t);
      requestAnimationFrame(this._tick);
    }
    destroy() { this._dead = true; CxGL.cards.delete(this); if (this._ro) this._ro.disconnect(); if (this.c.parentNode) this.c.remove(); }
  }

  // açılıştan biraz sonra, boş zamanda ortak çiziciyi hazırla: Kozmetik / Mağaza'ya ilk geçişte gölgelendirici derlemesi beklenmesin
  setTimeout(() => { const run = () => { try { CxGL.shared(); } catch {} }; if (window.requestIdleCallback) requestIdleCallback(run, { timeout: 4000 }); else run(); }, 2500);

  CxViewer.normalizeSkin = normalizeSkin;
  window.CxPropCard = CxPropCard;
  window.CxFx = { FxLayer, flameSprite, FX };
  window.CxViewer = CxViewer;
})();

/* "5 hal yang boleh kamu lepas hari ini." — 40s, 1080x1920, cinematic hopecore illustration.
 * A calm river at dusk; paper lanterns are lit in two hands, written on, and released into
 * a sky that slowly fills with stars and other people's lanterns.
 * Every frame is a pure function of time; shared timing lives in timeline.js. */
(() => {
  'use strict';

  const W = 1080, H = 1920, DURATION = 40, TAU = Math.PI * 2, HZ = 1080;
  const TL = window.LENTERA_TL;
  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d');

  const C = {
    navy: '#0B1640', navy2: '#13235A', blue: '#184AA1', blueSoft: '#4E6FB8', cream: '#FFF3DF', creamDim: '#F1DFC2',
    amber: '#FFB24A', amberHot: '#FFD88A', amberDeep: '#E08A2E', ink: '#4A2E26', skin: '#3A2730', skinRim: '#C9824A',
  };
  const HAND = '"Caveat", cursive', SERIF = '"Lora", serif';

  // ---------- math ----------
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const P = (t, a, b) => clamp((t - a) / (b - a));
  const E = {
    outCubic: x => 1 - Math.pow(1 - x, 3),
    inCubic: x => x * x * x,
    inOut: x => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
    inOutSine: x => -(Math.cos(Math.PI * x) - 1) / 2,
  };
  const rnd = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const mix = (a, b, t) => { const A = hex(a), B = hex(b); return '#' + A.map((v, i) => Math.round(lerp(v, B[i], t)).toString(16).padStart(2, '0')).join(''); };

  const ready = Promise.all([
    document.fonts.load(`600 60px ${HAND}`), document.fonts.load(`600 60px ${SERIF}`), document.fonts.load(`italic 500 60px ${SERIF}`),
  ]).then(() => document.fonts.ready);

  // soft glow sprites
  function sprite(stops) {
    const c = Object.assign(document.createElement('canvas'), { width: 256, height: 256 }), g = c.getContext('2d');
    const r = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    stops.forEach(([o, col]) => r.addColorStop(o, col));
    g.fillStyle = r; g.fillRect(0, 0, 256, 256); return c;
  }
  const GLOW = sprite([[0, 'rgba(255,214,140,0.95)'], [0.25, 'rgba(255,178,74,0.45)'], [1, 'rgba(255,150,60,0)']]);
  const STAR = sprite([[0, 'rgba(255,255,255,1)'], [0.2, 'rgba(255,250,235,0.5)'], [1, 'rgba(255,250,235,0)']]);
  const GRAIN = (() => {
    const S = 256, c = Object.assign(document.createElement('canvas'), { width: S, height: S }), g = c.getContext('2d');
    const img = g.createImageData(S, S);
    for (let i = 0; i < S * S; i++) { const v = rnd(i * 0.7 + 3) * 255; img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255; }
    g.putImageData(img, 0, 0); return ctx.createPattern(c, 'repeat');
  })();
  function glow(x, y, r, a) { if (a <= 0 || r <= 0) return; ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = clamp(a); ctx.drawImage(GLOW, x - r, y - r, 2 * r, 2 * r); ctx.restore(); }

  // =====================================================================
  // LANTERN STATE
  function heldPose(L, t) {
    // returns {x, y, s, a} for a hero lantern
    const base = { x: 540, y: 1360, s: 1 };
    if (L.rise != null && t < L.rise + 0.6) { const p = E.outCubic(P(t, L.rise, L.rise + 0.6)); return { x: 540, y: lerp(1900, 1360, p), s: 1, held: true }; }
    if (t < L.release) return { ...base, held: true };
    const p = E.inOutSine(P(t, L.release, L.settle));
    const [sx, sy, ss] = L.sky;
    const drift = Math.max(0, t - L.settle);
    const sway = Math.sin(t * 0.7 + L.i * 1.7) * 26 * p;
    return { x: lerp(540, sx, p) + sway, y: lerp(1360, sy, p) - drift * 7, s: lerp(1, ss, Math.pow(p, 0.8)), held: false };
  }
  function lit(L, t) {
    if (L.i === 0) return t >= TL.HOOK.ignite ? 1 : 0;
    return E.outCubic(P(t, L.rise + 0.3, L.rise + 0.8));
  }

  // background lanterns released by other people far away
  const CROWD = Array.from({ length: 54 }, (_, i) => {
    const early = i < 4;
    return {
      t0: early ? -20 + i * 4 : 12 + rnd(i + 1) * 22, x: 60 + rnd(i + 2) * 960, v: 22 + rnd(i + 3) * 30,
      s: 0.05 + rnd(i + 4) * 0.08, ph: rnd(i + 5) * 6.28, top: 120 + rnd(i + 6) * 760,
    };
  });
  function crowdPos(c, t) {
    if (t < c.t0) return null;
    const y = Math.max(c.top, HZ - 30 - (t - c.t0) * c.v);
    const k = clamp((HZ - y) / (HZ - c.top));
    return { x: c.x + Math.sin(t * 0.5 + c.ph) * 20, y, s: c.s * (1 - 0.35 * k) };
  }

  // =====================================================================
  // SCENE
  function sky(t) {
    const night = P(t, 0, 36);
    const g = ctx.createLinearGradient(0, 0, 0, HZ);
    g.addColorStop(0, mix('#14275E', '#0A1438', night));
    g.addColorStop(0.45, mix('#2F56A6', '#1C3A85', night));
    g.addColorStop(0.75, mix('#9C8FB8', '#6E6FA6', night));
    g.addColorStop(0.92, mix('#F4B47A', '#E8A26A', night));
    g.addColorStop(1, mix('#FFD39A', '#F7BE7E', night));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, HZ);
    // stars appear little by little
    for (let i = 0; i < 190; i++) {
      const appear = i < 40 ? -1 : 2 + (i - 40) / 150 * 32;
      const a = clamp((t - appear) / 0.8) * (0.45 + 0.55 * (0.5 + 0.5 * Math.sin(t * (1 + rnd(i) * 2) + i)));
      if (a <= 0) continue;
      const x = rnd(i + 10) * W, y = Math.pow(rnd(i + 20), 1.5) * (HZ - 260);
      const r = 6 + rnd(i + 30) * 14;
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a * (1 - y / HZ * 0.7);
      ctx.drawImage(STAR, x - r, y - r, 2 * r, 2 * r); ctx.restore();
    }
    // a soft moon low on the left
    glow(150, 760, 160, 0.25);
    ctx.drawImage(MOON, 150 - 50, 760 - 50);
  }
  const MOON = (() => { // crescent cut with destination-out so it sits on any sky colour
    const c = Object.assign(document.createElement('canvas'), { width: 100, height: 100 }), g = c.getContext('2d');
    g.beginPath(); g.arc(50, 50, 40, 0, TAU); g.fillStyle = '#FFF4DE'; g.fill();
    g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.arc(66, 40, 36, 0, TAU); g.fill();
    return c;
  })();

  function hills(t) {
    const layer = (y0, amp, col, seed) => {
      ctx.beginPath(); ctx.moveTo(0, HZ + 4);
      for (let x = 0; x <= W; x += 20) ctx.lineTo(x, y0 - amp * (0.5 + 0.5 * Math.sin(x / 210 + seed) * Math.cos(x / 97 + seed * 2)));
      ctx.lineTo(W, HZ + 4); ctx.closePath(); ctx.fillStyle = col; ctx.fill();
    };
    layer(1010, 70, 'rgba(48,62,120,0.85)', 1.3);
    // mist
    const m = ctx.createLinearGradient(0, 960, 0, HZ); m.addColorStop(0, 'rgba(255,214,170,0)'); m.addColorStop(1, 'rgba(255,214,170,0.35)');
    ctx.fillStyle = m; ctx.fillRect(0, 960, W, HZ - 960);
    layer(1055, 50, '#1B2A5E', 4.1);
    // tiny trees on the far bank
    ctx.fillStyle = '#16224F';
    for (let i = 0; i < 26; i++) { const x = rnd(i + 70) * W, h = 18 + rnd(i + 80) * 30; ctx.beginPath(); ctx.moveTo(x - 9, HZ - 8); ctx.lineTo(x, HZ - 8 - h); ctx.lineTo(x + 9, HZ - 8); ctx.fill(); }
  }

  function river(t, lights) {
    const g = ctx.createLinearGradient(0, HZ, 0, H);
    g.addColorStop(0, '#E9B07C'); g.addColorStop(0.08, '#8E7FA6'); g.addColorStop(0.35, '#2C4687'); g.addColorStop(1, '#0C173F');
    ctx.fillStyle = g; ctx.fillRect(0, HZ, W, H - HZ);
    // reflections of the lanterns
    for (const L of lights) {
      const ry = HZ + (HZ - L.y) * 0.42;
      if (ry > H) continue;
      for (let k = 0; k < 6; k++) {
        const yy = ry + k * 18 * (1 + L.s), wob = Math.sin(t * 2.2 + k * 1.3 + L.x * 0.01) * 10 * (1 + L.s);
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.22 * L.a * (1 - k / 6);
        ctx.fillStyle = C.amber; ctx.beginPath(); ctx.ellipse(L.x + wob, yy, 34 * L.s + 6, 3 + 3 * L.s, 0, 0, TAU); ctx.fill(); ctx.restore();
      }
    }
    // ripples
    ctx.save();
    for (let i = 0; i < 70; i++) {
      const y = HZ + 10 + Math.pow(rnd(i), 1.6) * (H - HZ - 10);
      const len = 40 + rnd(i + 3) * 160 * (1 + (y - HZ) / 600);
      const x = (rnd(i + 5) * W + t * (8 + rnd(i) * 10)) % (W + 200) - 100;
      ctx.globalAlpha = 0.12 + 0.12 * Math.sin(t * 1.5 + i);
      ctx.fillStyle = i % 4 === 0 ? '#FFD6A0' : '#B9C8EE';
      ctx.fillRect(x, y, len, 2 + (y - HZ) / 300);
    }
    ctx.restore();
  }

  function reeds(t) {
    const wind = Math.sin(t * 0.9) * 0.06 + Math.sin(t * 2.3) * 0.02;
    ctx.save(); ctx.fillStyle = '#081030';
    for (let i = 0; i < 46; i++) {
      const side = i < 23 ? 0 : 1;
      const bx = side ? W - rnd(i) * 230 : rnd(i) * 230, h = 160 + rnd(i + 9) * 340;
      const bend = (wind + Math.sin(t * 1.4 + i) * 0.03) * h;
      ctx.beginPath(); ctx.moveTo(bx - 5, H + 10); ctx.quadraticCurveTo(bx + bend * 0.4, H - h * 0.5, bx + bend, H - h); ctx.quadraticCurveTo(bx + bend * 0.4 + 3, H - h * 0.5, bx + 5, H + 10); ctx.fill();
      if (i % 4 === 0) { ctx.beginPath(); ctx.ellipse(bx + bend, H - h - 18, 7, 26, bend / h, 0, TAU); ctx.fill(); }
    }
    ctx.restore();
  }

  // ---------- lantern ----------
  function wrapLines(str, maxW, size) {
    ctx.font = `600 ${size}px ${HAND}`;
    const words = str.split(' '), lines = []; let cur = '';
    for (const w of words) { const test = cur ? cur + ' ' + w : w; if (ctx.measureText(test).width > maxW && cur) { lines.push(cur); cur = w; } else cur = test; }
    if (cur) lines.push(cur); return lines;
  }
  function balanced(str, maxW, size) { // one line if it fits, else two lines of similar length
    ctx.font = `600 ${size}px ${HAND}`;
    if (ctx.measureText(str).width <= maxW) return [str];
    const w = str.split(' '); let best = null;
    for (let i = 1; i < w.length; i++) {
      const a = w.slice(0, i).join(' '), b = w.slice(i).join(' ');
      const m = Math.max(ctx.measureText(a).width, ctx.measureText(b).width);
      if (!best || m < best[0]) best = [m, a, b];
    }
    return [best[1], best[2]];
  }
  function lantern(x, y, s, l, t, o = {}) {
    if (s <= 0.01) return;
    const fl = 0.9 + 0.1 * Math.sin(t * 13 + x) * Math.sin(t * 7.3 + y);
    glow(x, y + 40 * s, 520 * s * (0.6 + 0.4 * l), 0.9 * l * fl);
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    // body
    const body = () => { ctx.beginPath(); ctx.moveTo(-150, -150); ctx.bezierCurveTo(-150, -200, 150, -200, 150, -150); ctx.bezierCurveTo(158, 20, 125, 150, 110, 190); ctx.lineTo(-110, 190); ctx.bezierCurveTo(-125, 150, -158, 20, -150, -150); ctx.closePath(); };
    body();
    const g = ctx.createRadialGradient(0, 120, 10, 0, 40, 320);
    g.addColorStop(0, mix('#8A6A55', '#FFF6E0', l)); g.addColorStop(0.45, mix('#6E5A60', '#FFD493', l)); g.addColorStop(1, mix('#4D4560', '#E58E36', l));
    ctx.fillStyle = g; ctx.fill();
    ctx.save(); body(); ctx.clip();
    ctx.strokeStyle = `rgba(150,80,30,${0.18 + 0.1 * l})`; ctx.lineWidth = 3;
    for (let k = -3; k <= 3; k++) { ctx.beginPath(); ctx.moveTo(k * 44, -190); ctx.quadraticCurveTo(k * 50, 0, k * 36, 200); ctx.stroke(); }
    // handwriting on the paper
    if (o.text && o.write > 0) {
      const lines = wrapLines(o.text, 230, 52);
      const total = lines.reduce((a, b) => a + b.length, 0);
      let shown = o.write * total;
      ctx.fillStyle = C.ink; ctx.font = `600 52px ${HAND}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const y0 = -30 - (lines.length - 1) * 30;
      lines.forEach((ln, i) => {
        if (shown <= 0) return;
        const frac = Math.min(1, shown / ln.length); shown -= ln.length;
        const w = ctx.measureText(ln).width;
        ctx.save(); ctx.beginPath(); ctx.rect(-w / 2 - 4, y0 + i * 60 - 40, (w + 8) * frac, 80); ctx.clip();
        ctx.globalAlpha = 0.85; ctx.fillText(ln, 0, y0 + i * 60); ctx.restore();
      });
    }
    ctx.restore();
    // rim + base ring + flame
    body(); ctx.strokeStyle = `rgba(120,60,20,0.35)`; ctx.lineWidth = 4; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0, 190, 110, 18, 0, 0, TAU); ctx.strokeStyle = '#5A3A26'; ctx.lineWidth = 6; ctx.stroke();
    if (l > 0) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = l;
      ctx.beginPath(); ctx.ellipse(0, 172 - 4 * fl, 16, 30 * fl, 0, 0, TAU); ctx.fillStyle = '#FFD06A'; ctx.fill();
      ctx.beginPath(); ctx.ellipse(0, 178, 8, 16, 0, 0, TAU); ctx.fillStyle = '#FFF6D8'; ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }
  function smallLantern(x, y, s, t, ph) {
    const fl = 0.85 + 0.15 * Math.sin(t * 9 + ph);
    glow(x, y, 360 * s, 0.85 * fl);
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.beginPath(); ctx.moveTo(-150, -150); ctx.bezierCurveTo(-150, -200, 150, -200, 150, -150); ctx.bezierCurveTo(158, 20, 125, 150, 110, 190); ctx.lineTo(-110, 190); ctx.bezierCurveTo(-125, 150, -158, 20, -150, -150); ctx.closePath();
    const g = ctx.createRadialGradient(0, 120, 10, 0, 40, 320); g.addColorStop(0, '#FFF6E0'); g.addColorStop(0.5, '#FFC879'); g.addColorStop(1, '#D9792A');
    ctx.fillStyle = g; ctx.fill(); ctx.restore();
  }

  // ---------- hands ----------
  function hands(t, dx, dy, spread, a) {
    if (a <= 0 || dy > 700) return;
    ctx.save(); ctx.globalAlpha = a;
    for (const side of [-1, 1]) {
      ctx.save(); ctx.translate(540 + side * (130 + spread) + dx, 1650 + dy); ctx.scale(side, 1); ctx.rotate(-0.25 - spread * 0.002);
      // forearm
      ctx.beginPath(); ctx.moveTo(-70, 60); ctx.quadraticCurveTo(-110, 260, -150, 420); ctx.lineTo(60, 420); ctx.quadraticCurveTo(50, 230, 70, 60); ctx.closePath(); ctx.fillStyle = '#2A2140'; ctx.fill();
      // palm
      ctx.beginPath(); ctx.ellipse(0, 40, 92, 70, 0.2, 0, TAU); ctx.fillStyle = C.skin; ctx.fill();
      // fingers curling up around the lantern base
      for (let k = 0; k < 4; k++) {
        ctx.beginPath(); const fx = 40 + k * 4, fy = -10 - k * 22;
        ctx.moveTo(fx - 20, fy + 30); ctx.quadraticCurveTo(fx + 60, fy, fx + 70, fy - 60 + k * 8);
        ctx.lineWidth = 30; ctx.lineCap = 'round'; ctx.strokeStyle = C.skin; ctx.stroke();
      }
      ctx.beginPath(); ctx.moveTo(-60, 0); ctx.quadraticCurveTo(-40, -70, 10, -96); ctx.lineWidth = 34; ctx.strokeStyle = C.skin; ctx.stroke();   // thumb
      // warm rim light from the lantern
      ctx.globalCompositeOperation = 'lighter';
      ctx.beginPath(); ctx.ellipse(30, -20, 70, 40, -0.3, 0, TAU); ctx.fillStyle = 'rgba(201,130,74,0.35)'; ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  // ---------- text ----------
  function serif(str, x, y, size, color, a, o = {}) {
    if (a <= 0) return;
    ctx.save(); ctx.globalAlpha = a;
    ctx.font = `${o.italic ? 'italic 500' : '600'} ${size}px ${SERIF}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const w = ctx.measureText(str).width; ctx.translate(x, y); if (w > 960) ctx.scale(960 / w, 960 / w); if (o.scale) ctx.scale(o.scale, o.scale);
    ctx.shadowColor = 'rgba(255,170,80,0.55)'; ctx.shadowBlur = 30;
    ctx.fillStyle = color; ctx.fillText(str, 0, 0);
    ctx.shadowColor = 'rgba(5,10,40,0.5)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 3; ctx.fillText(str, 0, 0);
    ctx.restore();
  }
  function handText(str, x, y, size, color, write, a) {
    if (a <= 0 || write <= 0) return;
    ctx.save(); ctx.globalAlpha = a;
    ctx.font = `600 ${size}px ${HAND}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const w = Math.min(ctx.measureText(str).width, 980);
    ctx.beginPath(); ctx.rect(x - w / 2 - 10, y - size, (w + 20) * write, size * 2); ctx.clip();
    ctx.translate(x, y); const mw = ctx.measureText(str).width; if (mw > 980) ctx.scale(980 / mw, 980 / mw);
    ctx.shadowColor = 'rgba(255,170,80,0.6)'; ctx.shadowBlur = 26; ctx.fillStyle = color; ctx.fillText(str, 0, 0);
    ctx.shadowColor = 'rgba(5,10,40,0.55)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 3; ctx.fillText(str, 0, 0);
    ctx.restore();
  }

  // =====================================================================
  function render(t) {
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    // lantern states
    const heroes = TL.lanterns.map(L => {
      if (L.rise != null && t < L.rise) return null;
      const p = heldPose(L, t); return { L, ...p, l: lit(L, t) };
    }).filter(Boolean);
    const crowd = CROWD.map(c => { const p = crowdPos(c, t); return p ? { ...p, ph: c.ph } : null; }).filter(Boolean);
    const lights = [...heroes.map(h => ({ x: h.x, y: h.y, s: h.s, a: h.l })), ...crowd.map(c => ({ x: c.x, y: c.y, s: c.s * 3, a: 0.7 }))];

    sky(t);
    // far lanterns behind the hills' mist
    crowd.forEach(c => smallLantern(c.x, c.y, c.s, t, c.ph));
    hills(t);
    river(t, lights);
    // warmth grows as the sky fills
    const warm = 0.06 + 0.16 * P(t, 10, 38);
    const wg = ctx.createRadialGradient(540, 700, 100, 540, 700, 1200); wg.addColorStop(0, `rgba(255,170,80,${warm})`); wg.addColorStop(1, 'rgba(255,170,80,0)');
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = wg; ctx.fillRect(0, 0, W, H); ctx.restore();

    // released hero lanterns (behind the held one)
    heroes.filter(h => !h.held).forEach(h => lantern(h.x, h.y, h.s, h.l, t, { text: h.L.text, write: 1 }));
    reeds(t);
    // the lantern in hand + hands
    const held = heroes.find(h => h.held);
    let handA = 1, hdy = 0, spread = 0;
    const cur = TL.lanterns.find(L => t >= (L.rise ?? 0) && t < L.s + 6) || null;
    if (cur) {
      if (cur.rise != null && t < cur.rise + 0.6) hdy = lerp(540, 0, E.outCubic(P(t, cur.rise, cur.rise + 0.6)));
      if (t >= cur.release) { const p = E.inOut(P(t, cur.release + 0.1, cur.release + 1.2)); spread = 90 * p; hdy = 560 * E.inCubic(P(t, cur.release + 0.5, cur.release + 1.6)); }
    }
    if (t >= TL.END.sky) handA = 0;
    if (held) {
      const L = held.L;
      lantern(held.x, held.y + hdy * 0.0, held.s, held.l, t, { text: L.text, write: E.inOut(P(t, L.write[0], L.write[1])) });
    }
    hands(t, 0, hdy, spread, handA);
    // ignition flash (hook) + soft flare when a new lantern lights
    if (t < 0.6) { glow(540, 1420, 900 * (1 - t / 0.6) + 300, 1.2 * (1 - t / 0.6)); ctx.save(); ctx.globalAlpha = 0.16 * (1 - t / 0.25); if (t < 0.25) { ctx.fillStyle = '#FFE7BF'; ctx.fillRect(0, 0, W, H); } ctx.restore(); }
    TL.lanterns.forEach(L => { if (L.rise != null) { const a = 1 - P(t, L.rise + 0.3, L.rise + 1.1); if (t >= L.rise + 0.3 && a > 0) glow(540, 1430, 500, 0.6 * a); } });

    // ---- texts ----
    if (t < 4.3) {
      const a = 1 - E.inOut(P(t, TL.HOOK.textOut, 4.3));
      const sc = 1 + 0.04 * (1 - E.outCubic(P(t, 0, 0.5)));
      serif('5 hal yang boleh', 540, 300, 96, C.cream, a, { scale: sc });
      serif('kamu lepas hari ini.', 540, 420, 96, C.amberHot, a, { scale: sc });
    }
    TL.lanterns.forEach(L => {
      const [c0, c1] = L.caption;
      const a = E.outCubic(P(t, c0, c0 + 0.4)) * (1 - E.inOut(P(t, c1 - 0.5, c1)));
      const write = E.inOut(P(t, c0, c0 + 1.1));
      const lines = balanced(L.text, 900, 112);
      lines.forEach((ln, k) => handText(ln, 540, 330 + k * 108 - (lines.length - 1) * 30, 112, C.cream, clamp(write * lines.length - k), a));
      // small counter
      if (a > 0) { ctx.save(); ctx.globalAlpha = a * 0.75; ctx.font = `italic 500 34px ${SERIF}`; ctx.textAlign = 'center'; ctx.fillStyle = C.creamDim; ctx.fillText(`${L.i + 1} / 5`, 540, 200); ctx.restore(); }
    });
    const EN = TL.END;
    serif('kamu sudah berusaha.', 540, 320, 84, C.cream, E.inOut(P(t, EN.text1, EN.text1 + 1.2)), { italic: true });
    serif('istirahatlah sebentar.', 540, 430, 84, C.amberHot, E.inOut(P(t, EN.text2, EN.text2 + 1.2)), { italic: true });

    // grade: vignette + grain
    const v = ctx.createRadialGradient(W / 2, H * 0.45, H * 0.3, W / 2, H * 0.5, H * 0.8);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(4,8,30,0.5)');
    ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.globalAlpha = 0.04; ctx.globalCompositeOperation = 'overlay'; const f = Math.floor(t * 24);
    ctx.translate((f * 37) % 256, (f * 61) % 256); ctx.fillStyle = GRAIN; ctx.fillRect(-256, -256, W + 512, H + 512); ctx.restore();

    // watermark
    ctx.save(); ctx.globalAlpha = 0.2; ctx.font = `600 30px ${SERIF}`; ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#FFFFFF'; ctx.fillText('@taskkora__', W - 44, H - 52); ctx.restore();
    ctx.restore();
  }

  // ---------- runtime ----------
  window.TASKKORA = { render, ready, DURATION, W, H };
  const params = new URLSearchParams(location.search);
  if (params.has('render')) { document.body.classList.add('render'); return; }
  const btn = document.getElementById('play'), seek = document.getElementById('seek'), tl = document.getElementById('time');
  let playing = true, start = performance.now(), tNow = 0;
  if (params.has('t')) { tNow = parseFloat(params.get('t')); playing = false; btn.textContent = 'Play'; }
  btn.onclick = () => { playing = !playing; btn.textContent = playing ? 'Pause' : 'Play'; start = performance.now() - tNow * 1000; };
  seek.oninput = () => { tNow = parseFloat(seek.value); start = performance.now() - tNow * 1000; };
  ready.then(() => {
    const loop = () => {
      if (playing) tNow = ((performance.now() - start) / 1000) % DURATION;
      render(tNow); seek.value = tNow; tl.textContent = tNow.toFixed(2) + 's';
      requestAnimationFrame(loop);
    };
    loop();
  });
})();

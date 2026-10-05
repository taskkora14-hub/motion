/* "Tugas numpuk? Tarik napas 20 detik." — 40s, 1080x1920, calm box-breathing piece.
 * A square is traced side by side (inhale, hold, exhale, hold) while it swells and settles.
 * Every frame is a pure function of time; music.py uses the same timeline. */
(() => {
  'use strict';

  const W = 1080, H = 1920, DURATION = 40;
  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d');

  const C = {
    blue: '#184AA1', navy: '#081230', navy2: '#0D1C4A', white: '#F6F8FF', sky: '#A9C4FF',
    amber: '#FFB627', amberSoft: '#FFD27A',
  };
  const FONT = '"Sora", sans-serif';
  const f = (w, s) => `${w} ${s}px ${FONT}`;

  // ---------- timeline (shared with music.py) ----------
  const HOOK = 4, PHASE = 6, CYCLE0 = 4, CYCLE1 = CYCLE0 + 4 * PHASE; // 4 → 28
  const BUBBLE = 28.4, LOGO = 35;
  const PHASES = ['tarik', 'tahan', 'buang', 'tahan'];
  const CX = 540, CY = 1080, HALF = 210;

  // ---------- math ----------
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const P = (t, a, b) => clamp((t - a) / (b - a));
  const E = {
    inOutSine: x => -(Math.cos(Math.PI * x) - 1) / 2,
    outCubic: x => 1 - Math.pow(1 - x, 3),
    inOutCubic: x => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
    outBack: x => { const c1 = 1.4, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); },
  };
  const rnd = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const mix = (a, b, t) => { const A = hex(a), B = hex(b); return '#' + A.map((v, i) => Math.round(lerp(v, B[i], t)).toString(16).padStart(2, '0')).join(''); };

  // ---------- assets ----------
  const mark = new Image();
  const ready = Promise.all([
    new Promise((res, rej) => { mark.onload = res; mark.onerror = rej; mark.src = 'mark.png'; }),
    document.fonts.load(f(400, 40)), document.fonts.load(f(600, 40)), document.fonts.load(f(800, 40)),
  ]).then(() => document.fonts.ready);

  // soft glow sprite for particles
  const dot = (() => {
    const c = Object.assign(document.createElement('canvas'), { width: 64, height: 64 }), g = c.getContext('2d');
    const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.25, 'rgba(255,255,255,0.55)'); r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r; g.fillRect(0, 0, 64, 64); return c;
  })();
  const dotAmber = (() => {
    const c = Object.assign(document.createElement('canvas'), { width: 64, height: 64 }), g = c.getContext('2d');
    const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    r.addColorStop(0, 'rgba(255,230,170,1)'); r.addColorStop(0.3, 'rgba(255,182,39,0.55)'); r.addColorStop(1, 'rgba(255,182,39,0)');
    g.fillStyle = r; g.fillRect(0, 0, 64, 64); return c;
  })();

  // ---------- breath ----------
  // box scale: inhale grows, hold stays, exhale shrinks, hold stays
  function breath(t) {
    if (t < CYCLE0) return 1;
    if (t < CYCLE0 + PHASE) return lerp(1, 1.2, E.inOutSine(P(t, CYCLE0, CYCLE0 + PHASE)));
    if (t < CYCLE0 + 2 * PHASE) return 1.2 + 0.006 * Math.sin((t - 10) * 3);
    if (t < CYCLE0 + 3 * PHASE) return lerp(1.2, 0.92, E.inOutSine(P(t, CYCLE0 + 2 * PHASE, CYCLE0 + 3 * PHASE)));
    if (t < CYCLE1) return 0.92 + 0.004 * Math.sin((t - 22) * 3);
    return lerp(0.92, 1.16, E.inOutSine(P(t, CYCLE1, CYCLE1 + 2))) + 0.015 * Math.sin((t - 30) * Math.PI / 4) * P(t, 30, 31);
  }
  const calm = t => P(t, 4, 28); // background settles over the guided breath

  // ---------- background ----------
  const PARTS = Array.from({ length: 90 }, (_, i) => ({
    x: rnd(i) * W, y: rnd(i + 300) * H, z: 0.3 + rnd(i + 600) * 0.7, r: 6 + rnd(i + 900) * 18, amber: rnd(i + 1200) < 0.16, ph: rnd(i + 1500) * 6.28,
  }));
  // particle rise: starts at 42 px/s, slows to 16 px/s as the breath calms
  const rise = t => (t < 28 ? 42 * t - 13 * t * t / 28 : 812 + 16 * (t - 28));

  function background(t) {
    const k = calm(t), toBlue = E.inOutCubic(P(t, LOGO + 0.2, LOGO + 1.4));
    const top = mix(mix('#060E2A', '#0B1A47', k), C.blue, toBlue);
    const mid = mix(mix('#0D2263', '#123583', k), C.blue, toBlue);
    const bot = mix(mix('#163F92', '#1A4AA6', k), '#1D51B0', toBlue);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, top); g.addColorStop(0.55, mid); g.addColorStop(1, bot);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    // breathing aura behind the box
    const b = breath(t), amberHook = 1 - P(t, 3.5, 5);
    const auraR = 520 * b + 40 * Math.sin(t * 0.8);
    const ag = ctx.createRadialGradient(CX, CY, 0, CX, CY, auraR);
    ag.addColorStop(0, `rgba(140,180,255,${0.16 + 0.1 * (b - 0.92) / 0.28})`);
    ag.addColorStop(0.5, `rgba(60,110,220,${0.08})`);
    ag.addColorStop(1, 'rgba(24,74,161,0)');
    ctx.fillStyle = ag; ctx.fillRect(0, 0, W, H);
    if (amberHook > 0) {
      const hg = ctx.createRadialGradient(CX, CY - HALF, 0, CX, CY - HALF, 420);
      hg.addColorStop(0, `rgba(255,182,39,${0.16 * amberHook})`); hg.addColorStop(1, 'rgba(255,182,39,0)');
      ctx.fillStyle = hg; ctx.fillRect(0, 0, W, H);
    }

    // drifting light motes
    const rs = rise(t);
    ctx.globalCompositeOperation = 'lighter';
    for (const p of PARTS) {
      const y = ((p.y - rs * p.z) % (H + 100) + H + 100) % (H + 100) - 50;
      const x = p.x + Math.sin(t * 0.4 + p.ph) * 18 * p.z;
      const a = (0.25 + 0.35 * (0.5 + 0.5 * Math.sin(t * 1.3 + p.ph))) * p.z;
      const s = p.r * p.z;
      ctx.globalAlpha = a;
      ctx.drawImage(p.amber ? dotAmber : dot, x - s, y - s, s * 2, s * 2);
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';

    // soft vignette
    const v = ctx.createRadialGradient(W / 2, H * 0.55, H * 0.25, W / 2, H * 0.55, H * 0.75);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, `rgba(2,6,24,${0.45 - 0.15 * k})`);
    ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
  }

  // ---------- the box ----------
  // corners clockwise from top-left
  function corners(h) { return [[CX - h, CY - h], [CX + h, CY - h], [CX + h, CY + h], [CX - h, CY + h]]; }
  function pointAt(cs, u) { // u in [0,4]
    const k = Math.min(3, Math.floor(u)), f = u - k;
    const a = cs[k], b = cs[(k + 1) % 4];
    return [lerp(a[0], b[0], f), lerp(a[1], b[1], f)];
  }
  function pathTo(cs, u0, u1) {
    ctx.beginPath();
    const [sx, sy] = pointAt(cs, u0); ctx.moveTo(sx, sy);
    for (let k = Math.ceil(u0 + 1e-6); k < u1; k++) ctx.lineTo(...cs[k % 4]);
    ctx.lineTo(...pointAt(cs, u1));
  }
  function glowStroke(color, width, blur, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha; ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.shadowColor = color; ctx.shadowBlur = blur;
    ctx.stroke(); ctx.stroke();
    ctx.restore();
  }

  function box(t) {
    const out = P(t, LOGO, LOGO + 1.2);                  // morph into the logo
    if (out >= 1) return;
    const b = breath(t) * lerp(1, 0.55, E.inOutCubic(out));
    const h = HALF * b;
    const cs = corners(h);
    const glow = 0.55 + 0.45 * clamp((breath(t) - 0.92) / 0.28);
    const fade = 1 - E.inOutCubic(out);

    ctx.save();
    ctx.translate(CX, CY); ctx.rotate(E.inOutCubic(out) * Math.PI / 4); ctx.translate(-CX, -CY);

    // inner fill
    ctx.globalAlpha = fade;
    const ig = ctx.createRadialGradient(CX, CY, 0, CX, CY, h * 1.4);
    ig.addColorStop(0, `rgba(120,160,255,${0.1 + 0.08 * glow})`); ig.addColorStop(1, 'rgba(24,74,161,0.04)');
    ctx.fillStyle = ig; ctx.beginPath(); ctx.roundRect(CX - h, CY - h, 2 * h, 2 * h, 26); ctx.fill();
    ctx.globalAlpha = 1;

    // faint full outline (draws itself at the end of the hook)
    const outlineP = E.inOutCubic(P(t, 3.4, 4.6));
    if (outlineP > 0) { pathTo(cs, 0, 4 * outlineP); glowStroke(C.sky, 4, 14, (0.32 + 0.2 * glow) * fade); }

    if (t < CYCLE0 + 0.6) {
      // hook: amber light draws the first side; visible from frame 0
      const u = lerp(0.06, 1, E.outCubic(P(t, 0, 3.6)));
      const a = 1 - P(t, CYCLE0 - 0.1, CYCLE0 + 0.6);
      pathTo(cs, 0, u); glowStroke(C.amber, 9, 34, a);
      head(pointAt(cs, u), t, a);
    } else if (t < CYCLE1 + 0.01) {
      // guided breath: one side per phase
      const u = clamp((t - CYCLE0) / PHASE, 0, 4);
      pathTo(cs, 0, Math.max(0.001, u)); glowStroke(C.amber, 8, 30, 0.95 * fade);
      head(pointAt(cs, u), t, 1);
    } else {
      // completed square glows, then softens to white
      const w = P(t, CYCLE1, CYCLE1 + 2.2);
      const pulse = Math.exp(-(t - CYCLE1) * 2.2);
      pathTo(cs, 0, 4); ctx.closePath();
      glowStroke(mix('#FFB627', '#F6F8FF', E.inOutCubic(w)), 8 - 3 * w + 5 * pulse, 30 + 30 * pulse + 30 * out, fade);
    }
    // corner nodes
    cs.forEach(([x, y], k) => {
      const lit = t >= CYCLE0 + k * PHASE ? 1 : t < CYCLE0 && k <= 1 && (k === 0 || t > 3.5) ? 1 : 0.35;
      ctx.save(); ctx.globalAlpha = fade * lit; ctx.fillStyle = C.white; ctx.shadowColor = C.amberSoft; ctx.shadowBlur = 20;
      ctx.beginPath(); ctx.arc(x, y, 7, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    });
    ctx.restore();
  }
  function head([x, y], t, a) {
    ctx.save(); ctx.globalAlpha = a; ctx.globalCompositeOperation = 'lighter';
    const s = 90 + 12 * Math.sin(t * 5);
    ctx.drawImage(dotAmber, x - s / 2, y - s / 2, s, s);
    ctx.drawImage(dot, x - 18, y - 18, 36, 36);
    ctx.restore();
  }

  // ---------- text ----------
  function text(str, x, y, o = {}) {
    ctx.save();
    ctx.font = f(o.weight || 600, o.size || 60);
    ctx.letterSpacing = (o.spacing ?? -Math.round((o.size || 60) * 0.02)) + 'px';
    ctx.textAlign = o.align || 'center'; ctx.textBaseline = 'alphabetic';
    const w = ctx.measureText(str).width, max = o.maxW || 960;
    ctx.translate(x, y);
    if (w > max) ctx.scale(max / w, max / w);
    ctx.globalAlpha = o.alpha ?? 1;
    if (o.glow) { ctx.shadowColor = o.glow; ctx.shadowBlur = o.blur || 24; }
    else { ctx.shadowColor = 'rgba(2,6,30,0.45)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 4; }
    ctx.fillStyle = o.color || C.white;
    ctx.fillText(str, 0, 0);
    ctx.restore();
    return w;
  }
  // soft in/out alpha with a small rise
  function soft(str, t, t0, t1, y, o = {}) {
    const a = E.outCubic(P(t, t0, t0 + 0.9)) * (1 - E.inOutCubic(P(t, t1 - 0.8, t1)));
    if (a <= 0) return;
    text(str, W / 2, y + (1 - E.outCubic(P(t, t0, t0 + 1.2))) * 18, { ...o, alpha: a * (o.alpha ?? 1) });
  }

  function hookText(t) {
    if (t > 4.3) return;
    const out = E.inOutCubic(P(t, 3.6, 4.3));
    const settle = 1 + 0.05 * (1 - E.outCubic(P(t, 0, 0.35))); // already on screen at frame 0, just settles
    ctx.save();
    ctx.translate(W / 2, 520); ctx.scale(settle, settle); ctx.translate(-W / 2, -520);
    ctx.globalAlpha = 1 - out;
    text('tugas numpuk?', W / 2, 470, { weight: 800, size: 104, maxW: 940 });
    // second line: "tarik napas" white + "20 detik." amber
    ctx.font = f(800, 84); ctx.letterSpacing = '-2px';
    const a = 'tarik napas ', b2 = '20 detik.';
    const wa = ctx.measureText(a).width, wb = ctx.measureText(b2).width, sc = Math.min(1, 940 / (wa + wb));
    const x0 = W / 2 - (wa + wb) * sc / 2;
    ctx.save(); ctx.translate(x0, 590); ctx.scale(sc, sc);
    ctx.shadowColor = 'rgba(2,6,30,0.45)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 4;
    ctx.textAlign = 'left'; ctx.fillStyle = C.white; ctx.fillText(a, 0, 0);
    ctx.fillStyle = C.amber; ctx.shadowColor = 'rgba(255,182,39,0.45)'; ctx.shadowBlur = 26; ctx.shadowOffsetY = 0; ctx.fillText(b2, wa, 0);
    ctx.restore();
    ctx.restore();
  }

  function guide(t) {
    if (t < CYCLE0 - 0.2 || t > CYCLE1 + 0.8) return;
    const k = Math.min(3, Math.max(0, Math.floor((t - CYCLE0) / PHASE)));
    const t0 = CYCLE0 + k * PHASE, t1 = t0 + PHASE;
    const a = E.outCubic(P(t, t0 - 0.2, t0 + 0.5)) * (k === 3 ? 1 - P(t, CYCLE1 - 0.35, CYCLE1 + 0.05) : 1 - P(t, t1 - 0.35, t1 - 0.05));
    const b = breath(t);
    text(PHASES[k], CX, CY - 24, { weight: 600, size: 76 * Math.sqrt(b), alpha: a, spacing: 2 });
    // count 1..4 (1.5 s each) + four dots
    const c = Math.min(3, Math.floor((t - t0) / (PHASE / 4)));
    const cf = (t - t0) % (PHASE / 4);
    if (t >= t0) {
      const pop = 1 + 0.12 * Math.exp(-cf * 6);
      ctx.save(); ctx.translate(CX, CY + 76); ctx.scale(pop, pop);
      text(String(c + 1), 0, 0, { weight: 400, size: 66, color: C.amberSoft, alpha: a * 0.95, glow: 'rgba(255,182,39,0.5)' });
      ctx.restore();
      for (let i = 0; i < 4; i++) {
        ctx.save(); ctx.globalAlpha = a * (i <= c ? 0.95 : 0.3); ctx.fillStyle = i <= c ? C.amber : C.white;
        ctx.beginPath(); ctx.arc(CX - 45 + i * 30, CY + 118, 6, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      }
    }
  }

  // ---------- mintask bubble ----------
  function bubble(t) {
    const a = E.outCubic(P(t, BUBBLE, BUBBLE + 1.0)) * (1 - E.inOutCubic(P(t, LOGO - 0.1, LOGO + 0.6)));
    if (a <= 0) return;
    const s = lerp(0.92, 1, E.outBack(P(t, BUBBLE, BUBBLE + 1.1)));
    const bw = 448, bh = 236, x = CX - bw / 2, y = CY - bh / 2 - 6 - (1 - a) * 20;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(CX, CY); ctx.scale(s, s); ctx.translate(-CX, -CY);
    ctx.shadowColor = 'rgba(4,12,50,0.45)'; ctx.shadowBlur = 50; ctx.shadowOffsetY = 16;
    ctx.fillStyle = 'rgba(246,248,255,0.96)';
    ctx.beginPath(); ctx.roundRect(x, y, bw, bh, 40); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x + 46, y + bh - 2); ctx.lineTo(x + 30, y + bh + 30); ctx.lineTo(x + 92, y + bh - 2); ctx.fill();
    ctx.shadowColor = 'transparent';
    // avatar + name
    ctx.fillStyle = C.blue; ctx.beginPath(); ctx.arc(x + 54, y + 52, 24, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = C.white; ctx.lineWidth = 4.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(x + 43, y + 53); ctx.lineTo(x + 51, y + 61); ctx.lineTo(x + 66, y + 44); ctx.stroke();
    ctx.font = f(600, 28); ctx.letterSpacing = '0px'; ctx.textAlign = 'left'; ctx.fillStyle = C.blue; ctx.fillText('mintask', x + 90, y + 50);
    ctx.font = f(400, 21); ctx.fillStyle = 'rgba(24,74,161,0.6)'; ctx.fillText('online', x + 90, y + 76);
    ctx.fillStyle = '#39C07A'; ctx.beginPath(); ctx.arc(x + 165, y + 69, 5, 0, Math.PI * 2); ctx.fill();
    // typing dots, then the message
    const msg = t >= BUBBLE + 1.5;
    if (!msg) {
      for (let i = 0; i < 3; i++) {
        const j = Math.sin((t - BUBBLE) * 7 - i * 0.9) * 0.5 + 0.5;
        ctx.fillStyle = `rgba(24,74,161,${0.3 + 0.5 * j})`;
        ctx.beginPath(); ctx.arc(x + 46 + i * 26, y + 140 - j * 6, 8, 0, Math.PI * 2); ctx.fill();
      }
    } else {
      const ma = E.outCubic(P(t, BUBBLE + 1.5, BUBBLE + 2.1));
      ctx.globalAlpha = a * ma;
      ctx.font = f(600, 40); ctx.letterSpacing = '-0.5px'; ctx.fillStyle = '#0B1640';
      ctx.fillText('yang berat,', x + 36, y + 148 + (1 - ma) * 8);
      ctx.fillText('kami bantu ambil.', x + 36, y + 200 + (1 - ma) * 8);
    }
    ctx.restore();
  }

  // ---------- logo ----------
  function logo(t) {
    const p = P(t, LOGO + 0.6, LOGO + 1.8);
    if (p <= 0) return;
    const size = 400, cy = 1000 - 0;
    const s = lerp(0.8, 1, E.outBack(p)) * (1 + 0.012 * Math.sin((t - 36) * 2.2));
    const flash = Math.exp(-Math.max(0, t - LOGO - 0.9) * 2.5);
    ctx.save();
    // glow behind
    const g = ctx.createRadialGradient(CX, cy, 0, CX, cy, 420);
    g.addColorStop(0, `rgba(255,255,255,${0.22 * p + 0.25 * flash})`); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, cy - 500, W, 1000);
    ctx.globalAlpha = E.outCubic(p);
    ctx.translate(CX, cy); ctx.scale(s, s);
    ctx.shadowColor = `rgba(255,255,255,${0.6 + 0.4 * flash})`; ctx.shadowBlur = 40 + 40 * flash;
    ctx.drawImage(mark, -size / 2, -size / 2, size, size);
    ctx.shadowBlur = 0; ctx.drawImage(mark, -size / 2, -size / 2, size, size);
    ctx.restore();
    soft('ada task?', t, LOGO + 1.8, 99, 1370, { weight: 800, size: 88, color: C.amber, glow: 'rgba(255,182,39,0.35)' });
    soft('taskkora-in aja.', t, LOGO + 2.3, 99, 1475, { weight: 800, size: 88 });
  }

  // =====================================================================
  function render(t) {
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.letterSpacing = '0px';
    background(t);
    box(t);
    hookText(t);
    guide(t);
    soft('satu hal dulu.', t, 6.5, 14.8, 600, { weight: 400, size: 62, alpha: 0.92 });
    soft('bukan semuanya sekaligus.', t, 16.5, 26.6, 600, { weight: 400, size: 62, alpha: 0.92 });
    bubble(t);
    logo(t);
    // watermark
    ctx.save(); ctx.globalAlpha = 0.25; ctx.font = f(600, 30); ctx.letterSpacing = '0.5px';
    ctx.textAlign = 'right'; ctx.fillStyle = '#FFFFFF'; ctx.fillText('@taskkora__', W - 48, H - 60); ctx.restore();
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

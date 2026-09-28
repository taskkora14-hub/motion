/* "Kenapa Kita Sering Menunda Tugas?" — 40s educational motion piece, 1080x1920.
 * Each frame is a pure function of time: render(t). Shared by live preview and export. */
(() => {
  'use strict';

  const W = 1080, H = 1920, DURATION = 40;
  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d');

  const C = {
    bg0: '#070B16', bg1: '#101A33', paper: '#F4EFE6', dim: 'rgba(244,239,230,0.55)', faint: 'rgba(244,239,230,0.14)',
    amber: '#FFB84D', red: '#FF5E5B', teal: '#5EEAD4', tealD: '#1F8F82',
    slab: '#1B2645', slabTop: '#2C3B68', slabSide: '#131C36',
  };
  const FONT = '"Sora", sans-serif';

  // ---------- math ----------
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const P = (t, a, b) => clamp((t - a) / (b - a));
  const TAU = Math.PI * 2;
  const E = {
    outCubic: x => 1 - Math.pow(1 - x, 3),
    inCubic: x => x * x * x,
    inOutCubic: x => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
    outExpo: x => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x)),
    inExpo: x => (x <= 0 ? 0 : Math.pow(2, 10 * x - 10)),
    inOutExpo: x => (x <= 0 ? 0 : x >= 1 ? 1 : x < 0.5 ? Math.pow(2, 20 * x - 10) / 2 : (2 - Math.pow(2, -20 * x + 10)) / 2),
    outBack: x => { const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); },
    outBounce: x => { const n = 7.5625, d = 2.75; if (x < 1 / d) return n * x * x; if (x < 2 / d) return n * (x -= 1.5 / d) * x + 0.75; if (x < 2.5 / d) return n * (x -= 2.25 / d) * x + 0.9375; return n * (x -= 2.625 / d) * x + 0.984375; },
  };
  const bump = (t, a, b) => Math.sin(P(t, a, b) * Math.PI);
  // deterministic pseudo-random
  const rnd = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

  // ---------- assets ----------
  const logo = new Image();
  const ready = Promise.all([
    new Promise((res, rej) => { logo.onload = res; logo.onerror = rej; logo.src = 'logo.png'; }),
    document.fonts.load(`800 40px ${FONT}`), document.fonts.load(`600 40px ${FONT}`), document.fonts.load(`400 40px ${FONT}`),
  ]).then(() => document.fonts.ready);

  // film grain tiles (seeded, so every export is identical)
  const grain = [0, 1, 2, 3].map(k => {
    const g = document.createElement('canvas'); g.width = 360; g.height = 640;
    const gx = g.getContext('2d'), id = gx.createImageData(360, 640);
    let s = 1234 + k * 999;
    for (let i = 0; i < id.data.length; i += 4) {
      s = (s * 16807) % 2147483647; const v = (s / 2147483647) * 255;
      id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255;
    }
    gx.putImageData(id, 0, 0); return g;
  });

  // ---------- helpers ----------
  const font = (w, s) => `${w} ${s}px ${FONT}`;
  function rr(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
  function circle(x, y, r, fill) { ctx.beginPath(); ctx.arc(x, y, Math.max(0, r), 0, TAU); ctx.fillStyle = fill; ctx.fill(); }
  function line(x1, y1, x2, y2, c, w) { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.strokeStyle = c; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.stroke(); }
  function drawCheck(x, y, s, c, w, p = 1) {
    ctx.save(); ctx.beginPath(); ctx.moveTo(x - s * 0.36, y + s * 0.02); ctx.lineTo(x - s * 0.1, y + s * 0.28); ctx.lineTo(x + s * 0.38, y - s * 0.26);
    const L = s * 1.1; ctx.setLineDash([L, L]); ctx.lineDashOffset = L * (1 - p);
    ctx.strokeStyle = c; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke(); ctx.restore();
  }
  function glow(c, b) { ctx.shadowColor = c; ctx.shadowBlur = b; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0; }
  function noGlow() { ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; }

  /* Kinetic line. Words rise out of a mask with a short focus-pull (blur -> sharp).
   * o: size, weight, color, align('center'|'left'), stagger, dur, out (exit time), hl {wordIdx: color}, spacing, blur */
  function kLine(text, x, y, t, t0, o = {}) {
    const size = o.size || 90, weight = o.weight || 800, stagger = o.stagger ?? 0.08, dur = o.dur || 0.75;
    ctx.save();
    ctx.font = font(weight, size); ctx.letterSpacing = (o.spacing ?? -Math.round(size * 0.03)) + 'px';
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    const words = text.split(' '), sp = ctx.measureText(' ').width * 0.9;
    const ws = words.map(w => ctx.measureText(w).width);
    const total = ws.reduce((a, b) => a + b, 0) + sp * (words.length - 1);
    let cx = o.align === 'left' ? x : x - total / 2;
    const pos = [];
    for (let i = 0; i < words.length; i++) {
      const a = t0 + i * stagger, pin = E.outExpo(P(t, a, a + dur));
      const pout = o.out != null ? E.inCubic(P(t, o.out + i * stagger * 0.5, o.out + i * stagger * 0.5 + 0.4)) : 0;
      pos.push([cx, ws[i]]);
      if (pin > 0 && pout < 1) {
        ctx.save();
        ctx.beginPath(); ctx.rect(cx - size, y - size * 1.05, ws[i] + size * 2, size * 1.45); ctx.clip();
        const dy = (1 - pin) * size * 1.1 - pout * size * 1.1;
        const bl = (o.blur ?? 10) * (1 - pin) + 10 * pout;
        if (bl > 0.3) ctx.filter = `blur(${bl.toFixed(1)}px)`;
        ctx.globalAlpha *= clamp(pin * 1.4) * (1 - pout);
        ctx.fillStyle = (o.hl && o.hl[i]) || o.color || C.paper;
        ctx.fillText(words[i], cx, y + dy);
        ctx.restore();
      }
      cx += ws[i] + sp;
    }
    ctx.restore();
    return { total, pos };
  }
  function tag(text, x, y, t, t0, o = {}) {
    const p = E.outBack(P(t, t0, t0 + 0.5)), out = o.out != null ? E.inCubic(P(t, o.out, o.out + 0.3)) : 0;
    if (p <= 0 || out >= 1) return;
    ctx.save(); ctx.font = font(600, o.size || 34); ctx.letterSpacing = '4px';
    const tw = ctx.measureText(text).width, h = (o.size || 34) * 1.9, w = tw + (o.size || 34) * 1.6;
    ctx.translate(x, y); ctx.scale(p, p); ctx.globalAlpha *= clamp(p) * (1 - out);
    rr(-w / 2, -h / 2, w, h, h / 2);
    if (o.fill) { ctx.fillStyle = o.fill; ctx.fill(); } else { ctx.strokeStyle = o.color || C.amber; ctx.lineWidth = 3; ctx.stroke(); }
    ctx.fillStyle = o.fill ? C.bg0 : (o.color || C.amber); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, 2, 2); ctx.restore();
  }

  // ---------- atmosphere ----------
  function background(t, warm = 0) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, lerpColor('#0A1024', '#0B1E2A', warm)); g.addColorStop(1, C.bg0);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // drifting spotlight
    const sx = 540 + Math.sin(t * 0.3) * 160, sy = 820 + Math.cos(t * 0.23) * 120;
    const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, 950);
    const sc = warm > 0.5 ? '94,234,212' : '120,150,255';
    sg.addColorStop(0, `rgba(${sc},${0.13 + warm * 0.05})`); sg.addColorStop(1, `rgba(${sc},0)`);
    ctx.fillStyle = sg; ctx.fillRect(0, 0, W, H);
    // dust particles
    for (let i = 0; i < 26; i++) {
      const x = (rnd(i) * W + Math.sin(t * 0.2 + i) * 30) % W;
      const y = ((rnd(i + 50) * H - t * (8 + rnd(i + 9) * 16)) % H + H) % H;
      circle(x, y, 1.5 + rnd(i + 3) * 2.5, `rgba(244,239,230,${0.05 + rnd(i + 7) * 0.08})`);
    }
  }
  function lerpColor(a, b, t) {
    const pa = [1, 3, 5].map(i => parseInt(a.slice(i, i + 2), 16)), pb = [1, 3, 5].map(i => parseInt(b.slice(i, i + 2), 16));
    return `rgb(${pa.map((v, i) => Math.round(lerp(v, pb[i], t))).join(',')})`;
  }
  function finish(t) {
    // vignette
    const v = ctx.createRadialGradient(540, 960, 500, 540, 960, 1250);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
    // grain
    ctx.save(); ctx.globalAlpha = 0.045; ctx.globalCompositeOperation = 'overlay';
    ctx.drawImage(grain[Math.floor(t * 24) % 4], 0, 0, W, H); ctx.restore();
    // watermark (logo image used as-is, small, top-right)
    const wa = P(t, 0.8, 1.6) * 0.85;
    if (wa > 0) {
      const s = 78, x = W - 64 - s, y = 150;
      ctx.save(); ctx.globalAlpha = wa;
      glow('rgba(0,0,0,0.35)', 20);
      rr(x, y, s, s, 18); ctx.fillStyle = '#004FC6'; ctx.fill(); noGlow();
      ctx.beginPath(); ctx.roundRect(x, y, s, s, 18); ctx.clip();
      ctx.drawImage(logo, x, y, s, s); ctx.restore();
    }
    // global fade in / out
    const f = 1 - P(t, 0, 0.35) + P(t, 39.55, 40);
    if (f > 0) { ctx.fillStyle = `rgba(0,0,0,${clamp(f)})`; ctx.fillRect(0, 0, W, H); }
  }
  function scrim() {
    const g = ctx.createLinearGradient(0, 0, 0, 700);
    g.addColorStop(0, 'rgba(7,11,22,0.85)'); g.addColorStop(0.75, 'rgba(7,11,22,0.55)'); g.addColorStop(1, 'rgba(7,11,22,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, 700);
  }
  function withCam(fx, fy, s, fn, tx = 540, ty = 960) {
    ctx.save(); ctx.translate(tx, ty); ctx.scale(s, s); ctx.translate(-fx, -fy); fn(); ctx.restore();
  }

  // ---------- characters & props ----------
  // Minimal capsule figure. (x, y) = feet on the ground.
  function person(x, y, s = 1, o = {}) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    // ground shadow
    ctx.save(); ctx.scale(1, 0.25); circle(0, 0, 60 * (o.shadowS ?? 1), 'rgba(0,0,0,0.35)'); ctx.restore();
    ctx.translate(0, -(o.lift || 0));
    ctx.rotate(o.lean || 0);
    const col = o.color || C.paper;
    const squash = o.squash || 0;
    ctx.scale(1 + squash * 0.15, 1 - squash * 0.15);
    // arms
    const armL = o.armL ?? 0.25, armR = o.armR ?? -0.25;
    ctx.save(); ctx.translate(-24, -108); ctx.rotate(armL); rr(-9, -9, 18, 70, 9); ctx.fillStyle = o.armColor || '#CFC8BA'; ctx.fill(); ctx.restore();
    ctx.save(); ctx.translate(24, -108); ctx.rotate(armR); rr(-9, -9, 18, 70, 9); ctx.fillStyle = o.armColor || '#CFC8BA'; ctx.fill(); ctx.restore();
    rr(-32, -128, 64, 128, 32); ctx.fillStyle = col; ctx.fill();
    circle(o.lookX || 0, -160 + (o.lookY || 0), 28, col);
    ctx.restore();
  }
  // Pseudo-3D slab. (cx, gy) = bottom-centre of the front face.
  function slab(cx, gy, w, h, o = {}) {
    const d = o.depth ?? 70, x = cx - w / 2, y = gy - h;
    // top & side faces
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + d, y - d * 0.6); ctx.lineTo(x + w + d, y - d * 0.6); ctx.lineTo(x + w, y); ctx.closePath();
    ctx.fillStyle = o.top || C.slabTop; ctx.fill();
    ctx.beginPath(); ctx.moveTo(x + w, y); ctx.lineTo(x + w + d, y - d * 0.6); ctx.lineTo(x + w + d, gy - d * 0.6); ctx.lineTo(x + w, gy); ctx.closePath();
    ctx.fillStyle = o.side || C.slabSide; ctx.fill();
    const g = ctx.createLinearGradient(0, y, 0, gy); g.addColorStop(0, o.front || '#24315A'); g.addColorStop(1, o.front2 || C.slab);
    ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
    if (o.edge) { ctx.strokeStyle = o.edge; ctx.lineWidth = 3; ctx.strokeRect(x, y, w, h); }
  }
  function taskFace(cx, gy, w, h, a = 1) {
    // document-like skeleton on the big task slab
    if (a <= 0) return;
    ctx.save(); ctx.globalAlpha *= a;
    const x = cx - w / 2 + 60, y = gy - h + 80;
    ctx.font = font(800, 92); ctx.letterSpacing = '14px'; ctx.fillStyle = 'rgba(244,239,230,0.9)'; ctx.textBaseline = 'top'; ctx.fillText('TUGAS', x, y);
    for (let i = 0; i < 12; i++) {
      const ly = y + 150 + i * 56; if (ly > gy - 60) break;
      rr(x, ly, (w - 120) * (0.45 + rnd(i + 20) * 0.55), 16, 8); ctx.fillStyle = 'rgba(244,239,230,0.13)'; ctx.fill();
    }
    ctx.restore();
  }

  // =====================================================================
  // 1. HOOK  (0 – 4.6)
  // =====================================================================
  function sHook(t) {
    background(t);
    const push = E.inExpo(P(t, 3.9, 4.6));
    ctx.save(); ctx.translate(540, 960); ctx.scale(1 + push * 1.8, 1 + push * 1.8); ctx.translate(-540, -960);
    ctx.globalAlpha = 1 - P(t, 4.2, 4.6);
    kLine('Bukan karena', 540, 830, t, 0.35, { size: 84, weight: 600, color: C.dim });
    const l2 = kLine('kamu malas.', 540, 1000, t, 0.9, { size: 150, stagger: 0.18, hl: { 1: C.amber } });
    // strike-through "malas."
    const sp = E.inOutCubic(P(t, 2.0, 2.45));
    if (sp > 0) {
      const [mx, mw] = l2.pos[1];
      ctx.save(); glow('rgba(255,94,91,0.6)', 18);
      line(mx - 10, 955, mx - 10 + (mw + 20) * sp, 935, C.red, 14); ctx.restore();
    }
    kLine('Ada alasan lain.', 540, 1170, t, 2.7, { size: 56, weight: 400, color: C.dim, stagger: 0.06 });
    ctx.restore();
  }

  // =====================================================================
  // 2. THE BIG TASK  (4.6 – 11)
  // =====================================================================
  const S2 = { px: 300, gy: 1560, bx: 610, bw: 620, bh: 900 };
  function sBig(t) {
    background(t);
    const rise = E.outBounce(P(t, 4.9, 6.3));
    const bh = S2.bh * rise;
    const shake = bump(t, 6.0, 6.5) * 10;
    const zo = E.inOutCubic(P(t, 4.6, 7.4));
    const zin = E.inExpo(P(t, 10.3, 11.0));
    let s = lerp(2.3, 1, zo), fx = lerp(S2.px + 40, 540, zo), fy = lerp(1410, 1010, zo);
    s = s * (1 + zin * 7); fx = lerp(fx, S2.bx, zin); fy = lerp(fy, S2.gy - 450, zin);
    withCam(fx + Math.sin(t * 60) * shake, fy + Math.cos(t * 53) * shake, s, () => {
      // ground line
      line(-400, S2.gy, 1480, S2.gy, 'rgba(244,239,230,0.12)', 3);
      // block's shadow over the scene
      if (bh > 0) {
        ctx.save(); const sg = ctx.createLinearGradient(S2.bx - 500, 0, S2.bx, 0);
        sg.addColorStop(0, 'rgba(0,0,0,0)'); sg.addColorStop(1, `rgba(0,0,0,${0.45 * rise})`);
        ctx.fillStyle = sg; ctx.beginPath(); ctx.moveTo(S2.bx - S2.bw / 2, S2.gy); ctx.lineTo(S2.bx - S2.bw / 2 - 520 * rise, S2.gy + 40); ctx.lineTo(S2.bx - S2.bw / 2, S2.gy - bh); ctx.fill(); ctx.restore();
        slab(S2.bx, S2.gy, S2.bw, bh, { depth: 90 });
        ctx.save(); ctx.beginPath(); ctx.rect(S2.bx - S2.bw / 2, S2.gy - bh, S2.bw, bh); ctx.clip(); taskFace(S2.bx, S2.gy, S2.bw, S2.bh, 1); ctx.restore();
        // deadline tag
        const dp = E.outBack(P(t, 6.9, 7.4));
        if (dp > 0) {
          ctx.save(); ctx.translate(S2.bx + S2.bw / 2 - 40, S2.gy - bh + 60); ctx.rotate(0.12); ctx.scale(dp, dp);
          rr(-150, -36, 300, 72, 14); ctx.fillStyle = C.red; ctx.fill();
          ctx.font = font(800, 32); ctx.letterSpacing = '2px'; ctx.fillStyle = C.paper; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('DEADLINE', 0, 2); ctx.restore();
        }
      }
      // the person looks up, a little startled
      const look = E.inOutCubic(P(t, 5.6, 6.4));
      const jump = bump(t, 6.05, 6.35) * 26;
      person(S2.px, S2.gy, 1, { lookX: look * 8, lookY: -look * 6, lift: jump, lean: -look * 0.08, armL: 0.25 + look * 0.3, armR: -0.25 - look * 0.1 });
      const ex = E.outBack(P(t, 7.5, 7.8)) * (1 - P(t, 9.6, 9.9));
      if (ex > 0) { ctx.save(); ctx.translate(S2.px + 20, S2.gy - 250); ctx.scale(ex, ex); ctx.font = font(800, 70); ctx.fillStyle = C.amber; ctx.textAlign = 'center'; ctx.fillText('!', 0, 0); ctx.restore(); }
    });
    // screen-space text over a soft scrim
    scrim();
    ctx.save(); ctx.globalAlpha = 1 - zin;
    kLine('Satu tugas…', 540, 330, t, 5.3, { size: 76, weight: 600, color: C.dim, out: 10.1 });
    kLine('terasa sebesar ini.', 540, 460, t, 6.5, { size: 104, hl: { 1: C.amber, 2: C.amber }, out: 10.15 });
    ctx.restore();
  }

  // =====================================================================
  // 3. THREE CAUSES  (11 – 26)
  // =====================================================================
  const CAUSES = [
    { n: '01', a: 'Terasa', b: 'terlalu besar', t0: 11.0, draw: cBig },
    { n: '02', a: 'Bingung mulai', b: 'dari mana', t0: 16.0, draw: cLost },
    { n: '03', a: 'Takut hasilnya', b: 'salah', t0: 21.0, draw: cFear },
  ];
  function cBig(t, lt) {
    const gy = 1420;
    // heartbeat that speeds up
    const rate = lerp(1.1, 2.4, P(lt, 0, 4.5));
    const phase = (lt * rate) % 1;
    const beat = Math.exp(-phase * 9);
    const grow = lerp(560, 860, E.inOutCubic(P(lt, 0.2, 4.5))) * (1 + beat * 0.03);
    const w = 520 * (1 + beat * 0.02);
    // pressure rings from the block
    for (let k = 0; k < 3; k++) {
      const rp = ((lt * rate + k / 3) % 1);
      ctx.beginPath(); ctx.arc(540, gy - grow / 2, 300 + rp * 420, 0, TAU); ctx.strokeStyle = `rgba(255,94,91,${0.12 * (1 - rp)})`; ctx.lineWidth = 3; ctx.stroke();
    }
    slab(540, gy, w, grow, { depth: 70 });
    ctx.save(); ctx.beginPath(); ctx.rect(540 - w / 2, gy - grow, w, grow); ctx.clip(); taskFace(540, gy, w, grow, 0.8); ctx.restore();
    // person shrinks in front of it
    const ps = lerp(0.95, 0.62, E.inOutCubic(P(lt, 0.2, 4.5)));
    line(40, gy, 1040, gy, 'rgba(244,239,230,0.12)', 3);
    person(540, gy + 110, ps, { lookY: -8, armL: 0.15, armR: -0.15, shadowS: 1 });
    // ECG line
    ctx.save(); ctx.beginPath();
    const y0 = 1640;
    for (let x = 90; x <= 990; x += 4) {
      const u = (x - 90) / 900, tt2 = lt * rate - u * 2.2, ph = ((tt2 % 1) + 1) % 1;
      let v = 0;
      if (ph < 0.06) v = -Math.sin(ph / 0.06 * Math.PI) * 18;
      else if (ph < 0.12) v = Math.sin((ph - 0.06) / 0.06 * Math.PI) * 90;
      else if (ph < 0.18) v = -Math.sin((ph - 0.12) / 0.06 * Math.PI) * 40;
      const env = clamp(P(lt, 0, 0.6) * 1.2 - u * 0.2);
      ctx.lineTo(x, y0 - v * env);
    }
    glow('rgba(255,94,91,0.7)', 14); ctx.strokeStyle = C.red; ctx.lineWidth = 5; ctx.lineJoin = 'round'; ctx.stroke(); ctx.restore();
  }
  function cLost(t, lt) {
    const px = 540, py = 1300;
    const ends = [[150, 820], [880, 760], [120, 1180], [960, 1120], [260, 1560], [830, 1560], [540, 700], [640, 1640]];
    ends.forEach(([ex, ey], i) => {
      const p = E.inOutCubic(P(lt, 0.3 + i * 0.18, 1.3 + i * 0.18));
      if (p <= 0) return;
      ctx.save(); ctx.beginPath();
      const sx = px, sy = py - 90, n = 60;
      for (let k = 0; k <= n * p; k++) {
        const u = k / n;
        const bx = lerp(sx, ex, u) + Math.sin(u * Math.PI * (2 + i % 3)) * 90 * (i % 2 ? 1 : -1) * Math.sin(u * Math.PI);
        const by = lerp(sy, ey, u) + Math.cos(u * Math.PI * 3 + i) * 50 * Math.sin(u * Math.PI);
        k === 0 ? ctx.moveTo(bx, by) : ctx.lineTo(bx, by);
      }
      ctx.setLineDash([2, 16]); ctx.lineDashOffset = -lt * 40; ctx.strokeStyle = 'rgba(244,239,230,0.45)'; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.stroke(); ctx.restore();
      const q = E.outBack(P(lt, 1.2 + i * 0.18, 1.6 + i * 0.18));
      if (q > 0) {
        ctx.save(); ctx.translate(ex, ey + Math.sin(t * 2 + i) * 6); ctx.scale(q, q);
        circle(0, 0, 38, i === 3 ? C.amber : 'rgba(244,239,230,0.12)');
        ctx.font = font(800, 44); ctx.fillStyle = i === 3 ? C.bg0 : C.paper; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('?', 0, 3); ctx.restore();
      }
    });
    // person turning its head left/right
    const look = Math.sin(lt * 3.2) * 12 * P(lt, 0.8, 1.4);
    person(px, py + 120, 0.95, { lookX: look, armL: 0.5 + Math.sin(lt * 3) * 0.1, armR: -0.5 });
    // loading spinner above the head
    const sp = P(lt, 1.0, 1.4);
    if (sp > 0) {
      ctx.save(); ctx.globalAlpha *= sp; ctx.translate(px, py - 150); ctx.rotate(lt * 5);
      ctx.beginPath(); ctx.arc(0, 0, 34, 0, TAU * 0.72); ctx.strokeStyle = C.amber; ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.stroke(); ctx.restore();
    }
  }
  function cFear(t, lt) {
    const cx = 590, cy = 1080, w = 440, h = 560;
    // writing -> X stamp -> erase, twice
    const cycles = [[0.3, 1.5, 1.7, 2.3], [2.5, 3.3, 3.5, 4.1]];
    let lines = 0, xA = 0, xS = 1, shake = 0;
    cycles.forEach(([w0, w1, x0, e1]) => {
      if (lt >= w0 && lt < x0 + 0.05) lines = Math.max(lines, P(lt, w0, w1));
      if (lt >= x0 && lt < e1) { lines = 1 - E.inCubic(P(lt, x0 + 0.3, e1)); }
      const xa = E.outCubic(P(lt, x0, x0 + 0.12)) * (1 - P(lt, e1 - 0.2, e1));
      if (xa > xA) { xA = xa; xS = lerp(1.7, 1, E.outCubic(P(lt, x0, x0 + 0.15))); }
      shake = Math.max(shake, bump(lt, x0 + 0.08, x0 + 0.4));
    });
    const jx = Math.sin(lt * 70) * 10 * shake, jy = Math.cos(lt * 61) * 8 * shake;
    // looming blurred X behind
    ctx.save(); ctx.globalAlpha = 0.18 + 0.2 * xA; ctx.filter = 'blur(22px)';
    ctx.translate(540, 1000); ctx.rotate(0.1); ctx.strokeStyle = C.red; ctx.lineWidth = 80; ctx.lineCap = 'round';
    line(-330, -330, 330, 330, C.red, 80); line(330, -330, -330, 330, C.red, 80); ctx.restore();
    // paper
    ctx.save(); ctx.translate(cx + jx, cy + jy); ctx.rotate(-0.04);
    ctx.save(); glow('rgba(0,0,0,0.5)', 40); rr(-w / 2, -h / 2, w, h, 18); ctx.fillStyle = C.paper; ctx.fill(); ctx.restore();
    const n = 8, shown = lines * n;
    for (let i = 0; i < n; i++) {
      const f = clamp(shown - i); if (f <= 0) break;
      const lw = (w - 110) * (0.55 + rnd(i + 70) * 0.45) * f;
      rr(-w / 2 + 55, -h / 2 + 80 + i * 54, lw, 14, 7); ctx.fillStyle = 'rgba(16,26,51,0.55)'; ctx.fill();
    }
    // pencil tip following the current line
    if (lines > 0 && lines < 1) {
      const i = Math.min(n - 1, Math.floor(shown)), f = shown - i;
      const px = -w / 2 + 55 + (w - 110) * (0.55 + rnd(i + 70) * 0.45) * f, py = -h / 2 + 80 + i * 54;
      ctx.save(); ctx.translate(px, py); ctx.rotate(0.6);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-12, -30); ctx.lineTo(12, -30); ctx.closePath(); ctx.fillStyle = '#E8C9A0'; ctx.fill();
      rr(-12, -150, 24, 122, 5); ctx.fillStyle = C.amber; ctx.fill(); ctx.restore();
    }
    // X stamp
    if (xA > 0) {
      ctx.save(); ctx.globalAlpha *= xA; ctx.scale(xS, xS); glow('rgba(255,94,91,0.6)', 30);
      line(-140, -140, 140, 140, C.red, 42); line(140, -140, -140, 140, C.red, 42); ctx.restore();
    }
    ctx.restore();
    // small, hesitant person
    const tremble = Math.sin(lt * 40) * 2.5;
    person(215 + tremble, 1560, 0.72, { lean: 0.12, lookX: 8, armR: -1.1 + Math.sin(lt * 9) * 0.1, armL: 0.2 });
  }
  function sCauses(t) {
    background(t);
    // which cause, with horizontal push between them
    CAUSES.forEach((c, i) => {
      const inP = i === 0 ? 1 : E.inOutExpo(P(t, c.t0 - 0.35, c.t0 + 0.35));
      const next = CAUSES[i + 1];
      const outP = next ? E.inOutExpo(P(t, next.t0 - 0.35, next.t0 + 0.35)) : E.inOutExpo(P(t, 25.75, 26.35));
      if (inP <= 0 || outP >= 1) return;
      const x = (1 - inP) * W - outP * W;
      const lt = t - c.t0 + (i === 0 ? 0 : 0.35);
      ctx.save(); ctx.translate(x, 0);
      const mv = Math.abs(x) / W;
      if (mv > 0.02) ctx.filter = `blur(${(mv * 14).toFixed(1)}px)`;
      // huge outlined number
      ctx.save(); ctx.font = font(800, 420); ctx.letterSpacing = '-10px'; ctx.textAlign = 'center';
      ctx.strokeStyle = 'rgba(244,239,230,0.07)'; ctx.lineWidth = 3; ctx.strokeText(c.n, 540 + (1 - inP) * 200, 700); ctx.restore();
      tag(`PENYEBAB ${c.n}`, 540, 250, t, c.t0 - (i === 0 ? 0 : 0.15), { color: C.amber });
      kLine(c.a, 540, 420, t, c.t0 + 0.05, { size: 92, weight: 600, color: C.dim });
      kLine(c.b, 540, 540, t, c.t0 + 0.25, { size: 104, color: C.paper, hl: i === 2 ? { 1: C.red } : {} });
      c.draw(t, Math.max(0, lt));
      ctx.restore();
    });
  }

  // =====================================================================
  // 4. SOLUTION: break it into small steps  (26 – 34)
  // =====================================================================
  const STEPS = ['Buka file', '1 kalimat', '10 menit', 'Rehat', 'Lanjut'];
  const SG = 1500, STW = 172, STH = 118, SX0 = 110;
  const stepRect = i => ({ x: SX0 + i * STW, w: STW - 8, h: (i + 1) * STH });
  const HOP0 = 29.35, HOPD = 0.72;
  function sSolution(t) {
    const warm = P(t, 26.2, 28.5);
    background(t, warm);
    const zin = E.inExpo(P(t, 33.4, 34.2));
    const s1 = stepRect(0);
    withCam(lerp(540, s1.x + s1.w / 2, zin), lerp(960, SG - 60, zin), 1 + zin * 6, () => {
      line(-200, SG, 1300, SG, 'rgba(244,239,230,0.14)', 3);
      // 1) big task drops in
      const drop = E.outBounce(P(t, 26.0, 26.7));
      const crack = E.inOutCubic(P(t, 26.9, 27.45));
      const split = E.outBack(P(t, 27.5, 28.0));
      const arrange = E.inOutCubic(P(t, 28.0, 29.0));
      const BW = 520, BH = 5 * 118;
      if (arrange <= 0) {
        const off = (1 - drop) * -1400;
        if (split <= 0) {
          ctx.save(); ctx.translate(0, off);
          slab(540, SG, BW, BH, { depth: 70 });
          ctx.save(); ctx.beginPath(); ctx.rect(540 - BW / 2, SG - BH, BW, BH); ctx.clip(); taskFace(540, SG, BW, BH, 0.8); ctx.restore();
          if (crack > 0) {
            ctx.save(); ctx.beginPath(); ctx.moveTo(560, SG - BH);
            const pts = 12;
            for (let k = 1; k <= pts * crack; k++) ctx.lineTo(540 + (k % 2 ? -30 : 30) * rnd(k), SG - BH + (BH / pts) * k);
            glow('rgba(94,234,212,0.9)', 24); ctx.strokeStyle = C.teal; ctx.lineWidth = 7; ctx.lineJoin = 'round'; ctx.stroke(); ctx.restore();
          }
          ctx.restore();
        }
      }
      // 2) pieces: five horizontal chunks of the block -> staircase
      if (split > 0) {
        for (let i = 0; i < 5; i++) {
          const k = 4 - i; // top chunk becomes the tallest step
          const fromY = SG - k * 118, fromX = 540 + (i - 2) * 30 * split;
          const gap = (k - 2) * 26 * split;
          const r = stepRect(i);
          const cx = lerp(fromX, r.x + r.w / 2, arrange);
          const gy = lerp(fromY - gap, SG, arrange);
          const w = lerp(BW - 10, r.w, arrange), h = lerp(108, r.h, arrange);
          const lit = E.outCubic(P(t, HOP0 + i * HOPD + 0.45, HOP0 + i * HOPD + 0.7));
          slab(cx, gy, w, h, { depth: lerp(70, 40, arrange), top: lit > 0 ? lerpColor('#2C3B68', '#5EEAD4', lit) : C.slabTop, front: lerpColor('#24315A', '#1D4D5A', lit), front2: lerpColor('#1B2645', '#153A45', lit) });
          // label + check on each step
          if (arrange >= 1) {
            ctx.save(); ctx.font = font(600, 26); ctx.letterSpacing = '0px'; ctx.textAlign = 'center'; ctx.fillStyle = `rgba(244,239,230,${0.45 + lit * 0.55})`;
            ctx.fillText(STEPS[i], cx, SG - r.h + 52 + (i === 0 ? 0 : 0)); ctx.restore();
            if (lit > 0) {
              ctx.save(); ctx.translate(cx, SG - r.h + 96); ctx.scale(E.outBack(lit), E.outBack(lit));
              circle(0, 0, 22, C.teal); drawCheck(0, 0, 26, C.bg0, 5, lit); ctx.restore();
            }
          }
        }
      }
      // 3) person hops up the steps
      const pin = E.outCubic(P(t, 28.6, 29.2));
      if (pin > 0) {
        let x = lerp(-60, 40, pin), y = SG, lift = 0, squash = 0;
        for (let i = 0; i < 5; i++) {
          const a = HOP0 + i * HOPD, p = P(t, a, a + 0.45);
          if (t >= a) {
            const r = stepRect(i), prev = i === 0 ? { x: 40, y: SG } : { x: stepRect(i - 1).x + stepRect(i - 1).w / 2, y: SG - stepRect(i - 1).h };
            x = lerp(prev.x, r.x + r.w / 2, E.inOutCubic(p)); y = lerp(prev.y, SG - r.h, E.inOutCubic(p));
            lift = Math.sin(p * Math.PI) * 90;
            squash = bump(t, a + 0.42, a + 0.62) * 0.8 - bump(t, a - 0.12, a + 0.05) * 0.5;
          }
        }
        const top = P(t, HOP0 + 4 * HOPD + 0.5, HOP0 + 4 * HOPD + 0.8);
        person(x, y, 0.62, { lift, squash, armL: 0.25 + top * 2.3, armR: -0.25 - top * 2.3, lookY: -top * 6 });
        // celebration sparks at the top
        if (top > 0) for (let k = 0; k < 10; k++) {
          const a = (k / 10) * TAU, d = 60 + top * 110, fa = 1 - P(t, HOP0 + 4 * HOPD + 0.9, HOP0 + 4 * HOPD + 1.6);
          circle(x + Math.cos(a) * d, y - 110 + Math.sin(a) * d, 5 * fa, k % 2 ? C.teal : C.amber);
        }
      }
    });
    ctx.save(); ctx.globalAlpha = 1 - zin;
    tag('SOLUSINYA', 540, 250, t, 26.35, { fill: C.teal, out: 33.2 });
    kLine('Pecah jadi', 540, 420, t, 28.3, { size: 92, weight: 600, color: C.dim, out: 33.2 });
    kLine('langkah kecil.', 540, 545, t, 28.55, { size: 110, hl: { 0: C.teal, 1: C.teal }, out: 33.25 });
    ctx.restore();
  }

  // =====================================================================
  // 5. ENDING  (34 – 40)
  // =====================================================================
  function sEnd(t) {
    background(t, 1);
    const drift = 1 + P(t, 34, 40) * 0.04;
    ctx.save(); ctx.translate(540, 960); ctx.scale(drift, drift); ctx.translate(-540, -960);
    kLine('Jangan tunggu', 540, 640, t, 34.35, { size: 104 });
    kLine('siap.', 540, 790, t, 34.7, { size: 140, hl: { 0: C.amber } });
    kLine('Mulai dari', 540, 990, t, 35.7, { size: 74, weight: 600, color: C.dim });
    const l = kLine('1 langkah kecil.', 540, 1130, t, 36.0, { size: 112, hl: { 0: C.teal } });
    // underline glow under "1"
    const up = E.inOutCubic(P(t, 36.6, 37.0));
    if (up > 0) { const [x, w] = l.pos[0]; ctx.save(); glow('rgba(94,234,212,0.8)', 16); line(x - 4, 1160, x - 4 + (w + 8) * up, 1160, C.teal, 10); ctx.restore(); }
    // one small step + the first hop
    const sr = E.outBack(P(t, 36.7, 37.2));
    const gy = 1470;
    line(140, gy, 940, gy, 'rgba(244,239,230,0.14)', 3);
    if (sr > 0) slab(560, gy, 220, 100 * sr, { depth: 40, top: C.teal, front: '#1D4D5A', front2: '#153A45' });
    const walk = E.inOutCubic(P(t, 36.9, 37.7));
    const hop = P(t, 37.75, 38.25);
    let x = lerp(250, 400, walk), y = gy, lift = Math.abs(Math.sin(walk * Math.PI * 3)) * 10 * (walk < 1 ? 1 : 0);
    if (hop > 0) { x = lerp(400, 560, E.inOutCubic(hop)); y = lerp(gy, gy - 100, E.inOutCubic(hop)); lift = Math.sin(hop * Math.PI) * 90; }
    const land = bump(t, 38.2, 38.45);
    person(x, y, 0.62, { lift, squash: land * 0.8, lookY: -4 });
    const cp = E.outBack(P(t, 38.3, 38.65));
    if (cp > 0) {
      ctx.save(); ctx.translate(690, gy - 200); ctx.scale(cp, cp); glow('rgba(94,234,212,0.7)', 24); circle(0, 0, 34, C.teal); noGlow(); drawCheck(0, 0, 38, C.bg0, 7, P(t, 38.4, 38.7)); ctx.restore();
      const rp = P(t, 38.3, 39.2);
      if (rp < 1) { ctx.beginPath(); ctx.arc(560, gy - 100, 60 + rp * 260, 0, TAU); ctx.strokeStyle = `rgba(94,234,212,${0.4 * (1 - rp)})`; ctx.lineWidth = 4; ctx.stroke(); }
    }
    ctx.restore();
  }

  // =====================================================================
  function render(t) {
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.filter = 'none'; ctx.letterSpacing = '0px'; noGlow();
    if (t < 4.6) sHook(t);
    else if (t < 10.85) sBig(t);
    else if (t < 11.1) { sBig(t); ctx.globalAlpha = P(t, 10.85, 11.1); sCauses(t); ctx.globalAlpha = 1; }
    else if (t < 25.95) sCauses(t);
    else if (t < 34.0) { sSolution(t); if (t < 26.35) sCausesOverlay(t); }
    else if (t < 34.25) { sSolution(t); ctx.globalAlpha = P(t, 34.0, 34.25); sEnd(t); ctx.globalAlpha = 1; }
    else sEnd(t);
    finish(t);
    ctx.restore();
  }
  // last cause slides out to the left over the incoming solution scene
  function sCausesOverlay(t) {
    const outP = E.inOutExpo(P(t, 25.75, 26.35));
    const c = CAUSES[2];
    ctx.save(); ctx.translate(-outP * W, 0); ctx.filter = `blur(${(outP * 14).toFixed(1)}px)`; ctx.globalAlpha = 1 - outP;
    tag(`PENYEBAB ${c.n}`, 540, 250, t, c.t0, {});
    kLine(c.a, 540, 420, t, c.t0, { size: 92, weight: 600, color: C.dim });
    kLine(c.b, 540, 540, t, c.t0, { size: 104, hl: { 1: C.red } });
    c.draw(t, t - c.t0);
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

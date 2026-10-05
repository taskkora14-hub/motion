/* "Pilih cepat! This or that mahasiswa." — 40s, 1080x1920, interactive this-or-that.
 * Split screen (top / bottom), flat illustrations, a 3-second ring timer on the seam,
 * a dramatic zoom + "terkunci" stamp on every pick, then a "kamu tim ..." result card.
 * Every frame is a pure function of time; shared timing lives in timeline.js. */
(() => {
  'use strict';

  const W = 1080, H = 1920, DURATION = 40, TAU = Math.PI * 2, MID = 960;
  const TL = window.PILIH_TL;
  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d');

  const C = {
    blue: '#184AA1', blueHi: '#2F63C4', blueLo: '#123A80', navy: '#0E1A44', navy2: '#16265C',
    white: '#FFFFFF', paper: '#F7F9FD', amber: '#FFB627', amberLo: '#E09A10', amberHi: '#FFD27A',
    skin: '#FFD3B0', skin2: '#E8A97E', sky: '#9CC0FF', brown: '#7A4A26', pink: '#FF8FA3', green: '#4CC38A',
  };
  const FONT = '"Fredoka", sans-serif';

  // ---------- math ----------
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const P = (t, a, b) => clamp((t - a) / (b - a));
  const E = {
    outCubic: x => 1 - Math.pow(1 - x, 3),
    inCubic: x => x * x * x,
    inOut: x => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
    outBack: x => { const c1 = 2.0, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); },
    outElastic: x => (x === 0 ? 0 : x === 1 ? 1 : Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * (2 * Math.PI / 3)) + 1),
  };
  const rnd = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

  const ready = Promise.all([document.fonts.load(`700 60px ${FONT}`), document.fonts.load(`600 60px ${FONT}`)]).then(() => document.fonts.ready);

  // ---------- drawing helpers ----------
  const LW = 6;
  function ink(fill, lw = LW, stroke = C.navy) {
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (lw) { ctx.lineWidth = lw; ctx.strokeStyle = stroke; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke(); }
  }
  const rr = (x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); };
  const ell = (x, y, rx, ry, rot = 0) => { ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, TAU); };
  const poly = pts => { ctx.beginPath(); ctx.moveTo(...pts[0]); for (let i = 1; i < pts.length; i++) ctx.lineTo(...pts[i]); ctx.closePath(); };
  function line(pts, w = LW, col = C.navy) {
    ctx.beginPath(); ctx.moveTo(...pts[0]); for (let i = 1; i < pts.length; i++) ctx.lineTo(...pts[i]);
    ctx.lineWidth = w; ctx.strokeStyle = col; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
  }
  function text(str, x, y, size, color, o = {}) {
    ctx.save();
    ctx.font = `${o.weight || 700} ${size}px ${FONT}`; ctx.textAlign = o.align || 'center'; ctx.textBaseline = 'middle';
    const w = ctx.measureText(str).width, max = o.maxW || 960;
    ctx.translate(x, y); if (w > max) ctx.scale(max / w, max / w);
    if (o.scale != null) ctx.scale(o.scale, o.scale);
    if (o.rot) ctx.rotate(o.rot);
    ctx.globalAlpha *= o.alpha ?? 1;
    if (o.outline) { ctx.lineWidth = o.outlineW || 14; ctx.strokeStyle = o.outline; ctx.lineJoin = 'round'; ctx.strokeText(str, 0, 0); }
    ctx.fillStyle = color; ctx.fillText(str, 0, 0);
    ctx.restore();
    return Math.min(w, max);
  }
  function face(x, y, r, o = {}) {
    ell(x, y, r, r); ink(C.skin);
    ctx.beginPath(); ctx.arc(x, y - r * 0.15, r, Math.PI * 1.02, Math.PI * 1.98); ctx.closePath(); ink(o.hair || C.navy);
    ell(x - r * 0.35, y + r * 0.1, r * 0.1, r * (o.wide ? 0.16 : 0.12)); ctx.fillStyle = C.navy; ctx.fill();
    ell(x + r * 0.35, y + r * 0.1, r * 0.1, r * (o.wide ? 0.16 : 0.12)); ctx.fill();
    if (o.mouth !== false) { ctx.beginPath(); ctx.arc(x, y + r * 0.32, r * 0.25, 0.15 * Math.PI, 0.85 * Math.PI); ink(null, 5); }
  }

  // =====================================================================
  // ILLUSTRATIONS — each drawn around (0,0) inside roughly ±230 x ±190; t = local time for idle motion
  const ILL = {
    'kuliah pagi'(t) {
      ell(0, 0, 210, 210); ctx.fillStyle = '#FFE7B0'; ctx.fill();
      ctx.save(); ell(0, 0, 210, 210); ctx.clip();
      for (let i = 0; i < 10; i++) { const a = Math.PI + i / 9 * Math.PI + t * 0.3; line([[Math.cos(a) * 110, 30 + Math.sin(a) * 110], [Math.cos(a) * 170, 30 + Math.sin(a) * 170]], 10, C.amber); }
      ell(0, 30, 80, 80); ink(C.amber);
      rr(-210, 60, 420, 200, 0); ctx.fillStyle = '#BFD7FF'; ctx.fill();
      ctx.restore();
      campus(0, 70, C.white, false);
      clockBadge(130, -130, '07.00');
    },
    'kuliah malam'(t) {
      ell(0, 0, 210, 210); ctx.fillStyle = C.navy2; ctx.fill(); ell(0, 0, 210, 210); ink(null, 6, '#2B3E80');
      for (let i = 0; i < 9; i++) { const tw = 0.5 + 0.5 * Math.sin(t * 4 + i); ell(-150 + rnd(i) * 300, -150 + rnd(i + 9) * 150, 4 + 3 * tw, 4 + 3 * tw); ctx.fillStyle = C.white; ctx.fill(); }
      ell(-70, -80, 52, 52); ctx.fillStyle = C.amber; ctx.fill(); ell(-48, -96, 46, 46); ctx.fillStyle = C.navy2; ctx.fill();
      campus(0, 70, '#C9D6F2', true);
      clockBadge(130, -130, '19.00');
    },
    'kerja kelompok'(t) {
      const bob = k => Math.sin(t * 5 + k) * 5;
      face(-120, -40 + bob(0), 52, { hair: C.navy }); face(0, -70 + bob(1), 52, { hair: C.brown }); face(120, -40 + bob(2), 52, { hair: C.amberLo });
      rr(-200, 10, 400, 40, 18); ink(C.amber);
      rr(-60, -30, 120, 44, 8); ink('#C9D6F2'); poly([[-80, 14], [80, 14], [90, 24], [-90, 24]]); ink(C.white);
      bubble(-150, -150, '…', 0.8 + 0.2 * Math.sin(t * 6)); bubble(150, -160, '!', 0.8 + 0.2 * Math.sin(t * 6 + 2));
      rr(-160, 60, 320, 110, 30); ctx.fillStyle = 'rgba(255,255,255,0.0)'; ctx.fill();
    },
    'sendirian'(t) {
      face(0, -50, 70, { hair: C.navy, mouth: true });
      ctx.beginPath(); ctx.arc(0, -60, 84, Math.PI * 1.05, Math.PI * 1.95); ink(null, 14);              // headphones band
      rr(-100, -80, 30, 60, 12); ink(C.amber); rr(70, -80, 30, 60, 12); ink(C.amber);
      rr(-180, 50, 360, 34, 14); ink(C.amber);
      rr(-90, -10, 180, 64, 10); ink('#C9D6F2'); poly([[-110, 50], [110, 50], [120, 60], [-120, 60]]); ink(C.white);
      // plant + music notes
      rr(130, 0, 46, 50, 8); ink(C.white); ell(140, -20, 18, 30, -0.4); ink(C.green); ell(166, -24, 18, 30, 0.4); ink(C.green);
      for (let k = 0; k < 2; k++) { const ph = (t * 0.7 + k * 0.5) % 1; text('♪', -150 - 20 * ph, -60 - 120 * ph, 50, C.white, { alpha: Math.sin(ph * Math.PI) }); }
    },
    'kopi'(t) {
      ell(0, 120, 170, 34); ink(C.white);
      rr(-110, -60, 220, 190, 40); ink(C.white);
      ell(150, 20, 46, 54); ink(null, 22); ell(150, 20, 46, 54); ink(null, 10, C.white);
      ell(0, -60, 110, 26); ink(C.brown);
      ell(-30, -64, 30, 9); ctx.fillStyle = '#B67A4A'; ctx.fill();
      rr(-110, 20, 220, 30, 0); ctx.fillStyle = C.blue; ctx.fill();
      for (let k = 0; k < 3; k++) { const ph = (t * 0.8 + k / 3) % 1; ctx.save(); ctx.globalAlpha = Math.sin(ph * Math.PI); ctx.beginPath(); ctx.moveTo(-50 + k * 50, -100 - ph * 60); ctx.bezierCurveTo(-30 + k * 50, -130 - ph * 60, -70 + k * 50, -160 - ph * 60, -50 + k * 50, -190 - ph * 60); ink(null, 10, C.white); ctx.restore(); }
      for (let k = 0; k < 3; k++) { ell(-170 + k * 34, 160 - (k % 2) * 10, 16, 11, 0.5); ink(C.brown, 4); }
    },
    'teh'(t) {
      ell(0, 120, 170, 34); ink(C.white);
      poly([[-120, -80], [120, -80], [95, 120], [-95, 120]]); ink('rgba(255,255,255,0.35)');
      ctx.save(); poly([[-120, -80], [120, -80], [95, 120], [-95, 120]]); ctx.clip();
      rr(-130, -40 + Math.sin(t * 3) * 4, 260, 200, 0); ctx.fillStyle = C.amber; ctx.fill(); ctx.restore();
      poly([[-120, -80], [120, -80], [95, 120], [-95, 120]]); ink(null);
      line([[60, -80], [100, -160]], 4); rr(84, -200, 50, 46, 6); ink(C.white); text('tea', 109, -176, 22, C.navy);
      ell(-130, -80, 46, 46); ink('#FFE36B'); line([[-130, -122], [-130, -38]], 4, C.amberLo); line([[-172, -80], [-88, -80]], 4, C.amberLo);
      rr(-60, -10, 40, 40, 6); ink('rgba(255,255,255,0.7)', 4);
    },
    'ujian tulis'(t) {
      ctx.save(); ctx.rotate(-0.06);
      rr(-150, -190, 300, 370, 18); ink(C.paper);
      text('ujian', -100, -150, 34, C.blue, { align: 'left' });
      for (let i = 0; i < 4; i++) {
        rr(-120, -100 + i * 66, 36, 36, 8); ink(C.white, 5);
        if (i < 2 || (i === 2 && Math.sin(t * 3) > 0)) line([[-112, -82 + i * 66], [-102, -72 + i * 66], [-88, -94 + i * 66]], 6, C.green);
        line([[-66, -82 + i * 66], [110, -82 + i * 66]], 6, '#C9D6F2');
      }
      ctx.restore();
      ctx.save(); ctx.translate(150 + Math.sin(t * 8) * 6, 60); ctx.rotate(0.6);
      rr(-14, -130, 28, 200, 6); ink(C.amber); poly([[-14, 70], [14, 70], [0, 108]]); ink('#FCE3C2'); rr(-14, -150, 28, 24, 6); ink(C.pink);
      ctx.restore();
    },
    'ujian lisan'(t) {
      face(-120, 10, 70, { hair: '#9AA6C4' });
      ell(-120, 18, 22, 18); ink(C.white, 4); ell(-80, 18, 22, 18); ink(C.white, 4);
      face(120, 10, 70, { hair: C.navy, wide: true, mouth: false }); ell(120, 46, 14, 18); ink('#7A2E3A', 4);
      bubble(-120, -140, '?', 1); bubble(120, -140, 'eh…', 0.9 + 0.1 * Math.sin(t * 8));
      rr(-220, 90, 440, 30, 12); ink(C.amber);
      line([[180, -40], [196, -64]], 5, C.sky); line([[204, -30], [226, -46]], 5, C.sky);
    },
    'presentasi'(t) {
      rr(-170, -170, 300, 210, 14); ink(C.white);
      [60, 110, 85, 140].forEach((h, i) => { const hh = h * (0.85 + 0.15 * Math.sin(t * 3 + i)); rr(-140 + i * 64, 20 - hh, 40, hh, 6); ink(i === 3 ? C.amber : C.blue, 4); });
      line([[-20, 40], [-20, 130]], 8); line([[-80, 170], [-20, 130], [40, 170]], 8);
      face(170, -10, 54, { hair: C.navy });
      rr(130, 44, 80, 120, 30); ink(C.blue);
      line([[140, 60], [60 + Math.sin(t * 4) * 10, -60]], 6, C.amberLo);
    },
    'laporan'(t) {
      for (let i = 3; i >= 0; i--) { ctx.save(); ctx.translate(i * 12 - 10, -i * 10 + 20); ctx.rotate(-0.04 * i); rr(-140, -170, 280, 340, 14); ink(C.paper); ctx.restore(); }
      text('laporan', -10, -110, 46, C.blue);
      for (let i = 0; i < 5; i++) line([[-110, -50 + i * 38], [90 - (i % 2) * 40, -50 + i * 38]], 7, '#C9D6F2');
      rr(-50, -210, 80, 40, 8); ink('#9AA6C4'); rr(-30, -224, 40, 24, 6); ink(null, 5);
      ctx.save(); ctx.translate(150, 150); ctx.rotate(-0.2 + Math.sin(t * 3) * 0.05); rr(-30, -40, 60, 80, 8); ink(C.amber); text('A', 0, 2, 44, C.navy); ctx.restore();
    },
    'kelas online'(t) {
      rr(-200, -160, 400, 260, 18); ink('#2B3E80');
      const cols = [C.navy, C.brown, C.amberLo, '#9AA6C4'];
      for (let i = 0; i < 4; i++) { const x = -190 + (i % 2) * 195, y = -150 + Math.floor(i / 2) * 120; rr(x, y, 185, 110, 10); ink(i === 0 && Math.sin(t * 5) > 0 ? '#3D5AA8' : C.blueHi, 4); face(x + 92, y + 62, 32, { hair: cols[i] }); }
      poly([[-240, 100], [240, 100], [260, 130], [-260, 130]]); ink(C.white);
      for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(170, -190, 24 + k * 22, Math.PI * 1.2, Math.PI * 1.8); ink(null, 7, C.white); }
    },
    'kelas offline'(t) {
      rr(-200, -190, 400, 180, 14); ink(C.white); text('kelas', -170, -150, 30, C.blue, { align: 'left' }); line([[-170, -100], [80, -100]], 6, '#C9D6F2'); line([[-170, -60], [20, -60]], 6, '#C9D6F2');
      for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) {
        const x = -140 + c * 140, y = 50 + r * 100;
        face(x, y - 30 + Math.sin(t * 4 + r + c) * 3, 30, { hair: [C.navy, C.brown, C.amberLo][(r + c) % 3] });
        rr(x - 60, y, 120, 24, 8); ink(C.amber, 5);
      }
    },
    'begadang'(t) {
      rr(-200, -190, 160, 160, 14); ink(C.navy2); ell(-150, -130, 30, 30); ctx.fillStyle = C.amber; ctx.fill(); ell(-136, -140, 26, 26); ctx.fillStyle = C.navy2; ctx.fill();
      clockBadge(130, -150, '02.00');
      ell(0, 30, 150, 110); ctx.fillStyle = 'rgba(156,192,255,0.25)'; ctx.fill();     // screen glow
      face(0, -10, 74, { hair: C.navy, wide: true, mouth: false });
      ctx.beginPath(); ctx.arc(-26, 20, 16, 0.1 * Math.PI, 0.9 * Math.PI); ctx.arc(26, 20, 16, 0.1 * Math.PI, 0.9 * Math.PI); ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(14,26,68,0.5)'; ctx.stroke();
      line([[-14, 40], [14, 40]], 5);
      rr(-120, 70, 240, 80, 10); ink('#C9D6F2'); poly([[-150, 150], [150, 150], [165, 166], [-165, 166]]); ink(C.white);
      rr(150, 80, 50, 70, 10); ink(C.white); ell(175, 82, 22, 6); ctx.fillStyle = C.brown; ctx.fill();
    },
    'bangun subuh'(t) {
      ell(0, 0, 210, 210); ctx.fillStyle = '#FFD9A8'; ctx.fill();
      ctx.save(); ell(0, 0, 210, 210); ctx.clip(); ell(0, 170, 140, 140); ctx.fillStyle = C.amber; ctx.fill(); rr(-220, 150, 440, 120, 0); ctx.fillStyle = '#BFD7FF'; ctx.fill(); ctx.restore();
      const sh = Math.sin(t * 40) * 0.08;
      ctx.save(); ctx.translate(0, -10); ctx.rotate(sh);
      ell(-70, -110, 40, 40); ink(C.amber); ell(70, -110, 40, 40); ink(C.amber);
      ell(0, 0, 120, 120); ink(C.white, 10); ell(0, 0, 100, 100); ink(C.paper, 0);
      line([[0, 0], [0, -64]], 9); line([[0, 0], [44, 18]], 9); ell(0, 0, 10, 10); ink(C.amber, 4);
      line([[-60, 110], [-80, 140]], 10); line([[60, 110], [80, 140]], 10);
      ctx.restore();
      for (const s of [-1, 1]) for (let k = 0; k < 3; k++) line([[s * (150 + k * 8), -120 + k * 40], [s * (180 + k * 8), -130 + k * 40]], 8, C.navy);
      clockBadge(-140, 150, '04.30');
    },
    'kos dekat kampus'(t) {
      campus(80, -10, C.white, false, 0.8);
      house(-130, 40, 0.75, C.blue);
      ctx.save(); ctx.setLineDash([2, 22]); line([[-80, 150], [60, 150]], 10, C.amber); ctx.restore();
      ctx.save(); ctx.translate(-10, 110 + Math.sin(t * 5) * 6); rr(-62, -32, 124, 54, 27); ink(C.amber); text('5 mnt', 0, -4, 32, C.navy); ctx.restore();
    },
    'rumah jauh tapi nyaman'(t) {
      ctx.beginPath(); ctx.moveTo(-200, 170); ctx.bezierCurveTo(-60, 120, -220, 60, -40, 30); ctx.bezierCurveTo(80, 0, 40, -40, 150, -60);
      ink(null, 34, '#9AA6C4'); ctx.save(); ctx.setLineDash([16, 20]); ink(null, 5, C.white); ctx.restore();
      house(110, -90, 0.7, C.amberLo);
      for (let k = 0; k < 3; k++) { const ph = (t * 0.6 + k / 3) % 1; ctx.save(); ctx.globalAlpha = Math.sin(ph * Math.PI); heart(150 + ph * 30, -230 - ph * 80, 16 + 10 * ph); ctx.restore(); }
      ctx.save(); ctx.translate(-150, 110); rr(-60, -26, 120, 52, 26); ink(C.white); text('2 jam', 0, 2, 30, C.navy); ctx.restore();
    },
  };
  function campus(x, y, wall, lit, s = 1) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    poly([[-170, -40], [0, -120], [170, -40]]); ink(C.amber);
    rr(-150, -40, 300, 170, 6); ink(wall);
    for (let i = 0; i < 5; i++) { rr(-130 + i * 56, -20, 28, 130, 6); ink(lit ? C.amber : '#BFD7FF', 4); }
    rr(-170, 120, 340, 26, 6); ink(C.white);
    ctx.restore();
  }
  function house(x, y, s, roof) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    poly([[-130, 0], [0, -110], [130, 0]]); ink(roof);
    rr(-110, 0, 220, 170, 8); ink(C.white);
    rr(-30, 70, 60, 100, 8); ink(C.navy2); rr(50, 30, 44, 44, 6); ink('#FFE7B0', 5); rr(-94, 30, 44, 44, 6); ink('#FFE7B0', 5);
    ctx.restore();
  }
  function heart(x, y, r) {
    ctx.beginPath(); ctx.moveTo(x, y + r); ctx.bezierCurveTo(x - r * 2, y - r * 0.4, x - r * 0.6, y - r * 1.6, x, y - r * 0.5);
    ctx.bezierCurveTo(x + r * 0.6, y - r * 1.6, x + r * 2, y - r * 0.4, x, y + r); ink('#FF6F7F', 4);
  }
  function bubble(x, y, str, s) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    rr(-56, -40, 112, 70, 30); ink(C.white, 5); poly([[-10, 28], [10, 28], [-6, 50]]); ink(C.white, 5); rr(-52, -36, 104, 62, 28); ctx.fillStyle = C.white; ctx.fill();
    text(str, 0, -4, 40, C.navy);
    ctx.restore();
  }
  function clockBadge(x, y, str) { rr(x - 70, y - 30, 140, 60, 30); ink(C.navy, 5, C.white); text(str, x, y + 2, 34, C.amber); }

  // =====================================================================
  // SPLIT SCREEN
  function half(top, label, illus, t, o = {}) {
    // o: slide (−1..1 horizontal offset fraction), zoom, dim, locked
    const y0 = top ? 0 : MID, cy = top ? 470 : 1440, ly = top ? 795 : 1125;
    ctx.save();
    ctx.beginPath(); ctx.rect(0, y0, W, MID); ctx.clip();
    ctx.translate((o.slide || 0) * W, 0);
    ctx.fillStyle = top ? C.blue : C.navy; ctx.fillRect(-W, y0, 3 * W, MID);
    // diagonal stripes
    ctx.save(); ctx.globalAlpha = 0.07; ctx.strokeStyle = C.white; ctx.lineWidth = 40;
    for (let k = -4; k < 12; k++) { ctx.beginPath(); ctx.moveTo(k * 160 + (t * 40) % 160, y0); ctx.lineTo(k * 160 - 500 + (t * 40) % 160, y0 + MID); ctx.stroke(); }
    ctx.restore();
    const z = o.zoom || 1;
    ctx.translate(540, ly); ctx.scale(z, z); ctx.translate(-540, -ly);   // zoom away from the seam so the label stays clear
    if (illus) { ctx.save(); ctx.translate(540, cy); ctx.scale(1.3, 1.3); illus(t); ctx.restore(); }
    if (label) text(label, 540, ly, 92, C.white, { outline: C.navy, outlineW: 16, maxW: 940 });
    ctx.restore();
    if (o.dim) { ctx.fillStyle = `rgba(6,12,36,${0.6 * o.dim})`; ctx.fillRect(0, y0, W, MID); }
    if (o.glow) {
      ctx.save(); ctx.globalAlpha = o.glow; ctx.lineWidth = 18; ctx.strokeStyle = C.amber;
      ctx.strokeRect(9, y0 + 9, W - 18, MID - 18); ctx.restore();
    }
  }

  function timer(x, y, rem, total, label, o = {}) {
    const pulse = 1 + 0.12 * Math.max(0, 1 - ((total - rem) % 1) / 0.2);
    ctx.save(); ctx.translate(x, y); ctx.scale(pulse * (o.scale ?? 1), pulse * (o.scale ?? 1));
    ell(0, 0, 112, 112); ink(C.white, 10);
    ctx.beginPath(); ctx.arc(0, 0, 88, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(rem / total)); ctx.lineWidth = 24; ctx.strokeStyle = rem < 1 ? '#FF6F5C' : C.amber; ctx.lineCap = 'round'; ctx.stroke();
    text(label, 0, 6, label.length > 2 ? 46 : 96, C.navy);
    ctx.restore();
  }

  function lockStamp(x, y, t, tl) {
    const p = E.outBack(P(t, tl, tl + 0.22));
    if (p <= 0) return;
    ctx.save(); ctx.translate(x, y); ctx.rotate(-0.08); ctx.scale(p * 1.0, p * 1.0);
    rr(-230, -62, 460, 124, 62); ink(C.amber, 10);
    // padlock
    ctx.beginPath(); ctx.arc(-150, -16, 26, Math.PI, 0); ink(null, 10);
    rr(-184, -14, 68, 56, 12); ink(C.navy, 0); ell(-150, 10, 7, 9); ctx.fillStyle = C.amber; ctx.fill();
    text('terkunci', 40, 4, 74, C.navy);
    ctx.restore();
  }

  function pairBadge(i, t, a = 1) {
    ctx.save(); ctx.globalAlpha = a;
    rr(40, 170, 150, 76, 38); ink(C.amber, 6);
    text(`#${i + 1}`, 115, 210, 52, C.navy);
    for (let k = 0; k < 8; k++) { ell(820 + k * 30, 208, 9, 9); ctx.fillStyle = k <= i ? C.amber : 'rgba(255,255,255,0.35)'; ctx.fill(); }
    ctx.restore();
  }

  // =====================================================================
  function hook(t) {
    const out = P(t, TL.HOOK.out, 4.0);
    half(true, null, null, t, { slide: -E.inCubic(out) });
    half(false, null, null, t, { slide: E.inCubic(out) });
    // big question marks as placeholders
    const wob = Math.sin(t * 6) * 0.08;
    text('?', 540 - E.inCubic(out) * W, 470, 300, 'rgba(255,255,255,0.18)', { rot: wob });
    text('?', 540 + E.inCubic(out) * W, 1440, 300, 'rgba(255,255,255,0.14)', { rot: -wob });
    // hook text (on screen from frame 0)
    const s0 = (t < 0.1 ? 1.08 : 1) * (1 - E.inCubic(P(t, 3.6, 3.95)));
    if (s0 > 0) {
      text('pilih cepat!', 540, 380, 140, C.amber, { scale: s0, outline: C.navy, outlineW: 20 });
      text('this or that', 540, 525, 110, C.white, { scale: s0, outline: C.navy, outlineW: 18 });
      text('mahasiswa.', 540, 645, 110, C.white, { scale: s0, outline: C.navy, outlineW: 18 });
    }
    seam(t);
    if (t < TL.HOOK.go) timer(540, MID, 3 - t, 3, String(3 - Math.floor(t)));
    else timer(540, MID, 0, 3, 'mulai!', { scale: E.outBack(P(t, 3.0, 3.25)) * (1 - E.inCubic(P(t, 3.7, 4.0))) });
  }
  function seam(t) {
    ctx.fillStyle = C.white; ctx.fillRect(0, MID - 5, W, 10);
    text('atau', 200, MID, 44, C.amber, { outline: C.navy, outlineW: 10 });
    text('atau', 880, MID, 44, C.amber, { outline: C.navy, outlineW: 10 });
  }

  function pairScene(p, t) {
    const lt = t - p.s;
    const inP = E.outCubic(P(t, p.s, p.inEnd)), outP = E.inCubic(P(t, p.out, p.s + 4));
    const locked = t >= p.lock;
    const lp = P(t, p.lock, p.lock + 0.3);
    const zoomIn = locked ? 1 + 0.1 * E.outBack(lp) : 1;
    const shake = locked && t < p.lock + 0.2 ? Math.sin(t * 90) * 10 * (1 - lp) : 0;
    ctx.save(); ctx.translate(shake, 0);
    const [a, b] = p.labels;
    const topPick = p.pick === 0;
    half(true, a, ILL[a], lt, { slide: (1 - inP) * -1 + outP * -1, zoom: locked && topPick ? zoomIn : locked ? 1 - 0.05 * lp : 1, dim: locked && !topPick ? lp : 0, glow: locked && topPick ? lp : 0 });
    half(false, b, ILL[b], lt, { slide: (1 - inP) + outP, zoom: locked && !topPick ? zoomIn : locked ? 1 - 0.05 * lp : 1, dim: locked && topPick ? lp : 0, glow: locked && !topPick ? lp : 0 });
    ctx.restore();
    seam(t);
    pairBadge(p.i, t, 1 - outP);
    if (!locked) {
      const rem = Math.max(0, 3 - Math.max(0, t - p.t0));
      timer(540, MID, rem, 3, String(Math.min(3, Math.ceil(rem - 1e-6)) || 1), { scale: E.outBack(P(t, p.s, p.inEnd + 0.1)) });
    } else {
      // padlock in the timer spot
      const s = E.outBack(P(t, p.lock, p.lock + 0.2)) * (1 - outP);
      ctx.save(); ctx.translate(540, MID); ctx.scale(s, s);
      ell(0, 0, 112, 112); ink(C.amber, 10);
      ctx.beginPath(); ctx.arc(0, -18, 34, Math.PI, 0); ink(null, 12); rr(-46, -16, 92, 74, 14); ink(C.navy, 0); ell(0, 16, 9, 12); ctx.fillStyle = C.amber; ctx.fill();
      ctx.restore();
      lockStamp(540, topPick ? 500 : 1470, t, p.lock + 0.05);
      // flash
      if (lp < 1) { ctx.fillStyle = `rgba(255,255,255,${0.35 * (1 - lp)})`; ctx.fillRect(0, topPick ? 0 : MID, W, MID); }
    }
  }

  function result(t) {
    const R = TL.RESULT;
    ctx.fillStyle = C.blue; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.globalAlpha = 0.08; ctx.strokeStyle = C.white; ctx.lineWidth = 40;
    for (let k = -4; k < 14; k++) { ctx.beginPath(); ctx.moveTo(k * 160 + (t * 40) % 160, 0); ctx.lineTo(k * 160 - 1000 + (t * 40) % 160, H); ctx.stroke(); }
    ctx.restore();
    // confetti
    for (let i = 0; i < 50; i++) {
      const age = t - R.in; const x = rnd(i) * W + Math.sin(age * 3 + i) * 30, y = -50 + (rnd(i + 7) * 600 + age * (300 + rnd(i + 3) * 300)) % (H + 100);
      ctx.save(); ctx.translate(x, y); ctx.rotate(age * 4 + i); ctx.fillStyle = [C.amber, C.white, C.sky][i % 3]; ctx.fillRect(-8, -14, 16, 28); ctx.restore();
    }
    // card
    const cs = E.outBack(P(t, R.card, R.card + 0.4));
    ctx.save(); ctx.translate(540, 1010); ctx.scale(cs, cs); ctx.rotate(-0.02);
    rr(-430, -440, 860, 880, 50); ink(C.white, 10);
    text('kamu tim', 0, -360, 58, C.blue, { weight: 600 });
    rr(-370, -300, 740, 130, 65); ink(C.amber, 8);
    text('kalong kampus', 0, -232, 92, C.navy, { maxW: 680 });
    // picks as chips (2 columns)
    TL.pairs.forEach((p, i) => {
      const a = E.outBack(P(t, R.chips + i * 0.06, R.chips + i * 0.06 + 0.25));
      if (a <= 0) return;
      const col = i % 2, row = Math.floor(i / 2);
      const x = -205 + col * 410, y = -110 + row * 130;
      ctx.save(); ctx.translate(x, y); ctx.scale(a, a);
      const hl = i === 3;
      rr(-195, -52, 390, 104, 30); ink(hl ? C.amber : '#EAF0FC', 5);
      ell(-150, 0, 32, 32); ink(C.blue, 0); text(String(i + 1), -150, 2, 38, C.white);
      text(p.labels[p.pick], 20, 2, 38, C.navy, { maxW: 270 });
      ctx.restore();
    });
    ctx.restore();
    // prompt
    const p1 = E.outBack(P(t, R.text, R.text + 0.35)), p2 = E.outBack(P(t, R.text + 0.15, R.text + 0.5));
    if (p1 > 0) text('komen jawaban', 540, 260, 104, C.white, { scale: p1, outline: C.navy, outlineW: 18 });
    if (p2 > 0) text('nomor 4 kamu.', 540, 385, 104, C.amber, { scale: p2, outline: C.navy, outlineW: 18 });
  }

  // =====================================================================
  function render(t) {
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1;
    if (t < 4) hook(t);
    else if (t < TL.RESULT.in) pairScene(TL.pairs[Math.min(7, Math.floor((t - 4) / TL.SLOT))], t);
    else result(t);
    // watermark
    ctx.save(); ctx.globalAlpha = 0.25; ctx.font = `600 32px ${FONT}`; ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic';
    ctx.lineWidth = 4; ctx.strokeStyle = C.navy; ctx.lineJoin = 'round'; ctx.strokeText('@taskkora__', W - 44, H - 52);
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

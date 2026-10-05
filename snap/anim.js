/* "snap! semester kemarin vs sekarang." — viral snap-transition promo, 40s, 1080x1920.
 * One student, locked-off camera, fixed spot. Every finger snap lands on a beat (125 BPM) and
 * swaps outfit, background and mood through a circular wipe from the snapping hand.
 * Every frame is a pure function of time. Snap times are mirrored in snap/music.py. */
(() => {
  'use strict';

  const W = 1080, H = 1920, DURATION = 40;
  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d');

  const C = {
    blue: '#184AA1', blueL: '#2F6BD3', blueXL: '#9CC0FF', blueD: '#0F3274', sky: '#DCE7FA',
    navy: '#0B1A3D', navy2: '#060E24', navy3: '#16285A',
    white: '#FFFFFF', paper: '#F3F6FC', amber: '#FFB627', amberD: '#D98E00', amberL: '#FFD77A',
    skin: '#F1C49E', skinD: '#D9A07A', hair: '#191D2E', line: '#0B1A3D',
  };
  const F = (w, s) => `${w} ${s}px "PP", sans-serif`;

  const BPM = 125, BEAT = 60 / BPM;                         // 0.48 s
  const SNAPS = [0, 4.32, 8.64, 12.96, 17.28, 21.6, 26.88, 34.56];   // beats 0, 9, 18, 27, 36, 45, 56, 72
  const LOOK_IDS = ['hook', 'kamar', 'kelas', 'perpus', 'seminar', 'wisuda', 'mintask', 'end'];
  const HAND = { x: 318, y: 955 };                          // snapping hand = origin of every wipe

  // ---------- math ----------
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const P = (t, a, b) => clamp((t - a) / (b - a));
  const TAU = Math.PI * 2;
  const E = {
    outCubic: x => 1 - Math.pow(1 - x, 3),
    inCubic: x => x * x * x,
    outExpo: x => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x)),
    outBack: x => { const c1 = 2.0, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); },
  };
  const rnd = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const lookIndex = t => { let i = 0; for (let k = 0; k < SNAPS.length; k++) if (t >= SNAPS[k]) i = k; return i; };

  // ---------- assets ----------
  const mark = new Image();
  const ready = Promise.all([
    new Promise((res, rej) => { mark.onload = res; mark.onerror = rej; mark.src = 'mark.png'; }),
    document.fonts.load(F(900, 40)), document.fonts.load(F(800, 40)), document.fonts.load(F(600, 40)),
  ]).then(() => document.fonts.ready);

  // ---------- helpers ----------
  function rr(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
  function fillRR(x, y, w, h, r, c) { rr(x, y, w, h, r); ctx.fillStyle = c; ctx.fill(); }
  function circle(x, y, r, c) { ctx.beginPath(); ctx.arc(x, y, Math.max(0, r), 0, TAU); ctx.fillStyle = c; ctx.fill(); }
  function ell(x, y, rx, ry, c, rot = 0) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, TAU); ctx.fillStyle = c; ctx.fill(); }
  function seg(x1, y1, x2, y2, c, w) { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.strokeStyle = c; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.stroke(); }
  function poly(pts, c) { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (const p of pts.slice(1)) ctx.lineTo(p[0], p[1]); ctx.closePath(); ctx.fillStyle = c; ctx.fill(); }
  function outlined(drawPath, fill, lw = 6) { drawPath(); ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = lw; ctx.strokeStyle = C.line; ctx.lineJoin = 'round'; ctx.stroke(); }
  // limb = thick capsule with an outline
  function limb(pts, c, w) {
    for (const [col, ww] of [[C.line, w + 12], [c, w]]) {
      ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (const p of pts.slice(1)) ctx.lineTo(p[0], p[1]);
      ctx.strokeStyle = col; ctx.lineWidth = ww; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
    }
  }
  function text(s, x, y, size, color, o = {}) {
    ctx.save();
    ctx.font = F(o.weight || 900, size); ctx.textAlign = o.align || 'center'; ctx.textBaseline = 'alphabetic';
    ctx.letterSpacing = (o.ls ?? 0) + 'px'; ctx.wordSpacing = Math.round(size * 0.14) + 'px';
    const w = ctx.measureText(s).width, max = o.maxW || 980;
    if (w > max) { ctx.translate(x, y); ctx.scale(max / w, max / w); ctx.translate(-x, -y); }
    if (o.stroke !== false) { ctx.lineWidth = o.sw || Math.max(8, size * 0.14); ctx.strokeStyle = o.stroke || C.navy; ctx.lineJoin = 'round'; ctx.strokeText(s, x, y); }
    if (o.shadow !== false) { ctx.fillStyle = o.shadow || C.navy; ctx.fillText(s, x, y + Math.max(6, size * 0.08)); }
    ctx.fillStyle = color; ctx.fillText(s, x, y);
    ctx.restore();
  }
  function tick(x, y, z, c, w) { ctx.beginPath(); ctx.moveTo(x - z * 0.5, y); ctx.lineTo(x - z * 0.12, y + z * 0.38); ctx.lineTo(x + z * 0.55, y - z * 0.4); ctx.strokeStyle = c; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke(); }
  function pop(t, t0, d = 0.32) { return E.outBack(P(t, t0, t0 + d)); }
  function withScale(x, y, s, fn) { if (s <= 0.001) return; ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.translate(-x, -y); fn(); ctx.restore(); }

  // ---------- looks ----------
  const LOOKS = {
    hook:    { top: 'hoodie', c1: '#2E3B62', c2: '#232E4F', pants: '#1E2742', hair: 'messy', bags: 1, mood: 'tired', prop: 'coffee' },
    kamar:   { top: 'tee', c1: '#F3F6FC', c2: '#D5DEEF', pants: '#3A4A78', hair: 'messy', bags: 0.7, mood: 'meh', prop: 'none' },
    kelas:   { top: 'shirt', c1: '#BCD2F5', c2: '#9DB9E8', pants: C.navy3, hair: 'neat', bags: 0.35, mood: 'nervous', prop: 'clicker' },
    perpus:  { top: 'cardigan', c1: C.amber, c2: C.amberD, pants: C.navy3, hair: 'neat', bags: 0.2, mood: 'focus', prop: 'book', glasses: true },
    seminar: { top: 'blazer', c1: C.blue, c2: C.blueD, pants: C.navy, hair: 'slick', bags: 0, mood: 'proud', prop: 'lanyard' },
    wisuda:  { top: 'toga', c1: '#13204A', c2: '#0B1533', pants: C.navy, hair: 'neat', bags: 0, mood: 'happy', prop: 'scroll', cap: true },
    mintask: { top: 'jacket', c1: C.navy3, c2: C.navy, pants: C.navy, hair: 'slick', bags: 0, mood: 'grin', prop: 'card' },
  };

  // ---------- the person ----------
  function nod(t) { const ph = ((t + 1e-6) / BEAT) % 1; return 7 * Math.exp(-ph * 6); } // nods on every beat
  function person(L, t, snapP) {
    const by = nod(t) * 0.5, hy = nod(t);
    // --- legs ---
    if (L.top !== 'toga') {
      outlined(() => rr(398, 1470, 138, 470, 18), L.pants);
      outlined(() => rr(544, 1470, 138, 470, 18), L.pants);
    }
    ctx.save(); ctx.translate(0, by);
    // --- hood / back of toga ---
    if (L.top === 'hoodie') outlined(() => { ctx.beginPath(); ctx.ellipse(540, 1060, 150, 62, 0, 0, TAU); }, L.c2);
    // --- torso ---
    const torso = () => {
      ctx.beginPath();
      if (L.top === 'toga') { ctx.moveTo(372, 1110); ctx.quadraticCurveTo(384, 1062, 450, 1052); ctx.lineTo(630, 1052); ctx.quadraticCurveTo(696, 1062, 708, 1110); ctx.lineTo(770, 1960); ctx.lineTo(310, 1960); ctx.closePath(); return; }
      const wide = L.top === 'tee' || L.top === 'hoodie' ? 14 : 0;
      ctx.moveTo(372 - wide, 1120); ctx.quadraticCurveTo(382, 1062, 452, 1054); ctx.lineTo(628, 1054); ctx.quadraticCurveTo(698, 1062, 708 + wide, 1120);
      ctx.lineTo(694 + wide, 1500); ctx.lineTo(386 - wide, 1500); ctx.closePath();
    };
    outlined(torso, L.c1);
    ctx.save(); torso(); ctx.clip();
    topDetails(L, t);
    ctx.restore();
    torso(); ctx.lineWidth = 6; ctx.strokeStyle = C.line; ctx.stroke();
    // --- left arm (viewer's right) + prop ---
    leftArm(L, t);
    ctx.restore();
    // --- neck + head ---
    ctx.save(); ctx.translate(0, hy);
    outlined(() => rr(505, 960, 70, 100, 20), C.skinD);
    if (L.top === 'hoodie') { seg(516, 1066, 512, 1190, C.paper, 7); seg(564, 1066, 568, 1190, C.paper, 7); }
    head(L, t);
    ctx.restore();
    // --- snapping arm (viewer's left) ---
    ctx.save(); ctx.translate(0, by);
    snapArm(L, t, snapP);
    ctx.restore();
  }

  function sleeveColor(L) { return L.top === 'tee' ? L.c1 : L.top === 'cardigan' ? L.c1 : L.c1; }

  function topDetails(L, t) {
    switch (L.top) {
      case 'hoodie':
        fillRR(430, 1320, 220, 130, 30, L.c2);                                  // kangaroo pocket
        ctx.lineWidth = 5; ctx.strokeStyle = C.line; rr(430, 1320, 220, 130, 30); ctx.stroke();
        fillRR(372, 1488, 336, 20, 6, L.c2);
        break;
      case 'tee':
        ell(540, 1062, 62, 30, C.skinD);
        circle(540, 1235, 70, C.amber); text('zzz', 540, 1258, 52, C.navy, { stroke: false, shadow: false });
        break;
      case 'shirt':
        poly([[490, 1050], [540, 1110], [510, 1130]], C.white); poly([[590, 1050], [540, 1110], [570, 1130]], C.white);
        poly([[528, 1110], [552, 1110], [566, 1330], [540, 1360], [514, 1330]], C.navy3);
        for (let y = 1180; y < 1480; y += 70) circle(600, y, 6, C.white);
        break;
      case 'cardigan':
        poly([[470, 1050], [610, 1050], [600, 1510], [480, 1510]], C.paper);
        seg(476, 1060, 492, 1500, C.amberD, 8); seg(604, 1060, 588, 1500, C.amberD, 8);
        for (let y = 1200; y < 1480; y += 70) circle(600, y, 8, C.navy);
        for (let y = 1110; y < 1500; y += 40) { seg(380, y, 470, y, 'rgba(0,0,0,0.06)', 6); seg(612, y, 720, y, 'rgba(0,0,0,0.06)', 6); }
        break;
      case 'blazer':
        poly([[470, 1050], [610, 1050], [540, 1320]], C.white);
        poly([[528, 1080], [552, 1080], [562, 1290], [540, 1320], [518, 1290]], C.navy);
        poly([[455, 1052], [540, 1330], [500, 1330], [420, 1140]], L.c2); poly([[625, 1052], [540, 1330], [580, 1330], [660, 1140]], L.c2);
        circle(640, 1220, 26, C.amber); circle(640, 1220, 15, C.blue); circle(640, 1220, 6, C.amber);
        circle(540, 1400, 9, C.navy); circle(540, 1460, 9, C.navy);
        break;
      case 'toga':
        poly([[470, 1050], [610, 1050], [540, 1130]], C.white);
        poly([[455, 1050], [500, 1050], [520, 1960], [440, 1960]], C.amber); poly([[625, 1050], [580, 1050], [560, 1960], [640, 1960]], C.amber);
        poly([[455, 1050], [470, 1050], [480, 1960], [440, 1960]], C.amberD);
        for (let k = 0; k < 4; k++) seg(380 + k * 110, 1500, 360 + k * 120, 1960, 'rgba(255,255,255,0.05)', 12);
        break;
      case 'jacket':
        poly([[470, 1050], [610, 1050], [600, 1510], [480, 1510]], C.white);
        circle(540, 1250, 46, C.blue); tick(540, 1250, 50, C.white, 10);
        seg(476, 1060, 486, 1500, C.amber, 8); seg(604, 1060, 594, 1500, C.amber, 8);
        poly([[420, 1060], [470, 1050], [480, 1180]], L.c2); poly([[660, 1060], [610, 1050], [600, 1180]], L.c2);
        break;
    }
  }

  function leftArm(L, t) {
    const sc = sleeveColor(L), w = L.top === 'toga' ? 96 : 76;
    if (L.prop === 'card') {
      const k = P(t, 26.88, 27.1);
      const hx = lerp(742, 800, k), hy = lerp(1440, 1040, E.outBack(k));
      limb([[700, 1110], [800, 1300], [hx, hy + 40]], sc, w);
      card(hx - 10, hy - 70, t);
      handBall(hx, hy + 30);
      return;
    }
    if (L.prop === 'book') {
      limb([[700, 1110], [770, 1300], [650, 1300]], sc, w);
      outlined(() => rr(470, 1170, 200, 250, 14), C.blue);
      fillRR(482, 1182, 26, 226, 6, C.blueD); fillRR(530, 1230, 110, 16, 6, C.white); fillRR(530, 1262, 80, 12, 6, C.blueXL);
      handBall(650, 1300);
      return;
    }
    if (L.prop === 'scroll') {
      limb([[700, 1110], [770, 1300], [700, 1250]], sc, w);
      ctx.save(); ctx.translate(700, 1240); ctx.rotate(-0.5);
      outlined(() => rr(-30, -150, 60, 300, 26), C.paper); fillRR(-32, -20, 64, 40, 8, C.amber);
      ctx.restore();
      handBall(700, 1250);
      return;
    }
    limb([[700, 1110], [730, 1300], [742, 1420]], sc, w);
    if (L.top === 'hoodie' || L.top === 'blazer') fillRR(712, 1380, 64, 30, 10, L.c2);
    if (L.prop === 'coffee') {
      outlined(() => { ctx.beginPath(); ctx.moveTo(700, 1395); ctx.lineTo(790, 1395); ctx.lineTo(780, 1510); ctx.lineTo(710, 1510); ctx.closePath(); }, C.paper);
      fillRR(704, 1430, 82, 34, 4, C.amber);
      for (let k = 0; k < 3; k++) { const s = Math.sin(t * 3 + k * 2) * 10; seg(720 + k * 24 + s, 1370, 730 + k * 24 - s, 1320 - k * 6, 'rgba(255,255,255,0.35)', 6); }
    }
    handBall(742, 1450);
    if (L.prop === 'clicker') { outlined(() => rr(724, 1420, 36, 70, 10), C.navy); circle(742, 1442, 7, C.amber); }
    if (L.prop === 'lanyard') {
      seg(500, 1060, 560, 1240, C.amber, 7); seg(580, 1060, 560, 1240, C.amber, 7);
      outlined(() => rr(512, 1240, 96, 128, 10), C.white); fillRR(526, 1258, 68, 44, 6, C.blueXL); fillRR(526, 1314, 68, 10, 4, C.navy); fillRR(526, 1334, 46, 10, 4, C.navy3);
    }
  }
  function handBall(x, y) { ctx.beginPath(); ctx.arc(x, y, 36, 0, TAU); ctx.fillStyle = C.skin; ctx.fill(); ctx.lineWidth = 6; ctx.strokeStyle = C.line; ctx.stroke(); }

  function head(L, t) {
    const x = 540, y = 860;
    // back hair
    if (L.hair === 'messy') ell(x, y - 10, 122, 136, C.hair);
    // ears
    outlined(() => { ctx.beginPath(); ctx.ellipse(x - 104, y + 12, 22, 30, 0, 0, TAU); }, C.skin);
    outlined(() => { ctx.beginPath(); ctx.ellipse(x + 104, y + 12, 22, 30, 0, 0, TAU); }, C.skin);
    // face
    outlined(() => { ctx.beginPath(); ctx.ellipse(x, y, 104, 122, 0, 0, TAU); }, C.skin);
    // hair
    hair(L, x, y, t);
    face(L, x, y + 20, t);
    if (L.glasses) {
      ctx.lineWidth = 7; ctx.strokeStyle = C.navy;
      rr(x - 82, y + 2, 66, 50, 18); ctx.stroke(); rr(x + 16, y + 2, 66, 50, 18); ctx.stroke();
      seg(x - 16, y + 22, x + 16, y + 22, C.navy, 6);
    }
    if (L.cap) mortarboard(x, y, t);
  }

  function hair(L, x, y, t) {
    ctx.save();
    ctx.beginPath(); ctx.ellipse(x, y, 112, 132, 0, Math.PI * 1.04, Math.PI * 1.96); ctx.closePath();
    if (L.hair === 'messy') {
      ctx.beginPath(); ctx.moveTo(x - 112, y - 10);
      ctx.quadraticCurveTo(x - 120, y - 120, x - 40, y - 138);
      ctx.quadraticCurveTo(x + 60, y - 160, x + 112, y - 70); ctx.lineTo(x + 108, y - 10);
      ctx.quadraticCurveTo(x + 60, y - 70, x + 10, y - 40); ctx.quadraticCurveTo(x - 30, y - 90, x - 70, y - 40);
      ctx.quadraticCurveTo(x - 90, y - 30, x - 112, y - 10); ctx.closePath();
      ctx.fillStyle = C.hair; ctx.fill();
      // spikes sticking out
      for (let k = 0; k < 9; k++) {
        const a = Math.PI * (1.08 + k * 0.1), r0 = 118, r1 = 150 + rnd(k + 3) * 40;
        const w = 0.09;
        poly([[x + Math.cos(a - w) * r0, y - 8 + Math.sin(a - w) * r0 * 1.12], [x + Math.cos(a) * r1, y - 8 + Math.sin(a) * r1 * 1.1 + (k % 2 ? 10 : -6)], [x + Math.cos(a + w) * r0, y - 8 + Math.sin(a + w) * r0 * 1.12]], C.hair);
      }
      // fringe strands over the forehead
      poly([[x - 60, y - 70], [x - 20, y - 20], [x - 10, y - 74]], C.hair);
      poly([[x + 10, y - 76], [x + 40, y - 26], [x + 56, y - 80]], C.hair);
    } else {
      ctx.beginPath(); ctx.moveTo(x - 108, y + 10);
      ctx.quadraticCurveTo(x - 118, y - 130, x - 10, y - 142);
      ctx.quadraticCurveTo(x + 116, y - 140, x + 110, y + 4);
      ctx.quadraticCurveTo(x + 96, y - 64, x + 30, y - 74);
      ctx.quadraticCurveTo(x - 40, y - 96, x - 60, y - 46);   // side part sweep
      ctx.quadraticCurveTo(x - 86, y - 30, x - 108, y + 10); ctx.closePath();
      ctx.fillStyle = C.hair; ctx.fill();
      if (L.hair === 'slick') { seg(x - 40, y - 118, x + 50, y - 112, 'rgba(255,255,255,0.22)', 10); }
    }
    ctx.restore();
  }

  function mortarboard(x, y, t) {
    outlined(() => { ctx.beginPath(); ctx.ellipse(x, y - 98, 100, 42, 0, Math.PI, 0); ctx.lineTo(x + 100, y - 80); ctx.lineTo(x - 100, y - 80); ctx.closePath(); }, '#13204A');
    outlined(() => { ctx.beginPath(); ctx.moveTo(x - 190, y - 140); ctx.lineTo(x, y - 200); ctx.lineTo(x + 190, y - 140); ctx.lineTo(x, y - 84); ctx.closePath(); }, '#13204A');
    circle(x, y - 142, 10, C.amber);
    const sw = Math.sin(t * 5.2) * 0.12;
    ctx.save(); ctx.translate(x, y - 142); ctx.rotate(sw);
    seg(0, 0, 150, 18, C.amber, 6); seg(150, 18, 156, 110, C.amber, 6);
    fillRR(144, 100, 26, 56, 8, C.amber); for (let k = 0; k < 4; k++) seg(148 + k * 6, 150, 148 + k * 6, 176, C.amberD, 4);
    ctx.restore();
  }

  function face(L, x, y, t) {
    const blinkOn = ((t + 0.7) % 3.1) < 0.11;
    const ex = [x - 48, x + 48], ey = y - 6;
    // eye bags
    if (L.bags > 0) for (const e of ex) {
      ctx.beginPath(); ctx.ellipse(e, ey + 24, 30, 12, 0, 0.1, Math.PI - 0.1); ctx.strokeStyle = `rgba(80,60,140,${0.55 * L.bags})`; ctx.lineWidth = 8; ctx.stroke();
      ctx.beginPath(); ctx.ellipse(e, ey + 36, 26, 10, 0, 0.3, Math.PI - 0.3); ctx.strokeStyle = `rgba(80,60,140,${0.3 * L.bags})`; ctx.lineWidth = 6; ctx.stroke();
    }
    // eyes
    for (const e of ex) {
      if (blinkOn || L.mood === 'grin' && e > x) { // closed (or a wink)
        ctx.beginPath(); ctx.arc(e, ey + 4, 16, Math.PI * 1.1, Math.PI * 1.9); ctx.strokeStyle = C.line; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.stroke();
        continue;
      }
      ell(e, ey, 13, 17, C.line); circle(e + 4, ey - 6, 5, C.white);
      if (L.mood === 'tired' || L.mood === 'meh') { // heavy lids
        ctx.save(); ctx.beginPath(); ctx.rect(e - 20, ey - 26, 40, L.mood === 'tired' ? 24 : 16); ctx.fillStyle = C.skin; ctx.fill(); ctx.restore();
        seg(e - 18, ey - (L.mood === 'tired' ? 2 : 10), e + 18, ey - (L.mood === 'tired' ? 2 : 10), C.line, 6);
      }
    }
    // brows
    const bset = { tired: [10, -0.25], meh: [0, 0], nervous: [-6, 0.3], focus: [6, -0.15], proud: [-4, -0.1], happy: [-10, 0.1], grin: [-8, -0.05] }[L.mood];
    for (const [i, e] of ex.entries()) {
      const dir = i === 0 ? 1 : -1, by = ey - 42 + bset[0];
      ctx.save(); ctx.translate(e, by); ctx.rotate(bset[1] * dir * -1); seg(-22, 0, 22, 0, C.hair, 10); ctx.restore();
    }
    // cheeks
    if (['happy', 'grin', 'proud'].includes(L.mood)) { circle(x - 70, y + 34, 18, 'rgba(255,140,110,0.3)'); circle(x + 70, y + 34, 18, 'rgba(255,140,110,0.3)'); }
    // mouth
    const my = y + 52;
    ctx.lineCap = 'round';
    switch (L.mood) {
      case 'tired': ctx.beginPath(); ctx.moveTo(x - 24, my + 4); ctx.quadraticCurveTo(x - 8, my - 6, x + 4, my + 2); ctx.quadraticCurveTo(x + 16, my + 8, x + 26, my - 2); ctx.strokeStyle = C.line; ctx.lineWidth = 7; ctx.stroke(); break;
      case 'meh': seg(x - 22, my, x + 22, my - 4, C.line, 7); break;
      case 'nervous': ctx.beginPath(); ctx.moveTo(x - 30, my); ctx.quadraticCurveTo(x, my + 16, x + 30, my); ctx.lineTo(x - 30, my); ctx.fillStyle = C.white; ctx.fill(); ctx.strokeStyle = C.line; ctx.lineWidth = 6; ctx.stroke(); break;
      case 'focus': ctx.beginPath(); ctx.arc(x, my - 14, 22, 0.3 * Math.PI, 0.7 * Math.PI); ctx.strokeStyle = C.line; ctx.lineWidth = 7; ctx.stroke(); break;
      case 'proud': ctx.beginPath(); ctx.arc(x, my - 22, 34, 0.25 * Math.PI, 0.75 * Math.PI); ctx.strokeStyle = C.line; ctx.lineWidth = 8; ctx.stroke(); break;
      default: // happy / grin: open smile
        ctx.beginPath(); ctx.moveTo(x - 42, my - 8); ctx.quadraticCurveTo(x, my + 52, x + 42, my - 8); ctx.closePath();
        ctx.fillStyle = C.navy; ctx.fill();
        ctx.save(); ctx.clip(); fillRR(x - 40, my - 10, 80, 14, 4, C.white); circle(x, my + 34, 20, '#E8697A'); ctx.restore();
        ctx.lineWidth = 6; ctx.strokeStyle = C.line; ctx.stroke();
    }
  }

  // ---------- the snapping hand ----------
  function snapPose(t) { // 0 = ready (thumb + middle pressed), 1 = just snapped
    let p = 0;
    for (const s of SNAPS) {
      if (t >= s - 0.1 && t < s) p = Math.max(p, -0.25 * P(t, s - 0.1, s));             // wind-up squeeze
      if (t >= s && t < s + 0.45) p = Math.max(p, t < s + 0.12 ? 1 : 1 - E.outCubic(P(t, s + 0.12, s + 0.45)));
    }
    return p;
  }
  function snapArm(L, t, p) {
    const sc = sleeveColor(L), w = L.top === 'toga' ? 96 : 76;
    const hx = HAND.x, hy = HAND.y + (p < 0 ? -p * 30 : 0);
    limb([[380, 1110], [282, 1300], [hx + 6, hy + 70]], sc, w);
    if (L.top === 'toga') fillRR(250, 1150, 80, 220, 30, sc);
    // cuff
    ctx.save(); ctx.translate(hx + 6, hy + 70); ctx.rotate(-0.15);
    outlined(() => rr(-46, -14, 92, 34, 12), L.top === 'tee' ? C.skin : L.top === 'cardigan' ? C.amberD : L.c2);
    ctx.restore();
    hand(hx, hy, Math.max(0, p), 1.3 + (p < 0 ? p * 0.2 : 0));
  }
  function hand(x, y, p, s) {
    const f = (a, b) => [lerp(a[0], b[0], p) * s + x, lerp(a[1], b[1], p) * s + y];
    const fingers = [
      // [base, tipReady, tipSnapped, width]
      [[24, 12], [44, -30], [38, -62], 26],   // thumb
      [[-34, -10], [-50, -36], [-44, -30], 20], // pinky (curled)
      [[-22, -22], [-32, -58], [-26, -40], 22], // ring
      [[6, -28], [40, -40], [-14, 12], 24],   // middle: pressed to thumb -> slams into palm
      [[-8, -32], [-10, -78], [-2, -90], 23],  // index
    ];
    const pass = (col, extra) => {
      for (const [b, r, sn, w] of fingers) {
        const base = [b[0] * s + x, b[1] * s + y], tip = f(r, sn);
        seg(base[0], base[1], tip[0], tip[1], col, (w + extra) * s);
      }
      circle(x, y, (38 + extra / 2) * s, col);
    };
    pass(C.line, 12); pass(C.skin, 0);
    // knuckle hint
    seg(x - 26 * s, y - 2 * s, x + 4 * s, y - 10 * s, C.skinD, 4 * s);
  }

  function snapFX(t) {
    for (const s of SNAPS) {
      const d = t - s;
      if (d < 0 || d > 0.4) continue;
      const k = d / 0.4;
      // radiating strokes from the fingertips
      for (let i = 0; i < 12; i++) {
        const a = i / 12 * TAU + 0.2, r0 = 90 + 260 * E.outCubic(k), r1 = r0 + 90 * (1 - k);
        seg(HAND.x + Math.cos(a) * r0, HAND.y - 40 + Math.sin(a) * r0, HAND.x + Math.cos(a) * r1, HAND.y - 40 + Math.sin(a) * r1, i % 2 ? C.amber : C.white, 12 * (1 - k) + 2);
      }
      ctx.beginPath(); ctx.arc(HAND.x, HAND.y - 40, 60 + 380 * E.outCubic(k), 0, TAU); ctx.strokeStyle = `rgba(255,255,255,${0.8 * (1 - k)})`; ctx.lineWidth = 10; ctx.stroke();
      // little impact stars
      for (let i = 0; i < 3; i++) {
        const a = -2.2 + i * 0.6, r = 120 + 60 * k, cx = HAND.x + Math.cos(a) * r, cy = HAND.y - 40 + Math.sin(a) * r, z = 22 * (1 - k);
        poly([[cx, cy - z * 2], [cx + z * 0.5, cy - z * 0.5], [cx + z * 2, cy], [cx + z * 0.5, cy + z * 0.5], [cx, cy + z * 2], [cx - z * 0.5, cy + z * 0.5], [cx - z * 2, cy], [cx - z * 0.5, cy - z * 0.5]], C.amber);
      }
    }
  }

  // ---------- backgrounds ----------
  function bgHook(t) {
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0A1430'); g.addColorStop(1, '#050B1D'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // window with moon
    fillRR(90, 640, 250, 330, 10, '#0F1F47'); circle(270, 720, 40, '#E7ECF7'); circle(252, 708, 40, '#0F1F47');
    seg(215, 640, 215, 970, C.navy2, 10); seg(90, 805, 340, 805, C.navy2, 10);
    // sticky notes of panic
    const notes = [[800, 730, -0.12, 'deadline!!'], [890, 860, 0.1, 'revisi'], [780, 990, 0.06, 'besok?']];
    for (const [x, y, r, s] of notes) { ctx.save(); ctx.translate(x, y); ctx.rotate(r); fillRR(-80, -60, 180, 120, 6, C.amber); text(s, 10, 12, 30, C.navy, { stroke: false, shadow: false, weight: 800 }); ctx.restore(); }
    // laptop glow from below
    const lg = ctx.createRadialGradient(540, 1700, 50, 540, 1700, 900); lg.addColorStop(0, 'rgba(47,107,211,0.45)'); lg.addColorStop(1, 'rgba(47,107,211,0)');
    ctx.fillStyle = lg; ctx.fillRect(0, 0, W, H);
    fillRR(0, 1640, W, 280, 0, '#0B1532');
  }
  function bgKamar(t) {
    ctx.fillStyle = '#26386E'; ctx.fillRect(0, 0, W, H);
    for (let x = 0; x < W; x += 90) ctx.fillRect(x, 0, 2, 1500), ctx.fillStyle = '#2B3F7A';
    ctx.fillStyle = '#1F2F5E'; ctx.fillRect(0, 1500, W, 420);
    // string lights
    ctx.beginPath(); ctx.moveTo(0, 560); ctx.quadraticCurveTo(540, 680, 1080, 560); ctx.strokeStyle = C.navy; ctx.lineWidth = 4; ctx.stroke();
    for (let i = 0; i < 12; i++) { const u = (i + 0.5) / 12, x = u * W, y = 560 + 4 * 120 * u * (1 - u) * 1; circle(x, y + 10, 12, (Math.floor(t * 4) + i) % 3 ? C.amber : C.amberL); }
    // posters
    ctx.save(); ctx.translate(180, 820); ctx.rotate(-0.06); fillRR(-90, -120, 180, 240, 8, C.blueL); circle(0, -20, 50, C.amber); fillRR(-60, 70, 120, 18, 6, C.white); ctx.restore();
    ctx.save(); ctx.translate(900, 800); ctx.rotate(0.05); fillRR(-80, -100, 160, 200, 8, C.paper); fillRR(-60, -70, 120, 20, 6, C.blue); fillRR(-60, -36, 90, 14, 6, C.navy3); ctx.restore();
    // bed (left) + messy blanket
    fillRR(-40, 1260, 330, 300, 30, C.paper); fillRR(-40, 1300, 330, 60, 20, C.blueXL);
    poly([[-40, 1360], [120, 1330], [280, 1400], [300, 1560], [-40, 1560]], '#C9D7F1');
    // desk with junk (right)
    fillRR(760, 1300, 360, 24, 6, C.navy); fillRR(800, 1324, 20, 260, 4, C.navy);
    fillRR(820, 1210, 150, 90, 8, C.navy3); fillRR(830, 1220, 130, 70, 4, C.blueL);    // laptop
    outlined(() => { ctx.beginPath(); ctx.moveTo(990, 1230); ctx.lineTo(1060, 1230); ctx.lineTo(1050, 1300); ctx.lineTo(1000, 1300); ctx.closePath(); }, C.paper); // cup noodle
    fillRR(992, 1244, 66, 20, 4, C.amber);
    // papers & clothes on the floor
    for (let i = 0; i < 9; i++) { ctx.save(); ctx.translate(60 + rnd(i) * 960, 1620 + rnd(i + 4) * 240); ctx.rotate((rnd(i + 8) - 0.5) * 1.2); fillRR(-50, -36, 100, 72, 4, i % 3 ? C.paper : C.amber); if (i % 3) for (let l = 0; l < 3; l++) fillRR(-36, -20 + l * 16, 60, 6, 3, '#AFC0E0'); ctx.restore(); }
    ell(170, 1800, 140, 50, '#3A4A78'); ell(940, 1740, 110, 40, C.blueL);
  }
  function bgKelas(t) {
    ctx.fillStyle = '#E9EFFA'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#D5DFF2'; ctx.fillRect(0, 1460, W, 460);
    // projector screen with a slide
    fillRR(110, 560, 860, 520, 10, C.navy); fillRR(126, 576, 828, 488, 6, C.white);
    fillRR(170, 610, 380, 40, 8, C.blue); text('presentasi kelompok', 360, 700, 34, C.navy, { stroke: false, shadow: false, weight: 800, align: 'center', maxW: 380 });
    const bars = [0.4, 0.62, 0.5, 0.85];
    bars.forEach((v, i) => { const h = 300 * v * E.outCubic(P(t, 9.0 + i * 0.1, 9.5 + i * 0.1)); fillRR(620 + i * 75, 1020 - h, 52, h, 6, i === 3 ? C.amber : C.blueL); });
    for (let l = 0; l < 4; l++) fillRR(170, 760 + l * 60, 300 - l * 40, 18, 9, '#C6D3EC');
    // projector beam
    ctx.fillStyle = 'rgba(255,255,255,0.18)'; poly([[540, 0], [126, 576], [954, 576]], 'rgba(255,255,255,0.25)');
    fillRR(470, 0, 140, 50, 10, C.navy3);
    // desks + classmates silhouettes (bottom)
    for (let i = 0; i < 5; i++) { const x = 30 + i * 240; ell(x + 60, 1700, 70, 82, '#7F95C4'); fillRR(x - 20, 1760, 170, 200, 40, '#7F95C4'); }
    fillRR(0, 1820, W, 100, 0, '#5D73A6');
  }
  function bgPerpus(t) {
    ctx.fillStyle = '#132552'; ctx.fillRect(0, 0, W, H);
    // shelves full of books
    for (let row = 0; row < 7; row++) {
      const y = 200 + row * 230;
      fillRR(0, y + 190, W, 26, 0, C.navy2);
      let x = 10;
      for (let k = 0; x < W; k++) {
        const w = 34 + rnd(row * 50 + k) * 34, h = 120 + rnd(row * 70 + k) * 60;
        const col = [C.blue, C.paper, C.amber, C.blueL, C.navy3, C.blueXL][Math.floor(rnd(row * 90 + k) * 6)];
        const lean = rnd(row * 30 + k) > 0.93 ? 0.15 : 0;
        ctx.save(); ctx.translate(x, y + 190); ctx.rotate(lean); fillRR(0, -h, w - 4, h, 4, col); fillRR(6, -h + 20, w - 16, 8, 3, 'rgba(0,0,0,0.18)'); ctx.restore();
        x += w;
      }
    }
    // warm reading lamp pools
    for (const lx of [200, 880]) {
      const g = ctx.createRadialGradient(lx, 560, 20, lx, 560, 420); g.addColorStop(0, 'rgba(255,182,39,0.35)'); g.addColorStop(1, 'rgba(255,182,39,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    ctx.fillStyle = 'rgba(6,14,36,0.35)'; ctx.fillRect(0, 0, W, H);
    fillRR(0, 1640, W, 280, 0, '#0E1C42');
    // floating dust motes
    for (let i = 0; i < 20; i++) circle(rnd(i) * W, (rnd(i + 3) * 1600 - t * 20 * (0.5 + rnd(i))) % 1600 + 100, 4, 'rgba(255,215,122,0.5)');
  }
  function bgSeminar(t) {
    ctx.fillStyle = C.navy; ctx.fillRect(0, 0, W, H);
    // LED backdrop
    fillRR(60, 580, 960, 460, 16, C.blue);
    for (let x = 60; x < 1020; x += 24) ctx.fillStyle = 'rgba(255,255,255,0.04)', ctx.fillRect(x, 580, 2, 460);
    fillRR(60, 580, 960, 24, 8, C.amber);
    text('seminar nasional', 540, 670, 60, C.white, { stroke: false, shadow: false, weight: 900 });
    text('mahasiswa berprestasi 2026', 540, 718, 30, C.amberL, { stroke: false, shadow: false, weight: 600 });
    // spotlights
    for (const [x, a] of [[160, 0.35], [920, -0.35]]) {
      ctx.save(); ctx.translate(x, 0); ctx.rotate(a + Math.sin(t * 0.9 + x) * 0.05);
      const g = ctx.createLinearGradient(0, 0, 0, 1700); g.addColorStop(0, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-30, 0); ctx.lineTo(30, 0); ctx.lineTo(260, 1700); ctx.lineTo(-260, 1700); ctx.closePath(); ctx.fill(); ctx.restore();
    }
    // stage floor
    fillRR(0, 1600, W, 320, 0, '#0E1C45'); fillRR(0, 1600, W, 14, 0, C.amber);
    // audience heads
    for (let i = 0; i < 8; i++) { ell(60 + i * 140, 1880, 60, 70, '#060E24'); }
  }
  function bgWisuda(t) {
    ctx.fillStyle = '#0F2A66'; ctx.fillRect(0, 0, W, H);
    // curtains
    for (let x = 0; x < W; x += 60) { const g = ctx.createLinearGradient(x, 0, x + 60, 0); g.addColorStop(0, '#12307A'); g.addColorStop(0.5, '#1B44A0'); g.addColorStop(1, '#0E2766'); ctx.fillStyle = g; ctx.fillRect(x, 0, 60, 1600); }
    // amber valance
    for (let x = 0; x < W; x += 120) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 120, 0); ctx.lineTo(x + 120, 120); ctx.quadraticCurveTo(x + 60, 200, x, 120); ctx.closePath(); ctx.fillStyle = C.amber; ctx.fill(); }
    fillRR(0, 1600, W, 320, 0, C.navy); fillRR(0, 1600, W, 14, 0, C.amber);
    // confetti
    for (let i = 0; i < 70; i++) {
      const sp = 160 + rnd(i) * 220, x = rnd(i + 7) * W + Math.sin(t * 2 + i) * 30;
      const y = ((rnd(i + 2) * 2000 + (t - 21.6) * sp) % 2000) - 60;
      ctx.save(); ctx.translate(x, y); ctx.rotate(t * 3 * (rnd(i + 5) - 0.5) * 4 + i);
      fillRR(-12, -6, 24, 12, 3, [C.amber, C.white, C.blueXL, C.amberL][i % 4]); ctx.restore();
    }
  }
  function bgMintask(t) {
    const g = ctx.createRadialGradient(540, 900, 50, 540, 900, 1400); g.addColorStop(0, '#2F6BD3'); g.addColorStop(1, C.blue);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // rotating rays
    ctx.save(); ctx.translate(800, 1000); ctx.rotate(t * 0.15);
    for (let i = 0; i < 16; i++) { ctx.rotate(TAU / 16); ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(2400, -220); ctx.lineTo(2400, 220); ctx.closePath(); ctx.fill(); }
    ctx.restore();
    for (let i = 0; i < 26; i++) {
      const x = rnd(i) * W, y = rnd(i + 9) * 1700 + 100, z = 6 + 10 * Math.abs(Math.sin(t * 3 + i));
      poly([[x, y - z], [x + z * 0.3, y - z * 0.3], [x + z, y], [x + z * 0.3, y + z * 0.3], [x, y + z], [x - z * 0.3, y + z * 0.3], [x - z, y], [x - z * 0.3, y - z * 0.3]], i % 3 ? 'rgba(255,255,255,0.7)' : C.amber);
    }
    fillRR(0, 1640, W, 280, 0, C.blueD);
  }

  // ---------- the MinTask card ----------
  function card(x, y, t) {
    const s = E.outBack(P(t, 26.88, 27.15));
    if (s <= 0) return;
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.rotate(-0.12 + Math.sin(t * 2.6) * 0.03);
    const glow = 0.5 + 0.5 * Math.sin(t * 6);
    ctx.shadowColor = `rgba(156,192,255,${0.7 + 0.3 * glow})`; ctx.shadowBlur = 60;
    fillRR(-150, -95, 300, 190, 22, C.white);
    ctx.shadowBlur = 0;
    fillRR(-140, -85, 280, 170, 16, C.blue);
    fillRR(-118, -62, 54, 40, 8, C.amber); seg(-104, -62, -104, -22, C.amberD, 3); seg(-78, -62, -78, -22, C.amberD, 3);
    ctx.drawImage(mark, 62, -70, 60, 60);
    text('mintask', 0, 52, 54, C.white, { stroke: false, shadow: false, weight: 900 });
    // shine sweep
    const sh = ((t - 27.0) % 1.92) / 0.6;
    if (sh > 0 && sh < 1) { ctx.save(); rr(-140, -85, 280, 170, 16); ctx.clip(); ctx.rotate(0.4); const g = ctx.createLinearGradient(-200 + sh * 500, 0, -120 + sh * 500, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,0.5)'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.fillRect(-300, -300, 600, 600); ctx.restore(); }
    ctx.restore();
  }

  // tasks get handed over: chips fly into the card on the beat
  const HANDOFF = ['makalah', 'desain ppt', 'olah data', 'edit video', 'cetak poster', 'skripsi?'];
  function handoff(t) {
    const cx = 790, cy = 970;
    HANDOFF.forEach((s, i) => {
      const t0 = 29.76 + i * BEAT * 2, t1 = t0 + BEAT * 1.6;
      if (t < t0 || t > t1 + 0.5) return;
      const side = i % 2 ? 1 : -1;
      const sx = side < 0 ? 170 : 910, sy = 1250 + (i % 3) * 120;
      const p = E.outCubic(P(t, t0, t1));
      const x = lerp(sx, cx, p), y = lerp(sy, cy, p) - Math.sin(p * Math.PI) * 160;
      const sc = lerp(1, 0.2, Math.pow(p, 3));
      if (t <= t1) {
        ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc); ctx.rotate((1 - p) * 0.2 * side);
        ctx.font = F(800, 38); const w = ctx.measureText(s).width + 64;
        fillRR(-w / 2, -40, w, 80, 40, C.white); ctx.lineWidth = 5; ctx.strokeStyle = C.navy; rr(-w / 2, -40, w, 80, 40); ctx.stroke();
        text(s, 0, 13, 38, C.navy, { stroke: false, shadow: false, weight: 800 });
        ctx.restore();
      } else {
        const k = (t - t1) / 0.5;
        ctx.beginPath(); ctx.arc(cx, cy, 60 + 120 * k, 0, TAU); ctx.strokeStyle = `rgba(255,215,122,${1 - k})`; ctx.lineWidth = 8; ctx.stroke();
        ctx.globalAlpha = 1 - k; circle(cx + 150, cy - 110 - 40 * k, 40, C.navy); tick(cx + 150, cy - 110 - 40 * k, 44, C.amber, 10); ctx.globalAlpha = 1;
      }
    });
  }

  // ---------- on-screen text ----------
  function hookText(t) {
    const s = 1 + 0.12 * (1 - E.outCubic(P(t, 0, 0.25)));
    withScale(540, 420, s, () => {
      ctx.save(); ctx.translate(540, 330); ctx.rotate(-0.05);
      text('snap!', 0, 0, 190, C.amber, { sw: 26 });
      ctx.restore();
      text('semester kemarin', 540, 470, 96, C.white, { sw: 16, maxW: 960 });
      // "vs" chip + "sekarang."
      const vs = 1;
      withScale(540, 570, vs, () => {
        ctx.font = F(900, 96); ctx.wordSpacing = '13px'; const w1 = ctx.measureText('vs ').width, w2 = ctx.measureText('sekarang.').width, x0 = 540 - (w1 + w2) / 2;
        text('vs', x0 + w1 / 2 - 14, 590, 96, C.amber, { sw: 16, align: 'center' });
        text('sekarang.', x0 + w1 + w2 / 2, 590, 96, C.white, { sw: 16, align: 'center' });
      });
    });
  }
  const STAGES = [null, ['semester 1', 'kamar berantakan'], ['semester 3', 'presentasi pertama'], ['semester 5', 'hidup di perpustakaan'], ['semester 7', 'seminar, jas almamater'], ['lulus', 'toga & wisuda']];
  function stageText(i, t) {
    const [a, b] = STAGES[i], s0 = SNAPS[i];
    const p = pop(t, s0 + 0.02, 0.3);
    withScale(540, 330, p, () => {
      ctx.font = F(900, 110); const w = ctx.measureText(a).width + 90;
      ctx.save(); ctx.translate(540, 300); ctx.rotate(-0.03);
      fillRR(-w / 2, -95, w, 150, 34, C.amber); ctx.lineWidth = 8; ctx.strokeStyle = C.navy; rr(-w / 2, -95, w, 150, 34); ctx.stroke();
      text(a, 0, 20, 110, C.navy, { stroke: false, shadow: false });
      ctx.restore();
    });
    const q = E.outCubic(P(t, s0 + 0.2, s0 + 0.5));
    if (q > 0) { ctx.globalAlpha = q; text(b, 540, 450 + (1 - q) * 30, 54, C.white, { sw: 12, weight: 800 }); ctx.globalAlpha = 1; }
    // tiny progress pips
    for (let k = 1; k <= 5; k++) circle(540 + (k - 3) * 44, 510, k <= i ? 12 : 9, k <= i ? C.amber : 'rgba(255,255,255,0.35)');
  }
  function mintaskText(t) {
    const a = 27.12;
    ctx.save(); ctx.translate(540, 300); ctx.rotate(-0.03);
    withScale(0, 0, pop(t, a), () => { text('snap terbaik:', 0, 0, 100, C.amber, { sw: 18 }); });
    ctx.restore();
    const lines = ['serahkan yang', 'bukan keahlianmu.'];
    lines.forEach((l, i) => {
      const t0 = a + 0.24 + i * BEAT * 0.5, q = E.outBack(P(t, t0, t0 + 0.3));
      if (q <= 0) return;
      withScale(540, 420 + i * 100, q, () => text(l, 540, 440 + i * 104, 88, C.white, { sw: 16, maxW: 980 }));
    });
  }

  // ---------- end card ----------
  function endCard(t) {
    const s = 34.56;
    const g = ctx.createRadialGradient(540, 800, 50, 540, 800, 1300); g.addColorStop(0, '#2459B8'); g.addColorStop(1, C.blue);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // beat pulses
    const ph = ((t - s) / BEAT) % 1;
    ctx.beginPath(); ctx.arc(540, 820, 300 + ph * 260, 0, TAU); ctx.strokeStyle = `rgba(255,255,255,${0.15 * (1 - ph)})`; ctx.lineWidth = 6; ctx.stroke();
    const lp = E.outBack(P(t, s + 0.08, s + 0.45));
    const bump = 1 + 0.03 * Math.exp(-ph * 6);
    withScale(540, 820, lp * bump, () => ctx.drawImage(mark, 540 - 210, 820 - 210, 420, 420));
    const wp = E.outBack(P(t, s + BEAT, s + BEAT + 0.35));
    withScale(540, 1150, wp, () => text('taskkora', 540, 1190, 150, C.white, { stroke: false, shadow: C.blueD, ls: -4 }));
    const tp = E.outBack(P(t, s + BEAT * 2, s + BEAT * 2 + 0.35));
    withScale(540, 1320, tp, () => {
      ctx.font = F(800, 52); const w = ctx.measureText('ada task? taskkora-in aja.').width + 80;
      fillRR(540 - w / 2, 1270, w, 100, 50, C.amber);
      text('ada task? taskkora-in aja.', 540, 1338, 52, C.navy, { stroke: false, shadow: false, weight: 800 });
    });
    // snap sparkles around the logo, on the beat
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * TAU + 0.3, r = 300 + 40 * Math.exp(-ph * 4), x = 540 + Math.cos(a) * r, y = 820 + Math.sin(a) * r, z = 14 * (1 - ph * 0.6) * lp;
      poly([[x, y - z], [x + z * 0.3, y - z * 0.3], [x + z, y], [x + z * 0.3, y + z * 0.3], [x, y + z], [x - z * 0.3, y + z * 0.3], [x - z, y], [x - z * 0.3, y - z * 0.3]], i % 2 ? C.amber : C.white);
    }
  }

  // ---------- scene composer ----------
  function scene(i, t) {
    const id = LOOK_IDS[i];
    if (id === 'end') { endCard(t); return; }
    ({ hook: bgHook, kamar: bgKamar, kelas: bgKelas, perpus: bgPerpus, seminar: bgSeminar, wisuda: bgWisuda, mintask: bgMintask })[id](t);
    // soft contact shadow on the floor
    ell(540, 1905, 260, 30, 'rgba(0,0,0,0.25)');
    person(LOOKS[id], t, snapPose(t));
    if (id === 'mintask') handoff(t);
    snapFX(t);
    if (id === 'hook') hookText(t);
    else if (id === 'mintask') mintaskText(t);
    else stageText(i, t);
  }

  function watermark() {
    ctx.save(); ctx.globalAlpha = 0.3;
    ctx.font = F(600, 30); ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = C.white;
    ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 4;
    ctx.fillText('@taskkora__', 1040, 1872);
    ctx.restore();
  }

  // =====================================================================
  function render(t) {
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.letterSpacing = '0px';
    const i = lookIndex(t), s = SNAPS[i];
    const wipe = i > 0 ? E.outExpo(P(t, s, s + 0.16)) : 1;
    if (wipe < 1) {
      scene(i - 1, t);
      ctx.save(); ctx.beginPath(); ctx.arc(HAND.x, HAND.y - 40, 2300 * wipe, 0, TAU); ctx.clip();
      scene(i, t); ctx.restore();
      // bright ring at the wipe edge
      ctx.beginPath(); ctx.arc(HAND.x, HAND.y - 40, 2300 * wipe, 0, TAU); ctx.strokeStyle = i === 7 ? C.white : C.amber; ctx.lineWidth = 26; ctx.stroke();
    } else scene(i, t);
    // snap flash
    const fd = t - s;
    if (fd >= 0 && fd < 0.1) { ctx.globalAlpha = (i === 0 ? 0.12 : 0.5) * (1 - fd / 0.1); ctx.fillStyle = C.white; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
    // pre-snap whoosh streaks
    const next = SNAPS[i + 1];
    if (next != null && t > next - 0.14) {
      const k = P(t, next - 0.14, next);
      for (let j = 0; j < 7; j++) { const y = 300 + j * 230 + rnd(j) * 80, x = lerp(-400, 1400, k) + rnd(j + 4) * 200; seg(x - 300, y, x, y, 'rgba(255,255,255,0.35)', 6); }
    }
    watermark();
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

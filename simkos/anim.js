/* "Bar tugasmu merah. Lanjut?" — cheerful 3D life-sim spot, 40s, 1080x1920.
 * A cut-away boarding-house room rendered with three.js (WebGL, offscreen) and composited into a 2D
 * canvas with the life-sim HUD on top: need bars, thought bubbles, floating icons, a pie menu.
 * Every frame is a pure function of time; the script (bar steps, blocking, voice) is in timeline.js. */
(() => {
  'use strict';

  const W = 1080, H = 1920, DURATION = 40;
  const TL = window.SIMKOS, { T, BARS, START, STEPS, STEP_DUR, SPOT, ACTS } = TL;
  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d');

  const C = {
    blue: '#184AA1', blueL: '#4F7FD6', blueXL: '#DCE6F8', navy: '#0E1B3D', navy2: '#1B2A5C', white: '#FFFFFF',
    amber: '#FFB627', amberD: '#E29A0E', green: '#2FBF71', greenL: '#7BE3A7', red: '#E8484D', redL: '#FF8A8D',
    bg1: '#E9F0FC', bg2: '#C9D9F4', ink: '#0E1B3D', mute: '#5B6B91',
  };
  const F = (w, s) => `${w} ${s}px "PJS", sans-serif`;

  // ---------- math ----------
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const P = (t, a, b) => clamp((t - a) / (b - a));
  const TAU = Math.PI * 2;
  const E = {
    outCubic: x => 1 - Math.pow(1 - x, 3),
    inOutCubic: x => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
    inOutSine: x => -(Math.cos(Math.PI * x) - 1) / 2,
    outBack: x => { const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); },
    outElastic: x => (x <= 0 ? 0 : x >= 1 ? 1 : Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * (TAU / 3)) + 1),
  };
  const bump = (t, a, b) => Math.sin(P(t, a, b) * Math.PI);
  const rnd = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const mixC = (a, b, t) => { const A = hex(a), B = hex(b); return `rgb(${A.map((v, i) => Math.round(lerp(v, B[i], t))).join(',')})`; };

  // ---------- assets ----------
  const mark = new Image();
  const ready = Promise.all([
    new Promise((res, rej) => { mark.onload = res; mark.onerror = rej; mark.src = 'mark.png'; }),
    document.fonts.load(F(800, 40)), document.fonts.load(F(700, 40)), document.fonts.load(F(500, 40)),
  ]).then(() => document.fonts.ready);

  // =====================================================================
  //  BARS (from timeline steps)
  // =====================================================================
  const steps = [...STEPS].sort((a, b) => a.t - b.t);
  { const cur = { ...START }; for (const s of steps) { s.from = cur[s.bar]; s.up = s.to > s.from; cur[s.bar] = s.to; } }
  function barVal(name, t) {
    let v = START[name];
    for (const s of steps) {
      if (s.bar !== name || t < s.t) continue;
      const d = s.big ? 0.9 : STEP_DUR;
      v = lerp(s.from, s.to, s.big ? E.outCubic(P(t, s.t, s.t + d)) : E.outBack(P(t, s.t, s.t + d)));
    }
    return v;
  }
  const lastStep = (name, t) => { let r = null; for (const s of steps) if (s.bar === name && s.t <= t) r = s; return r; };
  const barCol = v => (v < 0.3 ? C.red : v < 0.62 ? C.amber : C.green);

  // =====================================================================
  //  THREE.js room
  // =====================================================================
  const glc = document.createElement('canvas'); glc.width = W; glc.height = H;
  const R3 = new THREE.WebGLRenderer({ canvas: glc, antialias: true, alpha: true, preserveDrawingBuffer: true });
  R3.setPixelRatio(1); R3.setSize(W, H, false); R3.setClearColor(0x000000, 0);
  R3.shadowMap.enabled = true; R3.shadowMap.type = THREE.PCFSoftShadowMap;
  R3.toneMapping = THREE.ACESFilmicToneMapping; R3.toneMappingExposure = 1.05;
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(24, W / H, 1, 200);

  const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: o.r ?? 0.85, metalness: 0, ...o });
  const M = {
    wood: mat('#E8C99A'), woodD: mat('#C99A62'), navy: mat(C.navy2), navyD: mat(C.navy), blue: mat(C.blue), blueL: mat(C.blueL),
    white: mat('#F7F8FB'), cream: mat('#FFF6E6'), amber: mat(C.amber), amberD: mat(C.amberD), skin: mat('#F6C9A3', { r: 0.7 }),
    hair: mat('#2B2140', { r: 0.6 }), black: mat('#141625', { r: 0.4 }), pink: mat('#FF9BA8'), green: mat('#3FAE6A'), greenD: mat('#2A8A50'),
    grey: mat('#AEB7CC'), noodle: mat('#FFE3A0'), red: mat('#E8484D'),
  };
  function box(w, h, d, m, x, y, z, o = {}) {
    const g = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    g.position.set(x, y, z); g.castShadow = o.cast ?? true; g.receiveShadow = true;
    (o.parent || scene).add(g); return g;
  }
  function cyl(rt, rb, h, m, x, y, z, o = {}) {
    const g = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, o.seg || 32), m);
    g.position.set(x, y, z); g.castShadow = o.cast ?? true; g.receiveShadow = true;
    (o.parent || scene).add(g); return g;
  }
  function sph(r, m, x, y, z, o = {}) {
    const g = new THREE.Mesh(new THREE.SphereGeometry(r, 32, 20), m);
    g.position.set(x, y, z); g.castShadow = o.cast ?? true; g.receiveShadow = true;
    if (o.s) g.scale.set(...o.s);
    (o.parent || scene).add(g); return g;
  }
  function texCanvas(w, h, draw) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
  }

  // lights
  const hemi = new THREE.HemisphereLight(0xffffff, 0xb9c8ea, 1.6); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff3e0, 2.6); sun.position.set(7, 12, 5); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: 1, far: 40 });
  sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.02; sun.shadow.radius = 4; scene.add(sun);
  const lamp = new THREE.PointLight(0xffc56b, 0, 7, 1.6); lamp.position.set(3.45, 2.0, -3.45); scene.add(lamp);
  const screenGlow = new THREE.PointLight(0x9cc3ff, 0, 2.2, 2); scene.add(screenGlow);

  // ---- floor slab + walls (cut-away) ----
  const floorTex = texCanvas(1024, 1024, (g, w, h) => {
    g.fillStyle = '#EBCFA3'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 16; i++) {
      g.fillStyle = i % 2 ? '#E6C695' : '#EDD3AA'; g.fillRect(0, i * 64, w, 64);
      g.fillStyle = 'rgba(150,100,50,0.25)'; g.fillRect(0, i * 64, w, 3);
      for (let k = 0; k < 3; k++) { const x = ((i * 337 + k * 401) % 1024); g.fillRect(x, i * 64, 3, 64); }
    }
  });
  const slabSide = mat(C.navy2);
  box(8, 0.35, 8, [slabSide, slabSide, mat('#FFFFFF', { map: floorTex, r: 0.7 }), slabSide, slabSide, slabSide], 0, -0.175, 0, { cast: false });
  const wallBack = mat('#F4F6FB'), wallLeft = mat(C.blue), cap = mat(C.navy2);
  box(8.3, 3.3, 0.3, [wallBack, wallBack, cap, wallBack, wallBack, wallBack], -0.15, 1.65 - 0.175, -4.15, { cast: false });
  box(0.3, 3.3, 8, [wallLeft, wallLeft, cap, wallLeft, wallLeft, wallLeft], -4.15, 1.65 - 0.175, 0, { cast: false });
  // baseboards + a wainscot stripe on the back wall
  box(8, 0.14, 0.04, M.white, 0, 0.07, -3.98, { cast: false });
  box(8, 0.06, 0.03, mat('#D7E1F4'), 0, 1.1, -3.985, { cast: false });
  box(0.04, 0.14, 8, M.white, -3.98, 0.07, 0, { cast: false });

  // rug
  const rugTex = texCanvas(512, 512, (g) => {
    g.fillStyle = '#FFFFFF'; g.beginPath(); g.arc(256, 256, 256, 0, TAU); g.fill();
    g.strokeStyle = C.blue; g.lineWidth = 26; g.beginPath(); g.arc(256, 256, 214, 0, TAU); g.stroke();
    g.strokeStyle = C.amber; g.lineWidth = 10; g.beginPath(); g.arc(256, 256, 180, 0, TAU); g.stroke();
    g.fillStyle = C.blueXL; g.beginPath(); g.arc(256, 256, 150, 0, TAU); g.fill();
  });
  const rug = new THREE.Mesh(new THREE.CircleGeometry(1.75, 64), new THREE.MeshStandardMaterial({ map: rugTex, transparent: true, roughness: 1 }));
  rug.rotation.x = -Math.PI / 2; rug.position.set(0.3, 0.012, 0.45); rug.receiveShadow = true; scene.add(rug);

  // window with sky that time-lapses during sleep
  box(1.9, 1.35, 0.12, M.white, 1.95, 2.0, -3.96);
  const skyMat = new THREE.MeshBasicMaterial({ color: 0x9fd0ff });
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(1.66, 1.12), skyMat); sky.position.set(1.95, 2.0, -3.895); scene.add(sky);
  box(0.06, 1.12, 0.04, M.white, 1.95, 2.0, -3.88, { cast: false }); box(1.66, 0.06, 0.04, M.white, 1.95, 2.0, -3.88, { cast: false });
  const sunDisc = new THREE.Mesh(new THREE.CircleGeometry(0.13, 24), new THREE.MeshBasicMaterial({ color: 0xffe08a })); sunDisc.position.set(2.4, 2.25, -3.89); scene.add(sunDisc);
  box(0.36, 1.6, 0.08, M.amber, 0.88, 1.95, -3.86); box(0.36, 1.6, 0.08, M.amber, 3.02, 1.95, -3.86); // curtains
  box(2.6, 0.06, 0.06, M.navyD, 1.95, 2.78, -3.86);

  // wall clock (time-lapse)
  const clockG = new THREE.Group(); clockG.position.set(-0.55, 2.35, -3.97); scene.add(clockG);
  const cf = cyl(0.36, 0.36, 0.06, M.white, 0, 0, 0.0, { parent: clockG }); cf.rotation.x = Math.PI / 2;
  const cr = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.04, 12, 40), M.navyD); clockG.add(cr); cr.position.z = 0.03;
  const hHour = box(0.05, 0.2, 0.02, M.navyD, 0, 0.08, 0.05, { parent: clockG, cast: false });
  const hMin = box(0.035, 0.28, 0.02, M.blue, 0, 0.12, 0.06, { parent: clockG, cast: false });
  const hourPivot = new THREE.Group(), minPivot = new THREE.Group(); clockG.add(hourPivot, minPivot);
  hourPivot.add(hHour); minPivot.add(hMin);

  // poster + shelf on the blue wall
  const posterTex = texCanvas(360, 480, (g, w, h) => {
    g.fillStyle = '#FFF6E6'; g.fillRect(0, 0, w, h);
    g.fillStyle = C.amber; g.beginPath(); g.arc(250, 140, 60, 0, TAU); g.fill();
    g.fillStyle = C.blue; g.beginPath(); g.moveTo(0, 380); g.lineTo(130, 190); g.lineTo(230, 330); g.lineTo(290, 260); g.lineTo(360, 380); g.fill();
    g.fillStyle = C.navy; g.font = '800 54px "PJS", sans-serif'; g.textAlign = 'center'; g.fillText('SEMANGAT!', 180, 450);
  });
  const poster = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.45), new THREE.MeshStandardMaterial({ map: posterTex, roughness: 0.9 }));
  poster.rotation.y = Math.PI / 2; poster.position.set(-3.985, 2.05, -1.9); scene.add(poster);
  box(0.36, 0.05, 1.5, M.white, -3.82, 2.0, 1.6);
  [['#E8484D', 0.32], [C.amber, 0.38], [C.blueL, 0.3], ['#FFFFFF', 0.36], [C.navy2, 0.34]].forEach(([c, h], i) => box(0.26, h, 0.11, mat(c), -3.84, 2.03 + h / 2, 1.05 + i * 0.14));

  // bed
  box(2.3, 0.3, 3.3, M.navy, -2.65, 0.22, -2.3);
  box(2.2, 0.26, 3.15, M.white, -2.65, 0.5, -2.3);
  const blanket = box(2.26, 0.12, 2.0, M.blue, -2.65, 0.66, -1.62);
  box(2.27, 0.02, 0.18, M.white, -2.65, 0.73, -2.55, { cast: false });
  sph(0.5, M.white, -2.65, 0.74, -3.45, { s: [1.6, 0.4, 0.75] });
  box(2.3, 1.1, 0.16, M.navy, -2.65, 0.75, -3.92);
  box(0.6, 0.55, 0.55, M.woodD, -0.95, 0.27, -3.6); // nightstand
  cyl(0.12, 0.16, 0.34, M.amber, -0.95, 0.72, -3.6); sph(0.17, mat('#FFF1C8', { emissive: '#FFD27A', emissiveIntensity: 0.5 }), -0.95, 1.0, -3.6);

  // desk + laptop + the task pile
  box(1.15, 0.08, 2.1, M.wood, -3.4, 1.0, 1.55);
  [[-3.85, 0.65], [-2.95, 0.65], [-3.85, 2.45], [-2.95, 2.45]].forEach(([x, z]) => box(0.07, 0.96, 0.07, M.woodD, x, 0.48, z));
  box(0.55, 0.03, 0.42, M.grey, -3.35, 1.055, 1.15);
  const lapScreen = box(0.03, 0.36, 0.52, M.navyD, -3.6, 1.24, 1.15);
  const lapGlow = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.3), new THREE.MeshBasicMaterial({ color: 0x9cc3ff })); lapGlow.rotation.y = Math.PI / 2; lapGlow.position.set(-3.58, 1.24, 1.15); scene.add(lapGlow);
  const pile = new THREE.Group(); pile.position.set(-3.35, 1.04, 2.05); scene.add(pile);
  for (let i = 0; i < 9; i++) { const b = box(0.5, 0.055, 0.66, i % 3 === 1 ? M.cream : M.white, (rnd(i) - 0.5) * 0.08, 0.03 + i * 0.06, (rnd(i + 3) - 0.5) * 0.08, { parent: pile }); b.rotation.y = (rnd(i + 7) - 0.5) * 0.3; }
  const pileTag = box(0.06, 0.12, 0.2, M.red, 0.26, 0.45, 0.1, { parent: pile });
  const chair = new THREE.Group(); chair.position.set(-2.55, 0, 1.55); scene.add(chair);
  box(0.6, 0.08, 0.6, M.blue, 0, 0.58, 0, { parent: chair }); box(0.08, 0.7, 0.6, M.blue, 0.28, 0.95, 0, { parent: chair });
  cyl(0.04, 0.04, 0.55, M.navyD, 0, 0.28, 0, { parent: chair });

  // plant
  cyl(0.24, 0.18, 0.42, M.amber, -3.55, 0.21, -0.1);
  [[0, 0.75, 0, 0.32], [0.14, 0.95, 0.1, 0.24], [-0.12, 1.05, -0.08, 0.22], [0.05, 1.2, -0.05, 0.18]].forEach(([x, y, z, r], i) => sph(r, i % 2 ? M.greenD : M.green, -3.55 + x, y, -0.1 + z));

  // sofa
  const sofa = new THREE.Group(); sofa.position.set(2.0, 0, -3.25); scene.add(sofa);
  box(2.7, 0.42, 1.05, M.navy, 0, 0.3, 0.05, { parent: sofa });
  box(2.7, 0.85, 0.3, M.navy, 0, 0.72, -0.45, { parent: sofa });
  box(0.28, 0.65, 1.05, M.navy, -1.36, 0.5, 0.05, { parent: sofa }); box(0.28, 0.65, 1.05, M.navy, 1.36, 0.5, 0.05, { parent: sofa });
  box(1.2, 0.16, 0.85, M.blue, -0.62, 0.58, 0.1, { parent: sofa }); box(1.2, 0.16, 0.85, M.blue, 0.62, 0.58, 0.1, { parent: sofa });
  const pil1 = box(0.5, 0.45, 0.16, M.amber, -0.95, 0.88, -0.22, { parent: sofa }); pil1.rotation.z = 0.15;
  const pil2 = box(0.46, 0.42, 0.16, M.white, 1.0, 0.88, -0.22, { parent: sofa }); pil2.rotation.z = -0.12;
  // floor lamp
  cyl(0.22, 0.26, 0.05, M.navyD, 3.55, 0.03, -3.55); cyl(0.025, 0.025, 1.9, M.navyD, 3.55, 1.0, -3.55);
  cyl(0.2, 0.32, 0.38, mat('#FFF1C8', { emissive: '#FFC56B', emissiveIntensity: 0.3 }), 3.55, 2.05, -3.55);

  // noodle corner: cushion + low table + bowl
  cyl(0.42, 0.45, 0.16, M.blueL, SPOT.eat[0], 0.08, SPOT.eat[1]);
  cyl(0.6, 0.6, 0.06, M.wood, 3.05, 0.42, 1.25); cyl(0.07, 0.09, 0.4, M.woodD, 3.05, 0.2, 1.25);
  const bowl = new THREE.Group(); bowl.position.set(2.9, 0.45, 1.1); scene.add(bowl);
  const bowlGeo = new THREE.LatheGeometry([0, 0.1, 0.16, 0.2, 0.22].map((r, i) => new THREE.Vector2(r || 0.001, i * 0.045)), 32);
  const bw = new THREE.Mesh(bowlGeo, mat('#FFFFFF', { side: THREE.DoubleSide })); bw.castShadow = true; bowl.add(bw);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.205, 0.015, 8, 32), M.red); ring.rotation.x = Math.PI / 2; ring.position.y = 0.14; bowl.add(ring);
  const soup = cyl(0.19, 0.19, 0.02, M.noodle, 0, 0.15, 0, { parent: bowl, cast: false });
  sph(0.05, mat('#FFFFFF'), 0.06, 0.17, 0.03, { parent: bowl, s: [1, 0.5, 1] }); sph(0.03, M.amber, 0.06, 0.18, 0.03, { parent: bowl }); // egg
  box(0.1, 0.02, 0.05, M.green, -0.07, 0.165, -0.04, { parent: bowl });

  // beanbag
  sph(0.62, M.amber, SPOT.bag[0], 0.34, SPOT.bag[1], { s: [1, 0.62, 1] });
  sph(0.5, M.amberD, SPOT.bag[0] - 0.22, 0.55, SPOT.bag[1] - 0.22, { s: [1, 0.8, 0.7] });

  // =====================================================================
  //  the student (procedural rig)
  // =====================================================================
  const ch = new THREE.Group(); scene.add(ch);
  const hips = new THREE.Group(); hips.position.y = 0.5; ch.add(hips);
  const torso = new THREE.Group(); hips.add(torso);
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.27, 0.28, 8, 24), M.blue); body.position.y = 0.32; body.castShadow = true; torso.add(body);
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.035, 8, 24), M.white); collar.rotation.x = Math.PI / 2; collar.position.y = 0.6; torso.add(collar);
  const pocket = box(0.12, 0.1, 0.02, M.amber, 0.11, 0.42, 0.265, { parent: torso, cast: false });
  const neck = new THREE.Group(); neck.position.y = 0.68; torso.add(neck);
  const head = new THREE.Group(); head.position.y = 0.3; neck.add(head);
  sph(0.35, M.skin, 0, 0, 0, { parent: head });
  sph(0.37, M.hair, 0, 0.08, -0.04, { parent: head, s: [1.04, 0.9, 1.0] });
  const bang = sph(0.22, M.hair, 0.1, 0.22, 0.22, { parent: head, s: [1.3, 0.5, 0.6] }); bang.rotation.z = -0.3;
  sph(0.07, M.skin, 0.35, -0.02, 0, { parent: head }); sph(0.07, M.skin, -0.35, -0.02, 0, { parent: head }); // ears
  const eyes = [], lids = [], brows = [];
  for (const s of [-1, 1]) {
    const e = sph(0.055, M.black, s * 0.13, 0.0, 0.31, { parent: head, s: [0.85, 1.15, 0.6] }); eyes.push(e);
    sph(0.018, mat('#FFFFFF', { emissive: '#FFFFFF', emissiveIntensity: 0.6 }), 0.02, 0.03, 0.04, { parent: e, cast: false });
    const l = box(0.13, 0.025, 0.04, M.black, s * 0.13, 0.0, 0.335, { parent: head, cast: false }); l.visible = false; lids.push(l);
    const b = box(0.11, 0.025, 0.03, M.hair, s * 0.13, 0.12, 0.315, { parent: head, cast: false }); brows.push(b);
    sph(0.055, M.pink, s * 0.21, -0.1, 0.27, { parent: head, s: [1, 0.55, 0.3], cast: false });
  }
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.015, 8, 16, Math.PI), M.black); smile.rotation.z = Math.PI; smile.position.set(0, -0.12, 0.33); head.add(smile);
  const mouthO = sph(0.05, mat('#7A2633'), 0, -0.14, 0.32, { parent: head, s: [1, 1.2, 0.5], cast: false });
  const mouthFlat = box(0.08, 0.018, 0.02, M.black, 0, -0.13, 0.335, { parent: head, cast: false });
  function limb(len, r, m, handM) {
    const g = new THREE.Group();
    const c = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 6, 16), m); c.position.y = -len / 2 - r * 0.3; c.castShadow = true; g.add(c);
    if (handM) { const h = sph(r * 1.25, handM, 0, -len - r * 0.9, 0, { parent: g }); g.userData.hand = h; }
    return g;
  }
  const armL = limb(0.28, 0.08, M.blue, M.skin), armR = limb(0.28, 0.08, M.blue, M.skin);
  armL.position.set(0.31, 0.55, 0); armR.position.set(-0.31, 0.55, 0); torso.add(armL, armR);
  const legL = limb(0.26, 0.1, M.navyD), legR = limb(0.26, 0.1, M.navyD);
  legL.position.set(0.13, 0.02, 0); legR.position.set(-0.13, 0.02, 0); hips.add(legL, legR);
  for (const lg of [legL, legR]) { const sh = box(0.17, 0.09, 0.26, M.white, 0, -0.5, 0.05, { parent: lg }); box(0.17, 0.03, 0.26, M.amber, 0, -0.545, 0.05, { parent: lg, cast: false }); }
  // props
  const phone = box(0.12, 0.2, 0.02, M.navyD, 0, -0.42, 0.06, { parent: armR });
  const phoneScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.17), new THREE.MeshBasicMaterial({ color: 0xbfd8ff })); phoneScreen.position.set(0, 0, 0.011); phone.add(phoneScreen);
  const chop = new THREE.Group(); armL.add(chop); chop.position.set(0, -0.43, 0.04);
  box(0.015, 0.015, 0.4, M.woodD, 0.02, 0, 0.12, { parent: chop }); box(0.015, 0.015, 0.4, M.woodD, -0.02, 0, 0.12, { parent: chop });
  const noodleBit = box(0.03, 0.14, 0.03, M.noodle, 0, -0.06, 0.3, { parent: chop });
  // sleep blanket overlay on the body
  const sheet = box(0.95, 0.16, 1.15, M.blue, 0, 0, 0); sheet.visible = false;

  // the green gem: brilliant-cut (flat table + crown + pointed pavilion), floats and spins
  const gem = new THREE.Group(); scene.add(gem);
  const gemMat = new THREE.MeshStandardMaterial({ color: 0x2fbf71, emissive: 0x1a8c4a, emissiveIntensity: 0.55, roughness: 0.25, metalness: 0.1, flatShading: true });
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.19, 0.09, 8), gemMat); crown.position.y = 0.045; gem.add(crown);
  const pav = new THREE.Mesh(new THREE.ConeGeometry(0.19, 0.3, 8), gemMat); pav.rotation.x = Math.PI; pav.position.y = -0.15; gem.add(pav);
  const gemLight = new THREE.PointLight(0x5cff9a, 0.6, 1.6, 2); gem.add(gemLight);

  // ---------- pose solver ----------
  const spot = k => SPOT[k];
  const faceCam = Math.PI / 4;
  function actAt(t) { for (const a of ACTS) if (t >= a.a && t < a.b) return a; return ACTS[ACTS.length - 1]; }
  function pose(t) {
    const a = actAt(t), lt = t - a.a, dur = a.b - a.a;
    const p = { x: 0, z: 0, y: 0, ry: faceCam, rx: 0, hipY: 0.5, lean: 0, aL: [0, 0, 0.12], aR: [0, 0, -0.12], lL: [0, 0], lR: [0, 0], hx: 0, hy: 0, hz: 0, face: 'smile', eyes: 'open', brow: 0, phone: false, chop: false, sheet: false, sit: 0 };
    const [sx, sz] = a.at ? spot(a.at) : spot(a.from);
    p.x = sx; p.z = sz;
    const breathe = Math.sin(t * 2.4) * 0.01;
    switch (a.act) {
      case 'panic': {
        const hop = Math.abs(Math.sin(t * 9)) * 0.22;
        p.y = hop; p.ry = faceCam + Math.sin(t * 5) * 0.35;
        const wave = Math.sin(t * 22) * 0.5;
        p.aL = [-0.3, 0, 2.6 + wave]; p.aR = [-0.3, 0, -2.6 - wave];
        p.lL = [Math.sin(t * 18) * 0.4, 0]; p.lR = [-Math.sin(t * 18) * 0.4, 0];
        p.hz = Math.sin(t * 16) * 0.18; p.face = 'open'; p.brow = 1; p.eyes = 'wide';
        if (lt > 3.95) { const k = P(lt, 3.95, 4.25); p.y *= 1 - k; }
        break;
      }
      case 'walk': {
        const [fx, fz] = spot(a.from), [tx, tz] = spot(a.to), k = E.inOutSine(P(lt, 0, dur));
        p.x = lerp(fx, tx, k); p.z = lerp(fz, tz, k);
        p.ry = Math.atan2(tx - fx, tz - fz);
        const turnIn = P(lt, 0, 0.18), turnOut = P(lt, dur - 0.22, dur);
        const prevRy = a.from === 'rug' ? faceCam : faceCam;
        p.ry = lerp(lerp(prevRy, p.ry, turnIn), a.to === 'sofa' ? 0 : a.to === 'bedside' ? Math.PI * 0.9 : faceCam, turnOut);
        const ph = lt * 11, sw = Math.sin(ph) * 0.6 * bump(lt, 0, dur);
        p.lL = [sw, 0]; p.lR = [-sw, 0]; p.aL = [-sw * 0.8, 0, 0.12]; p.aR = [sw * 0.8, 0, -0.12];
        p.y = Math.abs(Math.sin(ph)) * 0.05;
        break;
      }
      case 'sleep': {
        const k = E.inOutCubic(P(lt, 0, 0.45)), out = E.inOutCubic(P(lt, dur - 0.4, dur));
        const [bx, bz] = spot('bedside'), [lx, lz] = spot('bed');
        const lie = k * (1 - out);
        p.x = lerp(bx, lx, lie); p.z = lerp(bz, lz, lie);
        p.y = lie * 0.62; p.rx = -Math.PI / 2 * lie; p.ry = lerp(Math.PI * 0.9, 0, k);
        if (out > 0) p.ry = lerp(0, faceCam, out);
        p.eyes = lie > 0.5 ? 'closed' : 'open'; p.face = 'flat';
        p.aL = [0, 0, 0.2]; p.aR = [0, 0, -0.2];
        p.lean = breathe * 4 * lie;
        p.sheet = lie > 0.9;
        break;
      }
      case 'stretch': {
        const s = bump(lt, 0, dur);
        p.aL = [0, 0, 0.12 + 2.7 * s]; p.aR = [0, 0, -0.12 - 2.7 * s]; p.eyes = 'happy'; p.face = 'open'; p.hx = -0.2 * s; p.y = 0.04 * s;
        p.ry = faceCam;
        break;
      }
      case 'eat': {
        p.sit = 1; p.ry = Math.atan2(2.9 - sx, 1.1 - sz);
        const cyc = (lt % 1.6) / 1.6, lift = bump(cyc, 0.05, 0.6);
        p.aL = [-0.9 - 1.3 * lift, 0, 0.35]; p.aR = [-0.5, 0, -0.25]; p.chop = true;
        p.hx = 0.15 - 0.15 * lift; p.face = lift > 0.6 ? 'open' : 'smile';
        p.eyes = steps.some(s => s.bar === 'mood' && t >= s.t && t - s.t < 0.5) ? 'happy' : 'open';
        p.hy = Math.sin(t * 9) * 0.04 * (1 - lift);
        break;
      }
      case 'phone': {
        p.sit = 1; p.hipY = 0.42; p.ry = faceCam;
        p.aR = [-1.25, 0.25, -0.35]; p.aL = [-1.1, -0.3, 0.45]; p.phone = true;
        p.hx = 0.35; p.hz = Math.sin(t * 1.3) * 0.06;
        p.eyes = lt > 2.5 ? 'half' : 'open'; p.face = lt < 2.4 ? 'smile' : 'flat';
        p.lean = -0.12;
        break;
      }
      case 'think': {
        p.sit = 1; p.hipY = 0.42; p.ry = faceCam;
        p.aR = [-2.1, 0.35, -0.55]; p.aL = [-0.3, 0, 0.3];
        p.hz = 0.18 + Math.sin(t * 1.8) * 0.05; p.hx = -0.15; p.face = 'flat'; p.brow = 0.6;
        p.eyes = t > T.MENU + 0.4 ? 'open' : 'half';
        break;
      }
      case 'cheer': {
        const up = E.outBack(P(lt, 0, 0.35));
        p.sit = 1 - up; p.hipY = lerp(0.42, 0.5, up);
        const step = E.inOutCubic(P(lt, 0.1, 0.45));                 // hop off the beanbag toward the camera
        p.x = lerp(sx, SPOT.front[0], step); p.z = lerp(sz, SPOT.front[1], step);
        const jump = Math.abs(Math.sin((lt - 0.3) * 6.2)) * 0.32 * P(lt, 0.3, 0.5) * (1 - P(lt, dur - 0.5, dur));
        p.y = jump; p.ry = faceCam + Math.sin(lt * 2.2) * 0.25;
        const w = Math.sin(t * 12) * 0.3;
        p.aL = [0, 0, lerp(0.3, 2.7 + w, up)]; p.aR = [0, 0, lerp(-0.3, -2.7 - w, up)];
        p.lL = [jump * 1.2, 0]; p.lR = [jump * 1.2, 0];
        p.face = 'open'; p.eyes = 'happy';
        break;
      }
      case 'lounge': {
        const k = E.inOutCubic(P(lt, 0, 0.5));
        p.sit = k; p.ry = 0; p.y = 0.12 * k; p.lean = -0.38 * k;
        p.aL = [0, 0, lerp(0.12, 2.6, k)]; p.aR = [0, 0, lerp(-0.12, -2.6, k)]; // hands behind head
        p.eyes = lt > 0.6 ? 'happy' : 'open'; p.face = 'smile';
        p.hz = Math.sin(t * 1.6) * 0.08 * k; p.hx = -0.1 * k;
        break;
      }
    }
    return p;
  }

  function applyPose(p, t) {
    ch.position.set(p.x, p.y, p.z);
    ch.rotation.set(0, 0, 0); ch.rotation.order = 'YXZ'; ch.rotation.y = p.ry; ch.rotation.x = p.rx;
    const sitDrop = p.sit * (p.hipY === 0.42 ? 0.18 : 0.28);
    hips.position.y = 0.5 - sitDrop;
    torso.rotation.x = p.lean;
    // sitting: legs forward
    legL.rotation.set(p.lL[0] - p.sit * 1.45, 0, 0.06); legR.rotation.set(p.lR[0] - p.sit * 1.45, 0, -0.06);
    armL.rotation.set(p.aL[0], p.aL[1], p.aL[2]); armR.rotation.set(p.aR[0], p.aR[1], p.aR[2]);
    head.rotation.set(p.hx, p.hy, p.hz);
    body.scale.set(1, 1 + Math.sin(t * 2.4) * 0.015, 1);
    smile.visible = p.face === 'smile'; mouthO.visible = p.face === 'open'; mouthFlat.visible = p.face === 'flat';
    const blinkNow = (t % 3.1) < 0.1 && p.eyes === 'open';
    for (let i = 0; i < 2; i++) {
      const closed = p.eyes === 'closed' || p.eyes === 'happy' || blinkNow;
      eyes[i].visible = !closed; lids[i].visible = closed;
      lids[i].rotation.z = p.eyes === 'happy' ? (i ? -0.35 : 0.35) : 0;
      lids[i].position.y = p.eyes === 'happy' ? 0.02 : 0.0;
      eyes[i].scale.set(0.85, p.eyes === 'half' ? 0.55 : p.eyes === 'wide' ? 1.45 : 1.15, 0.6);
      brows[i].rotation.z = (i ? -1 : 1) * -0.45 * p.brow;
      brows[i].position.y = 0.12 + 0.03 * p.brow;
    }
    phone.visible = p.phone; chop.visible = p.chop; noodleBit.visible = p.chop;
    phoneScreen.material.color.set(p.phone ? 0xd2e4ff : 0x333333);
    sheet.visible = p.sheet;
    if (p.sheet) { sheet.position.set(SPOT.bed[0], 0.8, SPOT.bed[1] + 0.35); }
  }

  // gem colour follows the average of the needs: red -> amber -> green
  function gemColor(t) {
    const avg = BARS.reduce((s, b) => s + barVal(b, t), 0) / 4;
    const k = clamp((avg - 0.25) / 0.5);
    const c = k < 0.5 ? mixC('#E8484D', '#FFB627', k * 2) : mixC('#FFB627', '#2FBF71', (k - 0.5) * 2);
    return c;
  }

  // ---------- camera ----------
  const target = new THREE.Vector3();
  function placeCamera(t) {
    const az = Math.PI / 4 + Math.sin(t * 0.21) * 0.05 + 0.04;
    const el = 0.56;
    let dist = 37, tx = -0.1, ty = 0.9, tz = -0.4;
    const cp = pose(t);                              // soft follow of the student
    tx = lerp(tx, cp.x, 0.3); tz = lerp(tz, cp.z, 0.3);
    const push = E.inOutCubic(P(t, 33.6, 36.5));
    dist = lerp(dist, 27, push); tx = lerp(tx, 1.4, push); ty = lerp(ty, 0.9, push); tz = lerp(tz, -2.2, push);
    const hookZoom = 1 - E.outCubic(P(t, 0, 0.6));
    dist -= 3 * hookZoom;
    target.set(tx, ty, tz);
    cam.position.set(tx + Math.cos(el) * Math.sin(az) * dist, ty + Math.sin(el) * dist, tz + Math.cos(el) * Math.cos(az) * dist);
    cam.lookAt(target);
    // shift the room right/down in frame to make space for the needs panel and the headline
    cam.setViewOffset(W, H, lerp(-105, -40, push), lerp(-170, -150, push), W, H);
    cam.updateMatrixWorld();
  }
  const v3 = new THREE.Vector3();
  function proj(x, y, z) { v3.set(x, y, z).project(cam); return [(v3.x + 1) / 2 * W, (1 - v3.y) / 2 * H]; }
  function headScreen() { const hp = new THREE.Vector3(); head.getWorldPosition(hp); return proj(hp.x, hp.y, hp.z); }

  // time-lapse light: night while sleeping
  function lighting(t) {
    const night = bump(t, 5.9, 10.1) ** 0.6 * (t > 5.9 && t < 10.1 ? 1 : 0);
    sun.intensity = lerp(2.6, 0.25, night); hemi.intensity = lerp(1.6, 0.55, night);
    hemi.color.set(mixC('#FFFFFF', '#7E95D6', night)); lamp.intensity = lerp(0, 6, night) + (t > 34 ? 3 * P(t, 34, 35) : 0);
    skyMat.color.set(mixC('#9FD0FF', '#13245A', night)); sunDisc.material.color.set(mixC('#FFE08A', '#F4F1EA', night));
    sunDisc.position.y = 2.25 - night * 0.0; sunDisc.position.x = night > 0.5 ? 1.55 : 2.4;
    // clock: 23.40 -> (sleep) 07.15 -> later
    const hrs = 23 + 40 / 60 + P(t, 6.0, 10.0) * (7.5 + 0.08) + t * 0.004;
    minPivot.rotation.z = -((hrs % 1) * TAU); hourPivot.rotation.z = -(((hrs % 12) / 12) * TAU);
    // laptop / pile status
    const done = E.outCubic(P(t, T.FILL, T.FILL + 0.7));
    pile.scale.setScalar(lerp(1, 0.35, done)); pile.position.y = 1.04;
    pileTag.material = done > 0.5 ? M.green : M.red;
    pileTag.visible = true;
    lapGlow.material.color.set(done > 0.5 ? 0x9ff0c0 : 0x9cc3ff);
    screenGlow.intensity = 0;
  }

  function render3D(t) {
    placeCamera(t);
    lighting(t);
    const p = pose(t); applyPose(p, t);
    // gem above the head
    const hp = new THREE.Vector3(); ch.updateMatrixWorld(true); head.getWorldPosition(hp);
    const up = p.rx ? new THREE.Vector3(0, 0.75, 0) : new THREE.Vector3(0, 0.72, 0);
    gem.position.set(hp.x + up.x, hp.y + up.y + Math.sin(t * 2.2) * 0.05, hp.z + up.z);
    gem.rotation.y = t * 1.4;
    const gc = gemColor(t), pulse = t > T.FILL ? 0.4 + 0.3 * bump((t - T.FILL) % 1.2, 0, 1.2) : 0.35;
    gemMat.color.set(gc); gemMat.emissive.set(gc); gemMat.emissiveIntensity = pulse; gemLight.color.set(gc);
    const sc = t > T.FILL && t < T.FILL + 0.6 ? 1 + 0.5 * bump(t, T.FILL, T.FILL + 0.6) : 1;
    gem.scale.setScalar(sc);
    if (p.phone) { const pp = new THREE.Vector3(); phone.getWorldPosition(pp); screenGlow.position.copy(pp); screenGlow.intensity = 1.4; }
    R3.render(scene, cam);
    return p;
  }

  // =====================================================================
  //  2D HUD
  // =====================================================================
  function rr(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
  function shadowed(fn, blur = 30, oy = 10, a = 0.18) { ctx.save(); ctx.shadowColor = `rgba(14,27,61,${a})`; ctx.shadowBlur = blur; ctx.shadowOffsetY = oy; fn(); ctx.restore(); }

  function background(t) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#F3F7FF'); g.addColorStop(0.55, C.bg1); g.addColorStop(1, C.bg2);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // soft floating diamonds pattern
    for (let i = 0; i < 26; i++) {
      const x = rnd(i) * W, y = ((rnd(i + 30) * H - t * (12 + rnd(i + 5) * 18)) % H + H) % H, s = 10 + rnd(i + 9) * 18;
      ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 4); ctx.fillStyle = i % 3 ? 'rgba(24,74,161,0.06)' : 'rgba(255,182,39,0.12)'; ctx.fillRect(-s / 2, -s / 2, s, s); ctx.restore();
    }
    // the room's soft contact shadow on the backdrop
    const sh = ctx.createRadialGradient(W * 0.6, 1520, 40, W * 0.6, 1520, 560);
    sh.addColorStop(0, 'rgba(14,27,61,0.22)'); sh.addColorStop(1, 'rgba(14,27,61,0)');
    ctx.fillStyle = sh; ctx.fillRect(0, 1100, W, 820);
  }

  // icons (vector, 2D)
  function icon(name, x, y, s, col = C.white) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s / 40, s / 40);
    ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineWidth = 4.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    switch (name) {
      case 'energi': ctx.beginPath(); ctx.moveTo(4, -18); ctx.lineTo(-10, 3); ctx.lineTo(0, 3); ctx.lineTo(-4, 18); ctx.lineTo(10, -3); ctx.lineTo(0, -3); ctx.closePath(); ctx.fill(); break;
      case 'fokus': ctx.beginPath(); ctx.arc(0, 0, 15, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, 7, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, 2.5, 0, TAU); ctx.fill(); break;
      case 'mood': ctx.beginPath(); ctx.arc(0, 0, 15, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.arc(-5.5, -4, 2.6, 0, TAU); ctx.arc(5.5, -4, 2.6, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.arc(0, 2, 7.5, 0.2, Math.PI - 0.2); ctx.stroke(); break;
      case 'tugas': rr(-12, -14, 24, 30, 4); ctx.stroke(); rr(-6, -18, 12, 7, 2); ctx.fill(); ctx.beginPath(); ctx.moveTo(-6, -2); ctx.lineTo(6, -2); ctx.moveTo(-6, 6); ctx.lineTo(3, 6); ctx.stroke(); break;
      case 'bed': rr(-18, -2, 36, 12, 3); ctx.fill(); rr(-18, -12, 10, 10, 3); ctx.fill(); ctx.fillRect(-18, 8, 4, 8); ctx.fillRect(14, 8, 4, 8); break;
      case 'noodle': ctx.beginPath(); ctx.moveTo(-18, -2); ctx.lineTo(18, -2); ctx.arc(0, -2, 18, 0, Math.PI); ctx.fill(); ctx.beginPath(); ctx.moveTo(-4, -4); ctx.lineTo(10, -20); ctx.moveTo(2, -4); ctx.lineTo(16, -18); ctx.stroke(); for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(i * 5, -8); ctx.quadraticCurveTo(i * 5 + 3, -14, i * 5, -18); ctx.stroke(); } break;
      case 'phone': rr(-10, -18, 20, 36, 5); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 12, 2.2, 0, TAU); ctx.fill(); break;
      case 'heart': ctx.beginPath(); ctx.moveTo(0, 14); ctx.bezierCurveTo(-20, 0, -14, -18, 0, -8); ctx.bezierCurveTo(14, -18, 20, 0, 0, 14); ctx.fill(); break;
      case 'like': rr(-14, -2, 8, 16, 2); ctx.fill(); ctx.beginPath(); ctx.moveTo(-4, -2); ctx.lineTo(2, -16); ctx.quadraticCurveTo(8, -16, 7, -8); ctx.lineTo(6, -3); ctx.lineTo(14, -3); ctx.quadraticCurveTo(18, -1, 15, 4); ctx.lineTo(12, 14); ctx.lineTo(-4, 14); ctx.closePath(); ctx.fill(); break;
      case 'bell': ctx.beginPath(); ctx.moveTo(-13, 9); ctx.quadraticCurveTo(-11, -15, 0, -15); ctx.quadraticCurveTo(11, -15, 13, 9); ctx.closePath(); ctx.fill(); ctx.beginPath(); ctx.arc(0, 13, 4, 0, TAU); ctx.fill(); break;
      case 'play': ctx.beginPath(); ctx.moveTo(-8, -12); ctx.lineTo(12, 0); ctx.lineTo(-8, 12); ctx.closePath(); ctx.fill(); break;
      case 'star': ctx.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 7.5 : 17, a = -Math.PI / 2 + i * Math.PI / 5; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.fill(); break;
      case 'card': rr(-18, -12, 36, 24, 5); ctx.fill(); ctx.fillStyle = C.white; ctx.fillRect(-12, -4, 14, 3.5); ctx.fillRect(-12, 3, 20, 3.5); ctx.fillStyle = C.amber; ctx.beginPath(); ctx.arc(10, -4, 3.5, 0, TAU); ctx.fill(); break;
      case 'check': ctx.beginPath(); ctx.moveTo(-12, 0); ctx.lineTo(-3, 10); ctx.lineTo(14, -10); ctx.stroke(); break;
      case 'alert': ctx.beginPath(); ctx.moveTo(0, -16); ctx.lineTo(0, 4); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 13, 3, 0, TAU); ctx.fill(); break;
      case 'z': ctx.font = F(800, 38); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('Z', 0, 0); break;
    }
    ctx.restore();
  }
  function diamond2D(x, y, s, col) {
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(-s * 0.5, -s * 0.15); ctx.lineTo(-s * 0.25, -s * 0.45); ctx.lineTo(s * 0.25, -s * 0.45); ctx.lineTo(s * 0.5, -s * 0.15); ctx.lineTo(0, s * 0.6); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.moveTo(-s * 0.25, -s * 0.45); ctx.lineTo(0, -s * 0.15); ctx.lineTo(-s * 0.5, -s * 0.15); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  // ---------- needs panel ----------
  const PANEL = { x: 34, y: 640, w: 300, rowH: 150 };
  const LABEL = { energi: 'Energi', fokus: 'Fokus', mood: 'Mood', tugas: 'Tugas' };
  function needsPanel(t) {
    const { x, y, w, rowH } = PANEL, h = 96 + rowH * 4;
    const inP = E.outBack(P(t, -0.2, 0.15));
    ctx.save(); ctx.translate((1 - inP) * -60, 0);
    shadowed(() => { rr(x, y, w, h, 34); ctx.fillStyle = 'rgba(255,255,255,0.94)'; ctx.fill(); }, 40, 14, 0.22);
    // header: day + clock
    const hrs = 23 + 40 / 60 + P(t, 6.0, 10.0) * (7.5 + 0.08) + t * 0.004;
    const hh = Math.floor(hrs % 24), mm = Math.floor((hrs % 1) * 60);
    const day = hrs >= 24 ? 'Selasa' : 'Senin';
    rr(x + 18, y + 18, w - 36, 60, 22); ctx.fillStyle = C.blue; ctx.fill();
    ctx.fillStyle = C.white; ctx.font = F(700, 26); ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(day, x + 38, y + 49);
    ctx.font = F(800, 28); ctx.textAlign = 'right'; ctx.fillText(`${String(hh).padStart(2, '0')}.${String(mm).padStart(2, '0')}`, x + w - 38, y + 49);
    BARS.forEach((b, i) => {
      const ry = y + 96 + i * rowH, v = barVal(b, t), col = barCol(v);
      const ls = lastStep(b, t), age = ls ? t - ls.t : 9;
      const alarm = b === 'tugas' && v < 0.3;
      const flash = alarm ? (Math.floor(t * 4) % 2 === 0) : false;
      if (alarm) { rr(x + 12, ry + 4, w - 24, rowH - 12, 24); ctx.fillStyle = flash ? 'rgba(232,72,77,0.18)' : 'rgba(232,72,77,0.06)'; ctx.fill(); if (flash) { ctx.lineWidth = 4; ctx.strokeStyle = C.red; ctx.stroke(); } }
      if (age < 0.6 && ls.up) { rr(x + 12, ry + 4, w - 24, rowH - 12, 24); ctx.fillStyle = `rgba(47,191,113,${0.25 * (1 - age / 0.6)})`; ctx.fill(); }
      // icon disc
      const pop = age < 0.4 ? 1 + 0.18 * bump(age, 0, 0.4) : 1;
      ctx.save(); ctx.translate(x + 64, ry + 52); ctx.scale(pop, pop);
      ctx.beginPath(); ctx.arc(0, 0, 36, 0, TAU); ctx.fillStyle = col; ctx.fill();
      icon(b, 0, 0, 40, C.white); ctx.restore();
      ctx.fillStyle = C.ink; ctx.font = F(800, 30); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      ctx.fillText(LABEL[b], x + 116, ry + 46);
      // arrows like a life-sim mood indicator
      if (age < 1.2 && ls) {
        const n = ls.big ? 3 : 1, a = 1 - P(age, 0.8, 1.2);
        ctx.fillStyle = ls.up ? C.green : C.red; ctx.globalAlpha = a;
        for (let k = 0; k < n; k++) { const ax = x + 252 - k * 22, ay = ry + 34 + (ls.up ? -1 : 1) * Math.sin(age * 12) * 3; ctx.beginPath(); if (ls.up) { ctx.moveTo(ax - 9, ay + 6); ctx.lineTo(ax, ay - 7); ctx.lineTo(ax + 9, ay + 6); } else { ctx.moveTo(ax - 9, ay - 6); ctx.lineTo(ax, ay + 7); ctx.lineTo(ax + 9, ay - 6); } ctx.closePath(); ctx.fill(); }
        ctx.globalAlpha = 1;
      }
      // bar
      const bx = x + 116, by = ry + 64, bw = w - 150, bh = 26;
      rr(bx, by, bw, bh, 13); ctx.fillStyle = '#E3E9F5'; ctx.fill();
      if (v > 0.005) {
        rr(bx, by, Math.max(bh, bw * v), bh, 13);
        const g = ctx.createLinearGradient(0, by, 0, by + bh); g.addColorStop(0, mixC(col.startsWith('#') ? col : '#2FBF71', '#FFFFFF', 0.25)); g.addColorStop(1, col);
        ctx.fillStyle = g; ctx.fill();
        rr(bx + 6, by + 4, Math.max(0, bw * v - 12), 6, 3); ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fill();
      }
      if (alarm && flash) { ctx.fillStyle = C.red; ctx.font = F(800, 22); ctx.textAlign = 'left'; ctx.fillText('KRITIS!', bx, by + bh + 28); }
      // all-bars glow after MINTASK
      if (t > 30.3 && t < 34.5) { const gl = 0.35 + 0.35 * Math.sin((t - 30.3) * 6 + i); rr(bx - 4, by - 4, bw + 8, bh + 8, 17); ctx.strokeStyle = `rgba(255,182,39,${gl})`; ctx.lineWidth = 4; ctx.stroke(); }
    });
    ctx.restore();
  }
  function barAnchor(b) { const i = BARS.indexOf(b); return [PANEL.x + 116 + (PANEL.w - 150) / 2, PANEL.y + 96 + i * PANEL.rowH + 77]; }

  // ---------- headline + banners ----------
  function hookText(t) {
    const out = P(t, 3.75, 4.05);
    if (out >= 1) return;
    ctx.save(); ctx.globalAlpha = 1 - out;
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    const s1 = E.outBack(P(t, 0, 0.22)), s2 = E.outBack(P(t, 0.1, 0.34));
    ctx.save(); ctx.translate(540, 300); ctx.scale(lerp(1.25, 1, s1), lerp(1.25, 1, s1)); ctx.globalAlpha *= clamp(s1 * 3 + 0.85);
    ctx.font = F(800, 112); ctx.letterSpacing = '-3px'; ctx.fillStyle = C.ink; ctx.fillText('Bar tugasmu', 0, 0); ctx.restore();
    ctx.save(); ctx.translate(540, 430); ctx.scale(lerp(1.3, 1, s2), lerp(1.3, 1, s2)); ctx.globalAlpha *= clamp(s2 * 3 + 0.85);
    ctx.font = F(800, 112); ctx.letterSpacing = '-3px';
    const w1 = ctx.measureText('merah.').width, w2 = ctx.measureText(' Lanjut?').width, x0 = -(w1 + w2) / 2;
    const flash = Math.floor(t * 4) % 2 === 0;
    rr(x0 - 16, -92, w1 + 32, 116, 26); ctx.fillStyle = flash ? C.red : '#C9343A'; ctx.fill();
    ctx.textAlign = 'left'; ctx.fillStyle = C.white; ctx.fillText('merah.', x0, 0);
    ctx.fillStyle = C.ink; ctx.fillText(' Lanjut?', x0 + w1, 0);
    ctx.restore();
    ctx.restore();
  }
  const BANNERS = [
    { a: 4.4, b: 10.4, ic: 'bed', title: 'Coba tidur dulu…', sub: [['+ Energi', C.green], ['− Tugas', C.red]] },
    { a: 10.9, b: 17.2, ic: 'noodle', title: 'Makan mie dulu…', sub: [['+ Mood', C.green]] },
    { a: 17.4, b: 25.4, ic: 'phone', title: 'Scroll sebentar…', sub: [['− Fokus', C.red]] },
    { a: 25.6, b: 28.6, ic: 'star', title: 'Pilihan baru muncul!', sub: [] },
    { a: 28.9, b: 33.9, ic: 'check', title: 'Tugas beres!', sub: [['Semua bar penuh', C.green]] },
    { a: 34.2, b: 37.0, ic: 'heart', title: 'Waktunya santai.', sub: [] },
  ];
  function banners(t) {
    for (const bn of BANNERS) {
      if (t < bn.a || t > bn.b) continue;
      const k = E.outBack(P(t, bn.a, bn.a + 0.4)), o = P(t, bn.b - 0.3, bn.b);
      ctx.save(); ctx.globalAlpha = 1 - o; ctx.translate(540, 300 - (1 - k) * 60 - o * 30);
      ctx.font = F(800, 74); ctx.letterSpacing = '-2px'; const tw = ctx.measureText(bn.title).width;
      const total = tw + 110;
      shadowed(() => { rr(-total / 2 - 10, -70, total + 20, 120, 60); ctx.fillStyle = C.white; ctx.fill(); }, 30, 10, 0.16);
      ctx.beginPath(); ctx.arc(-total / 2 + 52, -10, 40, 0, TAU); ctx.fillStyle = bn.ic === 'check' ? C.green : bn.ic === 'heart' ? C.amber : C.blue; ctx.fill();
      icon(bn.ic, -total / 2 + 52, -10, 42, C.white);
      ctx.fillStyle = C.ink; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(bn.title, -total / 2 + 110, -8);
      // outcome chips
      ctx.letterSpacing = '0px'; ctx.font = F(800, 36);
      const ws = bn.sub.map(([s]) => ctx.measureText(s).width + 48), sum = ws.reduce((a, b) => a + b, 0) + 16 * (ws.length - 1);
      let cx = -sum / 2;
      bn.sub.forEach(([s, col], i) => {
        const kk = E.outBack(P(t, bn.a + 0.3 + i * 0.12, bn.a + 0.6 + i * 0.12));
        ctx.save(); ctx.translate(cx + ws[i] / 2, 100); ctx.scale(kk, kk);
        rr(-ws[i] / 2, -30, ws[i], 60, 30); ctx.fillStyle = col; ctx.fill();
        ctx.fillStyle = C.white; ctx.textAlign = 'center'; ctx.fillText(s, 0, 2); ctx.restore();
        cx += ws[i] + 16;
      });
      ctx.restore();
    }
  }

  // ---------- floating things over the character ----------
  function floaters(t, p) {
    const [hx, hy] = headScreen();
    const a = actAt(t);
    // thought bubble at the start of each activity
    const TH = [[0.25, 3.8, 'alert', C.red], [4.3, 5.5, 'bed', C.blue], [10.95, 12.0, 'noodle', C.amber], [17.25, 18.4, 'phone', C.blue], [25.3, 26.0, 'tugas', C.red]];
    for (const [ta, tb, ic, col] of TH) {
      if (t < ta || t > tb) continue;
      const k = E.outBack(P(t, ta, ta + 0.3)) * (1 - P(t, tb - 0.2, tb));
      const bx = hx + 120, by = hy - 150 + Math.sin(t * 3) * 6;
      ctx.save(); ctx.globalAlpha = clamp(k * 2);
      ctx.beginPath(); ctx.arc(hx + 46, hy - 50, 9 * k, 0, TAU); ctx.arc(hx + 72, hy - 82, 14 * k, 0, TAU); ctx.fillStyle = C.white; ctx.fill();
      ctx.translate(bx, by); ctx.scale(k, k);
      shadowed(() => { ctx.beginPath(); ctx.ellipse(0, 0, 72, 60, 0, 0, TAU); ctx.fillStyle = C.white; ctx.fill(); }, 20, 6, 0.18);
      ctx.beginPath(); ctx.arc(0, 0, 40, 0, TAU); ctx.fillStyle = col; ctx.fill();
      icon(ic, 0, 0, 42, C.white);
      if (ic === 'alert') { ctx.font = F(800, 30); ctx.fillStyle = C.red; ctx.textAlign = 'center'; ctx.fillText('!!', 54, -40); }
      ctx.restore();
    }
    // panic sweat drops
    if (a.act === 'panic') for (let i = 0; i < 3; i++) {
      const ph = (t * 1.8 + i / 3) % 1, sx = hx + (i - 1) * 60 + (i - 1) * ph * 30, sy = hy - 40 + ph * 70;
      ctx.save(); ctx.globalAlpha = 1 - ph; ctx.fillStyle = '#7CC3FF'; ctx.beginPath(); ctx.moveTo(sx, sy - 18); ctx.quadraticCurveTo(sx + 11, sy, sx, sy + 8); ctx.quadraticCurveTo(sx - 11, sy, sx, sy - 18); ctx.fill(); ctx.restore();
    }
    // Zzz while sleeping
    if (a.act === 'sleep' && t - a.a > 0.6 && t < a.b - 0.4) for (let i = 0; i < 3; i++) {
      const ph = ((t - a.a) * 0.6 + i / 3) % 1;
      ctx.save(); ctx.globalAlpha = Math.sin(ph * Math.PI); icon('z', hx + 30 + ph * 90 + Math.sin(ph * 8) * 14, hy - 30 - ph * 170, 40 + ph * 30, C.blue); ctx.restore();
    }
    // steam + hearts while eating
    if (a.act === 'eat') {
      const [bx, by] = proj(2.9, 0.7, 1.1);
      for (let i = 0; i < 3; i++) { const ph = (t * 0.8 + i / 3) % 1; ctx.save(); ctx.globalAlpha = 0.4 * Math.sin(ph * Math.PI); ctx.strokeStyle = C.white; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); const sx = bx + (i - 1) * 22; ctx.moveTo(sx, by - ph * 40); ctx.quadraticCurveTo(sx + 10, by - ph * 40 - 14, sx, by - ph * 40 - 28); ctx.stroke(); ctx.restore(); }
    }
    if (a.act === 'phone') { // social icons popping from the phone
      const ics = ['heart', 'like', 'bell', 'play', 'heart', 'like'];
      for (let i = 0; i < 6; i++) {
        const t0 = 18.9 + i * 0.9 + rnd(i) * 0.3, ph = P(t, t0, t0 + 1.3);
        if (ph <= 0 || ph >= 1) continue;
        const sx = hx - 40 + (rnd(i + 4) - 0.5) * 160, sy = hy + 30 - ph * 200;
        ctx.save(); ctx.globalAlpha = Math.sin(ph * Math.PI); ctx.translate(sx, sy); const s = E.outBack(P(ph, 0, 0.3));
        ctx.scale(s, s); ctx.beginPath(); ctx.arc(0, 0, 32, 0, TAU); ctx.fillStyle = i % 2 ? C.blue : '#FF5E7E'; ctx.fill(); icon(ics[i], 0, 0, 34, C.white); ctx.restore();
      }
    }
    // +/- chips from each bar step, rising from the head
    for (const s of steps) {
      const age = t - s.t; if (age < 0 || age > 1.3 || s.t < 0.5) continue;
      const k = E.outBack(P(age, 0, 0.25)), fade = 1 - P(age, 0.9, 1.3);
      const txt = `${s.up ? '+' : '−'} ${LABEL[s.bar]}`;
      ctx.save(); ctx.globalAlpha = fade; ctx.translate(hx + 20, hy - 200 - age * 90); ctx.scale(k, k);
      ctx.font = F(800, 34); const w = ctx.measureText(txt).width + 70;
      shadowed(() => { rr(-w / 2, -30, w, 60, 30); ctx.fillStyle = s.up ? C.green : C.red; ctx.fill(); }, 14, 4, 0.2);
      icon(s.bar, -w / 2 + 30, 0, 28, C.white);
      ctx.fillStyle = C.white; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(txt, -w / 2 + 52, 2); ctx.restore();
    }
    // lounge: music notes + hearts
    if (t > 34.6 && t < 37.2) for (let i = 0; i < 4; i++) {
      const ph = ((t - 34.6) * 0.55 + i / 4) % 1;
      ctx.save(); ctx.globalAlpha = Math.sin(ph * Math.PI); ctx.translate(hx + (i % 2 ? 80 : -70) + Math.sin(ph * 7) * 16, hy - 60 - ph * 180);
      if (i % 2) icon('heart', 0, 0, 40, '#FF5E7E'); else { ctx.fillStyle = C.blue; ctx.font = F(800, 52); ctx.textAlign = 'center'; ctx.fillText('♪', 0, 0); }
      ctx.restore();
    }
  }

  // ---------- pie menu (26 – 28.4) ----------
  const OPTS = [
    { ic: 'bed', label: 'Tidur lagi', ang: -2.5 },
    { ic: 'noodle', label: 'Makan mie', ang: -1.57 },
    { ic: 'phone', label: 'Scroll lagi', ang: -0.64 },
    { ic: 'card', label: 'MinTask', ang: 0.35, hero: true },
  ];
  function optPos(i, cx, cy) { const o = OPTS[i], r = 250; return [cx + Math.cos(o.ang) * r, cy + Math.sin(o.ang) * r * 0.82]; }
  function menuCenter() { const [hx, hy] = headScreen(); return [hx, hy - 30]; }
  function pieMenu(t) {
    if (t < T.MENU || t > 28.5) return;
    const [cx, cy] = menuCenter();
    const close = P(t, 28.1, 28.45);
    ctx.save();
    // dim ring
    ctx.globalAlpha = (1 - close) * E.outCubic(P(t, T.MENU, T.MENU + 0.3));
    ctx.beginPath(); ctx.arc(cx, cy, 330, 0, TAU); ctx.fillStyle = 'rgba(14,27,61,0.22)'; ctx.fill();
    ctx.restore();
    const hover = t < 26.85 ? -1 : t < 27.25 ? 0 : t < 27.5 ? 2 : 3;
    OPTS.forEach((o, i) => {
      const k = E.outBack(P(t, T.MENU + 0.08 * i, T.MENU + 0.08 * i + 0.35)) * (1 - E.outCubic(o.hero ? P(t, 28.15, 28.3) : close));
      if (k <= 0) return;
      const [x, y] = optPos(i, cx, cy);
      const isH = hover === i, clickPulse = o.hero && t > T.CLICK ? bump(t, T.CLICK, T.CLICK + 0.25) : 0;
      ctx.save(); ctx.translate(x, y); const s = k * (isH ? 1.12 : 1) * (1 - 0.12 * clickPulse); ctx.scale(s, s);
      if (o.hero) { // glowing blue card
        const gl = 0.5 + 0.5 * Math.sin(t * 8);
        ctx.save(); ctx.shadowColor = `rgba(255,182,39,${0.6 + 0.4 * gl})`; ctx.shadowBlur = 40; rr(-110, -72, 220, 144, 26); ctx.fillStyle = C.blue; ctx.fill(); ctx.restore();
        rr(-110, -72, 220, 144, 26); ctx.lineWidth = 6; ctx.strokeStyle = isH ? C.amber : C.white; ctx.stroke();
        rr(-92, -54, 60, 42, 8); ctx.fillStyle = C.amber; ctx.fill(); // chip
        ctx.fillStyle = 'rgba(255,255,255,0.25)'; rr(-92, 20, 120, 10, 5); ctx.fill(); rr(-92, 38, 80, 10, 5); ctx.fill();
        ctx.fillStyle = C.white; ctx.font = F(800, 40); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('MinTask', 18, -28);
        diamond2D(70, 32, 34, C.greenL);
        if (t > 26.3) { ctx.font = F(800, 22); rr(-56, 80, 112, 36, 18); ctx.fillStyle = C.amber; ctx.fill(); ctx.fillStyle = C.ink; ctx.fillText('BARU!', 0, 99); }
      } else {
        shadowed(() => { ctx.beginPath(); ctx.arc(0, 0, 66, 0, TAU); ctx.fillStyle = isH ? C.blueXL : C.white; ctx.fill(); }, 20, 6, 0.2);
        ctx.beginPath(); ctx.arc(0, 0, 46, 0, TAU); ctx.fillStyle = C.mute; ctx.fill();
        icon(o.ic, 0, 0, 44, C.white);
        ctx.font = F(700, 28); const w = ctx.measureText(o.label).width + 34;
        rr(-w / 2, 74, w, 46, 23); ctx.fillStyle = C.navy; ctx.fill(); ctx.fillStyle = C.white; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(o.label, 0, 98);
      }
      ctx.restore();
    });
    // cursor
    if (t > 26.35 && t < 28.2) {
      const path = [[26.35, cx + 420, cy + 420], [26.85, ...optPos(0, cx, cy)], [27.25, ...optPos(2, cx, cy)], [27.6, ...optPos(3, cx, cy)]];
      let px = path[0][1], py = path[0][2];
      for (let i = 1; i < path.length; i++) { const k = E.inOutCubic(P(t, path[i - 1][0] + 0.05, path[i][0])); px = lerp(px, path[i][1], k); py = lerp(py, path[i][2], k); }
      px += 30; py += 26;
      const press = bump(t, T.CLICK - 0.05, T.CLICK + 0.15);
      ctx.save(); ctx.translate(px, py); ctx.scale(1 - press * 0.15, 1 - press * 0.15); ctx.rotate(-0.35);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 62); ctx.lineTo(16, 48); ctx.lineTo(28, 72); ctx.lineTo(38, 67); ctx.lineTo(26, 44); ctx.lineTo(46, 44); ctx.closePath();
      ctx.fillStyle = C.white; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = C.ink; ctx.lineJoin = 'round'; ctx.stroke(); ctx.restore();
      if (t > T.CLICK) { const r = P(t, T.CLICK, T.CLICK + 0.4); ctx.save(); ctx.globalAlpha = 1 - r; ctx.strokeStyle = C.amber; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(px, py, 20 + r * 90, 0, TAU); ctx.stroke(); ctx.restore(); }
    }
  }

  // ---------- MINTASK card flies to the tugas bar, stars burst ----------
  function mintaskFx(t) {
    const [cx, cy] = menuCenter();
    if (t > 28.15 && t < T.FILL + 0.05) {
      const k = E.inOutCubic(P(t, 28.15, T.FILL));
      const [sx, sy] = optPos(3, cx, cy), [ex, ey] = barAnchor('tugas');
      const x = lerp(sx, ex, k), y = lerp(sy, ey, k) - Math.sin(k * Math.PI) * 220, s = lerp(1, 0.4, k);
      ctx.save(); ctx.translate(x, y); ctx.rotate(k * TAU); ctx.scale(s, s);
      ctx.shadowColor = 'rgba(255,182,39,0.9)'; ctx.shadowBlur = 40; rr(-110, -72, 220, 144, 26); ctx.fillStyle = C.blue; ctx.fill();
      ctx.shadowBlur = 0; ctx.fillStyle = C.white; ctx.font = F(800, 40); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('MinTask', 0, 0);
      ctx.restore();
      for (let i = 0; i < 6; i++) { const kk = clamp(k - i * 0.05); const tx = lerp(sx, ex, kk), ty = lerp(sy, ey, kk) - Math.sin(kk * Math.PI) * 220; ctx.save(); ctx.globalAlpha = 0.7 - i * 0.1; icon('star', tx, ty, 34 - i * 4, C.amber); ctx.restore(); }
    }
    // amber star burst at the bar, and across all bars as they fill
    const bursts = [[T.FILL, 'tugas', 22], [29.5, 'energi', 12], [29.8, 'fokus', 12], [30.1, 'mood', 12]];
    for (const [tb, b, n] of bursts) {
      const age = t - tb; if (age < 0 || age > 1.4) continue;
      const [ax, ay] = barAnchor(b);
      for (let i = 0; i < n; i++) {
        const ang = rnd(i + tb * 10) * TAU, sp = 160 + rnd(i * 3 + tb) * 420;
        const x = ax + Math.cos(ang) * sp * E.outCubic(age / 1.4), y = ay + Math.sin(ang) * sp * E.outCubic(age / 1.4) + 120 * age * age;
        ctx.save(); ctx.globalAlpha = 1 - P(age, 0.8, 1.4); ctx.translate(x, y); ctx.rotate(age * 6 + i);
        icon('star', 0, 0, 22 + rnd(i + 5) * 26, i % 3 ? C.amber : '#FFE08A'); ctx.restore();
      }
      if (age < 0.25) { ctx.save(); ctx.globalAlpha = 1 - age / 0.25; ctx.beginPath(); ctx.arc(ax, ay, 40 + age * 600, 0, TAU); ctx.strokeStyle = C.amber; ctx.lineWidth = 10; ctx.stroke(); ctx.restore(); }
    }
    // sparkles around the student while everything glows
    if (t > T.FILL && t < 33.5) {
      const [hx, hy] = headScreen();
      for (let i = 0; i < 8; i++) {
        const ph = ((t - T.FILL) * 0.7 + i / 8) % 1, ang = i / 8 * TAU + t * 0.8, r = 120 + ph * 90;
        ctx.save(); ctx.globalAlpha = Math.sin(ph * Math.PI); icon('star', hx + Math.cos(ang) * r, hy + 40 + Math.sin(ang) * r * 0.7, 20 + 16 * Math.sin(ph * Math.PI), C.amber); ctx.restore();
      }
    }
  }

  // ---------- end card (37 – 40) ----------
  function endCard(t) {
    const k = E.inOutCubic(P(t, T.LOGO, T.LOGO + 0.55));
    if (k <= 0) return;
    const [gx, gy] = proj(gem.position.x, gem.position.y, gem.position.z);
    ctx.save();
    ctx.beginPath(); ctx.arc(gx, gy, k * 2300, 0, TAU); ctx.fillStyle = C.blue; ctx.fill();
    ctx.clip();
    // subtle diamond pattern on the brand blue
    for (let i = 0; i < 18; i++) { const x = rnd(i + 70) * W, y = rnd(i + 90) * H, s = 14 + rnd(i) * 20; ctx.save(); ctx.translate(x, y - (t - 37) * 20); ctx.rotate(Math.PI / 4); ctx.fillStyle = i % 3 ? 'rgba(255,255,255,0.07)' : 'rgba(255,182,39,0.18)'; ctx.fillRect(-s / 2, -s / 2, s, s); ctx.restore(); }
    const lk = E.outBack(P(t, T.LOGO + 0.35, T.LOGO + 0.85));
    if (lk > 0) {
      const size = 420 * lk, ar = mark.naturalHeight / mark.naturalWidth;
      ctx.save(); ctx.translate(540, 720); ctx.rotate((1 - lk) * -0.3); ctx.drawImage(mark, -size / 2, -size * ar / 2, size, size * ar); ctx.restore();
    }
    const wk = E.outBack(P(t, T.LOGO + 0.75, T.LOGO + 1.15));
    if (wk > 0) {
      ctx.save(); ctx.globalAlpha = clamp(wk); ctx.translate(540, 1080 + (1 - wk) * 40);
      ctx.font = F(800, 120); ctx.letterSpacing = '-3px'; ctx.fillStyle = C.white; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillText('Taskkora', 0, 0); ctx.restore();
    }
    const tk = E.outBack(P(t, T.LOGO + 1.15, T.LOGO + 1.55));
    if (tk > 0) {
      ctx.save(); ctx.translate(540, 1230); ctx.scale(tk, tk);
      ctx.font = F(800, 58); ctx.letterSpacing = '-1px';
      const a = 'Ada task? ', b = 'Taskkora-in aja.'; const wa = ctx.measureText(a).width, wb = ctx.measureText(b).width, w = wa + wb + 80;
      rr(-w / 2, -58, w, 116, 58); ctx.fillStyle = C.white; ctx.fill();
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillStyle = C.amberD; ctx.fillText(a, -w / 2 + 40, 3); ctx.fillStyle = C.blue; ctx.fillText(b, -w / 2 + 40 + wa, 3);
      ctx.restore();
    }
    // a little green gem bobbing above the logo
    if (lk > 0.5) diamond2D(540, 430 + Math.sin(t * 3) * 10, 70 * E.outBack(P(t, T.LOGO + 0.6, T.LOGO + 1.0)), C.green);
    for (let i = 0; i < 7; i++) { const ph = ((t - 37) * 0.8 + i / 7) % 1; ctx.save(); ctx.globalAlpha = Math.sin(ph * Math.PI) * clamp(k * 2 - 1); icon('star', 120 + i * 140, 1480 - ph * 120 + (i % 2) * 60, 26, C.amber); ctx.restore(); }
    ctx.restore();
  }

  function watermark() {
    ctx.save(); ctx.globalAlpha = 0.3; ctx.fillStyle = C.ink;
    ctx.font = F(500, 30); ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic'; ctx.letterSpacing = '0px';
    ctx.fillText('@taskkora__', W - 44, H - 46);
    ctx.restore();
  }
  function watermarkOnBlue(t) { // same mark in white once the brand blue takes over
    const k = E.inOutCubic(P(t, T.LOGO + 0.3, T.LOGO + 0.55));
    if (k <= 0) return;
    ctx.save(); ctx.globalAlpha = 0.3 * k; ctx.fillStyle = C.white;
    ctx.font = F(500, 30); ctx.textAlign = 'right'; ctx.letterSpacing = '0px'; ctx.fillText('@taskkora__', W - 44, H - 46); ctx.restore();
  }

  // =====================================================================
  function render(t) {
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.letterSpacing = '0px';
    const p = render3D(t);
    // hook hit: tiny camera kick on frame 0
    const kick = t < 0.3 ? (1 - t / 0.3) * 14 : 0;
    background(t);
    ctx.drawImage(glc, (rnd(Math.floor(t * 60)) - 0.5) * kick, (rnd(Math.floor(t * 60) + 1) - 0.5) * kick);
    // red alarm vignette in the hook
    if (t < 4.0) { const a = (Math.floor(t * 4) % 2 === 0 ? 0.22 : 0.08) * (1 - P(t, 3.6, 4.0)); const g = ctx.createRadialGradient(540, 960, 500, 540, 960, 1150); g.addColorStop(0, 'rgba(232,72,77,0)'); g.addColorStop(1, `rgba(232,72,77,${a})`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
    needsPanel(t);
    floaters(t, p);
    pieMenu(t);
    mintaskFx(t);
    if (t < 4.1) hookText(t);
    banners(t);
    endCard(t);
    watermark();
    watermarkOnBlue(t);
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

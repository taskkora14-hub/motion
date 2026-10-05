/* "ini laptop asli atau kue?" — hyper-real "is it cake" promo, 40s, 1080x1920.
 * three.js scene (studio light, marble table): campus objects get sliced by a big knife and turn out
 * to be layered cake. Every frame is a pure function of time; timings mirrored in cake/music.py. */
import * as THREE from 'three';
import { RoomEnvironment } from './vendor/RoomEnvironment.js';
import { RoundedBoxGeometry } from './vendor/RoundedBoxGeometry.js';

const W = 1080, H = 1920, DURATION = 40;
const out = document.getElementById('c');
const octx = out.getContext('2d');

// ---------- timeline ----------
// segment: [object, start, knife contact, knife bottom, knife out, separate]
const SEGS = [
  { id: 'laptop', t0: 0.0, end: 10.0, contact: 0.0, bottom: 2.4, lift: [2.6, 3.3], sep: [4.2, 5.0] },
  { id: 'books', t0: 10.0, end: 16.0, contact: 11.4, bottom: 12.9, lift: [13.0, 13.5], sep: [13.6, 14.4] },
  { id: 'backpack', t0: 16.0, end: 22.0, contact: 17.4, bottom: 18.9, lift: [19.0, 19.5], sep: [19.6, 20.4] },
  { id: 'tumbler', t0: 22.0, end: 28.0, contact: 23.4, bottom: 24.9, lift: [25.0, 25.5], sep: [25.6, 26.4] },
  { id: 'pencil', t0: 28.0, end: 34.0, contact: 29.4, bottom: 30.9, lift: [31.0, 31.5], sep: [31.6, 32.4] },
];
const FINALE = 34.0, CLOTH = [35.0, 35.6, 36.2, 36.8, 37.4];

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const P = (t, a, b) => clamp((t - a) / (b - a));
const E = {
  outCubic: x => 1 - Math.pow(1 - x, 3),
  inCubic: x => x * x * x,
  inOutCubic: x => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
  inOutSine: x => -(Math.cos(Math.PI * x) - 1) / 2,
  outBack: x => { const c1 = 1.8, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); },
};
const rnd = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

// ---------- renderer ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(W, H, false);
renderer.setPixelRatio(1);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.localClippingEnabled = true;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xe7ecf4);
scene.fog = new THREE.Fog(0xe7ecf4, 9, 26);
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.75;

const camera = new THREE.PerspectiveCamera(34, W / H, 0.05, 80);

// studio lights: soft key, cool rim, warm fill
const key = new THREE.DirectionalLight(0xffffff, 2.6);
key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.radius = 6; key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02;
Object.assign(key.shadow.camera, { left: -3.5, right: 3.5, top: 3.5, bottom: -3.5, near: 0.5, far: 20 });
scene.add(key, key.target);
const rim = new THREE.DirectionalLight(0x9cc0ff, 1.2); scene.add(rim, rim.target);
const fill = new THREE.DirectionalLight(0xffe2b0, 0.5); scene.add(fill, fill.target);
function aimLights(cx, cz) {
  key.position.set(cx + 2.5, 6.5, cz + 3.5); key.target.position.set(cx, 0, cz);
  rim.position.set(cx - 4, 3, cz - 4); rim.target.position.set(cx, 0.5, cz);
  fill.position.set(cx + 4, 2, cz - 1); fill.target.position.set(cx, 0.3, cz);
}

// ---------- procedural textures ----------
function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
// value noise for marble veins
function noise2(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const h = (a, b) => rnd(a * 57.3 + b * 311.9);
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  return lerp(lerp(h(xi, yi), h(xi + 1, yi), u), lerp(h(xi, yi + 1), h(xi + 1, yi + 1), u), v);
}
const fbm = (x, y) => { let s = 0, a = 0.5, f = 1; for (let o = 0; o < 5; o++) { s += a * noise2(x * f, y * f); a *= 0.5; f *= 2.03; } return s; };
const marbleTex = canvasTex(1024, 1024, (g, w, h) => {
  const im = g.createImageData(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const nx = x / w * 6, ny = y / h * 6;
    const tur = fbm(nx * 0.8, ny * 0.8);
    const v1 = Math.abs(Math.sin((nx * 0.9 + ny * 0.6 + tur * 6.5) * 1.7));
    const v2 = Math.abs(Math.sin((nx * 0.4 - ny * 1.1 + fbm(nx + 5, ny) * 9) * 2.3));
    const vein = Math.pow(1 - v1, 18) * 0.75 + Math.pow(1 - v2, 40) * 0.5;
    const cloud = fbm(nx * 2, ny * 2) * 0.06;
    const base = 0.955 - cloud;
    const i = (y * w + x) * 4;
    im.data[i] = 255 * (base - vein * 0.42); im.data[i + 1] = 255 * (base - vein * 0.38); im.data[i + 2] = 255 * (base - vein * 0.26 + 0.01);
    // a rare thin amber vein
    const gold = Math.pow(1 - Math.abs(Math.sin((nx * 0.7 + ny * 0.2 + fbm(nx * 1.3, ny + 9) * 7) * 1.3)), 160);
    if (gold > 0.2) { im.data[i] = 225; im.data[i + 1] = 180; im.data[i + 2] = 95; }
    im.data[i + 3] = 255;
  }
  g.putImageData(im, 0, 0);
});
marbleTex.wrapS = marbleTex.wrapT = THREE.RepeatWrapping; marbleTex.repeat.set(2, 2);

const table = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshPhysicalMaterial({ map: marbleTex, roughness: 0.22, clearcoat: 0.8, clearcoatRoughness: 0.12 }));
table.rotation.x = -Math.PI / 2; table.receiveShadow = true; scene.add(table);

// ---------- cake cross-section textures ----------
const CAKE = {
  sponge: ['#E9C27A', '#D9A85A', '#F6DDA6'],
  choco: ['#5A3426', '#3E2219', '#7A4A36'],
  cream: '#FFF8EC', blue: '#5E88D6', caramel: '#EFA43A',
};
function rrPts(u0, v0, w, h, r, seg = 6) {
  const p = []; r = Math.min(r, w / 2, h / 2);
  const corners = [[u0 + w - r, v0 + r, -Math.PI / 2], [u0 + w - r, v0 + h - r, 0], [u0 + r, v0 + h - r, Math.PI / 2], [u0 + r, v0 + r, Math.PI]];
  for (const [cx, cy, a0] of corners) for (let k = 0; k <= seg; k++) { const a = a0 + k / seg * Math.PI / 2; p.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
  return p;
}
function polyPts(n, r, cu, cv, rot = 0) { const p = []; for (let k = 0; k < n; k++) { const a = rot + k / n * Math.PI * 2; p.push([cu + Math.cos(a) * r, cv + Math.sin(a) * r]); } return p; }
// cap = { pts:[[u(z), v(y)]], shell:'#hex', sponge:'sponge'|'choco', core? }
function cakeTexture(cap) {
  const us = cap.pts.map(p => p[0]), vs = cap.pts.map(p => p[1]);
  const minU = Math.min(...us), maxU = Math.max(...us), minV = Math.min(...vs), maxV = Math.max(...vs);
  const su = maxU - minU, sv = maxV - minV;
  const res = 900 / Math.max(su, sv);
  const cw = Math.max(64, Math.round(su * res)), ch = Math.max(64, Math.round(sv * res));
  const toC = ([u, v]) => [(u - minU) * res, (1 - (v - minV) / sv) * ch];
  const tex = canvasTex(cw, ch, (g) => {
    const path = () => { g.beginPath(); cap.pts.forEach((p, i) => { const [x, y] = toC(p); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.closePath(); };
    g.save(); path(); g.clip();
    const sp = CAKE[cap.sponge || 'sponge'];
    // horizontal layers bottom -> top
    const nL = clamp(Math.round(sv / 0.13), 3, 11);
    const unit = ch / nL;
    for (let k = 0; k < nL; k++) {
      const y1 = ch - k * unit, y0 = y1 - unit;
      if (k % 2 === 0) {
        const gr = g.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, sp[2]); gr.addColorStop(0.5, sp[0]); gr.addColorStop(1, sp[1]);
        g.fillStyle = gr; g.fillRect(0, y0, cw, unit + 1);
        // crumb pores
        const n = Math.round(cw * unit / 90);
        for (let i = 0; i < n; i++) {
          const x = rnd(i * 3.1 + k * 91) * cw, y = y0 + rnd(i * 7.7 + k * 13) * unit, r = 1 + rnd(i + k) * 3.5;
          g.fillStyle = rnd(i * 1.3 + k) > 0.5 ? sp[1] + 'AA' : sp[2] + 'CC'; g.beginPath(); g.ellipse(x, y, r * 1.4, r, rnd(i) * 3, 0, 7); g.fill();
        }
      } else {
        const kind = [CAKE.cream, CAKE.blue, CAKE.cream, CAKE.caramel][((k - 1) / 2) % 4];
        const th = unit * (kind === CAKE.caramel ? 0.5 : 0.8);
        g.fillStyle = sp[0]; g.fillRect(0, y0, cw, unit + 1);
        g.fillStyle = kind; g.beginPath(); g.moveTo(0, y0 + (unit - th) / 2);
        for (let x = 0; x <= cw; x += 12) g.lineTo(x, y0 + (unit - th) / 2 + Math.sin(x * 0.03 + k) * unit * 0.06);
        for (let x = cw; x >= 0; x -= 12) g.lineTo(x, y0 + (unit + th) / 2 + Math.sin(x * 0.025 + k * 2) * unit * 0.06);
        g.closePath(); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(0, y0 + (unit - th) / 2 + 2, cw, 3);
      }
    }
    if (cap.core) { // pencil "graphite" = chocolate core
      const [x, y] = toC(cap.core.c); g.fillStyle = CAKE.choco[0]; g.beginPath(); g.arc(x, y, cap.core.r * res, 0, 7); g.fill();
      g.fillStyle = CAKE.choco[2]; for (let i = 0; i < 40; i++) { g.beginPath(); g.arc(x + (rnd(i) - 0.5) * cap.core.r * res * 1.4, y + (rnd(i + 3) - 0.5) * cap.core.r * res * 1.4, 3, 0, 7); g.fill(); }
    }
    g.restore();
    // fondant shell + crumb coat along the outline
    const shell = (cap.shellW || 0.03) * res;
    g.save(); path(); g.clip();
    g.lineJoin = 'round'; path(); g.lineWidth = shell * 2 + 10; g.strokeStyle = CAKE.cream; g.stroke();
    path(); g.lineWidth = shell * 2; g.strokeStyle = cap.shell; g.stroke();
    g.restore();
  });
  const shape = new THREE.Shape(cap.pts.map(([u, v]) => new THREE.Vector2(u, v)));
  const geo = new THREE.ShapeGeometry(shape, 12);
  // remap UVs to the bounding box
  const uv = geo.attributes.uv, pos = geo.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getX(i) - minU) / su, (pos.getY(i) - minV) / sv);
  return { geo, mat: new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.62, sheen: 0.4, sheenColor: new THREE.Color(0xfff2d8), side: THREE.DoubleSide }) };
}

// ---------- objects ----------
// each def.build(add, M) adds meshes; M(opts) returns a material for the current half
const DEFS = {
  laptop: {
    size: [2.3, 0.3, 1.6],
    build(add, M) {
      const blue = M({ color: 0x184aa1, metalness: 0.55, roughness: 0.32, clearcoat: 0.5 });
      add(new RoundedBoxGeometry(2.3, 0.3, 1.6, 4, 0.06), blue, [0, 0.15, 0]);
      add(new THREE.BoxGeometry(2.26, 0.012, 1.56), M({ color: 0x0b1a3d, roughness: 0.5 }), [0, 0.13, 0]);          // lid seam
      add(new THREE.CylinderGeometry(0.17, 0.17, 0.004, 48), M({ color: 0xf4f6fb, roughness: 0.25, metalness: 0.3 }), [0.35, 0.301, -0.1]);   // logo dot
      add(new THREE.BoxGeometry(0.16, 0.05, 0.02), M({ color: 0x0b1a3d }), [0.75, 0.08, 0.8]);                 // ports
      add(new THREE.BoxGeometry(0.1, 0.05, 0.02), M({ color: 0x0b1a3d }), [0.5, 0.08, 0.8]);
      add(new THREE.BoxGeometry(0.05, 0.02, 0.02), M({ color: 0xffb627, emissive: 0xffb627, emissiveIntensity: 0.8 }), [-0.9, 0.08, 0.8]);
    },
    caps: () => [{ pts: rrPts(-0.8, 0, 1.6, 0.3, 0.06), shell: '#184AA1', shellW: 0.022 }],
    cam: { pos: [2.4, 2.0, 3.6], look: [0, 0.05, 0.2], macroPos: [1.35, 0.55, 1.15], macroLook: [0, 0.15, 0.15] },
  },
  books: {
    size: [1.9, 0.85, 1.4],
    build(add, M) {
      const pages = M({ map: pageTex, roughness: 0.85 });
      const books = [[0.05, 0, 1.8, 0.3, 1.3, 0x0b1a3d], [-0.06, 0.3, 1.66, 0.26, 1.2, 0xf4efe3], [0.08, 0.56, 1.58, 0.24, 1.12, 0xffb627]];
      for (const [x, y, w, h, d, c] of books) {
        add(new RoundedBoxGeometry(w, h, d, 3, 0.02), M({ color: c, roughness: 0.55, clearcoat: 0.3 }), [x, y + h / 2, 0]);
        add(new THREE.BoxGeometry(w - 0.06, h - 0.05, 0.02), pages, [x + 0.0, y + h / 2, d / 2 + 0.001]);
        if (c === 0xf4efe3) add(new THREE.BoxGeometry(w + 0.004, 0.06, d + 0.004), M({ color: 0x184aa1, roughness: 0.5 }), [x, y + h * 0.7, 0]);
      }
    },
    caps: () => [
      { pts: rrPts(-0.65, 0, 1.3, 0.3, 0.02), shell: '#0B1A3D', shellW: 0.02 },
      { pts: rrPts(-0.6, 0.3, 1.2, 0.26, 0.02), shell: '#F4EFE3', shellW: 0.02, sponge: 'choco' },
      { pts: rrPts(-0.56, 0.56, 1.12, 0.24, 0.02), shell: '#FFB627', shellW: 0.02 },
    ],
    cam: { pos: [2.2, 2.1, 3.4], look: [0, 0.35, 0.15], macroPos: [1.3, 0.8, 1.2], macroLook: [0, 0.42, 0.1] },
  },
  backpack: {
    size: [1.3, 1.7, 1.0],
    build(add, M) {
      const navy = M({ color: 0x1b2a57, roughness: 0.92, sheen: 0.6, sheenColor: new THREE.Color(0x6f8fd6) });
      const blue = M({ color: 0x184aa1, roughness: 0.9, sheen: 0.5, sheenColor: new THREE.Color(0x9cc0ff) });
      add(new RoundedBoxGeometry(1.3, 1.6, 0.7, 6, 0.26), navy, [0, 0.8, 0]);
      add(new RoundedBoxGeometry(1.0, 0.7, 0.3, 5, 0.12), blue, [0, 0.48, 0.42]);
      const zip = M({ color: 0xffb627, metalness: 0.7, roughness: 0.3 });
      add(new THREE.BoxGeometry(0.9, 0.02, 0.02), zip, [0, 0.8, 0.565]);
      add(new THREE.BoxGeometry(0.05, 0.1, 0.03), zip, [0.3, 0.75, 0.58]);
      const handle = new THREE.TorusGeometry(0.16, 0.04, 12, 32, Math.PI); add(handle, navy, [0, 1.6, 0]);
      add(new THREE.BoxGeometry(0.12, 0.9, 0.06), M({ color: 0x0b1a3d, roughness: 0.9 }), [-0.35, 0.95, -0.38]);
      add(new THREE.BoxGeometry(0.12, 0.9, 0.06), M({ color: 0x0b1a3d, roughness: 0.9 }), [0.35, 0.95, -0.38]);
    },
    caps: () => [
      { pts: rrPts(-0.35, 0, 0.7, 1.6, 0.26), shell: '#1B2A57', shellW: 0.03, sponge: 'choco' },
      { pts: rrPts(0.27, 0.13, 0.3, 0.7, 0.12), shell: '#184AA1', shellW: 0.025 },
    ],
    cam: { pos: [2.6, 2.6, 4.0], look: [0, 0.75, 0.1], macroPos: [1.5, 1.2, 1.45], macroLook: [0, 0.85, 0.05] },
  },
  tumbler: {
    size: [0.9, 1.9, 0.9],
    build(add, M) {
      add(new THREE.CylinderGeometry(0.42, 0.4, 1.5, 64), M({ color: 0x184aa1, metalness: 0.35, roughness: 0.38, clearcoat: 0.6 }), [0, 0.75, 0]);
      add(new THREE.CylinderGeometry(0.425, 0.425, 0.08, 64), M({ color: 0xf4f6fb, metalness: 0.8, roughness: 0.2 }), [0, 1.54, 0]);
      add(new THREE.CylinderGeometry(0.4, 0.42, 0.3, 64), M({ color: 0x0b1a3d, roughness: 0.4 }), [0, 1.73, 0]);
      add(new THREE.TorusGeometry(0.12, 0.035, 12, 32, Math.PI), M({ color: 0x0b1a3d, roughness: 0.4 }), [0, 1.88, 0]);
      add(new THREE.CylinderGeometry(0.43, 0.43, 0.06, 64), M({ color: 0xffb627, roughness: 0.4 }), [0, 0.3, 0]);
    },
    caps: () => [
      { pts: rrPts(-0.42, 0, 0.84, 1.5, 0.02), shell: '#184AA1', shellW: 0.03, sponge: 'choco' },
      { pts: rrPts(-0.42, 1.5, 0.84, 0.38, 0.03), shell: '#0B1A3D', shellW: 0.03 },
    ],
    cam: { pos: [2.2, 2.7, 3.6], look: [0, 0.9, 0], macroPos: [1.25, 1.2, 1.25], macroLook: [0, 0.95, 0] },
  },
  pencil: {
    size: [2.9, 0.7, 0.7],
    build(add, M) {
      const hexR = 0.33;
      // hex prism extruded along x from the same outline the cake cap uses
      const hex = new THREE.Shape(polyPts(6, hexR, 0, hexR * 0.87).map(([u, v]) => new THREE.Vector2(u, v)));
      const body = new THREE.ExtrudeGeometry(hex, { depth: 2.2, bevelEnabled: false }); body.translate(0, 0, -1.1); body.rotateY(Math.PI / 2);
      add(body, M({ color: 0xffb627, roughness: 0.35, clearcoat: 0.7 }), [0, 0, 0]);
      const wood = new THREE.ConeGeometry(hexR, 0.55, 6); wood.rotateZ(Math.PI / 2);
      add(wood, M({ color: 0xe8c28a, roughness: 0.8 }), [-1.375, hexR * 0.87, 0], [Math.PI / 2, 0, 0]);
      const lead = new THREE.ConeGeometry(0.1, 0.17, 24); lead.rotateZ(Math.PI / 2);
      add(lead, M({ color: 0x1a1f2e, roughness: 0.3, metalness: 0.6 }), [-1.565, hexR * 0.87, 0]);
      const fer = new THREE.CylinderGeometry(hexR * 0.95, hexR * 0.95, 0.22, 32); fer.rotateZ(Math.PI / 2);
      add(fer, M({ color: 0xdfe5ee, metalness: 0.9, roughness: 0.25 }), [1.21, hexR * 0.87, 0]);
      const er = new THREE.CylinderGeometry(hexR * 0.93, hexR * 0.93, 0.22, 32); er.rotateZ(Math.PI / 2);
      add(er, M({ color: 0xf2a7a0, roughness: 0.7 }), [1.43, hexR * 0.87, 0]);
    },
    caps: () => [{ pts: polyPts(6, 0.33, 0, 0.33 * 0.87), shell: '#FFB627', shellW: 0.028, core: { c: [0, 0.33 * 0.87], r: 0.09 } }],
    cam: { pos: [2.3, 1.7, 3.2], look: [-0.1, 0.25, 0], macroPos: [1.0, 0.55, 0.95], macroLook: [0, 0.3, 0] },
  },
};
const pageTex = canvasTex(256, 64, (g, w, h) => { g.fillStyle = '#F4EEDC'; g.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 2) { g.fillStyle = `rgba(150,130,100,${0.15 + rnd(y) * 0.15})`; g.fillRect(0, y, w, 1); } });

// build a rig = left half + right half, each clipped at local x = 0, each with its cake cap
function makeRig(def) {
  const rig = new THREE.Group();
  const halves = [];
  for (const side of [-1, 1]) {
    const half = new THREE.Group();
    const local = new THREE.Plane(new THREE.Vector3(side, 0, 0), 0);
    const world = new THREE.Plane();
    const M = o => new THREE.MeshPhysicalMaterial({ ...o, clippingPlanes: [world], clipShadows: true, side: THREE.FrontSide });
    def.build((geo, mat, p, r) => { const m = new THREE.Mesh(geo, mat); m.position.set(...p); if (r) m.rotation.set(...r); m.castShadow = true; m.receiveShadow = true; half.add(m); }, M);
    // invert: material clip keeps distance >= 0 -> plane (side,0,0) keeps side*x >= 0
    for (const cap of def.caps()) {
      const { geo, mat } = cakeTexture(cap);
      const m = new THREE.Mesh(geo, mat);
      m.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
      if (side < 0) m.scale.x = -1;
      m.position.x = side * 0.0005; m.receiveShadow = true;
      half.add(m);
    }
    half.userData = { local, world, side };
    rig.add(half); halves.push(half);
  }
  rig.userData.halves = halves;
  scene.add(rig);
  return rig;
}
const RIGS = {};
for (const id of Object.keys(DEFS)) RIGS[id] = makeRig(DEFS[id]);
function updateClip(rig) {
  rig.updateMatrixWorld(true);
  for (const h of rig.userData.halves) h.userData.world.copy(h.userData.local).applyMatrix4(h.matrixWorld);
}

// ---------- knife ----------
const knife = new THREE.Group();
{
  const s = new THREE.Shape();
  s.moveTo(-1.35, 0); s.lineTo(1.1, 0); s.lineTo(1.1, 0.5); s.lineTo(-0.9, 0.5); s.quadraticCurveTo(-1.3, 0.3, -1.45, 0.02); s.closePath();
  const blade = new THREE.ExtrudeGeometry(s, { depth: 0.014, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 2 });
  blade.translate(0, 0, -0.007); blade.rotateY(Math.PI / 2);   // blade lies in the YZ plane, edge at y=0, tip toward -z
  const steel = new THREE.MeshPhysicalMaterial({ color: 0xd9dee6, metalness: 1, roughness: 0.14, clearcoat: 0.3 });
  const bm = new THREE.Mesh(blade, steel); bm.castShadow = true; knife.add(bm);
  const handle = new RoundedBoxGeometry(0.07, 0.2, 0.9, 4, 0.03);
  const hm = new THREE.Mesh(handle, new THREE.MeshPhysicalMaterial({ color: 0x0b1a3d, roughness: 0.35, clearcoat: 0.8 }));
  hm.position.set(0, 0.36, -1.55); hm.castShadow = true; knife.add(hm);   // blade tip points at the camera (+z), handle behind
  for (const z of [-1.3, -1.55, -1.8]) { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.075, 16), new THREE.MeshStandardMaterial({ color: 0xffb627, metalness: 1, roughness: 0.25 })); r.rotation.z = Math.PI / 2; r.position.set(0, 0.36, z); knife.add(r); }
  // cream smear (shown after the cut)
  const smear = canvasTex(256, 128, (g, w, h) => { g.clearRect(0, 0, w, h); for (let i = 0; i < 40; i++) { g.fillStyle = i % 3 ? 'rgba(255,248,236,0.95)' : 'rgba(233,194,122,0.95)'; g.beginPath(); g.ellipse(rnd(i) * w, h - rnd(i + 5) * h * 0.5, 8 + rnd(i + 2) * 22, 5 + rnd(i + 7) * 10, 0, 0, 7); g.fill(); } });
  const sm = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.3), new THREE.MeshStandardMaterial({ map: smear, transparent: true, roughness: 0.6, side: THREE.DoubleSide }));
  sm.rotation.y = Math.PI / 2; sm.position.set(0.012, 0.15, -0.1); knife.add(sm); knife.userData.smear = sm;
}
scene.add(knife);

// ---------- crumbs ----------
const CRUMBS = 70;
const crumbGeo = new THREE.DodecahedronGeometry(0.018, 0);
const crumbs = new THREE.InstancedMesh(crumbGeo, new THREE.MeshStandardMaterial({ color: 0xe2b56a, roughness: 0.9 }), CRUMBS);
crumbs.castShadow = true; scene.add(crumbs);
const dummy = new THREE.Object3D();

// ---------- cloths (finale) ----------
const LINEUP = { backpack: [0, 0, -2.3, 0.6], books: [-0.85, 0, -0.95, 0.55], tumbler: [0.9, 0, -0.95, 0.62], laptop: [-0.8, 0, 0.6, 0.48], pencil: [0.88, 0, 0.62, 0.45] };
const ORDER = ['laptop', 'books', 'backpack', 'tumbler', 'pencil'];
const cloths = ORDER.map((id, i) => {
  const g = new THREE.PlaneGeometry(1.0, 1.0, 72, 72); g.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, new THREE.MeshPhysicalMaterial({ color: i % 2 ? 0x0b1a3d : 0x184aa1, roughness: 0.75, sheen: 0.25, sheenColor: new THREE.Color(0x9cc0ff), side: THREE.DoubleSide }));
  m.castShadow = true; m.receiveShadow = true; m.visible = false; scene.add(m);
  m.userData.base = g.attributes.position.array.slice();
  return m;
});
function drapeCloth(m, id, t0, t) {
  const [x, , z, s] = LINEUP[id]; const [w, h, d] = DEFS[id].size;
  const W2 = w * s / 2 + 0.03, D2 = d * s / 2 + 0.03, top = h * s + 0.03;
  const FALL = 0.2, size = Math.max(W2, D2) * 2 + FALL * 2 + 0.12;
  m.position.set(x, 0, z); m.scale.set(size, 1, size);
  const p = E.inCubic(P(t, t0, t0 + 0.45));
  const base = lerp(top + 2.2, 0.004, p);
  const pos = m.geometry.attributes.position, b = m.userData.base;
  for (let i = 0; i < pos.count; i++) {
    const lx = b[i * 3] * size, lz = b[i * 3 + 2] * size;
    const ox = Math.max(0, Math.abs(lx) - W2), oz = Math.max(0, Math.abs(lz) - D2);
    const dist = Math.hypot(ox, oz);
    const k = Math.min(1, dist / FALL), fall = top * (0.5 + 0.5 * Math.cos(Math.PI * k)) * (1 - 0.15 * k);
    const wr = 0.02 * Math.sin(lx * 18 + lz * 9) * Math.min(1, dist * 3);
    const settle = 1 + 0.06 * Math.sin((t - t0 - 0.45) * 18) * Math.exp(-(t - t0 - 0.45) * 6) * (t > t0 + 0.45 ? 1 : 0);
    const r2 = (lx * lx + lz * lz) / (size * size * 0.5);              // edges trail behind while it falls
    const sag = (1 - p) * 0.35 * r2 + Math.sin(lx * 6 + t * 9) * 0.03 * (1 - p);
    pos.setY(i, Math.max(base + sag, fall * settle + wr * (base < top ? 1 : 0)));
  }
  pos.needsUpdate = true; m.geometry.computeVertexNormals();
}

// ---------- per-frame state ----------
function segAt(t) { for (const s of SEGS) if (t >= s.t0 && t < s.end) return s; return null; }
function setCamera(pos, look) { camera.position.set(...pos); camera.lookAt(...look); }
function knifeState(seg, t) {
  const def = DEFS[seg.id], top = def.size[1];
  if (t < seg.contact - 0.6 || t > seg.lift[1] + 0.05) return null;
  let y;
  if (t < seg.contact) y = lerp(top + 0.9, top - 0.0, E.inOutCubic(P(t, seg.contact - 0.6, seg.contact)));
  else if (t < seg.bottom) y = lerp(top - 0.0, -0.01, E.inOutSine(P(t, seg.contact, seg.bottom)));
  else if (t < seg.lift[0]) y = -0.01;
  else y = lerp(-0.01, top + 1.4, E.inCubic(P(t, seg.lift[0], seg.lift[1])));
  if (seg.id === 'laptop' && t < seg.contact + 0.05) y = top - 0.08;     // hook: the knife is already stuck in at frame 0
  const saw = t > seg.contact && t < seg.bottom ? Math.sin((t - seg.contact) * Math.PI * 2 * 1.6) * 0.18 : 0;
  return { y, z: 0.1 + saw, smear: t > seg.bottom };
}

function render3D(t) {
  for (const id in RIGS) RIGS[id].visible = false;
  cloths.forEach(c => (c.visible = false));
  crumbs.count = 0;
  knife.visible = false;
  const seg = segAt(t);
  if (seg) {
    const def = DEFS[seg.id], rig = RIGS[seg.id];
    rig.visible = true; rig.position.set(0, 0, 0); rig.rotation.set(0, 0, 0); rig.scale.setScalar(1);
    const [L, R] = rig.userData.halves;
    const sp = E.inOutCubic(P(t, seg.sep[0], seg.sep[1]));
    L.position.set(-sp * 0.12, 0, 0); L.rotation.set(0, -sp * 0.18, 0);
    R.position.set(sp * 0.75, 0, sp * 0.15); R.rotation.set(0, sp * 0.95, 0);
    updateClip(rig);
    aimLights(0, 0);
    // knife
    const k = knifeState(seg, t);
    if (k) { knife.visible = true; knife.position.set(0, k.y, k.z); knife.rotation.set(0, 0, 0); knife.userData.smear.visible = k.smear; }
    // crumbs from the cut edge as the halves part
    if (t > seg.sep[0]) {
      crumbs.count = CRUMBS;
      const top = def.size[1], dz = def.size[2];
      for (let i = 0; i < CRUMBS; i++) {
        const t0 = seg.sep[0] + rnd(i * 3 + 1) * 0.6, d = Math.max(0, t - t0);
        const x0 = (rnd(i) - 0.5) * 0.12, y0 = top * (0.3 + rnd(i + 7) * 0.7), z0 = (rnd(i + 11) - 0.5) * dz * 0.9;
        const vx = (rnd(i + 13) - 0.3) * 0.6, vy = rnd(i + 17) * 0.5;
        let y = y0 + vy * d - 4.9 * d * d; const land = y <= 0.012;
        if (land) y = 0.012;
        const tl = land ? (vy + Math.sqrt(vy * vy + 19.6 * (y0 - 0.012))) / 9.8 : d;
        dummy.position.set(x0 + vx * Math.min(d, tl), y, z0); dummy.rotation.set(rnd(i) * 6 + d * 3, rnd(i + 1) * 6, 0);
        dummy.scale.setScalar(t < t0 ? 0 : 0.6 + rnd(i + 5) * 1.2); dummy.updateMatrix(); crumbs.setMatrixAt(i, dummy.matrix);
      }
      crumbs.instanceMatrix.needsUpdate = true;
    }
    // camera: wide 3/4 view, slow orbit, then macro push onto the cut face
    const c = def.cam, local = t - seg.t0;
    const orbit = Math.sin(local * 0.35) * 0.18;
    const m = E.inOutCubic(P(t, seg.sep[0] + 0.3, seg.end - 0.4));
    const pos = [lerp(c.pos[0], c.macroPos[0], m) + orbit, lerp(c.pos[1], c.macroPos[1], m), lerp(c.pos[2], c.macroPos[2], m) - orbit * 0.5];
    const look = [lerp(c.look[0], c.macroLook[0], m), lerp(c.look[1], c.macroLook[1], m), lerp(c.look[2], c.macroLook[2], m)];
    // hook: start a touch tighter and push in during the stab
    if (seg.id === 'laptop' && t < 4) { const h = E.outCubic(P(t, 0, 4)); pos[0] -= 0.4 * h; pos[1] -= 0.25 * h; pos[2] -= 0.5 * h; }
    look[1] += 0.55 * (1 - m);     // keep the object in the lower-middle, under the caption
    setCamera(pos, look);
  } else {
    // finale: everything lined up, intact, covered one by one
    aimLights(0, -0.4);
    for (const id of ORDER) {
      const rig = RIGS[id], [x, y, z, s] = LINEUP[id];
      rig.visible = true; rig.position.set(x, y, z); rig.scale.setScalar(s); rig.rotation.set(0, 0, 0);
      for (const h of rig.userData.halves) { h.position.set(0, 0, 0); h.rotation.set(0, 0, 0); }
      updateClip(rig);
    }
    ORDER.forEach((id, i) => { if (t >= CLOTH[i]) { cloths[i].visible = true; drapeCloth(cloths[i], id, CLOTH[i], t); } });
    const f = E.outCubic(P(t, FINALE, FINALE + 1.0));
    setCamera([lerp(0.9, 0.5, f), lerp(7.4, 6.8, f), lerp(7.4, 6.6, f)], [0, 0.7, -0.75]);
  }
  renderer.render(scene, camera);
}

// ---------- 2D overlay (captions) ----------
const F = (w, s) => `${w} ${s}px "PP", sans-serif`;
function caption(lines, y, t0, t, o = {}) {
  const p = E.outBack(P(t, t0, t0 + 0.35));
  if (p <= 0) return;
  octx.save(); octx.translate(540, y); octx.scale(p, p);
  lines.forEach(([s, size, col], i) => {
    octx.font = F(900, size); octx.textAlign = 'center'; octx.textBaseline = 'alphabetic'; octx.wordSpacing = Math.round(size * 0.1) + 'px';
    const w = octx.measureText(s).width, sc = Math.min(1, 980 / w), yy = i * size * 1.12;
    octx.save(); octx.translate(0, yy); octx.scale(sc, sc);
    octx.shadowColor = 'rgba(8,20,48,0.45)'; octx.shadowBlur = 24; octx.shadowOffsetY = 6;
    octx.lineWidth = size * 0.16; octx.strokeStyle = '#0B1A3D'; octx.lineJoin = 'round'; octx.strokeText(s, 0, 0);
    octx.shadowColor = 'transparent'; octx.fillStyle = col; octx.fillText(s, 0, 0);
    octx.restore();
  });
  octx.restore();
}
function pill(s, x, y, t0, t, bg = '#FFB627', fg = '#0B1A3D') {
  const p = E.outBack(P(t, t0, t0 + 0.3)); if (p <= 0) return;
  octx.save(); octx.translate(x, y); octx.scale(p, p); octx.rotate(-0.04);
  octx.font = F(900, 64); const w = octx.measureText(s).width + 80;
  octx.shadowColor = 'rgba(8,20,48,0.35)'; octx.shadowBlur = 20; octx.shadowOffsetY = 6;
  octx.beginPath(); octx.roundRect(-w / 2, -58, w, 116, 58); octx.fillStyle = bg; octx.fill();
  octx.shadowColor = 'transparent'; octx.fillStyle = fg; octx.textAlign = 'center'; octx.fillText(s, 0, 22);
  octx.restore();
}
function overlay(t) {
  if (t < 4.0) caption([['ini laptop asli', 112, '#FFFFFF'], ['atau kue?', 128, '#FFB627']], 300, -1, t);
  for (const s of SEGS) {
    if (t < s.t0 || t >= s.end) continue;
    if (s.id !== 'laptop' && t < s.sep[0]) caption([['kue atau bukan?', 104, '#FFFFFF']], 320, s.t0 + 0.15, t);
    if (t >= s.sep[0] + 0.2) pill('kue!', 540, 330, s.sep[0] + 0.25, t);
  }
  if (t >= FINALE) caption([['yang mana paling', 92, '#FFFFFF'], ['bikin kamu kaget?', 100, '#FFB627']], 290, FINALE + 0.2, t);
}

function watermark() {
  octx.save(); octx.globalAlpha = 0.25; octx.font = F(600, 30); octx.textAlign = 'right'; octx.fillStyle = '#FFFFFF';
  octx.shadowColor = 'rgba(0,0,0,0.6)'; octx.shadowBlur = 4; octx.fillText('@taskkora__', 1040, 1872); octx.restore();
}

function render(t) {
  render3D(t);
  octx.setTransform(1, 0, 0, 1, 0, 0); octx.globalAlpha = 1;
  octx.drawImage(renderer.domElement, 0, 0, W, H);
  // soft studio vignette
  const v = octx.createRadialGradient(540, 1000, 600, 540, 1000, 1350); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(8,20,48,0.22)'); octx.fillStyle = v; octx.fillRect(0, 0, W, H);
  overlay(t);
  watermark();
}

// ---------- runtime ----------
const ready = Promise.all(['900 40px "PP"', '600 40px "PP"'].map(f => document.fonts.load(f))).then(() => document.fonts.ready).then(() => { render(0.5); });
window.TASKKORA = { render, ready, DURATION, W, H };
const params = new URLSearchParams(location.search);
if (params.has('render')) document.body.classList.add('render');
else {
  const btn = document.getElementById('play'), seek = document.getElementById('seek'), tl = document.getElementById('time');
  let playing = true, start = performance.now(), tNow = 0;
  if (params.has('t')) { tNow = parseFloat(params.get('t')); playing = false; btn.textContent = 'Play'; }
  btn.onclick = () => { playing = !playing; btn.textContent = playing ? 'Pause' : 'Play'; start = performance.now() - tNow * 1000; };
  seek.oninput = () => { tNow = parseFloat(seek.value); start = performance.now() - tNow * 1000; };
  ready.then(() => {
    const loop = () => { if (playing) tNow = ((performance.now() - start) / 1000) % DURATION; render(tNow); seek.value = tNow; tl.textContent = tNow.toFixed(2) + 's'; requestAnimationFrame(loop); };
    loop();
  });
}

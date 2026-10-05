/* "Tunggu sampai kupu-kupunya terbang." — ink-in-water macro, 40s, 1080x1920.
 * The ink is a fragment shader (WebGL): signed-distance shapes (plume → cloud → flower → bird →
 * butterfly) blended over time and pushed through a domain-warped noise field, shaded with
 * Beer–Lambert absorption so blue/amber dye darkens a soft white studio backdrop like real ink.
 * Bubbles, splash, headline and watermark are drawn on top in 2D. Pure function of time. */
(() => {
  'use strict';

  const W = 1080, H = 1920, DURATION = 40;
  const GW = 720, GH = 1280;                         // shader resolution (ink is soft; upscaled smoothly)
  const { T, KEYS, MORPHS, FLAP_HZ } = window.INK;
  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d');
  const C = { blue: '#184AA1', navy: '#0D1B3E', amber: '#FFB627', white: '#FFFFFF' };

  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const P = (t, a, b) => clamp((t - a) / (b - a));
  const sstep = x => x * x * (3 - 2 * x);
  const ease = x => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const outCubic = x => 1 - Math.pow(1 - x, 3);
  const bump = (t, a, b) => Math.sin(P(t, a, b) * Math.PI);
  const rnd = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const TAU = Math.PI * 2;

  const ready = Promise.all([document.fonts.load('600 80px "SO"'), document.fonts.load('400 30px "SO"')]).then(() => document.fonts.ready);

  // =====================================================================
  //  WebGL ink
  // =====================================================================
  const glc = document.createElement('canvas'); glc.width = GW; glc.height = GH;
  const gl = glc.getContext('webgl', { preserveDrawingBuffer: true, antialias: false, premultipliedAlpha: false });
  const VS = 'attribute vec2 a; void main(){ gl_Position = vec4(a, 0.0, 1.0); }';
  const FS = `
precision highp float;
uniform vec2 uRes;
uniform float uT, uWarp, uRot, uZoom, uDetail, uGlow, uSky, uBloom, uBirdF, uFlap, uResid, uCamY, uInk;
uniform float uW0, uW1, uW2, uW3, uW4;
uniform vec2 uPlume;          // head y, head radius
uniform vec4 uAmb;            // amber blob x, y, r, alpha
uniform vec3 uBf;             // butterfly cx, cy, scale

const float SURF = 0.481;     // water surface (world y): 640 px from the top

float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0)), u.x), u.y) * 2.0 - 1.0; }
const mat2 RM = mat2(0.8, -0.6, 0.6, 0.8);
float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * noise(p); p = RM * p * 2.03 + 11.7; a *= 0.5; } return s; }
float smin(float a, float b, float k){ float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0); return mix(b, a, h) - k * h * (1.0 - h); }
float sdCap(vec2 p, vec2 a, vec2 b, float r){ vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h) - r; }
float sdEll(vec2 p, vec2 c, vec2 r, float ang){ p -= c; float cs = cos(ang), sn = sin(ang); p = mat2(cs, sn, -sn, cs) * p; return (length(p / r) - 1.0) * min(r.x, r.y); }

float sdPlume(vec2 p){
  float hy = uPlume.x, hr = uPlume.y;
  float head = (length(vec2(p.x / 1.35, (p.y - hy) / 0.75)) - hr) * 0.75;
  float stem = sdCap(p, vec2(0.0, SURF + 0.02), vec2(0.0, hy), 0.008 + hr * 0.12);
  return smin(head, stem, 0.04);
}
float sdCloud(vec2 p){
  float d = length(p - vec2(-0.12, 0.0)) - 0.13;
  d = smin(d, length(p - vec2(0.05, 0.07)) - 0.15, 0.06);
  d = smin(d, length(p - vec2(0.18, -0.02)) - 0.11, 0.06);
  d = smin(d, length(p - vec2(0.0, -0.08)) - 0.12, 0.06);
  d = smin(d, length(p - vec2(-0.24, -0.06)) - 0.08, 0.06);
  return d;
}
float sdFlower(vec2 p){
  float a = atan(p.y, p.x) + uT * 0.05, r = length(p);
  float rr = 0.06 + 0.2 * uBloom * (0.5 + 0.5 * pow(abs(cos(3.0 * a)), 0.7));
  float d = (r - rr) * 0.8;
  d = min(d, sdCap(p, vec2(0.0, -0.05), vec2(0.03, -0.5), 0.012));
  d = min(d, sdEll(p, vec2(0.09, -0.32), vec2(0.07, 0.025), 0.5));
  return d;
}
float sdBird(vec2 p){
  float f = uBirdF;
  float d = sdEll(p, vec2(0.0, 0.0), vec2(0.035, 0.1), 0.0);
  for (int k = 0; k < 2; k++) {
    float s = k == 0 ? 1.0 : -1.0;
    d = smin(d, sdCap(p, vec2(0.02 * s, 0.02), vec2(0.17 * s, 0.08 + f * 0.6), 0.035), 0.03);
    d = smin(d, sdCap(p, vec2(0.17 * s, 0.08 + f * 0.6), vec2(0.36 * s, 0.02 + f * 1.4), 0.014), 0.03);
  }
  d = smin(d, sdEll(p, vec2(0.0, -0.13), vec2(0.04, 0.05), 0.0), 0.03);
  return d;
}
// butterfly: returns wing sdf in .x, full sdf in .y, local wing coords in .zw
vec4 butterfly(vec2 p){
  vec2 q = (p - uBf.xy) / uBf.z;
  float fl = max(0.14, uFlap);
  vec2 w = vec2(abs(q.x) / fl, q.y);
  float wing = sdEll(w, vec2(0.19, 0.09), vec2(0.2, 0.14), 0.45);
  wing = smin(wing, sdEll(w, vec2(0.12, -0.11), vec2(0.13, 0.1), -0.55), 0.03);
  float body = sdCap(q, vec2(0.0, -0.15), vec2(0.0, 0.11), 0.022);
  body = min(body, sdCap(q, vec2(0.0, 0.11), vec2(0.07, 0.23), 0.004));
  body = min(body, sdCap(q, vec2(0.0, 0.11), vec2(-0.07, 0.23), 0.004));
  float d = min(wing * fl, body);
  return vec4(wing * fl * uBf.z, d * uBf.z, w);
}

void main(){
  vec2 frag = gl_FragCoord.xy;
  vec2 s = (frag - vec2(0.5 * uRes.x, uRes.y * (760.0 / 1920.0))) / uRes.x;   // screen space, y up, origin at ink centre (1160 px)
  vec2 world = s + vec2(0.0, uCamY);
  float cs = cos(uRot), sn = sin(uRot);
  vec2 p = mat2(cs, sn, -sn, cs) * (world / uZoom);

  // domain warp: the slow swirling of water
  vec2 q = vec2(fbm(p * 3.0 + vec2(0.0, uT * 0.05)), fbm(p * 3.0 + vec2(5.2, 1.3) - uT * 0.04));
  vec2 r = vec2(fbm(p * 6.0 + q * 2.0 + uT * 0.07), fbm(p * 6.0 + q * 2.0 + vec2(8.3, 2.8)));
  vec2 pw = p + uWarp * q + uWarp * 0.45 * r;

  float d = 0.0;
  if (uW0 > 0.0) d += uW0 * sdPlume(pw);
  if (uW1 > 0.0) d += uW1 * sdCloud(pw);
  if (uW2 > 0.0) d += uW2 * sdFlower(pw);
  if (uW3 > 0.0) d += uW3 * sdBird(pw);
  vec4 bf = vec4(1.0);
  // the butterfly gets a lighter warp as the detail resolves
  vec2 pb = p + (uWarp * (1.0 - 0.7 * uDetail)) * (q + 0.45 * r);
  if (uW4 > 0.0) { bf = butterfly(pb); d += uW4 * bf.y; }

  // ink density
  float e = 0.01 + uWarp * 0.12;
  float body = smoothstep(e, -e * 2.5, d);
  float tex = 0.5 + 0.5 * fbm(pw * 9.0 + uT * 0.03);
  float rim = exp(-pow((d + 0.012) / 0.018, 2.0)) * 0.55;
  float fil = pow(1.0 - abs(fbm(pw * 7.0 + q * 1.5)), 7.0) * exp(-max(d, 0.0) * 13.0) * (0.3 + uWarp * 4.0);
  float Db = (body * (0.22 + 0.6 * tex) + rim * 0.8 + fil * 0.8) * uInk;

  // residual ink left in the water once the butterfly has gone
  if (uResid > 0.0) {
    vec2 pr = p * 0.85 + 0.12 * q;
    float dr = sdCloud(pr) * 1.2;
    Db += uResid * (smoothstep(0.08, -0.12, dr) * (0.2 + 0.3 * tex) + fil * 0.4);
  }

  // amber dye
  float Da = 0.0;
  if (uAmb.w > 0.0) {
    vec2 pa = pw - uAmb.xy;
    float da = (length(vec2(pa.x / 1.2, pa.y / 0.85)) - uAmb.z) * 0.85;
    Da = uAmb.w * (smoothstep(0.02, -0.05, da) * (0.5 + 0.6 * tex) + exp(-max(da, 0.0) * 16.0) * pow(1.0 - abs(fbm(pw * 8.0 - q)), 6.0) * 0.6);
  }
  // butterfly: amber wings, blue edges + veins
  float wingIn = 0.0, veins = 0.0, edge = 0.0, spots = 0.0;
  if (uW4 > 0.0) {
    vec2 w = bf.zw;
    float ang = atan(w.y, w.x);
    veins = smoothstep(0.86, 0.99, abs(sin(ang * 6.5 + 0.3))) * smoothstep(0.03, 0.12, length(w));
    edge = smoothstep(-0.055, -0.02, bf.x / uBf.z);
    wingIn = smoothstep(0.0, -0.03, bf.x / uBf.z);
    vec2 sp = vec2(abs(w.x), w.y);
    spots = smoothstep(0.022, 0.012, length(sp - vec2(0.33, 0.2))) + smoothstep(0.018, 0.01, length(sp - vec2(0.28, 0.25)))
          + smoothstep(0.016, 0.008, length(sp - vec2(0.21, -0.17)));
    float det = uDetail * uW4;
    Da = max(Da, wingIn * (1.0 - edge) * (1.0 - veins * 0.8) * det * (0.75 + 0.35 * tex) * 1.15);
    Db = mix(Db, Db * (0.25 + 0.9 * max(edge, veins)) + body * 0.15, det * wingIn);
    Db *= 1.0 - spots * det * 0.9;
  }

  vec2 uv = frag / uRes;
  float wy = world.y;
  float below = smoothstep(SURF + 0.003, SURF - 0.003, wy);
  float bflyMask = uW4 > 0.0 ? uW4 * smoothstep(0.05, -0.01, bf.y) : 0.0;
  float inWater = max(below, bflyMask);
  Db *= inWater; Da *= inWater;
  Db *= 1.0 - clamp(Da, 0.0, 1.0) * 0.92;          // dyes stay separate: amber never turns olive

  // ----- backdrop: soft studio light, water below the surface -----
  float vig = length((uv - vec2(0.5, 0.55)) * vec2(1.0, 0.75));
  vec3 bg = mix(vec3(0.985, 0.988, 0.995), vec3(0.86, 0.885, 0.93), smoothstep(0.15, 0.85, vig));
  bg *= mix(1.0, 0.975, below);
  bg += vec3(0.02) * below * fbm(world * 4.0 + vec2(uT * 0.05, 0.0)) ;      // faint caustics
  bg -= vec3(0.12, 0.09, 0.05) * exp(-pow((wy - SURF + 0.004) / 0.003, 2.0));  // meniscus line
  bg += vec3(0.05) * exp(-pow((wy - SURF - 0.004) / 0.004, 2.0));

  vec3 kb = vec3(2.36, 1.24, 0.46);   // absorption giving #184AA1 at unit density
  vec3 ka = vec3(0.0, 0.34, 1.88);    // absorption giving #FFB627
  vec3 col = bg * exp(-(Db * kb * 1.15 + Da * ka));

  // glow of the finished butterfly
  if (uGlow > 0.0 && uW4 > 0.0) {
    float g = exp(-max(bf.y, 0.0) * 22.0) * uGlow;
    col += vec3(0.25, 0.48, 1.0) * g * 0.35 * (1.0 - wingIn * 0.6);
    col += vec3(1.0, 0.72, 0.2) * wingIn * (1.0 - edge) * uGlow * 0.18;
  }

  // ----- dusk sky (35 – 40): sky above the water, butterfly becomes light -----
  if (uSky > 0.0) {
    float h = wy - SURF;                                   // height above the water: sunset sits on the horizon
    vec3 sky = mix(vec3(1.0, 0.71, 0.24), vec3(0.094, 0.29, 0.63), smoothstep(0.02, 0.75, h));
    sky = mix(sky, vec3(0.05, 0.106, 0.243), smoothstep(0.8, 1.8, h));
    float sunD = length(world - vec2(-0.18, SURF + 0.1));
    sky += vec3(1.0, 0.8, 0.45) * exp(-sunD * 11.0) * 0.45;
    float sy = clamp(h / 1.8, 0.0, 1.0);
    float clouds = smoothstep(0.1, 0.6, fbm(vec2(uv.x * 3.0 + uT * 0.02, uv.y * 9.0)) + 0.1) * smoothstep(0.65, 0.2, sy) * 0.18;
    sky = mix(sky, vec3(1.0, 0.82, 0.6), clouds);
    float bfly = uW4 * smoothstep(0.004, -0.01, bf.y);
    vec3 em = sky;
    em += vec3(0.3, 0.55, 1.0) * exp(-max(bf.y, 0.0) * 30.0) * 0.9;                 // blue halo
    em = mix(em, vec3(0.35, 0.6, 1.0), bfly * max(edge, veins) * 0.9);              // glowing blue veins/edge
    em = mix(em, vec3(1.0, 0.75, 0.25), bfly * wingIn * (1.0 - max(edge, veins)) * 0.95);
    em = mix(em, vec3(0.2, 0.35, 0.8), bfly * (1.0 - wingIn));                      // body
    float air = 1.0 - below;
    col = mix(col, em, uSky * max(air, bflyMask * smoothstep(SURF - 0.05, SURF + 0.02, wy)));
  }
  // fine film grain
  col += (hash(frag + fract(uT) * 100.0) - 0.5) * 0.012;
  gl_FragColor = vec4(col, 1.0);
}`;
  function sh(type, src) { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; }
  const prog = gl.createProgram(); gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  gl.useProgram(prog);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aLoc = gl.getAttribLocation(prog, 'a'); gl.enableVertexAttribArray(aLoc); gl.vertexAttribPointer(aLoc, 2, gl.FLOAT, false, 0, 0);
  const U = {}; ['uRes', 'uT', 'uWarp', 'uRot', 'uZoom', 'uDetail', 'uGlow', 'uSky', 'uBloom', 'uBirdF', 'uFlap', 'uResid', 'uCamY', 'uInk', 'uW0', 'uW1', 'uW2', 'uW3', 'uW4', 'uPlume', 'uAmb', 'uBf'].forEach(n => (U[n] = gl.getUniformLocation(prog, n)));
  gl.viewport(0, 0, GW, GH);

  // =====================================================================
  //  choreography (all in world units: 1 = frame width, y up, origin at ink centre)
  // =====================================================================
  const SURF = 0.481;
  function weights(t) {
    let i = 0; while (i < KEYS.length - 1 && KEYS[i + 1][0] <= t) i++;
    const a = KEYS[i], b = KEYS[Math.min(i + 1, KEYS.length - 1)];
    const k = b[0] > a[0] ? ease(P(t, a[0], b[0])) : 0;
    return [1, 2, 3, 4, 5].map(j => lerp(a[j], b[j], k));
  }
  function flapPhase(t) {
    if (t < T.BFLY) return 0;
    if (t < T.LIFT) return (t - T.BFLY) * FLAP_HZ(31);
    return (T.LIFT - T.BFLY) * FLAP_HZ(31) + (t - T.LIFT) * FLAP_HZ(34);
  }
  function butterflyPos(t) {
    // hover in the water, then lift through the surface, then fly up into the dusk sky
    const hover = [Math.sin(t * 0.7) * 0.01, Math.sin(t * 1.1) * 0.012];
    const lift = ease(P(t, T.LIFT, T.SKY + 0.6));
    const fly = P(t, T.SKY, T.END);
    const x = hover[0] + lerp(0, 0.05, lift) + Math.sin(fly * 4.2) * 0.07 * fly + fly * 0.06;
    const y = hover[1] + lerp(0, 0.74, lift) + outCubic(fly) * 1.2 + Math.sin(t * 3.2) * 0.012 * fly;
    const s = lerp(1, 0.78, lift) * lerp(1, 0.42, outCubic(fly));
    return [x, y, s];
  }
  function camY(t) { return ease(P(t, T.SKY - 0.4, T.SKY + 3.4)) * 1.32; }
  function warp(t) {
    let w = 0.022 + 0.035 * P(t, 0, 4);
    for (const [a, b] of MORPHS) w += 0.085 * bump(t, a - 0.3, b + 0.3);
    if (t > 24.6) w = lerp(0.07, 0.014, ease(P(t, 24.6, 30.0)));
    return w;
  }
  function amber(t) {
    if (t < T.AMBER) return [0, 0, 0, 0];
    const fall = outCubic(P(t, T.AMBER, 8.5));
    let x = 0.09, y = lerp(SURF, 0.03, fall), r = lerp(0.012, 0.1, fall), a = 1;
    const gather = ease(P(t, 9.0, 12.4));                     // swirls into the flower's heart
    x = lerp(x, 0, gather); y = lerp(y, 0, gather); r = lerp(r, 0.07, gather);
    a *= 1 - ease(P(t, 15.4, 18.0)) * 0.85;                   // thins out while the bird flies
    a *= 1 - ease(P(t, 24.0, 27.0));                          // its pigment moves into the wings
    return [x, y, r, a];
  }

  function shaderFrame(t) {
    const w = weights(t), [bx, by, bs] = butterflyPos(t);
    const plumeK = outCubic(P(t, -0.05, 4.2));
    gl.uniform2f(U.uRes, GW, GH);
    gl.uniform1f(U.uT, t);
    gl.uniform1f(U.uWarp, warp(t));
    gl.uniform1f(U.uRot, 0.05 * Math.sin(t * 0.13) + t * 0.0035);
    gl.uniform1f(U.uZoom, 1 + 0.035 * Math.sin(t * 0.11) + 0.12 * ease(P(t, 26, 31)) - 0.12 * ease(P(t, T.LIFT, T.SKY)));
    gl.uniform1f(U.uDetail, ease(P(t, 24.6, 30.0)));
    gl.uniform1f(U.uGlow, ease(P(t, 28.5, 31.0)));
    gl.uniform1f(U.uSky, ease(P(t, T.LIFT + 0.6, T.SKY + 1.4)));
    gl.uniform1f(U.uBloom, ease(P(t, 10.2, 14.6)));
    gl.uniform1f(U.uBirdF, Math.sin(t * 1.3) * 0.05);
    const ph = flapPhase(t);
    const minF = lerp(0.62, 0.22, ease(P(t, T.LIFT, T.LIFT + 1.2)));                  // gentle in the water, full strokes in flight
    gl.uniform1f(U.uFlap, t < T.BFLY ? 1 : lerp(minF, 1, 0.5 + 0.5 * Math.cos(ph * TAU)));
    gl.uniform1f(U.uResid, t < T.LIFT ? 0 : bump(t, T.LIFT, T.LIFT + 4.5) * 0.9);
    gl.uniform1f(U.uCamY, camY(t));
    gl.uniform1f(U.uInk, 1.0);
    w.forEach((v, i) => gl.uniform1f(U['uW' + i], v));
    gl.uniform2f(U.uPlume, lerp(SURF - 0.01, 0.02, plumeK), lerp(0.03, 0.2, plumeK));
    gl.uniform4f(U.uAmb, ...amber(t));
    gl.uniform3f(U.uBf, bx, by, bs);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  // world → screen (1080x1920)
  const toScreen = (x, y, t) => [W / 2 + x * W, H * (1 - 760 / 1920) - (y - camY(t)) * W];

  // =====================================================================
  //  2D overlays
  // =====================================================================
  function splash(t) {
    const [sx, sy] = toScreen(0, SURF, t);
    // falling drop + streak (frame 0: touching the surface)
    if (t < 0.12) {
      ctx.save(); ctx.globalAlpha = 1 - t / 0.12;
      const g = ctx.createLinearGradient(sx, sy - 420, sx, sy); g.addColorStop(0, 'rgba(24,74,161,0)'); g.addColorStop(1, 'rgba(24,74,161,0.55)');
      ctx.fillStyle = g; ctx.fillRect(sx - 7, sy - 420, 14, 420);
      ctx.beginPath(); ctx.ellipse(sx, sy - 10, 17, 24, 0, 0, TAU); ctx.fillStyle = C.blue; ctx.fill();
      ctx.restore();
    }
    drops(t, 0, sx, sy, C.blue);
    if (t > T.AMBER - 0.5 && t < T.AMBER + 2) {
      const [ax, ay] = toScreen(0.09, SURF, t);
      if (t < T.AMBER) { const k = P(t, T.AMBER - 0.35, T.AMBER); ctx.beginPath(); ctx.ellipse(ax, lerp(ay - 700, ay - 8, k * k), 12, 17, 0, 0, TAU); ctx.fillStyle = '#E99A10'; ctx.fill(); }
      drops(t, T.AMBER, ax, ay, '#E99A10');
    }
  }
  function drops(t, t0, sx, sy, col) {
    const a = t - t0; if (a < 0 || a > 1.6) return;
    ctx.save();
    // surface ripples (seen at a grazing angle)
    for (let k = 0; k < 3; k++) {
      const ak = a - k * 0.12; if (ak <= 0) continue;
      ctx.globalAlpha = 0.5 * (1 - ak / 1.6) ** 2; ctx.strokeStyle = 'rgba(13,27,62,0.55)'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.ellipse(sx, sy, 20 + ak * 320, 4 + ak * 22, 0, 0, TAU); ctx.stroke();
    }
    // crown of droplets
    for (let i = 0; i < 14; i++) {
      const ang = Math.PI * (0.08 + 0.84 * rnd(i + t0 * 3)), sp = 260 + rnd(i + 5 + t0) * 380;
      const px = sx + Math.cos(ang) * sp * a * (i % 2 ? 1 : -1) * 0.8, py = sy - Math.sin(ang) * sp * a + 1300 * a * a;
      if (py > sy + 4) continue;
      ctx.globalAlpha = 0.85; ctx.fillStyle = i % 3 ? 'rgba(255,255,255,0.95)' : col;
      ctx.beginPath(); ctx.arc(px, py, 3 + rnd(i) * 5, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(13,27,62,0.25)'; ctx.lineWidth = 1.5; ctx.stroke();
    }
    ctx.restore();
  }
  function bubbles(t) {
    const [, sy] = toScreen(0, SURF, t);
    for (let i = 0; i < 26; i++) {
      const sp = 22 + rnd(i) * 40, x = rnd(i + 3) * W + Math.sin(t * 0.8 + i) * 10;
      let y = H + 40 - ((t * sp + rnd(i + 9) * 2000) % (H + 200 - Math.max(0, sy)));
      if (y < sy + 10) continue;
      const r = 2 + rnd(i + 7) * 6;
      ctx.save(); ctx.globalAlpha = 0.5 * (1 - P(t, T.SKY + 1, T.SKY + 3));
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.strokeStyle = 'rgba(13,27,62,0.25)'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.beginPath(); ctx.arc(x - r * 0.35, y - r * 0.35, r * 0.35, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fill();
      ctx.restore();
    }
  }
  function sparkles(t) {
    if (t < T.LIFT) return;
    // amber/blue motes trailing the butterfly as it leaves the water
    for (let i = 0; i < 26; i++) {
      const life = 1.4, born = T.LIFT + (i / 26) * (T.END - T.LIFT), a = t - born;
      if (a < 0 || a > life) continue;
      const [bx, by, bs] = butterflyPos(born);
      const [x, y] = toScreen(bx + (rnd(i) - 0.5) * 0.15 * bs, by - 0.05 * bs - a * 0.05, t);
      ctx.save(); ctx.globalAlpha = Math.sin(a / life * Math.PI) * 0.9;
      const r = 3 + rnd(i + 2) * 5;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r * 4); g.addColorStop(0, i % 2 ? 'rgba(255,200,90,1)' : 'rgba(140,185,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.fillRect(x - r * 4, y - r * 4, r * 8, r * 8); ctx.restore();
    }
  }
  function headline(t) {
    const out = P(t, 3.55, 4.1);
    if (out >= 1) return;
    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = C.navy;
    ctx.font = '600 104px "SO", sans-serif'; ctx.letterSpacing = '-3px';
    const lines = ['Tunggu sampai', 'kupu-kupunya', 'terbang.'];
    lines.forEach((l, i) => {
      const k = outCubic(P(t, i * 0.06, 0.45 + i * 0.06));
      ctx.save(); ctx.globalAlpha = lerp(0.9, 1, k) * (1 - out);
      ctx.translate(540, 290 + i * 118 + (1 - k) * 18 - out * 30);
      if (i === 2) { ctx.fillStyle = C.blue; }
      ctx.filter = out > 0 ? `blur(${out * 8}px)` : 'none';
      ctx.fillText(l, 0, 0);
      ctx.restore();
    });
    // small amber accent under "terbang."
    const w = 260 * outCubic(P(t, 0.3, 0.9)) * (1 - out);
    ctx.fillStyle = C.amber; ctx.fillRect(540 - w / 2, 548, w, 8);
    ctx.restore();
  }
  function watermark(t) {
    ctx.save(); ctx.globalAlpha = 0.25;
    const sky = P(t, T.SKY, T.SKY + 1.5);
    ctx.fillStyle = sky > 0.5 ? C.white : C.navy;
    ctx.font = '400 30px "SO", sans-serif'; ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic'; ctx.letterSpacing = '0px';
    ctx.fillText('@taskkora__', W - 44, H - 46);
    ctx.restore();
  }

  // =====================================================================
  function render(t) {
    shaderFrame(t);
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.filter = 'none';
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    // tiny impact jolt on frame 0
    const j = t < 0.25 ? (1 - t / 0.25) * 10 : 0;
    ctx.drawImage(glc, -16 + (rnd(Math.floor(t * 60)) - 0.5) * j, -16 + (rnd(Math.floor(t * 60) + 1) - 0.5) * j, W + 32, H + 32);
    bubbles(t);
    splash(t);
    sparkles(t);
    headline(t);
    watermark(t);
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

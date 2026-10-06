/* "Chat a atau b yang bakal dibalas dosen?" — 40s, 1080x1920, chat-screen simulation.
 * Two chat windows stacked (top = versi a, bottom = versi b), animated bubbles with sent/read
 * ticks, and a lecturer emoji (smile / frown) as the guide. Names are placeholders only.
 * Every frame is a pure function of time; shared timing lives in timeline.js. */
(() => {
  'use strict';

  const W = 1080, H = 1920, DURATION = 40, TAU = Math.PI * 2;
  const TL = window.CHAT_TL;
  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d');

  const C = {
    blue: '#184AA1', blueHi: '#2F63C4', navy: '#0E1A44', navy2: '#16265C', white: '#FFFFFF',
    bg: '#E9EFFB', bg2: '#D7E2F6', chat: '#F3F6FC', line: '#C9D6F2', grey: '#8C9AC0',
    amber: '#FFB627', amberHi: '#FFD27A', amberLo: '#E09A10', frown: '#F2A65A',
  };
  const FONT = '"Jakarta", sans-serif';

  // ---------- math ----------
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const P = (t, a, b) => clamp((t - a) / (b - a));
  const E = {
    outCubic: x => 1 - Math.pow(1 - x, 3),
    inCubic: x => x * x * x,
    inOut: x => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
    outBack: x => { const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); },
  };

  const ready = Promise.all([document.fonts.load(`800 60px ${FONT}`), document.fonts.load(`700 60px ${FONT}`), document.fonts.load(`500 60px ${FONT}`)]).then(() => document.fonts.ready);

  // ---------- helpers ----------
  const rr = (x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); };
  const ell = (x, y, rx, ry) => { ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, TAU); };
  const fill = c => { ctx.fillStyle = c; ctx.fill(); };
  function stroke(c, w) { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke(); }
  function line(pts, w, c) { ctx.beginPath(); ctx.moveTo(...pts[0]); for (let i = 1; i < pts.length; i++) ctx.lineTo(...pts[i]); stroke(c, w); }
  function text(str, x, y, size, color, o = {}) {
    ctx.save();
    ctx.font = `${o.weight || 700} ${size}px ${FONT}`; ctx.textAlign = o.align || 'center'; ctx.textBaseline = 'middle';
    ctx.letterSpacing = (o.spacing ?? -Math.round(size * 0.01)) + 'px';
    const w = ctx.measureText(str).width, max = o.maxW || 960;
    ctx.translate(x, y); if (w > max) ctx.scale(max / w, max / w);
    if (o.scale != null) ctx.scale(o.scale, o.scale);
    ctx.globalAlpha *= o.alpha ?? 1;
    ctx.fillStyle = color; ctx.fillText(str, 0, 0);
    ctx.restore();
  }
  function shadowed(fn, blur = 30, y = 12, a = 0.16) { ctx.save(); ctx.shadowColor = `rgba(14,26,68,${a})`; ctx.shadowBlur = blur; ctx.shadowOffsetY = y; fn(); ctx.restore(); }

  // word-wrap that keeps [placeholders] as single tokens
  const MSG = 34, LH = 46;
  function wrap(str, maxW) {
    ctx.font = `500 ${MSG}px ${FONT}`; ctx.letterSpacing = '0px';
    const words = str.split(' '), lines = []; let cur = [];
    const width = ws => ctx.measureText(ws.join(' ')).width;
    for (const w of words) { if (cur.length && width([...cur, w]) > maxW) { lines.push(cur); cur = [w]; } else cur.push(w); }
    if (cur.length) lines.push(cur);
    return lines;
  }
  function msgText(lines, x, y, color, chars = Infinity) {
    ctx.save(); ctx.font = `500 ${MSG}px ${FONT}`; ctx.letterSpacing = '0px'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    const sp = ctx.measureText(' ').width; let n = 0;
    lines.forEach((ws, li) => {
      let cx = x;
      ws.forEach(w => {
        if (n >= chars) return;
        const shown = w.slice(0, Math.max(0, chars - n)); n += w.length + 1;
        const ww = ctx.measureText(w).width;
        if (w.startsWith('[')) { rr(cx - 2, y + li * LH - 21, ww + 4, 40, 8); fill(C.amber); ctx.fillStyle = C.navy; }
        else ctx.fillStyle = color;
        ctx.fillText(shown, cx, y + li * LH);
        cx += ww + sp;
      });
    });
    ctx.restore();
  }

  // lecturer emoji: 'think' | 'smile' | 'frown' | 'neutral'
  function face(x, y, r, expr, pop = 1) {
    ctx.save(); ctx.translate(x, y); ctx.scale(pop, pop);
    ell(0, 0, r, r); fill(expr === 'frown' ? C.frown : C.amber); ell(0, 0, r, r); stroke(C.navy, r * 0.08);
    const eY = -r * 0.15, eX = r * 0.36;
    if (expr === 'smile') {
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(s * eX, eY + 4, r * 0.14, Math.PI * 1.1, Math.PI * 1.9); stroke(C.navy, r * 0.09); }
      ctx.beginPath(); ctx.arc(0, r * 0.1, r * 0.48, 0.15 * Math.PI, 0.85 * Math.PI); stroke(C.navy, r * 0.1);
      ell(-r * 0.58, r * 0.2, r * 0.14, r * 0.09); fill('rgba(255,120,90,0.45)'); ell(r * 0.58, r * 0.2, r * 0.14, r * 0.09); fill('rgba(255,120,90,0.45)');
    } else if (expr === 'frown') {
      for (const s of [-1, 1]) { ell(s * eX, eY + 6, r * 0.09, r * 0.12); fill(C.navy); line([[s * eX * 1.6, eY - r * 0.28], [s * eX * 0.45, eY - r * 0.14]], r * 0.09, C.navy); }
      ctx.beginPath(); ctx.arc(0, r * 0.62, r * 0.3, 1.2 * Math.PI, 1.8 * Math.PI); stroke(C.navy, r * 0.1);
      line([[-r * 0.08, -r * 0.62], [-r * 0.02, -r * 0.48]], r * 0.06, C.navy); line([[r * 0.08, -r * 0.62], [r * 0.02, -r * 0.48]], r * 0.06, C.navy);
    } else {
      for (const s of [-1, 1]) { ell(s * eX, eY, r * 0.09, r * 0.12); fill(C.navy); }
      if (expr === 'think') { line([[-r * 0.25, r * 0.38], [r * 0.25, r * 0.32]], r * 0.09, C.navy); }
      else line([[-r * 0.28, r * 0.35], [r * 0.28, r * 0.35]], r * 0.09, C.navy);
    }
    ctx.restore();
    if (expr === 'think') { ctx.save(); ctx.translate(x + r * 0.95, y - r * 0.9); ctx.scale(pop, pop); ell(0, 0, r * 0.42, r * 0.42); fill(C.white); ell(0, 0, r * 0.42, r * 0.42); stroke(C.navy, 3); text('?', 0, 2, r * 0.55, C.blue, { weight: 800 }); ctx.restore(); }
  }

  // =====================================================================
  // CHAT PANEL
  // st: { typing:[t0,t1], send, read, msg, react:{t, expr}, reply:{t, text}, unread }
  function panel(t, letter, box, st) {
    const { x, y, w, h } = box;
    // buzz shake on a bad reaction
    let sx = 0;
    if (st.react && st.react.expr === 'frown' && t >= st.react.t && t < st.react.t + 0.35) sx = Math.sin((t - st.react.t) * 90) * 10 * (1 - (t - st.react.t) / 0.35);
    ctx.save(); ctx.translate(sx, 0);
    shadowed(() => { rr(x, y, w, h, 36); fill(C.white); }, 40, 16, 0.18);
    ctx.save(); rr(x, y, w, h, 36); ctx.clip();
    // header
    ctx.fillStyle = C.blue; ctx.fillRect(x, y, w, 96);
    const expr = st.react && t >= st.react.t ? st.react.expr : 'think';
    const pop = st.react && t >= st.react.t ? E.outBack(P(t, st.react.t, st.react.t + 0.3)) * 0.25 + 0.75 : 1;
    face(x + 62, y + 48, 32, expr, pop);
    text('dosen pembimbing', x + 112, y + 34, 30, C.white, { align: 'left', weight: 800 });
    const typingNow = st.typing && t >= st.typing[0] && t < st.typing[1];
    const replyTyping = st.reply && t >= st.reply.t - 0.5 && t < st.reply.t;
    text(replyTyping ? 'mengetik…' : 'online', x + 112, y + 68, 22, C.amberHi, { align: 'left', weight: 600 });
    // version badge
    ell(x + w - 58, y + 48, 34, 34); fill(C.amber);
    text(letter, x + w - 58, y + 46, 40, C.navy, { weight: 800 });
    text('versi', x + w - 140, y + 48, 24, C.white, { weight: 700, alpha: 0.85 });
    // chat body
    ctx.fillStyle = C.chat; ctx.fillRect(x, y + 96, w, h - 96);
    // input bar
    const iy = y + h - 82;
    rr(x + 24, iy, w - 130, 60, 30); fill(C.white); rr(x + 24, iy, w - 130, 60, 30); stroke(C.line, 2);
    ell(x + w - 58, iy + 30, 30, 30); fill(C.blue);
    ctx.beginPath(); ctx.moveTo(x + w - 70, iy + 18); ctx.lineTo(x + w - 42, iy + 30); ctx.lineTo(x + w - 70, iy + 42); ctx.lineTo(x + w - 64, iy + 30); ctx.closePath(); fill(C.white);
    const maxBW = w - 220;
    const lines = wrap(st.msg, maxBW - 48);
    if (typingNow) {
      const p = P(t, st.typing[0], st.typing[1]);
      const one = st.msg.length > 40 ? st.msg.slice(Math.max(0, Math.floor(p * st.msg.length) - 38), Math.floor(p * st.msg.length)) : st.msg.slice(0, Math.floor(p * st.msg.length));
      ctx.save(); rr(x + 24, iy, w - 130, 60, 30); ctx.clip();
      text(one + (Math.floor(t * 4) % 2 ? '|' : ''), x + 52, iy + 31, 28, C.navy, { align: 'left', weight: 500, maxW: w - 190 });
      ctx.restore();
    } else if (!st.send || t < st.send) text('ketik pesan…', x + 52, iy + 31, 26, C.grey, { align: 'left', weight: 500 });
    // sent bubble
    if (st.send && t >= st.send) {
      ctx.save(); ctx.font = `500 ${MSG}px ${FONT}`;
      const bw = Math.min(maxBW, Math.max(...lines.map(ws => ctx.measureText(ws.join(' ')).width)) + 48 + (lines.length === 1 ? 120 : 0));
      ctx.restore();
      const bh = lines.length * LH + 66;
      const bx = x + w - 28 - bw, by = y + 120;
      const sp = E.outBack(P(t, st.send, st.send + 0.3));
      ctx.save(); ctx.translate(bx + bw, by + bh); ctx.scale(sp, sp); ctx.translate(-(bx + bw), -(by + bh));
      ctx.translate(0, (1 - sp) * 80);
      shadowed(() => { rr(bx, by, bw, bh, 26); fill(C.blue); }, 14, 6, 0.15);
      ctx.beginPath(); ctx.moveTo(bx + bw - 26, by + bh - 4); ctx.lineTo(bx + bw + 12, by + bh + 4); ctx.lineTo(bx + bw - 6, by + bh - 26); ctx.closePath(); fill(C.blue);
      msgText(lines, bx + 24, by + 34, C.white);
      // time + ticks (double tick when delivered; amber once read)
      const read = st.read && t >= st.read;
      text('10.1' + letter.charCodeAt(0) % 10, bx + bw - 96, by + bh - 22, 20, 'rgba(255,255,255,0.75)', { weight: 600 });
      const tc = read ? C.amber : 'rgba(255,255,255,0.8)';
      line([[bx + bw - 60, by + bh - 22], [bx + bw - 52, by + bh - 14], [bx + bw - 38, by + bh - 30]], 4, tc);
      if (read) {
        const rp = E.outBack(P(t, st.read, st.read + 0.25));
        ctx.save(); ctx.translate(bx + bw - 36, by + bh - 22); ctx.scale(rp, rp); line([[-12, 0], [-4, 8], [10, -8]], 4, tc); ctx.restore();
      }
      // reaction chip on the bubble
      if (st.react && t >= st.react.t) {
        const rp = E.outBack(P(t, st.react.t, st.react.t + 0.3));
        ctx.save(); ctx.translate(bx + 30, by + bh + 4); ctx.scale(rp, rp);
        rr(-30, -24, 60, 48, 24); fill(C.white); rr(-30, -24, 60, 48, 24); stroke(C.line, 2);
        face(0, 0, 18, st.react.expr);
        ctx.restore();
        if (st.react.expr === 'frown' && st.react.note) text(st.react.note, bx + bw - 10, by + bh + 34, 22, C.grey, { align: 'right', weight: 600, alpha: P(t, st.react.t + 0.2, st.react.t + 0.5) });
      }
      ctx.restore();
      // lecturer reply
      if (st.reply && t >= st.reply.t - 0.5) {
        const ry = by + bh + 44;
        if (t < st.reply.t) { rr(x + 28, ry, 120, 56, 28); fill(C.white); for (let i = 0; i < 3; i++) { ell(x + 60 + i * 28, ry + 28 - 6 * Math.max(0, Math.sin(t * 10 - i)), 7, 7); fill(C.grey); } }
        else {
          const rp = E.outBack(P(t, st.reply.t, st.reply.t + 0.3));
          ctx.save(); ctx.font = `500 ${MSG}px ${FONT}`; const rw = ctx.measureText(st.reply.text).width + 56; ctx.restore();
          ctx.save(); ctx.translate(x + 28, ry + 32); ctx.scale(rp, rp); ctx.translate(-(x + 28), -(ry + 32));
          shadowed(() => { rr(x + 28, ry, rw, 66, 24); fill(C.white); }, 14, 6, 0.12);
          msgText([st.reply.text.split(' ')], x + 56, ry + 34, C.navy);
          ctx.restore();
        }
      }
    }
    ctx.restore();
    // verdict glow
    if (st.react && t >= st.react.t) {
      const a = E.outCubic(P(t, st.react.t, st.react.t + 0.3));
      rr(x - 4, y - 4, w + 8, h + 8, 40); stroke(st.react.expr === 'smile' ? `rgba(255,182,39,${a})` : `rgba(140,154,192,${0.6 * a})`, 8);
    }
    ctx.restore();
  }

  // =====================================================================
  const BOX_A = { x: 50, y: 440, w: 980, h: 420 };
  const BOX_B = { x: 50, y: 900, w: 980, h: 560 };

  function background(t) {
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, C.bg); g.addColorStop(1, C.bg2);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.globalAlpha = 0.5; ctx.fillStyle = '#C9D6F2';
    for (let y = 60; y < H; y += 60) for (let x = 30; x < W; x += 60) ctx.fillRect(x, y, 3, 3);
    ctx.restore();
  }

  function hook(t) {
    const out = E.inCubic(P(t, TL.HOOK.textOut, 4.0));
    ctx.save(); ctx.globalAlpha = 1 - out;
    const arrive = t < 0.08 ? 0.0 : TL.HOOK.arrive;   // bubbles land on frame 0
    panel(t, 'a', BOX_A, { msg: TL.HOOK.a, send: arrive - 0.12, read: TL.HOOK.ticks });
    panel(t, 'b', BOX_B, { msg: TL.HOOK.b, send: arrive - 0.12, read: TL.HOOK.ticks });
    ctx.restore();
    const s0 = (t < 0.1 ? 1.08 : 1) * (1 - out);
    if (s0 > 0) {
      text('chat a atau b', 540, 210, 104, C.navy, { weight: 800, scale: s0 });
      ctx.save(); ctx.translate(540, 345); ctx.scale(s0, s0);
      ctx.font = `800 80px ${FONT}`; const w = Math.min(980, ctx.measureText('yang bakal dibalas dosen?').width + 50);
      rr(-w / 2, -54, w, 108, 24); fill(C.amber);
      text('yang bakal dibalas dosen?', 0, 3, 80, C.navy, { weight: 800, maxW: 940 });
      ctx.restore();
    }
  }

  function round(t, r) {
    const inP = E.outCubic(P(t, r.s, r.s + 0.35)), outP = E.inCubic(P(t, r.out, r.s + 10));
    ctx.save(); ctx.globalAlpha = inP * (1 - outP); ctx.translate((1 - inP) * 120 - outP * 120, 0);
    panel(t, 'a', BOX_A, { msg: r.a, typing: r.typeA, send: r.sendA, read: r.readA, react: { t: r.reactA, expr: 'frown', note: 'dibaca, tidak dibalas' } });
    panel(t, 'b', BOX_B, { msg: r.b, typing: r.typeB, send: r.sendB, read: r.readB, react: { t: r.reactB, expr: 'smile' }, reply: { t: r.replyAt, text: r.reply } });
    ctx.restore();
    // round title / ask
    const ta = E.outBack(P(t, r.s, r.s + 0.35)) * (1 - outP);
    ctx.save(); ctx.translate(540, 170); ctx.scale(ta, ta);
    rr(-150, -34, 300, 68, 34); fill(C.blue); text(`ronde ${r.i + 1}/3`, 0, 1, 34, C.white, { weight: 800 });
    ctx.restore();
    const askP = E.outBack(P(t, r.ask, r.ask + 0.35));
    const titleA = (1 - P(t, r.ask - 0.2, r.ask)) * ta;
    if (titleA > 0) text(r.title, 540, 300, 92, C.navy, { weight: 800, alpha: titleA });
    if (askP > 0) {
      ctx.save(); ctx.translate(540, 300); ctx.scale(askP * (1 - outP), askP * (1 - outP));
      ctx.font = `800 80px ${FONT}`; const w = ctx.measureText('komen a atau b dulu.').width + 60;
      rr(-w / 2, -56, w, 112, 28); fill(C.amber); text('komen a atau b dulu.', 0, 3, 80, C.navy, { weight: 800 });
      ctx.restore();
    }
    // explanation below
    const wa = E.outCubic(P(t, r.whyAt, r.whyAt + 0.4)) * (1 - outP);
    if (wa > 0) {
      ctx.save(); ctx.globalAlpha = wa; ctx.translate(0, (1 - wa) * 20);
      shadowed(() => { rr(50, 1500, 980, 150, 30); fill(C.navy); }, 20, 8, 0.2);
      face(126, 1575, 40, 'smile');
      text(r.why[0], 190, 1545, 36, C.white, { align: 'left', weight: 700, maxW: 810 });
      text(r.why[1], 190, 1605, 36, C.amberHi, { align: 'left', weight: 700, maxW: 810 });
      ctx.restore();
    }
  }

  function ending(t) {
    const EN = TL.END;
    const items = [['1', 'sebut nama dan nim'], ['2', 'jelaskan tujuan'], ['3', 'beri opsi waktu']];
    const ha = E.outBack(P(t, EN.in, EN.in + 0.35));
    text('3 prinsip chat dosen', 540, 250, 84, C.navy, { weight: 800, scale: ha });
    items.forEach(([n, label], i) => {
      const a = E.outBack(P(t, EN.cards[i], EN.cards[i] + 0.35));
      if (a <= 0) return;
      const y = 520 + i * 260;
      ctx.save(); ctx.translate(540, y); ctx.scale(a, a); ctx.rotate((i - 1) * 0.015);
      shadowed(() => { rr(-450, -100, 900, 200, 36); fill(C.white); }, 30, 12, 0.18);
      ell(-330, 0, 64, 64); fill(C.blue); text(n, -330, 2, 64, C.white, { weight: 800 });
      text(label, -230, 2, 62, C.navy, { align: 'left', weight: 800, maxW: 640 });
      ctx.restore();
    });
    const sa = E.outBack(P(t, EN.save, EN.save + 0.4));
    if (sa > 0) {
      ctx.save(); ctx.translate(540, 1370); ctx.scale(sa, sa);
      ctx.font = `800 92px ${FONT}`; const w = ctx.measureText('simpan buat nanti.').width + 150;
      rr(-w / 2, -66, w, 132, 32); fill(C.amber);
      ctx.beginPath(); ctx.moveTo(-w / 2 + 40, -34); ctx.lineTo(-w / 2 + 80, -34); ctx.lineTo(-w / 2 + 80, 36); ctx.lineTo(-w / 2 + 60, 18); ctx.lineTo(-w / 2 + 40, 36); ctx.closePath(); fill(C.navy);
      text('simpan buat nanti.', 46, 4, 92, C.navy, { weight: 800 });
      ctx.restore();
    }
    face(540, 1640, 70, 'smile', E.outBack(P(t, EN.save + 0.2, EN.save + 0.6)));
  }

  // =====================================================================
  function render(t) {
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1;
    background(t);
    if (t < 4) hook(t);
    else if (t < TL.END.in) round(t, TL.rounds[Math.min(2, Math.floor((t - 4) / 10))]);
    else ending(t);
    // watermark
    ctx.save(); ctx.globalAlpha = 0.25; ctx.font = `700 30px ${FONT}`; ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = C.navy; ctx.fillText('@taskkora__', W - 44, H - 52); ctx.restore();
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

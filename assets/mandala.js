/* ============================================================
   コスモゾーン — 共有描画エンジン
   index.html(mixed) / butsu.html(fig) / bonji.html(seed) から
   同じロジックを読み込む。ブラウザ(<script>)からは window.Mandala、
   Node(OGP生成用)からは module.exports として使う。

   v1: 元の単一HTML版と完全に同じ結果を返す（過去の共有リンク互換）。
   v2: STYLESPEC の幾何モチーフ登録簿 + 配色テーマ + コスト予算を追加。
   ============================================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.Mandala = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
'use strict';

/* ---------- 尺度・周期 ---------- */
const K = 4;
const U_MIN = -50, U_MAX = 70;
const PERIOD = U_MAX - U_MIN; // 120
const wrapU = x => ((x - U_MIN) % PERIOD + PERIOD) % PERIOD + U_MIN;
const wrapI = i => ((i - U_MIN) % PERIOD + PERIOD) % PERIOD + U_MIN;

function hash32(x) {
  x |= 0;
  x = Math.imul(x ^ (x >>> 16), 2246822507);
  x = Math.imul(x ^ (x >>> 13), 3266489909);
  return (x ^ (x >>> 16)) >>> 0;
}
function mulberry32(a) {
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/* ---------- 音の区間（8層で1周期） ---------- */
function sectionOf(layer) {
  const ph = ((layer % 8) + 8) % 8;
  return ph < 2 ? 0 : (ph < 4 ? 1 : (ph < 6 ? 2 : 3));
}
const SECTION_TINT = [
  { s: 0.75, l: 0.90 },
  { s: 0.90, l: 0.97 },
  { s: 1.05, l: 1.03 },
  { s: 1.25, l: 1.10 }
];

/* ---------- 五智如来の種子（実在の梵字ではない抽象表現を含む） ---------- */
const PIGMENT = [
  { h: 222, s: 60 }, { h: 8, s: 72 }, { h: 162, s: 42 }, { h: 286, s: 38 }, { h: 38, s: 54 }
];
const SEEDS = [
  { ang: Math.PI / 2, ch: '\u{115AE}\u{115B3}\u{115BD}', yomi: 'ウーン', name: '阿閦如来', dir: '東・下' },
  { ang: Math.PI, ch: '\u{1159D}\u{115BF}\u{115A8}\u{115AF}\u{115BE}', yomi: 'タラーク', name: '宝生如来', dir: '南・左' },
  { ang: -Math.PI / 2, ch: '\u{115AE}\u{115BF}\u{115A8}\u{115B1}\u{115BE}', yomi: 'キリーク', name: '阿弥陀如来', dir: '西・上' },
  { ang: 0, ch: '\u{11580}\u{115BE}', yomi: 'アク', name: '不空成就如来', dir: '北・右' }
];
const CENTER_SEED = { ch: '\u{115AA}\u{115BD}', yomi: 'バン', name: '大日如来', dir: '中央' };
const GLYPHS = [CENTER_SEED].concat(SEEDS);
let bonjiReady = false;

/* ---------- 描画プリミティブ ---------- */
const P = (r, a) => [r * Math.cos(a), r * Math.sin(a)];
function ringPath(g, r0, r1) {
  g.beginPath();
  g.arc(0, 0, r1, 0, Math.PI * 2);
  g.arc(0, 0, r0, 0, Math.PI * 2, true);
}
function beadRing(g, r, rr, C, alpha) {
  const cnt = Math.max(16, Math.min(180, Math.round(2 * Math.PI * r / (rr * 3.1))));
  g.fillStyle = C.gold; g.globalAlpha = alpha;
  for (let k = 0; k < cnt; k++) {
    const a = k * 2 * Math.PI / cnt;
    g.beginPath(); g.arc(r * Math.cos(a), r * Math.sin(a), rr, 0, Math.PI * 2); g.fill();
  }
  g.globalAlpha = 1;
}
function drawFigure(g, s, C, idx) {
  const gold = C.gold, lw = C.lw, fine = s > 78;
  g.beginPath(); g.ellipse(0, -0.04 * s, 0.295 * s, 0.415 * s, 0, 0, Math.PI * 2);
  g.fillStyle = C.a2; g.globalAlpha = .48; g.fill(); g.globalAlpha = 1;
  g.lineWidth = lw * 1.1; g.strokeStyle = gold; g.stroke();
  if (fine) {
    g.save(); g.translate(0, -0.04 * s);
    g.globalAlpha = .26; g.strokeStyle = gold; g.lineWidth = lw * .5;
    for (let k = 0; k < 24; k++) {
      g.save(); g.rotate(k * Math.PI * 2 / 24);
      g.beginPath(); g.moveTo(0, -0.24 * s); g.lineTo(0, -0.39 * s); g.stroke();
      g.restore();
    }
    g.globalAlpha = 1; g.restore();
  }
  g.beginPath(); g.arc(0, -0.20 * s, 0.152 * s, 0, Math.PI * 2);
  g.fillStyle = C.a3; g.globalAlpha = .5; g.fill(); g.globalAlpha = 1;
  g.lineWidth = lw * .9; g.strokeStyle = gold; g.stroke();
  for (let k = -2; k <= 2; k++) {
    g.save(); g.translate(k * 0.105 * s, 0.30 * s);
    g.beginPath();
    g.moveTo(0, 0.15 * s);
    g.quadraticCurveTo(-0.105 * s, 0.04 * s, 0, -0.055 * s);
    g.quadraticCurveTo(0.105 * s, 0.04 * s, 0, 0.15 * s);
    g.closePath();
    g.fillStyle = (k % 2) ? C.a1 : C.paper;
    g.globalAlpha = .72; g.fill(); g.globalAlpha = 1;
    g.lineWidth = lw * .8; g.strokeStyle = gold; g.stroke();
    g.restore();
  }
  g.beginPath();
  g.moveTo(-0.075 * s, -0.115 * s);
  g.quadraticCurveTo(-0.205 * s, 0.06 * s, -0.185 * s, 0.295 * s);
  g.lineTo(0.185 * s, 0.295 * s);
  g.quadraticCurveTo(0.205 * s, 0.06 * s, 0.075 * s, -0.115 * s);
  g.closePath();
  g.fillStyle = C.a1; g.globalAlpha = .93; g.fill(); g.globalAlpha = 1;
  g.lineWidth = lw; g.strokeStyle = gold; g.stroke();
  if (fine) {
    g.beginPath();
    g.moveTo(-0.072 * s, -0.10 * s);
    g.quadraticCurveTo(0.02 * s, 0.09 * s, 0.165 * s, 0.115 * s);
    g.lineWidth = lw * .9; g.globalAlpha = .62; g.strokeStyle = C.paper; g.stroke();
    g.globalAlpha = 1;
  }
  g.beginPath(); g.ellipse(0, 0.165 * s, 0.092 * s, 0.044 * s, 0, 0, Math.PI * 2);
  g.fillStyle = gold; g.fill();
  g.lineWidth = lw * .7; g.strokeStyle = C.ink; g.stroke();
  g.beginPath(); g.ellipse(0, -0.20 * s, 0.070 * s, 0.086 * s, 0, 0, Math.PI * 2);
  g.fillStyle = gold; g.fill();
  g.lineWidth = lw * .7; g.strokeStyle = C.ink; g.stroke();
  g.beginPath(); g.arc(0, -0.264 * s, 0.040 * s, Math.PI, 0); g.closePath();
  g.fillStyle = gold; g.fill(); g.stroke();
  if (fine) {
    g.fillStyle = C.ink; g.globalAlpha = .5;
    for (let k = 0; k < 9; k++) {
      const th = Math.PI + k * Math.PI / 8;
      g.beginPath();
      g.arc(Math.cos(th) * 0.066 * s, -0.20 * s + Math.sin(th) * 0.080 * s, 0.011 * s, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
    g.strokeStyle = C.ink; g.lineWidth = lw * .6; g.globalAlpha = .8;
    for (const sx of [-1, 1]) {
      g.beginPath(); g.arc(sx * 0.027 * s, -0.188 * s, 0.017 * s, Math.PI * .15, Math.PI * .85); g.stroke();
    }
    g.globalAlpha = 1;
  }
  g.beginPath(); g.arc(0, -0.208 * s, 0.011 * s, 0, Math.PI * 2);
  g.fillStyle = C.paper; g.fill();
}
function drawSeed(g, s, C, idx) {
  g.save();
  g.rotate((((idx * 37) % 7) - 3) * 0.012);
  g.strokeStyle = C.gold; g.lineCap = 'round'; g.lineJoin = 'round';
  g.lineWidth = s * 0.075;
  g.beginPath();
  g.moveTo(-s * 0.24, -s * 0.26);
  g.quadraticCurveTo(-s * 0.32, s * 0.06, -s * 0.10, s * 0.18);
  g.quadraticCurveTo(s * 0.14, s * 0.30, s * 0.26, s * 0.02);
  g.stroke();
  g.beginPath(); g.moveTo(-s * 0.02, -s * 0.34); g.lineTo(-s * 0.02, s * 0.12); g.stroke();
  g.beginPath(); g.moveTo(-s * 0.26, -s * 0.09); g.lineTo(s * 0.24, -s * 0.09); g.stroke();
  g.beginPath(); g.arc(s * 0.18, -s * 0.30, s * 0.055, 0, Math.PI * 2);
  g.fillStyle = C.gold; g.fill();
  g.restore();
}
function moonDisc(g, r, C, strong) {
  g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2);
  g.fillStyle = C.paper; g.globalAlpha = strong ? .16 : .12; g.fill(); g.globalAlpha = 1;
  g.lineWidth = C.lw * (strong ? 1.8 : 1.4); g.strokeStyle = C.gold; g.stroke();
  g.beginPath(); g.arc(0, 0, r * 0.93, 0, Math.PI * 2);
  g.lineWidth = C.lw * .5; g.globalAlpha = .45; g.stroke(); g.globalAlpha = 1;
  if (C.dense) beadRing(g, r * 1.10, C.lw * (strong ? 1.25 : 1.05), C, strong ? .65 : .5);
}
function drawBonji(g, ch, box, C) {
  g.save();
  g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  g.font = box + 'px "Noto Sans Siddham", serif';
  let m = g.measureText(ch);
  const w = Math.max(1, m.width);
  const h = Math.max(1, (m.actualBoundingBoxAscent || box * .8) + (m.actualBoundingBoxDescent || box * .2));
  const px = box * Math.min(box / w, box / h) * 0.95;
  g.font = px + 'px "Noto Sans Siddham", serif';
  m = g.measureText(ch);
  const a = m.actualBoundingBoxAscent || px * .8;
  const d = m.actualBoundingBoxDescent || px * .2;
  g.fillStyle = C.gold;
  g.shadowColor = C.gold; g.shadowBlur = C.lw * 7;
  g.fillText(ch, 0, (a - d) / 2);
  g.shadowBlur = 0;
  g.restore();
}

/* ---------- 輪帯モチーフ（既存＋新規、すべて (g,r0,r1,rnd,C) 形式） ---------- */
function bandInnerLotus(g, r0, r1, rnd, C) {
  const n = Math.max(12, C.n * 2), half = (Math.PI / n) * 0.92, mid = (r0 + r1) / 2;
  for (let j = 0; j < n; j++) {
    g.save(); g.rotate(j * 2 * Math.PI / n);
    const c1 = P(mid, half), c2 = P(mid, -half);
    g.beginPath();
    g.moveTo(r0, 0);
    g.quadraticCurveTo(c1[0], c1[1], r1, 0);
    g.quadraticCurveTo(c2[0], c2[1], r0, 0);
    g.closePath();
    g.fillStyle = (j % 2) ? C.paper : C.a3;
    g.globalAlpha = (j % 2) ? .5 : .62; g.fill(); g.globalAlpha = 1;
    g.lineWidth = C.lw; g.strokeStyle = C.gold; g.stroke();
    if (C.dense) {
      const m2 = mid * .94, h2 = half * .52;
      const d1 = P(m2, h2), d2 = P(m2, -h2);
      g.beginPath();
      g.moveTo(r0 + (r1 - r0) * .12, 0);
      g.quadraticCurveTo(d1[0], d1[1], r1 - (r1 - r0) * .10, 0);
      g.quadraticCurveTo(d2[0], d2[1], r0 + (r1 - r0) * .12, 0);
      g.closePath();
      g.lineWidth = C.lw * .6; g.globalAlpha = .5; g.stroke(); g.globalAlpha = 1;
      g.beginPath();
      g.moveTo(r0 + (r1 - r0) * .22, 0); g.lineTo(r1 - (r1 - r0) * .2, 0);
      g.lineWidth = C.lw * .55; g.globalAlpha = .42; g.stroke(); g.globalAlpha = 1;
      g.beginPath(); g.arc(r1 - (r1 - r0) * .13, 0, C.lw * 1.3, 0, Math.PI * 2);
      g.fillStyle = C.gold; g.globalAlpha = .7; g.fill(); g.globalAlpha = 1;
    }
    g.restore();
  }
}
function bandPalace(g, r0, r1, rnd, C) {
  const half = r1 * 0.702, gate = half * 0.24;
  g.save(); ringPath(g, r0 * 0.9, r1); g.clip();
  for (const k of [1, .86, .73]) {
    g.beginPath(); g.rect(-half * k, -half * k, half * k * 2, half * k * 2);
    g.lineWidth = C.lw * (k === 1 ? 2.4 : 1);
    g.strokeStyle = k === 1 ? C.gold : C.paper;
    g.globalAlpha = k === 1 ? .95 : .34;
    g.stroke();
  }
  g.globalAlpha = 1;
  if (C.dense) {
    g.strokeStyle = C.gold; g.lineWidth = C.lw * .65; g.globalAlpha = .42;
    for (let s = 0; s < 4; s++) {
      g.save(); g.rotate(s * Math.PI / 2);
      for (let k = -6; k <= 6; k++) {
        const x = k * half * .145;
        g.beginPath(); g.moveTo(x, -half); g.lineTo(x, -half * .865); g.stroke();
      }
      g.restore();
    }
    g.globalAlpha = 1;
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
      g.beginPath(); g.arc(sx * half * .93, sy * half * .93, half * .055, 0, Math.PI * 2);
      g.fillStyle = C.gold; g.globalAlpha = .78; g.fill(); g.globalAlpha = 1;
      g.lineWidth = C.lw * .7; g.strokeStyle = C.paper;
      g.globalAlpha = .4; g.stroke(); g.globalAlpha = 1;
    }
  }
  for (let s = 0; s < 4; s++) {
    g.save(); g.rotate(s * Math.PI / 2);
    g.beginPath();
    g.moveTo(-gate, -half);
    g.lineTo(-gate, -half - gate * .55);
    g.lineTo(-gate * 1.75, -half - gate * .55);
    g.lineTo(-gate * 1.75, -half - gate * 1.2);
    g.lineTo(gate * 1.75, -half - gate * 1.2);
    g.lineTo(gate * 1.75, -half - gate * .55);
    g.lineTo(gate, -half - gate * .55);
    g.lineTo(gate, -half);
    g.closePath();
    g.fillStyle = C.a1; g.globalAlpha = .88; g.fill(); g.globalAlpha = 1;
    g.lineWidth = C.lw * 1.3; g.strokeStyle = C.gold; g.stroke();
    g.beginPath(); g.moveTo(0, -half - gate * 1.2); g.lineTo(0, -half - gate * 1.85);
    g.lineWidth = C.lw * 1.6; g.stroke();
    g.beginPath(); g.arc(0, -half - gate * 1.95, gate * 0.2, 0, Math.PI * 2);
    g.fillStyle = C.gold; g.fill();
    g.restore();
  }
  g.restore();
}
function bandFlame(g, r0, r1, rnd, C) {
  const n = C.n * 3, a = Math.PI / n;
  if (C.dense) {
    const m = C.n * 4, am = Math.PI / m, rm = r0 + (r1 - r0) * .44;
    for (let j = 0; j < m; j++) {
      g.save(); g.rotate(j * 2 * Math.PI / m + am);
      const q1 = P(r0, am * .9), q2 = P(r0, -am * .9);
      g.beginPath();
      g.moveTo(q1[0], q1[1]);
      g.quadraticCurveTo(rm * .84, r0 * am * 1.3, rm, 0);
      g.quadraticCurveTo(rm * .84, -r0 * am * .3, q2[0], q2[1]);
      g.closePath();
      g.fillStyle = C.a3; g.globalAlpha = .4; g.fill(); g.globalAlpha = 1;
      g.lineWidth = C.lw * .6; g.strokeStyle = C.gold; g.stroke();
      g.restore();
    }
  }
  for (let j = 0; j < n; j++) {
    g.save(); g.rotate(j * 2 * Math.PI / n);
    const tip = r0 + (r1 - r0) * (j % 2 ? .62 : 1.0);
    const b1 = P(r0, a * .9), b2 = P(r0, -a * .9);
    g.beginPath();
    g.moveTo(b1[0], b1[1]);
    g.quadraticCurveTo(tip * .80, r0 * a * 1.5, tip, 0);
    g.quadraticCurveTo(tip * .80, -r0 * a * .4, b2[0], b2[1]);
    g.closePath();
    g.fillStyle = (j % 2) ? C.a1 : C.gold;
    g.globalAlpha = (j % 2) ? .7 : .42; g.fill(); g.globalAlpha = 1;
    g.lineWidth = C.lw * .8; g.strokeStyle = C.gold; g.stroke();
    g.restore();
  }
}
function bandCloud(g, r0, r1, rnd, C) {
  const n = C.n * 2, mid = (r0 + r1) / 2, h = (r1 - r0) * .42;
  g.save(); ringPath(g, r0, r1); g.clip();
  for (let j = 0; j < n; j++) {
    g.save(); g.rotate(j * 2 * Math.PI / n); g.translate(mid, 0); g.rotate(Math.PI / 2);
    g.beginPath();
    g.moveTo(-h * 1.5, h * .5);
    for (let k = 0; k < 4; k++) {
      g.arc(-h * 1.5 + k * h * .9 + h * .45, h * .5 - h * .35, h * .5, Math.PI * .9, Math.PI * 2.1);
    }
    g.lineTo(h * 1.5, h * .5); g.closePath();
    g.fillStyle = C.a3; g.globalAlpha = .42; g.fill(); g.globalAlpha = 1;
    g.lineWidth = C.lw * .9; g.strokeStyle = C.gold; g.stroke();
    g.restore();
  }
  g.restore();
}
function bandVajra(g, r0, r1, rnd, C) {
  const n = C.n * 2, w = Math.max(C.lw * 2, (r0 * 2 * Math.PI / n) * .20);
  for (let j = 0; j < n; j++) {
    g.save(); g.rotate(j * 2 * Math.PI / n + Math.PI / n);
    const ra = r0 + (r1 - r0) * .14, rb = r1 - (r1 - r0) * .14;
    g.beginPath();
    g.moveTo(ra, -w); g.lineTo(rb, -w * .5); g.lineTo(rb, w * .5); g.lineTo(ra, w);
    g.closePath();
    g.fillStyle = C.a2; g.globalAlpha = .82; g.fill(); g.globalAlpha = 1;
    g.lineWidth = C.lw; g.strokeStyle = C.gold; g.stroke();
    for (const rr of [ra, rb]) {
      g.beginPath(); g.arc(rr, 0, w * .95, 0, Math.PI * 2);
      g.fillStyle = C.gold; g.globalAlpha = .85; g.fill(); g.globalAlpha = 1;
      for (let k = -1; k <= 1; k++) {
        g.save(); g.translate(rr, 0); g.rotate(k * 0.5);
        g.beginPath(); g.moveTo(0, 0); g.lineTo((rr === ra ? -1 : 1) * w * 2.1, 0);
        g.lineWidth = C.lw * .9; g.strokeStyle = C.gold; g.stroke();
        g.restore();
      }
    }
    g.restore();
  }
}
function bandJewel(g, r0, r1, rnd, C) {
  const n = C.n * 2, mid = (r0 + r1) * .5, s = (r1 - r0) * .30;
  for (let j = 0; j < n; j++) {
    g.save(); g.rotate(j * 2 * Math.PI / n); g.translate(mid, 0); g.rotate(Math.PI / 2);
    g.beginPath();
    g.moveTo(0, -s * 1.15);
    g.quadraticCurveTo(s * .85, s * .15, 0, s * .85);
    g.quadraticCurveTo(-s * .85, s * .15, 0, -s * 1.15);
    g.closePath();
    g.fillStyle = C.a1; g.globalAlpha = .85; g.fill(); g.globalAlpha = 1;
    g.lineWidth = C.lw; g.strokeStyle = C.gold; g.stroke();
    g.globalAlpha = .55; g.lineWidth = C.lw * .7;
    for (let k = 0; k < 3; k++) {
      g.save(); g.rotate((k - 1) * 0.7);
      g.beginPath(); g.moveTo(0, -s * 1.2); g.lineTo(0, -s * 1.85); g.stroke();
      g.restore();
    }
    g.globalAlpha = 1; g.restore();
  }
}
/* 尊格の輪（mode: 'fig'=坐像 / 'seed'=抽象書字 / 'real'=実在の種子字） */
function bandDeities(g, r0, r1, rnd, C, mode) {
  const n = C.n, mid = (r0 + r1) / 2;
  const disc = Math.min((r1 - r0) * 0.47, mid * Math.PI / n * 0.90);
  for (let j = 0; j < n; j++) {
    const a = j * 2 * Math.PI / n;
    g.save();
    g.translate(mid * Math.cos(a), mid * Math.sin(a));
    g.rotate(a + Math.PI / 2);
    g.beginPath(); g.arc(0, 0, disc, 0, Math.PI * 2);
    g.fillStyle = C.paper; g.globalAlpha = .12; g.fill(); g.globalAlpha = 1;
    g.lineWidth = C.lw * 1.4; g.strokeStyle = C.gold; g.stroke();
    g.beginPath(); g.arc(0, 0, disc * 0.93, 0, Math.PI * 2);
    g.lineWidth = C.lw * .5; g.globalAlpha = .45; g.stroke(); g.globalAlpha = 1;
    if (C.dense) beadRing(g, disc * 1.09, C.lw * 1.1, C, .55);
    if (mode === 'fig') {
      drawFigure(g, disc * 1.72, C, j);
    } else if (mode === 'real') {
      const gl = GLYPHS[j % GLYPHS.length];
      if (bonjiReady) drawBonji(g, gl.ch, disc * 1.26, C);
      else drawSeed(g, disc * 1.45, C, j);
    } else {
      drawSeed(g, disc * 1.45, C, j);
    }
    g.restore();
  }
}
/* 四方に四仏の種子、四隅に坐像。中央（大日）の座は次の曼荼羅そのもの。構造は固定。 */
function bandFiveWisdom(g, r0, r1, C) {
  const mid = (r0 + r1) / 2;
  const disc = Math.min((r1 - r0) * 0.47, mid * Math.PI / 8 * 0.92);
  for (const S of SEEDS) {
    g.save();
    g.translate(mid * Math.cos(S.ang), mid * Math.sin(S.ang));
    moonDisc(g, disc, C, true);
    if (bonjiReady) drawBonji(g, S.ch, disc * 1.26, C);
    else { g.rotate(S.ang + Math.PI / 2); drawSeed(g, disc * 1.45, C, 0); }
    g.restore();
  }
  for (let k = 0; k < 4; k++) {
    const a = Math.PI / 4 + k * Math.PI / 2, d2 = disc * 0.80;
    g.save();
    g.translate(mid * Math.cos(a), mid * Math.sin(a));
    g.rotate(a + Math.PI / 2);
    moonDisc(g, d2, C, false);
    drawFigure(g, d2 * 1.72, C, k);
    g.restore();
  }
}

/* ---------- 新規：幾何モチーフ ---------- */
function bandStar(g, r0, r1, rnd, C) {
  const n = C.n;
  const kOpt = Math.max(2, Math.floor(n / 2) - 1);
  const k = 2 + Math.floor(rnd() * (kOpt - 1));
  const outer = [], inner = [];
  for (let j = 0; j < n; j++) {
    outer.push(P(r1, j * 2 * Math.PI / n));
    inner.push(P(r0, j * 2 * Math.PI / n + Math.PI / n));
  }
  g.beginPath();
  for (let j = 0; j < n; j++) {
    if (j === 0) g.moveTo(outer[j][0], outer[j][1]); else g.lineTo(outer[j][0], outer[j][1]);
    g.lineTo(inner[j][0], inner[j][1]);
  }
  g.closePath();
  g.fillStyle = C.a2; g.globalAlpha = .5; g.fill('evenodd'); g.globalAlpha = 1;
  g.lineWidth = C.lw * 1.1; g.strokeStyle = C.gold; g.stroke();
  g.globalAlpha = .38; g.lineWidth = C.lw * .55; g.strokeStyle = C.gold;
  g.beginPath();
  for (let j = 0; j < n; j++) {
    const a = outer[j], b = outer[(j + k) % n];
    g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]);
  }
  g.stroke(); g.globalAlpha = 1;
}
function bandSeigaiha(g, r0, r1, rnd, C) {
  const n = Math.max(8, C.n);
  g.save(); ringPath(g, r0, r1); g.clip();
  const rowH = (r1 - r0) / 3;
  const rad = rowH * 0.62;
  for (let row = 0; row < 3; row++) {
    const rr = r0 + rowH * (row + 0.5);
    const offset = (row % 2) ? Math.PI / n : 0;
    for (let j = 0; j < n; j++) {
      const a = j * 2 * Math.PI / n + offset;
      g.save(); g.translate(rr * Math.cos(a), rr * Math.sin(a)); g.rotate(a);
      for (const mult of [1, .68, .38]) {
        g.beginPath(); g.arc(0, 0, rad * mult, -Math.PI / 2, Math.PI / 2);
        g.lineWidth = C.lw * .55; g.strokeStyle = C.gold; g.globalAlpha = .5; g.stroke();
      }
      g.restore();
    }
  }
  g.globalAlpha = 1;
  g.restore();
}
function bandSayagata(g, r0, r1, rnd, C) {
  const thick = (r1 - r0) * 0.32;
  const rr0 = r1 - thick, rr1 = r1;
  const n = C.n * 2, step = 2 * Math.PI / n;
  g.save(); ringPath(g, rr0, rr1); g.clip();
  g.strokeStyle = C.gold; g.lineWidth = C.lw * 1.05; g.globalAlpha = .6;
  const unit = [
    [rr0, 0.06], [rr0, 0.40], [(rr0 + rr1) / 2, 0.40], [(rr0 + rr1) / 2, 0.14],
    [rr1 * .88, 0.14], [rr1 * .88, 0.86], [(rr0 + rr1) / 2, 0.86], [(rr0 + rr1) / 2, 0.60],
    [rr0, 0.60], [rr0, 0.94]
  ];
  for (let j = 0; j < n; j++) {
    const a0 = j * step;
    g.beginPath();
    unit.forEach(([r, f], idx) => {
      const pt = P(r, a0 + f * step);
      if (idx === 0) g.moveTo(pt[0], pt[1]); else g.lineTo(pt[0], pt[1]);
    });
    g.stroke();
  }
  g.globalAlpha = 1;
  g.restore();
}
function bandTruchet(g, r0, r1, rnd, C) {
  g.save(); ringPath(g, r0, r1); g.clip();
  const n = Math.max(10, C.n * 2), rows = 3;
  const step = 2 * Math.PI / n;
  const rAt = k => r0 + (r1 - r0) * k / rows;
  g.strokeStyle = C.gold; g.lineWidth = C.lw * .75; g.globalAlpha = .55;
  for (let row = 0; row < rows; row++) {
    const ra = rAt(row), rb = rAt(row + 1), rm = (ra + rb) / 2;
    for (let j = 0; j < n; j++) {
      const a0 = j * step, a1 = a0 + step, am = a0 + step / 2;
      const center = P(rm, am);
      const flip = rnd() < .5;
      const e1 = flip ? P(rm, a0) : P(rm, a0);
      const e2 = flip ? P(ra, am) : P(rb, am);
      const e3 = flip ? P(rb, am) : P(ra, am);
      const e4 = P(rm, a1);
      g.beginPath();
      g.moveTo(e1[0], e1[1]); g.quadraticCurveTo(center[0], center[1], e2[0], e2[1]);
      g.stroke();
      g.beginPath();
      g.moveTo(e3[0], e3[1]); g.quadraticCurveTo(center[0], center[1], e4[0], e4[1]);
      g.stroke();
    }
  }
  g.globalAlpha = 1;
  g.restore();
}
function bandBraid(g, r0, r1, rnd, C) {
  const n = Math.max(6, Math.round(C.n / 2)), mid = (r0 + r1) / 2, amp = (r1 - r0) * 0.26;
  const seg = 96;
  const pathPts = sign => {
    const pts = [];
    for (let s = 0; s <= seg; s++) {
      const a = s / seg * 2 * Math.PI;
      const r = mid + sign * amp * Math.sin(n * a);
      pts.push(P(r, a));
    }
    return pts;
  };
  const strokePts = (pts, widthMul, color, alpha) => {
    g.beginPath();
    pts.forEach((pt, idx) => idx === 0 ? g.moveTo(pt[0], pt[1]) : g.lineTo(pt[0], pt[1]));
    g.lineWidth = C.lw * widthMul; g.strokeStyle = color; g.globalAlpha = alpha;
    g.lineCap = 'round'; g.lineJoin = 'round'; g.stroke(); g.globalAlpha = 1;
  };
  g.save(); ringPath(g, r0, r1); g.clip();
  const ptsA = pathPts(1), ptsB = pathPts(-1);
  strokePts(ptsA, 3.0, C.a1, .32); strokePts(ptsA, 1.25, C.gold, .92);
  if (C.dense) {
    const segCount = n * 2;
    for (let pass = 0; pass < 2; pass++) {
      for (let s = 0; s < segCount; s++) {
        if ((s % 2) !== pass) continue;
        const i0 = Math.floor(s / segCount * seg), i1 = Math.floor((s + 1) / segCount * seg);
        const sub = ptsB.slice(Math.max(0, i0 - 1), i1 + 2);
        if (sub.length < 2) continue;
        strokePts(sub, 3.0, C.a2, .32); strokePts(sub, 1.25, C.gold, .92);
      }
    }
  } else {
    strokePts(ptsB, 3.0, C.a2, .32); strokePts(ptsB, 1.25, C.gold, .92);
  }
  g.restore();
}
function sierpTri(g, p0, p1, p2, depth) {
  if (depth <= 0) {
    g.beginPath(); g.moveTo(p0[0], p0[1]); g.lineTo(p1[0], p1[1]); g.lineTo(p2[0], p2[1]); g.closePath(); g.stroke();
    return;
  }
  const m01 = [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2];
  const m12 = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2];
  const m20 = [(p2[0] + p0[0]) / 2, (p2[1] + p0[1]) / 2];
  sierpTri(g, p0, m01, m20, depth - 1);
  sierpTri(g, m01, p1, m12, depth - 1);
  sierpTri(g, m20, m12, p2, depth - 1);
}
function bandSierpin(g, r0, r1, rnd, C) {
  const n = C.n, depth = C.dense ? (rnd() < .5 ? 3 : 4) : 2;
  g.strokeStyle = C.gold; g.lineWidth = C.lw * .6; g.globalAlpha = .55;
  for (let j = 0; j < n; j++) {
    const a0 = j * 2 * Math.PI / n, a1 = a0 + 2 * Math.PI / n;
    const p0 = P(r0, (a0 + a1) / 2), p1 = P(r1, a0), p2 = P(r1, a1);
    sierpTri(g, p0, p1, p2, depth);
  }
  g.globalAlpha = 1;
}
function groundFlower(g, RIN, R, C) {
  g.save(); ringPath(g, RIN, R); g.clip();
  const rho = RIN * 0.55;
  g.strokeStyle = C.gold; g.lineWidth = Math.max(.4, RIN * 0.004);
  g.globalAlpha = .07;
  const rowGap = rho * Math.sqrt(3) / 2;
  const rows = Math.ceil(R / rowGap) + 2, cols = Math.ceil(R / rho) + 2;
  for (let ry = -rows; ry <= rows; ry++) {
    const y = ry * rowGap;
    const xOff = (ry % 2) ? rho / 2 : 0;
    for (let rx = -cols; rx <= cols; rx++) {
      const x = rx * rho + xOff;
      if (Math.hypot(x, y) > R + rho) continue;
      g.beginPath(); g.arc(x, y, rho, 0, Math.PI * 2); g.stroke();
    }
  }
  g.globalAlpha = 1;
  g.restore();
}

/* ---------- モチーフ登録簿（STYLESPEC 2-1） ---------- */
const MOTIFS = {
  lotus: { fn: bandInnerLotus, kind: 'org', cost: 2, clip: false },
  palace: { fn: bandPalace, kind: 'geo', cost: 2, clip: true },
  flame: { fn: bandFlame, kind: 'org', cost: 2, clip: false },
  cloud: { fn: bandCloud, kind: 'org', cost: 2, clip: true },
  vajra: { fn: bandVajra, kind: 'geo', cost: 1, clip: false },
  jewel: { fn: bandJewel, kind: 'org', cost: 2, clip: false },
  star: { fn: bandStar, kind: 'geo', cost: 1, clip: false, nOK: [8, 10, 12, 16, 20, 24] },
  seigaiha: { fn: bandSeigaiha, kind: 'geo', cost: 1, clip: true },
  sayagata: { fn: bandSayagata, kind: 'geo', cost: 2, clip: true },
  truchet: { fn: bandTruchet, kind: 'geo', cost: 2, clip: true },
  braid: { fn: bandBraid, kind: 'geo', cost: 3, clip: true },
  sierpin: { fn: bandSierpin, kind: 'geo', cost: 2, clip: false }
};

/* ---------- 配色テーマ（STYLESPEC 3-1） ---------- */
const STYLES = {
  kondei: {
    label: '金泥', ground: { dark: true, l: [6, 12], s: [30, 62] },
    metal: '#d9b25a', paper: '#efe6d2', hues: [222, 8, 162, 286, 38], hueMode: 'cycle',
    pool: ['lotus', 'flame', 'cloud', 'vajra', 'jewel', 'star', 'seigaiha', 'palace'], density: 1.0
  },
  hakubyo: {
    label: '白描', ground: { dark: false, l: [88, 94], s: [6, 14] },
    metal: '#2a2622', paper: '#1a1714', hues: [30], hueMode: 'mono',
    pool: ['star', 'sayagata', 'truchet', 'sierpin', 'seigaiha', 'lotus'], density: 1.15
  },
  gindei: {
    label: '銀泥', ground: { dark: true, l: [4, 9], s: [15, 35] },
    metal: '#c9d4dc', paper: '#e8eef2', hues: [210, 195, 230, 255, 200], hueMode: 'cycle',
    pool: ['lotus', 'flame', 'cloud', 'star', 'seigaiha', 'sierpin'], density: 1.0
  },
  gokusai: {
    label: '極彩色', ground: { dark: true, l: [10, 16], s: [55, 78] },
    metal: '#e8b93a', paper: '#fff3d6', hues: [8, 222, 162, 340, 45], hueMode: 'cycle',
    pool: ['lotus', 'palace', 'vajra', 'jewel', 'flame', 'star', 'truchet'], density: 1.2
  },
  duotone: {
    label: 'デュオトーン', ground: { dark: true, l: [8, 14], s: [40, 60] },
    metal: '#f2f2f2', paper: '#0c0c0c', hues: [350, 200], hueMode: 'pair',
    pool: ['star', 'seigaiha', 'sayagata', 'sierpin', 'truchet'], density: 0.9
  },
  yakou: {
    label: '夜光', ground: { dark: true, l: [3, 7], s: [20, 40] },
    metal: '#39ff9e', paper: '#0a0a12', hues: [150, 300, 190, 55], hueMode: 'spectrum',
    pool: ['flame', 'cloud', 'star', 'truchet', 'braid', 'sierpin'], density: 1.1
  }
};
const STYLE_KEYS = Object.keys(STYLES);

function themeKeyFor(i, seed, forced) {
  if (forced && STYLES[forced]) return forced;
  const idx8 = Math.floor(wrapI(i) / 8);
  return STYLE_KEYS[hash32((idx8 * 97) ^ seed) % STYLE_KEYS.length];
}
function pigmentAt(i, seed, theme) {
  const hues = theme.hues, ns = hues.length;
  const satBase = clamp((theme.ground.s[0] + theme.ground.s[1]) / 2 + 12, 0, 100);
  if (theme.hueMode === 'spectrum') {
    const frac = (wrapI(i) - U_MIN) / PERIOD;
    const h0 = Math.round((frac * 360 + seed % 360) + 360) % 360;
    return { h0, h1: (h0 + 140) % 360, h2: (h0 + 250) % 360, h3: (h0 + 70) % 360, s: satBase };
  }
  if (theme.hueMode === 'mono') {
    const h0 = hues[0];
    return { h0, h1: h0, h2: h0, h3: h0, s: satBase };
  }
  if (theme.hueMode === 'pair') {
    const base = (((Math.floor(wrapI(i)) + seed) % 2) + 2) % 2;
    const h0 = hues[base % ns], h1 = hues[(base + 1) % ns];
    return { h0, h1, h2: h0, h3: h1, s: satBase };
  }
  const pi0 = (((i + seed) % ns) + ns) % ns;
  return { h0: hues[pi0], h1: hues[(pi0 + 2) % ns], h2: hues[(pi0 + 3) % ns], h3: hues[(pi0 + 1) % ns], s: satBase };
}
function pickMotifKeys(pool, nSym, rnd, maxBudget) {
  const state = { remaining: maxBudget };
  const keys = [];
  for (let slot = 0; slot < 3; slot++) {
    const candidates = pool.filter(k => {
      const m = MOTIFS[k];
      if (!m) return false;
      if (m.cost > state.remaining) return false;
      if (m.nOK && m.nOK.indexOf(nSym) === -1) return false;
      return true;
    });
    let pick;
    if (candidates.length) {
      pick = candidates[Math.floor(rnd() * candidates.length)];
    } else {
      pick = pool.find(k => MOTIFS[k] && MOTIFS[k].cost === 1) || pool[0] || 'star';
    }
    keys.push(pick);
    state.remaining -= (MOTIFS[pick] ? MOTIFS[pick].cost : 1);
  }
  return keys;
}

/* ---------- v1: 元のアルゴリズムをそのまま（過去の共有リンク互換） ---------- */
function ringColorsV1(S, i, seed, rnd) {
  const lw = Math.max(1, S / 620);
  const np = PIGMENT.length;
  const pi0 = (((i + seed) % np) + np) % np;
  const G0 = PIGMENT[pi0];
  const p1 = PIGMENT[(pi0 + 2) % np], p2 = PIGMENT[(pi0 + 3) % np], p3 = PIGMENT[(pi0 + 1) % np];
  return {
    C: {
      n: [6, 8, 8, 12, 12, 16][Math.floor(rnd() * 6)],
      gold: '#d9b25a', paper: '#efe6d2', ink: 'rgba(26,15,5,.72)',
      a1: 'hsl(' + p1.h + ',' + p1.s + '%,44%)',
      a2: 'hsl(' + p2.h + ',' + p2.s + '%,32%)',
      a3: 'hsl(' + p3.h + ',' + p3.s + '%,52%)',
      lw, dense: S >= 1200
    },
    G0, lw
  };
}
function paintOctaveV1(makeCanvas, S, i, seed, mode) {
  const cvs = makeCanvas(S, S);
  const g = cvs.getContext('2d');
  const R = S / 2, RIN = R / K;
  const rnd = mulberry32(hash32((i * 2654435761) ^ seed));
  const { C, G0, lw } = ringColorsV1(S, i, seed, rnd);

  g.translate(R, R);
  g.lineJoin = 'round';

  const grd = g.createRadialGradient(0, 0, RIN, 0, 0, R);
  grd.addColorStop(0, 'hsla(' + G0.h + ',' + G0.s + '%,16%,0.92)');
  grd.addColorStop(.55, 'hsl(' + G0.h + ',' + G0.s + '%,10%)');
  grd.addColorStop(1, 'hsl(' + G0.h + ',' + G0.s + '%,5%)');
  ringPath(g, RIN, R); g.fillStyle = grd; g.fill();

  if (C.dense) {
    g.save(); ringPath(g, RIN, R); g.clip();
    g.strokeStyle = C.gold; g.lineWidth = lw * .5;
    for (let ring = 0; ring < 7; ring++) {
      const rr = RIN * Math.pow(4, (ring + .5) / 7);
      const cnt = 24 + (ring % 2) * 6, cr = rr * .215;
      g.globalAlpha = .05 + (ring % 2) * .028;
      for (let k = 0; k < cnt; k++) {
        const a = k * 2 * Math.PI / cnt + (ring % 2 ? Math.PI / cnt : 0);
        g.beginPath(); g.arc(rr * Math.cos(a), rr * Math.sin(a), cr, 0, Math.PI * 2); g.stroke();
      }
    }
    g.globalAlpha = 1; g.restore();
  }

  const e = [1, 1.42, 2.30, 3.10, 4].map(x => x * RIN);
  bandInnerLotus(g, e[0] * 1.02, e[1] * .98, rnd, C);
  if (mode === 'butsu') bandDeities(g, e[1] * 1.01, e[2] * .99, rnd, C, 'fig');
  else if (mode === 'bonji') bandDeities(g, e[1] * 1.01, e[2] * .99, rnd, C, 'real');
  else bandFiveWisdom(g, e[1] * 1.01, e[2] * .99, C);
  if (rnd() < .6) bandPalace(g, e[2] * 1.01, e[3] * .99, rnd, C);
  else bandVajra(g, e[2] * 1.01, e[3] * .99, rnd, C);
  const outer = [bandFlame, bandCloud, bandVajra, bandJewel][Math.floor(rnd() * 4)];
  outer(g, e[3] * 1.01, e[4] * .985, rnd, C);

  g.strokeStyle = C.gold;
  for (let b = 1; b < 4; b++) {
    g.globalAlpha = .55; g.lineWidth = lw * 1.1;
    g.beginPath(); g.arc(0, 0, e[b], 0, Math.PI * 2); g.stroke();
    g.globalAlpha = .28; g.lineWidth = lw * .5;
    g.beginPath(); g.arc(0, 0, e[b] * 1.014, 0, Math.PI * 2); g.stroke();
    g.globalAlpha = .22; g.lineWidth = lw * .4;
    g.beginPath(); g.arc(0, 0, e[b] * 1.030, 0, Math.PI * 2); g.stroke();
    if (C.dense) beadRing(g, e[b] * 1.022, lw * 1.15, C, .5);
  }
  g.globalAlpha = 1;

  g.lineWidth = lw * 3; g.strokeStyle = C.gold;
  g.shadowColor = C.gold; g.shadowBlur = lw * 12;
  g.beginPath(); g.arc(0, 0, RIN, 0, Math.PI * 2); g.stroke();
  g.shadowBlur = 0;
  g.lineWidth = lw * 2.4;
  g.beginPath(); g.arc(0, 0, R - lw * 1.2, 0, Math.PI * 2); g.stroke();
  g.globalAlpha = .5; g.lineWidth = lw * .9;
  g.beginPath(); g.arc(0, 0, RIN * 1.07, 0, Math.PI * 2); g.stroke();
  g.globalAlpha = 1;

  return cvs;
}

/* ---------- v2: モチーフ登録簿 + テーマ + コスト予算 + 音区間との同期 ---------- */
function paintOctaveV2(makeCanvas, S, i, seed, mode, forcedTheme) {
  const cvs = makeCanvas(S, S);
  const g = cvs.getContext('2d');
  const R = S / 2, RIN = R / K;
  const rnd = mulberry32(hash32((i * 2654435761) ^ seed));
  const lw = Math.max(1, S / 620);
  const dense = S >= 1200;
  const themeKey = themeKeyFor(i, seed, forcedTheme);
  const theme = STYLES[themeKey];
  const layer = Math.floor(wrapI(i));
  const tint = SECTION_TINT[sectionOf(layer)];
  const pig = pigmentAt(i, seed, theme);

  const nSym = [6, 8, 8, 12, 12, 16][Math.floor(rnd() * 6)];
  const C = {
    n: nSym,
    gold: theme.metal,
    paper: theme.paper,
    ink: theme.ground.dark ? 'rgba(18,13,8,.75)' : 'rgba(30,24,18,.82)',
    a1: 'hsl(' + pig.h1 + ',' + clamp(pig.s * tint.s, 0, 100) + '%,' + clamp(44 * tint.l, 4, 96) + '%)',
    a2: 'hsl(' + pig.h2 + ',' + clamp(pig.s * tint.s, 0, 100) + '%,' + clamp(32 * tint.l, 4, 96) + '%)',
    a3: 'hsl(' + pig.h3 + ',' + clamp(pig.s * tint.s, 0, 100) + '%,' + clamp(52 * tint.l, 4, 96) + '%)',
    lw, dense
  };

  g.translate(R, R);
  g.lineJoin = 'round';

  const gl = theme.ground.l[0] + rnd() * (theme.ground.l[1] - theme.ground.l[0]);
  const gs = clamp((theme.ground.s[0] + rnd() * (theme.ground.s[1] - theme.ground.s[0])) * tint.s, 0, 100);
  const near = clamp(theme.ground.dark ? gl + 6 : gl - 4, 0, 100);
  const far = clamp(theme.ground.dark ? gl - 4 : gl + 4, 0, 100);
  const grd = g.createRadialGradient(0, 0, RIN, 0, 0, R);
  grd.addColorStop(0, 'hsla(' + pig.h0 + ',' + gs + '%,' + near + '%,0.92)');
  grd.addColorStop(.55, 'hsl(' + pig.h0 + ',' + gs + '%,' + clamp(gl, 0, 100) + '%)');
  grd.addColorStop(1, 'hsl(' + pig.h0 + ',' + gs + '%,' + far + '%)');
  ringPath(g, RIN, R); g.fillStyle = grd; g.fill();

  if (dense) {
    if (rnd() < 0.5) {
      g.save(); ringPath(g, RIN, R); g.clip();
      g.strokeStyle = C.gold; g.lineWidth = lw * .5;
      for (let ring = 0; ring < 7; ring++) {
        const rr = RIN * Math.pow(4, (ring + .5) / 7);
        const cnt = 24 + (ring % 2) * 6, cr = rr * .215;
        g.globalAlpha = .05 + (ring % 2) * .028;
        for (let k = 0; k < cnt; k++) {
          const a = k * 2 * Math.PI / cnt + (ring % 2 ? Math.PI / cnt : 0);
          g.beginPath(); g.arc(rr * Math.cos(a), rr * Math.sin(a), cr, 0, Math.PI * 2); g.stroke();
        }
      }
      g.globalAlpha = 1; g.restore();
    } else {
      groundFlower(g, RIN, R, C);
    }
  }

  const e = [1, 1.42, 2.30, 3.10, 4].map(x => x * RIN);
  const budget = Math.round((dense ? 6 : 2) * theme.density);
  const [k0, k2, k3] = pickMotifKeys(theme.pool, nSym, rnd, budget);

  const paintRing = (key, r0, r1) => {
    const m = MOTIFS[key] || MOTIFS.star;
    g.save(); ringPath(g, r0, r1); g.clip(); m.fn(g, r0, r1, rnd, C); g.restore();
  };

  paintRing(k0, e[0] * 1.02, e[1] * .98);
  if (mode === 'butsu') bandDeities(g, e[1] * 1.01, e[2] * .99, rnd, C, 'fig');
  else if (mode === 'bonji') bandDeities(g, e[1] * 1.01, e[2] * .99, rnd, C, 'real');
  else bandFiveWisdom(g, e[1] * 1.01, e[2] * .99, C);
  paintRing(k2, e[2] * 1.01, e[3] * .99);
  paintRing(k3, e[3] * 1.01, e[4] * .985);

  g.strokeStyle = C.gold;
  for (let b = 1; b < 4; b++) {
    g.globalAlpha = .55 * tint.s; g.lineWidth = lw * 1.1;
    g.beginPath(); g.arc(0, 0, e[b], 0, Math.PI * 2); g.stroke();
    g.globalAlpha = .28 * tint.s; g.lineWidth = lw * .5;
    g.beginPath(); g.arc(0, 0, e[b] * 1.014, 0, Math.PI * 2); g.stroke();
    g.globalAlpha = .22 * tint.s; g.lineWidth = lw * .4;
    g.beginPath(); g.arc(0, 0, e[b] * 1.030, 0, Math.PI * 2); g.stroke();
    if (dense) beadRing(g, e[b] * 1.022, lw * 1.15, C, .5);
  }
  g.globalAlpha = 1;

  g.lineWidth = lw * 3; g.strokeStyle = C.gold;
  g.shadowColor = C.gold; g.shadowBlur = lw * 12;
  g.beginPath(); g.arc(0, 0, RIN, 0, Math.PI * 2); g.stroke();
  g.shadowBlur = 0;
  g.lineWidth = lw * 2.4;
  g.beginPath(); g.arc(0, 0, R - lw * 1.2, 0, Math.PI * 2); g.stroke();
  g.globalAlpha = .5; g.lineWidth = lw * .9;
  g.beginPath(); g.arc(0, 0, RIN * 1.07, 0, Math.PI * 2); g.stroke();
  g.globalAlpha = 1;

  return { canvas: cvs, theme: themeKey };
}

function paintOctave(makeCanvas, opts) {
  const { v, S, i, seed, mode, theme } = opts;
  if (v === 2) return paintOctaveV2(makeCanvas, S, i, seed, mode, theme);
  return { canvas: paintOctaveV1(makeCanvas, S, i, seed, mode), theme: null };
}

async function setBonjiReady(v) { bonjiReady = !!v; }

/* ============================================================
   ブラウザ実行部（document がある環境でのみ実際に動く）
   ============================================================ */
function runApp(config) {
  if (typeof document === 'undefined') return;
  const mode = config.mode || 'mixed'; // 'mixed' | 'butsu' | 'bonji'

  const qs = new URLSearchParams(location.search);
  let V = qs.get('v') === '2' ? 2 : (qs.has('sheet') && !qs.has('v') ? 2 : 1);
  let forcedTheme = qs.has('t') && STYLES[qs.get('t')] ? qs.get('t') : null;

  const cv = document.getElementById('c');
  const ctx = cv.getContext('2d', { alpha: false });
  let W = 0, H = 0, DPR = 1, D = 0;

  const lowMem = (navigator.deviceMemory || 4) < 4;
  const HI = lowMem ? 1024 : 1600;
  const LO = lowMem ? 640 : 1024;

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.round(innerWidth * DPR);
    H = Math.round(innerHeight * DPR);
    cv.width = W; cv.height = H;
    D = 0.5 * Math.hypot(W, H) * 1.02;
  }
  addEventListener('resize', resize);
  resize();

  const makeCanvas = (w, h) => {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  };

  let u = 0, laps = 0;
  let seed = (Math.random() * 1e9) | 0;
  const qSeed = parseInt(qs.get('s'), 10);
  if (!isNaN(qSeed)) seed = qSeed;
  const qU = parseFloat(qs.get('u'));
  if (!isNaN(qU)) u = wrapU(qU);

  let playing = true, dir = 1;
  let speed = 1 / (32 * (60 / 138 / 4));
  let t0 = performance.now(), elapsed = 0;

  const cache = new Map();
  let lastTheme = forcedTheme;
  function texture(i, hi, budget) {
    const res = hi ? HI : LO;
    const w = wrapI(i);
    const key = V + ':' + (forcedTheme || '*') + ':' + w + ':' + res;
    let e = cache.get(key);
    if (e) return e;
    const other = cache.get(V + ':' + (forcedTheme || '*') + ':' + w + ':' + (hi ? LO : HI));
    if (other && budget.used >= budget.max) return other;
    if (budget.used >= budget.max) return null;
    budget.used++;
    const result = paintOctave(makeCanvas, { v: V, S: res, i: w, seed, mode, theme: forcedTheme });
    e = result.canvas;
    if (result.theme) lastTheme = result.theme;
    cache.set(key, e);
    return e;
  }
  function prune(uu) {
    const cur = wrapI(Math.round(uu));
    for (const key of Array.from(cache.keys())) {
      const parts = key.split(':');
      let d = Math.abs(parseInt(parts[2], 10) - cur) % PERIOD;
      d = Math.min(d, PERIOD - d);
      if (d > 5) cache.delete(key);
    }
    while (cache.size > 12) cache.delete(cache.keys().next().value);
  }
  function clearCache() { cache.clear(); }

  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    playing = false;
    addEventListener('DOMContentLoaded', () => { const b = document.getElementById('btnPlay'); if (b) b.textContent = '再生'; });
  }

  /* ---------- sheet デバッグモード ---------- */
  if (qs.has('sheet')) {
    renderSheet();
    return;
  }
  function renderSheet() {
    for (const id of ['hud', 'ladder', 'hint', 'bar', 'btnNames', 'legend', 'warn']) {
      const el = document.getElementById(id);
      if (el) el.hidden = true;
    }
    document.body.style.overflow = 'auto';
    cv.style.position = 'static';
    cv.style.width = 'auto';
    cv.style.height = 'auto';
    cv.style.display = 'block';
    cv.style.margin = '0 auto';

    const cols = 4, tile = 360, layers = 16;
    const rows = Math.ceil(layers / cols);
    cv.width = cols * tile; cv.height = rows * tile;
    ctx.fillStyle = '#07060c'; ctx.fillRect(0, 0, cv.width, cv.height);
    for (let n = 0; n < layers; n++) {
      const col = n % cols, row = Math.floor(n / cols);
      const res = paintOctave(makeCanvas, { v: 2, S: tile, i: n, seed, mode, theme: forcedTheme });
      ctx.drawImage(res.canvas, col * tile, row * tile, tile, tile);
      ctx.fillStyle = 'rgba(255,255,255,.7)';
      ctx.font = '14px monospace';
      ctx.fillText('#' + n + ' ' + (res.theme || ''), col * tile + 8, row * tile + 18);
    }
    document.title += ' — sheet';
  }

  /* ---------- HUD ---------- */
  const LOGK = Math.log10(K);
  const SUP = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
  const sup = s => String(s).split('').map(ch => SUP[ch] || ch).join('');
  const STEPS = [
    [27, '観測可能な宇宙'], [22, '銀河団'], [20, '銀河'], [16, '星と星のあいだ'],
    [12, '恒星系'], [9, '惑星'], [6, '大陸'], [3, '街'],
    [0, '人の背丈'], [-3, '砂粒'], [-6, '細胞'], [-8, 'ウイルス'],
    [-10, '分子'], [-11, '原子'], [-15, '原子核'], [-18, 'クォーク'],
    [-35, '未踏の領域'], [-999, 'プランク長の彼方']
  ];
  function nameOf(e) { for (const [lim, nm] of STEPS) { if (e >= lim) return nm; } return 'プランク長の彼方'; }

  const elVal = document.getElementById('scaleVal');
  const elName = document.getElementById('scaleName');
  const elLayer = document.getElementById('layerNo');
  const elMarker = document.getElementById('marker');
  let lastName = '';
  function updateHud() {
    const e10 = -u * LOGK;
    const exp = Math.floor(e10);
    const man = Math.pow(10, e10 - exp);
    elVal.textContent = man.toFixed(1) + ' × 10' + sup(exp) + ' m';
    const nm = nameOf(e10);
    if (nm !== lastName) { elName.textContent = nm; lastName = nm; }
    elLayer.textContent = '第 ' + Math.round(u * 10) / 10 + ' 層'
      + (laps ? '　↻ ' + (Math.abs(laps) + 1) + '周目' : '')
      + (V === 2 ? '　' + (STYLES[lastTheme] ? STYLES[lastTheme].label : '') : '');
    const y = Math.max(0, Math.min(1, (30 - e10) / 73));
    elMarker.style.top = (y * 100) + '%';
  }
  (function buildLadder() {
    const inner = document.getElementById('ladderInner');
    const ticks = [[26, '宇宙'], [21, '銀河'], [13, '恒星系'], [7, '地球'], [0, '人'], [-6, '細胞'], [-11, '原子'], [-15, '原子核'], [-35, 'プランク長']];
    for (const [e, label] of ticks) {
      const d = document.createElement('div');
      d.className = 'tick';
      d.style.top = (((30 - e) / 73) * 100) + '%';
      d.innerHTML = '<i></i><span>' + label + '</span>';
      inner.appendChild(d);
    }
  })();

  /* ---------- 音（既存アルゴリズムを流用、モード非依存） ---------- */
  const OCT_PER_LAYER = Math.log2(K);
  const NPART = 6;
  const FMIN = 32.703;
  const BPM = 138;
  const STEP = 60 / BPM / 4;
  const BEAT = 60 / BPM;
  const ROOTS = [0, 3, 5, 7, 8, 10];
  const ARP = [0, 7, 12, 7, 3, 10, 15, 10, 0, 7, 12, 15, 12, 7, 3, 7];
  const SECTIONS = [
    { sw: .10, chord: .60, sub: .50, cutLo: 180, cutHi: 800 },
    { sw: .18, chord: .34, sub: .62, cutLo: 260, cutHi: 2200 },
    { sw: .44, chord: .28, sub: .44, cutLo: 380, cutHi: 7500 },
    { sw: .26, chord: .62, sub: .78, cutLo: 700, cutHi: 4200 }
  ];

  let A = null, soundOn = false, audioTick = 0;
  let lastGateLayer = null, curSection = -1, curRoot = 0;
  let schedTimer = null, nextTime = 0, step16 = 0;
  let pendingImpact = false, pendingRoot = null;

  function makeIR(ac, sec, decay) {
    const len = Math.floor(ac.sampleRate * sec);
    const buf = ac.createBuffer(2, len, ac.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }
  function makeNoise(ac) {
    const len = Math.floor(ac.sampleRate);
    const b = ac.createBuffer(1, len, ac.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }
  function softClipCurve() {
    const n = 1024, c = new Float32Array(n), k = 2.2;
    for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; c[i] = Math.tanh(x * k) / Math.tanh(k); }
    return c;
  }
  function initAudio() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    const ac = new AC();
    const master = ac.createGain(); master.gain.value = 0; master.connect(ac.destination);
    const limiter = ac.createDynamicsCompressor();
    limiter.threshold.value = -6; limiter.knee.value = 0; limiter.ratio.value = 20;
    limiter.attack.value = .003; limiter.release.value = .12;
    limiter.connect(master);
    const conv = ac.createConvolver(); conv.buffer = makeIR(ac, 3.0, 2.6);
    const wet = ac.createGain(); wet.gain.value = .32; conv.connect(wet); wet.connect(limiter);
    const send = ac.createGain(); send.gain.value = 1; send.connect(conv);
    const dl = ac.createDelay(1.2); dl.delayTime.value = BEAT * 0.75;
    const dlLP = ac.createBiquadFilter(); dlLP.type = 'lowpass'; dlLP.frequency.value = 2600;
    const fb = ac.createGain(); fb.gain.value = .36;
    const dlOut = ac.createGain(); dlOut.gain.value = .3;
    dl.connect(dlLP); dlLP.connect(fb); fb.connect(dl); dlLP.connect(dlOut); dlOut.connect(limiter);
    const dlSend = ac.createGain(); dlSend.gain.value = 1; dlSend.connect(dl);
    const duck = ac.createGain(); duck.gain.value = 1; duck.connect(limiter);
    const swFilter = ac.createBiquadFilter();
    swFilter.type = 'lowpass'; swFilter.frequency.value = 300; swFilter.Q.value = 7;
    const swGain = ac.createGain(); swGain.gain.value = .1;
    swFilter.connect(swGain);
    swGain.connect(duck); swGain.connect(send); swGain.connect(dlSend);
    const parts = [];
    for (let j = 0; j < NPART; j++) {
      const g = ac.createGain(); g.gain.value = 0; g.connect(swFilter);
      const oscs = [];
      for (let d = 0; d < 2; d++) {
        const o = ac.createOscillator();
        o.type = 'sawtooth'; o.detune.value = d ? 11 : -11;
        o.frequency.value = FMIN * Math.pow(2, j);
        o.connect(g); o.start(); oscs.push(o);
      }
      parts.push({ g, oscs });
    }
    const chordLP = ac.createBiquadFilter(); chordLP.type = 'lowpass'; chordLP.frequency.value = 2900; chordLP.Q.value = .8;
    const chordGain = ac.createGain(); chordGain.gain.value = 0;
    chordLP.connect(chordGain);
    chordGain.connect(duck); chordGain.connect(send); chordGain.connect(dlSend);
    for (const f of [261.63, 311.13, 392.00]) {
      for (let d = 0; d < 2; d++) {
        const o = ac.createOscillator();
        o.type = 'sawtooth'; o.detune.value = d ? 9 : -9; o.frequency.value = f;
        const g = ac.createGain(); g.gain.value = .085;
        o.connect(g); g.connect(chordLP); o.start();
      }
    }
    const shaper = ac.createWaveShaper(); shaper.curve = softClipCurve(); shaper.oversample = '2x';
    const bassLP = ac.createBiquadFilter(); bassLP.type = 'lowpass'; bassLP.frequency.value = 420; bassLP.Q.value = 1.1;
    const bassGain = ac.createGain(); bassGain.gain.value = .5;
    shaper.connect(bassLP); bassLP.connect(bassGain); bassGain.connect(duck);
    const bSub = ac.createOscillator(); bSub.type = 'sine'; bSub.frequency.value = FMIN;
    const bHar = ac.createOscillator(); bHar.type = 'sawtooth'; bHar.frequency.value = FMIN * 2;
    const gSub = ac.createGain(); gSub.gain.value = .9;
    const gHar = ac.createGain(); gHar.gain.value = .17;
    bSub.connect(gSub); gSub.connect(shaper); bSub.start();
    bHar.connect(gHar); gHar.connect(shaper); bHar.start();
    return { ac, master, limiter, send, dlSend, duck, swFilter, swGain, parts, chordGain, bassGain, bSub, bHar, noise: makeNoise(ac) };
  }
  function applySection(sec) {
    if (!A || sec === curSection) return;
    curSection = sec;
    const S = SECTIONS[sec], now = A.ac.currentTime;
    A.swGain.gain.setTargetAtTime(S.sw, now, .35);
    A.chordGain.gain.setTargetAtTime(S.chord, now, .5);
    A.bassGain.gain.setTargetAtTime(S.sub, now, .3);
  }
  function updateAudio() {
    if (!A || !soundOn) return;
    const now = A.ac.currentTime;
    const p = -OCT_PER_LAYER * u;
    for (let j = 0; j < NPART; j++) {
      let x = (p + j) % NPART; if (x < 0) x += NPART;
      const f = FMIN * Math.pow(2, x);
      const a = (0.5 - 0.5 * Math.cos(2 * Math.PI * x / NPART)) * 0.085;
      const Pp = A.parts[j];
      Pp.oscs[0].frequency.setTargetAtTime(f, now, .03);
      Pp.oscs[1].frequency.setTargetAtTime(f, now, .03);
      Pp.g.gain.setTargetAtTime(a, now, .05);
    }
    const layer = Math.floor(u), fr = u - layer, S = SECTIONS[sectionOf(layer)];
    applySection(sectionOf(layer));
    A.swFilter.frequency.setTargetAtTime(S.cutLo * Math.pow(S.cutHi / S.cutLo, fr), now, .05);
  }
  function kick(t, amp) {
    const ac = A.ac;
    const o = ac.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(155, t);
    o.frequency.exponentialRampToValueAtTime(44, t + .085);
    const g = ac.createGain();
    g.gain.setValueAtTime(.0001, t);
    g.gain.linearRampToValueAtTime(amp, t + .004);
    g.gain.exponentialRampToValueAtTime(.0001, t + .3);
    o.connect(g); g.connect(A.limiter); o.start(t); o.stop(t + .33);
    const n = ac.createBufferSource(); n.buffer = A.noise; n.loop = true;
    const hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1400;
    const ng = ac.createGain();
    ng.gain.setValueAtTime(.2 * amp, t); ng.gain.exponentialRampToValueAtTime(.0001, t + .03);
    n.connect(hp); hp.connect(ng); ng.connect(A.limiter); n.start(t); n.stop(t + .05);
  }
  function hat(t, amp, dur) {
    const ac = A.ac;
    const n = ac.createBufferSource(); n.buffer = A.noise; n.loop = true;
    const hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 7000;
    const g = ac.createGain();
    g.gain.setValueAtTime(.0001, t);
    g.gain.linearRampToValueAtTime(amp, t + .002);
    g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    n.connect(hp); hp.connect(g); g.connect(A.limiter);
    const s = ac.createGain(); s.gain.value = .3; g.connect(s); s.connect(A.send);
    n.start(t); n.stop(t + dur + .02);
  }
  function snare(t, amp, tone) {
    const ac = A.ac;
    const n = ac.createBufferSource(); n.buffer = A.noise; n.loop = true;
    const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.1;
    bp.frequency.value = 1400 + tone * 2000;
    const g = ac.createGain();
    g.gain.setValueAtTime(.0001, t);
    g.gain.linearRampToValueAtTime(amp, t + .003);
    g.gain.exponentialRampToValueAtTime(.0001, t + .11);
    n.connect(bp); bp.connect(g); g.connect(A.limiter);
    const s = ac.createGain(); s.gain.value = .3; g.connect(s); s.connect(A.send);
    n.start(t); n.stop(t + .14);
  }
  function crash(t) {
    const ac = A.ac;
    const n = ac.createBufferSource(); n.buffer = A.noise; n.loop = true;
    const hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 3200;
    const g = ac.createGain();
    g.gain.setValueAtTime(.0001, t);
    g.gain.linearRampToValueAtTime(.2, t + .005);
    g.gain.exponentialRampToValueAtTime(.0001, t + 2.4);
    n.connect(hp); hp.connect(g); g.connect(A.limiter);
    const s = ac.createGain(); s.gain.value = .8; g.connect(s); s.connect(A.send);
    n.start(t); n.stop(t + 2.5);
  }
  function bassPluck(t, amp) {
    const ac = A.ac;
    const f = FMIN * 2 * Math.pow(2, curRoot / 12);
    const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
    const o2 = ac.createOscillator(); o2.type = 'square'; o2.frequency.value = f / 2;
    const g2 = ac.createGain(); g2.gain.value = .6; o2.connect(g2);
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 7;
    lp.frequency.setValueAtTime(1700, t);
    lp.frequency.exponentialRampToValueAtTime(240, t + .16);
    const g = ac.createGain();
    g.gain.setValueAtTime(.0001, t);
    g.gain.linearRampToValueAtTime(amp, t + .006);
    g.gain.exponentialRampToValueAtTime(.0001, t + .19);
    o.connect(lp); g2.connect(lp); lp.connect(g); g.connect(A.duck);
    o.start(t); o.stop(t + .22); o2.start(t); o2.stop(t + .22);
  }
  function arpNote(t, s, amp) {
    const ac = A.ac;
    const f = 261.63 * Math.pow(2, ARP[s] / 12);
    const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 4;
    lp.frequency.setValueAtTime(4800, t);
    lp.frequency.exponentialRampToValueAtTime(900, t + .12);
    const g = ac.createGain();
    g.gain.setValueAtTime(.0001, t);
    g.gain.linearRampToValueAtTime(amp, t + .004);
    g.gain.exponentialRampToValueAtTime(.0001, t + .16);
    o.connect(lp); lp.connect(g); g.connect(A.duck);
    const sd = ac.createGain(); sd.gain.value = .55; g.connect(sd); sd.connect(A.dlSend);
    const sv = ac.createGain(); sv.gain.value = .35; g.connect(sv); sv.connect(A.send);
    o.start(t); o.stop(t + .19);
  }
  function duckPump(t) {
    const d = A.duck.gain;
    d.cancelScheduledValues(t);
    d.setValueAtTime(1, t);
    d.linearRampToValueAtTime(.18, t + .015);
    d.linearRampToValueAtTime(1, t + BEAT * .84);
  }
  function impact(t, sec) {
    const ac = A.ac;
    const o = ac.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(118, t);
    o.frequency.exponentialRampToValueAtTime(27, t + .7);
    const g = ac.createGain();
    g.gain.setValueAtTime(.0001, t);
    g.gain.linearRampToValueAtTime(.8, t + .01);
    g.gain.exponentialRampToValueAtTime(.0001, t + 1.1);
    o.connect(g); g.connect(A.limiter); o.start(t); o.stop(t + 1.2);
    if (sec === 3 || sec === 0) crash(t);
  }
  function setRoot(semi, t) {
    curRoot = semi;
    const f = FMIN * Math.pow(2, semi / 12);
    A.bSub.frequency.setTargetAtTime(f, t, .05);
    A.bHar.frequency.setTargetAtTime(f * 2, t, .05);
  }
  function onGate(i) {
    if (!A || !soundOn) return;
    pendingImpact = true;
    pendingRoot = ROOTS[hash32(wrapI(i) ^ 0x5bd1) % ROOTS.length];
  }
  function playStep(s, t) {
    const layer = Math.floor(u), fr = u - layer, sec = sectionOf(layer);
    if (sec >= 1) { if (s % 4 === 0) { kick(t, .95); duckPump(t); } }
    else if (s === 0) { kick(t, .5); duckPump(t); }
    if (sec >= 1 && s % 4 === 2) hat(t, sec >= 3 ? .19 : .13, sec >= 3 ? .12 : .05);
    if (sec >= 2 && s % 2 === 1) hat(t, .055, .035);
    if (sec === 2) {
      const dens = fr < .35 ? 4 : (fr < .7 ? 2 : 1);
      if (s % dens === 0) snare(t, .09 + fr * .20, fr);
    }
    if (sec >= 2 && s % 4 === 2) bassPluck(t, sec >= 3 ? .5 : .26);
    if (sec >= 3) arpNote(t, s, .07);
    if (pendingImpact && s % 2 === 0) {
      impact(t, sec);
      if (pendingRoot !== null) { setRoot(pendingRoot, t); pendingRoot = null; }
      pendingImpact = false;
    }
  }
  function scheduler() {
    if (!A || !soundOn) return;
    const ac = A.ac;
    if (nextTime < ac.currentTime) nextTime = ac.currentTime + .05;
    while (nextTime < ac.currentTime + .12) {
      playStep(step16, nextTime);
      nextTime += STEP;
      step16 = (step16 + 1) % 16;
    }
  }

  /* ---------- 操作UI ---------- */
  const hint = document.getElementById('hint');
  let hintTimer = setTimeout(() => { hint.style.opacity = '0'; }, 5200);
  function killHint() { hint.style.opacity = '0'; clearTimeout(hintTimer); }

  const btnPlay = document.getElementById('btnPlay');
  const btnDir = document.getElementById('btnDir');
  btnPlay.onclick = () => { playing = !playing; btnPlay.textContent = playing ? '停止' : '再生'; };
  btnDir.onclick = () => { dir = -dir; btnDir.textContent = dir > 0 ? '外へ出る' : '内へ潜る'; };
  document.getElementById('btnSeed').onclick = () => { seed = (Math.random() * 1e9) | 0; clearCache(); };

  const btnSound = document.getElementById('btnSound');
  btnSound.onclick = () => {
    if (!A) A = initAudio();
    if (!A) { btnSound.disabled = true; btnSound.textContent = '音は使えません'; return; }
    soundOn = !soundOn;
    btnSound.textContent = soundOn ? '音を止める' : '音を出す';
    const t = A.ac.currentTime;
    if (soundOn) {
      A.ac.resume();
      A.master.gain.cancelScheduledValues(t);
      A.master.gain.setTargetAtTime(0.85, A.ac.currentTime, 0.5);
      nextTime = A.ac.currentTime + 0.06; step16 = 0;
      if (!schedTimer) schedTimer = setInterval(scheduler, 25);
      killHint();
    } else {
      A.master.gain.setTargetAtTime(0, t, 0.25);
      clearInterval(schedTimer); schedTimer = null;
      setTimeout(() => { if (!soundOn) A.ac.suspend(); }, 1000);
    }
  };
  document.addEventListener('visibilitychange', () => {
    if (!A || !soundOn) return;
    if (document.hidden) A.ac.suspend(); else A.ac.resume();
  });
  document.getElementById('speed').oninput = e => { speed = e.target.value / 100; };
  document.getElementById('btnSave').onclick = () => {
    cv.toBlob(b => {
      if (!b) return;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(b);
      a.download = 'cosmozone_' + seed + '_' + u.toFixed(2) + '.png';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    }, 'image/png');
  };

  /* 様式（テーマ）切り替え + 共有リンク：ボタンを動的に追加 */
  const bar = document.getElementById('bar');
  const speedWrap = document.getElementById('speedWrap');
  const btnStyle = document.createElement('button');
  btnStyle.id = 'btnStyle';
  function styleLabel() {
    if (V !== 2) return '様式：v1';
    return '様式：' + (forcedTheme ? STYLES[forcedTheme].label + '（固定）' : '自動');
  }
  btnStyle.textContent = styleLabel();
  btnStyle.onclick = () => {
    if (V !== 2) { V = 2; clearCache(); btnStyle.textContent = styleLabel(); return; }
    const keys = STYLE_KEYS;
    const curIdx = forcedTheme ? keys.indexOf(forcedTheme) : -1;
    const next = keys[(curIdx + 1) % keys.length];
    forcedTheme = next;
    clearCache();
    const p = new URLSearchParams(location.search);
    p.set('v', '2'); p.set('t', forcedTheme);
    history.replaceState(null, '', location.pathname + '?' + p.toString());
    btnStyle.textContent = styleLabel();
  };
  bar.insertBefore(btnStyle, speedWrap);

  const btnShare = document.createElement('button');
  btnShare.id = 'btnShare';
  btnShare.textContent = '共有リンク';
  btnShare.onclick = () => {
    const p = new URLSearchParams();
    p.set('v', String(V));
    p.set('s', String(seed));
    p.set('u', u.toFixed(2));
    if (V === 2 && forcedTheme) p.set('t', forcedTheme);
    const url = location.origin + location.pathname + '?' + p.toString();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(() => {
        btnShare.textContent = 'コピーしました';
        setTimeout(() => { btnShare.textContent = '共有リンク'; }, 1600);
      }).catch(() => { prompt('このURLをコピーしてください', url); });
    } else {
      prompt('このURLをコピーしてください', url);
    }
  };
  bar.insertBefore(btnShare, speedWrap);

  function takeControl() {
    if (playing) { playing = false; btnPlay.textContent = '再生'; }
  }
  function zoomBy(dU) {
    const nu = u + dU;
    if (nu > U_MAX) laps++; else if (nu < U_MIN) laps--;
    u = wrapU(nu);
    killHint();
  }
  addEventListener('wheel', e => { e.preventDefault(); takeControl(); zoomBy(-e.deltaY * 0.0016); }, { passive: false });

  let pinch = 0;
  cv.addEventListener('touchstart', e => {
    if (e.touches.length === 2) pinch = Math.hypot(
      e.touches[0].clientX - e.touches[1].clientX,
      e.touches[0].clientY - e.touches[1].clientY);
  }, { passive: true });
  cv.addEventListener('touchmove', e => {
    if (e.touches.length === 2 && pinch > 0) {
      e.preventDefault();
      const d = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY);
      takeControl();
      zoomBy(Math.log(d / pinch) / Math.log(K));
      pinch = d;
    }
  }, { passive: false });
  cv.addEventListener('touchend', () => { pinch = 0; }, { passive: true });

  const DEAD_R = 46;
  const TURN_LAYERS = 1.0;
  let rot = null, spin = 0;
  const pointers = new Set();
  function angAt(e) {
    const dx = e.clientX - innerWidth / 2, dy = e.clientY - innerHeight / 2;
    return { a: Math.atan2(dy, dx), r: Math.hypot(dx, dy) };
  }
  cv.addEventListener('pointerdown', e => {
    pointers.add(e.pointerId);
    if (pointers.size !== 1) { rot = null; return; }
    const p = angAt(e);
    if (p.r < DEAD_R) return;
    rot = { id: e.pointerId, a0: p.a, aPrev: p.a, r: p.r, swept: 0, vel: 0, took: false, t: performance.now() };
    spin = 0;
  });
  addEventListener('pointermove', e => {
    if (!rot || e.pointerId !== rot.id || pointers.size !== 1) return;
    const p = angAt(e);
    if (p.r < DEAD_R * 0.6) return;
    let da = p.a - rot.aPrev;
    if (da > Math.PI) da -= Math.PI * 2;
    if (da < -Math.PI) da += Math.PI * 2;
    rot.aPrev = p.a; rot.r = p.r; rot.swept += da;
    if (!rot.took && Math.abs(rot.swept) > 0.08) { takeControl(); rot.took = true; }
    const now = performance.now(), dt = Math.max(8, now - rot.t) / 1000;
    rot.t = now;
    const dU = da / (Math.PI * 2) * TURN_LAYERS;
    zoomBy(dU);
    rot.vel = rot.vel * 0.72 + (dU / dt) * 0.28;
  });
  function endRot(e) {
    pointers.delete(e.pointerId);
    if (rot && e.pointerId === rot.id) {
      spin = rot.took ? Math.max(-5, Math.min(5, rot.vel)) : 0;
      if (Math.abs(spin) < 0.06) spin = 0;
      rot = null;
    }
  }
  addEventListener('pointerup', endRot);
  addEventListener('pointercancel', endRot);

  addEventListener('keydown', e => {
    if (e.key === ' ') { e.preventDefault(); btnPlay.click(); }
    if (e.key === 'ArrowUp') zoomBy(0.12);
    if (e.key === 'ArrowDown') zoomBy(-0.12);
  });

  async function checkBonjiFont() {
    try {
      if (!document.fonts) return false;
      const probe = SEEDS[0].ch;
      try { await document.fonts.ready; } catch (e) {}
      await document.fonts.load('64px "Noto Sans Siddham"', probe);
      const c = document.createElement('canvas').getContext('2d');
      c.font = '64px "Noto Sans Siddham", monospace';
      const a = c.measureText(probe).width;
      c.font = '64px monospace';
      const b = c.measureText(probe).width;
      return a > 0 && Math.abs(a - b) > 0.5;
    } catch (e) { return false; }
  }

  const legend = document.getElementById('legend');
  const btnNames = document.getElementById('btnNames');
  if (mode === 'butsu') btnNames.hidden = true;
  btnNames.onclick = () => { legend.hidden = !legend.hidden; };
  legend.onclick = () => { legend.hidden = true; };

  function buildLegend() {
    const rows = [CENTER_SEED].concat(SEEDS);
    const ul = document.getElementById('legendList');
    ul.innerHTML = '';
    for (const r of rows) {
      const li = document.createElement('li');
      const g = document.createElement('div');
      g.className = 'glyph'; g.textContent = bonjiReady ? r.ch : '—';
      const w = document.createElement('div');
      w.className = 'who';
      w.innerHTML = r.name + '<small>' + r.yomi + '　' + r.dir +
        (r.dir === '中央' ? '　この座に次の曼荼羅' : '') + '</small>';
      li.appendChild(g); li.appendChild(w); ul.appendChild(li);
    }
    document.getElementById('fontNote').textContent = bonjiReady
      ? 'Noto Sans Siddham（SIL OFL 1.1）で描画。字形と方位の割り当ては要確認。'
      : '梵字フォントを読み込めていないため、抽象の書字で表示中。';
  }

  (async () => {
    bonjiReady = await checkBonjiFont();
    if (mode !== 'butsu') buildLegend();
    if (bonjiReady) clearCache();
    else if (mode === 'bonji') {
      const w = document.getElementById('warn');
      w.hidden = false;
      w.textContent = '梵字フォントを読み込めませんでした。抽象の書字で表示しています。';
      setTimeout(() => { w.style.opacity = '0'; }, 9000);
    }
  })();

  function frame(now) {
    const dt = Math.min((now - t0) / 1000, 0.05);
    t0 = now; elapsed += dt;
    if (playing) {
      const nu = u + dir * speed * dt;
      if (nu > U_MAX) laps++; else if (nu < U_MIN) laps--;
      u = wrapU(nu);
    } else if (spin) {
      zoomBy(spin * dt);
      spin *= Math.exp(-dt / 0.85);
      if (Math.abs(spin) < 0.02) spin = 0;
    }

    ctx.fillStyle = '#07060c';
    ctx.fillRect(0, 0, W, H);

    const budget = { used: 0, max: 1 };
    const iMin = Math.floor(u) - 1;
    for (let i = iMin, guard = 0; guard < 12; i++, guard++) {
      const s = Math.pow(K, u - i);
      const outer = D * s;
      if (outer < 2.2) break;
      if (outer / K > D * 1.05) continue;
      const wantHi = (u - i) > -0.2 && (u - i) < 1.2;
      const tex = texture(i, wantHi, budget);
      if (!tex) continue;
      ctx.save();
      ctx.translate(W / 2, H / 2);
      ctx.globalAlpha = Math.max(0, Math.min(1, (outer - 2.2) / 26));
      ctx.drawImage(tex, -outer, -outer, outer * 2, outer * 2);
      ctx.restore();
    }
    if (rot && rot.took) {
      const rr = rot.r * DPR;
      ctx.save(); ctx.translate(W / 2, H / 2); ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(217,178,90,.20)'; ctx.lineWidth = 1.4 * DPR;
      ctx.beginPath(); ctx.arc(0, 0, rr, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = 'rgba(217,178,90,.85)'; ctx.lineWidth = 3 * DPR;
      ctx.beginPath(); ctx.arc(0, 0, rr, rot.a0, rot.a0 + rot.swept, rot.swept < 0); ctx.stroke();
      ctx.beginPath();
      ctx.arc(rr * Math.cos(rot.aPrev), rr * Math.sin(rot.aPrev), 5 * DPR, 0, Math.PI * 2);
      ctx.fillStyle = '#d9b25a'; ctx.fill();
      ctx.restore();
    }

    const fl = Math.floor(u);
    if (lastGateLayer === null) lastGateLayer = fl;
    else if (fl !== lastGateLayer) { onGate(fl); lastGateLayer = fl; }
    if ((audioTick++ & 1) === 0) updateAudio();

    prune(u);
    updateHud();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

return {
  K, U_MIN, U_MAX, PERIOD, wrapU, wrapI, hash32, mulberry32,
  MOTIFS, STYLES, STYLE_KEYS, sectionOf, SECTION_TINT,
  themeKeyFor, paintOctave, setBonjiReady, runApp
};

});

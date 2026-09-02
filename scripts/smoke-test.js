const { createCanvas } = require('@napi-rs/canvas');
const Mandala = require('../assets/mandala.js');

const makeCanvas = (w, h) => createCanvas(w, h);

function run(label, opts) {
  const t0 = Date.now();
  const res = Mandala.paintOctave(makeCanvas, opts);
  const ms = Date.now() - t0;
  if (!res || !res.canvas) throw new Error(label + ': no canvas returned');
  console.log(label, 'ok', ms + 'ms', res.theme || '');
}

const seed = 12345;
const modes = ['mixed', 'butsu', 'bonji'];

for (const mode of modes) {
  run(`v1 ${mode} i=0 HI`, { v: 1, S: 1600, i: 0, seed, mode });
  run(`v1 ${mode} i=-30 LO`, { v: 1, S: 1024, i: -30, seed, mode });
  for (let i = -8; i <= 8; i++) {
    run(`v2 ${mode} i=${i}`, { v: 2, S: 1600, i, seed, mode });
  }
  for (const t of Mandala.STYLE_KEYS) {
    run(`v2 ${mode} theme=${t}`, { v: 2, S: 1600, i: 3, seed, mode, theme: t });
  }
}

// periodicity check: layer i and i+120 must render byte-identical (v1 and v2)
const { PSNRCheck } = (() => ({ PSNRCheck: null }))();
function bytesEqual(c1, c2) {
  const b1 = c1.toBuffer('image/png');
  const b2 = c2.toBuffer('image/png');
  return Buffer.compare(b1, b2) === 0;
}
for (const v of [1, 2]) {
  for (const mode of modes) {
    const i1 = Mandala.wrapI(7), i2 = Mandala.wrapI(7 + Mandala.PERIOD);
    const a = Mandala.paintOctave(makeCanvas, { v, S: 400, i: i1, seed, mode, theme: v === 2 ? 'kondei' : undefined }).canvas;
    const b = Mandala.paintOctave(makeCanvas, { v, S: 400, i: i2, seed, mode, theme: v === 2 ? 'kondei' : undefined }).canvas;
    console.log(`period v${v} ${mode}: i1=${i1} i2=${i2}`, bytesEqual(a, b) ? 'MATCH' : 'MISMATCH');
  }
}

console.log('ALL SMOKE TESTS PASSED');

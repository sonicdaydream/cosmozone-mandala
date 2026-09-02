const fs = require('fs');
const path = require('path');
const { createCanvas } = require('@napi-rs/canvas');
const Mandala = require('../assets/mandala.js');
const makeCanvas = (w, h) => createCanvas(w, h);

const outDir = path.join(__dirname, '..', '.preview');
fs.mkdirSync(outDir, { recursive: true });

const seed = 987654;
const jobs = [
  ['v1_mixed', { v: 1, S: 1200, i: Mandala.wrapI(3), seed, mode: 'mixed' }],
  ['v2_mixed_kondei', { v: 2, S: 1200, i: Mandala.wrapI(3), seed, mode: 'mixed', theme: 'kondei' }],
  ['v2_mixed_hakubyo', { v: 2, S: 1200, i: Mandala.wrapI(3), seed, mode: 'mixed', theme: 'hakubyo' }],
  ['v2_mixed_gindei', { v: 2, S: 1200, i: Mandala.wrapI(3), seed, mode: 'mixed', theme: 'gindei' }],
  ['v2_mixed_gokusai', { v: 2, S: 1200, i: Mandala.wrapI(3), seed, mode: 'mixed', theme: 'gokusai' }],
  ['v2_mixed_duotone', { v: 2, S: 1200, i: Mandala.wrapI(3), seed, mode: 'mixed', theme: 'duotone' }],
  ['v2_mixed_yakou', { v: 2, S: 1200, i: Mandala.wrapI(3), seed, mode: 'mixed', theme: 'yakou' }],
  ['v1_butsu', { v: 1, S: 1200, i: Mandala.wrapI(3), seed, mode: 'butsu' }],
  ['v2_butsu_gokusai', { v: 2, S: 1200, i: Mandala.wrapI(3), seed, mode: 'butsu', theme: 'gokusai' }],
  ['v1_bonji', { v: 1, S: 1200, i: Mandala.wrapI(3), seed, mode: 'bonji' }],
  ['v2_bonji_yakou', { v: 2, S: 1200, i: Mandala.wrapI(3), seed, mode: 'bonji', theme: 'yakou' }],
];

for (const [name, opts] of jobs) {
  const res = Mandala.paintOctave(makeCanvas, opts);
  const buf = res.canvas.toBuffer('image/png');
  fs.writeFileSync(path.join(outDir, name + '.png'), buf);
  console.log(name, buf.length, 'bytes', res.theme || '');
}

const assert = require('assert');
const { createCanvas } = require('@napi-rs/canvas');
const M = require('../assets/mandala.js');
const makeCanvas = (w, h) => createCanvas(w, h);

let checks = 0;
function ok(label) { checks++; console.log('  ok  ' + label); }

/* 1. describeLayer は実際に描かれる絵と一致していなければならない
      （食い違うと図鑑が嘘をつく） */
for (const seed of [0, 42, 987654, 2147483647]) {
  for (const theme of [null, 'kondei', 'hakubyo', 'yakou']) {
    for (const dense of [true, false]) {
      const S = dense ? 1600 : 1024;
      for (let n = 0; n < 12; n++) {
        const i = M.wrapI(n * 7 - 20);
        const painted = M.paintOctave(makeCanvas, { v: 2, S, i, seed, mode: 'mixed', theme });
        const desc = M.describeLayer(i, seed, theme, dense);
        assert.strictEqual(desc.theme, painted.theme, `theme mismatch i=${i} seed=${seed}`);
        assert.deepStrictEqual(desc.motifs, painted.motifs, `motifs mismatch i=${i} seed=${seed}`);
        assert.strictEqual(desc.n, painted.n, `n mismatch i=${i} seed=${seed}`);
      }
    }
  }
}
ok('describeLayer matches what paintOctaveV2 actually draws (384 layers)');

/* 2. 図鑑の全組み合わせが正しく定義されている */
const all = M.codexAllPairs();
assert.strictEqual(new Set(all).size, all.length, 'codexAllPairs has duplicates');
for (const p of all) {
  const [t, m] = p.split(':');
  assert.ok(M.STYLES[t], 'unknown theme ' + t);
  assert.ok(M.MOTIFS[m], 'unknown motif ' + m);
  assert.ok(M.MOTIFS[m].label, 'motif ' + m + ' has no label');
}
ok(`codexAllPairs: ${all.length} pairs, all valid and labelled`);

/* 3. 図鑑の記録と保存 */
function fakeStorage() {
  const mem = {};
  return { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, _mem: mem };
}
const store = fakeStorage();
const c1 = M.makeCodex(store);
assert.strictEqual(c1.count(), 0);
const first = c1.record('kondei', ['star', 'lotus', 'star']);
assert.deepStrictEqual(first, ['kondei:star', 'kondei:lotus'], 'should dedupe within one call');
assert.strictEqual(c1.count(), 2);
assert.deepStrictEqual(c1.record('kondei', ['star']), [], 'already-seen pair must not re-report');
assert.strictEqual(c1.record('kondei', ['nope']).length, 0, 'unknown motif ignored');
assert.ok(c1.has('kondei:star') && !c1.has('yakou:braid'));
const c2 = M.makeCodex(store);
assert.strictEqual(c2.count(), 2, 'codex must reload from storage');
ok('codex records, dedupes, and persists');

/* 4. localStorage が使えない環境でも落ちない */
const hostile = {
  getItem() { throw new Error('blocked'); },
  setItem() { throw new Error('blocked'); }
};
const c3 = M.makeCodex(hostile);
assert.strictEqual(c3.count(), 0);
c3.record('yakou', ['braid']);
assert.strictEqual(c3.count(), 1, 'must keep working in-memory when storage is blocked');
ok('codex degrades gracefully when storage is blocked');

/* 5. 今日の曼荼羅：同じ日は同じ種、別の日は別の種、境界はJST */
const noon = Date.UTC(2026, 8, 3, 3, 0, 0); // 2026-09-03 12:00 JST
assert.strictEqual(M.dailyKey(noon), '2026-09-03');
assert.strictEqual(M.dailySeed(noon), M.dailySeed(noon + 3600 * 1000), 'same day = same seed');
assert.strictEqual(M.dailyKey(Date.UTC(2026, 8, 2, 15, 0, 0)), '2026-09-03', 'JST day starts at 15:00 UTC');
assert.strictEqual(M.dailyKey(Date.UTC(2026, 8, 2, 14, 59, 0)), '2026-09-02');
assert.notStrictEqual(M.dailySeed(noon), M.dailySeed(noon + 86400 * 1000), 'next day = different seed');
assert.ok(M.dailySeed(noon) >= 0, 'seed must be non-negative');
ok('daily seed is stable per JST day and changes across days');

/* 6. 38種すべてが本当に到達可能か（埋まらない図鑑になっていないか）
      多数の種 × 120層を走査して、出現しない組み合わせがないか確かめる */
const seen = new Set();
const seedsTried = 400;
for (let s = 0; s < seedsTried; s++) {
  for (let layer = M.U_MIN; layer < M.U_MAX; layer++) {
    const d = M.describeLayer(layer, s, null, true);
    for (const m of d.motifs) seen.add(d.theme + ':' + m);
  }
  if (seen.size === all.length) break;
}
const missing = all.filter(p => !seen.has(p));
if (missing.length) {
  console.log('  MISSING (unreachable in ' + seedsTried + ' seeds):', missing.join(', '));
}
assert.strictEqual(missing.length, 0, 'every codex pair must be reachable');
ok(`all ${all.length} pairs reachable by sweeping seeds`);

/* 7. 1つの種だけでどれくらい集まるか（体感の目安） */
const perSeed = [];
for (const s of [1, 2, 3, 4, 5]) {
  const got = new Set();
  for (let layer = M.U_MIN; layer < M.U_MAX; layer++) {
    const d = M.describeLayer(layer, s, null, true);
    for (const m of d.motifs) got.add(d.theme + ':' + m);
  }
  perSeed.push(got.size);
}
console.log('  info  種1つ（120層）で集まる数:', perSeed.join(', '), '/', all.length);

console.log(`\nALL CODEX TESTS PASSED (${checks} checks)`);

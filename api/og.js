const { createCanvas } = require('@napi-rs/canvas');
const Mandala = require('../assets/mandala.js');

const MODES = new Set(['mixed', 'butsu', 'bonji']);

module.exports = async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const q = url.searchParams;

    const v = q.get('v') === '2' ? 2 : 1;
    const seedParam = parseInt(q.get('s'), 10);
    const seed = Number.isFinite(seedParam) ? seedParam : 0;
    const uParam = parseFloat(q.get('u'));
    const u = Number.isFinite(uParam) ? uParam : 0;
    const i = Mandala.wrapI(Math.round(u));
    const themeParam = q.get('t');
    const theme = (v === 2 && themeParam && Mandala.STYLES[themeParam]) ? themeParam : null;
    const modeParam = q.get('mode');
    const mode = MODES.has(modeParam) ? modeParam : 'mixed';

    const S = 1200;
    const result = Mandala.paintOctave((w, h) => createCanvas(w, h), { v, S, i, seed, mode, theme });

    const out = createCanvas(S, S);
    const g = out.getContext('2d');
    g.fillStyle = '#07060c';
    g.fillRect(0, 0, S, S);
    g.drawImage(result.canvas, 0, 0, S, S);

    const buf = out.toBuffer('image/png');
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.status(200).send(buf);
  } catch (err) {
    res.status(500).send('og generation failed: ' + (err && err.message ? err.message : String(err)));
  }
};

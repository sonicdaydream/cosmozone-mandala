const fs = require('fs');
const path = require('path');
const handler = require('../api/og.js');

function fakeReqRes(qs) {
  const req = { url: '/api/og?' + qs };
  let statusCode = 200, headers = {};
  const res = {
    setHeader(k, v) { headers[k] = v; },
    status(code) { statusCode = code; return res; },
    send(buf) {
      const outDir = path.join(__dirname, '..', '.preview');
      fs.mkdirSync(outDir, { recursive: true });
      const isPng = Buffer.isBuffer(buf);
      const file = path.join(outDir, 'og_' + qs.replace(/[^a-z0-9]/gi, '_') + (isPng ? '.png' : '.txt'));
      fs.writeFileSync(file, buf);
      console.log('status', statusCode, 'headers', headers, '->', file, isPng ? buf.length + ' bytes' : buf);
    }
  };
  return handler(req, res);
}

(async () => {
  await fakeReqRes('v=1&s=42&u=3&mode=mixed');
  await fakeReqRes('v=2&s=42&u=3&t=hakubyo&mode=mixed');
  await fakeReqRes('v=2&s=7&u=5&t=yakou&mode=bonji');
  await fakeReqRes('v=2&s=7&u=5&t=gokusai&mode=butsu');
  await fakeReqRes('mode=mixed'); // no params at all -> defaults
})();

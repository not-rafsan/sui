const https = require('https');
const CID = process.argv[2];
function fetchBuf(url) {
  return new Promise((resolve, reject) => {
    const handler = (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        https.get(res.headers.location, { timeout: 15000 }, handler).on('error', reject);
        return;
      }
      const c = [];
      res.on('data', d => c.push(d));
      res.on('end', () => resolve(Buffer.concat(c)));
      res.on('error', reject);
    };
    https.get(url, { timeout: 15000 }, handler).on('error', reject);
  });
}
async function main() {
  const imgs = [];
  for (let i = 0; i < 3; i++) {
    const b = await fetchBuf('https://picsum.photos/1080/1080?r=' + Date.now() + i);
    imgs.push('data:image/jpeg;base64,' + b.toString('base64'));
    console.log('img' + (i + 1) + ':' + (b.length / 1024).toFixed(0) + 'KB');
  }
  const payload = JSON.stringify({
    carouselId: CID,
    caption: 'API 9007 fix verification #test',
    images: imgs,
    music: null,
  });
  const req = https.request({
    hostname: 'sui-ypgl.onrender.com', port: 443,
    path: '/api/instagram/post', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
    timeout: 30000,
  }, res => {
    const c = [];
    res.on('data', d => c.push(d));
    res.on('end', () => {
      const raw = Buffer.concat(c).toString();
      console.log('HTTP:', res.statusCode);
      console.log('RESP:', raw.substring(0, 500));
    });
  });
  req.on('error', e => console.error('ERR:', e.message));
  req.on('timeout', () => { req.destroy(); console.error('TIMEOUT'); });
  req.write(payload);
  req.end();
}
main().catch(e => console.error('FATAL:', e.message));

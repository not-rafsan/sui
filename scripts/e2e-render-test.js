const https = require('https');
const CAROUSEL_ID = 'cmrtkg28y0001cq01zc4uace3';
const RENDER_POST = 'https://sui-ypgl.onrender.com/api/instagram/post';
const RENDER_POLL = `https://sui-ypgl.onrender.com/api/instagram/post?carouselId=${CAROUSEL_ID}`;

function fetchBuf(url) {
  return new Promise((resolve, reject) => {
    const handler = (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        https.get(res.headers.location, { timeout: 15000 }, handler).on('error', reject);
        return;
      }
      if (res.statusCode !== 200) { reject(new Error(`HTTP ${res.statusCode}`)); return; }
      const c = [];
      res.on('data', d => c.push(d));
      res.on('end', () => resolve(Buffer.concat(c)));
      res.on('error', reject);
    };
    https.get(url, { timeout: 15000 }, handler).on('error', reject);
  });
}

function httpPost(url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const data = typeof body === 'string' ? body : JSON.stringify(body);
    const h = { ...headers, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) };
    const req = https.request({ hostname: u.hostname, port: 443, path: u.pathname + u.search, method: 'POST', headers: h, timeout: 60000 }, res => {
      const c = [];
      res.on('data', d => c.push(d));
      res.on('end', () => { try { resolve({ status: res.statusCode, body: JSON.parse(Buffer.concat(c).toString()) }); } catch(e) { reject(e); } });
    });
    req.on('timeout', () => { req.destroy(new Error('timeout')); });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function httpGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { timeout: 30000 }, res => {
      const c = [];
      res.on('data', d => c.push(d));
      res.on('end', () => { try { resolve(JSON.parse(Buffer.concat(c).toString())); } catch(e) { reject(e); } });
    }).on('error', reject);
  });
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  console.log('=== E2E Render Carousel Post Test ===\n');

  // 1. Download 3 images
  console.log('Step 1: Downloading 3 images from picsum...');
  const images = [];
  for (let i = 0; i < 3; i++) {
    const buf = await fetchBuf(`https://picsum.photos/1080/1080?random=${Date.now() + i}`);
    const b64 = buf.toString('base64');
    images.push(`data:image/jpeg;base64,${b64}`);
    console.log(`  Image ${i + 1}: ${(buf.length / 1024).toFixed(0)}KB, base64: ${(b64.length / 1024).toFixed(0)}KB`);
  }

  // 2. Post to Render
  console.log(`\nStep 2: Posting carousel ${CAROUSEL_ID} to Render...`);
  const postResp = await httpPost(RENDER_POST, {
    carouselId: CAROUSEL_ID,
    caption: 'E2E test - Render carousel post #drudolearn #automation',
    images,
  });
  console.log(`  Response: ${postResp.status} ${JSON.stringify(postResp.body).substring(0, 200)}`);

  if (postResp.status !== 200 || !postResp.body.success) {
    console.error(`\nFAILED to start post!`);
    process.exit(1);
  }

  // 3. Poll for result
  console.log(`\nStep 3: Polling for result (every 15s, max 5 min)...`);
  for (let i = 0; i < 20; i++) {
    await sleep(15000);
    try {
      const s = await httpGet(RENDER_POLL);
      const elapsed = (i + 1) * 15;
      console.log(`  [${elapsed}s] status=${s.status} ${s.message || ''} ${s.url || ''}`);
      if (s.status === 'done') {
        console.log(`\n=== SUCCESS! Post is live at ${s.url} ===`);
        process.exit(0);
      }
      if (s.status === 'error') {
        console.error(`\n=== FAILED: ${s.message} ===`);
        process.exit(1);
      }
    } catch (e) {
      console.log(`  [${(i + 1) * 15}s] Poll error: ${e.message}`);
    }
  }
  console.log('\n=== TIMED OUT after 5 minutes ===');
  process.exit(1);
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
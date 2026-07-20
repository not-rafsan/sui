const https = require('https');
const BASE = 'https://sui-ypgl.onrender.com';

function fetchJSON(method, path, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(BASE + path);
    const isPost = method === 'POST';
    let data;
    const headers = { 'Content-Type': 'application/json' };
    if (body) {
      data = JSON.stringify(body);
      headers['Content-Length'] = Buffer.byteLength(data);
    }
    const req = https.request({
      hostname: u.hostname, port: 443, path: u.pathname + u.search,
      method, headers, timeout: 30000,
    }, res => {
      const c = [];
      res.on('data', ch => c.push(ch));
      res.on('end', () => {
        const raw = Buffer.concat(c).toString();
        try { resolve({ status: res.statusCode, data: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode, data: raw }); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    if (data) req.write(data);
    req.end();
  });
}

function fetchBuffer(url) {
  return new Promise((resolve, reject) => {
    const handler = (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        https.get(res.headers.location, { timeout: 20000 }, handler).on('error', reject);
        return;
      }
      const c = [];
      res.on('data', d => c.push(d));
      res.on('end', () => resolve(Buffer.concat(c)));
      res.on('error', reject);
    };
    https.get(url, { timeout: 20000 }, handler).on('error', reject);
  });
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log('=== Step 1: Ensure IG connection ===');
  const connRes = await fetchJSON('GET', '/api/instagram/connect');
  console.log('Connect response:', JSON.stringify(connRes.data).substring(0, 200));

  console.log('\n=== Step 2: Create test carousel ===');
  const testSlides = [
    { heading: 'Test Slide 1', body: 'This is a test carousel from SUI', type: 'intro' },
    { heading: 'Test Slide 2', body: 'Second slide content here', type: 'content' },
    { heading: 'Test Slide 3', body: 'Third and final slide', type: 'outro' },
  ];
  const createRes = await fetchJSON('POST', '/api/carousels', {
    title: 'API 9007 Fix Test',
    topic: 'testing',
    slides: testSlides,
    caption: 'Test carousel - API 9007 fix verification #test',
  });
  console.log('Create carousel:', JSON.stringify(createRes.data).substring(0, 200));
  if (!createRes.data.id) { console.error('FAILED to create carousel'); return; }
  const carouselId = createRes.data.id;

  console.log('\n=== Step 3: Fetch 3 placeholder images ===');
  const images = [];
  for (let i = 0; i < 3; i++) {
    const buf = await fetchBuffer(`https://picsum.photos/1080/1080?rand=${Date.now()}-${i}`);
    images.push('data:image/jpeg;base64,' + buf.toString('base64'));
    console.log(`  Image ${i + 1}: ${(buf.length / 1024).toFixed(0)}KB`);
  }

  console.log('\n=== Step 4: Post carousel (fire-and-forget on Render) ===');
  const postRes = await fetchJSON('POST', '/api/instagram/post', {
    carouselId,
    caption: 'Test carousel - API 9007 fix #test',
    images,
    music: null,
  });
  console.log('Post response:', JSON.stringify(postRes.data));
  if (postRes.data.error) { console.error('POST FAILED:', postRes.data.error); return; }

  // On Render, it returns immediately with status=processing
  console.log('\n=== Step 5: Poll for result (up to 5 min) ===');
  for (let i = 0; i < 100; i++) {
    await sleep(3000);
    const pollRes = await fetchJSON('GET', `/api/instagram/post?carouselId=${carouselId}`);
    const d = pollRes.data;
    console.log(`  Poll ${i + 1}: status=${d.status} msg=${(d.message || '').substring(0, 80)}`);
    if (d.status === 'done' || (d.success && d.status !== 'processing')) {
      console.log('\n=== SUCCESS! ===');
      console.log('Message:', d.message);
      if (d.url) console.log('URL:', d.url);
      if (d.postId) console.log('Post ID:', d.postId);
      return;
    }
    if (d.status === 'error' || d.success === false) {
      console.log('\n=== FAILED ===');
      console.log('Error:', d.message);
      return;
    }
  }
  console.log('\n=== TIMEOUT — check Instagram manually ===');
}

main().catch(e => console.error('FATAL:', e.message));
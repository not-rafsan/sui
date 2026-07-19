// Test script: create proper 1080x1080 PNGs and post to Instagram
const https = require('https');
const sharp = require('sharp');

function createSlidePNG(text, bgColor) {
  return sharp({
    create: {
      width: 1080,
      height: 1080,
      channels: 3,
      background: bgColor
    }
  })
  .png()
  .toBuffer()
  .then(buf => 'data:image/png;base64,' + buf.toString('base64'));
}

function httpPost(hostname, path, body) {
  return new Promise((resolve, reject) => {
    const data = typeof body === 'string' ? body : JSON.stringify(body);
    const req = https.request({
      hostname, path, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    });
    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(new Error('timeout')); });
    req.write(data);
    req.end();
  });
}

function httpGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    }).on('error', reject).setTimeout(30000, function() { this.destroy(new Error('timeout')); });
  });
}

async function main() {
  const HOST = 'sui-ypgl.onrender.com';

  // Generate proper 1080x1080 images
  console.log('[Test] Generating 1080x1080 slide images...');
  const [img1, img2] = await Promise.all([
    createSlidePNG('Test Slide 1', { r: 30, g: 30, b: 30 }),
    createSlidePNG('Test Slide 2', { r: 50, g: 50, b: 50 })
  ]);
  console.log(`[Test] Image 1 size: ${img1.length} chars`);
  console.log(`[Test] Image 2 size: ${img2.length} chars`);

  // Create carousel
  console.log('[Test] Creating carousel...');
  const createRes = await httpPost(HOST, '/api/carousels', {
    topic: 'Test',
    title: 'TEST POST',
    caption: 'Automated test #testing',
    slides: JSON.stringify([
      { type: 'cover', title: 'TEST', subtitle: 'Slide 1', accentText: 'TESTING' },
      { type: 'cta', title: 'END', subtitle: 'FOLLOW', accentText: '@drudolearn' }
    ])
  });
  const carousel = JSON.parse(createRes.body);
  const carouselId = carousel.id;
  console.log('[Test] Carousel created:', carouselId);

  // Post to Instagram
  console.log('[Test] Starting async post...');
  const postRes = await httpPost(HOST, '/api/instagram/post', {
    carouselId,
    caption: 'Test post #testing',
    images: [img1, img2]
  });
  console.log('[Test] Post response:', postRes.body);
  const postData = JSON.parse(postRes.body);

  if (postData.status === 'processing') {
    console.log('[Test] Async processing started. Polling every 5s...');
    for (let i = 0; i < 72; i++) { // 6 minutes max
      await new Promise(r => setTimeout(r, 5000));
      try {
        const pollRes = await httpGet(`https://${HOST}/api/instagram/post?carouselId=${carouselId}`);
        const pollData = JSON.parse(pollRes.body);
        console.log(`[Test] Poll ${i + 1} (${(i * 5)}s): status=${pollData.status}, msg=${(pollData.message || '').substring(0, 100)}`);
        if (pollData.status === 'done') {
          console.log('\n[Test] SUCCESS!', JSON.stringify(pollData));
          process.exit(0);
        }
        if (pollData.status === 'error') {
          console.log('\n[Test] FAILED:', pollData.message);
          process.exit(1);
        }
      } catch (err) {
        console.log(`[Test] Poll ${i + 1}: network error, retrying...`);
      }
    }
    console.log('[Test] Timed out');
  } else if (postData.error) {
    console.log('[Test] Post error:', postData.error);
  } else {
    console.log('[Test] Unexpected:', JSON.stringify(postData));
  }
}

main().catch(err => { console.error('[Test] Fatal:', err); process.exit(1); });
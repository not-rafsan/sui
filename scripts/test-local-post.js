const https = require('https');
const fs = require('fs');

const USER_TOKEN = 'EAAfsBvyKSBIBR6rDtFZCwsyLEJBxonWaIVQPIiURhR06EPvZCuYBA72yx2VSEC0DjRNvzaTtT80CHTK6TgCQfnlf1ZCPOi2DudTBMhGbdXh9ljUZBGlak8a1f1KfdxGowO8bO9QjuQTGp48beisT2emaHJiaQZB6rOCcZCDCCqKyIZCl5oQYCzcgjz90XsUseqV';
const PAGE_ID = '1172339492635726';
const IG_ID = '17841415149718906';
const API = 'https://graph.facebook.com/v21.0';

function httpGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { timeout: 30000 }, res => {
      const c = [];
      res.on('data', d => c.push(d));
      res.on('end', () => {
        try {
          const j = JSON.parse(Buffer.concat(c).toString());
          if (j.error) reject(new Error(`API [${j.error.code}]: ${j.error.message}`));
          else resolve(j);
        } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

function httpPost(url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request({
      hostname: u.hostname, port: 443, path: u.pathname + u.search,
      method: 'POST', headers, timeout: 45000,
    }, res => {
      const c = [];
      res.on('data', d => c.push(d));
      res.on('end', () => {
        try {
          const j = JSON.parse(Buffer.concat(c).toString());
          if (j.error) reject(new Error(`API [${j.error.code}]: ${j.error.message}`));
          else resolve(j);
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

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

function buildMultipart(fields, fieldName, fileBuf, filename, mimeType) {
  const boundary = '----TestBoundary' + Date.now().toString(36);
  const parts = [];
  for (const [k, v] of Object.entries(fields)) {
    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`));
  }
  parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${fieldName}"; filename="${filename}"\r\nContent-Type: ${mimeType}\r\n\r\n`));
  parts.push(fileBuf);
  parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));
  return { body: Buffer.concat(parts), contentType: `multipart/form-data; boundary=${boundary}` };
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  // Step 1: Get page token
  console.log('Step 1: Getting page token...');
  const pageData = await httpGet(`${API}/${PAGE_ID}?fields=access_token&access_token=${USER_TOKEN}`);
  const pageToken = pageData.access_token;
  console.log('Page token:', pageToken.substring(0, 20) + '...');

  // Step 2: Upload 3 images
  console.log('\nStep 2: Uploading 3 images...');
  const containerIds = [];
  for (let i = 0; i < 3; i++) {
    console.log(`  Downloading image ${i}...`);
    const buf = await fetchBuf(`https://picsum.photos/1080/1080?r=${Date.now()}${i}`);
    console.log(`  Image ${i}: ${(buf.length / 1024).toFixed(0)}KB`);
    
    const { body, contentType } = buildMultipart(
      { published: 'false' }, 'source', buf, `slide_${i}.jpg`, 'image/jpeg'
    );
    
    console.log(`  Uploading to FB...`);
    const upload = await httpPost(
      `${API}/${PAGE_ID}/photos?access_token=${pageToken}`,
      body,
      { 'Content-Type': contentType, 'Content-Length': body.length.toString() }
    );
    console.log(`  Photo ID: ${upload.id}`);
    
    const photoInfo = await httpGet(`${API}/${upload.id}?fields=images&access_token=${pageToken}`);
    const cdnUrl = photoInfo.images[0].source;
    console.log(`  CDN: ${cdnUrl.substring(0, 60)}...`);
    
    console.log(`  Creating IG container...`);
    const container = await httpPost(
      `${API}/${IG_ID}/media?access_token=${pageToken}`,
      JSON.stringify({ image_url: cdnUrl }),
      { 'Content-Type': 'application/json' }
    );
    console.log(`  Container ID: ${container.id}`);
    containerIds.push(container.id);
    if (i < 2) await sleep(1000);
  }

  // Step 3: Poll containers to FINISHED
  console.log('\nStep 3: Polling containers to FINISHED...');
  for (let i = 0; i < containerIds.length; i++) {
    const cid = containerIds[i];
    for (let p = 0; p < 20; p++) {
      const status = await httpGet(`${API}/${cid}?fields=status_code&access_token=${pageToken}`);
      console.log(`  Container ${i}: ${status.status_code} (poll ${p + 1})`);
      if (status.status_code === 'FINISHED') break;
      if (status.status_code === 'ERROR') throw new Error('Container ERROR');
      await sleep(5000);
    }
  }

  // Step 4: Create carousel container
  console.log('\nStep 4: Creating carousel container...');
  const carousel = await httpPost(
    `${API}/${IG_ID}/media?access_token=${pageToken}`,
    JSON.stringify({
      media_type: 'CAROUSEL',
      children: containerIds,
      caption: 'Local test carousel #test',
    }),
    { 'Content-Type': 'application/json' }
  );
  console.log('Carousel container:', carousel.id);

  // Step 5: Poll carousel
  console.log('\nStep 5: Polling carousel...');
  for (let p = 0; p < 10; p++) {
    const status = await httpGet(`${API}/${carousel.id}?fields=status_code&access_token=${pageToken}`);
    console.log(`  Carousel: ${status.status_code} (poll ${p + 1})`);
    if (status.status_code === 'FINISHED') break;
    await sleep(8000);
  }

  // Step 6: Publish
  console.log('\nStep 6: Publishing...');
  const published = await httpPost(
    `${API}/${IG_ID}/media_publish?access_token=${pageToken}`,
    JSON.stringify({ creation_id: carousel.id }),
    { 'Content-Type': 'application/json' }
  );
  console.log('\n=== SUCCESS! ===');
  console.log('Post ID:', published.id);
  console.log('URL:', `https://www.instagram.com/p/${published.id}/`);
}

main().catch(e => console.error('\nFAILED:', e.message));
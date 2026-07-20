const https = require('https');

const USER_TOKEN = 'EAAfsBvyKSBIBR6rDtFZCwsyLEJBxonWaIVQPIiURhR06EPvZCuYBA72yx2VSEC0DjRNvzaTtT80CHTK6TgCQfnlf1ZCPOi2DudTBMhGbdXh9ljUZBGlak8a1f1KfdxGowO8bO9QjuQTGp48beisT2emaHJiaQZB6rOCcZCDCCqKyIZCl5oQYCzcgjz90XsUseqV';
const PAGE_ID = '1172339492635726';
const IG_ID = '17841415149718906';
const API = 'https://graph.facebook.com/v21.0';

function get(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: 30000 }, res => {
      const c = [];
      res.on('data', d => c.push(d));
      res.on('end', () => { try { const j = JSON.parse(Buffer.concat(c).toString()); if (j.error) reject(new Error(`API [${j.error.code}]: ${j.error.message}`)); else resolve(j); } catch (e) { reject(e); } });
    });
    req.on('timeout', () => { req.destroy(new Error('timeout')); });
    req.on('error', reject);
  });
}

function post(url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const data = typeof body === 'string' ? body : JSON.stringify(body);
    const h = { ...headers };
    if (!h['Content-Type']) h['Content-Type'] = 'application/json';
    h['Content-Length'] = Buffer.byteLength(data);
    const req = https.request({ hostname: u.hostname, port: 443, path: u.pathname + u.search, method: 'POST', headers: h, timeout: 60000 }, res => {
      const c = [];
      res.on('data', d => c.push(d));
      res.on('end', () => { try { const j = JSON.parse(Buffer.concat(c).toString()); if (j.error) reject(new Error(`API [${j.error.code}]: ${j.error.message}`)); else resolve(j); } catch (e) { reject(e); } });
    });
    req.on('timeout', () => { req.destroy(new Error('timeout')); });
    req.on('error', reject);
    req.write(data);
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

function buildMultipart(fieldName, fileBuf, filename, mimeType) {
  const boundary = '----B' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const parts = [];
  parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="published"\r\n\r\nfalse\r\n`));
  parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${fieldName}"; filename="${filename}"\r\nContent-Type: ${mimeType}\r\n\r\n`));
  parts.push(fileBuf);
  parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));
  return { body: Buffer.concat(parts), contentType: `multipart/form-data; boundary=${boundary}` };
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  console.log('Step 1: Page token...');
  const pd = await get(`${API}/${PAGE_ID}?fields=access_token&access_token=${USER_TOKEN}`);
  const pt = pd.access_token;
  console.log('OK:', pt.substring(0, 15) + '...');

  const containerIds = [];
  for (let i = 0; i < 3; i++) {
    console.log(`\n--- Image ${i} ---`);
    console.log('Downloading...');
    const buf = await fetchBuf(`https://picsum.photos/1080/1080?r=${Date.now()}${i}`);
    console.log('Size:', (buf.length / 1024).toFixed(0) + 'KB');

    const { body, contentType } = buildMultipart('source', buf, `s${i}.jpg`, 'image/jpeg');
    console.log('Uploading...');
    const up = await post(`${API}/${PAGE_ID}/photos?access_token=${pt}`, body, { 'Content-Type': contentType });
    console.log('Photo:', up.id);

    const info = await get(`${API}/${up.id}?fields=images&access_token=${pt}`);
    const cdn = info.images[0].source;
    console.log('CDN:', cdn.substring(0, 50) + '...');

    console.log('Creating container...');
    const ctr = await post(`${API}/${IG_ID}/media?access_token=${pt}`, { image_url: cdn });
    console.log('Container:', ctr.id);
    containerIds.push(ctr.id);
    await sleep(1000);
  }

  console.log('\n--- Polling containers ---');
  for (let i = 0; i < containerIds.length; i++) {
    for (let p = 0; p < 15; p++) {
      const s = await get(`${API}/${containerIds[i]}?fields=status_code&access_token=${pt}`);
      console.log(`  ${i}: ${s.status_code} (${p + 1})`);
      if (s.status_code === 'FINISHED') break;
      if (s.status_code === 'ERROR') { console.log('ERROR!'); process.exit(1); }
      await sleep(5000);
    }
  }

  console.log('\n--- Carousel container ---');
  const carousel = await post(`${API}/${IG_ID}/media?access_token=${pt}`, {
    media_type: 'CAROUSEL', children: containerIds, caption: 'Test from local script #automation'
  });
  console.log('Carousel:', carousel.id);

  console.log('--- Polling carousel ---');
  for (let p = 0; p < 10; p++) {
    const s = await get(`${API}/${carousel.id}?fields=status_code&access_token=${pt}`);
    console.log('  Carousel:', s.status_code, `(${p + 1})`);
    if (s.status_code === 'FINISHED') break;
    await sleep(8000);
  }

  console.log('\n--- Publishing ---');
  const pub = await post(`${API}/${IG_ID}/media_publish?access_token=${pt}`, { creation_id: carousel.id });
  console.log('\n=== POSTED! ===');
  console.log('ID:', pub.id);
  console.log('URL: https://www.instagram.com/p/' + pub.id + '/');
}

main().catch(e => { console.error('FAILED:', e.message); process.exit(1); });

/**
 * Instagram Posting Daemon
 * Watches temp/ig-queue/pending/ for new jobs, posts them, writes results to done/.
 * Run as a separate process: node scripts/ig-poster-daemon.js
 * Completely independent from Next.js — won't crash the dev server.
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const QUEUE_DIR = path.join(process.cwd(), 'temp', 'ig-queue');
const PENDING_DIR = path.join(QUEUE_DIR, 'pending');
const DONE_DIR = path.join(QUEUE_DIR, 'done');
const API = 'https://graph.facebook.com/v21.0';

const prisma = new PrismaClient();

// Ensure dirs exist
fs.mkdirSync(PENDING_DIR, { recursive: true });
fs.mkdirSync(DONE_DIR, { recursive: true });

// ─── HTTP helpers (native https — proven stable) ───
function httpPost(url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request({ hostname: u.hostname, port: 443, path: u.pathname + u.search, method: 'POST', headers },
      res => {
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString();
          try { const j = JSON.parse(text); j.error ? reject(new Error(`[${j.error.code}] ${j.error.message}`)) : resolve(j); }
          catch { reject(new Error(`Non-JSON (${res.statusCode}): ${text.substring(0, 200)}`)); }
        });
      });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function httpGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString();
        try { const j = JSON.parse(text); j.error ? reject(new Error(`[${j.error.code}] ${j.error.message}`)) : resolve(j); }
        catch { reject(new Error(`Non-JSON: ${text.substring(0, 200)}`)); }
      });
    }).on('error', reject);
  });
}

// ─── Multipart builder ───
function buildMultipart(fields, fieldName, fileBuffer, filename, mimeType) {
  const boundary = `----FB${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const parts = [];
  for (const [k, v] of Object.entries(fields))
    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`));
  parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${fieldName}"; filename="${filename}"\r\nContent-Type: ${mimeType}\r\n\r\n`));
  parts.push(fileBuffer);
  parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));
  return { body: Buffer.concat(parts), contentType: `multipart/form-data; boundary=${boundary}` };
}

// ─── Process one job ───
async function processJob(jobPath) {
  const jobFile = path.basename(jobPath);
  const jobId = jobFile.replace('.json', '');
  const donePath = path.join(DONE_DIR, `${jobId}.json`);

  console.log(`[${new Date().toISOString()}] Processing job ${jobId}...`);

  let result;
  try {
    const payload = JSON.parse(fs.readFileSync(jobPath, 'utf8'));
    const { accessToken, pageId, igBusinessId, carouselId, caption, username, images } = payload;

    // 1. Get page token
    console.log(`  Getting page token...`);
    const pageData = await httpGet(`${API}/${pageId}?fields=access_token,instagram_business_account{id,username}&access_token=${accessToken}`);
    const pageToken = pageData.access_token;
    if (!pageData.instagram_business_account) throw new Error('IG Business Account not linked to Facebook Page.');

    // 2. Upload images to Facebook CDN
    console.log(`  Uploading ${images.length} images...`);
    const cdnUrls = [];
    for (let i = 0; i < images.length; i++) {
      const cleanBase64 = images[i].replace(/^data:image\/\w+;base64,/, '');
      const imageBuffer = Buffer.from(cleanBase64, 'base64');
      const { body, contentType } = buildMultipart({ published: 'false' }, 'source', imageBuffer, `slide_${i}.png`, 'image/png');
      const upload = await httpPost(`${API}/${pageId}/photos?access_token=${pageToken}`, body, { 'Content-Type': contentType, 'Content-Length': body.length.toString() });
      const photoInfo = await httpGet(`${API}/${upload.id}?fields=images&access_token=${pageToken}`);
      cdnUrls.push(photoInfo.images[0].source);
      console.log(`  Slide ${i + 1}/${images.length} uploaded`);
    }

    // 3. Create media containers
    console.log(`  Creating media containers...`);
    const containerIds = [];
    for (let i = 0; i < cdnUrls.length; i++) {
      const c = await httpPost(`${API}/${igBusinessId}/media?access_token=${pageToken}`, JSON.stringify({ image_url: cdnUrls[i] }), { 'Content-Type': 'application/json' });
      containerIds.push(c.id);
      if (i < cdnUrls.length - 1) await new Promise(r => setTimeout(r, 1000));
    }

    // 4. Create carousel container
    console.log(`  Creating carousel...`);
    const carousel = await httpPost(`${API}/${igBusinessId}/media?access_token=${pageToken}`,
      JSON.stringify({ media_type: 'CAROUSEL', children: containerIds, caption }),
      { 'Content-Type': 'application/json' });

    // 5. Wait for processing
    console.log(`  Waiting for processing...`);
    for (let a = 0; a < 12; a++) {
      const st = await httpGet(`${API}/${carousel.id}?fields=status_code&access_token=${pageToken}`);
      if (st.status_code === 'FINISHED') break;
      if (st.status_code === 'ERROR') throw new Error('Media processing failed');
      await new Promise(r => setTimeout(r, 5000));
    }

    // 6. Publish
    console.log(`  Publishing...`);
    const published = await httpPost(`${API}/${igBusinessId}/media_publish?access_token=${pageToken}`,
      JSON.stringify({ creation_id: carousel.id }),
      { 'Content-Type': 'application/json' });

    // 7. Update DB
    await prisma.scheduledPost.create({
      data: { carouselId, scheduledTime: new Date(), status: 'posted', instagramPostId: published.id },
    });
    await prisma.carousel.update({ where: { id: carouselId }, data: { status: 'posted' } });

    result = {
      success: true,
      status: 'done',
      message: `Carousel posted to @${username}!`,
      postId: published.id,
      url: `https://www.instagram.com/p/${published.id}/`,
      timestamp: new Date().toISOString(),
    };
    console.log(`  DONE! Post ID: ${published.id}`);

  } catch (err) {
    console.error(`  FAILED: ${err.message}`);
    result = {
      success: false,
      status: 'error',
      message: err.message,
      timestamp: new Date().toISOString(),
    };
  }

  // Write result and remove pending file
  fs.writeFileSync(donePath, JSON.stringify(result));
  fs.unlinkSync(jobPath);
  console.log(`[${new Date().toISOString()}] Job ${jobId} finished: ${result.status}`);
}

// ─── Main loop ───
async function main() {
  console.log('Instagram Posting Daemon started. Watching queue...');
  console.log(`Pending dir: ${PENDING_DIR}`);

  while (true) {
    try {
      const files = fs.readdirSync(PENDING_DIR).filter(f => f.endsWith('.json'));
      if (files.length > 0) {
        for (const file of files) {
          await processJob(path.join(PENDING_DIR, file));
        }
      }
    } catch (err) {
      console.error('Queue check error:', err.message);
    }
    await new Promise(r => setTimeout(r, 2000)); // Poll every 2s
  }
}

main();
/**
 * Post a carousel from the DB to Instagram using Graph API.
 * Uses sharp for SVG→PNG generation, native https for API calls.
 * Completely standalone — no Turbopack, no Next.js dependency.
 */

const sharp = require('sharp');
const https = require('https');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// ─── CONFIG ───
const PAGE_ID = '1172339492635726';
const IG_BUSINESS_ID = '17841415149718906';
const API_VERSION = 'v21.0';
const API_BASE = `https://graph.facebook.com/${API_VERSION}`;
const W = 1080, H = 1350;

// Get carousel ID from argv or use default (latest ready carousel)
const CAROUSEL_ID = process.argv[2] || null;

// ─── HTTP HELPERS ───
function httpPost(url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request({ hostname: u.hostname, port: 443, path: u.pathname + u.search, method: 'POST', headers }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString();
        try { const j = JSON.parse(text); j.error ? reject(new Error(`[${j.error.code}] ${j.error.message}`)) : resolve(j); }
        catch { reject(new Error(`Non-JSON (${res.statusCode}): ${text.substring(0, 300)}`)); }
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
        catch { reject(new Error(`Non-JSON: ${text.substring(0, 300)}`)); }
      });
    }).on('error', reject);
  });
}

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

// ─── SVG GENERATION ───
function esc(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function wrapText(text, maxChars) {
  const words = text.split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > maxChars) { if (cur) lines.push(cur.trim()); cur = w; }
    else cur = (cur + ' ' + w).trim();
  }
  if (cur) lines.push(cur.trim());
  return lines.join('\n');
}

function coverSVG(s) {
  const lines = s.title.split('\n');
  const lh = 90, startY = 520 - (lines.length * lh) / 2 + lh / 2;
  const titleParts = lines.map((l, i) =>
    `<text x="540" y="${startY + i * lh}" text-anchor="middle" fill="white" font-family="Arial,Helvetica,sans-serif" font-size="80" font-weight="700" letter-spacing="3">${esc(l)}</text>`
  ).join('');
  return `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${W}" height="${H}" fill="#000000"/>
    <circle cx="880" cy="250" r="210" fill="white" opacity="1"/>
    <circle cx="200" cy="1100" r="190" fill="white" opacity="1"/>
    ${titleParts}
    <text x="540" y="${startY + lines.length * lh + 40}" text-anchor="middle" fill="white" font-family="Arial,Helvetica,sans-serif" font-size="32" font-weight="400" opacity="0.7">${esc(s.subtitle)}</text>
    <rect x="420" y="${H - 180}" width="240" height="3" fill="white" opacity="0.5"/>
    <text x="540" y="${H - 140}" text-anchor="middle" fill="white" font-family="Arial,Helvetica,sans-serif" font-size="24" font-weight="400" opacity="0.5">${esc(s.accentText)}</text>
  </svg>`;
}

function contentSVG(s) {
  const ch = s.chapterNumber.toString().padStart(2, '0');
  const bY = 520, bG = 110;
  const bullets = s.bulletPoints.map((bp, i) => {
    const cy = bY + i * bG;
    const wLines = wrapText(bp, 36).split('\n');
    const txts = wLines.map((l, li) =>
      `<text x="540" y="${cy + li * 32}" text-anchor="middle" fill="white" font-family="Arial,Helvetica,sans-serif" font-size="26" font-weight="400" opacity="0.85">${esc(l)}</text>`
    ).join('');
    return `<circle cx="540" cy="${cy - 20}" r="6" fill="white"/>${txts}`;
  }).join('');
  return `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${W}" height="${H}" fill="#000000"/>
    <circle cx="880" cy="250" r="210" fill="white" opacity="1"/>
    <circle cx="200" cy="1100" r="190" fill="white" opacity="1"/>
    <text x="540" y="350" text-anchor="middle" fill="white" font-family="Arial,Helvetica,sans-serif" font-size="108" font-weight="700" opacity="0.08">${esc(ch)}</text>
    <text x="540" y="460" text-anchor="middle" fill="white" font-family="Arial,Helvetica,sans-serif" font-size="48" font-weight="700" letter-spacing="4">${esc(s.title.replace(/\n/g, ' '))}</text>
    <text x="540" y="510" text-anchor="middle" fill="white" font-family="Arial,Helvetica,sans-serif" font-size="22" font-weight="400" opacity="0.5">${esc(s.subtitle)}</text>
    ${bullets}
    ${s.earningPotential ? `<text x="540" y="${H - 80}" text-anchor="middle" fill="white" font-family="Arial,Helvetica,sans-serif" font-size="28" font-weight="600" opacity="0.6">${esc(s.earningPotential)}</text>` : ''}
  </svg>`;
}

function ctaSVG(s) {
  return `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${W}" height="${H}" fill="#000000"/>
    <circle cx="880" cy="250" r="210" fill="white" opacity="1"/>
    <circle cx="200" cy="1100" r="190" fill="white" opacity="1"/>
    <text x="540" y="600" text-anchor="middle" fill="white" font-family="Arial,Helvetica,sans-serif" font-size="72" font-weight="700" letter-spacing="4">${esc(s.title)}</text>
    <text x="540" y="670" text-anchor="middle" fill="white" font-family="Arial,Helvetica,sans-serif" font-size="32" font-weight="400" opacity="0.6">${esc(s.subtitle)}</text>
    <rect x="390" y="730" width="300" height="3" fill="white" opacity="0.5"/>
    <text x="540" y="800" text-anchor="middle" fill="white" font-family="Arial,Helvetica,sans-serif" font-size="28" font-weight="400" opacity="0.5">${esc(s.accentText)}</text>
  </svg>`;
}

async function slideToPNG(slide) {
  let svg;
  switch (slide.type) {
    case 'cover': svg = coverSVG(slide); break;
    case 'content': svg = contentSVG(slide); break;
    case 'cta': svg = ctaSVG(slide); break;
    default: throw new Error('Unknown type: ' + slide.type);
  }
  return sharp(Buffer.from(svg)).resize(W, H).png().toBuffer();
}

// ─── MAIN ───
async function main() {
  // 1. Get account + carousel from DB
  const account = await prisma.instagramAccount.findFirst({ where: { isActive: true } });
  if (!account) throw new Error('No Instagram account connected');
  console.log(`Account: @${account.username}`);

  let carousel;
  if (CAROUSEL_ID) {
    carousel = await prisma.carousel.findUnique({ where: { id: CAROUSEL_ID } });
  } else {
    carousel = await prisma.carousel.findFirst({ where: { status: 'ready' }, orderBy: { updatedAt: 'desc' } });
  }
  if (!carousel) throw new Error('No carousel to post');
  const slides = JSON.parse(carousel.slides);
  const caption = carousel.caption || '';
  console.log(`Carousel: "${carousel.title}" (${slides.length} slides)`);

  // 2. Verify token
  console.log('\n[1/6] Verifying token...');
  const me = await httpGet(`${API_BASE}/me?fields=id&access_token=${account.accessToken}`);
  console.log(`  Token valid for user ${me.id}`);

  // 3. Get page token
  console.log('[2/6] Getting page token...');
  const pageData = await httpGet(`${API_BASE}/${PAGE_ID}?fields=access_token,instagram_business_account{id,username}&access_token=${account.accessToken}`);
  const pageToken = pageData.access_token;
  console.log(`  Page token OK. IG: @${pageData.instagram_business_account.username}`);

  // 4. Generate PNGs & upload to CDN
  console.log('[3/6] Generating & uploading slides...');
  const cdnUrls = [];
  for (let i = 0; i < slides.length; i++) {
    const png = await slideToPNG(slides[i]);
    console.log(`  Slide ${i + 1}: ${png.length} bytes`);

    const { body, contentType } = buildMultipart({ published: 'false' }, 'source', png, `slide_${i}.png`, 'image/png');
    const upload = await httpPost(`${API_BASE}/${PAGE_ID}/photos?access_token=${pageToken}`, body, { 'Content-Type': contentType, 'Content-Length': body.length.toString() });
    const info = await httpGet(`${API_BASE}/${upload.id}?fields=images&access_token=${pageToken}`);
    cdnUrls.push(info.images[0].source);
    console.log(`  Uploaded slide ${i + 1}/${slides.length}`);
  }

  // 5. Create containers + carousel
  console.log('[4/6] Creating media containers...');
  const containerIds = [];
  for (let i = 0; i < cdnUrls.length; i++) {
    const c = await httpPost(`${API_BASE}/${IG_BUSINESS_ID}/media?access_token=${pageToken}`, JSON.stringify({ image_url: cdnUrls[i] }), { 'Content-Type': 'application/json' });
    containerIds.push(c.id);
    if (i < cdnUrls.length - 1) await new Promise(r => setTimeout(r, 1000));
  }

  console.log('[5/6] Creating carousel container...');
  const carouselContainer = await httpPost(`${API_BASE}/${IG_BUSINESS_ID}/media?access_token=${pageToken}`,
    JSON.stringify({ media_type: 'CAROUSEL', children: containerIds, caption }),
    { 'Content-Type': 'application/json' });
  console.log(`  Container: ${carouselContainer.id}`);

  // Wait for processing
  console.log('  Waiting for processing...');
  for (let a = 0; a < 12; a++) {
    const st = await httpGet(`${API_BASE}/${carouselContainer.id}?fields=status_code&access_token=${pageToken}`);
    if (st.status_code === 'FINISHED') { console.log('  Ready!'); break; }
    if (st.status_code === 'ERROR') throw new Error('Media processing failed');
    await new Promise(r => setTimeout(r, 5000));
  }

  // 6. Publish
  console.log('[6/6] Publishing...');
  const published = await httpPost(`${API_BASE}/${IG_BUSINESS_ID}/media_publish?access_token=${pageToken}`,
    JSON.stringify({ creation_id: carouselContainer.id }),
    { 'Content-Type': 'application/json' });

  console.log(`\n=== POSTED! ===`);
  console.log(`Post ID: ${published.id}`);
  console.log(`URL: https://www.instagram.com/p/${published.id}/`);

  // Update DB
  await prisma.carousel.update({ where: { id: carousel.id }, data: { status: 'posted' } });
  await prisma.scheduledPost.create({
    data: { carouselId: carousel.id, scheduledTime: new Date(), status: 'posted', instagramPostId: published.id }
  });
  console.log('DB updated.');

  await prisma.$disconnect();
  return published.id;
}

main().catch(err => { console.error('FAILED:', err.message); process.exit(1); });
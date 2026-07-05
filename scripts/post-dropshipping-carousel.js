/**
 * Standalone script to generate carousel slide PNGs and post to Instagram
 * Uses sharp for image generation and manual multipart/form-data for Facebook uploads
 */

const sharp = require('sharp');
const https = require('https');
const http = require('http');

// ─── CONFIG ───
const ACCESS_TOKEN = 'EAAfsBvyKSBIBR2xBKbu3TUsNYIiWC8nddc4vZC4PHFEWANsnCdMCsjwAnBhe23FS4HsE5jZA6CmJ7PNGc2xP2UQBPuhdV6IHcKXeuQ8Xit33kFe6x5l9oVdBZAnxMMYrsI2yt1fxBfCU310fquLhbW3tlMm8jhJqq5iZBxu1YRQhylchwezVziyCOd4slyjQni2Ycgsmdlxc2eAhy6f7HDsYpAsOE5MTihdA4X7aG1Cwgg7XyMhNYYGWmkoOZCBRNffhuEgY6ViDI8y8ZD';
const PAGE_ID = '1172339492635726';
const IG_BUSINESS_ID = '17841415149718906';
const API_VERSION = 'v21.0';
const API_BASE = `https://graph.facebook.com/${API_VERSION}`;

const W = 1080;
const H = 1350;

const SLIDES = [
  {
    type: 'cover',
    title: 'AI AUTOMATED\nDROPSHIPPING',
    subtitle: 'FROM $0 TO $100K/MO',
    accentText: 'THE COMPLETE GUIDE'
  },
  {
    type: 'content',
    chapterNumber: 1,
    title: 'PRODUCT\nDISCOVERY',
    subtitle: 'AI finds winning products automatically',
    bulletPoints: [
      'Use Jungle Scout AI to analyze 10M+ products',
      'Set criteria: 30%+ margins, 4.5+ rating',
      'ChatGPT identifies trending niches weekly',
      'Filter products with 1000+ daily searches'
    ],
    earningPotential: '$500 - $2,000/mo'
  },
  {
    type: 'content',
    chapterNumber: 2,
    title: 'STORE\nAUTOMATION',
    subtitle: 'Set up in minutes, not weeks',
    bulletPoints: [
      'Install Shopify + DSers app integration',
      'Use Midjourney for AI-generated product images',
      'ChatGPT writes 2000+ word product descriptions',
      'Automate pricing with dynamic algorithms'
    ],
    earningPotential: '$1,000 - $5,000/mo'
  },
  {
    type: 'content',
    chapterNumber: 3,
    title: 'TRAFFIC\nGENERATION',
    subtitle: 'AI-powered customer acquisition',
    bulletPoints: [
      'Use AdCreative.ai for winning ad variations',
      'ChatGPT generates 100+ ad hooks daily',
      'Automate Facebook ad targeting with AI',
      'Set up retargeting sequences automatically'
    ],
    earningPotential: '$2,000 - $10,000/mo'
  },
  {
    type: 'content',
    chapterNumber: 4,
    title: 'ORDER\nFULFILLMENT',
    subtitle: 'Hands-free customer satisfaction',
    bulletPoints: [
      'Connect DSers with AliExpress API',
      'AI tracks inventory in real-time',
      'Automated order processing triggers',
      'Customer service handled by ChatGPT bots'
    ],
    earningPotential: '$3,000 - $15,000/mo'
  },
  {
    type: 'content',
    chapterNumber: 5,
    title: 'SCALING\nSYSTEM',
    subtitle: 'Multiply profits with AI analytics',
    bulletPoints: [
      'Use Pencil AI for product trend predictions',
      'Automate A/B testing with Google Optimize',
      'AI identifies upsell opportunities',
      'Set profit maximization algorithms'
    ],
    earningPotential: '$10,000 - $50,000+/mo'
  },
  {
    type: 'cta',
    title: 'SAVE TO START',
    subtitle: 'FOLLOW FOR MORE',
    accentText: '@AI_BUSINESS_IDEAS'
  }
];

const CAPTION = 'Transform your e-commerce game with AI-powered automation. From product discovery to profit maximization - complete system revealed. #AI #Dropshipping #Ecommerce #Automation #PassiveIncome';

// ─── HELPER: wrap text to fit width (approximate) ───
function wrapText(text, maxCharsPerLine) {
  const words = text.split(' ');
  const lines = [];
  let currentLine = '';
  for (const word of words) {
    if ((currentLine + ' ' + word).trim().length > maxCharsPerLine) {
      if (currentLine) lines.push(currentLine.trim());
      currentLine = word;
    } else {
      currentLine = (currentLine + ' ' + word).trim();
    }
  }
  if (currentLine) lines.push(currentLine.trim());
  return lines.join('\n');
}

// ─── GENERATE SLIDE SVGs ───
function generateCoverSVG(slide) {
  const lines = slide.title.split('\n');
  const titleY = 520;
  const lineHeight = 90;
  const totalTitleHeight = lines.length * lineHeight;
  const startY = titleY - totalTitleHeight / 2 + lineHeight / 2;

  const titleParts = lines.map((line, i) =>
    `<text x="540" y="${startY + i * lineHeight}" text-anchor="middle" fill="white" font-family="Arial, Helvetica, sans-serif" font-size="80" font-weight="700" letter-spacing="3">${escapeXml(line)}</text>`
  ).join('');

  return `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${W}" height="${H}" fill="#000000"/>
    <circle cx="880" cy="250" r="210" fill="white" opacity="1"/>
    <circle cx="200" cy="1100" r="190" fill="white" opacity="1"/>
    ${titleParts}
    <text x="540" y="${startY + lines.length * lineHeight + 40}" text-anchor="middle" fill="white" font-family="Arial, Helvetica, sans-serif" font-size="32" font-weight="400" opacity="0.7">${escapeXml(slide.subtitle)}</text>
    <rect x="420" y="${H - 180}" width="240" height="3" fill="white" opacity="0.5"/>
    <text x="540" y="${H - 140}" text-anchor="middle" fill="white" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="400" opacity="0.5">${escapeXml(slide.accentText)}</text>
  </svg>`;
}

function generateContentSVG(slide) {
  const chNumStr = slide.chapterNumber.toString().padStart(2, '0');
  const bulletStartY = 520;
  const bulletGap = 110;

  const bullets = slide.bulletPoints.map((bp, i) => {
    const cy = bulletStartY + i * bulletGap;
    const wrappedLines = wrapText(bp, 36);
    const lines = wrappedLines.split('\n');
    const lineElements = lines.map((line, li) =>
      `<text x="540" y="${cy + li * 32}" text-anchor="middle" fill="white" font-family="Arial, Helvetica, sans-serif" font-size="26" font-weight="400" opacity="0.85">${escapeXml(line)}</text>`
    ).join('');
    return `
      <circle cx="540" cy="${cy - 20}" r="6" fill="white"/>
      ${lineElements}
    `;
  }).join('');

  return `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${W}" height="${H}" fill="#000000"/>
    <circle cx="880" cy="250" r="210" fill="white" opacity="1"/>
    <circle cx="200" cy="1100" r="190" fill="white" opacity="1"/>
    <text x="540" y="350" text-anchor="middle" fill="white" font-family="Arial, Helvetica, sans-serif" font-size="108" font-weight="700" opacity="0.08">${escapeXml(chNumStr)}</text>
    <text x="540" y="460" text-anchor="middle" fill="white" font-family="Arial, Helvetica, sans-serif" font-size="48" font-weight="700" letter-spacing="4">${escapeXml(slide.title.replace('\n', ' '))}</text>
    <text x="540" y="490" text-anchor="middle" fill="white" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="400" opacity="0.5" dy="20">${escapeXml(slide.subtitle)}</text>
    ${bullets}
    <text x="540" y="${H - 80}" text-anchor="middle" fill="white" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="600" opacity="0.6">${escapeXml(slide.earningPotential)}</text>
  </svg>`;
}

function generateCTASVG(slide) {
  return `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${W}" height="${H}" fill="#000000"/>
    <circle cx="880" cy="250" r="210" fill="white" opacity="1"/>
    <circle cx="200" cy="1100" r="190" fill="white" opacity="1"/>
    <text x="540" y="600" text-anchor="middle" fill="white" font-family="Arial, Helvetica, sans-serif" font-size="72" font-weight="700" letter-spacing="4">${escapeXml(slide.title)}</text>
    <text x="540" y="670" text-anchor="middle" fill="white" font-family="Arial, Helvetica, sans-serif" font-size="32" font-weight="400" opacity="0.6">${escapeXml(slide.subtitle)}</text>
    <rect x="390" y="730" width="300" height="3" fill="white" opacity="0.5"/>
    <text x="540" y="800" text-anchor="middle" fill="white" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="400" opacity="0.5">${escapeXml(slide.accentText)}</text>
  </svg>`;
}

function escapeXml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

// ─── GENERATE PNG from SVG ───
async function generateSlidePNG(slide, index) {
  let svgContent;
  switch (slide.type) {
    case 'cover': svgContent = generateCoverSVG(slide); break;
    case 'content': svgContent = generateContentSVG(slide); break;
    case 'cta': svgContent = generateCTASVG(slide); break;
    default: throw new Error(`Unknown slide type: ${slide.type}`);
  }

  const png = await sharp(Buffer.from(svgContent))
    .resize(W, H)
    .png()
    .toBuffer();

  console.log(`[Generate] Slide ${index + 1} (${slide.type}): ${png.length} bytes`);
  return png;
}

// ─── HTTP HELPER (no external deps) ───
function httpPost(url, body, headers) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: headers,
    };

    const req = https.request(options, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const data = Buffer.concat(chunks).toString('utf8');
        console.log(`[HTTP] POST ${urlObj.pathname} → ${res.statusCode}`);
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Non-JSON response (${res.statusCode}): ${data.substring(0, 300)}`));
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
    };

    const req = https.request(options, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const data = Buffer.concat(chunks).toString('utf8');
        try {
          const json = JSON.parse(data);
          if (json.error) {
            reject(new Error(`API Error [${json.error.code}]: ${json.error.message}`));
          } else {
            resolve(json);
          }
        } catch (e) {
          reject(new Error(`Non-JSON response: ${data.substring(0, 300)}`));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

// ─── BUILD MULTIPART FORM DATA ───
function buildMultipart(fields, fileFieldName, fileBuffer, filename, mimeType) {
  const boundary = `----FormBoundary${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const parts = [];

  for (const [key, value] of Object.entries(fields)) {
    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`));
  }

  parts.push(Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="${fileFieldName}"; filename="${filename}"\r\nContent-Type: ${mimeType}\r\n\r\n`
  ));
  parts.push(fileBuffer);
  parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));

  return {
    body: Buffer.concat(parts),
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}

// ─── MAIN ───
async function main() {
  console.log('=== Instagram Carousel Poster ===\n');

  // Step 0: Verify token
  console.log('[Step 0] Verifying access token...');
  const me = await httpGet(`${API_BASE}/me?fields=id,name&access_token=${ACCESS_TOKEN}`);
  console.log(`  Token valid for: ${me.name} (${me.id})\n`);

  // Step 1: Get page token
  console.log('[Step 1] Getting Page access token...');
  const pageData = await httpGet(`${API_BASE}/${PAGE_ID}?fields=id,access_token,instagram_business_account{id,username}&access_token=${ACCESS_TOKEN}`);
  const pageToken = pageData.access_token;
  const igAccount = pageData.instagram_business_account;
  console.log(`  Page token obtained. IG Business: @${igAccount.username} (${igAccount.id})\n`);

  // Step 2: Generate slide PNGs
  console.log('[Step 2] Generating slide images...');
  const pngBuffers = [];
  for (let i = 0; i < SLIDES.length; i++) {
    const png = await generateSlidePNG(SLIDES[i], i);
    pngBuffers.push(png);
  }
  console.log(`  Generated ${pngBuffers.length} slides\n`);

  // Step 3: Upload each to Facebook CDN
  console.log('[Step 3] Uploading slides to Facebook CDN...');
  const cdnUrls = [];
  for (let i = 0; i < pngBuffers.length; i++) {
    const { body, contentType } = buildMultipart(
      { published: 'false' },
      'source',
      pngBuffers[i],
      `slide_${i}.png`,
      'image/png'
    );

    const uploadUrl = `${API_BASE}/${PAGE_ID}/photos?access_token=${pageToken}`;
    const uploadResult = await httpPost(uploadUrl, body, { 'Content-Type': contentType });
    console.log(`  Slide ${i + 1} uploaded, photo ID: ${uploadResult.id}`);

    // Get CDN URL
    const photoInfo = await httpGet(`${API_BASE}/${uploadResult.id}?fields=images&access_token=${pageToken}`);
    const cdnUrl = photoInfo.images[0].source;
    cdnUrls.push(cdnUrl);
    console.log(`  CDN URL: ${cdnUrl.substring(0, 80)}...`);
  }
  console.log('');

  // Step 4: Create IG media containers
  console.log('[Step 4] Creating Instagram media containers...');
  const containerIds = [];
  for (let i = 0; i < cdnUrls.length; i++) {
    const containerUrl = `${API_BASE}/${igAccount.id}/media?access_token=${pageToken}`;
    const container = await httpPost(
      containerUrl,
      JSON.stringify({ image_url: cdnUrls[i] }),
      { 'Content-Type': 'application/json' }
    );
    containerIds.push(container.id);
    console.log(`  Container ${i + 1}/${cdnUrls.length}: ${container.id}`);

    if (i < cdnUrls.length - 1) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  console.log('');

  // Step 5: Create carousel container
  console.log('[Step 5] Creating carousel container...');
  const carouselUrl = `${API_BASE}/${igAccount.id}/media?access_token=${pageToken}`;
  const carouselContainer = await httpPost(
    carouselUrl,
    JSON.stringify({
      media_type: 'CAROUSEL',
      children: containerIds,
      caption: CAPTION,
    }),
    { 'Content-Type': 'application/json' }
  );
  console.log(`  Carousel container: ${carouselContainer.id}\n`);

  // Step 6: Publish
  console.log('[Step 6] Publishing carousel...');
  const publishUrl = `${API_BASE}/${igAccount.id}/media_publish?access_token=${pageToken}`;
  const published = await httpPost(
    publishUrl,
    JSON.stringify({ creation_id: carouselContainer.id }),
    { 'Content-Type': 'application/json' }
  );
  console.log(`  Published! Post ID: ${published.id}`);
  console.log(`  URL: https://www.instagram.com/p/${published.id}/`);
  console.log('\n=== DONE! Carousel posted successfully! ===');

  return published.id;
}

main().then((postId) => {
  // Update DB
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  prisma.carousel.update({
    where: { id: 'cmr3c59n30000r5ufdhkjdhz8' },
    data: { status: 'posted' }
  }).then(() => {
    return prisma.scheduledPost.create({
      data: {
        carouselId: 'cmr3c59n30000r5ufdhkjdhz8',
        scheduledTime: new Date(),
        status: 'posted',
        instagramPostId: postId,
      }
    });
  }).then(() => {
    console.log('[DB] Updated carousel status and created scheduled post record.');
    return prisma.$disconnect();
  }).catch(e => {
    console.error('[DB Error]', e);
    return prisma.$disconnect();
  });
}).catch(err => {
  console.error('\n=== FAILED ===');
  console.error(err.message || err);
  process.exit(1);
});
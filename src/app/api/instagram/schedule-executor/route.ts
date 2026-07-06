import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import https from 'https'

const API_VERSION = 'v21.0';
const API_BASE = `https://graph.facebook.com/${API_VERSION}`;

// ── Lightweight HTTP helpers (same as ig-poster.js, works on Render) ──

function httpPost(url: string, body: Buffer | string, headers: Record<string, string> = {}): Promise<any> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const req = https.request(
      {
        hostname: urlObj.hostname,
        port: 443,
        path: urlObj.pathname + urlObj.search,
        method: 'POST',
        headers,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => {
          const data = Buffer.concat(chunks).toString('utf8');
          try {
            const json = JSON.parse(data);
            if (json.error) reject(new Error(`API [${json.error.code}]: ${json.error.message}`));
            else resolve(json);
          } catch {
            reject(new Error(`Non-JSON response (${res.statusCode}): ${data.substring(0, 200)}`));
          }
        });
      }
    );
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function httpGet(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => {
        const data = Buffer.concat(chunks).toString('utf8');
        try {
          const json = JSON.parse(data);
          if (json.error) reject(new Error(`API [${json.error.code}]: ${json.error.message}`));
          else resolve(json);
        } catch {
          reject(new Error(`Non-JSON response: ${data.substring(0, 200)}`));
        }
      });
    }).on('error', reject);
  });
}

function buildMultipart(fields: Record<string, string>, fileFieldName: string, fileBuffer: Buffer, filename: string, mimeType: string) {
  const boundary = `----FormBoundary${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const parts: Buffer[] = [];

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

// ── Inline Instagram posting (no child_process, works on Render free tier) ──

async function postToInstagram(payload: {
  accessToken: string;
  pageId: string;
  igBusinessId: string;
  carouselId: string;
  caption: string;
  username: string;
  images: string[];
  music: any;
}) {
  const { accessToken, pageId, igBusinessId, caption, username, images, music } = payload;

  // Step 1: Verify token & get page token
  await httpGet(`${API_BASE}/me?fields=id&access_token=${accessToken}`);

  const pageData = await httpGet(
    `${API_BASE}/${pageId}?fields=access_token,instagram_business_account{id,username}&access_token=${accessToken}`
  );
  const pageToken = pageData.access_token;

  if (!pageData.instagram_business_account) {
    throw new Error('Instagram Business Account not linked to Facebook Page.');
  }

  // Step 2: Upload each image to Facebook CDN
  const cdnUrls: string[] = [];
  for (let i = 0; i < images.length; i++) {
    const cleanBase64 = images[i].replace(/^data:image\/\w+;base64,/, '');
    const imageBuffer = Buffer.from(cleanBase64, 'base64');

    const { body, contentType } = buildMultipart(
      { published: 'false' },
      'source',
      imageBuffer,
      `slide_${i}.png`,
      'image/png'
    );

    const uploadResult = await httpPost(
      `${API_BASE}/${pageId}/photos?access_token=${pageToken}`,
      body,
      { 'Content-Type': contentType, 'Content-Length': body.length.toString() }
    );

    const photoInfo = await httpGet(`${API_BASE}/${uploadResult.id}?fields=images&access_token=${pageToken}`);
    cdnUrls.push(photoInfo.images[0].source);
  }

  // Step 3: Create IG media containers
  const containerIds: string[] = [];
  let musicSkipped = false;
  for (let i = 0; i < cdnUrls.length; i++) {
    const containerPayload: Record<string, unknown> = { image_url: cdnUrls[i] };
    if (music && music.music_asset_id && !music.music_asset_id.startsWith('_')) {
      containerPayload.music = music;
    }
    try {
      const container = await httpPost(
        `${API_BASE}/${igBusinessId}/media?access_token=${pageToken}`,
        JSON.stringify(containerPayload),
        { 'Content-Type': 'application/json' }
      );
      containerIds.push(container.id);
    } catch (musicErr: any) {
      if (music && music.music_asset_id) {
        if (!musicSkipped) {
          console.error(`[Music] API rejected music, posting without: ${musicErr.message?.substring(0, 100)}`);
          musicSkipped = true;
        }
        const retryPayload = { image_url: cdnUrls[i] };
        const container = await httpPost(
          `${API_BASE}/${igBusinessId}/media?access_token=${pageToken}`,
          JSON.stringify(retryPayload),
          { 'Content-Type': 'application/json' }
        );
        containerIds.push(container.id);
      } else {
        throw musicErr;
      }
    }
    if (i < cdnUrls.length - 1) await new Promise(r => setTimeout(r, 1000));
  }

  // Step 4: Create carousel container
  const carouselContainer = await httpPost(
    `${API_BASE}/${igBusinessId}/media?access_token=${pageToken}`,
    JSON.stringify({ media_type: 'CAROUSEL', children: containerIds, caption }),
    { 'Content-Type': 'application/json' }
  );

  // Step 5: Wait for container to be ready
  let isReady = false;
  for (let attempt = 0; attempt < 12; attempt++) {
    const status = await httpGet(
      `${API_BASE}/${carouselContainer.id}?fields=status_code&access_token=${pageToken}`
    );
    if (status.status_code === 'FINISHED') { isReady = true; break; }
    if (status.status_code === 'ERROR') throw new Error('Media processing failed.');
    await new Promise(r => setTimeout(r, 5000));
  }
  if (!isReady) throw new Error('Carousel container did not finish processing in time.');

  // Step 6: Publish
  const published = await httpPost(
    `${API_BASE}/${igBusinessId}/media_publish?access_token=${pageToken}`,
    JSON.stringify({ creation_id: carouselContainer.id }),
    { 'Content-Type': 'application/json' }
  );

  return {
    postId: published.id,
    url: `https://www.instagram.com/p/${published.id}/`,
  };
}

// ── GET: Called by external cron (cron-job.org). Returns 202 immediately, processes in background. ──

export async function GET() {
  // Check for an auth header to prevent random hits from triggering posts
  // The cron-job.org URL will include a secret query param
  // This endpoint just returns 200 as a health/keep-alive ping
  return NextResponse.json({ status: 'alive', timestamp: new Date().toISOString() });
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('x-cron-secret');
  const cronSecret = process.env.CRON_SECRET || 'drudo-schedule-executor-2024';

  if (authHeader !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Respond immediately — the cron service should not wait for posting to finish
  // The actual posting runs in a fire-and-forget promise

  processDuePosts().catch((err) => {
    console.error('[ScheduleExecutor] Fatal error in processDuePosts:', err);
  });

  return NextResponse.json({
    status: 'accepted',
    message: 'Checking for due scheduled posts...',
    timestamp: new Date().toISOString(),
  });
}

async function processDuePosts() {
  const now = new Date();

  // Find all due scheduled posts
  const duePosts = await db.scheduledPost.findMany({
    where: {
      status: 'scheduled',
      scheduledTime: { lte: now },
      imageData: { not: null },
    },
    include: { carousel: true },
    orderBy: { scheduledTime: 'asc' },
  });

  if (duePosts.length === 0) {
    console.log('[ScheduleExecutor] No due posts found.');
    return;
  }

  console.log(`[ScheduleExecutor] Found ${duePosts.length} due post(s). Processing...`);

  const account = await db.instagramAccount.findFirst({ where: { isActive: true } });
  if (!account) {
    console.error('[ScheduleExecutor] No active Instagram account found.');
    for (const post of duePosts) {
      await db.scheduledPost.update({
        where: { id: post.id },
        data: { status: 'failed', errorMessage: 'No active Instagram account connected.' },
      });
    }
    return;
  }

  for (const post of duePosts) {
    try {
      console.log(`[ScheduleExecutor] Processing post ${post.id} (scheduled: ${post.scheduledTime?.toISOString()})`);

      // Mark as processing to prevent duplicate execution
      await db.scheduledPost.update({
        where: { id: post.id },
        data: { status: 'processing' },
      });

      const images: string[] = JSON.parse(post.imageData || '[]');
      if (!images.length) throw new Error('No images found in stored data.');

      const caption = post.caption || post.carousel.caption || '';
      const music = post.music ? JSON.parse(post.music) : null;

      const result = await postToInstagram({
        accessToken: account.accessToken,
        pageId: '1172339492635726',
        igBusinessId: account.instagramUserId,
        carouselId: post.carouselId,
        caption,
        username: account.username,
        images,
        music,
      });

      // Success
      await db.scheduledPost.update({
        where: { id: post.id },
        data: {
          status: 'posted',
          instagramPostId: result.postId,
        },
      });

      await db.carousel.update({
        where: { id: post.carouselId },
        data: { status: 'posted' },
      });

      console.log(`[ScheduleExecutor] Post ${post.id} published! ID: ${result.postId}`);

    } catch (err: any) {
      console.error(`[ScheduleExecutor] Post ${post.id} FAILED:`, err.message);

      await db.scheduledPost.update({
        where: { id: post.id },
        data: {
          status: 'failed',
          errorMessage: err.message || 'Unknown error',
        },
      });
    }
  }

  console.log('[ScheduleExecutor] Done processing all due posts.');
}
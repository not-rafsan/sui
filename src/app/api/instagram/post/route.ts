import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { writeFile, readFile, mkdir } from 'fs/promises'
import { join } from 'path'
import https from 'https'

const QUEUE_DIR = join(process.cwd(), 'temp', 'ig-queue');

const IS_RENDER = process.env.RENDER === 'true' || process.env.RENDER_SERVICE_NAME;

// ── Inline Instagram posting (used on Render where child_process is restricted) ──

function httpPost(url: string, body: Buffer | string, headers: Record<string, string> = {}): Promise<any> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const req = https.request(
      { hostname: urlObj.hostname, port: 443, path: urlObj.pathname + urlObj.search, method: 'POST', headers },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => {
          const data = Buffer.concat(chunks).toString('utf8');
          try {
            const json = JSON.parse(data);
            if (json.error) reject(new Error(`API [${json.error.code}]: ${json.error.message}`));
            else resolve(json);
          } catch { reject(new Error(`Non-JSON response (${res.statusCode}): ${data.substring(0, 200)}`)); }
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
        } catch { reject(new Error(`Non-JSON response: ${data.substring(0, 200)}`)); }
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
  parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${fileFieldName}"; filename="${filename}"\r\nContent-Type: ${mimeType}\r\n\r\n`));
  parts.push(fileBuffer);
  parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));
  return { body: Buffer.concat(parts), contentType: `multipart/form-data; boundary=${boundary}` };
}

async function postToInstagramInline(payload: { accessToken: string; pageId: string; igBusinessId: string; carouselId: string; caption: string; username: string; images: string[]; music: any }) {
  const { accessToken, pageId, igBusinessId, caption, username, images, music } = payload;
  const API_VERSION = 'v21.0';
  const API_BASE = `https://graph.facebook.com/${API_VERSION}`;

  await httpGet(`${API_BASE}/me?fields=id&access_token=${accessToken}`);
  const pageData = await httpGet(`${API_BASE}/${pageId}?fields=access_token,instagram_business_account{id,username}&access_token=${accessToken}`);
  const pageToken = pageData.access_token;
  if (!pageData.instagram_business_account) throw new Error('Instagram Business Account not linked to Facebook Page.');

  const cdnUrls: string[] = [];
  for (let i = 0; i < images.length; i++) {
    const cleanBase64 = images[i].replace(/^data:image\/\w+;base64,/, '');
    const imageBuffer = Buffer.from(cleanBase64, 'base64');
    const { body, contentType } = buildMultipart({ published: 'false' }, 'source', imageBuffer, `slide_${i}.png`, 'image/png');
    const uploadResult = await httpPost(`${API_BASE}/${pageId}/photos?access_token=${pageToken}`, body, { 'Content-Type': contentType, 'Content-Length': body.length.toString() });
    const photoInfo = await httpGet(`${API_BASE}/${uploadResult.id}?fields=images&access_token=${pageToken}`);
    cdnUrls.push(photoInfo.images[0].source);
  }

  const containerIds: string[] = [];
  let musicSkipped = false;
  for (let i = 0; i < cdnUrls.length; i++) {
    const containerPayload: Record<string, unknown> = { image_url: cdnUrls[i] };
    if (music && music.music_asset_id && !music.music_asset_id.startsWith('_')) containerPayload.music = music;
    try {
      const container = await httpPost(`${API_BASE}/${igBusinessId}/media?access_token=${pageToken}`, JSON.stringify(containerPayload), { 'Content-Type': 'application/json' });
      containerIds.push(container.id);
    } catch (musicErr: any) {
      if (music && music.music_asset_id) {
        if (!musicSkipped) { console.error(`[Music] API rejected music: ${musicErr.message?.substring(0, 100)}`); musicSkipped = true; }
        const container = await httpPost(`${API_BASE}/${igBusinessId}/media?access_token=${pageToken}`, JSON.stringify({ image_url: cdnUrls[i] }), { 'Content-Type': 'application/json' });
        containerIds.push(container.id);
      } else throw musicErr;
    }
    if (i < cdnUrls.length - 1) await new Promise(r => setTimeout(r, 1000));
  }

  const carouselContainer = await httpPost(`${API_BASE}/${igBusinessId}/media?access_token=${pageToken}`, JSON.stringify({ media_type: 'CAROUSEL', children: containerIds, caption }), { 'Content-Type': 'application/json' });

  let isReady = false;
  for (let attempt = 0; attempt < 12; attempt++) {
    const status = await httpGet(`${API_BASE}/${carouselContainer.id}?fields=status_code&access_token=${pageToken}`);
    if (status.status_code === 'FINISHED') { isReady = true; break; }
    if (status.status_code === 'ERROR') throw new Error('Media processing failed.');
    await new Promise(r => setTimeout(r, 5000));
  }
  if (!isReady) throw new Error('Carousel container did not finish processing in time.');

  const published = await httpPost(`${API_BASE}/${igBusinessId}/media_publish?access_token=${pageToken}`, JSON.stringify({ creation_id: carouselContainer.id }), { 'Content-Type': 'application/json' });
  return { postId: published.id, url: `https://www.instagram.com/p/${published.id}/` };
}

/* ── POST: Post carousel to Instagram ── */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { carouselId, caption, images, music } = body;

    if (!carouselId || typeof carouselId !== 'string') {
      return NextResponse.json({ error: 'Carousel ID is required' }, { status: 400 });
    }
    if (!images || !Array.isArray(images) || images.length < 2) {
      return NextResponse.json({ error: 'At least 2 slide images are required for an Instagram carousel.' }, { status: 400 });
    }
    if (images.length > 10) {
      return NextResponse.json({ error: 'Instagram carousel allows maximum 10 slides.' }, { status: 400 });
    }

    const account = await db.instagramAccount.findFirst({ where: { isActive: true } });
    if (!account) return NextResponse.json({ error: 'No Instagram account connected.' }, { status: 400 });

    const carousel = await db.carousel.findUnique({ where: { id: carouselId } });
    if (!carousel) return NextResponse.json({ error: 'Carousel not found' }, { status: 404 });

    const payload = {
      accessToken: account.accessToken,
      pageId: '1172339492635726',
      igBusinessId: account.instagramUserId,
      carouselId,
      caption: caption || carousel.caption || '',
      username: account.username,
      images,
      music: music || null,
    };

    // On Render: post inline (no child_process support). On local: spawn ig-poster.js as background process.
    if (IS_RENDER) {
      console.log(`[IG Post] Render mode — posting inline (${images.length} images)`);
      const result = await postToInstagramInline(payload);
      await db.carousel.update({ where: { id: carouselId }, data: { status: 'posted' } });
      return NextResponse.json({
        success: true,
        status: 'done',
        message: `Carousel posted to @${account.username}!`,
        postId: result.postId,
        url: result.url,
      });
    }

    // Local dev: use file queue + child process (Turbopack safe)
    await mkdir(join(QUEUE_DIR, 'pending'), { recursive: true });
    await mkdir(join(QUEUE_DIR, 'done'), { recursive: true });

    const jobId = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const jobPayload = { jobId, ...payload };

    const pendingPath = join(QUEUE_DIR, 'pending', `${jobId}.json`);
    const donePath = join(QUEUE_DIR, 'done', `${jobId}.json`);
    await writeFile(pendingPath, JSON.stringify(jobPayload));

    // Dynamic import to avoid Turbopack tracing child_process at build time
    const { execFile } = await import('child_process');
    const posterScript = join(process.cwd(), 'scripts', 'ig-poster.js');
    const child = execFile(
      'node',
      [posterScript, pendingPath, donePath],
      { detached: true, stdio: 'ignore' },
      (err: any) => {
        if (err) {
          const fs = require('fs');
          fs.writeFileSync(donePath, JSON.stringify({
            success: false, status: 'error',
            message: err.message || 'Poster process failed',
            timestamp: new Date().toISOString(),
          }));
        }
      }
    );
    child.unref();

    console.log(`[IG Post] Job ${jobId} spawned (${images.length} images)`);
    return NextResponse.json({
      success: true, jobId,
      message: `Processing ${images.length} slides — this takes about 30-60 seconds.`,
    });

  } catch (error) {
    console.error('[IG Post] Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to post';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/* ── GET: Poll job status (local dev only) ── */
export async function GET(request: NextRequest) {
  if (IS_RENDER) {
    return NextResponse.json({ error: 'Polling not supported on Render. Posts complete inline.' }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get('jobId');
  if (!jobId) return NextResponse.json({ error: 'jobId is required' }, { status: 400 });

  try {
    const donePath = join(QUEUE_DIR, 'done', `${jobId}.json`);
    const result = await readFile(donePath, 'utf8');
    return NextResponse.json(JSON.parse(result));
  } catch {
    const pendingPath = join(QUEUE_DIR, 'pending', `${jobId}.json`);
    try {
      await readFile(pendingPath, 'utf8');
      return NextResponse.json({ status: 'processing', message: 'Uploading to Instagram...' });
    } catch {
      return NextResponse.json({ status: 'not_found', error: 'Job not found' }, { status: 404 });
    }
  }
}
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { writeFile, readFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { postCarouselToInstagram } from '@/lib/instagram-poster'

const QUEUE_DIR = join(process.cwd(), 'temp', 'ig-queue');

const IS_RENDER = process.env.RENDER === 'true' || process.env.RENDER_SERVICE_NAME;

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
      const result = await postCarouselToInstagram(payload);
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
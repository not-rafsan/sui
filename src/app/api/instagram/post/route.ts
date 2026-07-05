import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { writeFile, readFile, mkdir } from 'fs/promises'
import { join } from 'path'

const QUEUE_DIR = join(process.cwd(), 'temp', 'ig-queue');

/* ── POST: Enqueue a carousel for posting (instant return, no crash) ── */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { carouselId, caption, images } = body;

    if (!carouselId || typeof carouselId !== 'string') {
      return NextResponse.json({ error: 'Carousel ID is required' }, { status: 400 });
    }

    if (!images || !Array.isArray(images) || images.length < 2) {
      return NextResponse.json(
        { error: 'At least 2 slide images are required for an Instagram carousel.' },
        { status: 400 }
      );
    }

    if (images.length > 10) {
      return NextResponse.json(
        { error: 'Instagram carousel allows maximum 10 slides.' },
        { status: 400 }
      );
    }

    const account = await db.instagramAccount.findFirst({ where: { isActive: true } });
    if (!account) {
      return NextResponse.json({ error: 'No Instagram account connected.' }, { status: 400 });
    }

    const carousel = await db.carousel.findUnique({ where: { id: carouselId } });
    if (!carousel) {
      return NextResponse.json({ error: 'Carousel not found' }, { status: 404 });
    }

    // Ensure queue dirs exist
    await mkdir(join(QUEUE_DIR, 'pending'), { recursive: true });
    await mkdir(join(QUEUE_DIR, 'done'), { recursive: true });

    // Write job payload to queue — daemon picks it up
    const jobId = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const jobPayload = {
      jobId,
      accessToken: account.accessToken,
      pageId: '1172339492635726',
      igBusinessId: account.instagramUserId,
      carouselId,
      caption: caption || carousel.caption || '',
      username: account.username,
      images,
    };

    const pendingPath = join(QUEUE_DIR, 'pending', `${jobId}.json`);
    await writeFile(pendingPath, JSON.stringify(jobPayload));

    console.log(`[IG Post] Job ${jobId} queued (${images.length} images)`);

    return NextResponse.json({
      success: true,
      jobId,
      message: `Carousel queued for posting. Processing ${images.length} slides — this takes about 30-60 seconds.`,
    });

  } catch (error) {
    console.error('[IG Post] Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to queue carousel';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/* ── GET: Poll job status ── */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get('jobId');

  if (!jobId) {
    return NextResponse.json({ error: 'jobId is required' }, { status: 400 });
  }

  try {
    const donePath = join(QUEUE_DIR, 'done', `${jobId}.json`);
    const result = await readFile(donePath, 'utf8');
    return NextResponse.json(JSON.parse(result));
  } catch {
    // No result yet — check if still pending
    const pendingPath = join(QUEUE_DIR, 'pending', `${jobId}.json`);
    try {
      await readFile(pendingPath, 'utf8');
      return NextResponse.json({ status: 'processing', message: 'Still uploading...' });
    } catch {
      return NextResponse.json({ status: 'not_found', error: 'Job not found' }, { status: 404 });
    }
  }
}
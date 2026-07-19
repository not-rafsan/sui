import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { postCarouselToInstagram } from '@/lib/instagram-poster'

// ── GET: Used by both keep-alive cron AND executor cron (cron-job.org sends GET).
//   Accepts secret via query param ?secret=xxx or header x-cron-secret. ──

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET || 'drudo-schedule-executor-2024';
  const querySecret = request.nextUrl.searchParams.get('secret');
  const headerSecret = request.headers.get('x-cron-secret');
  const isAuthorized = querySecret === cronSecret || headerSecret === cronSecret;

  if (isAuthorized) {
    // Authorized executor cron — process due posts in background
    processDuePosts().catch((err) => {
      console.error('[ScheduleExecutor] Fatal error in processDuePosts:', err);
    });
  }

  // Always return 200 (also serves as keep-alive health ping)
  return NextResponse.json({ status: 'alive', timestamp: new Date().toISOString() });
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('x-cron-secret');
  const cronSecret = process.env.CRON_SECRET || 'drudo-schedule-executor-2024';

  if (authHeader !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Respond immediately — the cron service should not wait for posting to finish
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

      const result = await postCarouselToInstagram({
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
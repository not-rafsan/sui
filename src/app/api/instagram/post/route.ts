import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { execFile } from 'child_process'
import path from 'path'
import fs from 'fs'

/* ── POST: Publish carousel to Instagram via child process ── */
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

    // Get the active Instagram account
    const account = await db.instagramAccount.findFirst({
      where: { isActive: true },
    });

    if (!account) {
      return NextResponse.json(
        { error: 'No Instagram account connected. Please connect your account first.' },
        { status: 400 }
      );
    }

    // Verify the carousel exists
    const carousel = await db.carousel.findUnique({
      where: { id: carouselId },
    });

    if (!carousel) {
      return NextResponse.json({ error: 'Carousel not found' }, { status: 404 });
    }

    const postCaption = caption || carousel.caption || '';

    // Write payload to temp file for child process
    const tmpDir = path.join(process.cwd(), 'temp', 'ig-posts');
    fs.mkdirSync(tmpDir, { recursive: true });

    const payloadPath = path.join(tmpDir, `payload_${Date.now()}.json`);
    const payload = {
      accessToken: account.accessToken,
      pageId: '1172339492635726',
      igBusinessId: account.instagramUserId,
      carouselId,
      caption: postCaption,
      username: account.username,
      images,
    };

    fs.writeFileSync(payloadPath, JSON.stringify(payload));

    // Spawn the standalone posting script
    const scriptPath = path.join(process.cwd(), 'scripts', 'ig-poster.js');

    const result = await new Promise<{ success: boolean; message: string; postId?: string; url?: string }>((resolve, reject) => {
      const child = execFile(
        'node',
        [scriptPath, payloadPath],
        { timeout: 300000, maxBuffer: 10 * 1024 * 1024 },
        (error, stdout, stderr) => {
          // Clean up temp file regardless of outcome
          try { fs.unlinkSync(payloadPath); } catch { /* ignore */ }

          if (error) {
            console.error('[IG Post] Child process error:', error.message);
            if (stderr) console.error('[IG Post] stderr:', stderr.substring(0, 500));
            reject(new Error(stderr?.substring(0, 300) || error.message));
            return;
          }

          try {
            const output = JSON.parse(stdout.trim());
            resolve(output);
          } catch {
            console.error('[IG Post] Failed to parse child output:', stdout?.substring(0, 300));
            reject(new Error('Failed to process posting result'));
          }
        }
      );
    });

    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 500 });
    }

    // Update database
    if (result.postId) {
      await db.scheduledPost.create({
        data: {
          carouselId,
          scheduledTime: new Date(),
          status: 'posted',
          instagramPostId: result.postId,
        },
      });

      await db.carousel.update({
        where: { id: carouselId },
        data: { status: 'posted' },
      });
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      postId: result.postId,
      url: result.url,
    });

  } catch (error) {
    console.error('[IG Post] Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to post carousel to Instagram';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
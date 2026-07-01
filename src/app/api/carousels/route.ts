import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const carousels = await db.carousel.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        scheduledPosts: {
          orderBy: { scheduledTime: 'asc' },
        },
      },
    });
    return NextResponse.json(carousels);
  } catch (error) {
    console.error('List carousels error:', error);
    return NextResponse.json({ error: 'Failed to fetch carousels' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, topic, slides, caption } = body;

    if (!title || !topic || !slides) {
      return NextResponse.json({ error: 'Title, topic, and slides are required' }, { status: 400 });
    }

    const carousel = await db.carousel.create({
      data: {
        title,
        topic,
        slides: typeof slides === 'string' ? slides : JSON.stringify(slides),
        caption: caption || null,
      },
    });

    return NextResponse.json(carousel, { status: 201 });
  } catch (error) {
    console.error('Create carousel error:', error);
    return NextResponse.json({ error: 'Failed to create carousel' }, { status: 500 });
  }
}
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { carouselId } = body;

    if (!carouselId) {
      return NextResponse.json({ error: 'carouselId is required' }, { status: 400 });
    }

    const carousel = await db.carousel.findUnique({
      where: { id: carouselId },
      include: { scheduledPosts: true },
    });

    if (!carousel) {
      return NextResponse.json({ error: 'Carousel not found' }, { status: 404 });
    }

    // Return carousel data (without internal IDs) for import on another instance
    const exportData = {
      title: carousel.title,
      topic: carousel.topic,
      slides: JSON.parse(carousel.slides),
      caption: carousel.caption,
      exportedAt: new Date().toISOString(),
    };

    return NextResponse.json(exportData);
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json({ error: 'Failed to export carousel' }, { status: 500 });
  }
}
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const carousel = await db.carousel.findUnique({
      where: { id },
      include: {
        scheduledPosts: {
          orderBy: { scheduledTime: 'asc' },
        },
      },
    });

    if (!carousel) {
      return NextResponse.json({ error: 'Carousel not found' }, { status: 404 });
    }

    return NextResponse.json(carousel);
  } catch (error) {
    console.error('Get carousel error:', error);
    return NextResponse.json({ error: 'Failed to fetch carousel' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { title, slides, caption, status } = body;

    const carousel = await db.carousel.update({
      where: { id },
      data: {
        ...(title && { title }),
        ...(slides && { slides: typeof slides === 'string' ? slides : JSON.stringify(slides) }),
        ...(caption !== undefined && { caption }),
        ...(status && { status }),
      },
    });

    return NextResponse.json(carousel);
  } catch (error) {
    console.error('Update carousel error:', error);
    return NextResponse.json({ error: 'Failed to update carousel' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await db.carousel.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete carousel error:', error);
    return NextResponse.json({ error: 'Failed to delete carousel' }, { status: 500 });
  }
}
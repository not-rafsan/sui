import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { carouselId, scheduledTime, caption, images, music } = body

    if (!carouselId || typeof carouselId !== 'string') {
      return NextResponse.json(
        { error: 'Carousel ID is required' },
        { status: 400 }
      )
    }

    if (!scheduledTime || typeof scheduledTime !== 'string') {
      return NextResponse.json(
        { error: 'Scheduled time is required (ISO 8601 format)' },
        { status: 400 }
      )
    }

    // Validate the scheduled time is in the future
    const scheduledDate = new Date(scheduledTime)
    if (isNaN(scheduledDate.getTime())) {
      return NextResponse.json(
        { error: 'Invalid scheduled time format. Use ISO 8601.' },
        { status: 400 }
      )
    }

    const now = new Date()
    if (scheduledDate <= now) {
      return NextResponse.json(
        { error: 'Scheduled time must be in the future' },
        { status: 400 }
      )
    }

    if (!images || !Array.isArray(images) || images.length < 2) {
      return NextResponse.json(
        { error: 'At least 2 slide images are required. Generate them before scheduling.' },
        { status: 400 }
      )
    }

    if (images.length > 10) {
      return NextResponse.json(
        { error: 'Instagram carousel allows maximum 10 slides.' },
        { status: 400 }
      )
    }

    // Verify the carousel exists
    const carousel = await db.carousel.findUnique({
      where: { id: carouselId },
    })

    if (!carousel) {
      return NextResponse.json(
        { error: 'Carousel not found' },
        { status: 404 }
      )
    }

    // Create the scheduled post with pre-rendered images stored in DB
    const scheduledPost = await db.scheduledPost.create({
      data: {
        carouselId,
        scheduledTime: scheduledDate,
        status: 'scheduled',
        imageData: JSON.stringify(images), // Store base64 PNG array
        caption: caption || carousel.caption || null,
        music: music ? JSON.stringify(music) : null,
      },
      include: {
        carousel: true,
      },
    })

    // Update carousel status
    await db.carousel.update({
      where: { id: carouselId },
      data: { status: 'scheduled' },
    })

    const localTime = scheduledDate.toLocaleString('en-US', { timeZone: 'Asia/Dhaka', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })
    console.log(`[Schedule] Post ${scheduledPost.id} scheduled for ${scheduledDate.toISOString()} (Dhaka: ${localTime}, ${images.length} images stored)`)

    return NextResponse.json(
      {
        success: true,
        message: `Carousel scheduled for ${localTime} (Dhaka time)`,
        scheduledPostId: scheduledPost.id,
        scheduledTime: scheduledDate.toISOString(),
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Schedule error:', error)
    return NextResponse.json(
      { error: 'Failed to schedule carousel' },
      { status: 500 }
    )
  }
}
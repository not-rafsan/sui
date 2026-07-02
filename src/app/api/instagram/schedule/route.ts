import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { carouselId, scheduledTime, caption } = body

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

    // Create the scheduled post
    const scheduledPost = await db.scheduledPost.create({
      data: {
        carouselId,
        scheduledTime: scheduledDate,
        status: 'scheduled',
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

    return NextResponse.json(
      {
        success: true,
        message: `Carousel scheduled for ${scheduledDate.toISOString()}`,
        scheduledPost,
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
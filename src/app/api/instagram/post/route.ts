import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { carouselId, caption } = body

    if (!carouselId || typeof carouselId !== 'string') {
      return NextResponse.json(
        { error: 'Carousel ID is required' },
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

    // Check if there's an active Instagram account
    const account = await db.instagramAccount.findFirst({
      where: { isActive: true },
    })

    if (!account) {
      return NextResponse.json(
        { error: 'No Instagram account connected. Please connect an account first.' },
        { status: 400 }
      )
    }

    // Create a scheduled post record and immediately mark as posted (simulation)
    const postedRecord = await db.scheduledPost.create({
      data: {
        carouselId,
        scheduledTime: new Date(),
        status: 'posted',
        instagramPostId: `SIM_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      },
      include: {
        carousel: true,
      },
    })

    // Update carousel status
    await db.carousel.update({
      where: { id: carouselId },
      data: { status: 'posted' },
    })

    return NextResponse.json(
      {
        success: true,
        simulated: true,
        message: `[SIMULATION] Carousel would have been posted to @${account.username} via Instagram Graph API. In production, this would upload carousel images and publish with the caption.`,
        details: {
          account: account.username,
          carouselId,
          caption: caption || carousel.caption || 'No caption provided',
          simulatedPostId: postedRecord.instagramPostId,
        },
        scheduledPost: postedRecord,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Post error:', error)
    return NextResponse.json(
      { error: 'Failed to post carousel' },
      { status: 500 }
    )
  }
}
import { NextRequest, NextResponse } from 'next/server';
import { db, ensureInstagramConnection } from '@/lib/db';

export async function GET() {
  try {
    // Auto-reconnect if DB was wiped (Render deploys reset SQLite)
    await ensureInstagramConnection();

    const account = await db.instagramAccount.findFirst({
      where: { isActive: true },
    });

    if (!account) {
      return NextResponse.json({ connected: false });
    }

    return NextResponse.json({
      connected: true,
      username: account.username,
      tokenExpiresAt: account.tokenExpiresAt,
    });
  } catch (error) {
    console.error('Instagram status error:', error);
    return NextResponse.json({ error: 'Failed to check Instagram status' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, accessToken, instagramUserId, refreshToken, tokenExpiresAt } = body;

    if (!username || !accessToken || !instagramUserId) {
      return NextResponse.json(
        { error: 'Username, access token, and Instagram user ID are required' },
        { status: 400 }
      );
    }

    // Deactivate any existing accounts
    await db.instagramAccount.updateMany({
      where: { isActive: true },
      data: { isActive: false },
    });

    const account = await db.instagramAccount.create({
      data: {
        username,
        accessToken,
        instagramUserId,
        refreshToken: refreshToken || null,
        tokenExpiresAt: tokenExpiresAt ? new Date(tokenExpiresAt) : null,
        isActive: true,
      },
    });

    return NextResponse.json({ success: true, account }, { status: 201 });
  } catch (error) {
    console.error('Instagram connect error:', error);
    return NextResponse.json({ error: 'Failed to connect Instagram' }, { status: 500 });
  }
}
import { NextRequest, NextResponse } from 'next/server';
import { db, ensureInstagramConnection } from '@/lib/db';

const PAGE_ID = '1172339492635726';

async function exchangeForPageToken(userToken: string): Promise<string> {
  // Fetch the page token (which is more stable from cloud IPs)
  const res = await fetch(
    `https://graph.facebook.com/v21.0/${PAGE_ID}?fields=access_token&access_token=${userToken}`
  );
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.access_token;
}

export async function GET() {
  try {
    await ensureInstagramConnection();
    const account = await db.instagramAccount.findFirst({ where: { isActive: true } });
    if (!account) return NextResponse.json({ connected: false });
    return NextResponse.json({ connected: true, username: account.username, tokenExpiresAt: account.tokenExpiresAt });
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
      return NextResponse.json({ error: 'Username, access token, and Instagram user ID are required' }, { status: 400 });
    }

    // Exchange user token for page token (more stable, works from cloud IPs)
    let tokenToStore = accessToken;
    try {
      tokenToStore = await exchangeForPageToken(accessToken);
      console.log('[IG Connect] Exchanged user token for page token');
    } catch (e: any) {
      console.error('[IG Connect] Page token exchange failed, using user token:', e.message);
      // Fall back to user token
      tokenToStore = accessToken;
    }

    await db.instagramAccount.updateMany({ where: { isActive: true }, data: { isActive: false } });

    const account = await db.instagramAccount.create({
      data: {
        username,
        accessToken: tokenToStore,
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
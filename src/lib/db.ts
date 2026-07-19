import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['query'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db

const PAGE_ID = '1172339492635726';

// Auto-seed Instagram credentials on Render (SQLite resets on each deploy)
export async function ensureInstagramConnection() {
  if (!process.env.RENDER && !process.env.RENDER_SERVICE_NAME) return;

  const existing = await db.instagramAccount.findFirst({ where: { isActive: true } });
  if (existing) return;

  const token = process.env.IG_ACCESS_TOKEN || '';
  if (!token) return;

  // Exchange user token for page token (more stable from cloud IPs)
  let tokenToStore = token;
  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${PAGE_ID}?fields=access_token&access_token=${token}`
    );
    const data = await res.json();
    if (data.access_token) {
      tokenToStore = data.access_token;
      console.log('[db] Exchanged user token for page token');
    }
  } catch (e) {
    console.error('[db] Page token exchange failed, using user token');
  }

  await db.instagramAccount.create({
    data: {
      username: process.env.IG_USERNAME || 'drudolearn',
      accessToken: tokenToStore,
      instagramUserId: process.env.IG_USER_ID || '17841415149718906',
      isActive: true,
    },
  });
  console.log('[db] Auto-reconnected Instagram account');
}
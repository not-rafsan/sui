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

// Auto-seed Instagram credentials on Render (SQLite resets on each deploy)
export async function ensureInstagramConnection() {
  if (!process.env.RENDER && !process.env.RENDER_SERVICE_NAME) return; // only on Render

  const existing = await db.instagramAccount.findFirst({ where: { isActive: true } });
  if (existing) return; // already connected

  const token = process.env.IG_ACCESS_TOKEN || '';
  if (!token) return;

  await db.instagramAccount.create({
    data: {
      username: process.env.IG_USERNAME || 'drudolearn',
      accessToken: token,
      instagramUserId: process.env.IG_USER_ID || '17841415149718906',
      isActive: true,
    },
  });
  console.log('[db] Auto-reconnected Instagram account');
}
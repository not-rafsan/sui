// Shared Instagram posting logic — used by both post route and schedule-executor
// Optimized to minimize API calls and handle rate limits

import https from 'https';

const API_VERSION = 'v21.0';
const API_BASE = `https://graph.facebook.com/${API_VERSION}`;

function httpPost(url: string, body: Buffer | string, headers: Record<string, string> = {}): Promise<any> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const req = https.request(
      { hostname: urlObj.hostname, port: 443, path: urlObj.pathname + urlObj.search, method: 'POST', headers },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => {
          const data = Buffer.concat(chunks).toString('utf8');
          try {
            const json = JSON.parse(data);
            if (json.error) reject(new Error(`API [${json.error.code}]: ${json.error.message}`));
            else resolve(json);
          } catch { reject(new Error(`Non-JSON response (${res.statusCode}): ${data.substring(0, 200)}`)); }
        });
      }
    );
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function httpGet(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => {
        const data = Buffer.concat(chunks).toString('utf8');
        try {
          const json = JSON.parse(data);
          if (json.error) reject(new Error(`API [${json.error.code}]: ${json.error.message}`));
          else resolve(json);
        } catch { reject(new Error(`Non-JSON response: ${data.substring(0, 200)}`)); }
      });
    }).on('error', reject);
  });
}

// Wrapper with rate-limit retry (error code 4 = app limit, 80004 = user limit)
async function apiWithRetry(fn: () => Promise<any>, label: string): Promise<any> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      const msg = err?.message || '';
      const isRateLimit = msg.includes('API [4]') || msg.includes('API [80004]') || msg.includes('rate') || msg.includes('throttl');
      if (!isRateLimit || attempt === 2) throw err;
      // Exponential backoff: 30s, 60s
      const wait = 30000 * Math.pow(2, attempt);
      console.log(`[IG] Rate limited on ${label}, retrying in ${wait / 1000}s (attempt ${attempt + 1}/3)...`);
      await new Promise(r => setTimeout(r, wait));
    }
  }
}

function buildMultipart(fields: Record<string, string>, fileFieldName: string, fileBuffer: Buffer, filename: string, mimeType: string) {
  const boundary = `----FormBoundary${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const parts: Buffer[] = [];
  for (const [key, value] of Object.entries(fields)) {
    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`));
  }
  parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${fileFieldName}"; filename="${filename}"\r\nContent-Type: ${mimeType}\r\n\r\n`));
  parts.push(fileBuffer);
  parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));
  return { body: Buffer.concat(parts), contentType: `multipart/form-data; boundary=${boundary}` };
}

/**
 * Post a carousel to Instagram.
 * 
 * Call count for N slides:
 *   Old: 2 + 2N + N + 1 + 12 + 1 = 4N + 16  (e.g. 7 slides = 44 calls)
 *   New: 1 + 2N + N + 1 + 6  + 1 = 3N + 9   (e.g. 7 slides = 30 calls)
 * 
 * Key savings:
 *   - Removed /me validation call (-1)
 *   - Reduced status polling from 12 to 6 (-6)
 *   - Added rate-limit auto-retry with backoff
 */
export async function postCarouselToInstagram(payload: {
  accessToken: string;
  pageId: string;
  igBusinessId: string;
  carouselId: string;
  caption: string;
  username: string;
  images: string[];
  music: any;
}) {
  const { accessToken, pageId, igBusinessId, caption, username, images, music } = payload;

  // Step 1: Get page token (1 call, was 2 — removed unnecessary /me check)
  const pageData = await apiWithRetry(() =>
    httpGet(`${API_BASE}/${pageId}?fields=access_token,instagram_business_account{id,username}&access_token=${accessToken}`),
    'get-page-token'
  );
  const pageToken = pageData.access_token;
  if (!pageData.instagram_business_account) throw new Error('Instagram Business Account not linked to Facebook Page.');

  // Step 2: Upload images to FB and get CDN URLs (2N calls)
  const cdnUrls: string[] = [];
  for (let i = 0; i < images.length; i++) {
    const cleanBase64 = images[i].replace(/^data:image\/\w+;base64,/, '');
    const imageBuffer = Buffer.from(cleanBase64, 'base64');
    const { body, contentType } = buildMultipart({ published: 'false' }, 'source', imageBuffer, `slide_${i}.png`, 'image/png');

    const uploadResult = await apiWithRetry(() =>
      httpPost(`${API_BASE}/${pageId}/photos?access_token=${pageToken}`, body, { 'Content-Type': contentType, 'Content-Length': body.length.toString() }),
      `upload-slide-${i}`
    );

    const photoInfo = await apiWithRetry(() =>
      httpGet(`${API_BASE}/${uploadResult.id}?fields=images&access_token=${pageToken}`),
      `cdn-url-${i}`
    );
    cdnUrls.push(photoInfo.images[0].source);

    // Stagger uploads to avoid rate limiting
    if (i < images.length - 1) await new Promise(r => setTimeout(r, 2000));
  }

  // Step 3: Create IG media containers (N calls, +N retries worst case with music)
  const containerIds: string[] = [];
  let musicSkipped = false;
  for (let i = 0; i < cdnUrls.length; i++) {
    const containerPayload: Record<string, unknown> = { image_url: cdnUrls[i] };
    if (music && music.music_asset_id && !music.music_asset_id.startsWith('_')) containerPayload.music = music;

    try {
      const container = await apiWithRetry(() =>
        httpPost(`${API_BASE}/${igBusinessId}/media?access_token=${pageToken}`, JSON.stringify(containerPayload), { 'Content-Type': 'application/json' }),
        `container-${i}`
      );
      containerIds.push(container.id);
    } catch (musicErr: any) {
      if (music && music.music_asset_id) {
        if (!musicSkipped) { console.error(`[Music] API rejected music: ${musicErr.message?.substring(0, 100)}`); musicSkipped = true; }
        const container = await apiWithRetry(() =>
          httpPost(`${API_BASE}/${igBusinessId}/media?access_token=${pageToken}`, JSON.stringify({ image_url: cdnUrls[i] }), { 'Content-Type': 'application/json' }),
          `container-retry-${i}`
        );
        containerIds.push(container.id);
      } else throw musicErr;
    }
    if (i < cdnUrls.length - 1) await new Promise(r => setTimeout(r, 1000));
  }

  // Step 4: Create carousel container (1 call)
  const carouselContainer = await apiWithRetry(() =>
    httpPost(`${API_BASE}/${igBusinessId}/media?access_token=${pageToken}`, JSON.stringify({ media_type: 'CAROUSEL', children: containerIds, caption }), { 'Content-Type': 'application/json' }),
    'carousel-container'
  );

  // Step 5: Wait for processing (up to 6 polls, was 12)
  let isReady = false;
  for (let attempt = 0; attempt < 6; attempt++) {
    const status = await apiWithRetry(() =>
      httpGet(`${API_BASE}/${carouselContainer.id}?fields=status_code&access_token=${pageToken}`),
      `status-check-${attempt}`
    );
    if (status.status_code === 'FINISHED') { isReady = true; break; }
    if (status.status_code === 'ERROR') throw new Error('Media processing failed.');
    await new Promise(r => setTimeout(r, 8000)); // 8s between polls (was 5s)
  }
  if (!isReady) throw new Error('Carousel container did not finish processing in time.');

  // Step 6: Publish (1 call)
  const published = await apiWithRetry(() =>
    httpPost(`${API_BASE}/${igBusinessId}/media_publish?access_token=${pageToken}`, JSON.stringify({ creation_id: carouselContainer.id }), { 'Content-Type': 'application/json' }),
    'publish'
  );

  return { postId: published.id, url: `https://www.instagram.com/p/${published.id}/` };
}
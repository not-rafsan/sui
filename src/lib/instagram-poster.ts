// Shared Instagram posting logic — used by both post route and schedule-executor
// Optimized to minimize API calls and handle rate limits

import https from 'https';

const API_VERSION = 'v21.0';
const API_BASE = `https://graph.facebook.com/${API_VERSION}`;

function httpPost(url: string, body: Buffer | string, headers: Record<string, string> = {}): Promise<any> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const req = https.request(
      { hostname: urlObj.hostname, port: 443, path: urlObj.pathname + urlObj.search, method: 'POST', headers, timeout: 45000 },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => {
          const data = Buffer.concat(chunks).toString('utf8');
          try {
            const json = JSON.parse(data);
            if (json.error) reject(new Error(`API [${json.error.code}]: ${json.error.message} [POST ${urlObj.pathname}]`));
            else resolve(json);
          } catch { reject(new Error(`Non-JSON response (${res.statusCode}) [POST ${urlObj.pathname}]: ${data.substring(0, 200)}`)); }
        });
      }
    );
    req.on('timeout', () => { req.destroy(new Error('Request timed out (45s)')); });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function httpGet(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: 45000 }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => {
        const data = Buffer.concat(chunks).toString('utf8');
        try {
          const json = JSON.parse(data);
          if (json.error) reject(new Error(`API [${json.error.code}]: ${json.error.message} [GET ${new URL(url).pathname}]`));
          else resolve(json);
        } catch { reject(new Error(`Non-JSON response [GET ${url.substring(0, 80)}]: ${data.substring(0, 200)}`)); }
      });
    });
    req.setTimeout(45000, () => { req.destroy(new Error('Request timed out (45s)')); });
    req.on('error', reject);
  });
}

// Wrapper with retry for rate limits AND network errors
async function apiWithRetry(fn: () => Promise<any>, label: string, maxRetries = 5): Promise<any> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      const msg = err?.message || '';
      const isRetryable = 
        msg.includes('API [4]') ||
        msg.includes('API [80004]') ||
        msg.includes('API [9007]') ||
        msg.includes('API [-1]') ||
        msg.includes('timed out') ||
        msg.includes('ECONNRESET') ||
        msg.includes('ECONNREFUSED') ||
        msg.includes('Fatal') ||
        msg.includes('socket hang up');
      if (!isRetryable || attempt === maxRetries - 1) throw err;
      const wait = 8000 * Math.pow(1.5, attempt);
      console.log(`[IG] Retryable error on ${label}: ${msg.substring(0, 80)}. Waiting ${Math.round(wait / 1000)}s (attempt ${attempt + 1}/${maxRetries})...`);
      await new Promise(r => setTimeout(r, wait));
    }
  }
}

// Dedicated retry for carousel container creation (9007 = media not ready yet)
async function carouselContainerWithRetry(
  igBusinessId: string, pageToken: string, containerIds: string[], caption: string
): Promise<any> {
  const payload = JSON.stringify({ media_type: 'CAROUSEL', children: containerIds, caption });
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      return await httpPost(`${API_BASE}/${igBusinessId}/media?access_token=${pageToken}`, payload, { 'Content-Type': 'application/json' });
    } catch (err: any) {
      const msg = err?.message || '';
      const isRetryable = msg.includes('API [9007]') || msg.includes('API [4]') || msg.includes('API [80004]') || msg.includes('API [-1]') || msg.includes('Fatal') || msg.includes('timed out') || msg.includes('ECONNRESET') || msg.includes('socket hang up');
      if (!isRetryable || attempt === 5) throw err;
      const wait = 8000 + (attempt * 3000);
      console.log(`[IG] Carousel container retry ${attempt + 1}/6: ${msg.substring(0, 80)}. Waiting ${wait / 1000}s...`);
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

  // Step 1: Use token from DB directly (ensureInstagramConnection already exchanges to page token)
  // If upload fails with "must be posted as page", exchange to page token then
  let pageToken = accessToken;
  let needsTokenExchange = false;
  console.log(`[IG] Step 1: Using token from DB (${accessToken.substring(0, 12)}...)`);

  // Step 2: Upload images to FB and get CDN URLs
  console.log(`[IG] Step 2: Uploading ${images.length} images...`);
  const cdnUrls: string[] = [];
  for (let i = 0; i < images.length; i++) {
    const dataUrlMatch = images[i].match(/^data:(image\/\w+);base64,/);
    const detectedMime = dataUrlMatch ? dataUrlMatch[1] : 'image/png';
    const ext = detectedMime === 'image/jpeg' ? 'jpg' : 'png';
    const cleanBase64 = images[i].replace(/^data:image\/\w+;base64,/, '');
    const imageBuffer = Buffer.from(cleanBase64, 'base64');
    const { body, contentType } = buildMultipart({ published: 'false' }, 'source', imageBuffer, `slide_${i}.${ext}`, detectedMime);
    try {
      const uploadResult = await apiWithRetry(() => httpPost(`${API_BASE}/${pageId}/photos?access_token=${pageToken}`, body, { 'Content-Type': contentType, 'Content-Length': body.length.toString() }), `upload-slide-${i}`);
      console.log(`[IG] Uploaded slide ${i}, photo ID: ${uploadResult.id}`);
      const photoInfo = await apiWithRetry(() => httpGet(`${API_BASE}/${uploadResult.id}?fields=images&access_token=${pageToken}`), `cdn-url-${i}`);
      cdnUrls.push(photoInfo.images[0].source);
    } catch (uploadErr: any) {
      const msg = uploadErr?.message || '';
      // If "must be posted as page" — exchange token and retry this upload
      if (!needsTokenExchange && (msg.includes('must be posted') || msg.includes('API [200]'))) {
        needsTokenExchange = true;
        console.log(`[IG] Token needs exchange (error: ${msg.substring(0, 60)}). Exchanging...`);
        const pageData = await apiWithRetry(() => httpGet(`${API_BASE}/${pageId}?fields=access_token&access_token=${accessToken}`), 'get-page-token');
        if (pageData.access_token) {
          pageToken = pageData.access_token;
          console.log(`[IG] Got page token (${pageToken.substring(0, 12)}...)`);
          // Retry this upload with page token
          i--; continue;
        }
      }
      throw uploadErr;
    }
    if (i < images.length - 1) await new Promise(r => setTimeout(r, 2000));
  }

  // Step 3: Create IG media containers
  console.log(`[IG] Step 3: Creating ${cdnUrls.length} media containers...`);
  const containerIds: string[] = [];
  let musicSkipped = false;
  for (let i = 0; i < cdnUrls.length; i++) {
    const containerPayload: Record<string, unknown> = { image_url: cdnUrls[i] };
    if (music && music.music_asset_id && !music.music_asset_id.startsWith('_')) containerPayload.music = music;
    try {
      const container = await apiWithRetry(() => httpPost(`${API_BASE}/${igBusinessId}/media?access_token=${pageToken}`, JSON.stringify(containerPayload), { 'Content-Type': 'application/json' }), `container-${i}`);
      containerIds.push(container.id);
      console.log(`[IG] Container ${i}: ${container.id}`);
    } catch (musicErr: any) {
      if (music && music.music_asset_id) {
        if (!musicSkipped) { console.error(`[Music] API rejected music: ${musicErr.message?.substring(0, 100)}`); musicSkipped = true; }
        const container = await apiWithRetry(() => httpPost(`${API_BASE}/${igBusinessId}/media?access_token=${pageToken}`, JSON.stringify({ image_url: cdnUrls[i] }), { 'Content-Type': 'application/json' }), `container-retry-${i}`);
        containerIds.push(container.id);
      } else throw musicErr;
    }
    if (i < cdnUrls.length - 1) await new Promise(r => setTimeout(r, 1000));
  }

  // Step 3.5: Poll each individual container to FINISHED before creating carousel
  console.log(`[IG] Step 3.5: Polling ${containerIds.length} individual containers to FINISHED...`);
  for (let i = 0; i < containerIds.length; i++) {
    const cid = containerIds[i];
    let finished = false;
    for (let poll = 0; poll < 20; poll++) {
      try {
        const status = await apiWithRetry(() => httpGet(`${API_BASE}/${cid}?fields=status_code&access_token=${pageToken}`), `poll-container-${i}`, 3);
        console.log(`[IG] Container ${i} (${cid.substring(0, 12)}...) status: ${status.status_code} (poll ${poll + 1}/20)`);
        if (status.status_code === 'FINISHED') { finished = true; break; }
        if (status.status_code === 'ERROR') throw new Error(`Container ${i} processing failed with ERROR status`);
        // IN_PROGRESS or other — keep polling
      } catch (pollErr: any) {
        const pollMsg = pollErr?.message || '';
        if (pollMsg.includes('ERROR status')) throw pollErr;
        // Rate limit or transient — retry
        console.log(`[IG] Container ${i} poll error: ${pollMsg.substring(0, 80)}. Retrying...`);
      }
      await new Promise(r => setTimeout(r, 5000));
    }
    if (!finished) throw new Error(`Container ${i} (${cid.substring(0, 12)}...) did not finish processing in time.`);
    if (i < containerIds.length - 1) await new Promise(r => setTimeout(r, 1000));
  }

  // Step 4: Create carousel container (with 9007 retry)
  console.log(`[IG] Step 4: Creating carousel container...`);
  const carouselContainer = await carouselContainerWithRetry(igBusinessId, pageToken, containerIds, caption);
  console.log(`[IG] Carousel container: ${carouselContainer.id}`);

  // Step 5: Wait for carousel processing
  console.log(`[IG] Step 5: Waiting for carousel processing...`);
  let isReady = false;
  for (let attempt = 0; attempt < 10; attempt++) {
    const status = await apiWithRetry(() => httpGet(`${API_BASE}/${carouselContainer.id}?fields=status_code&access_token=${pageToken}`), 'poll-carousel', 3);
    console.log(`[IG] Carousel status: ${status.status_code} (poll ${attempt + 1}/10)`);
    if (status.status_code === 'FINISHED') { isReady = true; break; }
    if (status.status_code === 'ERROR') throw new Error(`Carousel processing failed: ${JSON.stringify(status)}`);
    await new Promise(r => setTimeout(r, 8000));
  }
  if (!isReady) throw new Error('Carousel container did not finish processing in time.');

  // Step 6: Wait before publishing to avoid rate limit, then publish with aggressive retry
  console.log(`[IG] Step 6: Waiting 10s before publish to avoid rate limit...`);
  await new Promise(r => setTimeout(r, 10000));
  const published = await apiWithRetry(() => httpPost(`${API_BASE}/${igBusinessId}/media_publish?access_token=${pageToken}`, JSON.stringify({ creation_id: carouselContainer.id }), { 'Content-Type': 'application/json' }), 'publish', 6);
  console.log(`[IG] Published! ID: ${published.id}`);
  return { postId: published.id, url: `https://www.instagram.com/p/${published.id}/` };
}
// Shared Instagram posting logic — used by both post route and schedule-executor
// Uses fetch() for better Render/Node.js compatibility

const API_VERSION = 'v21.0';
const API_BASE = `https://graph.facebook.com/${API_VERSION}`;

async function fetchPost(url: string, body: Buffer | string, headers: Record<string, string> = {}): Promise<any> {
  const isBuffer = Buffer.isBuffer(body);
  const fetchHeaders: Record<string, string> = { ...headers };
  if (!fetchHeaders['Content-Type']) fetchHeaders['Content-Type'] = 'application/json';
  
  const res = await fetch(url, {
    method: 'POST',
    headers: fetchHeaders,
    body: isBuffer ? new Uint8Array(body) as any : (typeof body === 'string' ? body : JSON.stringify(body)),
    signal: AbortSignal.timeout(60000),
  });
  const data = await res.json();
  if (data.error) {
    const path = new URL(url).pathname;
    throw new Error(`API [${data.error.code}]: ${data.error.message} [POST ${path}]`);
  }
  return data;
}

async function fetchGet(url: string): Promise<any> {
  const res = await fetch(url, { signal: AbortSignal.timeout(45000) });
  const data = await res.json();
  if (data.error) {
    const path = new URL(url).pathname;
    throw new Error(`API [${data.error.code}]: ${data.error.message} [GET ${path}]`);
  }
  return data;
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
      return await fetchPost(`${API_BASE}/${igBusinessId}/media?access_token=${pageToken}`, payload, { 'Content-Type': 'application/json' });
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

  // Step 1: ALWAYS fetch page access token (user token cannot upload unpublished photos)
  console.log(`[IG] Step 1: Fetching page access token...`);
  let pageToken: string;
  try {
    const pageData = await apiWithRetry(() => fetchGet(`${API_BASE}/${pageId}?fields=access_token&access_token=${accessToken}`), 'get-page-token', 3);
    pageToken = pageData.access_token;
    if (!pageToken) throw new Error('Page access_token field is empty in response');
    console.log(`[IG] Got page token (${pageToken.substring(0, 15)}...)`);
  } catch (err: any) {
    throw new Error(`Failed to get page access token: ${err.message}`);
  }

  // Step 2: Upload images to FB and get CDN URLs
  console.log(`[IG] Step 2: Uploading ${images.length} images...`);
  const cdnUrls: string[] = [];
  for (let i = 0; i < images.length; i++) {
    let imageBuffer: Buffer;
    let detectedMime: string;
    let ext: string;

    const img = images[i];
    if (img.startsWith('http')) {
      // Download image from URL
      console.log(`[IG] Downloading image ${i} from URL...`);
      const imgRes = await fetch(img, { signal: AbortSignal.timeout(30000) });
      if (!imgRes.ok) throw new Error(`Failed to download image ${i}: ${imgRes.status}`);
      const contentType = imgRes.headers.get('content-type') || '';
      detectedMime = contentType.includes('jpeg') || contentType.includes('jpg') ? 'image/jpeg' : 'image/png';
      ext = detectedMime === 'image/jpeg' ? 'jpg' : 'png';
      const arrBuf = await imgRes.arrayBuffer();
      imageBuffer = Buffer.from(arrBuf);
    } else {
      // Base64 data URL
      const dataUrlMatch = img.match(/^data:(image\/\w+);base64,/);
      detectedMime = dataUrlMatch ? dataUrlMatch[1] : 'image/png';
      ext = detectedMime === 'image/jpeg' ? 'jpg' : 'png';
      const cleanBase64 = img.replace(/^data:image\/\w+;base64,/, '');
      imageBuffer = Buffer.from(cleanBase64, 'base64');
    }
    const { body, contentType } = buildMultipart({ published: 'false' }, 'source', imageBuffer, `slide_${i}.${ext}`, detectedMime);
    const uploadResult = await apiWithRetry(() => fetchPost(`${API_BASE}/${pageId}/photos?access_token=${pageToken}`, body, { 'Content-Type': contentType, 'Content-Length': body.length.toString() }), `upload-slide-${i}`);
    console.log(`[IG] Uploaded slide ${i}, photo ID: ${uploadResult.id}`);
    const photoInfo = await apiWithRetry(() => fetchGet(`${API_BASE}/${uploadResult.id}?fields=images&access_token=${pageToken}`), `cdn-url-${i}`);
    cdnUrls.push(photoInfo.images[0].source);
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
      const container = await apiWithRetry(() => fetchPost(`${API_BASE}/${igBusinessId}/media?access_token=${pageToken}`, JSON.stringify(containerPayload), { 'Content-Type': 'application/json' }), `container-${i}`);
      containerIds.push(container.id);
      console.log(`[IG] Container ${i}: ${container.id}`);
    } catch (musicErr: any) {
      if (music && music.music_asset_id) {
        if (!musicSkipped) { console.error(`[Music] API rejected music: ${musicErr.message?.substring(0, 100)}`); musicSkipped = true; }
        const container = await apiWithRetry(() => fetchPost(`${API_BASE}/${igBusinessId}/media?access_token=${pageToken}`, JSON.stringify({ image_url: cdnUrls[i] }), { 'Content-Type': 'application/json' }), `container-retry-${i}`);
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
        const status = await apiWithRetry(() => fetchGet(`${API_BASE}/${cid}?fields=status_code&access_token=${pageToken}`), `poll-container-${i}`, 3);
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
    const status = await apiWithRetry(() => fetchGet(`${API_BASE}/${carouselContainer.id}?fields=status_code&access_token=${pageToken}`), 'poll-carousel', 3);
    console.log(`[IG] Carousel status: ${status.status_code} (poll ${attempt + 1}/10)`);
    if (status.status_code === 'FINISHED') { isReady = true; break; }
    if (status.status_code === 'ERROR') throw new Error(`Carousel processing failed: ${JSON.stringify(status)}`);
    await new Promise(r => setTimeout(r, 8000));
  }
  if (!isReady) throw new Error('Carousel container did not finish processing in time.');

  // Step 6: Publish — use Cloudflare Worker proxy to bypass Render IP blocking
  // Direct calls to media_publish from Render datacenter IPs get API [-1]
  console.log(`[IG] Step 6: Publishing carousel ${carouselContainer.id}...`);
  const proxyUrl = process.env.IG_PUBLISH_PROXY_URL;
  const proxySecret = process.env.IG_PUBLISH_PROXY_SECRET || 'default-secret-change-me';
  let published: any;
  if (proxyUrl) {
    console.log(`[IG] Using CF proxy for publish: ${proxyUrl}`);
    published = await apiWithRetry(async () => {
      const res = await fetch(proxyUrl!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${proxySecret}` },
        body: JSON.stringify({ igBusinessId, creationId: carouselContainer.id, accessToken: pageToken }),
        signal: AbortSignal.timeout(60000),
      });
      const data = await res.json();
      if (data.error) throw new Error(`API [${data.error.code}]: ${data.error.message} [PROXY]`);
      return data;
    }, 'publish-proxy', 5);
  } else {
    console.log(`[IG] No proxy configured, publishing directly...`);
    published = await apiWithRetry(() => fetchPost(`${API_BASE}/${igBusinessId}/media_publish?access_token=${pageToken}`, JSON.stringify({ creation_id: carouselContainer.id })), 'publish-direct', 5);
  }
  console.log(`[IG] Published! ID: ${published.id}`);
  return { postId: published.id, url: `https://www.instagram.com/p/${published.id}/` };
}
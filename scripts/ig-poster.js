/**
 * Standalone Instagram poster - spawned by API route as child process.
 * Reads payload JSON from argv[2], outputs result JSON to stdout.
 * Uses native Node.js https module (proven to work with Facebook Graph API).
 */

const https = require('https');
const fs = require('fs');

const payloadPath = process.argv[2];
const outputPath = process.argv[3]; // optional: write result to file instead of stdout
if (!payloadPath) {
  const result = JSON.stringify({ success: false, message: 'No payload path provided' });
 if (outputPath) require('fs').writeFileSync(outputPath, result);
  else console.log(result);
  process.exit(1);
}

let payload;
try {
  payload = JSON.parse(fs.readFileSync(payloadPath, 'utf8'));
} catch (e) {
  console.log(JSON.stringify({ success: false, message: 'Failed to read payload: ' + e.message }));
  process.exit(1);
}

const { accessToken, pageId, igBusinessId, carouselId, caption, username, images, music } = payload;
const API_VERSION = 'v21.0';
const API_BASE = `https://graph.facebook.com/${API_VERSION}`;

function buildMultipart(fields, fileFieldName, fileBuffer, filename, mimeType) {
  const boundary = `----FormBoundary${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const parts = [];

  for (const [key, value] of Object.entries(fields)) {
    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`));
  }

  parts.push(Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="${fileFieldName}"; filename="${filename}"\r\nContent-Type: ${mimeType}\r\n\r\n`
  ));
  parts.push(fileBuffer);
  parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));

  return {
    body: Buffer.concat(parts),
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}

function httpPost(url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const req = https.request(
      {
        hostname: urlObj.hostname,
        port: 443,
        path: urlObj.pathname + urlObj.search,
        method: 'POST',
        headers,
      },
      (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const data = Buffer.concat(chunks).toString('utf8');
          try {
            const json = JSON.parse(data);
            if (json.error) {
              reject(new Error(`API [${json.error.code}]: ${json.error.message}`));
            } else {
              resolve(json);
            }
          } catch {
            reject(new Error(`Non-JSON response (${res.statusCode}): ${data.substring(0, 200)}`));
          }
        });
      }
    );
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function httpGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const data = Buffer.concat(chunks).toString('utf8');
        try {
          const json = JSON.parse(data);
          if (json.error) {
            reject(new Error(`API [${json.error.code}]: ${json.error.message}`));
          } else {
            resolve(json);
          }
        } catch {
          reject(new Error(`Non-JSON response: ${data.substring(0, 200)}`));
        }
      });
    }).on('error', reject);
  });
}

async function main() {
  try {
    // Step 1: Verify token & get page token
    await httpGet(`${API_BASE}/me?fields=id&access_token=${accessToken}`);

    const pageData = await httpGet(
      `${API_BASE}/${pageId}?fields=access_token,instagram_business_account{id,username}&access_token=${accessToken}`
    );
    const pageToken = pageData.access_token;

    if (!pageData.instagram_business_account) {
      throw new Error('Instagram Business Account not linked to Facebook Page.');
    }

    // Step 2: Upload each image to Facebook CDN
    const cdnUrls = [];
    for (let i = 0; i < images.length; i++) {
      const cleanBase64 = images[i].replace(/^data:image\/\w+;base64,/, '');
      const imageBuffer = Buffer.from(cleanBase64, 'base64');

      const { body, contentType } = buildMultipart(
        { published: 'false' },
        'source',
        imageBuffer,
        `slide_${i}.png`,
        'image/png'
      );

      const uploadResult = await httpPost(
        `${API_BASE}/${pageId}/photos?access_token=${pageToken}`,
        body,
        { 'Content-Type': contentType, 'Content-Length': body.length.toString() }
      );

      const photoInfo = await httpGet(`${API_BASE}/${uploadResult.id}?fields=images&access_token=${pageToken}`);
      cdnUrls.push(photoInfo.images[0].source);
    }

    // Step 3: Create IG media containers
    const containerIds = [];
    let musicSkipped = false;
    for (let i = 0; i < cdnUrls.length; i++) {
      const containerPayload: Record<string, unknown> = { image_url: cdnUrls[i] };
      // Add music to carousel items (only real IG asset IDs, not catalog IDs)
      if (music && music.music_asset_id && !music.music_asset_id.startsWith('_')) {
        containerPayload.music = music;
      }
      try {
        const container = await httpPost(
          `${API_BASE}/${igBusinessId}/media?access_token=${pageToken}`,
          JSON.stringify(containerPayload),
          { 'Content-Type': 'application/json' }
        );
        containerIds.push(container.id);
      } catch (musicErr) {
        // If music causes an error, retry without it
        if (music && music.music_asset_id) {
          if (!musicSkipped) {
            console.error(`  [Music] API rejected music, posting without: ${musicErr.message.substring(0, 100)}`);
            musicSkipped = true;
          }
          const retryPayload = { image_url: cdnUrls[i] };
          const container = await httpPost(
            `${API_BASE}/${igBusinessId}/media?access_token=${pageToken}`,
            JSON.stringify(retryPayload),
            { 'Content-Type': 'application/json' }
          );
          containerIds.push(container.id);
        } else {
          throw musicErr;
        }
      }
      if (i < cdnUrls.length - 1) await new Promise(r => setTimeout(r, 1000));
    }

    // Step 4: Create carousel container
    const carouselContainer = await httpPost(
      `${API_BASE}/${igBusinessId}/media?access_token=${pageToken}`,
      JSON.stringify({ media_type: 'CAROUSEL', children: containerIds, caption }),
      { 'Content-Type': 'application/json' }
    );

    // Step 5: Wait for container to be ready
    let isReady = false;
    for (let attempt = 0; attempt < 12; attempt++) {
      const status = await httpGet(
        `${API_BASE}/${carouselContainer.id}?fields=status_code&access_token=${pageToken}`
      );
      if (status.status_code === 'FINISHED') { isReady = true; break; }
      if (status.status_code === 'ERROR') throw new Error('Media processing failed.');
      await new Promise(r => setTimeout(r, 5000));
    }
    if (!isReady) throw new Error('Carousel container did not finish processing in time.');

    // Step 6: Publish
    const published = await httpPost(
      `${API_BASE}/${igBusinessId}/media_publish?access_token=${pageToken}`,
      JSON.stringify({ creation_id: carouselContainer.id }),
      { 'Content-Type': 'application/json' }
    );

    const result = JSON.stringify({
      success: true,
      status: 'done',
      message: `Carousel posted to @${username}!`,
      postId: published.id,
      url: `https://www.instagram.com/p/${published.id}/`,
      timestamp: new Date().toISOString(),
    });
    if (outputPath) require('fs').writeFileSync(outputPath, result);
    else console.log(result);

  } catch (err) {
    const result = JSON.stringify({
      success: false,
      status: 'error',
      message: err.message || 'Failed to post carousel',
      timestamp: new Date().toISOString(),
    });
    if (outputPath) require('fs').writeFileSync(outputPath, result);
    else console.log(result);
    process.exit(1);
  }
}

main();
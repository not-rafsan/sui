// Cloudflare Worker — Instagram Media Publish Proxy
// Bypasses Render IP restrictions by routing the publish call through Cloudflare's network
// Deploy: wrangler deploy (after wrangler login)

export default {
  async fetch(request, env) {
    // Only allow POST
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Use POST' }), { status: 405, headers: { 'Content-Type': 'application/json' } });
    }

    // Simple secret check to prevent abuse
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || authHeader !== `Bearer ${env.PUBLISH_SECRET || 'default-secret-change-me'}`) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }

    try {
      const { igBusinessId, creationId, accessToken } = await request.json();

      if (!igBusinessId || !creationId || !accessToken) {
        return new Response(JSON.stringify({ error: 'Missing igBusinessId, creationId, or accessToken' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }

      // Make the actual publish call to Facebook Graph API
      const fbUrl = `https://graph.facebook.com/v21.0/${igBusinessId}/media_publish?creation_id=${encodeURIComponent(creationId)}&access_token=${encodeURIComponent(accessToken)}`;

      const fbResponse = await fetch(fbUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await fbResponse.json();

      // Return FB's response as-is
      return new Response(JSON.stringify(data), {
        status: fbResponse.status,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
  },
};
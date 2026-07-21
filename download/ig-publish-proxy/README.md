# Instagram Media Publish Proxy

Routes the `media_publish` API call through Cloudflare Workers to bypass
Render's datacenter IP being blocked by Facebook.

## Why

Render free tier runs on datacenter IPs. Facebook returns `API [-1]: Fatal`
on `media_publish` from these IPs, while uploads/containers work fine.
This proxy routes ONLY the publish call through Cloudflare's network.

## Setup (2 minutes)

```bash
# 1. Install Wrangler CLI
npm install -g wrangler

# 2. Login to Cloudflare (creates free account if needed)
wrangler login

# 3. Deploy
wrangler deploy
```

You'll get a URL like: `https://ig-publish-proxy.YOUR-SUBDOMAIN.workers.dev`

## Configure on Render

Add these env vars to your Render service:

| Key | Value |
|-----|-------|
| `IG_PUBLISH_PROXY_URL` | `https://ig-publish-proxy.YOUR-SUBDOMAIN.workers.dev` |
| `IG_PUBLISH_PROXY_SECRET` | Any random string (e.g. `my-s3cr3t-xyz`) |

## How it works

```
Render App                    Cloudflare Worker              Facebook
    |                              |                            |
    |-- POST /publish (proxy) ---->|                            |
    |                              |-- POST /media_publish ---->|
    |                              |<-- { id: "..." } ----------|
    |<-- { id: "..." } ------------|                            |
```

Only the publish step (1 API call) goes through the proxy.
All other calls (uploads, containers, polling) stay direct.
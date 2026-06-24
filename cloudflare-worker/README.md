# EduForge video Worker

This Worker streams videos from a Cloudflare R2 bucket after validating a per-tenant HMAC signature.

## Deploy

```bash
cd cloudflare-worker
npm i -g wrangler
wrangler login
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
wrangler deploy
```

After deploy, copy the Worker URL (e.g. `https://eduforge-video.<account>.workers.dev`) and:

1. Save it in your app env as `R2_WORKER_URL` (server-side; used as fallback).
2. Or set it per-tenant in `platform_settings.r2_public_worker_url`.

## Required server env (Lovable / hosting)

| Name | Purpose |
| --- | --- |
| `R2_ACCOUNT_ID` | Cloudflare account ID |
| `R2_ACCESS_KEY_ID` | R2 S3 API access key |
| `R2_SECRET_ACCESS_KEY` | R2 S3 API secret |
| `R2_BUCKET` | R2 bucket name (e.g. `eduforge-videos`) |
| `R2_WORKER_URL` | Deployed Worker base URL |

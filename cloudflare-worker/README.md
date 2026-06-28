# EduForge video Worker

This Worker is the single entry point for all video traffic: it accepts uploads
from the browser, talks to its bound R2 bucket on the app's behalf, and streams
playback back with Range support. The Lovable app never needs R2 S3
credentials — only the deployed Worker URL.

## Deploy

```bash
cd cloudflare-worker
npm i -g wrangler
wrangler login
wrangler secret put SUPABASE_SERVICE_ROLE_KEY   # used for optional playback signature checks
wrangler deploy
```

After deploy, copy the Worker URL (e.g. `https://raspy-math-67fd.jawarnehm145.workers.dev`) and save it in the app as the `R2_WORKER_URL` secret (already set).

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/upload?key&contentType` | Single-shot upload (file is the request body) |
| POST | `/upload/start?key&contentType` | Begin multipart, returns `{ uploadId, key }` |
| PUT  | `/upload/part?key&uploadId&partNumber` | Upload one part, returns `{ partNumber, etag }` |
| POST | `/upload/complete` | Body `{ key, uploadId, parts }` — finalize |
| POST | `/upload/abort` | Body `{ key, uploadId }` |
| GET  | `/video/:key` or `/?key=` | Stream with Range support |

Keys must look like `tenants/<tenantId>/videos/<uuid>.<ext>` — the Worker
rejects any other shape to prevent writes outside a tenant prefix.

## Required Worker bindings/secrets

| Name | Type | Purpose |
| --- | --- | --- |
| `R2_BUCKET` | R2 binding | The bucket Worker reads/writes (see `wrangler.toml`) |
| `SUPABASE_URL` | var | Used to look up per-tenant playback secret |
| `SUPABASE_SERVICE_ROLE_KEY` | secret | Used to look up per-tenant playback secret |

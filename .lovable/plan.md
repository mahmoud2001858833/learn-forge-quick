# خطة ربط رفع وتشغيل الفيديو عبر Cloudflare Worker فقط

سنحوّل تدفّق الفيديو ليعتمد كلياً على Worker (`https://raspy-math-67fd.jawarnehm145.workers.dev`)، بدون أي مفاتيح R2 على جهة التطبيق. الـ Worker وحده يتكلّم مع R2.

## 1) إعادة كتابة الـ Worker (`cloudflare-worker/src/index.ts`)

Endpoints جديدة (كلها تتعامل مع `R2_BUCKET` binding):

- `POST /upload` — رفع ملف صغير (≤ 100MB) كملف واحد. Body = الملف الخام. Query: `key`, `contentType`. يرجع `{ ok, key }`.
- `POST /upload/start` — بدء Multipart. Query: `key`, `contentType`. ينشئ multipart upload عبر `R2_BUCKET.createMultipartUpload(key)` ويرجع `{ uploadId, key }`.
- `PUT /upload/part?uploadId=...&key=...&partNumber=N` — رفع جزء (10MB). Body = البايتات. يستخدم `mpu.uploadPart(N, body)` ويرجع `{ partNumber, etag }`.
- `POST /upload/complete` — Body JSON `{ key, uploadId, parts: [{partNumber, etag}] }`. يستدعي `mpu.complete(parts)` ويرجع `{ ok, key }`.
- `POST /upload/abort` — إلغاء multipart.
- `GET /video/{key}` و `GET /?key=...` — بثّ من R2 مع دعم Range، CORS، caching.
- `OPTIONS *` — CORS preflight.

ملاحظات أمان: نُبقي قيد المفتاح بصيغة `tenants/<tenantId>/videos/<uuid>.<ext>` (يُولَّد على الخادم لدينا، ليس من العميل). للتشغيل: نُبقي توقيع HMAC الحالي اختيارياً (`u`, `e`, `s`) للوصول إلى الفيديوهات المدفوعة، ونرجع 403 إذا فشل، مع إمكانية تعطيل الفحص لاحقاً لكل tenant عبر `platform_settings.r2_public_worker_url`.

سيتم نشر هذا الـ Worker من قِبل المستخدم (`wrangler deploy`) — لا يلزم سواه.

## 2) إعدادات على التطبيق

- إزالة الاعتماد على `R2_ACCOUNT_ID/R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY/R2_BUCKET` في الكود (نُبقي ملف `r2-sigv4.server.ts` لكن لا نستدعيه).
- استخدام `R2_WORKER_URL` فقط (مع fallback إلى `platform_settings.r2_public_worker_url` لكل منصّة).
- إضافة سرّ `R2_WORKER_URL = https://raspy-math-67fd.jawarnehm145.workers.dev` عبر `add_secret`.

## 3) Server functions الجديدة (`src/lib/video.functions.ts`)

نُبسّط الدوال — لا توقيع S3 بعد الآن:

- `initVideoUpload({ tenantId, filename, mimeType, sizeBytes, ... })` → يتحقق من صلاحية الـ admin، ينشئ صفّاً في `video_assets` بـ `status='uploading'`، يولّد `r2_key` ويرجع `{ assetId, key, workerUrl, mode: size<=100MB ? 'single' : 'multipart' }`.
- `completeVideoUpload({ assetId })` → يضع `status='ready'` بعد أن يبلّغ العميل بنجاح الرفع.
- `abortVideoUpload({ assetId })` → `status='failed'`.
- `getPlaybackUrl({ assetId })` → يبني `{ workerUrl }/video/{key}?u=&e=&s=` بنفس آلية HMAC الحالية (تبقى كما هي).

يُحذف `signVideoPart` لأن التوقيع لم يعد ضرورياً (الـ Worker يستقبل الأجزاء مباشرة).

## 4) واجهة الرفع (`src/components/video-uploader.tsx`)

تدفّق ذكي حسب الحجم:

```text
file.size ≤ 100MB ──► POST {worker}/upload?key=…&contentType=…   (body = الملف)
file.size  > 100MB ──► POST {worker}/upload/start
                      └► PUT  {worker}/upload/part  × N parts (10MB، توازٍ 3)
                      └► POST {worker}/upload/complete
```

- حجم الجزء ثابت 10MB.
- شريط تقدّم + نسبة مئوية.
- عرض: حجم الملف، البايتات المرفوعة، السرعة (MB/s محسوبة من نافذة زمنية متحرّكة)، الوقت المتبقّي (ETA).
- زر إلغاء (يستدعي `/upload/abort` للملفات الكبيرة + `abortVideoUpload`).
- إعادة المحاولة التلقائية لكل جزء حتى 3 مرات مع backoff؛ إن فشل بعدها يُعرض زرّ "إعادة المحاولة" لذلك الجزء فقط بدون إعادة رفع ما اكتمل.

## 5) المشغّل (`src/components/video-player.tsx`)

يبقى كما هو — يستهلك `getPlaybackUrl` ويشغّل من رابط الـ Worker مباشرة (الـ Worker يدعم Range أصلاً).

## 6) قاعدة البيانات

لا حاجة لتغيير المخطط؛ جدول `video_assets` لديه `r2_key`, `upload_id`, `status` — كافٍ. حقل `upload_id` يُستخدم فقط داخل الواجهة أثناء الجلسة (لن نُخزّنه إلا لو احتجنا استكمال لاحقاً — اختياري).

## 7) خطوات النشر للمستخدم

1. ينسخ كود الـ Worker الجديد إلى مشروعه ويشغّل `wrangler deploy`.
2. التطبيق يستخدم تلقائياً `R2_WORKER_URL` الذي سنضيفه كسرّ.
3. لا حاجة لأي مفاتيح R2 إضافية.

## الملفات التي ستتغيّر

- `cloudflare-worker/src/index.ts` — إعادة كتابة كاملة.
- `cloudflare-worker/README.md` — تحديث التعليمات (إزالة ذكر مفاتيح S3).
- `src/lib/video.functions.ts` — تبسيط (حذف توقيع S3).
- `src/components/video-uploader.tsx` — تدفّق ذكي + قياس السرعة/ETA + إعادة المحاولة.
- إضافة سرّ `R2_WORKER_URL`.

هل أبدأ التنفيذ بهذه الخطة؟

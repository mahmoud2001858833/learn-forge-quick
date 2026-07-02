
## خطة التحسينات الشاملة (10 محاور)

### 1) الصور الديناميكية عبر Supabase Transform
- إنشاء `src/lib/image.ts` بدالة `optimizedImage(url, { width, quality, format })` تُرجع رابط `/storage/v1/render/image/public/...` مع بارامترات `?width=&quality=&format=webp` — تعمل فقط على روابط Supabase Storage وتُعيد الرابط كما هو للروابط الخارجية.
- استخدامها في `CourseCard` (كل الأنماط الستة) بأحجام: 600w للأنماط 1/2، 200w للنمط 3 (horizontal)، 400w للنمط 6.
- استخدامها في `TenantHero` للصورة الرئيسية بحجم 1200w.

### 2) LCP hero preload
- في `src/routes/t.$slug.index.tsx` داخل `head()`: إضافة `links: [{ rel: "preload", as: "image", href: optimizedImage(hero, 1200), fetchpriority: "high" }]` عندما تتوفر `hero_image_url`.
- تمرير `fetchpriority="high"` و`loading="eager"` لصورة الـHero في `TenantHero` فقط (وليس lazy).

### 3) قياس أداء `tenant_home_bundle`
- تشغيل `EXPLAIN (ANALYZE, BUFFERS)` عبر `supabase--read_query`.
- إذا > 100ms: إنشاء migration بـ `MATERIALIZED VIEW tenant_stats_mv` (courses_count, enrollments_count per tenant) + دالة `refresh_tenant_stats_mv()` + جدولة pg_cron كل 5 دقائق + تعديل `tenant_home_bundle` لقراءة الإحصائيات من الـMV.
- إذا < 100ms: تخطّي (يُوفر تعقيد بلا فائدة).

### 4) Bundle size — عزل recharts عن الصفحات العامة
- التحقق أنّ `recharts` مستخدَم فقط في `admin.$tenantSlug.reports.tsx` و`ui/chart.tsx`.
- تحويل استيراد المكونات الثقيلة داخل `reports.tsx` إلى `React.lazy` مع `Suspense fallback`.
- تشغيل `bunx vite-bundle-visualizer` لتوليد `stats.html` والتحقق من عدم تسرّب recharts للـ initial chunk.

### 5) Prefetch على hover
- التحقق أن `router.defaultPreload="intent"` و`defaultPreloadStaleTime: 0` — مفعّل مسبقًا.
- مراجعة أن كل `<Link>` في القوائم العامة يستعمل `to` type-safe (لا `<a href>`) — فحص `TenantHero` والقوائم.
- لا تعديل إن كل شيء صحيح.

### 6) Brotli & HTTP/2
- Cloudflare Workers يفعّلهما تلقائيًا — إضافة تعليق توثيق في `vite.config.ts` فقط + تأكيد `build.cssMinify: "lightningcss"` و`build.minify` تركهما على الافتراضي.
- لا تغييرات كود.

### 7) Virtual scrolling
- التحقق من عدد الدورات الحالي في أكبر tenant عبر `supabase--read_query`.
- إذا وُجد tenant واحد على الأقل > 50 دورة: تثبيت `@tanstack/react-virtual` وتحديث `t.$slug.courses.index.tsx` لعرض `useVirtualizer` عندما `courses.length > 50`.
- إذا لا: توثيق فقط في تعليق بالملف (بدون تثبيت مكتبة زائدة).

### 8) Web Vitals RUM
- `bun add web-vitals`.
- إنشاء `src/lib/rum.ts` يستدعي `onCLS/onLCP/onINP/onTTFB` ويرسل إلى endpoint `/api/public/hooks/rum` (server route جديد يخزّن في جدول `landing_events` الموجود أو جدول `web_vitals` جديد).
- migration: جدول `web_vitals(id, metric, value, rating, url, user_agent, tenant_slug, created_at)` + GRANT + RLS (INSERT مفتوح للجميع، SELECT للـadmin فقط).
- استدعاء `initRUM()` من `src/routes/__root.tsx` داخل `useEffect`.

### 9) Service Worker (PWA) — Offline
- استخدام skill/pwa الرسمي: `bun add -D vite-plugin-pwa`.
- تكوين `vite.config.ts` بـ `VitePWA({ registerType: "autoUpdate", injectRegister: null, devOptions: { enabled: false }, workbox: { navigateFallback: null, runtimeCaching: [NetworkFirst للنافيغيشن، CacheFirst للأصول الهاش] } })`.
- إنشاء `src/lib/register-sw.ts` مع الحرّاس (dev، iframe، preview hosts، `?sw=off`).
- إنشاء `public/manifest.webmanifest` + أيقونات (192, 512).
- استدعاء `registerSW()` من `__root.tsx`.

### 10) Supabase Pooler
- Cloudflare Workers = serverless — التحقق من `.env` أن `SUPABASE_URL` يشير للـpooler (port 6543) وليس direct (5432).
- Supabase Data API (PostgREST) يستخدم HTTP لا يحتاج pooler.
- توثيق للمستخدم: server functions تستعمل `SUPABASE_URL` (HTTPS/PostgREST) — لا يوجد اتصال Postgres مباشر → لا حاجة لتغيير.

---

### ترتيب التنفيذ (5 مراحل)
1. **قياس أولاً**: EXPLAIN + bundle-visualizer + عدد الدورات → تقرير للمستخدم.
2. **الصور + LCP preload** (المرحلة الأعلى تأثيرًا على UX).
3. **Web Vitals RUM** (migration + جدول + endpoint + init).
4. **Code splitting recharts + Virtual scrolling** (بناءً على نتائج المرحلة 1).
5. **PWA + توثيق Brotli/Pooler/Prefetch**.

---

### الملفات المتوقع تعديلها/إنشاؤها
- جديد: `src/lib/image.ts`, `src/lib/rum.ts`, `src/lib/register-sw.ts`, `src/routes/api/public/hooks/rum.ts`, `public/manifest.webmanifest`, `public/pwa-192.png`, `public/pwa-512.png`
- تعديل: `src/components/course-card.tsx`, `src/components/tenant/tenant-hero.tsx`, `src/routes/t.$slug.index.tsx`, `src/routes/t.$slug.courses.index.tsx`, `src/routes/__root.tsx`, `src/routes/_authenticated/admin.$tenantSlug.reports.tsx`, `vite.config.ts`
- migrations: MV للإحصائيات (شرطي) + جدول `web_vitals`
- حزم جديدة: `web-vitals`, `vite-plugin-pwa` (dev), `@tanstack/react-virtual` (شرطي)

### ملاحظات
- المرحلة 3 (MV) و7 (virtual) شرطيتان — سأعرض النتائج قبل التنفيذ.
- PWA تعمل فقط في published، ليس في preview (بحسب skill).
- لن ألمس ملفات auth أو RLS الحالية.

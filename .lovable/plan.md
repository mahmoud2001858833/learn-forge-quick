# خطة تحسين شامل لأداء المنصة

الهدف: تسريع أول تحميل (LCP/TTFB)، تقليل حجم الجافاسكربت، تسريع استعلامات قاعدة البيانات، تحسين الصور والفيديو، وتقوية البنية التحتية.

---

## 1) السيرفر والـ SSR (أهم مكسب للسرعة)

المشكلة الحالية: كل الصفحات العامة (`/t/$slug`, `/courses`, `/courses/$slug`) تفتح فارغة ثم تجلب البيانات عبر `useQuery` من المتصفح → شاشة بيضاء ثواني + waterfalls.

- تحويل الاستعلامات الأساسية لكل صفحة عامة إلى **loader** يعمل على السيرفر باستخدام `queryClient.ensureQueryData` + `useSuspenseQuery`.
- استخدام **server publishable client** (SUPABASE_PUBLISHABLE_KEY) داخل server functions للصفحات العامة → SSR HTML جاهز + SEO أقوى.
- إضافة `staleTime` مناسب لكل استعلام (5–30 دقيقة للتينانت، 60 ثانية للدورات، إلخ) لتقليل الجلب المتكرر.
- تفعيل `defaultPreload: "intent"` مع `defaultPreloadStaleTime: 0` في `router.tsx`.

## 2) قاعدة البيانات (Supabase)

- **فهارس (Indexes)** على الأعمدة الأكثر استعلاماً:
  - `courses(tenant_id, status, created_at DESC)`
  - `courses(tenant_id, slug)` — فريد
  - `enrollments(student_id, tenant_id)`, `enrollments(course_id)`
  - `lessons(section_id, order_index)`, `sections(course_id, order_index)`
  - `notifications(user_id, is_read, created_at DESC)`
  - `xp_events(tenant_id, user_id, created_at)`
- تقليص `select("*")` إلى الأعمدة الفعلية (خصوصاً `tenants`, `courses`, `platform_settings`).
- تشغيل `supabase--slow_queries` لتحديد أبطأ الاستعلامات وإضافة فهارس مستهدفة.
- تحويل الاستعلامات المتعدّدة على نفس الصفحة إلى **RPC واحدة** ترجع JSON (مثال: `tenant_home_bundle(slug)` تُرجع التينانت + أبرز الدورات + الإحصاءات دفعة واحدة).

## 3) تقسيم الحزمة (Code Splitting)

- إزالة أي `export function ...Component` من ملفات الروت (يمنع الـ auto-split).
- تحميل مكونات ثقيلة عبر `React.lazy` أو `.lazy.tsx`: مشغّل الفيديو، رافع الفيديو، لوحات الأدمن (courses.$courseId 507 سطر، settings 439، reports 405، onboard 496).
- تقسيم الحزم الكبيرة داخل لوحة الأدمن (charts/recharts) لتحميلها فقط عند فتح التقارير.

## 4) الصور والوسائط

- استخدام صور واجهة (hero/covers) عبر Cloudflare Image transformations أو `?format=webp&width=…` مع `srcset` و `sizes`.
- `loading="lazy"` و `decoding="async"` على كل صور القوائم، و `fetchpriority="high"` + `preload` لصورة الـ LCP في الصفحة الرئيسية للتينانت.
- ضغط شعارات المتاجر و covers قبل الرفع (حد 300KB) عبر canvas في `video-uploader`/بورت رفع الصور.
- تحسين مشغّل الفيديو: HLS تدريجي إن أمكن، `preload="metadata"`، thumbnail poster جاهز.

## 5) الشبكة والـ Caching

- إضافة `Cache-Control` headers للـ server routes العامة (`/api/public/...`) و SSR HTML للصفحات العامة (`s-maxage=60, stale-while-revalidate=300`).
- تفعيل HTTP/2 push للأصول الحرجة عبر `<link rel="preload">` في `head()` للصفحات المهمة.
- ضغط الاستجابات (Brotli — Cloudflare يفعّله تلقائياً، نتأكد من عدم كسر ذلك).

## 6) تحسينات React

- إضافة `React.memo` للـ `CourseCard` وأي عنصر يتكرر في قوائم كبيرة.
- استخدام `useMemo`/`useCallback` في صفحة `t.$slug.courses.index` (الفلاتر تعيد الحساب على كل ضغطة).
- إزالة استعلامات مكررة (مثل `public-tenant` يعمل في كل صفحة تينانت — نقله لـ layout `t.$slug.tsx` مع `context`).

## 7) الأمان والاستقرار (Infrastructure)

- إضافة **rate limiting** خفيف على `/api/public/*` (verify signature + max req/min per IP).
- مراجعة سياسات RLS لضمان عدم وجود سياسات مكلفة تحتوي `EXISTS` على جداول بدون فهارس.
- إعداد **error monitoring** موحّد (نتأكد أن `reportLovableError` يلتقط الأخطاء غير المعالجة).
- إضافة **health check** `/api/public/health` يفحص Supabase + R2.

## 8) ملفات وأدوات

- `vite-imagetools` للصور المستوردة كأصول (hero/marketing).
- مراجعة الحزم غير المستخدمة في `package.json` وحذفها.
- تفعيل `sideEffects: false` (موجود) — التأكد من عدم استيراد CSS عالمي في مكونات صغيرة.

---

## خطة التنفيذ (مراحل)

1. **Migration للفهارس** + RPC مجمّعة (`tenant_home_bundle`, `course_page_bundle`).
2. تحويل الروتات العامة (`t.$slug.index`, `t.$slug.courses.index`, `t.$slug.courses.$courseSlug`) إلى SSR loader + Suspense.
3. تحسين React (memo/lazy) وتقسيم لوحة الأدمن.
4. تحسين الصور + preload LCP.
5. Caching headers + health check.

---

## ملاحظات تقنية

- سيتم إنشاء server functions تحت `src/lib/*.functions.ts` باستخدام `createServerFn` + supabase publishable client.
- كل RPC جديدة في migration منفصلة (SECURITY DEFINER، `search_path=public`).
- لا كسر للسلوك الحالي — التغييرات تدريجية وقابلة للتراجع.

هل أبدأ بالتنفيذ؟ أو تفضّل مرحلة محددة أولاً (مثلاً: الفهارس + SSR فقط)؟

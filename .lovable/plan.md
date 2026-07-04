# خطة التنفيذ متعددة المراحل

المشروع كبير جداً لجولة واحدة. سنقسمه إلى **5 مراحل** كل واحدة برسالة/جولة مستقلة قابلة للاختبار قبل الانتقال للتالية.

---

## المرحلة 1 — تدفق إنشاء المنصة الفوري (سريعة، أساس لباقي المراحل)

**الهدف:** بعد "أنشئ منصتك مجاناً" + تسجيل الدخول → معالج فوري → لوحة التحكم مباشرة.

- حذف صفحة `src/routes/_authenticated/onboard.new-tenant.tsx` والاستعاضة عنها بفتح `CreateTenantWizard` كـ Dialog مباشرة على `/dashboard` عند عدم وجود منصة للمستخدم.
- CTA "أنشئ منصتك مجاناً" في الصفحة الرئيسية `/` :
  - إذا غير مسجل → `/auth?intent=create-tenant`
  - إذا مسجل بدون منصة → `/dashboard?wizard=1` (يفتح المعالج تلقائياً)
  - إذا مسجل وله منصة → `/admin/<slug>`
- بعد إنشاء المنصة (`createTenant.onSuccess`) → توجيه لـ `/admin/<slug>` مباشرة (موجود، فقط نتأكد).
- إزالة أي روابط تشير إلى `/onboard/new-tenant`.

---

## المرحلة 2 — نظام أدوار معلم/طالب على مستوى المنصة

**الهدف:** كل منصة لها تسجيلها الخاص. طالب يوصل فوراً. معلم يسجّل بس ينتظر موافقة الأدمن.

### قاعدة البيانات (migration واحدة)
- إضافة قيمة `pending_instructor` إلى `tenant_role` enum (بجانب owner/admin/instructor/student).
- عمود `applied_role` و `application_note` و `approved_at` و `approved_by` على `tenant_members`.
- RPC `apply_to_tenant(_tenant_id, _role, _note)`:
  - إذا `_role = 'student'` → insert بدور `student` فوراً.
  - إذا `_role = 'instructor'` → insert بدور `pending_instructor` مع `applied_role='instructor'`.
- RPC `approve_instructor(_tenant_id, _user_id)` و `reject_instructor(...)` (أدمن المنصة فقط).
- Trigger إشعار للأدمن عند طلب معلم جديد، وللمعلم عند الموافقة/الرفض.
- سياسات RLS: `pending_instructor` ما يشوف صفحات المعلم إلا بعد الموافقة.

### الواجهة
- `/t/$slug/auth` (موجودة) → إضافة اختيار "طالب/معلم" في التسجيل + حقل ملاحظة اختياري للمعلم.
- بعد التسجيل: طالب → `/t/$slug` (يقدر يشتري كورسات). معلم pending → صفحة "طلبك قيد المراجعة".
- لوحة أدمن جديدة: `/admin/$tenantSlug/instructors` (طلبات + معلمون معتمدون + موافقة/رفض).
- **لوحة معلم مستقلة**: `/teacher/$tenantSlug/*` (كورساتي، طلابي، تصحيح واجبات، جلسات لايف). حماية بـ `has_tenant_role(user, tenant, ['instructor','owner','admin'])`.
- **واجهة طالب مستقلة**: `/t/$slug/me/*` (كورساتي، شهاداتي، تقدمي، دفعاتي) — مبسّطة بدون تعقيدات الأدمن.

---

## المرحلة 3 — حصة تخزين الفيديو (10GB افتراضي، قابلة للتخصيص)

### قاعدة البيانات
- عمود `storage_quota_bytes bigint default 10737418240` على `tenants`.
- عمود `storage_used_bytes bigint default 0` على `tenants`.
- Trigger على `video_assets` (بعد `bytes` يصير معروف بعد اكتمال الرفع): يزيد/ينقص `storage_used_bytes`.
- RPC `check_storage_quota(_tenant_id, _incoming_bytes)` → يرجع boolean.
- تعديل `initVideoUpload` في `src/lib/video.functions.ts`: يرفض الرفع إذا `used + size > quota`.
- سوبر-أدمن يقدر يعدّل الحصة من `/super-admin` (حقل رقمي على كل منصة).

### الواجهة
- كارت "التخزين" في `/admin/$tenantSlug` الرئيسية + صفحة `/admin/$tenantSlug/storage`:
  - Progress bar (مستخدم/إجمالي)، جدول فيديوهات مع أحجامها، زر حذف.
  - تحذير بصري > 80%، حظر الرفع = 100%.

---

## المرحلة 4 — إعادة تصميم لوحة التحكم + قوالب مظهر المنصة

### 4أ — لوحة تحكم احترافية
- Sidebar جديد (shadcn `Sidebar` مع `collapsible="icon"`) بأقسام مجمعة: نظرة عامة / المحتوى / الطلاب / المدفوعات / التسويق / الإعدادات.
- هيدر ثابت مع بحث سريع، إشعارات، ملف شخصي.
- كروت إحصائيات محسّنة (Motion على الأرقام، رسوم Sparkline).
- Skeleton loaders + prefetch على hover (موجود جزئياً).
- Dark/light mode toggle.

### 4ب — محرّر مظهر المنصة (Theme Editor)
صفحة جديدة `/admin/$tenantSlug/appearance`:
- 4-5 قوالب جاهزة (Modern / Classic / Bold / Minimal / Academic) مع معاينة حية.
- تخصيص: ألوان أساسية/ثانوية، خط (مجموعة خطوط عربية جاهزة)، شكل الهيرو (3 خيارات)، ترتيب الأقسام (drag).
- حفظ إلى `tenants.theme_config jsonb` جديد + استخدامها في `t.$slug.tsx`.

---

## المرحلة 5 — تحسين شامل للأداء والصور

### أداء
- تحويل صفحات ثقيلة إلى loaders مع `ensureQueryData` + `useSuspenseQuery`.
- تقليل حجم bundle: `manualChunks` لـ recharts, framer-motion, tiptap.
- Prefetch على hover موجود، إضافة `defaultPreloadStaleTime: 30_000`.
- تحسين استعلامات RPC (تجميع calls متعددة في bundle واحد).
- إضافة indexes مفقودة على أعمدة الفلترة الأكثر استخداماً.

### الصور
- سيرفر روت `/api/img/$` بـ Cloudflare Image Resizing (متاح بالفعل على Workers) بدلاً من sharp.
- تحويل تلقائي WebP/AVIF مع `<picture>` element.
- `loading="lazy"` + `decoding="async"` على كل الصور غير LCP.
- رفع الصور مع ضغط client-side (browser-image-compression) قبل الرفع لـ Supabase Storage.
- Preload صور LCP لكل صفحة عبر `head().links`.

---

## نقاط تقنية مهمة

- كل جدول جديد بحاجة GRANT + RLS + سياسات owner-read كما في `public-schema-grants`.
- `pending_instructor` يحتاج سياسات RLS صريحة تمنع الوصول للمحتوى الحساس.
- تعديل `types.ts` تلقائي بعد كل migration — لا نلمسه يدوياً.
- Cloudflare Image Resizing يتطلب تفعيل من dashboard Cloudflare — سنبلّغ المستخدم إذا احتاج.

---

## البدء

بعد موافقتك على الخطة، سأنفذ **المرحلة 1 فقط** في الجولة التالية (سريعة، تعديلات frontend فقط) وأعرضها لك للاختبار قبل الانتقال للمرحلة 2. هل نبدأ بالمرحلة 1؟ أو تفضّل ترتيب مختلف (مثلاً نبدأ بالمرحلة 3 التخزين أو المرحلة 4 التصميم)؟
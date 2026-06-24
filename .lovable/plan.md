
# خطة البناء — EduForge MVP (Multi-tenant)

## القرارات المعتمدة
- **Multi-tenant من البداية** (كل منصة معزولة بـ `tenant_id` + RLS)
- **Supabase خارجي** (حسابك الخاص — سيتم ربطه عبر تكامل Supabase في Lovable)
- بدون AI / بدون بث مباشر / بدون دومينات مخصصة في هذه المرحلة

## ما قبل البدء (مطلوب منك)
1. **ربط Supabase الخارجي**: من Lovable → Integrations → Supabase → أدخل بيانات مشروعك (URL + Service Role Key). بدون هذه الخطوة لا يمكنني إنشاء قاعدة البيانات.
2. (لاحقاً) Stripe — لمّا نوصل لمرحلة الدفع.

---

## نطاق المرحلة الأولى (Phase 1)

### قاعدة البيانات (Supabase + RLS صارم على tenant_id)

```text
tenants            (id, slug, name, logo_url, primary_color, plan, status, owner_id)
profiles           (id → auth.users, full_name, avatar_url)
tenant_members     (tenant_id, user_id, role: owner|instructor|student)
user_roles         (user_id, role: super_admin)  -- منفصل للأمان
courses            (id, tenant_id, instructor_id, title, slug, description, price, cover_url, status)
sections           (id, course_id, title, order_index)
lessons            (id, section_id, title, type: video|text|pdf, content_url, duration, order_index)
enrollments        (id, tenant_id, course_id, student_id, progress, completed_at)
lesson_progress    (enrollment_id, lesson_id, watched_seconds, completed)
```

كل جدول له `tenant_id` + RLS policy تتحقق عبر `has_tenant_access(auth.uid(), tenant_id)` (دالة SECURITY DEFINER).

### الواجهات (Routes)

```text
/                            صفحة EduForge الرئيسية (تسويقية)
/auth                        تسجيل دخول/إنشاء حساب
/onboarding                  إنشاء أول منصة (slug, name, logo, لون)
/t/$slug                     الواجهة العامة للمنصة (متجر الدورات)
/t/$slug/courses/$courseSlug صفحة الدورة + زر التسجيل
/_authenticated/
  dashboard                  لوحة الطالب (دوراتي + التقدم)
  learn/$enrollmentId        مشغل الفيديو + قائمة الدروس
  admin/$tenantSlug/
    overview                 إحصائيات سريعة
    courses                  إدارة الدورات + الفصول + الدروس (CRUD)
    students                 قائمة الطلاب
    settings                 إعدادات المنصة (هوية بصرية)
```

### الأدوار في Phase 1
- **Tenant Owner**: ينشئ المنصة، يدير الدورات والطلاب
- **Student**: يسجل، يتصفح، يلتحق بدورة (مجاناً الآن)، يشاهد، يتتبع تقدمه
- (Super Admin و Instructor منفصل — يُؤجلان لـ Phase 2)

### الميزات المؤجلة لمراحل قادمة
| ميزة | المرحلة |
|------|---------|
| Stripe + الدفع | Phase 1.5 (بعد نجاح الـ MVP الأساسي) |
| دومينات مخصصة | Phase 2 |
| AI Tutor + التفريغ | Phase 2 |
| بث مباشر + اختبارات | Phase 3 |
| Multi-instructor + Affiliate | Phase 3 |

---

## تقدير الكريدتس لهذه المرحلة
**400–600 credit** تقريباً (multi-tenant من البداية أكلف من single-tenant بـ ~30%).

## الخطوة التالية بعد موافقتك
1. تربط Supabase الخارجي.
2. أبدأ بإنشاء: schema + RLS → صفحة auth → onboarding → dashboard المنصة → إدارة الدورات → مشغل الفيديو → الواجهة العامة.

**هل تعتمد هذه الخطة لأبدأ التنفيذ؟**

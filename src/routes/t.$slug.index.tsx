import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CourseCard } from "@/components/course-card";
import { Button } from "@/components/ui/button";
import { GraduationCap, ArrowLeft, Sparkles, Users, BookOpen, Award, Star } from "lucide-react";

export const Route = createFileRoute("/t/$slug/")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.slug} — منصة تعليمية` },
      { name: "description", content: `تصفّح الدورات المنشورة على منصة ${params.slug}.` },
      { property: "og:title", content: `${params.slug}` },
      { property: "og:type", content: "website" },
    ],
  }),
  component: TenantHome,
});

function TenantHome() {
  const { slug } = useParams({ from: "/t/$slug/" });

  const { data: tenant } = useQuery({
    queryKey: ["public-tenant", slug],
    queryFn: async () => (await supabase.from("tenants").select("*").eq("slug", slug).single()).data,
  });

  const { data: courses } = useQuery({
    queryKey: ["public-courses-featured", tenant?.id],
    enabled: !!tenant,
    queryFn: async () => {
      const { data } = await supabase
        .from("courses")
        .select("id, slug, title, short_description, description, cover_url, price, is_free, ad_style, students_count, total_duration_seconds, college_id, major_id, average_rating")
        .eq("tenant_id", tenant!.id)
        .eq("status", "published")
        .order("students_count", { ascending: false })
        .limit(6);
      return data ?? [];
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["tenant-public-stats", tenant?.id],
    enabled: !!tenant,
    queryFn: async () => {
      const [coursesCount, enrollmentsCount] = await Promise.all([
        supabase.from("courses").select("id", { count: "exact", head: true }).eq("tenant_id", tenant!.id).eq("status", "published"),
        supabase.from("enrollments").select("id", { count: "exact", head: true }).eq("tenant_id", tenant!.id),
      ]);
      return {
        courses: coursesCount.count ?? 0,
        students: enrollmentsCount.count ?? 0,
      };
    },
  });

  if (!tenant) return null;
  const primary = tenant.primary_color ?? "#6366f1";
  const secondary = tenant.secondary_color ?? "#D4AF37";

  return (
    <div>
      {/* HERO — logo + decorations on left, description on right (RTL) */}
      <section className="relative overflow-hidden">
        {/* Animated background gradient */}
        <div
          className="absolute inset-0 opacity-[0.08]"
          style={{
            background: `radial-gradient(circle at 20% 30%, ${primary} 0%, transparent 50%), radial-gradient(circle at 80% 70%, ${secondary} 0%, transparent 50%)`,
          }}
        />
        <div className="absolute inset-0 bg-grid-pattern opacity-[0.03]" />

        <div className="container mx-auto px-6 py-16 md:py-24 relative">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Right column (RTL first): description + CTAs */}
            <div className="space-y-6 order-2 lg:order-1">
              <div
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium border"
                style={{ borderColor: `${primary}40`, color: primary, background: `${primary}10` }}
              >
                <Sparkles className="h-3 w-3" />
                منصة تعليمية رقمية
              </div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight leading-tight">
                مرحباً بك في{" "}
                <span
                  className="bg-clip-text text-transparent"
                  style={{ backgroundImage: `linear-gradient(135deg, ${primary}, ${secondary})` }}
                >
                  {tenant.name}
                </span>
              </h1>
              {tenant.welcome_message && (
                <p className="text-lg md:text-xl text-muted-foreground leading-relaxed">{tenant.welcome_message}</p>
              )}
              {!tenant.welcome_message && tenant.description && (
                <p className="text-lg md:text-xl text-muted-foreground leading-relaxed">{tenant.description}</p>
              )}
              <div className="flex flex-wrap gap-3 pt-2">
                <Link to="/t/$slug/courses" params={{ slug }}>
                  <Button
                    size="lg"
                    className="text-white border-0 shadow-lg"
                    style={{ background: `linear-gradient(135deg, ${primary}, ${secondary})` }}
                  >
                    <BookOpen className="h-4 w-4 ms-2" />
                    تصفّح الدورات
                  </Button>
                </Link>
                <Link to="/auth">
                  <Button size="lg" variant="outline">إنشاء حساب جديد</Button>
                </Link>
              </div>

              {/* Quick stats */}
              {stats && (
                <div className="grid grid-cols-3 gap-4 pt-6 border-t">
                  <Stat label="دورة" value={stats.courses} icon={BookOpen} color={primary} />
                  <Stat label="طالب" value={stats.students} icon={Users} color={primary} />
                  <Stat label="شهادة" value={stats.students} icon={Award} color={primary} />
                </div>
              )}
            </div>

            {/* Left column: logo + decorations */}
            <div className="order-1 lg:order-2 relative flex items-center justify-center min-h-[320px] lg:min-h-[440px]">
              {/* Decorative blobs */}
              <div
                className="absolute top-6 right-10 w-32 h-32 rounded-full blur-3xl opacity-40"
                style={{ background: primary }}
              />
              <div
                className="absolute bottom-6 left-10 w-40 h-40 rounded-full blur-3xl opacity-30"
                style={{ background: secondary }}
              />
              {/* Floating decorative cards */}
              <div className="absolute top-4 left-2 sm:left-8 animate-bounce-slow">
                <div className="bg-card border shadow-xl rounded-2xl p-3 flex items-center gap-2">
                  <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                  <span className="text-sm font-semibold">جودة عالية</span>
                </div>
              </div>
              <div className="absolute bottom-8 right-4 sm:right-8 animate-bounce-slow [animation-delay:1s]">
                <div className="bg-card border shadow-xl rounded-2xl p-3 flex items-center gap-2">
                  <Award className="h-5 w-5" style={{ color: secondary }} />
                  <span className="text-sm font-semibold">شهادات معتمدة</span>
                </div>
              </div>

              {/* Central logo card */}
              <div className="relative">
                <div
                  className="absolute -inset-4 rounded-[2rem] blur-2xl opacity-50"
                  style={{ background: `linear-gradient(135deg, ${primary}, ${secondary})` }}
                />
                <div className="relative bg-card border-2 rounded-[2rem] p-8 shadow-2xl">
                  {tenant.hero_image_url ? (
                    <img src={tenant.hero_image_url} alt={tenant.name} className="w-56 h-56 sm:w-64 sm:h-64 object-cover rounded-2xl" />
                  ) : tenant.logo_url ? (
                    <img src={tenant.logo_url} alt={tenant.name} className="w-56 h-56 sm:w-64 sm:h-64 object-contain rounded-2xl" />
                  ) : (
                    <div
                      className="w-56 h-56 sm:w-64 sm:h-64 rounded-2xl grid place-items-center text-white"
                      style={{ background: `linear-gradient(135deg, ${primary}, ${secondary})` }}
                    >
                      <GraduationCap className="h-32 w-32" />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ABOUT preview section */}
      {(tenant.about_text || tenant.description) && (
        <section className="container mx-auto px-6 py-16">
          <div className="max-w-4xl mx-auto bg-card border rounded-3xl p-8 md:p-12 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-semibold mb-3" style={{ color: primary }}>
              <Sparkles className="h-4 w-4" /> تعرف علينا
            </div>
            <h2 className="text-3xl font-bold mb-4">من نحن</h2>
            <p className="text-muted-foreground leading-relaxed text-lg whitespace-pre-line line-clamp-6">
              {tenant.about_text || tenant.description}
            </p>
            <div className="mt-6">
              <Link to="/t/$slug/about" params={{ slug }}>
                <Button variant="outline">
                  اقرأ المزيد <ArrowLeft className="h-4 w-4 me-2" />
                </Button>
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Featured courses */}
      {courses && courses.length > 0 && (
        <section className="container mx-auto px-6 py-16">
          <div className="flex items-end justify-between mb-8 flex-wrap gap-4">
            <div>
              <div className="text-sm font-semibold mb-1" style={{ color: primary }}>دورات مميزة</div>
              <h2 className="text-3xl font-bold">الأكثر شعبية</h2>
            </div>
            <Link to="/t/$slug/courses" params={{ slug }}>
              <Button variant="ghost">
                عرض الكل <ArrowLeft className="h-4 w-4 me-2" />
              </Button>
            </Link>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses.map((c) => (
              <CourseCard
                key={c.id}
                course={c}
                tenantSlug={slug}
                primaryColor={primary}
                secondaryColor={secondary}
                currency={tenant.currency ?? "ر.س"}
              />
            ))}
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="container mx-auto px-6 py-16">
        <div
          className="rounded-3xl p-10 md:p-16 text-center text-white relative overflow-hidden shadow-2xl"
          style={{ background: `linear-gradient(135deg, ${primary}, ${secondary})` }}
        >
          <div className="absolute inset-0 bg-grid-pattern opacity-10" />
          <h2 className="text-3xl md:text-4xl font-bold mb-4 relative">جاهز لبدء رحلتك التعليمية؟</h2>
          <p className="text-white/90 text-lg max-w-xl mx-auto mb-8 relative">
            انضم إلى آلاف الطلاب وابدأ في تعلّم مهارات جديدة اليوم.
          </p>
          <div className="flex justify-center gap-3 flex-wrap relative">
            <Link to="/auth">
              <Button size="lg" variant="secondary">إنشاء حساب مجاني</Button>
            </Link>
            <Link to="/t/$slug/courses" params={{ slug }}>
              <Button size="lg" variant="outline" className="bg-transparent text-white border-white hover:bg-white hover:text-foreground">
                تصفّح الدورات
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, icon: Icon, color }: { label: string; value: number; icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; color: string }) {
  return (
    <div>
      <Icon className="h-5 w-5 mb-1" style={{ color }} />
      <div className="text-2xl font-bold">{value.toLocaleString("ar")}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

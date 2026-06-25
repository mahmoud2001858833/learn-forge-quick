import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CourseCard } from "@/components/course-card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Sparkles } from "lucide-react";
import { TenantHero } from "@/components/tenant/tenant-hero";

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
      <TenantHero slug={slug} tenant={tenant} stats={stats} />


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


import { createFileRoute, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CourseCard } from "@/components/course-card";

export const Route = createFileRoute("/t/$slug/")({
  component: TenantStorefront,
});

function TenantStorefront() {
  const { slug } = useParams({ from: "/t/$slug/" });

  const { data: tenant } = useQuery({
    queryKey: ["public-tenant", slug],
    queryFn: async () => (await supabase.from("tenants").select("*").eq("slug", slug).single()).data,
  });

  const { data: courses } = useQuery({
    queryKey: ["public-courses", tenant?.id],
    enabled: !!tenant,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("id, slug, title, short_description, description, cover_url, price, is_free, ad_style, students_count, total_duration_seconds")
        .eq("tenant_id", tenant!.id)
        .eq("status", "published")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: bundles } = useQuery({
    queryKey: ["public-bundles", tenant?.id],
    enabled: !!tenant,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("course_bundles").select("*")
        .eq("tenant_id", tenant!.id).eq("is_active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <main className="container mx-auto px-6 py-12" dir="rtl">
      <section className="text-center py-12">
        <h1 className="text-4xl font-bold">{tenant?.name}</h1>
        {tenant?.welcome_message && <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">{tenant.welcome_message}</p>}
      </section>

      {bundles && bundles.length > 0 && (
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-6">الحزم</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {bundles.map((b) => (
              <div key={b.id} className="p-5 rounded-lg border-2"
                   style={{ borderColor: tenant?.secondary_color ?? "#D4AF37" }}>
                <h3 className="font-bold text-lg">{b.name}</h3>
                <p className="text-sm text-muted-foreground mt-1">{b.description}</p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xl font-bold" style={{ color: tenant?.primary_color ?? undefined }}>
                    {b.price} {tenant?.currency ?? "ر.س"}
                  </span>
                  {b.discount_percent > 0 && <span className="text-sm text-green-600">خصم {b.discount_percent}%</span>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-2xl font-bold mb-6">الدورات</h2>
        {courses && courses.length === 0 && (
          <p className="text-center text-muted-foreground py-12">لا توجد دورات منشورة بعد</p>
        )}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses?.map((c) => (
            <CourseCard
              key={c.id}
              course={c}
              tenantSlug={slug}
              primaryColor={tenant?.primary_color ?? undefined}
              secondaryColor={tenant?.secondary_color ?? undefined}
              currency={tenant?.currency ?? "ر.س"}
            />
          ))}
        </div>
      </section>
    </main>
  );
}

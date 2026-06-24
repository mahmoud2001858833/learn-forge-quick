import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

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
        .select("*")
        .eq("tenant_id", tenant!.id)
        .eq("status", "published")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <main className="container mx-auto px-6 py-12">
      <section className="text-center py-12">
        <h1 className="text-4xl font-bold">{tenant?.name}</h1>
        {tenant?.description && <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">{tenant.description}</p>}
      </section>

      <section>
        <h2 className="text-2xl font-bold mb-6">الدورات</h2>
        {courses && courses.length === 0 && (
          <p className="text-center text-muted-foreground py-12">لا توجد دورات منشورة بعد</p>
        )}
        <div className="grid md:grid-cols-3 gap-6">
          {courses?.map((c) => (
            <Link key={c.id} to="/t/$slug/courses/$courseSlug" params={{ slug, courseSlug: c.slug }}>
              <Card className="hover:shadow-lg transition-shadow h-full">
                {c.cover_url && <img src={c.cover_url} alt={c.title} className="w-full h-40 object-cover rounded-t-xl" />}
                <CardHeader>
                  <CardTitle>{c.title}</CardTitle>
                  <CardDescription className="line-clamp-2">{c.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <span className="font-bold" style={{ color: tenant?.primary_color }}>
                    {c.price > 0 ? `${c.price} ر.س` : "مجاني"}
                  </span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}

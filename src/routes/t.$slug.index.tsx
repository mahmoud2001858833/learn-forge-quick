import { createFileRoute, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CourseCard } from "@/components/course-card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/t/$slug/")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.slug} — منصة تعليمية` },
      { name: "description", content: `تصفّح الدورات المنشورة على منصة ${params.slug}.` },
      { property: "og:title", content: `${params.slug}` },
      { property: "og:type", content: "website" },
    ],
  }),
  component: TenantStorefront,
});

function TenantStorefront() {
  const { slug } = useParams({ from: "/t/$slug/" });
  const [collegeId, setCollegeId] = useState<string>("all");
  const [majorId, setMajorId] = useState<string>("all");

  const { data: tenant } = useQuery({
    queryKey: ["public-tenant", slug],
    queryFn: async () => (await supabase.from("tenants").select("*").eq("slug", slug).single()).data,
  });

  const { data: colleges = [] } = useQuery({
    queryKey: ["public-colleges", tenant?.id],
    enabled: !!tenant,
    queryFn: async () => {
      const { data } = await supabase
        .from("colleges")
        .select("id, name, university_id, universities!inner(tenant_id)")
        .eq("universities.tenant_id", tenant!.id)
        .order("name");
      return data ?? [];
    },
  });

  const { data: majors = [] } = useQuery({
    queryKey: ["public-majors", collegeId],
    enabled: collegeId !== "all",
    queryFn: async () => {
      const { data } = await supabase
        .from("majors").select("id, name").eq("college_id", collegeId).order("name");
      return data ?? [];
    },
  });

  const { data: courses } = useQuery({
    queryKey: ["public-courses", tenant?.id],
    enabled: !!tenant,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("id, slug, title, short_description, description, cover_url, price, is_free, ad_style, students_count, total_duration_seconds, college_id, major_id")
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

  const filtered = useMemo(() => {
    if (!courses) return [];
    return courses.filter((c) => {
      if (collegeId !== "all" && c.college_id !== collegeId) return false;
      if (majorId !== "all" && c.major_id !== majorId) return false;
      return true;
    });
  }, [courses, collegeId, majorId]);

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
        <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
          <h2 className="text-2xl font-bold">الدورات</h2>
          {colleges.length > 0 && (
            <div className="flex gap-2 items-center">
              <Select value={collegeId} onValueChange={(v) => { setCollegeId(v); setMajorId("all"); }}>
                <SelectTrigger className="w-44"><SelectValue placeholder="الكلية" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل الكليات</SelectItem>
                  {colleges.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {collegeId !== "all" && majors.length > 0 && (
                <Select value={majorId} onValueChange={setMajorId}>
                  <SelectTrigger className="w-44"><SelectValue placeholder="التخصص" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">كل التخصصات</SelectItem>
                    {majors.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
              {(collegeId !== "all" || majorId !== "all") && (
                <Button variant="ghost" size="sm" onClick={() => { setCollegeId("all"); setMajorId("all"); }}>
                  مسح
                </Button>
              )}
            </div>
          )}
        </div>

        {filtered.length === 0 && (
          <p className="text-center text-muted-foreground py-12">لا توجد دورات تطابق التصفية</p>
        )}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((c) => (
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

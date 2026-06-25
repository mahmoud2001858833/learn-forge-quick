import { createFileRoute, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CourseCard } from "@/components/course-card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, BookOpen } from "lucide-react";

export const Route = createFileRoute("/t/$slug/courses")({
  head: ({ params }) => ({
    meta: [
      { title: `الدورات — ${params.slug}` },
      { name: "description", content: `تصفّح كل الدورات المتاحة على ${params.slug}.` },
    ],
  }),
  component: CoursesListing,
});

function CoursesListing() {
  const { slug } = useParams({ from: "/t/$slug/courses" });
  const [query, setQuery] = useState("");
  const [collegeId, setCollegeId] = useState<string>("all");
  const [majorId, setMajorId] = useState<string>("all");
  const [priceFilter, setPriceFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("newest");

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

  const { data: bundles } = useQuery({
    queryKey: ["public-bundles", tenant?.id],
    enabled: !!tenant,
    queryFn: async () => {
      const { data } = await supabase
        .from("course_bundles").select("*")
        .eq("tenant_id", tenant!.id).eq("is_active", true)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: courses } = useQuery({
    queryKey: ["public-courses-all", tenant?.id],
    enabled: !!tenant,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("id, slug, title, short_description, description, cover_url, price, is_free, ad_style, students_count, total_duration_seconds, college_id, major_id, average_rating, created_at")
        .eq("tenant_id", tenant!.id)
        .eq("status", "published")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filtered = useMemo(() => {
    if (!courses) return [];
    let list = courses.filter((c) => {
      if (collegeId !== "all" && c.college_id !== collegeId) return false;
      if (majorId !== "all" && c.major_id !== majorId) return false;
      if (priceFilter === "free" && !c.is_free) return false;
      if (priceFilter === "paid" && c.is_free) return false;
      if (query && !c.title.toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    });
    if (sortBy === "rating") list = [...list].sort((a, b) => (b.average_rating ?? 0) - (a.average_rating ?? 0));
    else if (sortBy === "popular") list = [...list].sort((a, b) => (b.students_count ?? 0) - (a.students_count ?? 0));
    else if (sortBy === "price-asc") list = [...list].sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
    else if (sortBy === "price-desc") list = [...list].sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
    return list;
  }, [courses, collegeId, majorId, priceFilter, query, sortBy]);

  if (!tenant) return null;
  const primary = tenant.primary_color ?? "#6366f1";
  const secondary = tenant.secondary_color ?? "#D4AF37";

  return (
    <div className="container mx-auto px-6 py-10" dir="rtl">
      <div className="mb-8">
        <div className="text-sm font-semibold mb-1" style={{ color: primary }}>الكتالوج الكامل</div>
        <h1 className="text-3xl md:text-4xl font-bold">جميع الدورات</h1>
        <p className="text-muted-foreground mt-2">اختر دورتك المناسبة من تشكيلة واسعة من المحتوى التعليمي</p>
      </div>

      {/* Bundles */}
      {bundles && bundles.length > 0 && (
        <section className="mb-10">
          <h2 className="text-xl font-bold mb-4">الحزم الموفّرة</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {bundles.map((b) => (
              <div key={b.id} className="p-5 rounded-2xl border-2 bg-card hover:shadow-lg transition-all" style={{ borderColor: `${secondary}40` }}>
                <h3 className="font-bold text-lg">{b.name}</h3>
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{b.description}</p>
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-2xl font-bold" style={{ color: primary }}>
                    {b.price} {tenant.currency ?? "ر.س"}
                  </span>
                  {b.discount_percent > 0 && (
                    <span className="text-sm px-2 py-1 rounded-full bg-green-100 text-green-700 font-semibold">
                      خصم {b.discount_percent}%
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Filters bar */}
      <div className="sticky top-[73px] z-30 bg-background/95 backdrop-blur-md py-4 border-y mb-6 -mx-6 px-6">
        <div className="grid md:grid-cols-[1fr_auto_auto_auto_auto] gap-3">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="ابحث عن دورة..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pr-9"
            />
          </div>
          {colleges.length > 0 && (
            <Select value={collegeId} onValueChange={(v) => { setCollegeId(v); setMajorId("all"); }}>
              <SelectTrigger className="w-full md:w-36"><SelectValue placeholder="الكلية" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الكليات</SelectItem>
                {colleges.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          {collegeId !== "all" && majors.length > 0 && (
            <Select value={majorId} onValueChange={setMajorId}>
              <SelectTrigger className="w-full md:w-36"><SelectValue placeholder="التخصص" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل التخصصات</SelectItem>
                {majors.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Select value={priceFilter} onValueChange={setPriceFilter}>
            <SelectTrigger className="w-full md:w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">السعر</SelectItem>
              <SelectItem value="free">مجاني</SelectItem>
              <SelectItem value="paid">مدفوع</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-full md:w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">الأحدث</SelectItem>
              <SelectItem value="popular">الأكثر تسجيلاً</SelectItem>
              <SelectItem value="rating">الأعلى تقييماً</SelectItem>
              <SelectItem value="price-asc">السعر: الأرخص</SelectItem>
              <SelectItem value="price-desc">السعر: الأغلى</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {(collegeId !== "all" || majorId !== "all" || query || priceFilter !== "all") && (
          <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
            <span>{filtered.length} نتيجة</span>
            <Button variant="ghost" size="sm" onClick={() => { setCollegeId("all"); setMajorId("all"); setQuery(""); setPriceFilter("all"); }}>
              مسح الفلاتر
            </Button>
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-20">
          <BookOpen className="h-16 w-16 mx-auto text-muted-foreground/40 mb-4" />
          <p className="text-lg font-semibold">لا توجد دورات تطابق البحث</p>
          <p className="text-muted-foreground text-sm mt-1">جرّب تعديل الفلاتر</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((c) => (
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
      )}
    </div>
  );
}

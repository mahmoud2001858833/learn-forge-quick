import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Search, GraduationCap } from "lucide-react";

export const Route = createFileRoute("/search")({
  head: () => ({
    meta: [
      { title: "البحث في الدورات — EduForge" },
      { name: "description", content: "ابحث عن دورات ومنصات تعليمية على EduForge." },
    ],
  }),
  component: SearchPage,
});

function SearchPage() {
  const [q, setQ] = useState("");
  const [active, setActive] = useState("");

  const { data: results, isFetching } = useQuery({
    queryKey: ["search", active],
    enabled: active.length >= 2,
    queryFn: async () => {
      const term = `%${active}%`;
      const [courses, tenants] = await Promise.all([
        supabase
          .from("courses")
          .select("id, slug, title, short_description, cover_url, price, is_free, tenant_id, tenants!inner(slug, name, primary_color, currency)")
          .eq("status", "published")
          .or(`title.ilike.${term},short_description.ilike.${term}`)
          .limit(30),
        supabase
          .from("tenants")
          .select("id, slug, name, logo_url, welcome_message")
          .eq("status", "active")
          .ilike("name", term)
          .limit(10),
      ]);
      return { courses: courses.data ?? [], tenants: tenants.data ?? [] };
    },
  });

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <header className="border-b">
        <div className="container mx-auto flex items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2 font-bold text-xl">
            <GraduationCap className="h-6 w-6 text-primary" /> EduForge
          </Link>
          <Link to="/auth"><Button variant="ghost">دخول</Button></Link>
        </div>
      </header>
      <main className="container mx-auto px-6 py-10 max-w-4xl">
        <h1 className="text-3xl font-bold mb-6">ابحث عن دورة أو منصة</h1>
        <form
          onSubmit={(e) => { e.preventDefault(); setActive(q.trim()); }}
          className="flex gap-2 mb-8"
        >
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="اسم الدورة أو المنصة..." />
          <Button type="submit"><Search className="h-4 w-4 ms-1" /> بحث</Button>
        </form>

        {isFetching && <p className="text-muted-foreground">جارٍ البحث...</p>}

        {results && (
          <div className="space-y-8">
            {results.tenants.length > 0 && (
              <section>
                <h2 className="text-xl font-semibold mb-3">منصات</h2>
                <div className="grid sm:grid-cols-2 gap-3">
                  {results.tenants.map((t) => (
                    <Link key={t.id} to="/t/$slug" params={{ slug: t.slug }}>
                      <Card className="hover:border-primary transition">
                        <CardContent className="p-4 flex items-center gap-3">
                          {t.logo_url ? <img src={t.logo_url} alt="" className="h-10 w-10 rounded" /> : <GraduationCap className="h-10 w-10 text-primary" />}
                          <div>
                            <div className="font-semibold">{t.name}</div>
                            {t.welcome_message && <div className="text-xs text-muted-foreground line-clamp-1">{t.welcome_message}</div>}
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {results.courses.length > 0 && (
              <section>
                <h2 className="text-xl font-semibold mb-3">دورات</h2>
                <div className="grid sm:grid-cols-2 gap-3">
                  {results.courses.map((c) => {
                    const t = (c as unknown as { tenants: { slug: string; name: string; currency: string | null } }).tenants;
                    return (
                      <Link key={c.id} to="/t/$slug/courses/$courseSlug" params={{ slug: t.slug, courseSlug: c.slug }}>
                        <Card className="hover:border-primary transition h-full">
                          <CardContent className="p-4">
                            {c.cover_url && <img src={c.cover_url} alt="" className="w-full h-32 object-cover rounded mb-3" />}
                            <div className="font-semibold">{c.title}</div>
                            <div className="text-xs text-muted-foreground">{t.name}</div>
                            <div className="mt-2 text-sm font-bold text-primary">
                              {c.is_free ? "مجاني" : `${c.price} ${t.currency ?? "ر.س"}`}
                            </div>
                          </CardContent>
                        </Card>
                      </Link>
                    );
                  })}
                </div>
              </section>
            )}

            {results.tenants.length === 0 && results.courses.length === 0 && active && (
              <p className="text-center text-muted-foreground py-8">لا توجد نتائج لـ "{active}"</p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

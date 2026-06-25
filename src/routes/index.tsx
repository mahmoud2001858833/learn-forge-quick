import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { GraduationCap, Layers, Users, Zap, Search } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "EduForge — أنشئ منصتك التعليمية في دقائق" },
      { name: "description", content: "منصة عربية متكاملة لبناء وإطلاق أكاديميتك الإلكترونية: دورات، طلاب، مدفوعات، شهادات وإحصائيات." },
      { property: "og:title", content: "EduForge — منصتك التعليمية" },
      { property: "og:description", content: "أنشئ أكاديميتك الإلكترونية بدورات، طلاب، وإدارة كاملة." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { data: tenants } = useQuery({
    queryKey: ["featured-tenants"],
    queryFn: async () => {
      const { data } = await supabase
        .from("tenants")
        .select("id, slug, name, logo_url, welcome_message, primary_color")
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(6);
      return data ?? [];
    },
  });

  return (
    <div className="min-h-screen bg-background text-foreground" dir="rtl">
      <header className="border-b">
        <div className="container mx-auto flex items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2 font-bold text-xl">
            <GraduationCap className="h-6 w-6 text-primary" />
            EduForge
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/search"><Button variant="ghost" size="sm"><Search className="h-4 w-4 ms-1" /> بحث</Button></Link>
            <Link to="/auth"><Button variant="ghost" size="sm">دخول</Button></Link>
            <Link to="/auth"><Button size="sm">ابدأ مجاناً</Button></Link>
          </div>
        </div>
      </header>

      <section className="container mx-auto px-6 py-20 md:py-28 text-center">
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
          أنشئ منصتك التعليمية <span className="text-primary">في دقائق</span>
        </h1>
        <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
          منصة متكاملة لبناء أكاديميتك الإلكترونية الخاصة. أنشئ الدورات، أدر الطلاب، وابدأ التدريس فوراً.
        </p>
        <div className="mt-10 flex justify-center gap-3 flex-wrap">
          <Link to="/auth"><Button size="lg">ابدأ مجاناً الآن</Button></Link>
          <Link to="/search"><Button size="lg" variant="outline"><Search className="h-4 w-4 ms-1" /> تصفّح الدورات</Button></Link>
        </div>
      </section>

      <section className="container mx-auto px-6 py-16 grid md:grid-cols-3 gap-6">
        <Feature icon={Zap} title="إطلاق سريع" desc="منصتك جاهزة خلال 5 دقائق — اختر اللون، أضف اللوغو، وانطلق." />
        <Feature icon={Layers} title="إدارة دورات كاملة" desc="فصول، دروس فيديو، اختبارات، شهادات — كل شيء في مكان واحد." />
        <Feature icon={Users} title="إدارة الطلاب" desc="تتبع التقدم، التسجيلات، والمدفوعات، والإحصائيات." />
      </section>

      {tenants && tenants.length > 0 && (
        <section className="container mx-auto px-6 py-16">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-8">منصات على EduForge</h2>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
            {tenants.map((t) => (
              <Link key={t.id} to="/t/$slug" params={{ slug: t.slug }}>
                <Card className="hover:border-primary transition h-full">
                  <CardContent className="p-5 flex items-center gap-3">
                    {t.logo_url
                      ? <img src={t.logo_url} alt={t.name} className="h-12 w-12 rounded object-cover" />
                      : <GraduationCap className="h-12 w-12" style={{ color: t.primary_color ?? undefined }} />}
                    <div>
                      <div className="font-semibold">{t.name}</div>
                      {t.welcome_message && <div className="text-xs text-muted-foreground line-clamp-2 mt-1">{t.welcome_message}</div>}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}

      <footer className="border-t mt-10">
        <div className="container mx-auto px-6 py-8 text-center text-sm text-muted-foreground">
          © 2026 EduForge. جميع الحقوق محفوظة.
        </div>
      </footer>
    </div>
  );
}

function Feature({ icon: Icon, title, desc }: { icon: React.ComponentType<{ className?: string }>; title: string; desc: string }) {
  return (
    <div className="p-6 rounded-xl border bg-card">
      <Icon className="h-10 w-10 text-primary mb-4" />
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-muted-foreground">{desc}</p>
    </div>
  );
}

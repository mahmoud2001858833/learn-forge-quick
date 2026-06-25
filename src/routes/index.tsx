import { createFileRoute, Link } from "@tanstack/react-router";
import { lazy, Suspense, useEffect } from "react";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  GraduationCap, Search, Sparkles, ArrowLeft, PlayCircle, CheckCircle2,
  Rocket, Layers, Video, Users, BarChart3,
} from "lucide-react";
import { getLandingData } from "@/lib/landing.functions";
import { trackLanding } from "@/lib/landing-track";

const BASE = "https://learn-forge-quick.lovable.app";

const landingDataQO = queryOptions({
  queryKey: ["landing-data"],
  queryFn: () => getLandingData(),
  staleTime: 60_000,
});

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "EduForge — أنشئ منصتك التعليمية في دقائق" },
      { name: "description", content: "منصة عربية متكاملة لبناء وإطلاق أكاديميتك الإلكترونية: دورات، طلاب، مدفوعات، شهادات وإحصائيات." },
      { name: "keywords", content: "منصة تعليمية, أكاديمية إلكترونية, إنشاء منصة دورات, تعليم عن بعد, LMS عربي" },
      { property: "og:title", content: "EduForge — منصتك التعليمية" },
      { property: "og:description", content: "أنشئ أكاديميتك الإلكترونية بدورات، طلاب، وإدارة كاملة." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: BASE },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: BASE }],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(landingDataQO),
  component: Landing,
});

// Lazy-load below-the-fold sections to shrink initial JS
const FeaturesSection = lazy(() => import("@/components/landing/sections").then(m => ({ default: m.FeaturesSection })));
const StatsStrip = lazy(() => import("@/components/landing/sections").then(m => ({ default: m.StatsStrip })));
const Tenants = lazy(() => import("@/components/landing/sections").then(m => ({ default: m.Tenants })));
const HowItWorks = lazy(() => import("@/components/landing/sections").then(m => ({ default: m.HowItWorks })));
const Pricing = lazy(() => import("@/components/landing/sections").then(m => ({ default: m.Pricing })));
const Testimonials = lazy(() => import("@/components/landing/sections").then(m => ({ default: m.Testimonials })));
const FAQ = lazy(() => import("@/components/landing/sections").then(m => ({ default: m.FAQ })));
const FinalCTA = lazy(() => import("@/components/landing/sections").then(m => ({ default: m.FinalCTA })));
const SiteFooter = lazy(() => import("@/components/landing/sections").then(m => ({ default: m.SiteFooter })));

function Landing() {
  const { data } = useSuspenseQuery(landingDataQO);
  const cfg = data.config ?? {};

  useEffect(() => { trackLanding("view"); }, []);

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden" dir="rtl">
      <Nav />
      <Hero cfg={cfg} stats={data.stats} />
      <Suspense fallback={null}>
        {cfg.show_features !== false && <FeaturesSection items={cfg.features ?? []} />}
        {cfg.show_stats !== false && <StatsStrip stats={data.stats} />}
        {cfg.show_tenants !== false && <Tenants tenants={data.tenants} />}
        <HowItWorks steps={cfg.steps ?? []} />
        {cfg.show_pricing !== false && <Pricing plans={cfg.pricing ?? []} />}
        {cfg.show_testimonials !== false && <Testimonials items={cfg.testimonials ?? []} />}
        {cfg.show_faq !== false && <FAQ items={cfg.faq ?? []} />}
        <FinalCTA />
        <SiteFooter />
      </Suspense>
    </div>
  );
}

/* ============ NAV ============ */
function Nav() {
  return (
    <header className="sticky top-0 z-50 backdrop-blur-xl bg-background/70 border-b">
      <div className="container mx-auto flex items-center justify-between gap-3 px-4 sm:px-6 py-3">
        <Link to="/" className="flex items-center gap-2 font-black text-lg sm:text-xl min-w-0">
          <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl bg-gradient-to-br from-primary to-foreground grid place-items-center text-primary-foreground shrink-0">
            <GraduationCap className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
          <span className="bg-gradient-to-l from-primary to-foreground bg-clip-text text-transparent truncate">
            EduForge
          </span>
        </Link>
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-muted-foreground">
          <a href="#features" className="hover:text-foreground transition">المميزات</a>
          <a href="#how" className="hover:text-foreground transition">كيف يعمل</a>
          <a href="#pricing" className="hover:text-foreground transition">الأسعار</a>
          <a href="#faq" className="hover:text-foreground transition">الأسئلة</a>
        </nav>
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <Link to="/search" className="hidden sm:block" onClick={() => trackLanding("cta_click", "nav_search")}>
            <Button variant="ghost" size="sm"><Search className="h-4 w-4 ms-1" /> بحث</Button>
          </Link>
          <Link to="/auth" onClick={() => trackLanding("cta_click", "nav_login")}>
            <Button variant="ghost" size="sm">دخول</Button>
          </Link>
          <Link to="/auth" onClick={() => trackLanding("cta_click", "nav_signup")}>
            <Button size="sm" className="shadow-lg shadow-primary/20">
              ابدأ <ArrowLeft className="h-4 w-4 me-1 hidden sm:inline" />
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}

/* ============ HERO ============ */
function Hero({ cfg, stats }: { cfg: any; stats: { tenants: number; courses: number; students: number } }) {
  const eyebrow = cfg.hero_eyebrow ?? "الجيل الجديد من منصات التعليم العربية";
  const title = cfg.hero_title ?? "أكاديميتك الإلكترونية جاهزة في دقائق";
  const subtitle = cfg.hero_subtitle ?? "أنشئ منصة دورات احترافية بعلامتك التجارية بدون أي كود.";
  const cta1 = cfg.cta_primary_label ?? "أنشئ منصتك مجاناً";
  const cta2 = cfg.cta_secondary_label ?? "شاهد العرض";

  return (
    <section className="relative pt-12 pb-20 sm:pt-16 sm:pb-24 md:pt-24 md:pb-32 overflow-hidden">
      <div className="absolute inset-0 -z-10 pointer-events-none">
        <div className="absolute top-20 end-1/4 w-72 sm:w-[500px] h-72 sm:h-[500px] rounded-full bg-primary/20 blur-3xl opacity-60 animate-bounce-slow" />
        <div className="absolute bottom-0 start-1/4 w-72 sm:w-[500px] h-72 sm:h-[500px] rounded-full bg-foreground/10 blur-3xl opacity-60" />
        <div className="absolute inset-0 bg-grid-pattern text-foreground/[0.04]" />
      </div>

      <div className="container mx-auto px-4 sm:px-6 text-center max-w-5xl">
        <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 rounded-full text-[11px] sm:text-xs font-medium border bg-card/80 backdrop-blur mb-6 sm:mb-8 animate-fade-in">
          <Sparkles className="h-3 w-3 text-primary" />
          <span>{eyebrow}</span>
        </div>

        <h1 className="text-4xl sm:text-5xl md:text-7xl lg:text-8xl font-black tracking-tight leading-[1.1] mb-5 sm:mb-6 animate-fade-in">
          <span className="bg-gradient-to-l from-primary via-foreground to-primary bg-clip-text text-transparent">
            {title}
          </span>
        </h1>

        <p className="text-base sm:text-lg md:text-2xl text-muted-foreground max-w-3xl mx-auto leading-relaxed mb-8 sm:mb-10 px-2">
          {subtitle}
        </p>

        <div className="flex justify-center gap-3 flex-wrap mb-10 sm:mb-12">
          <Link to="/auth" onClick={() => trackLanding("cta_click", "hero_primary")}>
            <Button size="lg" className="h-12 sm:h-14 px-6 sm:px-8 text-sm sm:text-base shadow-2xl shadow-primary/30">
              <Rocket className="h-5 w-5 ms-2" /> {cta1}
            </Button>
          </Link>
          <Link to="/search" onClick={() => trackLanding("cta_click", "hero_secondary")}>
            <Button size="lg" variant="outline" className="h-12 sm:h-14 px-6 sm:px-8 text-sm sm:text-base">
              <PlayCircle className="h-5 w-5 ms-2" /> {cta2}
            </Button>
          </Link>
        </div>

        <div className="flex items-center justify-center gap-3 sm:gap-6 flex-wrap text-xs sm:text-sm text-muted-foreground">
          <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /> بدون بطاقة ائتمان</div>
          <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /> إعداد خلال 5 دقائق</div>
          <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /> دعم عربي 24/7</div>
        </div>

        <div className="mt-12 sm:mt-20 relative max-w-5xl mx-auto">
          <div className="absolute -inset-4 bg-gradient-to-r from-primary/30 via-foreground/10 to-primary/30 blur-3xl rounded-3xl" />
          <div className="relative rounded-2xl sm:rounded-3xl border-2 bg-card shadow-2xl overflow-hidden">
            <div className="flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-3 border-b bg-muted/40">
              <div className="flex gap-1.5">
                <div className="h-2.5 sm:h-3 w-2.5 sm:w-3 rounded-full bg-destructive/60" />
                <div className="h-2.5 sm:h-3 w-2.5 sm:w-3 rounded-full bg-chart-4/60" />
                <div className="h-2.5 sm:h-3 w-2.5 sm:w-3 rounded-full bg-chart-2/60" />
              </div>
              <div className="flex-1 mx-2 sm:mx-4 px-3 py-1 rounded-md bg-background border text-[10px] sm:text-xs text-muted-foreground text-center truncate">
                academy.eduforge.app
              </div>
            </div>
            <div className="aspect-[16/10] sm:aspect-[16/9] bg-gradient-to-br from-muted/40 to-background grid place-items-center relative">
              <div className="absolute inset-0 bg-grid-pattern text-foreground/[0.06]" />
              <div className="relative grid grid-cols-3 gap-3 sm:gap-8 px-3 sm:px-6 w-full max-w-3xl">
                <MockStat icon={Layers} label="منصة نشطة" value={stats.tenants} />
                <MockStat icon={Video} label="دورة منشورة" value={stats.courses} />
                <MockStat icon={Users} label="طالب مسجّل" value={stats.students} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function MockStat({ icon: Icon, label, value }: { icon: any; label: string; value: number }) {
  return (
    <div className="bg-card/80 backdrop-blur border rounded-xl sm:rounded-2xl p-3 sm:p-6 text-center shadow-xl">
      <Icon className="h-5 w-5 sm:h-8 sm:w-8 mx-auto mb-1 sm:mb-3 text-primary" />
      <div className="text-lg sm:text-3xl font-black">{value.toLocaleString("ar")}</div>
      <div className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1 truncate">{label}</div>
    </div>
  );
}

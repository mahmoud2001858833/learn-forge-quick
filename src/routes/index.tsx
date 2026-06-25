import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  GraduationCap, Layers, Users, Zap, Search, Sparkles, ArrowLeft,
  PlayCircle, ShieldCheck, CreditCard, BarChart3, Award, Globe,
  CheckCircle2, Star, Rocket, MessageSquare, Video, Palette,
} from "lucide-react";

const BASE = "https://learn-forge-quick.lovable.app";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "EduForge — أنشئ منصتك التعليمية في دقائق" },
      { name: "description", content: "منصة عربية متكاملة لبناء وإطلاق أكاديميتك الإلكترونية: دورات، طلاب، مدفوعات، شهادات وإحصائيات احترافية." },
      { name: "keywords", content: "منصة تعليمية, أكاديمية إلكترونية, إنشاء منصة دورات, تعليم عن بعد, LMS عربي" },
      { property: "og:title", content: "EduForge — منصتك التعليمية" },
      { property: "og:description", content: "أنشئ أكاديميتك الإلكترونية بدورات، طلاب، وإدارة كاملة." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: BASE },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: BASE }],
  }),
  component: Landing,
});

function Landing() {
  const { data: tenants } = useQuery({
    queryKey: ["featured-tenants"],
    queryFn: async () => {
      const { data } = await supabase
        .from("tenants")
        .select("id, slug, name, logo_url, welcome_message, primary_color, secondary_color")
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(8);
      return data ?? [];
    },
  });

  const { data: globalStats } = useQuery({
    queryKey: ["global-stats"],
    queryFn: async () => {
      const [t, c, e] = await Promise.all([
        supabase.from("tenants").select("id", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("courses").select("id", { count: "exact", head: true }).eq("status", "published"),
        supabase.from("enrollments").select("id", { count: "exact", head: true }),
      ]);
      return { tenants: t.count ?? 0, courses: c.count ?? 0, students: e.count ?? 0 };
    },
  });

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden" dir="rtl">
      <Nav />
      <Hero stats={globalStats} />
      <LogosBar tenants={tenants ?? []} />
      <Features />
      <ShowcaseSplit />
      <StatsStrip stats={globalStats} />
      <Tenants tenants={tenants ?? []} />
      <HowItWorks />
      <Pricing />
      <Testimonials />
      <FAQ />
      <FinalCTA />
      <Footer />
    </div>
  );
}

/* ============ NAV ============ */
function Nav() {
  return (
    <header className="sticky top-0 z-50 backdrop-blur-xl bg-background/70 border-b">
      <div className="container mx-auto flex items-center justify-between px-6 py-3">
        <Link to="/" className="flex items-center gap-2 font-black text-xl">
          <div className="relative">
            <div className="absolute inset-0 blur-md bg-primary/40" />
            <div className="relative h-9 w-9 rounded-xl bg-gradient-to-br from-primary to-foreground grid place-items-center text-primary-foreground">
              <GraduationCap className="h-5 w-5" />
            </div>
          </div>
          <span className="bg-gradient-to-l from-primary to-foreground bg-clip-text text-transparent">
            EduForge
          </span>
        </Link>
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-muted-foreground">
          <a href="#features" className="hover:text-foreground transition">المميزات</a>
          <a href="#how" className="hover:text-foreground transition">كيف يعمل</a>
          <a href="#pricing" className="hover:text-foreground transition">الأسعار</a>
          <a href="#faq" className="hover:text-foreground transition">الأسئلة</a>
        </nav>
        <div className="flex items-center gap-2">
          <Link to="/search" className="hidden sm:block">
            <Button variant="ghost" size="sm"><Search className="h-4 w-4 ms-1" /> بحث</Button>
          </Link>
          <Link to="/auth"><Button variant="ghost" size="sm">دخول</Button></Link>
          <Link to="/auth">
            <Button size="sm" className="shadow-lg shadow-primary/20">
              ابدأ مجاناً <ArrowLeft className="h-4 w-4 me-1" />
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}

/* ============ HERO ============ */
function Hero({ stats }: { stats?: { tenants: number; courses: number; students: number } }) {
  return (
    <section className="relative pt-16 pb-24 md:pt-24 md:pb-32 overflow-hidden">
      {/* background blobs */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-20 right-1/4 w-[500px] h-[500px] rounded-full bg-primary/20 blur-3xl opacity-60 animate-bounce-slow" />
        <div className="absolute bottom-0 left-1/4 w-[500px] h-[500px] rounded-full bg-foreground/10 blur-3xl opacity-60" />
        <div className="absolute inset-0 bg-grid-pattern text-foreground/[0.04]" />
      </div>

      <div className="container mx-auto px-6 text-center max-w-5xl">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium border bg-card/80 backdrop-blur mb-8 animate-fade-in">
          <Sparkles className="h-3 w-3 text-primary" />
          <span>الجيل الجديد من منصات التعليم العربية</span>
          <span className="text-primary">·</span>
          <span className="text-muted-foreground">2026</span>
        </div>

        <h1 className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tight leading-[1.05] mb-6 animate-fade-in">
          أكاديميتك الإلكترونية
          <br />
          <span className="relative inline-block">
            <span className="bg-gradient-to-l from-primary via-foreground to-primary bg-clip-text text-transparent">
              جاهزة في دقائق
            </span>
            <svg className="absolute -bottom-2 right-0 left-0 mx-auto w-3/4" viewBox="0 0 300 12" fill="none">
              <path d="M2 9 Q 150 -2 298 9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="text-primary/60" />
            </svg>
          </span>
        </h1>

        <p className="text-lg md:text-2xl text-muted-foreground max-w-3xl mx-auto leading-relaxed mb-10">
          أنشئ منصة دورات احترافية بعلامتك التجارية، أدر الطلاب والمدفوعات،
          وأطلق الشهادات — كل ذلك من مكان واحد، بدون أي كود.
        </p>

        <div className="flex justify-center gap-3 flex-wrap mb-12">
          <Link to="/auth">
            <Button size="lg" className="h-14 px-8 text-base shadow-2xl shadow-primary/30 hover-scale">
              <Rocket className="h-5 w-5 ms-2" /> أنشئ منصتك مجاناً
            </Button>
          </Link>
          <Link to="/search">
            <Button size="lg" variant="outline" className="h-14 px-8 text-base hover-scale">
              <PlayCircle className="h-5 w-5 ms-2" /> شاهد العرض
            </Button>
          </Link>
        </div>

        {/* trust row */}
        <div className="flex items-center justify-center gap-6 flex-wrap text-sm text-muted-foreground">
          <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /> بدون بطاقة ائتمان</div>
          <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /> إعداد خلال 5 دقائق</div>
          <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /> دعم عربي 24/7</div>
        </div>

        {/* preview mock */}
        <div className="mt-20 relative max-w-5xl mx-auto">
          <div className="absolute -inset-4 bg-gradient-to-r from-primary/30 via-foreground/10 to-primary/30 blur-3xl rounded-3xl" />
          <div className="relative rounded-3xl border-2 bg-card shadow-2xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/40">
              <div className="flex gap-1.5">
                <div className="h-3 w-3 rounded-full bg-destructive/60" />
                <div className="h-3 w-3 rounded-full bg-chart-4/60" />
                <div className="h-3 w-3 rounded-full bg-chart-2/60" />
              </div>
              <div className="flex-1 mx-4 px-3 py-1 rounded-md bg-background border text-xs text-muted-foreground text-center">
                academy.eduforge.app
              </div>
            </div>
            <div className="aspect-[16/9] bg-gradient-to-br from-muted/40 to-background grid place-items-center relative">
              <div className="absolute inset-0 bg-grid-pattern text-foreground/[0.06]" />
              {stats && (
                <div className="relative grid grid-cols-3 gap-8 px-6 w-full max-w-3xl">
                  <MockStat icon={Layers} label="منصة نشطة" value={stats.tenants} />
                  <MockStat icon={Video} label="دورة منشورة" value={stats.courses} />
                  <MockStat icon={Users} label="طالب مسجّل" value={stats.students} />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function MockStat({ icon: Icon, label, value }: { icon: any; label: string; value: number }) {
  return (
    <div className="bg-card/80 backdrop-blur border rounded-2xl p-6 text-center shadow-xl">
      <Icon className="h-8 w-8 mx-auto mb-3 text-primary" />
      <div className="text-3xl font-black">{value.toLocaleString("ar")}</div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
    </div>
  );
}

/* ============ LOGOS BAR ============ */
function LogosBar({ tenants }: { tenants: any[] }) {
  if (!tenants.length) return null;
  return (
    <section className="border-y bg-muted/30 py-8">
      <div className="container mx-auto px-6">
        <p className="text-center text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-6">
          منصات تثق بنا
        </p>
        <div className="flex items-center justify-center gap-10 flex-wrap opacity-70">
          {tenants.slice(0, 6).map((t) => (
            <Link key={t.id} to="/t/$slug" params={{ slug: t.slug }} className="flex items-center gap-2 hover:opacity-100 transition">
              {t.logo_url ? (
                <img src={t.logo_url} alt={t.name} className="h-8 w-8 rounded object-cover" />
              ) : (
                <div className="h-8 w-8 rounded grid place-items-center text-white text-xs font-bold" style={{ background: t.primary_color ?? "var(--primary)" }}>
                  {t.name.charAt(0)}
                </div>
              )}
              <span className="font-semibold text-sm">{t.name}</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============ FEATURES ============ */
function Features() {
  const items = [
    { icon: Zap, title: "إطلاق فوري", desc: "ابدأ منصتك خلال 5 دقائق — اختر اللون، أضف اللوغو، انطلق.", color: "from-yellow-500 to-orange-500" },
    { icon: Video, title: "إدارة دورات احترافية", desc: "فصول، دروس فيديو، اختبارات، واجبات وشهادات — كل شيء في مكان واحد.", color: "from-blue-500 to-indigo-500" },
    { icon: Users, title: "إدارة طلاب متكاملة", desc: "تتبّع التقدم، التسجيلات، المدفوعات، والإحصائيات لحظة بلحظة.", color: "from-green-500 to-emerald-500" },
    { icon: CreditCard, title: "مدفوعات متعددة", desc: "تحويل بنكي، Stripe، Paddle، أو كوبونات خصم — أنت تتحكم.", color: "from-purple-500 to-pink-500" },
    { icon: Award, title: "شهادات قابلة للتحقق", desc: "شهادات بتصميمك مع رابط تحقق فريد لكل طالب.", color: "from-red-500 to-rose-500" },
    { icon: BarChart3, title: "تحليلات ذكية", desc: "لوحات تحكم تفاعلية للإيرادات والطلاب والأداء.", color: "from-cyan-500 to-teal-500" },
    { icon: Palette, title: "تخصيص كامل", desc: "ألوانك، خطك، صورك، ودومينك الخاص — هويتك الكاملة.", color: "from-fuchsia-500 to-purple-500" },
    { icon: ShieldCheck, title: "أمان مؤسسي", desc: "RLS، عزل بيانات كامل، نسخ احتياطي، وحماية ضد الاختراق.", color: "from-slate-500 to-slate-700" },
    { icon: Globe, title: "دومين مخصص", desc: "اربط نطاقك الخاص وحوّل المنصة لعلامتك التجارية بالكامل.", color: "from-amber-500 to-yellow-600" },
  ];
  return (
    <section id="features" className="container mx-auto px-6 py-24">
      <SectionHead
        eyebrow="المميزات"
        title="كل ما تحتاجه لإطلاق أكاديميتك"
        subtitle="مجموعة أدوات متكاملة مصممة خصيصاً للمعلم العربي ورائد الأعمال التعليمي."
      />
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 mt-14">
        {items.map((f, i) => (
          <div key={i} className="group relative bg-card border rounded-2xl p-7 hover:border-primary/50 hover:shadow-2xl hover:-translate-y-1 transition-all duration-300">
            <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${f.color} opacity-0 group-hover:opacity-[0.04] transition`} />
            <div className={`relative h-12 w-12 rounded-xl bg-gradient-to-br ${f.color} grid place-items-center text-white shadow-lg mb-5`}>
              <f.icon className="h-6 w-6" />
            </div>
            <h3 className="relative text-lg font-bold mb-2">{f.title}</h3>
            <p className="relative text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ============ SHOWCASE SPLIT ============ */
function ShowcaseSplit() {
  return (
    <section className="relative py-24 bg-gradient-to-b from-muted/30 to-background">
      <div className="container mx-auto px-6 space-y-24">
        <SplitRow
          reverse={false}
          eyebrow="تجربة الطالب"
          title="رحلة تعلّم سلسة لا تُنسى"
          desc="مشغل فيديو متطور، تتبع تقدم تلقائي، اختبارات تفاعلية، نقاشات حول كل درس، وشهادات قابلة للتحميل."
          bullets={["مشغل فيديو HLS مع علامات", "نظام نقاط وشارات Gamification", "مساعد AI لكل دورة", "مجتمع تفاعلي حول الدروس"]}
        />
        <SplitRow
          reverse
          eyebrow="لوحة المعلّم"
          title="تحكم كامل بدون تعقيد"
          desc="من إنشاء الدورات إلى الموافقة على المدفوعات، إلى البث المباشر — كل شيء بضغطة زر."
          bullets={["بث مباشر مع غرفة دردشة", "بنك أسئلة وواجبات", "كوبونات وحزم وإحالات", "تقارير مفصلة قابلة للتصدير"]}
        />
      </div>
    </section>
  );
}

function SplitRow({ reverse, eyebrow, title, desc, bullets }: { reverse: boolean; eyebrow: string; title: string; desc: string; bullets: string[] }) {
  return (
    <div className={`grid lg:grid-cols-2 gap-12 items-center ${reverse ? "lg:[&>*:first-child]:order-2" : ""}`}>
      <div>
        <div className="text-xs font-bold uppercase tracking-widest text-primary mb-3">{eyebrow}</div>
        <h3 className="text-3xl md:text-4xl font-black mb-4 leading-tight">{title}</h3>
        <p className="text-lg text-muted-foreground mb-6 leading-relaxed">{desc}</p>
        <ul className="space-y-3">
          {bullets.map((b, i) => (
            <li key={i} className="flex items-start gap-3">
              <div className="mt-0.5 h-6 w-6 rounded-full bg-primary/10 grid place-items-center shrink-0">
                <CheckCircle2 className="h-4 w-4 text-primary" />
              </div>
              <span className="text-foreground/90">{b}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="relative aspect-square max-w-md mx-auto">
        <div className="absolute inset-4 rounded-3xl bg-gradient-to-br from-primary/30 to-foreground/10 blur-2xl" />
        <div className="relative h-full rounded-3xl border-2 bg-card shadow-2xl p-6 flex flex-col gap-3">
          <div className="flex items-center gap-2 pb-3 border-b">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-foreground" />
            <div className="flex-1">
              <div className="h-3 w-24 bg-muted rounded mb-1.5" />
              <div className="h-2 w-16 bg-muted/60 rounded" />
            </div>
          </div>
          <div className="flex-1 grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-xl bg-muted/40 border p-3 flex flex-col gap-2">
                <div className="h-16 rounded-md bg-gradient-to-br from-primary/20 to-foreground/10" />
                <div className="h-2 w-3/4 bg-muted rounded" />
                <div className="h-2 w-1/2 bg-muted/60 rounded" />
              </div>
            ))}
          </div>
          <div className="rounded-xl border p-3 flex items-center justify-between bg-muted/30">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              <div className="h-2 w-20 bg-muted rounded" />
            </div>
            <div className="text-xs font-bold text-primary">+24%</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============ STATS STRIP ============ */
function StatsStrip({ stats }: { stats?: { tenants: number; courses: number; students: number } }) {
  if (!stats) return null;
  const items = [
    { value: stats.tenants, label: "منصة نشطة", suffix: "+" },
    { value: stats.courses, label: "دورة منشورة", suffix: "+" },
    { value: stats.students, label: "طالب مسجّل", suffix: "+" },
    { value: 99, label: "نسبة رضا المعلمين", suffix: "%" },
  ];
  return (
    <section className="py-20 bg-foreground text-background">
      <div className="container mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {items.map((s, i) => (
            <div key={i}>
              <div className="text-4xl md:text-6xl font-black bg-gradient-to-b from-background to-background/60 bg-clip-text text-transparent">
                {s.value.toLocaleString("ar")}{s.suffix}
              </div>
              <div className="text-sm text-background/70 mt-2">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============ TENANTS ============ */
function Tenants({ tenants }: { tenants: any[] }) {
  if (!tenants.length) return null;
  return (
    <section className="container mx-auto px-6 py-24">
      <SectionHead
        eyebrow="المنصات"
        title="منصات تعليمية تنطلق من EduForge"
        subtitle="انضم لمئات المعلمين والأكاديميات الذين بنوا أعمالهم التعليمية معنا."
      />
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 mt-14">
        {tenants.map((t) => (
          <Link key={t.id} to="/t/$slug" params={{ slug: t.slug }}>
            <div className="group relative h-full bg-card border rounded-2xl p-6 hover:border-primary/50 hover:shadow-xl hover:-translate-y-1 transition-all overflow-hidden">
              <div className="absolute -top-12 -left-12 w-32 h-32 rounded-full opacity-10 group-hover:opacity-20 transition blur-2xl"
                   style={{ background: t.primary_color ?? "var(--primary)" }} />
              <div className="relative">
                {t.logo_url ? (
                  <img src={t.logo_url} alt={t.name} className="h-14 w-14 rounded-xl object-cover mb-4 shadow-lg" />
                ) : (
                  <div className="h-14 w-14 rounded-xl grid place-items-center text-white text-xl font-black mb-4 shadow-lg"
                       style={{ background: `linear-gradient(135deg, ${t.primary_color ?? "#6366f1"}, ${t.secondary_color ?? "#D4AF37"})` }}>
                    {t.name.charAt(0)}
                  </div>
                )}
                <div className="font-bold text-base mb-1">{t.name}</div>
                {t.welcome_message && (
                  <div className="text-xs text-muted-foreground line-clamp-2">{t.welcome_message}</div>
                )}
                <div className="mt-4 text-xs font-semibold text-primary flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                  زيارة المنصة <ArrowLeft className="h-3 w-3" />
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

/* ============ HOW IT WORKS ============ */
function HowItWorks() {
  const steps = [
    { n: "01", title: "أنشئ حسابك", desc: "سجّل في أقل من دقيقة عبر البريد أو Google." },
    { n: "02", title: "خصّص منصتك", desc: "اختر اللون، ارفع اللوغو، أضف اسم الأكاديمية." },
    { n: "03", title: "أضف دوراتك", desc: "ارفع الفيديوهات، أنشئ الفصول، حدّد الأسعار." },
    { n: "04", title: "اطلق وابدأ", desc: "شارك رابطك، استقبل الطلاب، حصّل الأرباح." },
  ];
  return (
    <section id="how" className="py-24 bg-muted/30">
      <div className="container mx-auto px-6">
        <SectionHead eyebrow="كيف يعمل" title="أربع خطوات تفصلك عن أكاديميتك" subtitle="عملية بسيطة مصممة لإطلاق منصتك بأسرع وقت ممكن." />
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mt-14 relative">
          {steps.map((s, i) => (
            <div key={i} className="relative">
              <div className="bg-card border-2 rounded-2xl p-6 h-full hover:border-primary transition-all">
                <div className="text-5xl font-black text-primary/20 mb-3">{s.n}</div>
                <div className="font-bold text-lg mb-2">{s.title}</div>
                <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
              </div>
              {i < steps.length - 1 && (
                <ArrowLeft className="hidden lg:block absolute top-1/2 -left-3 -translate-y-1/2 h-6 w-6 text-muted-foreground/40" />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============ PRICING ============ */
function Pricing() {
  const plans = [
    { name: "المجاني", price: "0", period: "للأبد", desc: "للبدء واختبار المنصة.", features: ["منصة واحدة", "حتى 50 طالباً", "5 دورات", "علامة EduForge"], cta: "ابدأ الآن", featured: false },
    { name: "الاحترافي", price: "99", period: "ر.س/شهر", desc: "للأكاديميات النامية.", features: ["طلاب غير محدودين", "دورات غير محدودة", "دومين مخصص", "إزالة العلامة", "دعم أولوية"], cta: "ابدأ التجربة", featured: true },
    { name: "المؤسسات", price: "تواصل", period: "حسب الحاجة", desc: "للمؤسسات الكبرى.", features: ["منصات متعددة", "API كامل", "تكامل مخصص", "مدير حساب مخصص", "SLA مضمون"], cta: "تواصل معنا", featured: false },
  ];
  return (
    <section id="pricing" className="container mx-auto px-6 py-24">
      <SectionHead eyebrow="الأسعار" title="أسعار شفافة تنمو معك" subtitle="ابدأ مجاناً وانتقل للاحترافي عندما تكون جاهزاً للتوسع." />
      <div className="grid md:grid-cols-3 gap-6 mt-14 max-w-5xl mx-auto">
        {plans.map((p) => (
          <div key={p.name} className={`relative rounded-3xl p-8 border-2 transition-all hover:-translate-y-1 ${p.featured ? "border-primary bg-gradient-to-b from-primary/5 to-card shadow-2xl shadow-primary/10 scale-105" : "border-border bg-card hover:border-primary/30"}`}>
            {p.featured && (
              <div className="absolute -top-3 right-1/2 translate-x-1/2 px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-bold">
                الأكثر شعبية
              </div>
            )}
            <div className="font-bold text-lg mb-2">{p.name}</div>
            <div className="flex items-baseline gap-1 mb-2">
              <span className="text-5xl font-black">{p.price}</span>
              <span className="text-sm text-muted-foreground">{p.period}</span>
            </div>
            <p className="text-sm text-muted-foreground mb-6">{p.desc}</p>
            <Link to="/auth">
              <Button className="w-full mb-6" variant={p.featured ? "default" : "outline"} size="lg">{p.cta}</Button>
            </Link>
            <ul className="space-y-3">
              {p.features.map((f, i) => (
                <li key={i} className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ============ TESTIMONIALS ============ */
function Testimonials() {
  const items = [
    { name: "د. أحمد المالكي", role: "أكاديمية الأعمال", text: "أطلقت منصتي خلال يوم واحد، والآن لديّ 500 طالب نشط. التجربة مذهلة!", stars: 5 },
    { name: "سارة العتيبي", role: "معلمة لغة إنجليزية", text: "كل ما أحتاجه في مكان واحد — لا حاجة لمطورين أو أدوات معقدة.", stars: 5 },
    { name: "خالد الحربي", role: "مدرّب تطوير ذاتي", text: "نظام المدفوعات والشهادات وفّر عليّ ساعات من العمل اليدوي.", stars: 5 },
  ];
  return (
    <section className="py-24 bg-muted/30">
      <div className="container mx-auto px-6">
        <SectionHead eyebrow="الآراء" title="معلمون يثقون في EduForge" subtitle="انضم لآلاف المعلمين الذين بنوا منصاتهم معنا." />
        <div className="grid md:grid-cols-3 gap-6 mt-14">
          {items.map((t, i) => (
            <div key={i} className="bg-card border rounded-2xl p-7 hover:shadow-xl transition relative">
              <div className="flex gap-0.5 mb-4">
                {Array.from({ length: t.stars }).map((_, j) => (
                  <Star key={j} className="h-4 w-4 fill-chart-4 text-chart-4" />
                ))}
              </div>
              <p className="text-foreground/90 leading-relaxed mb-6">"{t.text}"</p>
              <div className="flex items-center gap-3 pt-4 border-t">
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary to-foreground grid place-items-center text-primary-foreground font-bold">
                  {t.name.charAt(0)}
                </div>
                <div>
                  <div className="font-semibold text-sm">{t.name}</div>
                  <div className="text-xs text-muted-foreground">{t.role}</div>
                </div>
              </div>
              <MessageSquare className="absolute top-6 left-6 h-8 w-8 text-muted-foreground/20" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============ FAQ ============ */
function FAQ() {
  const items = [
    { q: "هل أحتاج لخبرة تقنية لاستخدام EduForge؟", a: "أبداً. المنصة مصممة بحيث يستطيع أي معلم إنشاء أكاديميته دون أي معرفة تقنية. كل شيء بضغطة زر." },
    { q: "هل يمكنني استخدام دوميني الخاص؟", a: "نعم، الخطة الاحترافية تتيح ربط دومين مخصص بسهولة عبر إعدادات DNS." },
    { q: "كيف تتم عملية الدفع من الطلاب؟", a: "ندعم التحويل البنكي، Stripe وPaddle، بالإضافة للكوبونات والحزم المخصصة." },
    { q: "هل بياناتي ودوراتي آمنة؟", a: "نعم، نستخدم RLS وعزل بيانات كامل بين المنصات مع نسخ احتياطي يومي." },
    { q: "هل توجد عمولة على المبيعات؟", a: "في الخطة الاحترافية لا توجد أي عمولة — تحتفظ بـ 100٪ من إيراداتك." },
  ];
  return (
    <section id="faq" className="container mx-auto px-6 py-24 max-w-3xl">
      <SectionHead eyebrow="الأسئلة الشائعة" title="إجابات على ما يدور في ذهنك" subtitle="" />
      <div className="space-y-3 mt-14">
        {items.map((f, i) => (
          <details key={i} className="group bg-card border rounded-2xl p-6 hover:border-primary/50 transition">
            <summary className="flex items-center justify-between cursor-pointer list-none font-semibold">
              {f.q}
              <span className="h-6 w-6 rounded-full bg-muted grid place-items-center text-xs font-bold group-open:rotate-45 transition-transform">+</span>
            </summary>
            <p className="mt-4 text-muted-foreground leading-relaxed">{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

/* ============ FINAL CTA ============ */
function FinalCTA() {
  return (
    <section className="container mx-auto px-6 py-24">
      <div className="relative rounded-[2rem] overflow-hidden p-12 md:p-20 text-center text-background bg-foreground">
        <div className="absolute inset-0 bg-grid-pattern text-background/10" />
        <div className="absolute -top-32 right-1/4 w-96 h-96 rounded-full bg-primary/40 blur-3xl" />
        <div className="absolute -bottom-32 left-1/4 w-96 h-96 rounded-full bg-primary/30 blur-3xl" />
        <div className="relative">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium bg-background/10 backdrop-blur border border-background/20 mb-6">
            <Sparkles className="h-3 w-3" /> ابدأ رحلتك التعليمية
          </div>
          <h2 className="text-4xl md:text-6xl font-black mb-6 leading-tight">
            منصتك التعليمية
            <br />
            على بُعد <span className="text-primary-foreground bg-primary px-3 rounded-2xl">5 دقائق</span>
          </h2>
          <p className="text-lg md:text-xl text-background/70 max-w-xl mx-auto mb-10">
            انضم لمئات المعلمين الذين أطلقوا أكاديمياتهم معنا. مجاناً للأبد.
          </p>
          <div className="flex justify-center gap-3 flex-wrap">
            <Link to="/auth">
              <Button size="lg" variant="secondary" className="h-14 px-8 text-base shadow-2xl">
                <Rocket className="h-5 w-5 ms-2" /> ابدأ مجاناً الآن
              </Button>
            </Link>
            <Link to="/search">
              <Button size="lg" variant="outline" className="h-14 px-8 text-base bg-transparent text-background border-background/30 hover:bg-background hover:text-foreground">
                تصفّح المنصات
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ============ FOOTER ============ */
function Footer() {
  return (
    <footer className="border-t bg-muted/30">
      <div className="container mx-auto px-6 py-12">
        <div className="grid md:grid-cols-4 gap-8 mb-8">
          <div>
            <Link to="/" className="flex items-center gap-2 font-black text-lg mb-3">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-foreground grid place-items-center text-primary-foreground">
                <GraduationCap className="h-4 w-4" />
              </div>
              EduForge
            </Link>
            <p className="text-sm text-muted-foreground">منصة إطلاق الأكاديميات الإلكترونية للعالم العربي.</p>
          </div>
          <FooterCol title="المنتج" links={[["المميزات", "#features"], ["الأسعار", "#pricing"], ["كيف يعمل", "#how"]]} />
          <FooterCol title="الشركة" links={[["من نحن", "/"], ["تواصل معنا", "/"], ["المدونة", "/"]]} />
          <FooterCol title="قانوني" links={[["الخصوصية", "/"], ["الشروط", "/"], ["الأمان", "/"]]} />
        </div>
        <div className="border-t pt-6 flex items-center justify-between flex-wrap gap-4 text-sm text-muted-foreground">
          <div>© 2026 EduForge. جميع الحقوق محفوظة.</div>
          <div className="flex items-center gap-4">
            <span>صُنع بحب 💙 للمعلم العربي</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <div className="font-bold text-sm mb-3">{title}</div>
      <ul className="space-y-2 text-sm text-muted-foreground">
        {links.map(([label, href]) => (
          <li key={label}><a href={href} className="hover:text-foreground transition">{label}</a></li>
        ))}
      </ul>
    </div>
  );
}

function SectionHead({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle?: string }) {
  return (
    <div className="text-center max-w-2xl mx-auto">
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest text-primary bg-primary/10 mb-4">
        {eyebrow}
      </div>
      <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-4">{title}</h2>
      {subtitle && <p className="text-lg text-muted-foreground leading-relaxed">{subtitle}</p>}
    </div>
  );
}

import { memo } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  Zap, Video, Users, CreditCard, Award, BarChart3, Palette, ShieldCheck, Globe,
  CheckCircle2, Star, MessageSquare, Rocket, ArrowLeft, Sparkles, GraduationCap,
  Layers, PlayCircle,
} from "lucide-react";
import { trackLanding } from "@/lib/landing-track";

const ICONS: Record<string, any> = {
  Zap, Video, Users, CreditCard, Award, BarChart3, Palette, ShieldCheck, Globe,
  Layers, PlayCircle, GraduationCap, Rocket, Sparkles, Star,
};

function SectionHead({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle?: string }) {
  return (
    <div className="text-center max-w-2xl mx-auto px-2">
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] sm:text-xs font-bold uppercase tracking-widest text-primary bg-primary/10 mb-4">
        {eyebrow}
      </div>
      <h2 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight mb-4">{title}</h2>
      {subtitle && <p className="text-base sm:text-lg text-muted-foreground leading-relaxed">{subtitle}</p>}
    </div>
  );
}

export const FeaturesSection = memo(function FeaturesSection({ items }: { items: any[] }) {
  if (!items?.length) return null;
  return (
    <section id="features" className="container mx-auto px-4 sm:px-6 py-16 sm:py-24">
      <SectionHead eyebrow="المميزات" title="كل ما تحتاجه لإطلاق أكاديميتك" subtitle="مجموعة أدوات متكاملة مصممة خصيصاً للمعلم العربي ورائد الأعمال التعليمي." />
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 mt-10 sm:mt-14">
        {items.map((f, i) => {
          const Icon = ICONS[f.icon] ?? Sparkles;
          return (
            <div key={i} className="group relative bg-card border rounded-2xl p-5 sm:p-7 hover:border-primary/50 hover:shadow-2xl hover:-translate-y-1 transition-all duration-300">
              <div className={`relative h-11 w-11 sm:h-12 sm:w-12 rounded-xl bg-gradient-to-br ${f.color ?? "from-primary to-foreground"} grid place-items-center text-white shadow-lg mb-4 sm:mb-5`}>
                <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              <h3 className="text-base sm:text-lg font-bold mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
});

export const StatsStrip = memo(function StatsStrip({ stats }: { stats: { tenants: number; courses: number; students: number } }) {
  const items = [
    { value: stats.tenants, label: "منصة نشطة", suffix: "+" },
    { value: stats.courses, label: "دورة منشورة", suffix: "+" },
    { value: stats.students, label: "طالب مسجّل", suffix: "+" },
    { value: 99, label: "رضا المعلمين", suffix: "%" },
  ];
  return (
    <section className="py-14 sm:py-20 bg-foreground text-background">
      <div className="container mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8 text-center">
          {items.map((s, i) => (
            <div key={i}>
              <div className="text-3xl sm:text-5xl md:text-6xl font-black">
                {s.value.toLocaleString("ar")}{s.suffix}
              </div>
              <div className="text-xs sm:text-sm text-background/70 mt-2">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
});

export const Tenants = memo(function Tenants({ tenants }: { tenants: any[] }) {
  if (!tenants.length) return null;
  return (
    <section className="container mx-auto px-4 sm:px-6 py-16 sm:py-24">
      <SectionHead eyebrow="المنصات" title="منصات تعليمية تنطلق من EduForge" subtitle="انضم لمئات المعلمين الذين بنوا أعمالهم التعليمية معنا." />
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 mt-10 sm:mt-14">
        {tenants.map((t) => (
          <Link key={t.id} to="/t/$slug" params={{ slug: t.slug }} onClick={() => trackLanding("cta_click", "tenant_card", { slug: t.slug })}>
            <div className="group relative h-full bg-card border rounded-2xl p-5 sm:p-6 hover:border-primary/50 hover:shadow-xl hover:-translate-y-1 transition-all overflow-hidden">
              <div className="absolute -top-12 -start-12 w-32 h-32 rounded-full opacity-10 group-hover:opacity-20 transition blur-2xl"
                   style={{ background: t.primary_color ?? "var(--primary)" }} />
              <div className="relative">
                {t.logo_url ? (
                  <img src={t.logo_url} alt={t.name} loading="lazy" decoding="async" width={56} height={56} className="h-14 w-14 rounded-xl object-cover mb-4 shadow-lg" />
                ) : (
                  <div className="h-14 w-14 rounded-xl grid place-items-center text-white text-xl font-black mb-4 shadow-lg"
                       style={{ background: `linear-gradient(135deg, ${t.primary_color ?? "#6366f1"}, ${t.secondary_color ?? "#D4AF37"})` }}>
                    {t.name.charAt(0)}
                  </div>
                )}
                <div className="font-bold text-base mb-1 truncate">{t.name}</div>
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
});

export const FeaturedCourses = memo(function FeaturedCourses({ courses }: { courses: any[] }) {
  if (!courses?.length) return null;
  return (
    <section id="courses" className="container mx-auto px-4 sm:px-6 py-16 sm:py-24">
      <SectionHead eyebrow="الدورات" title="أحدث الدورات على EduForge" subtitle="استكشف دورات مختارة من مختلف المنصات وابدأ التعلم الآن." />
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 mt-10 sm:mt-14">
        {courses.map((c) => (
          <Link
            key={c.id}
            to="/t/$slug/courses/$courseSlug"
            params={{ slug: c.tenant_slug, courseSlug: c.slug }}
            preload="intent"
            onClick={() => trackLanding("cta_click", "course_card", { course: c.slug, tenant: c.tenant_slug })}
            className="group block bg-card border rounded-2xl overflow-hidden hover:border-primary/50 hover:shadow-xl hover:-translate-y-1 transition-all"
          >
            <div className="aspect-video bg-muted overflow-hidden">
              {c.cover_url ? (
                <img src={c.cover_url} alt={c.title} loading="lazy" decoding="async" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              ) : (
                <div className="w-full h-full grid place-items-center bg-gradient-to-br from-primary/20 to-foreground/10">
                  <PlayCircle className="h-10 w-10 text-primary/60" />
                </div>
              )}
            </div>
            <div className="p-4 sm:p-5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-primary/80 mb-2 truncate">{c.tenant_name}</div>
              <h3 className="font-bold text-sm sm:text-base mb-3 line-clamp-2 min-h-[2.5rem]">{c.title}</h3>
              <div className="flex items-center justify-between">
                <span className="text-sm font-black text-primary">
                  {c.is_free || !c.price || Number(c.price) === 0 ? "مجاني" : `${Number(c.price).toLocaleString("ar")} ر.س`}
                </span>
                <span className="text-xs text-muted-foreground inline-flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                  ابدأ الآن <ArrowLeft className="h-3 w-3" />
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
});

export const HowItWorks = memo(function HowItWorks({ steps }: { steps: any[] }) {
  if (!steps?.length) return null;
  return (
    <section id="how" className="py-16 sm:py-24 bg-muted/30">
      <div className="container mx-auto px-4 sm:px-6">
        <SectionHead eyebrow="كيف يعمل" title="أربع خطوات تفصلك عن أكاديميتك" subtitle="عملية بسيطة مصممة لإطلاق منصتك بأسرع وقت." />
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mt-10 sm:mt-14">
          {steps.map((s, i) => (
            <div key={i} className="relative">
              <div className="bg-card border-2 rounded-2xl p-5 sm:p-6 h-full hover:border-primary transition-all">
                <div className="text-4xl sm:text-5xl font-black text-primary/20 mb-3">{s.n}</div>
                <div className="font-bold text-base sm:text-lg mb-2">{s.title}</div>
                <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
});

export const Pricing = memo(function Pricing({ plans }: { plans: any[] }) {
  if (!plans?.length) return null;
  return (
    <section id="pricing" className="container mx-auto px-4 sm:px-6 py-16 sm:py-24">
      <SectionHead eyebrow="الأسعار" title="أسعار شفافة تنمو معك" subtitle="ابدأ مجاناً وانتقل للاحترافي عندما تكون جاهزاً للتوسع." />
      <div className="grid md:grid-cols-3 gap-5 sm:gap-6 mt-10 sm:mt-14 max-w-5xl mx-auto">
        {plans.map((p) => (
          <div key={p.name} className={`relative rounded-3xl p-6 sm:p-8 border-2 transition-all hover:-translate-y-1 ${p.featured ? "border-primary bg-gradient-to-b from-primary/5 to-card shadow-2xl shadow-primary/10 md:scale-105" : "border-border bg-card hover:border-primary/30"}`}>
            {p.featured && (
              <div className="absolute -top-3 start-1/2 -translate-x-1/2 rtl:translate-x-1/2 px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-bold">
                الأكثر شعبية
              </div>
            )}
            <div className="font-bold text-lg mb-2">{p.name}</div>
            <div className="flex items-baseline gap-1 mb-2">
              <span className="text-4xl sm:text-5xl font-black">{p.price}</span>
              <span className="text-sm text-muted-foreground">{p.period}</span>
            </div>
            <p className="text-sm text-muted-foreground mb-6">{p.desc}</p>
            <Link to="/auth" onClick={() => trackLanding("cta_click", `pricing_${p.name}`)}>
              <Button className="w-full mb-6" variant={p.featured ? "default" : "outline"} size="lg">{p.cta}</Button>
            </Link>
            <ul className="space-y-3">
              {(p.features ?? []).map((f: string, i: number) => (
                <li key={i} className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
});

export const Testimonials = memo(function Testimonials({ items }: { items: any[] }) {
  if (!items?.length) return null;
  return (
    <section className="py-16 sm:py-24 bg-muted/30">
      <div className="container mx-auto px-4 sm:px-6">
        <SectionHead eyebrow="الآراء" title="معلمون يثقون في EduForge" subtitle="انضم لآلاف المعلمين الذين بنوا منصاتهم معنا." />
        <div className="grid md:grid-cols-3 gap-5 sm:gap-6 mt-10 sm:mt-14">
          {items.map((t, i) => (
            <div key={i} className="bg-card border rounded-2xl p-6 sm:p-7 hover:shadow-xl transition relative">
              <div className="flex gap-0.5 mb-4">
                {Array.from({ length: t.stars ?? 5 }).map((_, j) => (
                  <Star key={j} className="h-4 w-4 fill-chart-4 text-chart-4" />
                ))}
              </div>
              <p className="text-foreground/90 leading-relaxed mb-6">"{t.text}"</p>
              <div className="flex items-center gap-3 pt-4 border-t">
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary to-foreground grid place-items-center text-primary-foreground font-bold shrink-0">
                  {t.name?.charAt(0)}
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-sm truncate">{t.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{t.role}</div>
                </div>
              </div>
              <MessageSquare className="absolute top-6 start-6 h-8 w-8 text-muted-foreground/20" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
});

export const FAQ = memo(function FAQ({ items }: { items: any[] }) {
  if (!items?.length) return null;
  return (
    <section id="faq" className="container mx-auto px-4 sm:px-6 py-16 sm:py-24 max-w-3xl">
      <SectionHead eyebrow="الأسئلة الشائعة" title="إجابات على ما يدور في ذهنك" />
      <div className="space-y-3 mt-10 sm:mt-14">
        {items.map((f, i) => (
          <details key={i} className="group bg-card border rounded-2xl p-5 sm:p-6 hover:border-primary/50 transition">
            <summary className="flex items-center justify-between gap-4 cursor-pointer list-none font-semibold">
              <span className="flex-1 min-w-0">{f.q}</span>
              <span className="h-6 w-6 rounded-full bg-muted grid place-items-center text-xs font-bold group-open:rotate-45 transition-transform shrink-0">+</span>
            </summary>
            <p className="mt-4 text-muted-foreground leading-relaxed">{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
});

export const FinalCTA = memo(function FinalCTA() {
  return (
    <section className="container mx-auto px-4 sm:px-6 py-16 sm:py-24">
      <div className="relative rounded-3xl sm:rounded-[2rem] overflow-hidden p-8 sm:p-12 md:p-20 text-center text-background bg-foreground">
        <div className="absolute inset-0 bg-grid-pattern text-background/10" />
        <div className="absolute -top-32 end-1/4 w-72 sm:w-96 h-72 sm:h-96 rounded-full bg-primary/40 blur-3xl" />
        <div className="absolute -bottom-32 start-1/4 w-72 sm:w-96 h-72 sm:h-96 rounded-full bg-primary/30 blur-3xl" />
        <div className="relative">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium bg-background/10 backdrop-blur border border-background/20 mb-6">
            <Sparkles className="h-3 w-3" /> ابدأ رحلتك التعليمية
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-6xl font-black mb-6 leading-tight">
            منصتك التعليمية
            <br />
            على بُعد <span className="text-primary-foreground bg-primary px-3 rounded-2xl inline-block">5 دقائق</span>
          </h2>
          <p className="text-base sm:text-lg md:text-xl text-background/70 max-w-xl mx-auto mb-8 sm:mb-10">
            انضم لمئات المعلمين الذين أطلقوا أكاديمياتهم معنا. مجاناً للأبد.
          </p>
          <div className="flex justify-center gap-3 flex-wrap">
            <Link to="/auth" onClick={() => trackLanding("cta_click", "final_primary")}>
              <Button size="lg" variant="secondary" className="h-12 sm:h-14 px-6 sm:px-8 text-sm sm:text-base shadow-2xl">
                <Rocket className="h-5 w-5 ms-2" /> ابدأ مجاناً الآن
              </Button>
            </Link>
            <Link to="/search" onClick={() => trackLanding("cta_click", "final_secondary")}>
              <Button size="lg" variant="outline" className="h-12 sm:h-14 px-6 sm:px-8 text-sm sm:text-base bg-transparent text-background border-background/30 hover:bg-background hover:text-foreground">
                تصفّح المنصات
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
});

export const SiteFooter = memo(function SiteFooter() {
  const cols = [
    { title: "المنتج", links: [["المميزات", "#features"], ["الأسعار", "#pricing"], ["كيف يعمل", "#how"]] },
    { title: "الشركة", links: [["من نحن", "/"], ["تواصل معنا", "/"], ["المدونة", "/"]] },
    { title: "قانوني", links: [["الخصوصية", "/"], ["الشروط", "/"], ["الأمان", "/"]] },
  ] as const;
  return (
    <footer className="border-t bg-muted/30">
      <div className="container mx-auto px-4 sm:px-6 py-10 sm:py-12">
        <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-8 mb-8">
          <div>
            <Link to="/" className="flex items-center gap-2 font-black text-lg mb-3">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-foreground grid place-items-center text-primary-foreground">
                <GraduationCap className="h-4 w-4" />
              </div>
              EduForge
            </Link>
            <p className="text-sm text-muted-foreground">منصة إطلاق الأكاديميات الإلكترونية للعالم العربي.</p>
          </div>
          {cols.map((c) => (
            <div key={c.title}>
              <div className="font-bold text-sm mb-3">{c.title}</div>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {c.links.map(([label, href]) => (
                  <li key={label}><a href={href} className="hover:text-foreground transition">{label}</a></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="border-t pt-6 flex items-center justify-between flex-wrap gap-4 text-sm text-muted-foreground">
          <div>© 2026 EduForge. جميع الحقوق محفوظة.</div>
          <div>صُنع بحب 💙 للمعلم العربي</div>
        </div>
      </div>
    </footer>
  );
});

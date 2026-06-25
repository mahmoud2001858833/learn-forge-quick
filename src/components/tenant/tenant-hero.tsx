import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { GraduationCap, Sparkles, BookOpen, Users, Award, Star, ArrowLeft, Zap } from "lucide-react";

export type TenantHeroProps = {
  slug: string;
  tenant: {
    name: string;
    description: string | null;
    welcome_message: string | null;
    primary_color: string | null;
    secondary_color: string | null;
    logo_url: string | null;
    hero_image_url: string | null;
    hero_title?: string | null;
    hero_subtitle?: string | null;
    theme?: string | null;
  };
  stats?: { courses: number; students: number } | null;
};

export function TenantHero(props: TenantHeroProps) {
  const theme = props.tenant.theme ?? "classic";
  if (theme === "modern") return <ModernHero {...props} />;
  if (theme === "bold") return <BoldHero {...props} />;
  if (theme === "minimal") return <MinimalHero {...props} />;
  return <ClassicHero {...props} />;
}

function getColors(t: TenantHeroProps["tenant"]) {
  return {
    primary: t.primary_color ?? "#6366f1",
    secondary: t.secondary_color ?? "#D4AF37",
  };
}

function getCopy(t: TenantHeroProps["tenant"]) {
  return {
    title: t.hero_title ?? t.name,
    subtitle: t.hero_subtitle ?? t.welcome_message ?? t.description ?? "",
  };
}

/* ============= CLASSIC — current rich hero ============= */
function ClassicHero({ slug, tenant, stats }: TenantHeroProps) {
  const { primary, secondary } = getColors(tenant);
  const { title, subtitle } = getCopy(tenant);

  return (
    <section className="relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-[0.08]"
        style={{
          background: `radial-gradient(circle at 20% 30%, ${primary} 0%, transparent 50%), radial-gradient(circle at 80% 70%, ${secondary} 0%, transparent 50%)`,
        }}
      />
      <div className="container mx-auto px-6 py-16 md:py-24 relative">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-6 order-2 lg:order-1">
            <div
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium border"
              style={{ borderColor: `${primary}40`, color: primary, background: `${primary}10` }}
            >
              <Sparkles className="h-3 w-3" /> منصة تعليمية رقمية
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight leading-tight">
              مرحباً بك في{" "}
              <span
                className="bg-clip-text text-transparent"
                style={{ backgroundImage: `linear-gradient(135deg, ${primary}, ${secondary})` }}
              >
                {title}
              </span>
            </h1>
            {subtitle && <p className="text-lg md:text-xl text-muted-foreground leading-relaxed">{subtitle}</p>}
            <HeroCTAs slug={slug} primary={primary} secondary={secondary} />
            {stats && (
              <div className="grid grid-cols-3 gap-4 pt-6 border-t">
                <Stat label="دورة" value={stats.courses} icon={BookOpen} color={primary} />
                <Stat label="طالب" value={stats.students} icon={Users} color={primary} />
                <Stat label="شهادة" value={stats.students} icon={Award} color={primary} />
              </div>
            )}
          </div>
          <div className="order-1 lg:order-2 relative flex items-center justify-center min-h-[320px] lg:min-h-[440px]">
            <div className="absolute top-6 right-10 w-32 h-32 rounded-full blur-3xl opacity-40" style={{ background: primary }} />
            <div className="absolute bottom-6 left-10 w-40 h-40 rounded-full blur-3xl opacity-30" style={{ background: secondary }} />
            <div className="absolute top-4 left-2 sm:left-8 animate-bounce-slow">
              <div className="bg-card border shadow-xl rounded-2xl p-3 flex items-center gap-2">
                <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                <span className="text-sm font-semibold">جودة عالية</span>
              </div>
            </div>
            <div className="absolute bottom-8 right-4 sm:right-8 animate-bounce-slow [animation-delay:1s]">
              <div className="bg-card border shadow-xl rounded-2xl p-3 flex items-center gap-2">
                <Award className="h-5 w-5" style={{ color: secondary }} />
                <span className="text-sm font-semibold">شهادات معتمدة</span>
              </div>
            </div>
            <div className="relative">
              <div className="absolute -inset-4 rounded-[2rem] blur-2xl opacity-50" style={{ background: `linear-gradient(135deg, ${primary}, ${secondary})` }} />
              <div className="relative bg-card border-2 rounded-[2rem] p-8 shadow-2xl">
                <LogoOrImage tenant={tenant} primary={primary} secondary={secondary} size="lg" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ============= MODERN — centered, glassy gradient ============= */
function ModernHero({ slug, tenant, stats }: TenantHeroProps) {
  const { primary, secondary } = getColors(tenant);
  const { title, subtitle } = getCopy(tenant);

  return (
    <section
      className="relative overflow-hidden text-white"
      style={{ background: `linear-gradient(135deg, ${primary}, ${secondary})` }}
    >
      <div className="absolute inset-0 bg-grid-pattern opacity-10" />
      <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-white/10 blur-3xl" />
      <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-white/10 blur-3xl" />
      <div className="container mx-auto px-6 py-24 md:py-32 relative text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium bg-white/15 backdrop-blur-md border border-white/20 mb-6">
          <Sparkles className="h-3 w-3" /> تجربة تعليمية حديثة
        </div>
        <h1 className="text-5xl md:text-7xl font-black tracking-tight mb-6 drop-shadow-lg">{title}</h1>
        {subtitle && <p className="text-lg md:text-2xl text-white/90 max-w-2xl mx-auto mb-8 leading-relaxed">{subtitle}</p>}
        <div className="flex justify-center gap-3 flex-wrap">
          <Link to="/t/$slug/courses" params={{ slug }}>
            <Button size="lg" variant="secondary" className="shadow-xl">
              <BookOpen className="h-4 w-4 ms-2" /> ابدأ التعلم الآن
            </Button>
          </Link>
          <Link to="/t/$slug/auth" params={{ slug }} search={{ mode: "signup" }}>
            <Button size="lg" variant="outline" className="bg-transparent text-white border-white hover:bg-white hover:text-foreground">
              إنشاء حساب
            </Button>
          </Link>
        </div>
        {stats && (
          <div className="mt-16 grid grid-cols-3 gap-4 max-w-2xl mx-auto">
            <GlassStat label="دورة" value={stats.courses} icon={BookOpen} />
            <GlassStat label="طالب" value={stats.students} icon={Users} />
            <GlassStat label="شهادة" value={stats.students} icon={Award} />
          </div>
        )}
      </div>
    </section>
  );
}

/* ============= BOLD — magazine-style, big typography ============= */
function BoldHero({ slug, tenant, stats }: TenantHeroProps) {
  const { primary, secondary } = getColors(tenant);
  const { title, subtitle } = getCopy(tenant);

  return (
    <section className="relative overflow-hidden bg-foreground text-background">
      <div className="container mx-auto px-6 py-16 md:py-24">
        <div className="grid lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-7 space-y-6">
            <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest" style={{ color: secondary }}>
              <Zap className="h-4 w-4" /> منصة بلا حدود
            </div>
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-black leading-[0.95] tracking-tight">
              {title.split(" ").map((word, i) => (
                <span key={i} className={i % 2 === 1 ? "italic" : ""} style={i % 2 === 1 ? { color: secondary } : undefined}>
                  {word}{" "}
                </span>
              ))}
            </h1>
            {subtitle && <p className="text-xl text-background/70 max-w-xl leading-relaxed">{subtitle}</p>}
            <div className="flex flex-wrap gap-3 pt-4">
              <Link to="/t/$slug/courses" params={{ slug }}>
                <Button
                  size="lg"
                  className="text-foreground bg-background hover:bg-background/90 border-0 font-bold"
                >
                  استكشف الدورات <ArrowLeft className="h-4 w-4 me-2" />
                </Button>
              </Link>
              <Link to="/t/$slug/auth" params={{ slug }} search={{ mode: "signup" }}>
                <Button size="lg" variant="outline" className="bg-transparent text-background border-background/30 hover:bg-background hover:text-foreground">
                  انضم مجاناً
                </Button>
              </Link>
            </div>
          </div>
          <div className="lg:col-span-5 relative">
            <div
              className="aspect-square rounded-3xl p-8 flex items-center justify-center relative overflow-hidden border-4"
              style={{ borderColor: secondary, background: `linear-gradient(135deg, ${primary}, ${secondary})` }}
            >
              <LogoOrImage tenant={tenant} primary={primary} secondary={secondary} size="xl" />
            </div>
            {stats && (
              <div className="absolute -bottom-6 -left-6 bg-background text-foreground rounded-2xl p-4 shadow-2xl border-4 border-foreground">
                <div className="text-3xl font-black" style={{ color: primary }}>{stats.students.toLocaleString("ar")}+</div>
                <div className="text-xs uppercase font-bold tracking-wider">طالب نشط</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ============= MINIMAL — clean, spacious, single column ============= */
function MinimalHero({ slug, tenant, stats }: TenantHeroProps) {
  const { primary, secondary } = getColors(tenant);
  const { title, subtitle } = getCopy(tenant);

  return (
    <section className="relative">
      <div className="container mx-auto px-6 py-20 md:py-32">
        <div className="max-w-3xl">
          <div className="w-16 h-1 rounded-full mb-8" style={{ background: primary }} />
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-6 leading-tight">{title}</h1>
          {subtitle && <p className="text-xl text-muted-foreground leading-relaxed mb-10 max-w-2xl">{subtitle}</p>}
          <div className="flex flex-wrap gap-4 items-center">
            <Link to="/t/$slug/courses" params={{ slug }}>
              <Button size="lg" className="text-white" style={{ background: primary }}>
                تصفّح الدورات <ArrowLeft className="h-4 w-4 me-2" />
              </Button>
            </Link>
            <Link to="/auth" className="text-sm font-medium hover:underline" style={{ color: primary }}>
              إنشاء حساب جديد ←
            </Link>
          </div>
          {stats && (
            <div className="flex gap-12 mt-16 pt-8 border-t">
              <div>
                <div className="text-3xl font-bold">{stats.courses.toLocaleString("ar")}</div>
                <div className="text-sm text-muted-foreground mt-1">دورة منشورة</div>
              </div>
              <div>
                <div className="text-3xl font-bold">{stats.students.toLocaleString("ar")}</div>
                <div className="text-sm text-muted-foreground mt-1">طالب مسجّل</div>
              </div>
              <div>
                <div className="text-3xl font-bold" style={{ color: secondary }}>★ 4.8</div>
                <div className="text-sm text-muted-foreground mt-1">تقييم متوسط</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/* ============= Shared bits ============= */
function HeroCTAs({ slug, primary, secondary }: { slug: string; primary: string; secondary: string }) {
  return (
    <div className="flex flex-wrap gap-3 pt-2">
      <Link to="/t/$slug/courses" params={{ slug }}>
        <Button size="lg" className="text-white border-0 shadow-lg" style={{ background: `linear-gradient(135deg, ${primary}, ${secondary})` }}>
          <BookOpen className="h-4 w-4 ms-2" /> تصفّح الدورات
        </Button>
      </Link>
      <Link to="/auth">
        <Button size="lg" variant="outline">إنشاء حساب جديد</Button>
      </Link>
    </div>
  );
}

function LogoOrImage({ tenant, primary, secondary, size }: { tenant: TenantHeroProps["tenant"]; primary: string; secondary: string; size: "lg" | "xl" }) {
  const dim = size === "xl" ? "w-64 h-64 sm:w-80 sm:h-80" : "w-56 h-56 sm:w-64 sm:h-64";
  if (tenant.hero_image_url) return <img src={tenant.hero_image_url} alt={tenant.name} className={`${dim} object-cover rounded-2xl`} />;
  if (tenant.logo_url) return <img src={tenant.logo_url} alt={tenant.name} className={`${dim} object-contain rounded-2xl`} />;
  return (
    <div
      className={`${dim} rounded-2xl grid place-items-center text-white`}
      style={{ background: `linear-gradient(135deg, ${primary}, ${secondary})` }}
    >
      <GraduationCap className={size === "xl" ? "h-40 w-40" : "h-32 w-32"} />
    </div>
  );
}

function Stat({ label, value, icon: Icon, color }: { label: string; value: number; icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; color: string }) {
  return (
    <div>
      <Icon className="h-5 w-5 mb-1" style={{ color }} />
      <div className="text-2xl font-bold">{value.toLocaleString("ar")}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function GlassStat({ label, value, icon: Icon }: { label: string; value: number; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-4">
      <Icon className="h-5 w-5 mb-2 mx-auto" />
      <div className="text-2xl font-bold">{value.toLocaleString("ar")}</div>
      <div className="text-xs text-white/80">{label}</div>
    </div>
  );
}

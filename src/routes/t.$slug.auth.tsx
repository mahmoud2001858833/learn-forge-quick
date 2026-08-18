import { createFileRoute, useNavigate, Link, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, resetLocalSessionToken } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { GraduationCap, ArrowRight, Sparkles, ShieldCheck, BookOpen } from "lucide-react";
import { claimSession } from "@/lib/auth.functions";
import { cn } from "@/lib/utils";

type AuthSearch = {
  mode?: "signup" | "signin";
  ref?: string;
};

export const Route = createFileRoute("/t/$slug/auth")({
  ssr: false,
  component: TenantAuthPage,
  validateSearch: (s: Record<string, unknown>): AuthSearch => ({
    mode: s.mode === "signup" ? "signup" : "signin",
    ...(typeof s.ref === "string" ? { ref: s.ref } : {}),
  }),
});

const COUNTRY_CODES = [
  { code: "+966", label: "🇸🇦 السعودية" },
  { code: "+962", label: "🇯🇴 الأردن" },
  { code: "+971", label: "🇦🇪 الإمارات" },
  { code: "+965", label: "🇰🇼 الكويت" },
  { code: "+974", label: "🇶🇦 قطر" },
  { code: "+973", label: "🇧🇭 البحرين" },
  { code: "+968", label: "🇴🇲 عُمان" },
  { code: "+20", label: "🇪🇬 مصر" },
];

async function finalizeLogin() {
  const token = resetLocalSessionToken();
  await claimSession({
    data: {
      session_token: token,
      user_agent: navigator.userAgent.slice(0, 500),
      device_label: navigator.platform,
    },
  });
}

function TenantAuthPage() {
  const { slug } = useParams({ from: "/t/$slug/auth" });
  const { mode } = Route.useSearch();
  const navigate = useNavigate();
  const { session, loading } = useAuth();

  const { data: tenant } = useQuery({
    queryKey: ["public-tenant", slug],
    queryFn: async () => (await supabase.from("tenants").select("*").eq("slug", slug).maybeSingle()).data,
  });

  useEffect(() => {
    // Do not auto-redirect a signed-in user away from the auth page.
    // Owner/admin often lands here to test signup/signin flows for their tenant;
    // instead we render an "already signed in" panel below with a switch-account option.
  }, [loading, session, navigate, slug]);

  if (!tenant) {
    return <div className="min-h-screen grid place-items-center text-muted-foreground">جارٍ التحميل...</div>;
  }

  const alreadySignedIn = !!session;

  const primary = tenant.primary_color ?? "#6366f1";
  const secondary = tenant.secondary_color ?? "#D4AF37";
  const theme = tenant.theme ?? "classic";

  return (
    <div
      className="min-h-screen flex flex-col lg:flex-row"
      dir="rtl"
      style={{ "--tenant-primary": primary, "--tenant-secondary": secondary } as React.CSSProperties}
    >
      {/* Left brand panel */}
      <aside
        className="relative overflow-hidden lg:w-[45%] xl:w-1/2 min-h-[260px] lg:min-h-screen flex flex-col justify-between p-8 lg:p-14 text-white"
        style={{
          background:
            theme === "bold"
              ? `linear-gradient(160deg, #0f172a 0%, ${primary} 60%, ${secondary} 100%)`
              : `linear-gradient(160deg, ${primary} 0%, ${secondary} 100%)`,
        }}
      >
        <div
          className="absolute inset-0 opacity-30 pointer-events-none"
          style={{
            background:
              "radial-gradient(circle at 25% 20%, rgba(255,255,255,0.35) 0%, transparent 45%), radial-gradient(circle at 80% 80%, rgba(255,255,255,0.25) 0%, transparent 45%)",
          }}
        />
        {tenant.hero_image_url && (
          <img
            src={tenant.hero_image_url}
            alt=""
            className="absolute inset-0 w-full h-full object-cover opacity-20 mix-blend-overlay"
            aria-hidden
          />
        )}

        <div className="relative z-10 flex items-center justify-between">
          <Link to="/t/$slug" params={{ slug }} className="flex items-center gap-3 group">
            {tenant.logo_url ? (
              <img src={tenant.logo_url} alt={tenant.name} className="h-12 w-12 rounded-2xl object-cover ring-2 ring-white/40 shadow-lg" />
            ) : (
              <div className="h-12 w-12 rounded-2xl bg-white/15 backdrop-blur-md grid place-items-center ring-2 ring-white/40 shadow-lg">
                <GraduationCap className="h-6 w-6" />
              </div>
            )}
            <div>
              <div className="font-bold text-lg leading-tight">{tenant.name}</div>
              <div className="text-xs text-white/75">منصة تعليمية رقمية</div>
            </div>
          </Link>
          <Link
            to="/t/$slug"
            params={{ slug }}
            className="hidden sm:inline-flex items-center gap-1 text-xs font-medium bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 rounded-full px-3 py-1.5 transition"
          >
            <ArrowRight className="h-3 w-3" /> العودة للمنصة
          </Link>
        </div>

        <div className="relative z-10 space-y-6 max-w-md hidden lg:block">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-white/15 backdrop-blur-md border border-white/20">
            <Sparkles className="h-3 w-3" /> {mode === "signup" ? "ابدأ رحلتك التعليمية" : "أهلاً بعودتك"}
          </div>
          <h2 className="text-4xl xl:text-5xl font-black leading-tight drop-shadow-md">
            {tenant.hero_title ?? `تعلّم بذكاء مع ${tenant.name}`}
          </h2>
          <p className="text-white/85 text-lg leading-relaxed">
            {tenant.hero_subtitle ?? tenant.welcome_message ?? tenant.description ?? "وصول كامل لجميع الدورات، تتبّع تقدّمك، واحصل على شهادات معتمدة."}
          </p>
          <ul className="space-y-3 pt-2">
            <Feature icon={BookOpen} text="دورات متخصصة من نخبة المعلمين" />
            <Feature icon={ShieldCheck} text="حسابك محمي وبياناتك آمنة" />
            <Feature icon={Sparkles} text="شهادات معتمدة بعد الإنجاز" />
          </ul>
        </div>

        <div className="relative z-10 text-xs text-white/70 hidden lg:block">
          © {new Date().getFullYear()} {tenant.name}
        </div>
      </aside>

      {/* Right form panel */}
      <main className="flex-1 flex items-center justify-center p-6 sm:p-10 bg-background">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-6 text-center">
            <h1 className="text-2xl font-bold">{tenant.name}</h1>
          </div>

          {alreadySignedIn && (
            <div className="mb-6 rounded-xl border border-amber-300/60 bg-amber-50 dark:bg-amber-900/20 p-4 text-sm">
              <p className="font-semibold mb-1">أنت مسجّل الدخول حالياً</p>
              <p className="text-muted-foreground mb-3">
                لإنشاء حساب جديد أو تسجيل الدخول بحساب آخر، سجّل الخروج أولاً.
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    await supabase.auth.signOut();
                    toast.success("تم تسجيل الخروج");
                  }}
                >
                  تسجيل الخروج
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => navigate({ to: "/t/$slug", params: { slug } })}
                  style={{ background: `linear-gradient(135deg, ${primary}, ${secondary})` }}
                  className="text-white border-0"
                >
                  متابعة إلى المنصة
                </Button>
              </div>
            </div>
          )}

          <div className="mb-6">
            <h1 className="text-3xl font-bold mb-1">{mode === "signup" ? "إنشاء حساب جديد" : "تسجيل الدخول"}</h1>
            <p className="text-sm text-muted-foreground">
              {mode === "signup" ? `انضم إلى مجتمع ${tenant.name} اليوم` : `سجّل دخولك للوصول إلى دوراتك في ${tenant.name}`}
            </p>
          </div>

          <Tabs value={mode} onValueChange={(v) => navigate({ to: "/t/$slug/auth", params: { slug }, search: { mode: v as "signin" | "signup" } })}>
            <TabsList className="grid grid-cols-2 mb-6 w-full">
              <TabsTrigger value="signin">دخول</TabsTrigger>
              <TabsTrigger value="signup">حساب جديد</TabsTrigger>
            </TabsList>
            <TabsContent value="signin">
              <SignInForm primary={primary} secondary={secondary} />
            </TabsContent>
            <TabsContent value="signup">
              <SignUpForm primary={primary} secondary={secondary} />
            </TabsContent>
          </Tabs>

          <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px bg-border flex-1" />
            أو
            <div className="h-px bg-border flex-1" />
          </div>

          <GoogleButton slug={slug} />

          <p className="mt-6 text-center text-xs text-muted-foreground">
            بإنشاء حساب فإنك توافق على{" "}
            <Link to="/t/$slug/terms" params={{ slug }} className="underline hover:text-foreground">الشروط</Link> و{" "}
            <Link to="/t/$slug/privacy" params={{ slug }} className="underline hover:text-foreground">الخصوصية</Link>.
          </p>
        </div>
      </main>
    </div>
  );
}

function Feature({ icon: Icon, text }: { icon: React.ComponentType<{ className?: string }>; text: string }) {
  return (
    <li className="flex items-center gap-3">
      <span className="h-9 w-9 rounded-xl bg-white/15 backdrop-blur-md border border-white/20 grid place-items-center shrink-0">
        <Icon className="h-4 w-4" />
      </span>
      <span className="text-white/90">{text}</span>
    </li>
  );
}

function GoogleButton({ slug }: { slug: string }) {
  async function onGoogle() {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/t/${slug}` },
      });
      if (error) toast.error(error.message);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذّر بدء Google");
    }
  }
  return (
    <Button type="button" variant="outline" className="w-full" onClick={onGoogle}>
      متابعة باستخدام Google
    </Button>
  );
}

function SignInForm({ primary, secondary }: { primary: string; secondary: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setBusy(false);
      return toast.error(error.message);
    }
    try {
      await finalizeLogin();
      toast.success("تم تسجيل الدخول");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطأ في تسجيل الجلسة");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <Label>البريد الإلكتروني</Label>
        <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div>
        <Label>كلمة المرور</Label>
        <Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <Button
        type="submit"
        className="w-full text-white border-0 shadow-md"
        disabled={busy}
        style={{ background: `linear-gradient(135deg, ${primary}, ${secondary})` }}
      >
        {busy ? "جارٍ..." : "دخول"}
      </Button>
    </form>
  );
}

function SignUpForm({ primary, secondary }: { primary: string; secondary: string }) {
  const { slug } = useParams({ from: "/t/$slug/auth" });
  const { data: tenantRow } = useQuery({
    queryKey: ["public-tenant-id", slug],
    queryFn: async () => (await supabase.from("tenants").select("id").eq("slug", slug).maybeSingle()).data,
  });
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "",
    phone_country_code: "+966",
    phone: "",
    study_year: "",
    research_consent: false,
    desired_role: "student" as "student" | "instructor",
    application_note: "",
  });
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { error: signErr } = await supabase.auth.signUp({
        email: form.email.trim(),
        password: form.password,
        options: {
          emailRedirectTo: window.location.origin + window.location.pathname,
          data: {
            full_name: form.full_name,
            phone: form.phone,
            phone_country_code: form.phone_country_code,
            study_year: form.study_year || null,
            research_consent: form.research_consent,
          },
        },
      });
      if (signErr) throw signErr;
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const { error: inErr } = await supabase.auth.signInWithPassword({
          email: form.email.trim(),
          password: form.password,
        });
        if (inErr) {
          toast.success("تم إنشاء الحساب. تحقّق من بريدك لتأكيد الحساب.");
          return;
        }
      }
      await finalizeLogin();
      if (tenantRow?.id) {
        const { error: applyErr } = await supabase.rpc("apply_to_tenant", {
          _tenant_id: tenantRow.id,
          _desired_role: form.desired_role,
          _note: form.desired_role === "instructor" ? (form.application_note || undefined) : undefined,
        });
        if (applyErr) {
          toast.warning(`تم إنشاء الحساب لكن تعذّر تسجيل الدور: ${applyErr.message}`);
        } else if (form.desired_role === "instructor") {
          toast.success("تم استلام طلبك كمعلم — بانتظار موافقة الأدمن قبل الدخول.");
        } else {
          toast.success("مرحباً بك!");
        }
      } else {
        toast.success("مرحباً بك!");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذّر إنشاء الحساب");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div>
        <Label>نوع الحساب</Label>
        <div className="grid grid-cols-2 gap-2 mt-1">
          {(["student", "instructor"] as const).map((r) => (
            <button
              type="button"
              key={r}
              onClick={() => setForm({ ...form, desired_role: r })}
              className={cn(
                "rounded-lg border px-3 py-2 text-sm font-medium transition",
                form.desired_role === r
                  ? "border-transparent text-white shadow"
                  : "border-input bg-background hover:bg-accent"
              )}
              style={form.desired_role === r ? { background: `linear-gradient(135deg, ${primary}, ${secondary})` } : undefined}
            >
              {r === "student" ? "طالب" : "معلم"}
            </button>
          ))}
        </div>
        {form.desired_role === "instructor" && (
          <p className="text-xs text-amber-600 mt-2">
            سيتم إنشاء حسابك بانتظار موافقة أدمن المنصة قبل تمكين صلاحيات المعلم.
          </p>
        )}
      </div>
      {form.desired_role === "instructor" && (
        <div>
          <Label>نبذة قصيرة عنك (اختياري)</Label>
          <Input
            placeholder="التخصص، سنوات الخبرة، المواد التي تودّ تدريسها..."
            value={form.application_note}
            onChange={(e) => setForm({ ...form, application_note: e.target.value })}
          />
        </div>
      )}
      <div>
        <Label>الاسم الكامل</Label>
        <Input required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
      </div>
      <div>
        <Label>البريد الإلكتروني</Label>
        <Input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
      </div>
      <div className="grid grid-cols-[120px_1fr] gap-2">
        <div>
          <Label>الدولة</Label>
          <Select value={form.phone_country_code} onValueChange={(v) => setForm({ ...form, phone_country_code: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {COUNTRY_CODES.map((c) => (
                <SelectItem key={c.code} value={c.code}>{c.code} {c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>رقم الهاتف</Label>
          <Input
            required
            inputMode="numeric"
            pattern="\d{6,15}"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, "") })}
          />
        </div>
      </div>
      <div>
        <Label>كلمة المرور</Label>
        <Input
          type="password"
          required
          minLength={6}
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
        />
      </div>
      <label className="flex items-start gap-2 text-sm pt-1">
        <Checkbox
          checked={form.research_consent}
          onCheckedChange={(v) => setForm({ ...form, research_consent: v === true })}
        />
        <span className="text-muted-foreground">أوافق على استخدام بياناتي لأغراض التحسين</span>
      </label>
      <Button
        type="submit"
        className="w-full text-white border-0 shadow-md"
        disabled={busy}
        style={{ background: `linear-gradient(135deg, ${primary}, ${secondary})` }}
      >
        {busy ? "جارٍ..." : "إنشاء الحساب"}
      </Button>
    </form>
  );
}

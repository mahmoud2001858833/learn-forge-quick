import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Sparkles, Palette, Settings2, CreditCard, MessageSquare, Ticket,
  Image as ImageIcon, Rocket, Check, ChevronRight, ChevronLeft, ArrowLeft, Upload, Globe, Mail, Phone,
} from "lucide-react";
import { createTenant } from "@/lib/tenants.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/onboard/new-tenant")({
  head: () => ({
    meta: [
      { title: "إنشاء منصة جديدة" },
      { name: "description", content: "أطلق منصتك التعليمية بخطوات بسيطة." },
    ],
  }),
  component: NewTenantPage,
});

type StepKey = "basics" | "branding" | "contact" | "payments" | "features" | "review";

const STEPS: { key: StepKey; title: string; subtitle: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "basics",   title: "الأساسيات",     subtitle: "اسم المنصة والرابط",          icon: Sparkles },
  { key: "branding", title: "الهوية البصرية", subtitle: "الألوان والشعار",             icon: Palette },
  { key: "contact",  title: "التواصل",       subtitle: "بريد وهاتف وعملة",            icon: Globe },
  { key: "payments", title: "الدفع",         subtitle: "طرق استلام المدفوعات",        icon: CreditCard },
  { key: "features", title: "الميزات",       subtitle: "محادثات، كوبونات، تسجيل",     icon: Settings2 },
  { key: "review",   title: "مراجعة وإطلاق",  subtitle: "تأكيد البيانات",              icon: Rocket },
];

const PRESET_PALETTES = [
  { name: "بنفسجي ملكي", primary: "#6366f1", secondary: "#D4AF37" },
  { name: "أزرق محيطي",   primary: "#0ea5e9", secondary: "#f59e0b" },
  { name: "زمردي",        primary: "#10b981", secondary: "#fbbf24" },
  { name: "وردي عصري",    primary: "#ec4899", secondary: "#8b5cf6" },
  { name: "أحمر جريء",     primary: "#ef4444", secondary: "#1f2937" },
  { name: "أسود ذهبي",     primary: "#111827", secondary: "#D4AF37" },
];

function NewTenantPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);

  const [stepIdx, setStepIdx] = useState(0);
  const [uploading, setUploading] = useState(false);

  // Basics
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);

  // Branding
  const [primary_color, setPrimary] = useState("#6366f1");
  const [secondary_color, setSecondary] = useState("#D4AF37");
  const [logo_url, setLogoUrl] = useState<string>("");

  // Contact / currency
  const [currency, setCurrency] = useState("SAR");
  const [contact_email, setContactEmail] = useState("");
  const [contact_phone, setContactPhone] = useState("");
  const [welcome_message, setWelcome] = useState("");

  // Payments
  const [payment_cash_enabled, setCash] = useState(true);
  const [payment_bank_transfer_enabled, setBank] = useState(true);

  // Features
  const [chat_enabled, setChat] = useState(true);
  const [coupons_enabled, setCoupons] = useState(true);
  const [allow_signups, setAllowSignups] = useState(true);

  useEffect(() => {
    if (slugTouched) return;
    setSlug(
      name.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40),
    );
  }, [name, slugTouched]);

  const create = useMutation({
    mutationFn: () =>
      createTenant({
        data: {
          name, slug, description, primary_color, secondary_color, currency,
          welcome_message, logo_url: logo_url || null,
          contact_email: contact_email || null, contact_phone: contact_phone || null,
          payment_cash_enabled, payment_bank_transfer_enabled,
          chat_enabled, coupons_enabled, allow_signups,
        },
      }),
    onSuccess: (res) => {
      toast.success("تم إنشاء المنصة بنجاح! 🎉");
      qc.invalidateQueries({ queryKey: ["my-tenants"] });
      const createdSlug = res?.tenant?.slug;
      if (createdSlug) navigate({ to: "/admin/$tenantSlug", params: { tenantSlug: createdSlug } });
      else navigate({ to: "/dashboard" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function handleLogoUpload(file: File) {
    if (!user) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("حجم الشعار يجب أن يكون أقل من 2 ميجابايت");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("tenant-logos").upload(path, file, {
        cacheControl: "31536000",
        upsert: false,
        contentType: file.type,
      });
      if (error) throw error;
      const { data } = supabase.storage.from("tenant-logos").getPublicUrl(path);
      setLogoUrl(data.publicUrl);
      toast.success("تم رفع الشعار");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  const canNext = () => {
    if (stepIdx === 0) return name.trim().length >= 2 && /^[a-z0-9-]{3,40}$/.test(slug);
    if (stepIdx === 1) return /^#[0-9a-f]{6}$/i.test(primary_color) && /^#[0-9a-f]{6}$/i.test(secondary_color);
    if (stepIdx === 2) return currency.trim().length >= 3;
    if (stepIdx === 3) return payment_cash_enabled || payment_bank_transfer_enabled;
    return true;
  };

  const current = STEPS[stepIdx];
  const progress = ((stepIdx + 1) / STEPS.length) * 100;

  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background">
      <div className="max-w-5xl mx-auto px-4 py-6 sm:py-10">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-6">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/dashboard"><ArrowLeft className="h-4 w-4 ml-1" /> رجوع للوحة التحكم</Link>
          </Button>
          <span className="text-xs sm:text-sm text-muted-foreground">الخطوة {stepIdx + 1} من {STEPS.length}</span>
        </div>

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/60 text-primary-foreground shadow-lg mb-3">
            <current.icon className="h-7 w-7" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black">{current.title}</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">{current.subtitle}</p>
        </div>

        {/* Progress */}
        <div className="mb-8">
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary to-primary/60 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="hidden sm:flex items-center justify-between mt-3">
            {STEPS.map((s, i) => (
              <button
                key={s.key}
                type="button"
                onClick={() => i < stepIdx && setStepIdx(i)}
                className={cn(
                  "flex flex-col items-center gap-1 text-xs transition-colors",
                  i < stepIdx ? "text-primary cursor-pointer hover:opacity-80" : "",
                  i === stepIdx ? "text-foreground font-bold" : "text-muted-foreground",
                )}
              >
                <div className={cn(
                  "h-7 w-7 rounded-full grid place-items-center border-2",
                  i < stepIdx && "bg-primary border-primary text-primary-foreground",
                  i === stepIdx && "border-primary",
                  i > stepIdx && "border-muted",
                )}>
                  {i < stepIdx ? <Check className="h-3.5 w-3.5" /> : <s.icon className="h-3.5 w-3.5" />}
                </div>
                <span className="truncate max-w-[70px]">{s.title}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Step body */}
        <Card className="p-5 sm:p-8 border-2 shadow-xl">
          {current.key === "basics" && (
            <div className="space-y-5">
              <FormRow label="اسم المنصة *" hint="هذا الاسم يظهر للزوار والطلاب">
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="أكاديمية الإبداع" autoFocus className="h-12 text-base" />
              </FormRow>
              <FormRow label="المعرّف (رابط المنصة) *" hint="3-40 حرفاً إنجليزياً صغيراً وأرقاماً وشرطات">
                <div className="flex items-stretch rounded-md border overflow-hidden">
                  <span className="px-3 grid place-items-center text-sm text-muted-foreground bg-muted border-l">/t/</span>
                  <Input
                    value={slug}
                    onChange={(e) => { setSlug(e.target.value); setSlugTouched(true); }}
                    className="border-0 h-12 text-base"
                    placeholder="my-academy"
                  />
                </div>
              </FormRow>
              <FormRow label="وصف قصير">
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="منصة تعليمية متخصصة في..." rows={3} />
              </FormRow>
            </div>
          )}

          {current.key === "branding" && (
            <div className="space-y-6">
              <div>
                <Label className="text-base font-bold mb-3 block">قوالب جاهزة</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {PRESET_PALETTES.map((p) => {
                    const active = p.primary === primary_color && p.secondary === secondary_color;
                    return (
                      <button
                        key={p.name}
                        type="button"
                        onClick={() => { setPrimary(p.primary); setSecondary(p.secondary); }}
                        className={cn(
                          "p-4 rounded-xl border-2 text-right hover:shadow-md transition-all",
                          active ? "border-primary ring-2 ring-primary/20 shadow-md" : "border-border",
                        )}
                      >
                        <div className="flex gap-1.5 mb-2">
                          <span className="w-8 h-8 rounded-full border-2 border-white shadow" style={{ background: p.primary }} />
                          <span className="w-8 h-8 rounded-full border-2 border-white shadow -mr-3" style={{ background: p.secondary }} />
                        </div>
                        <p className="text-sm font-medium">{p.name}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormRow label="اللون الأساسي">
                  <div className="flex gap-2">
                    <Input type="color" value={primary_color} onChange={(e) => setPrimary(e.target.value)} className="h-12 w-20 p-1" />
                    <Input value={primary_color} onChange={(e) => setPrimary(e.target.value)} className="h-12" />
                  </div>
                </FormRow>
                <FormRow label="اللون الثانوي">
                  <div className="flex gap-2">
                    <Input type="color" value={secondary_color} onChange={(e) => setSecondary(e.target.value)} className="h-12 w-20 p-1" />
                    <Input value={secondary_color} onChange={(e) => setSecondary(e.target.value)} className="h-12" />
                  </div>
                </FormRow>
              </div>

              <div>
                <Label className="text-base font-bold mb-3 block flex items-center gap-2">
                  <ImageIcon className="h-4 w-4" /> شعار المنصة
                </Label>
                <div className="flex flex-col sm:flex-row items-center gap-4 p-5 rounded-xl border-2 border-dashed bg-muted/30">
                  <div className="h-24 w-24 rounded-xl bg-background border grid place-items-center overflow-hidden shrink-0">
                    {logo_url ? (
                      <img src={logo_url} alt="logo" className="w-full h-full object-contain" />
                    ) : (
                      <ImageIcon className="h-8 w-8 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0 w-full text-center sm:text-right">
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      hidden
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleLogoUpload(f);
                      }}
                    />
                    <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                      <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
                        <Upload className="h-4 w-4 ml-1" /> {uploading ? "جارٍ الرفع..." : "رفع شعار"}
                      </Button>
                      {logo_url && (
                        <Button type="button" variant="ghost" size="sm" onClick={() => setLogoUrl("")}>إزالة</Button>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">PNG / JPG / SVG — حتى 2 ميجابايت</p>
                  </div>
                </div>
              </div>

              {/* Preview */}
              <div className="rounded-xl p-6 text-center border-2"
                style={{ background: `linear-gradient(135deg, ${primary_color}, ${secondary_color})` }}>
                {logo_url && <img src={logo_url} alt="" className="h-14 w-14 mx-auto mb-2 rounded-lg bg-white/90 p-1 object-contain" />}
                <p className="text-white font-bold text-xl drop-shadow">{name || "اسم المنصة"}</p>
                <p className="text-white/90 text-sm mt-1 drop-shadow">معاينة الهوية البصرية</p>
              </div>
            </div>
          )}

          {current.key === "contact" && (
            <div className="space-y-5">
              <FormRow label="العملة *">
                <div className="grid grid-cols-4 gap-2 mb-2">
                  {["SAR", "USD", "EUR", "EGP"].map((c) => (
                    <Button key={c} type="button" variant={currency === c ? "default" : "outline"} onClick={() => setCurrency(c)}>{c}</Button>
                  ))}
                </div>
                <Input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} maxLength={5} className="h-11" />
              </FormRow>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormRow label="البريد الإلكتروني للتواصل">
                  <div className="relative">
                    <Mail className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input value={contact_email} onChange={(e) => setContactEmail(e.target.value)} type="email" placeholder="contact@example.com" className="h-11 pr-9" />
                  </div>
                </FormRow>
                <FormRow label="رقم الهاتف">
                  <div className="relative">
                    <Phone className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input value={contact_phone} onChange={(e) => setContactPhone(e.target.value)} placeholder="+966 5x xxx xxxx" className="h-11 pr-9" />
                  </div>
                </FormRow>
              </div>
              <FormRow label="رسالة ترحيب للطلاب" hint="تظهر في الصفحة الرئيسية للمنصة">
                <Textarea value={welcome_message} onChange={(e) => setWelcome(e.target.value)} placeholder="مرحباً بك في منصتنا! نتمنى لك تجربة تعلم رائعة..." rows={4} />
              </FormRow>
            </div>
          )}

          {current.key === "payments" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">اختر طرق استلام المدفوعات. يمكنك تفعيل أكثر من طريقة، وستظهر للطلاب عند الشراء.</p>
              <ToggleCard
                icon={<span className="text-2xl">💵</span>}
                title="الدفع نقداً"
                description="يدفع الطالب نقداً مباشرة وتقوم بتأكيد الدفعة يدوياً من لوحة التحكم."
                checked={payment_cash_enabled}
                onChange={setCash}
              />
              <ToggleCard
                icon={<CreditCard className="h-6 w-6 text-primary" />}
                title="تحويل بنكي"
                description="يحوّل الطالب المبلغ لحسابك البنكي ويرفع إيصال التحويل للمراجعة."
                checked={payment_bank_transfer_enabled}
                onChange={setBank}
              />
              {!payment_cash_enabled && !payment_bank_transfer_enabled && (
                <p className="text-sm text-destructive bg-destructive/10 rounded-md p-3">يجب تفعيل طريقة دفع واحدة على الأقل</p>
              )}
              <p className="text-xs text-muted-foreground bg-muted/50 rounded-md p-3">
                💡 يمكنك إضافة حساباتك البنكية لاحقاً من <strong>الإعدادات → الحسابات البنكية</strong>.
              </p>
            </div>
          )}

          {current.key === "features" && (
            <div className="space-y-4">
              <ToggleCard
                icon={<MessageSquare className="h-6 w-6 text-primary" />}
                title="المحادثات المباشرة"
                description="السماح للطلاب بالتواصل مع الإدارة عبر شات داخلي."
                checked={chat_enabled}
                onChange={setChat}
              />
              <ToggleCard
                icon={<Ticket className="h-6 w-6 text-primary" />}
                title="الكوبونات والخصومات"
                description="إنشاء كوبونات خصم وتفعيلها للطلاب."
                checked={coupons_enabled}
                onChange={setCoupons}
              />
              <ToggleCard
                icon={<Sparkles className="h-6 w-6 text-primary" />}
                title="تسجيل طلاب جدد"
                description="السماح بتسجيل حسابات جديدة في منصتك. أوقفه لجعلها بالدعوة فقط."
                checked={allow_signups}
                onChange={setAllowSignups}
              />
            </div>
          )}

          {current.key === "review" && (
            <div className="space-y-4">
              <div className="rounded-xl p-5 border-2"
                style={{ background: `linear-gradient(135deg, ${primary_color}15, ${secondary_color}15)` }}>
                <div className="flex items-center gap-3">
                  {logo_url ? (
                    <img src={logo_url} alt="" className="h-14 w-14 rounded-lg object-contain bg-white p-1" />
                  ) : (
                    <div className="h-14 w-14 rounded-lg grid place-items-center text-white text-2xl font-black"
                      style={{ background: `linear-gradient(135deg, ${primary_color}, ${secondary_color})` }}>
                      {name.charAt(0) || "?"}
                    </div>
                  )}
                  <div className="min-w-0">
                    <h3 className="text-xl font-black truncate">{name}</h3>
                    <p className="text-sm text-muted-foreground truncate">/t/{slug}</p>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <Row label="العملة" value={currency} />
                <Row label="البريد" value={contact_email || "—"} />
                <Row label="الهاتف" value={contact_phone || "—"} />
                <Row label="الدفع نقداً" value={payment_cash_enabled ? "✅ مفعّل" : "—"} />
                <Row label="تحويل بنكي" value={payment_bank_transfer_enabled ? "✅ مفعّل" : "—"} />
                <Row label="المحادثات" value={chat_enabled ? "✅ مفعّل" : "—"} />
                <Row label="الكوبونات" value={coupons_enabled ? "✅ مفعّل" : "—"} />
                <Row label="تسجيل جدد" value={allow_signups ? "✅ مسموح" : "🔒 مقفل"} />
              </div>
              {description && <Row label="الوصف" value={description} block />}
              {welcome_message && <Row label="رسالة الترحيب" value={welcome_message} block />}
              <div className="rounded-lg bg-primary/5 border border-primary/20 p-4 text-sm">
                بالضغط على <strong>إطلاق المنصة</strong>، سيتم إنشاء المنصة مباشرة وستتمكن من تخصيص كل شيء من لوحة الإعدادات.
              </div>
            </div>
          )}
        </Card>

        {/* Navigation */}
        <div className="flex items-center justify-between gap-3 mt-6">
          <Button
            type="button" variant="outline" size="lg"
            onClick={() => setStepIdx((i) => Math.max(0, i - 1))}
            disabled={stepIdx === 0 || create.isPending}
          >
            <ChevronRight className="h-4 w-4 ml-1" /> السابق
          </Button>
          {stepIdx < STEPS.length - 1 ? (
            <Button type="button" size="lg" onClick={() => setStepIdx((i) => i + 1)} disabled={!canNext()}>
              التالي <ChevronLeft className="h-4 w-4 mr-1" />
            </Button>
          ) : (
            <Button type="button" size="lg" onClick={() => create.mutate()} disabled={create.isPending}>
              <Rocket className="h-4 w-4 ml-1" />
              {create.isPending ? "جارٍ الإطلاق..." : "إطلاق المنصة"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function FormRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-sm font-semibold mb-1.5 block">{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground mt-1.5">{hint}</p>}
    </div>
  );
}

function ToggleCard({ icon, title, description, checked, onChange }:
  { icon: React.ReactNode; title: string; description: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className={cn(
      "flex items-start gap-4 p-4 sm:p-5 rounded-xl border-2 transition-all",
      checked ? "border-primary/40 bg-primary/5" : "border-border bg-card",
    )}>
      <div className="h-11 w-11 rounded-lg bg-background border grid place-items-center shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <h3 className="font-bold text-base">{title}</h3>
        <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} className="mt-1 shrink-0" />
    </div>
  );
}

function Row({ label, value, block }: { label: string; value: React.ReactNode; block?: boolean }) {
  return (
    <div className={cn("flex gap-2 py-2 border-b last:border-0", block ? "flex-col col-span-full" : "justify-between items-center")}>
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-right">{value}</span>
    </div>
  );
}

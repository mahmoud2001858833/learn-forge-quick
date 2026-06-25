import { createFileRoute, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { CustomDomainCard } from "@/components/tenant/custom-domain-card";

export const Route = createFileRoute("/_authenticated/admin/$tenantSlug/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { tenantSlug } = useParams({ from: "/_authenticated/admin/$tenantSlug/settings" });
  const qc = useQueryClient();
  const { data: tenant } = useQuery({
    queryKey: ["tenant", tenantSlug],
    queryFn: async () => (await supabase.from("tenants").select("*").eq("slug", tenantSlug).single()).data,
  });

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold">الإعدادات</h1>
        <p className="text-muted-foreground">إدارة هوية المنصة وتشغيلها</p>
      </div>
      {tenant && <BrandingCard tenant={tenant} onSaved={() => qc.invalidateQueries({ queryKey: ["tenant"] })} />}
      {tenant && <ThemeCard tenant={tenant} onSaved={() => qc.invalidateQueries({ queryKey: ["tenant"] })} /> }
      {tenant && <CustomDomainCard tenant={tenant} />}
      {tenant && <ContentPagesCard tenant={tenant} onSaved={() => qc.invalidateQueries({ queryKey: ["tenant"] })} />}
      {tenant && <MarketingCard tenant={tenant} onSaved={() => qc.invalidateQueries({ queryKey: ["tenant"] })} />}
      {tenant && <PlatformSettingsCard tenantId={tenant.id} />}
      {tenant && <SecretsCard tenantId={tenant.id} />}
    </div>
  );
}

function BrandingCard({ tenant, onSaved }: { tenant: { id: string; name: string; description: string | null; primary_color: string; secondary_color: string; logo_url: string | null; hero_image_url: string | null; currency: string; welcome_message: string | null; contact_email: string | null; contact_phone: string | null }; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: tenant.name,
    description: tenant.description ?? "",
    primary_color: tenant.primary_color,
    secondary_color: tenant.secondary_color,
    logo_url: tenant.logo_url ?? "",
    hero_image_url: tenant.hero_image_url ?? "",
    currency: tenant.currency,
    welcome_message: tenant.welcome_message ?? "",
    contact_email: tenant.contact_email ?? "",
    contact_phone: tenant.contact_phone ?? "",
  });

  const update = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("tenants").update(form).eq("id", tenant.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("تم الحفظ"); onSaved(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>الهوية البصرية والمعلومات الأساسية</CardTitle>
        <CardDescription>اسم المنصة، الألوان، اللوغو، صورة الـ Hero، ومعلومات التواصل</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={(e) => { e.preventDefault(); update.mutate(); }} className="space-y-4">
          <div><Label>اسم المنصة</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><Label>الوصف القصير</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} /></div>
          <div><Label>رسالة ترحيبية (تظهر في الـ Hero)</Label><Textarea value={form.welcome_message} onChange={(e) => setForm({ ...form, welcome_message: e.target.value })} rows={2} /></div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div><Label>رابط اللوغو</Label><Input value={form.logo_url} onChange={(e) => setForm({ ...form, logo_url: e.target.value })} placeholder="https://..." /></div>
            <div><Label>رابط صورة الـ Hero (اختياري)</Label><Input value={form.hero_image_url} onChange={(e) => setForm({ ...form, hero_image_url: e.target.value })} placeholder="https://..." /></div>
          </div>
          {form.logo_url && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
              <img src={form.logo_url} alt="preview" className="h-16 w-16 rounded-xl object-cover border" />
              <span className="text-sm text-muted-foreground">معاينة اللوغو</span>
            </div>
          )}
          <div className="grid grid-cols-3 gap-3">
            <div><Label>لون أساسي</Label><Input type="color" value={form.primary_color} onChange={(e) => setForm({ ...form, primary_color: e.target.value })} className="h-10" /></div>
            <div><Label>لون ثانوي</Label><Input type="color" value={form.secondary_color} onChange={(e) => setForm({ ...form, secondary_color: e.target.value })} className="h-10" /></div>
            <div><Label>العملة</Label><Input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} maxLength={5} /></div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3 pt-2 border-t">
            <div><Label>بريد التواصل</Label><Input type="email" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} placeholder="info@example.com" /></div>
            <div><Label>هاتف التواصل</Label><Input value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} placeholder="+966 ..." /></div>
          </div>
          <Button type="submit" disabled={update.isPending}>{update.isPending ? "جارٍ..." : "حفظ"}</Button>
        </form>
      </CardContent>
    </Card>
  );
}

const THEMES: { key: "classic" | "modern" | "bold" | "minimal"; name: string; description: string }[] = [
  { key: "classic", name: "كلاسيكي", description: "تصميم متوازن مع رسوم وبطاقات عائمة" },
  { key: "modern", name: "حديث", description: "تدرّج لوني كامل في الوسط مع تأثير زجاجي" },
  { key: "bold", name: "جريء", description: "خلفية داكنة وخطوط ضخمة بأسلوب مجلّة" },
  { key: "minimal", name: "بسيط", description: "تصميم نظيف مع مساحات واسعة" },
];

function ThemeCard({ tenant, onSaved }: { tenant: { id: string; theme: string | null; hero_title: string | null; hero_subtitle: string | null }; onSaved: () => void }) {
  const [theme, setTheme] = useState((tenant.theme as "classic" | "modern" | "bold" | "minimal") ?? "classic");
  const [heroTitle, setHeroTitle] = useState(tenant.hero_title ?? "");
  const [heroSubtitle, setHeroSubtitle] = useState(tenant.hero_subtitle ?? "");

  const update = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("tenants")
        .update({ theme, hero_title: heroTitle || null, hero_subtitle: heroSubtitle || null })
        .eq("id", tenant.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("تم تطبيق القالب"); onSaved(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>قالب الواجهة الرئيسية</CardTitle>
        <CardDescription>اختر شكل وتصميم Hero الصفحة الرئيسية لمنصتك</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid sm:grid-cols-2 gap-3 mb-4">
          {THEMES.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTheme(t.key)}
              className={`text-right p-4 rounded-xl border-2 transition-all hover:bg-muted/50 ${
                theme === t.key ? "border-primary ring-2 ring-primary/20 bg-primary/5" : "border-border"
              }`}
            >
              <div className="font-bold mb-1">{t.name}</div>
              <div className="text-xs text-muted-foreground">{t.description}</div>
            </button>
          ))}
        </div>
        <div className="space-y-3 pt-4 border-t">
          <div>
            <Label>عنوان Hero مخصص (اختياري)</Label>
            <Input value={heroTitle} onChange={(e) => setHeroTitle(e.target.value)} placeholder="افتراضياً: اسم المنصة" />
          </div>
          <div>
            <Label>وصف Hero مخصص (اختياري)</Label>
            <Textarea rows={2} value={heroSubtitle} onChange={(e) => setHeroSubtitle(e.target.value)} placeholder="افتراضياً: الرسالة الترحيبية" />
          </div>
          <Button onClick={() => update.mutate()} disabled={update.isPending}>
            {update.isPending ? "جارٍ..." : "حفظ القالب"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ContentPagesCard({ tenant, onSaved }: { tenant: { id: string; about_text: string | null; privacy_text: string | null; terms_text: string | null }; onSaved: () => void }) {
  const [form, setForm] = useState({
    about_text: tenant.about_text ?? "",
    privacy_text: tenant.privacy_text ?? "",
    terms_text: tenant.terms_text ?? "",
  });

  const update = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("tenants").update(form).eq("id", tenant.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("تم الحفظ"); onSaved(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>الصفحات التعريفية</CardTitle>
        <CardDescription>محتوى صفحات "من نحن"، "سياسة الخصوصية"، و"الشروط"</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={(e) => { e.preventDefault(); update.mutate(); }} className="space-y-4">
          <div><Label>من نحن</Label><Textarea rows={6} value={form.about_text} onChange={(e) => setForm({ ...form, about_text: e.target.value })} placeholder="عرّف الزوار بمنصتك ورسالتك..." /></div>
          <div><Label>سياسة الخصوصية</Label><Textarea rows={6} value={form.privacy_text} onChange={(e) => setForm({ ...form, privacy_text: e.target.value })} placeholder="كيف تتعاملون مع بيانات المستخدمين..." /></div>
          <div><Label>شروط الاستخدام</Label><Textarea rows={6} value={form.terms_text} onChange={(e) => setForm({ ...form, terms_text: e.target.value })} placeholder="الشروط والأحكام لاستخدام المنصة..." /></div>
          <Button type="submit" disabled={update.isPending}>{update.isPending ? "جارٍ..." : "حفظ"}</Button>
        </form>
      </CardContent>
    </Card>
  );
}

function PlatformSettingsCard({ tenantId }: { tenantId: string }) {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["platform-settings", tenantId],
    queryFn: async () => (await supabase.from("platform_settings").select("*").eq("tenant_id", tenantId).maybeSingle()).data,
  });

  const [form, setForm] = useState({
    maintenance_mode: false,
    maintenance_message: "",
    marquee_enabled: false,
    marquee_text: "",
    marquee_color: "#D4AF37",
    allow_signups: true,
    default_commission_pct: 20,
  });

  useEffect(() => {
    if (data) {
      setForm({
        maintenance_mode: data.maintenance_mode,
        maintenance_message: data.maintenance_message ?? "",
        marquee_enabled: data.marquee_enabled,
        marquee_text: data.marquee_text ?? "",
        marquee_color: data.marquee_color ?? "#D4AF37",
        allow_signups: data.allow_signups,
        default_commission_pct: Number(data.default_commission_pct),
      });
    }
  }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("platform_settings").update(form).eq("tenant_id", tenantId);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("تم الحفظ"); qc.invalidateQueries({ queryKey: ["platform-settings", tenantId] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>تشغيل المنصة</CardTitle>
        <CardDescription>الصيانة، شريط الإعلانات، التسجيلات، والعمولة</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-5">
          <div className="flex items-center justify-between">
            <div><Label className="text-base">وضع الصيانة</Label><p className="text-xs text-muted-foreground">يحجب الزوار ويُظهر فقط للمالك/السوبر-أدمن</p></div>
            <Switch checked={form.maintenance_mode} onCheckedChange={(v) => setForm({ ...form, maintenance_mode: v })} />
          </div>
          {form.maintenance_mode && (
            <Textarea
              placeholder="رسالة الصيانة"
              value={form.maintenance_message}
              onChange={(e) => setForm({ ...form, maintenance_message: e.target.value })}
            />
          )}

          <div className="flex items-center justify-between border-t pt-5">
            <div><Label className="text-base">شريط الإعلانات (marquee)</Label><p className="text-xs text-muted-foreground">شريط متحرك أعلى الصفحات العامة</p></div>
            <Switch checked={form.marquee_enabled} onCheckedChange={(v) => setForm({ ...form, marquee_enabled: v })} />
          </div>
          {form.marquee_enabled && (
            <div className="grid grid-cols-[1fr_100px] gap-2">
              <Input placeholder="نص الشريط" value={form.marquee_text} onChange={(e) => setForm({ ...form, marquee_text: e.target.value })} />
              <Input type="color" value={form.marquee_color} onChange={(e) => setForm({ ...form, marquee_color: e.target.value })} className="h-10" />
            </div>
          )}

          <div className="flex items-center justify-between border-t pt-5">
            <div><Label className="text-base">السماح بالتسجيلات الجديدة</Label></div>
            <Switch checked={form.allow_signups} onCheckedChange={(v) => setForm({ ...form, allow_signups: v })} />
          </div>

          <div>
            <Label>عمولة المنصة الافتراضية للمعلمين (%)</Label>
            <Input
              type="number"
              min={0}
              max={100}
              step="0.5"
              value={form.default_commission_pct}
              onChange={(e) => setForm({ ...form, default_commission_pct: Number(e.target.value) })}
            />
          </div>

          <Button type="submit" disabled={save.isPending}>{save.isPending ? "جارٍ..." : "حفظ الإعدادات"}</Button>
        </form>
      </CardContent>
    </Card>
  );
}

function SecretsCard({ tenantId }: { tenantId: string }) {
  const qc = useQueryClient();
  const { data: secrets } = useQuery({
    queryKey: ["tenant-secrets", tenantId],
    queryFn: async () => (await supabase.from("tenant_secrets").select("id, name, description, updated_at").eq("tenant_id", tenantId).order("name")).data ?? [],
  });

  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  const [description, setDescription] = useState("");

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("tenant_secrets").upsert(
        { tenant_id: tenantId, name: name.trim(), value, description },
        { onConflict: "tenant_id,name" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم الحفظ"); setName(""); setValue(""); setDescription("");
      qc.invalidateQueries({ queryKey: ["tenant-secrets", tenantId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tenant_secrets").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tenant-secrets", tenantId] }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>الأسرار الخاصة بالمنصة</CardTitle>
        <CardDescription>مفاتيح API لمزودي الخدمات (Resend، Cloudflare…) — تُعرض القيم مرة واحدة فقط</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={(e) => { e.preventDefault(); add.mutate(); }} className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Input required placeholder="الاسم (مثل RESEND_API_KEY)" value={name} onChange={(e) => setName(e.target.value)} />
            <Input required placeholder="القيمة" type="password" value={value} onChange={(e) => setValue(e.target.value)} />
          </div>
          <Input placeholder="وصف (اختياري)" value={description} onChange={(e) => setDescription(e.target.value)} />
          <Button type="submit" disabled={add.isPending} size="sm">إضافة/تحديث</Button>
        </form>

        <div className="border-t pt-4 space-y-2">
          {secrets?.length === 0 && <p className="text-sm text-muted-foreground">لا أسرار بعد.</p>}
          {secrets?.map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-2 border rounded p-2">
              <div>
                <div className="font-mono text-sm">{s.name}</div>
                {s.description && <div className="text-xs text-muted-foreground">{s.description}</div>}
              </div>
              <Button variant="destructive" size="sm" onClick={() => remove.mutate(s.id)}>حذف</Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function MarketingCard({ tenant, onSaved }: { tenant: any; onSaved: () => void }) {
  const [features, setFeatures] = useState<string>(JSON.stringify(tenant.features ?? [], null, 2));
  const [testimonials, setTestimonials] = useState<string>(JSON.stringify(tenant.testimonials ?? [], null, 2));
  const [faq, setFaq] = useState<string>(JSON.stringify(tenant.faq ?? [], null, 2));
  const [stats, setStats] = useState<string>(JSON.stringify(tenant.stats ?? [], null, 2));
  const [seoKeywords, setSeoKeywords] = useState<string>(tenant.seo_keywords ?? "");
  const [seoOgImage, setSeoOgImage] = useState<string>(tenant.seo_og_image ?? "");
  const [ctaTitle, setCtaTitle] = useState<string>(tenant.cta_title ?? "");
  const [ctaSubtitle, setCtaSubtitle] = useState<string>(tenant.cta_subtitle ?? "");

  async function save() {
    let f, t, q, s;
    try {
      f = JSON.parse(features || "[]");
      t = JSON.parse(testimonials || "[]");
      q = JSON.parse(faq || "[]");
      s = JSON.parse(stats || "[]");
    } catch (e) {
      toast.error("صيغة JSON غير صحيحة");
      return;
    }
    const { error } = await supabase.from("tenants").update({
      features: f, testimonials: t, faq: q, stats: s,
      seo_keywords: seoKeywords || null, seo_og_image: seoOgImage || null,
      cta_title: ctaTitle || null, cta_subtitle: ctaSubtitle || null,
    }).eq("id", tenant.id);
    if (error) return toast.error(error.message);
    toast.success("تم الحفظ");
    onSaved();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>تخصيص الصفحة الرئيسية و SEO</CardTitle>
        <CardDescription>أقسام المميزات والإحصائيات وآراء الطلاب والأسئلة الشائعة + الكلمات المفتاحية</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-3">
          <div><Label>عنوان CTA (يظهر أسفل الصفحة)</Label><Input value={ctaTitle} onChange={(e) => setCtaTitle(e.target.value)} placeholder="جاهز لبدء رحلتك؟" /></div>
          <div><Label>نص CTA الفرعي</Label><Input value={ctaSubtitle} onChange={(e) => setCtaSubtitle(e.target.value)} /></div>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div><Label>كلمات مفتاحية SEO (مفصولة بفواصل)</Label><Input value={seoKeywords} onChange={(e) => setSeoKeywords(e.target.value)} placeholder="تعلم, دورات, برمجة" /></div>
          <div><Label>صورة المعاينة الاجتماعية (OG)</Label><Input value={seoOgImage} onChange={(e) => setSeoOgImage(e.target.value)} placeholder="https://..." /></div>
        </div>

        <div>
          <Label>المميزات (Features) — مصفوفة JSON</Label>
          <Textarea value={features} onChange={(e) => setFeatures(e.target.value)} rows={5} className="font-mono text-xs" />
          <p className="text-xs text-muted-foreground mt-1">{'مثال: [{"icon":"book","title":"محتوى عالي الجودة","text":"دروس مصممة بعناية"}]'}</p>
          <p className="text-xs text-muted-foreground">أيقونات متاحة: sparkles, book, award, users, check, zap, shield, trophy, heart, target, rocket, star</p>
        </div>

        <div>
          <Label>الإحصائيات</Label>
          <Textarea value={stats} onChange={(e) => setStats(e.target.value)} rows={4} className="font-mono text-xs" />
          <p className="text-xs text-muted-foreground mt-1">{'مثال: [{"value":"5000+","label":"طالب"},{"value":"120","label":"دورة"}]'}</p>
        </div>

        <div>
          <Label>آراء الطلاب (Testimonials)</Label>
          <Textarea value={testimonials} onChange={(e) => setTestimonials(e.target.value)} rows={5} className="font-mono text-xs" />
          <p className="text-xs text-muted-foreground mt-1">{'مثال: [{"name":"أحمد","role":"طالب","avatar":"https://...","quote":"تجربة رائعة","rating":5}]'}</p>
        </div>

        <div>
          <Label>الأسئلة الشائعة (FAQ)</Label>
          <Textarea value={faq} onChange={(e) => setFaq(e.target.value)} rows={5} className="font-mono text-xs" />
          <p className="text-xs text-muted-foreground mt-1">{'مثال: [{"q":"كيف أبدأ؟","a":"سجّل حساب ثم اختر دورة"}]'}</p>
        </div>

        <Button onClick={save}>حفظ التخصيص</Button>
      </CardContent>
    </Card>
  );
}

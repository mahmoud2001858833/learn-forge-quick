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
      {tenant && <PlatformSettingsCard tenantId={tenant.id} />}
      {tenant && <SecretsCard tenantId={tenant.id} />}
    </div>
  );
}

function BrandingCard({ tenant, onSaved }: { tenant: { id: string; name: string; description: string | null; primary_color: string; secondary_color: string; logo_url: string | null; currency: string; welcome_message: string | null }; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: tenant.name,
    description: tenant.description ?? "",
    primary_color: tenant.primary_color,
    secondary_color: tenant.secondary_color,
    logo_url: tenant.logo_url ?? "",
    currency: tenant.currency,
    welcome_message: tenant.welcome_message ?? "",
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
        <CardTitle>الهوية البصرية</CardTitle>
        <CardDescription>اسم المنصة، الألوان، واللوغو</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={(e) => { e.preventDefault(); update.mutate(); }} className="space-y-4">
          <div><Label>اسم المنصة</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><Label>الوصف</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div><Label>رسالة ترحيبية</Label><Textarea value={form.welcome_message} onChange={(e) => setForm({ ...form, welcome_message: e.target.value })} /></div>
          <div><Label>رابط اللوغو</Label><Input value={form.logo_url} onChange={(e) => setForm({ ...form, logo_url: e.target.value })} placeholder="https://..." /></div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label>لون أساسي</Label><Input type="color" value={form.primary_color} onChange={(e) => setForm({ ...form, primary_color: e.target.value })} className="h-10" /></div>
            <div><Label>لون ثانوي</Label><Input type="color" value={form.secondary_color} onChange={(e) => setForm({ ...form, secondary_color: e.target.value })} className="h-10" /></div>
            <div><Label>العملة</Label><Input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} maxLength={5} /></div>
          </div>
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

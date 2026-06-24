import { createFileRoute, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

  const [form, setForm] = useState({ name: "", description: "", primary_color: "#6366f1", logo_url: "" });

  useEffect(() => {
    if (tenant) setForm({
      name: tenant.name,
      description: tenant.description ?? "",
      primary_color: tenant.primary_color,
      logo_url: tenant.logo_url ?? "",
    });
  }, [tenant]);

  const update = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("tenants").update(form).eq("id", tenant!.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("تم الحفظ"); qc.invalidateQueries({ queryKey: ["tenant"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!tenant) return <div>جارٍ التحميل...</div>;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold">الإعدادات</h1>
        <p className="text-muted-foreground">هوية منصتك</p>
      </div>
      <Card>
        <CardContent className="p-6">
          <form onSubmit={(e) => { e.preventDefault(); update.mutate(); }} className="space-y-4">
            <div><Label>اسم المنصة</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>الوصف</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div><Label>رابط اللوغو</Label><Input value={form.logo_url} onChange={(e) => setForm({ ...form, logo_url: e.target.value })} placeholder="https://..." /></div>
            <div><Label>اللون الأساسي</Label><Input type="color" value={form.primary_color} onChange={(e) => setForm({ ...form, primary_color: e.target.value })} className="h-10 w-20" /></div>
            <Button type="submit" disabled={update.isPending}>حفظ التغييرات</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

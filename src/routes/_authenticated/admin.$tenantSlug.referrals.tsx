import { createFileRoute, useParams } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Users, DollarSign } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/$tenantSlug/referrals")({
  component: ReferralsPage,
});

function ReferralsPage() {
  const { tenantSlug } = useParams({ from: "/_authenticated/admin/$tenantSlug/referrals" });
  const qc = useQueryClient();
  const [enabled, setEnabled] = useState(false);
  const [percent, setPercent] = useState(0);

  const { data: tenant } = useQuery({
    queryKey: ["tenant", tenantSlug],
    queryFn: async () => (await supabase.from("tenants").select("id").eq("slug", tenantSlug).single()).data,
  });

  const { data: settings } = useQuery({
    queryKey: ["platform-settings", tenant?.id],
    enabled: !!tenant,
    queryFn: async () => (await supabase.from("platform_settings").select("enable_referrals, referral_commission_percent").eq("tenant_id", tenant!.id).single()).data,
  });

  useEffect(() => {
    if (settings) {
      setEnabled(settings.enable_referrals ?? false);
      setPercent(Number(settings.referral_commission_percent ?? 0));
    }
  }, [settings]);

  const { data: referrals } = useQuery({
    queryKey: ["referrals", tenant?.id],
    enabled: !!tenant,
    queryFn: async () => {
      const { data, error } = await supabase.from("referrals").select("*, courses(title)")
        .eq("tenant_id", tenant!.id).order("created_at", { ascending: false });
      if (error) throw error;
      const ids = Array.from(new Set((data ?? []).flatMap((r) => [r.referrer_id, r.referred_user_id])));
      const profMap = new Map<string, string>();
      if (ids.length) {
        const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", ids);
        profs?.forEach((p) => profMap.set(p.id, p.full_name ?? p.id.slice(0, 8)));
      }
      return (data ?? []).map((r) => ({
        ...r,
        referrer_name: profMap.get(r.referrer_id) ?? "—",
        referred_name: profMap.get(r.referred_user_id) ?? "—",
      }));
    },
  });

  const saveSettings = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("platform_settings")
        .update({ enable_referrals: enabled, referral_commission_percent: percent })
        .eq("tenant_id", tenant!.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("تم حفظ الإعدادات"); qc.invalidateQueries({ queryKey: ["platform-settings"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const markPaid = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("referrals").update({ status: "paid", paid_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("تم وضع علامة مدفوع"); qc.invalidateQueries({ queryKey: ["referrals"] }); },
  });

  const totals = (referrals ?? []).reduce(
    (acc, r) => {
      const amt = Number(r.commission_amount);
      if (r.status === "pending") acc.pending += amt;
      else if (r.status === "paid") acc.paid += amt;
      return acc;
    },
    { pending: 0, paid: 0 }
  );

  return (
    <div dir="rtl" className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">نظام الإحالات</h1>
        <p className="text-sm text-muted-foreground">منح عمولة للطلاب الذين يدعون أصدقاءهم</p>
      </div>

      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-bold">تفعيل نظام الإحالات</div>
              <p className="text-xs text-muted-foreground">يحصل المُحيل على عمولة عند دفع المُحال</p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>
          <div>
            <Label>نسبة العمولة (%)</Label>
            <Input type="number" min={0} max={100} step="0.5"
              value={percent} onChange={(e) => setPercent(Number(e.target.value))} />
          </div>
          <Button onClick={() => saveSettings.mutate()} disabled={saveSettings.isPending}>حفظ</Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Card><CardContent className="p-4">
          <div className="text-sm text-muted-foreground">عمولات معلّقة</div>
          <div className="text-2xl font-bold text-amber-600">{totals.pending.toFixed(2)}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-sm text-muted-foreground">عمولات مدفوعة</div>
          <div className="text-2xl font-bold text-green-600">{totals.paid.toFixed(2)}</div>
        </CardContent></Card>
      </div>

      <div>
        <h2 className="text-lg font-bold mb-3 flex items-center gap-2"><Users className="h-5 w-5" /> سجل الإحالات</h2>
        <div className="space-y-2">
          {referrals?.length === 0 && (
            <Card><CardContent className="p-6 text-center text-muted-foreground">لا توجد إحالات بعد</CardContent></Card>
          )}
          {referrals?.map((r) => (
            <Card key={r.id}>
              <CardContent className="p-4 flex items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="font-bold flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    {Number(r.commission_amount).toFixed(2)}
                    <Badge variant={r.status === "paid" ? "default" : "secondary"}>
                      {r.status === "paid" ? "مدفوع" : r.status === "pending" ? "معلّق" : "ملغى"}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {r.referrer_name} ← {r.referred_name} {r.courses?.title && `(${r.courses.title})`}
                  </div>
                  <div className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString("ar-SA")}</div>
                </div>
                {r.status === "pending" && (
                  <Button size="sm" onClick={() => markPaid.mutate(r.id)}>وضع كمدفوع</Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

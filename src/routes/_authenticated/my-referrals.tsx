import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Copy, Share2, Wallet } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/my-referrals")({
  component: MyReferralsPage,
});

function MyReferralsPage() {
  const { user } = useAuth();

  const { data: profile } = useQuery({
    queryKey: ["my-profile", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("profiles").select("referral_code, referral_balance").eq("id", user!.id).single()).data,
  });

  const { data: referrals } = useQuery({
    queryKey: ["my-referrals", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("referrals")
        .select("*, courses(title), tenants(name, slug)")
        .eq("referrer_id", user!.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const copyCode = () => {
    if (profile?.referral_code) {
      navigator.clipboard.writeText(profile.referral_code);
      toast.success("تم نسخ الكود");
    }
  };

  const shareLink = () => {
    const link = `${window.location.origin}/?ref=${profile?.referral_code}`;
    navigator.clipboard.writeText(link);
    toast.success("تم نسخ الرابط");
  };

  const totalEarned = (referrals ?? []).reduce((sum, r) => sum + Number(r.commission_amount), 0);

  return (
    <main dir="rtl" className="container mx-auto px-6 py-10 max-w-3xl">
      <Link to="/dashboard" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowRight className="h-4 w-4" /> لوحة التحكم
      </Link>
      <h1 className="text-2xl font-bold mb-6">إحالاتي</h1>

      <Card className="mb-6 bg-gradient-to-br from-primary/10 to-primary/5">
        <CardContent className="p-6 space-y-4">
          <div>
            <div className="text-sm text-muted-foreground">كود الإحالة الخاص بك</div>
            <div className="flex items-center gap-2 mt-1">
              <code className="text-2xl font-bold bg-background px-3 py-2 rounded-lg">{profile?.referral_code}</code>
              <Button size="icon" variant="outline" onClick={copyCode}><Copy className="h-4 w-4" /></Button>
              <Button size="icon" variant="outline" onClick={shareLink}><Share2 className="h-4 w-4" /></Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            شارك هذا الكود مع أصدقائك واحصل على عمولة عند تسجيلهم في الدورات المدفوعة
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground flex items-center gap-1"><Wallet className="h-3 w-3" /> الرصيد المتاح</div>
          <div className="text-2xl font-bold text-primary">{Number(profile?.referral_balance ?? 0).toFixed(2)}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">إجمالي العمولات</div>
          <div className="text-2xl font-bold">{totalEarned.toFixed(2)}</div>
        </CardContent></Card>
      </div>

      <h2 className="text-lg font-bold mb-3">سجل العمولات</h2>
      <div className="space-y-2">
        {referrals?.length === 0 && (
          <Card><CardContent className="p-6 text-center text-muted-foreground">لم تقم بإحالة أي طالب بعد</CardContent></Card>
        )}
        {referrals?.map((r) => (
          <Card key={r.id}>
            <CardContent className="p-4 flex items-center justify-between">
              <div className="space-y-1">
                <div className="font-bold">{r.courses?.title || "—"} <span className="text-sm font-normal text-muted-foreground">@ {r.tenants?.name}</span></div>
                <div className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString("ar-SA")}</div>
              </div>
              <div className="text-left">
                <div className="font-bold text-lg">{Number(r.commission_amount).toFixed(2)}</div>
                <Badge variant={r.status === "paid" ? "default" : "secondary"}>
                  {r.status === "paid" ? "مدفوع" : r.status === "pending" ? "معلّق" : "ملغى"}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  );
}

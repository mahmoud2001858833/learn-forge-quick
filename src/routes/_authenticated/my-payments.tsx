import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/my-payments")({
  component: MyPaymentsPage,
});

function MyPaymentsPage() {
  const { user } = useAuth();
  const { data: requests } = useQuery({
    queryKey: ["my-payment-requests", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_requests")
        .select("*, courses(title, slug), course_bundles(name), tenants(name, slug)")
        .eq("student_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const statusBadge = (s: string) => {
    const map: Record<string, string> = { pending: "bg-yellow-500", approved: "bg-green-500", rejected: "bg-red-500", cancelled: "bg-gray-500" };
    const label: Record<string, string> = { pending: "قيد المراجعة", approved: "معتمد", rejected: "مرفوض", cancelled: "ملغى" };
    return <Badge className={map[s]}>{label[s]}</Badge>;
  };

  return (
    <main dir="rtl" className="container mx-auto px-6 py-10 max-w-3xl">
      <Link to="/dashboard" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowRight className="h-4 w-4" /> لوحة التحكم
      </Link>
      <h1 className="text-2xl font-bold mb-6">طلبات الدفع الخاصة بي</h1>
      <div className="space-y-3">
        {requests?.length === 0 && (
          <Card><CardContent className="p-8 text-center text-muted-foreground">لا توجد طلبات دفع</CardContent></Card>
        )}
        {requests?.map((r) => (
          <Card key={r.id}>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="font-bold">{r.courses?.title || r.course_bundles?.name}</div>
                  <div className="text-sm text-muted-foreground">{r.tenants?.name}</div>
                  <div className="text-sm">المبلغ: {r.amount} {r.currency}</div>
                  {r.admin_notes && r.status === "rejected" && (
                    <div className="text-sm text-red-600">سبب الرفض: {r.admin_notes}</div>
                  )}
                  <div className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString("ar-SA")}</div>
                </div>
                {statusBadge(r.status)}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  );
}

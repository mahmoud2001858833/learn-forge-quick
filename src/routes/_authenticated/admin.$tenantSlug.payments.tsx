import { createFileRoute, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Check, X, Eye, FileText } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/$tenantSlug/payments")({
  component: PaymentsAdminPage,
});

type Tab = "pending" | "approved" | "rejected" | "all";

function PaymentsAdminPage() {
  const { tenantSlug } = useParams({ from: "/_authenticated/admin/$tenantSlug/payments" });
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("pending");
  const [reviewing, setReviewing] = useState<{ id: string; action: "approve" | "reject" } | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);

  const { data: tenant } = useQuery({
    queryKey: ["tenant", tenantSlug],
    queryFn: async () => (await supabase.from("tenants").select("id, currency").eq("slug", tenantSlug).single()).data,
  });

  const { data: requests, refetch } = useQuery({
    queryKey: ["payment-requests", tenant?.id, tab],
    enabled: !!tenant,
    queryFn: async () => {
      let q = supabase
        .from("payment_requests")
        .select("*, courses(title), course_bundles(name), bank_accounts(bank_name)")
        .eq("tenant_id", tenant!.id)
        .order("created_at", { ascending: false });
      if (tab !== "all") q = q.eq("status", tab);
      const { data, error } = await q;
      if (error) throw error;
      const ids = Array.from(new Set((data ?? []).map((r) => r.student_id)));
      const profilesMap = new Map<string, { full_name: string | null; phone: string | null }>();
      if (ids.length) {
        const { data: profs } = await supabase.from("profiles").select("id, full_name, phone").in("id", ids);
        profs?.forEach((p) => profilesMap.set(p.id, { full_name: p.full_name, phone: p.phone }));
      }
      return (data ?? []).map((r) => ({ ...r, profile: profilesMap.get(r.student_id) ?? null }));
    },
  });

  const viewReceipt = async (path: string) => {
    const { data } = await supabase.storage.from("receipts").createSignedUrl(path, 300);
    if (data?.signedUrl) setReceiptUrl(data.signedUrl);
  };

  const review = useMutation({
    mutationFn: async () => {
      if (!reviewing) return;
      const rpc = reviewing.action === "approve" ? "approve_payment_request" : "reject_payment_request";
      const { error } = await supabase.rpc(rpc, { _req_id: reviewing.id, _notes: adminNotes || null });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(reviewing?.action === "approve" ? "تم اعتماد الطلب وتفعيل التسجيل" : "تم رفض الطلب");
      setReviewing(null);
      setAdminNotes("");
      qc.invalidateQueries({ queryKey: ["payment-requests"] });
      refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const viewReceipt = async (path: string) => {
    const { data } = await supabase.storage.from("receipts").createSignedUrl(path, 300);
    if (data?.signedUrl) setReceiptUrl(data.signedUrl);
  };

  const statusBadge = (s: string) => {
    const map: Record<string, string> = { pending: "bg-yellow-500", approved: "bg-green-500", rejected: "bg-red-500", cancelled: "bg-gray-500" };
    const label: Record<string, string> = { pending: "قيد المراجعة", approved: "معتمد", rejected: "مرفوض", cancelled: "ملغى" };
    return <Badge className={map[s]}>{label[s]}</Badge>;
  };

  return (
    <div dir="rtl" className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">طلبات الدفع</h1>
        <p className="text-sm text-muted-foreground">راجع طلبات التحويل البنكي واعتمدها لتفعيل تسجيل الطلاب</p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList>
          <TabsTrigger value="pending">قيد المراجعة</TabsTrigger>
          <TabsTrigger value="approved">معتمدة</TabsTrigger>
          <TabsTrigger value="rejected">مرفوضة</TabsTrigger>
          <TabsTrigger value="all">الكل</TabsTrigger>
        </TabsList>
        <TabsContent value={tab} className="space-y-3 mt-4">
          {requests?.length === 0 && (
            <Card><CardContent className="p-8 text-center text-muted-foreground">لا توجد طلبات</CardContent></Card>
          )}
          {requests?.map((r) => (
            <Card key={r.id}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="space-y-1">
                    <div className="font-bold">
                      {r.courses?.title || r.course_bundles?.name || "—"}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      الطالب: {r.profiles?.full_name || "غير معروف"} {r.profiles?.phone && `• ${r.profiles.phone}`}
                    </div>
                    <div className="text-sm">
                      المبلغ: <span className="font-bold">{r.amount} {r.currency}</span>
                      {r.bank_accounts?.bank_name && <> • عبر {r.bank_accounts.bank_name}</>}
                    </div>
                    {r.student_notes && <div className="text-xs text-muted-foreground">ملاحظة الطالب: {r.student_notes}</div>}
                    {r.admin_notes && <div className="text-xs text-blue-600">ملاحظة الإدارة: {r.admin_notes}</div>}
                    <div className="text-xs text-muted-foreground">
                      {new Date(r.created_at).toLocaleString("ar-SA")}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {statusBadge(r.status)}
                    <div className="flex gap-2">
                      {r.receipt_url && (
                        <Button size="sm" variant="outline" onClick={() => viewReceipt(r.receipt_url!)}>
                          <Eye className="h-4 w-4 ml-1" /> الإيصال
                        </Button>
                      )}
                      {r.status === "pending" && (
                        <>
                          <Button size="sm" onClick={() => { setReviewing({ id: r.id, action: "approve" }); setAdminNotes(""); }}>
                            <Check className="h-4 w-4 ml-1" /> اعتماد
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => { setReviewing({ id: r.id, action: "reject" }); setAdminNotes(""); }}>
                            <X className="h-4 w-4 ml-1" /> رفض
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>

      <Dialog open={!!reviewing} onOpenChange={(v) => !v && setReviewing(null)}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>{reviewing?.action === "approve" ? "اعتماد طلب الدفع" : "رفض طلب الدفع"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {reviewing?.action === "approve"
                ? "سيتم تفعيل تسجيل الطالب في الدورة/الحزمة فوراً."
                : "سيتم إعلام الطالب بسبب الرفض. يرجى توضيح السبب."}
            </p>
            <Textarea
              rows={3}
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              placeholder={reviewing?.action === "reject" ? "سبب الرفض..." : "ملاحظة (اختياري)"}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewing(null)}>إلغاء</Button>
            <Button
              variant={reviewing?.action === "reject" ? "destructive" : "default"}
              onClick={() => review.mutate()}
              disabled={review.isPending || (reviewing?.action === "reject" && !adminNotes.trim())}
            >
              تأكيد
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!receiptUrl} onOpenChange={(v) => !v && setReceiptUrl(null)}>
        <DialogContent dir="rtl" className="max-w-3xl">
          <DialogHeader><DialogTitle>إيصال التحويل</DialogTitle></DialogHeader>
          {receiptUrl && (
            receiptUrl.toLowerCase().includes(".pdf") ? (
              <a href={receiptUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-primary">
                <FileText className="h-5 w-5" /> فتح الـ PDF
              </a>
            ) : (
              <img src={receiptUrl} alt="إيصال" className="w-full rounded-lg" />
            )
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

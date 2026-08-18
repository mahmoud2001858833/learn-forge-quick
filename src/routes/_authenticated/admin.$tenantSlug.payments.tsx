import { createFileRoute, useParams } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Check, X, Eye, FileText, Download, Search, DollarSign, Clock, CheckCircle2, XCircle,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/$tenantSlug/payments")({
  component: PaymentsAdminPage,
});

type Tab = "pending" | "approved" | "rejected" | "all";

function downloadPaymentsCSV(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h])).join(","))].join("\n");
  const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function PaymentsAdminPage() {
  const { tenantSlug } = useParams({ from: "/_authenticated/admin/$tenantSlug/payments" });
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("pending");
  const [searchQuery, setSearchQuery] = useState("");
  const [reviewing, setReviewing] = useState<{ id: string; action: "approve" | "reject" } | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);

  const { data: tenant } = useQuery({
    queryKey: ["tenant", tenantSlug],
    queryFn: async () => (await supabase.from("tenants").select("id, currency, name").eq("slug", tenantSlug).single()).data,
  });

  const { data: requests, refetch, isLoading } = useQuery({
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

  // KPI Statistics
  const stats = useMemo(() => {
    if (!requests) return { totalApproved: 0, totalPending: 0, approvedCount: 0, pendingCount: 0, rejectedCount: 0 };
    let totalApproved = 0;
    let totalPending = 0;
    let approvedCount = 0;
    let pendingCount = 0;
    let rejectedCount = 0;

    requests.forEach((r) => {
      const amt = Number(r.amount) || 0;
      if (r.status === "approved") {
        totalApproved += amt;
        approvedCount++;
      } else if (r.status === "pending") {
        totalPending += amt;
        pendingCount++;
      } else if (r.status === "rejected") {
        rejectedCount++;
      }
    });

    return { totalApproved, totalPending, approvedCount, pendingCount, rejectedCount };
  }, [requests]);

  // Search Filter
  const filteredRequests = useMemo(() => {
    if (!requests) return [];
    if (!searchQuery.trim()) return requests;
    const q = searchQuery.toLowerCase();
    return requests.filter((r) => {
      const itemTitle = (r.courses?.title || r.course_bundles?.name || "").toLowerCase();
      const studentName = (r.profile?.full_name || "").toLowerCase();
      const phone = (r.profile?.phone || "").toLowerCase();
      const notes = (r.student_notes || "").toLowerCase();
      return itemTitle.includes(q) || studentName.includes(q) || phone.includes(q) || notes.includes(q);
    });
  }, [requests, searchQuery]);

  const viewReceipt = async (path: string) => {
    const { data } = await supabase.storage.from("receipts").createSignedUrl(path, 300);
    if (data?.signedUrl) setReceiptUrl(data.signedUrl);
  };

  const review = useMutation({
    mutationFn: async () => {
      if (!reviewing) return;
      const rpc = reviewing.action === "approve" ? "approve_payment_request" : "reject_payment_request";
      const { error } = await supabase.rpc(rpc, { _req_id: reviewing.id, _notes: adminNotes || undefined });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(reviewing?.action === "approve" ? "تم اعتماد الطلب وتفعيل تسجيل الطالب بنجاح" : "تم رفض الطلب");
      setReviewing(null);
      setAdminNotes("");
      qc.invalidateQueries({ queryKey: ["payment-requests"] });
      refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const exportCSV = () => {
    if (!filteredRequests.length) {
      toast.error("لا توجد بيانات للتصدير");
      return;
    }
    const rows = filteredRequests.map((r) => ({
      "رقم الطلب": r.id,
      "اسم الطالب": r.profile?.full_name || "غير معروف",
      "رقم الهاتف": r.profile?.phone || "—",
      "العنصر": r.courses?.title || r.course_bundles?.name || "—",
      "المبلغ": r.amount,
      "العملة": r.currency,
      "الحالة": r.status === "approved" ? "معتمد" : r.status === "pending" ? "قيد المراجعة" : "مرفوض",
      "البنك": r.bank_accounts?.bank_name || "—",
      "ملاحظة الطالب": r.student_notes || "",
      "ملاحظة الإدارة": r.admin_notes || "",
      "تاريخ الطلب": new Date(r.created_at).toLocaleString("ar-SA"),
    }));
    downloadPaymentsCSV(`payments-${tenantSlug}-${new Date().toISOString().slice(0, 10)}.csv`, rows);
  };

  const statusBadge = (s: string) => {
    const map: Record<string, { class: string; label: string; icon: React.ComponentType<{ className?: string }> }> = {
      pending: { class: "bg-amber-500/10 text-amber-600 border-amber-500/20", label: "قيد المراجعة", icon: Clock },
      approved: { class: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20", label: "معتمد", icon: CheckCircle2 },
      rejected: { class: "bg-rose-500/10 text-rose-600 border-rose-500/20", label: "مرفوض", icon: XCircle },
      cancelled: { class: "bg-muted text-muted-foreground border-muted-foreground/20", label: "ملغى", icon: X },
    };
    const item = map[s] ?? { class: "bg-muted text-muted-foreground", label: s, icon: Clock };
    const Icon = item.icon;
    return (
      <Badge variant="outline" className={`flex items-center gap-1 font-semibold ${item.class}`}>
        <Icon className="h-3.5 w-3.5" />
        <span>{item.label}</span>
      </Badge>
    );
  };

  const currency = tenant?.currency ?? "SAR";

  return (
    <div dir="rtl" className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">إدارة المدفوعات والتحويلات</h1>
          <p className="text-sm text-muted-foreground mt-1">
            مراجعة واعتماد الحوالات البنكية ومتابعة إيرادات المنصة المالية
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={exportCSV} className="flex items-center gap-2 self-start sm:self-auto">
          <Download className="h-4 w-4" />
          تصدير ملف CSV
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-emerald-500/20 bg-emerald-500/5">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">الإيرادات المعتمدة</CardTitle>
            <DollarSign className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">
              {stats.totalApproved.toLocaleString()} {currency}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{stats.approvedCount} طلب معتمد</p>
          </CardContent>
        </Card>

        <Card className="border-amber-500/20 bg-amber-500/5">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">مبالغ قيد المراجعة</CardTitle>
            <Clock className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              {stats.totalPending.toLocaleString()} {currency}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{stats.pendingCount} طلب بانتظار الاعتماد</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">إجمالي العمليات</CardTitle>
            <FileText className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(requests?.length ?? 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">عملية دفع مسجلة في هذا التبويب</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="w-full sm:w-auto">
          <TabsList className="w-full sm:w-auto grid grid-cols-4">
            <TabsTrigger value="pending">قيد المراجعة</TabsTrigger>
            <TabsTrigger value="approved">معتمدة</TabsTrigger>
            <TabsTrigger value="rejected">مرفوضة</TabsTrigger>
            <TabsTrigger value="all">الكل</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="relative w-full sm:w-72">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="بحث بالطالب أو الدورة..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pr-9"
          />
        </div>
      </div>

      {/* Content List */}
      <div className="space-y-3">
        {isLoading && (
          <div className="p-12 text-center text-muted-foreground">
            <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm">جارٍ تحميل بيانات المدفوعات...</p>
          </div>
        )}

        {!isLoading && filteredRequests.length === 0 && (
          <Card>
            <CardContent className="p-12 text-center text-muted-foreground space-y-2">
              <FileText className="h-10 w-10 mx-auto text-muted-foreground/40" />
              <div className="font-semibold text-foreground">لا توجد طلبات دفع</div>
              <p className="text-xs">
                {searchQuery ? "لا توجد نتائج مطابقة لبحثك." : "لم يتم تسجيل أي طلبات في هذا القسم بعد."}
              </p>
            </CardContent>
          </Card>
        )}

        {filteredRequests.map((r) => (
          <Card key={r.id} className="transition-all hover:border-primary/30">
            <CardContent className="p-4 sm:p-5 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-base text-foreground">
                      {r.courses?.title || r.course_bundles?.name || "دورة غير محددة"}
                    </span>
                    {r.course_bundles?.name && (
                      <Badge variant="secondary" className="text-[10px]">حزمة دورات</Badge>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-foreground">{r.profile?.full_name || "طالب بدون اسم"}</span>
                    {r.profile?.phone && (
                      <span className="text-xs bg-muted px-2 py-0.5 rounded" dir="ltr">
                        {r.profile.phone}
                      </span>
                    )}
                  </div>
                  <div className="text-sm pt-1">
                    المبلغ: <span className="font-bold text-foreground">{r.amount} {r.currency}</span>
                    {r.bank_accounts?.bank_name && (
                      <span className="text-muted-foreground"> • حساب: {r.bank_accounts.bank_name}</span>
                    )}
                  </div>
                  {r.student_notes && (
                    <div className="text-xs bg-muted/60 p-2 rounded-md text-muted-foreground mt-1">
                      <span className="font-semibold">ملاحظة الطالب:</span> {r.student_notes}
                    </div>
                  )}
                  {r.admin_notes && (
                    <div className="text-xs bg-blue-500/10 text-blue-700 dark:text-blue-400 p-2 rounded-md mt-1">
                      <span className="font-semibold">ملاحظة الإدارة:</span> {r.admin_notes}
                    </div>
                  )}
                  <div className="text-[11px] text-muted-foreground pt-1">
                    تاريخ الطلب: {new Date(r.created_at).toLocaleString("ar-SA")}
                  </div>
                </div>

                <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0">
                  {statusBadge(r.status)}
                  <div className="flex items-center gap-2">
                    {r.receipt_url && (
                      <Button size="sm" variant="outline" onClick={() => viewReceipt(r.receipt_url!)} className="flex items-center gap-1">
                        <Eye className="h-3.5 w-3.5" /> الإيصال
                      </Button>
                    )}
                    {r.status === "pending" && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => { setReviewing({ id: r.id, action: "approve" }); setAdminNotes(""); }}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1"
                        >
                          <Check className="h-3.5 w-3.5" /> اعتماد
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => { setReviewing({ id: r.id, action: "reject" }); setAdminNotes(""); }}
                          className="flex items-center gap-1"
                        >
                          <X className="h-3.5 w-3.5" /> رفض
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Review Dialog */}
      <Dialog open={!!reviewing} onOpenChange={(v) => !v && setReviewing(null)}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>{reviewing?.action === "approve" ? "اعتماد وتأكيد الدفع" : "رفض طلب الدفع"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <p className="text-sm text-muted-foreground leading-relaxed">
              {reviewing?.action === "approve"
                ? "سيتم تفعيل وصول الطالب إلى الدورة/الحزمة فوراً وإرسال إشعار له بالاعتماد."
                : "سيتم إعلام الطالب بسبب الرفض عبر الإشعارات. يرجى توضيح سبب الرفض."}
            </p>
            <Textarea
              rows={3}
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              placeholder={reviewing?.action === "reject" ? "يرجى كتابة سبب الرفض هنا..." : "ملاحظة إضافية (اختياري)..."}
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button variant="outline" onClick={() => setReviewing(null)}>إلغاء</Button>
            <Button
              variant={reviewing?.action === "reject" ? "destructive" : "default"}
              onClick={() => review.mutate()}
              disabled={review.isPending || (reviewing?.action === "reject" && !adminNotes.trim())}
              className={reviewing?.action === "approve" ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""}
            >
              {review.isPending ? "جارٍ التنفيذ..." : "تأكيد الإجراء"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receipt Preview Dialog */}
      <Dialog open={!!receiptUrl} onOpenChange={(v) => !v && setReceiptUrl(null)}>
        <DialogContent dir="rtl" className="max-w-3xl">
          <DialogHeader><DialogTitle>معاينة إيصال التحويل البنكي</DialogTitle></DialogHeader>
          <div className="p-2">
            {receiptUrl && (
              receiptUrl.toLowerCase().includes(".pdf") ? (
                <div className="text-center py-8">
                  <a href={receiptUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-primary font-semibold hover:underline">
                    <FileText className="h-6 w-6" /> فتح ملف الـ PDF في نافذة جديدة
                  </a>
                </div>
              ) : (
                <img src={receiptUrl} alt="إيصال التحويل" className="w-full max-h-[70vh] object-contain rounded-lg border shadow-sm" />
              )
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

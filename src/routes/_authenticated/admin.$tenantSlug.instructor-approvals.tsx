import { createFileRoute, useParams } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { UserCheck, UserX, Clock } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/admin/$tenantSlug/instructor-approvals")({
  component: InstructorApprovalsPage,
});

type Row = {
  id: string;
  user_id: string;
  role: string;
  applied_role: string | null;
  application_note: string | null;
  created_at: string;
  approved_at: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  profile: { full_name: string | null; avatar_url: string | null } | null;
};

function InstructorApprovalsPage() {
  const { tenantSlug } = useParams({ from: "/_authenticated/admin/$tenantSlug/instructor-approvals" });
  const qc = useQueryClient();

  const { data: tenant } = useQuery({
    queryKey: ["tenant-id", tenantSlug],
    queryFn: async () => (await supabase.from("tenants").select("id").eq("slug", tenantSlug).maybeSingle()).data,
  });

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["instructor-approvals", tenant?.id],
    enabled: !!tenant?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenant_members")
        .select("id, user_id, role, applied_role, application_note, created_at, approved_at, rejected_at, rejection_reason")
        .eq("tenant_id", tenant!.id)
        .in("role", ["pending_instructor", "instructor"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      const ids = (data ?? []).map((r) => r.user_id);
      if (ids.length === 0) return [] as Row[];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", ids);
      const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
      return (data ?? []).map((r) => ({
        ...r,
        profile: byId.get(r.user_id) ?? null,
      })) as Row[];
    },
  });

  const approve = useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await supabase.rpc("approve_instructor", { _member_id: memberId });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تمت الموافقة على المعلم");
      qc.invalidateQueries({ queryKey: ["instructor-approvals"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reject = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { error } = await supabase.rpc("reject_instructor", { _member_id: id, _reason: reason || undefined });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم رفض الطلب");
      qc.invalidateQueries({ queryKey: ["instructor-approvals"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pending = rows.filter((r) => r.role === "pending_instructor");
  const approved = rows.filter((r) => r.role === "instructor");

  return (
    <div className="space-y-8" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold">طلبات المعلمين</h1>
        <p className="text-muted-foreground text-sm">وافق على الحسابات المتقدمة كمعلمين، أو ارفضها.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-amber-500" /> بانتظار الموافقة ({pending.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <div className="text-sm text-muted-foreground">جارٍ التحميل...</div>
          ) : pending.length === 0 ? (
            <div className="text-sm text-muted-foreground">لا توجد طلبات معلقة.</div>
          ) : (
            pending.map((r) => (
              <ApprovalRow
                key={r.id}
                row={r}
                onApprove={() => approve.mutate(r.id)}
                onReject={(reason) => reject.mutate({ id: r.id, reason })}
                busy={approve.isPending || reject.isPending}
              />
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-green-600" /> المعلمون المعتمدون ({approved.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {approved.length === 0 ? (
            <div className="text-sm text-muted-foreground">لا يوجد معلمون معتمدون بعد.</div>
          ) : (
            approved.map((r) => (
              <div key={r.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
                <div className="flex items-center gap-3">
                  {r.profile?.avatar_url ? (
                    <img src={r.profile.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover" />
                  ) : (
                    <div className="h-9 w-9 rounded-full bg-muted grid place-items-center text-xs">
                      {(r.profile?.full_name ?? "?").slice(0, 1)}
                    </div>
                  )}
                  <div>
                    <div className="font-medium text-sm">{r.profile?.full_name ?? "مستخدم"}</div>
                    <div className="text-xs text-muted-foreground">
                      تمت الموافقة {r.approved_at ? new Date(r.approved_at).toLocaleDateString("ar") : ""}
                    </div>
                  </div>
                </div>
                <Badge variant="secondary">معلم</Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ApprovalRow({
  row,
  onApprove,
  onReject,
  busy,
}: {
  row: Row;
  onApprove: () => void;
  onReject: (reason: string) => void;
  busy: boolean;
}) {
  const [showReject, setShowReject] = useState(false);
  const [reason, setReason] = useState("");
  return (
    <div className="p-4 rounded-lg border bg-background space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          {row.profile?.avatar_url ? (
            <img src={row.profile.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover" />
          ) : (
            <div className="h-10 w-10 rounded-full bg-muted grid place-items-center text-sm">
              {(row.profile?.full_name ?? "?").slice(0, 1)}
            </div>
          )}
          <div>
            <div className="font-medium">{row.profile?.full_name ?? "مستخدم"}</div>
            <div className="text-xs text-muted-foreground">
              تقدّم بتاريخ {new Date(row.created_at).toLocaleDateString("ar")}
            </div>
          </div>
        </div>
        <Badge className="bg-amber-500/10 text-amber-700 border-amber-500/30">قيد المراجعة</Badge>
      </div>
      {row.application_note && (
        <div className="text-sm bg-muted/40 rounded-md p-3 leading-relaxed">
          <span className="font-medium">النبذة: </span>
          {row.application_note}
        </div>
      )}
      {row.rejected_at && (
        <div className="text-xs text-red-600">
          تم رفض هذا الطلب سابقاً{row.rejection_reason ? ` — السبب: ${row.rejection_reason}` : ""}. يمكنك الموافقة عليه لتفعيله.
        </div>
      )}
      {!showReject ? (
        <div className="flex gap-2">
          <Button size="sm" onClick={onApprove} disabled={busy}>
            <UserCheck className="h-4 w-4 ml-1" /> موافقة
          </Button>
          <Button size="sm" variant="outline" onClick={() => setShowReject(true)} disabled={busy}>
            <UserX className="h-4 w-4 ml-1" /> رفض
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <input
            type="text"
            placeholder="سبب الرفض (اختياري)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full text-sm rounded-md border px-3 py-2 bg-background"
          />
          <div className="flex gap-2">
            <Button size="sm" variant="destructive" onClick={() => onReject(reason)} disabled={busy}>
              تأكيد الرفض
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowReject(false)} disabled={busy}>
              إلغاء
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

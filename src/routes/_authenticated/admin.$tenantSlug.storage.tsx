import { createFileRoute, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { HardDrive, Film, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/$tenantSlug/storage")({
  component: StoragePage,
});

function fmtBytes(n: number): string {
  if (!n) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(n) / Math.log(1024));
  return `${(n / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
}

function StoragePage() {
  const { tenantSlug } = useParams({ from: "/_authenticated/admin/$tenantSlug/storage" });

  const { data: tenant, isLoading } = useQuery({
    queryKey: ["tenant-storage", tenantSlug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenants")
        .select("id, name, storage_quota_bytes, storage_used_bytes")
        .eq("slug", tenantSlug)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: videos = [] } = useQuery({
    queryKey: ["tenant-storage-videos", tenant?.id],
    enabled: !!tenant?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("video_assets")
        .select("id, original_filename, size_bytes, status, created_at")
        .eq("tenant_id", tenant!.id)
        .order("size_bytes", { ascending: false, nullsFirst: false })
        .limit(20);
      return data ?? [];
    },
  });

  if (isLoading || !tenant) {
    return <div className="p-6 text-sm text-muted-foreground">جارٍ التحميل...</div>;
  }

  const quota = Number(tenant.storage_quota_bytes || 0);
  const used = Number(tenant.storage_used_bytes || 0);
  const pct = quota > 0 ? Math.min(100, (used / quota) * 100) : 0;
  const remaining = Math.max(0, quota - used);
  const nearLimit = pct >= 85;
  const overLimit = used >= quota;

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <HardDrive className="h-6 w-6" /> التخزين
        </h1>
        <p className="text-sm text-muted-foreground">حصة الفيديوهات لمنصة {tenant.name}.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>الاستخدام الحالي</span>
            {overLimit ? (
              <Badge variant="destructive">تجاوز الحصة</Badge>
            ) : nearLimit ? (
              <Badge className="bg-amber-500/15 text-amber-700 border-amber-500/30">اقتربت من الحد</Badge>
            ) : (
              <Badge variant="secondary">ضمن الحد</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            <Stat label="المستخدم" value={fmtBytes(used)} />
            <Stat label="المتبقي" value={fmtBytes(remaining)} />
            <Stat label="الحصة الكاملة" value={fmtBytes(quota)} />
          </div>
          <Progress value={pct} className="h-3" />
          <div className="text-xs text-muted-foreground text-center">{pct.toFixed(1)}% من الحصة مستخدمة</div>

          {nearLimit && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-sm">
              <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <div>
                اقتربت من نهاية حصتك. لزيادة الحصة لهذه المنصة تواصل مع مدير النظام (Super Admin).
              </div>
            </div>
          )}
          {overLimit && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-sm">
              <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
              <div>لن يُقبل رفع فيديوهات جديدة حتى تُخفّف الاستخدام أو تُرفع الحصة.</div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Film className="h-5 w-5" /> أكبر الفيديوهات ({videos.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {videos.length === 0 ? (
            <div className="text-sm text-muted-foreground">لا توجد فيديوهات بعد.</div>
          ) : (
            <div className="divide-y">
              {videos.map((v) => (
                <div key={v.id} className="flex items-center justify-between py-2 text-sm">
                  <div className="truncate">
                    <div className="font-medium truncate">{v.original_filename ?? v.id}</div>
                    <div className="text-xs text-muted-foreground">
                      {v.status} · {new Date(v.created_at).toLocaleDateString("ar")}
                    </div>
                  </div>
                  <div className="tabular-nums font-mono text-xs">
                    {fmtBytes(Number(v.size_bytes || 0))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3 bg-muted/20">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-bold text-lg tabular-nums">{value}</div>
    </div>
  );
}

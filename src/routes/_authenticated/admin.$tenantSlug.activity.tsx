import { createFileRoute, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/admin/$tenantSlug/activity")({
  component: ActivityPage,
});

function ActivityPage() {
  const { tenantSlug } = useParams({ from: "/_authenticated/admin/$tenantSlug/activity" });

  const { data: tenant } = useQuery({
    queryKey: ["tenant", tenantSlug],
    queryFn: async () => (await supabase.from("tenants").select("id").eq("slug", tenantSlug).single()).data,
  });

  const { data: logs } = useQuery({
    queryKey: ["activity", tenant?.id],
    enabled: !!tenant,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity_logs")
        .select("*, profiles:actor_id(full_name)")
        .eq("tenant_id", tenant!.id)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold">سجل النشاط</h1>
        <p className="text-muted-foreground text-sm">آخر 200 عملية على المنصة</p>
      </div>
      <Card>
        <CardContent className="p-0">
          {(logs ?? []).length === 0 && <p className="text-sm text-muted-foreground p-6 text-center">لا توجد عمليات بعد</p>}
          {(logs ?? []).map((l) => (
            <div key={l.id} className="p-4 border-b last:border-0 flex items-start gap-3">
              <Badge variant="outline">{l.action}</Badge>
              <div className="flex-1 text-sm">
                <div className="font-medium">{(l as any).profiles?.full_name ?? "نظام"}</div>
                {l.entity_type && <div className="text-xs text-muted-foreground">{l.entity_type} · {l.entity_id?.slice(0, 8)}</div>}
                {l.metadata && Object.keys(l.metadata).length > 0 && (
                  <pre className="text-[11px] bg-muted/40 p-2 rounded mt-1 overflow-x-auto">{JSON.stringify(l.metadata, null, 2)}</pre>
                )}
              </div>
              <div className="text-xs text-muted-foreground whitespace-nowrap">{new Date(l.created_at).toLocaleString("ar")}</div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

import { createFileRoute, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/admin/$tenantSlug/students")({
  component: StudentsPage,
});

function StudentsPage() {
  const { tenantSlug } = useParams({ from: "/_authenticated/admin/$tenantSlug/students" });

  const { data: students } = useQuery({
    queryKey: ["tenant-students", tenantSlug],
    queryFn: async () => {
      const { data: tenant } = await supabase.from("tenants").select("id").eq("slug", tenantSlug).single();
      if (!tenant) return [];
      const { data: members, error } = await supabase
        .from("tenant_members")
        .select("*")
        .eq("tenant_id", tenant.id);
      if (error) throw error;
      const userIds = members.map((m) => m.user_id);
      if (userIds.length === 0) return [];
      const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", userIds);
      const map = new Map(profiles?.map((p) => [p.id, p]) ?? []);
      return members.map((m) => ({ ...m, profile: map.get(m.user_id) }));
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">الطلاب</h1>
        <p className="text-muted-foreground">قائمة أعضاء منصتك</p>
      </div>
      <Card>
        <CardContent className="p-0">
          {students && students.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground">لا يوجد طلاب بعد</div>
          ) : (
            <div className="text-sm">
              <div className="grid grid-cols-3 bg-muted/50 text-right font-medium">
                <div className="p-3">الاسم</div>
                <div className="p-3">الدور</div>
                <div className="p-3">تاريخ الانضمام</div>
              </div>
              {(students?.length ?? 0) > VIRTUALIZE_THRESHOLD ? (
                <VirtualRows
                  items={students ?? []}
                  getKey={(m) => m.id}
                  estimateRowHeight={49}
                  renderRow={(m) => (
                    <div className="grid grid-cols-3 border-t text-right">
                      <div className="p-3">{m.profile?.full_name ?? "—"}</div>
                      <div className="p-3"><Badge variant="outline">{m.role}</Badge></div>
                      <div className="p-3 text-muted-foreground">{new Date(m.created_at).toLocaleDateString("ar")}</div>
                    </div>
                  )}
                />
              ) : (
                students?.map((m) => (
                  <div key={m.id} className="grid grid-cols-3 border-t text-right">
                    <div className="p-3">{m.profile?.full_name ?? "—"}</div>
                    <div className="p-3"><Badge variant="outline">{m.role}</Badge></div>
                    <div className="p-3 text-muted-foreground">{new Date(m.created_at).toLocaleDateString("ar")}</div>
                  </div>
                ))
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

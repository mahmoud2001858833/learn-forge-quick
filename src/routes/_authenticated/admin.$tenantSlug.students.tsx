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
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-right">
                <tr>
                  <th className="p-3">الاسم</th>
                  <th className="p-3">الدور</th>
                  <th className="p-3">تاريخ الانضمام</th>
                </tr>
              </thead>
              <tbody>
                {students?.map((m) => (
                  <tr key={m.id} className="border-t">
                    <td className="p-3">{m.profile?.full_name ?? "—"}</td>
                    <td className="p-3"><Badge variant="outline">{m.role}</Badge></td>
                    <td className="p-3 text-muted-foreground">{new Date(m.created_at).toLocaleDateString("ar")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

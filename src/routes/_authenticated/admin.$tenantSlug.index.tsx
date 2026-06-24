import { createFileRoute, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, Users, GraduationCap } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/$tenantSlug/")({
  component: Overview,
});

function Overview() {
  const { tenantSlug } = useParams({ from: "/_authenticated/admin/$tenantSlug/" });

  const { data: stats } = useQuery({
    queryKey: ["tenant-stats", tenantSlug],
    queryFn: async () => {
      const { data: tenant } = await supabase.from("tenants").select("id").eq("slug", tenantSlug).single();
      if (!tenant) return null;
      const [courses, members, enrollments] = await Promise.all([
        supabase.from("courses").select("id", { count: "exact", head: true }).eq("tenant_id", tenant.id),
        supabase.from("tenant_members").select("id", { count: "exact", head: true }).eq("tenant_id", tenant.id).eq("role", "student"),
        supabase.from("enrollments").select("id", { count: "exact", head: true }).eq("tenant_id", tenant.id),
      ]);
      return { courses: courses.count ?? 0, students: members.count ?? 0, enrollments: enrollments.count ?? 0 };
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">نظرة عامة</h1>
        <p className="text-muted-foreground">ملخص نشاط منصتك</p>
      </div>
      <div className="grid md:grid-cols-3 gap-4">
        <StatCard icon={BookOpen} label="الدورات" value={stats?.courses ?? 0} />
        <StatCard icon={Users} label="الطلاب" value={stats?.students ?? 0} />
        <StatCard icon={GraduationCap} label="التسجيلات" value={stats?.enrollments ?? 0} />
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent><div className="text-3xl font-bold">{value}</div></CardContent>
    </Card>
  );
}

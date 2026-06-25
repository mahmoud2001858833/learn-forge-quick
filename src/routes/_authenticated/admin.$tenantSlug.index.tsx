import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, Users, GraduationCap, DollarSign, Receipt, Award, Star, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/admin/$tenantSlug/")({
  component: Overview,
});

function Overview() {
  const { tenantSlug } = useParams({ from: "/_authenticated/admin/$tenantSlug/" });

  const { data: tenant } = useQuery({
    queryKey: ["tenant", tenantSlug],
    queryFn: async () => (await supabase.from("tenants").select("id, currency").eq("slug", tenantSlug).single()).data,
  });

  const { data: stats } = useQuery({
    queryKey: ["tenant-overview", tenant?.id],
    enabled: !!tenant,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("tenant_overview_stats", { _tenant_id: tenant!.id });
      if (error) throw error;
      return data as Record<string, number>;
    },
  });

  const currency = tenant?.currency ?? "ر.س";
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">نظرة عامة</h1>
          <p className="text-muted-foreground">ملخص نشاط منصتك</p>
        </div>
        <Link to="/admin/$tenantSlug/reports" params={{ tenantSlug }}>
          <Button variant="outline"><BarChart3 className="h-4 w-4 ml-2" />التقارير التفصيلية</Button>
        </Link>
      </div>
      <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-4">
        <StatCard icon={DollarSign} label="الإيرادات" value={`${Number(stats?.revenue ?? 0).toLocaleString()} ${currency}`} />
        <StatCard icon={Users} label="الطلاب" value={stats?.students ?? 0} />
        <StatCard icon={GraduationCap} label="التسجيلات" value={stats?.enrollments ?? 0} />
        <StatCard icon={BookOpen} label="الدورات" value={`${stats?.published_courses ?? 0} / ${stats?.courses ?? 0}`} />
        <StatCard icon={Receipt} label="طلبات دفع معلّقة" value={stats?.pending_payments ?? 0} />
        <StatCard icon={Award} label="شهادات صادرة" value={stats?.certificates ?? 0} />
        <StatCard icon={Star} label="متوسط التقييم" value={Number(stats?.avg_rating ?? 0).toFixed(2)} />
        <StatCard icon={GraduationCap} label="تسجيلات نشطة" value={stats?.active_enrollments ?? 0} />
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number | string }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent><div className="text-2xl font-bold">{value}</div></CardContent>
    </Card>
  );
}

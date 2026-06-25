import { createFileRoute, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar,
} from "recharts";

export const Route = createFileRoute("/_authenticated/admin/$tenantSlug/reports")({
  component: ReportsPage,
});

function ReportsPage() {
  const { tenantSlug } = useParams({ from: "/_authenticated/admin/$tenantSlug/reports" });
  const [days, setDays] = useState(30);

  const { data: tenant } = useQuery({
    queryKey: ["tenant", tenantSlug],
    queryFn: async () => (await supabase.from("tenants").select("id, currency").eq("slug", tenantSlug).single()).data,
  });

  const { data: revenue } = useQuery({
    queryKey: ["rev-by-day", tenant?.id, days],
    enabled: !!tenant,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("tenant_revenue_by_day", { _tenant_id: tenant!.id, _days: days });
      if (error) throw error;
      return (data ?? []).map((d: any) => ({ ...d, revenue: Number(d.revenue) }));
    },
  });

  const { data: enrollments } = useQuery({
    queryKey: ["enr-by-day", tenant?.id, days],
    enabled: !!tenant,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("tenant_enrollments_by_day", { _tenant_id: tenant!.id, _days: days });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: topCourses } = useQuery({
    queryKey: ["top-courses", tenant?.id],
    enabled: !!tenant,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("tenant_top_courses", { _tenant_id: tenant!.id, _limit: 10 });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: students } = useQuery({
    queryKey: ["student-progress", tenant?.id],
    enabled: !!tenant,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("tenant_student_progress", { _tenant_id: tenant!.id, _limit: 100 });
      if (error) throw error;
      return data ?? [];
    },
  });

  const currency = tenant?.currency ?? "ر.س";
  const totalRev = revenue?.reduce((s, d: any) => s + Number(d.revenue), 0) ?? 0;
  const totalEnr = enrollments?.reduce((s: number, d: any) => s + Number(d.count), 0) ?? 0;

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-3xl font-bold">التقارير والتحليلات</h1>
          <p className="text-muted-foreground">أداء منصتك بالتفصيل</p>
        </div>
        <div className="flex gap-1">
          {[7, 30, 90].map((d) => (
            <Button key={d} size="sm" variant={days === d ? "default" : "outline"} onClick={() => setDays(d)}>{d} يوم</Button>
          ))}
        </div>
      </div>

      <Tabs defaultValue="revenue">
        <TabsList>
          <TabsTrigger value="revenue">الإيرادات</TabsTrigger>
          <TabsTrigger value="enrollments">التسجيلات</TabsTrigger>
          <TabsTrigger value="courses">أفضل الدورات</TabsTrigger>
          <TabsTrigger value="students">تقدم الطلاب</TabsTrigger>
        </TabsList>

        <TabsContent value="revenue" className="pt-4">
          <Card>
            <CardHeader><CardTitle>إجمالي الإيرادات: {totalRev.toLocaleString()} {currency}</CardTitle></CardHeader>
            <CardContent className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenue ?? []}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.2} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="enrollments" className="pt-4">
          <Card>
            <CardHeader><CardTitle>إجمالي التسجيلات: {totalEnr}</CardTitle></CardHeader>
            <CardContent className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={enrollments ?? []}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="courses" className="pt-4">
          <Card>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/40">
                  <tr>
                    <th className="text-right p-3">الدورة</th>
                    <th className="text-right p-3">التسجيلات</th>
                    <th className="text-right p-3">الإيراد</th>
                    <th className="text-right p-3">التقييم</th>
                  </tr>
                </thead>
                <tbody>
                  {(topCourses ?? []).map((c: any) => (
                    <tr key={c.course_id} className="border-b last:border-0">
                      <td className="p-3 font-medium">{c.title}</td>
                      <td className="p-3">{c.enrollments_count}</td>
                      <td className="p-3">{Number(c.revenue).toLocaleString()} {currency}</td>
                      <td className="p-3">{Number(c.average_rating).toFixed(2)}</td>
                    </tr>
                  ))}
                  {(topCourses ?? []).length === 0 && (
                    <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">لا بيانات</td></tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="students" className="pt-4">
          <Card>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/40">
                  <tr>
                    <th className="text-right p-3">الطالب</th>
                    <th className="text-right p-3">التسجيلات</th>
                    <th className="text-right p-3">المكتملة</th>
                    <th className="text-right p-3">متوسط التقدم</th>
                  </tr>
                </thead>
                <tbody>
                  {(students ?? []).map((s: any) => (
                    <tr key={s.student_id} className="border-b last:border-0">
                      <td className="p-3 font-medium">{s.full_name ?? "—"}</td>
                      <td className="p-3">{s.enrollments_count}</td>
                      <td className="p-3">{s.completed_count}</td>
                      <td className="p-3">{Number(s.avg_progress).toFixed(0)}%</td>
                    </tr>
                  ))}
                  {(students ?? []).length === 0 && (
                    <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">لا بيانات</td></tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

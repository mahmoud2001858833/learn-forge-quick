import { createFileRoute, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Download, AlertTriangle, TrendingUp, Users } from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, FunnelChart, Funnel, LabelList,
} from "recharts";

export const Route = createFileRoute("/_authenticated/admin/$tenantSlug/reports")({
  component: ReportsPage,
});

function downloadCSV(filename: string, rows: Record<string, unknown>[]) {
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

  const { data: funnel } = useQuery({
    queryKey: ["funnel", tenant?.id, days],
    enabled: !!tenant,
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("tenant_funnel_summary", { _tenant_id: tenant!.id, _days: days });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: atRisk } = useQuery({
    queryKey: ["at-risk", tenant?.id],
    enabled: !!tenant,
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("tenant_at_risk_students", { _tenant_id: tenant!.id, _inactive_days: 14, _limit: 100 });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: cohorts } = useQuery({
    queryKey: ["cohorts", tenant?.id],
    enabled: !!tenant,
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("tenant_cohort_retention", { _tenant_id: tenant!.id, _weeks: 8 });
      if (error) throw error;
      return data ?? [];
    },
  });

  const currency = tenant?.currency ?? "ر.س";
  const totalRev = revenue?.reduce((s: number, d: any) => s + Number(d.revenue), 0) ?? 0;
  const totalEnr = enrollments?.reduce((s: number, d: any) => s + Number(d.count), 0) ?? 0;

  const stageLabel = (s: string) =>
    ({ enrolled: "مسجّل", started: "بدأ التعلم", completed: "أكمل الدورة", certified: "حصل على شهادة" } as Record<string, string>)[s] ?? s;

  const funnelData = (funnel ?? []).map((f: any) => ({
    name: `${stageLabel(f.stage)} (${f.percent}%)`,
    value: Number(f.count),
    fill: f.stage === "enrolled" ? "hsl(var(--primary))"
      : f.stage === "started" ? "#10b981"
      : f.stage === "completed" ? "#f59e0b"
      : "#ef4444",
  }));

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
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="revenue">الإيرادات</TabsTrigger>
          <TabsTrigger value="enrollments">التسجيلات</TabsTrigger>
          <TabsTrigger value="funnel"><TrendingUp className="h-3.5 w-3.5 ms-1" />القُمع</TabsTrigger>
          <TabsTrigger value="cohorts"><Users className="h-3.5 w-3.5 ms-1" />الاستبقاء</TabsTrigger>
          <TabsTrigger value="at-risk"><AlertTriangle className="h-3.5 w-3.5 ms-1" />طلاب في خطر</TabsTrigger>
          <TabsTrigger value="courses">أفضل الدورات</TabsTrigger>
          <TabsTrigger value="students">تقدم الطلاب</TabsTrigger>
        </TabsList>

        <TabsContent value="revenue" className="pt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>إجمالي الإيرادات: {totalRev.toLocaleString()} {currency}</CardTitle>
              <Button size="sm" variant="outline" onClick={() => downloadCSV(`revenue-${days}d.csv`, revenue ?? [])}>
                <Download className="h-4 w-4 ms-1" /> CSV
              </Button>
            </CardHeader>
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
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>إجمالي التسجيلات: {totalEnr}</CardTitle>
              <Button size="sm" variant="outline" onClick={() => downloadCSV(`enrollments-${days}d.csv`, enrollments ?? [])}>
                <Download className="h-4 w-4 ms-1" /> CSV
              </Button>
            </CardHeader>
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

        <TabsContent value="funnel" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle>قُمع التحويل ({days} يوم)</CardTitle>
              <p className="text-sm text-muted-foreground">من التسجيل إلى الشهادة — حدّد أين تخسر الطلاب.</p>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <FunnelChart>
                    <Tooltip />
                    <Funnel dataKey="value" data={funnelData} isAnimationActive>
                      <LabelList position="right" fill="hsl(var(--foreground))" stroke="none" dataKey="name" />
                    </Funnel>
                  </FunnelChart>
                </ResponsiveContainer>
              </div>
              <div className="grid sm:grid-cols-4 gap-3 mt-4">
                {(funnel ?? []).map((f: any) => (
                  <div key={f.stage} className="border rounded-xl p-3">
                    <p className="text-xs text-muted-foreground">{stageLabel(f.stage)}</p>
                    <p className="text-2xl font-bold">{f.count}</p>
                    <p className="text-xs text-primary">{f.percent}%</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cohorts" className="pt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>استبقاء الأفواج الأسبوعية</CardTitle>
                <p className="text-sm text-muted-foreground">كم طالباً من كل دفعة لا يزال نشطاً بعد 1/2/3/4 أسابيع.</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => downloadCSV("cohorts.csv", cohorts ?? [])}>
                <Download className="h-4 w-4 ms-1" /> CSV
              </Button>
            </CardHeader>
            <CardContent className="p-0 overflow-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/40">
                  <tr>
                    <th className="text-right p-3">أسبوع التسجيل</th>
                    <th className="text-right p-3">الحجم</th>
                    <th className="text-right p-3">أسبوع 1</th>
                    <th className="text-right p-3">أسبوع 2</th>
                    <th className="text-right p-3">أسبوع 3</th>
                    <th className="text-right p-3">أسبوع 4</th>
                  </tr>
                </thead>
                <tbody>
                  {(cohorts ?? []).map((c: any) => {
                    const pct = (n: number) => (c.cohort_size > 0 ? Math.round((n * 100) / c.cohort_size) : 0);
                    const cell = (n: number) => (
                      <td className="p-3">
                        <span className="inline-flex items-center gap-2">
                          <span className="font-medium">{n}</span>
                          <span className="text-xs text-muted-foreground">({pct(n)}%)</span>
                        </span>
                      </td>
                    );
                    return (
                      <tr key={c.cohort_week} className="border-b last:border-0">
                        <td className="p-3 font-medium">{c.cohort_week}</td>
                        <td className="p-3">{c.cohort_size}</td>
                        {cell(Number(c.week_1_active))}
                        {cell(Number(c.week_2_active))}
                        {cell(Number(c.week_3_active))}
                        {cell(Number(c.week_4_active))}
                      </tr>
                    );
                  })}
                  {(cohorts ?? []).length === 0 && (
                    <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">لا بيانات كافية</td></tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="at-risk" className="pt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  طلاب في خطر التسرّب ({atRisk?.length ?? 0})
                </CardTitle>
                <p className="text-sm text-muted-foreground">مسجّلون لكنهم لم يفتحوا أي درس منذ 14+ يوم.</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => downloadCSV("at-risk.csv", atRisk ?? [])}>
                <Download className="h-4 w-4 ms-1" /> CSV
              </Button>
            </CardHeader>
            <CardContent className="p-0 overflow-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/40">
                  <tr>
                    <th className="text-right p-3">الطالب</th>
                    <th className="text-right p-3">الدورة</th>
                    <th className="text-right p-3">التقدم</th>
                    <th className="text-right p-3">آخر نشاط</th>
                    <th className="text-right p-3">أيام الخمول</th>
                  </tr>
                </thead>
                <tbody>
                  {(atRisk ?? []).map((s: any) => (
                    <tr key={s.enrollment_id} className="border-b last:border-0">
                      <td className="p-3 font-medium">{s.full_name ?? "—"}</td>
                      <td className="p-3 text-muted-foreground">{s.course_title}</td>
                      <td className="p-3">{Number(s.progress).toFixed(0)}%</td>
                      <td className="p-3">{new Date(s.last_activity).toLocaleDateString("ar-EG")}</td>
                      <td className="p-3">
                        <span className="inline-block px-2 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-400 text-xs">
                          {s.inactive_days} يوم
                        </span>
                      </td>
                    </tr>
                  ))}
                  {(atRisk ?? []).length === 0 && (
                    <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">رائع! لا يوجد طلاب في خطر حالياً.</td></tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="courses" className="pt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>أفضل الدورات</CardTitle>
              <Button size="sm" variant="outline" onClick={() => downloadCSV("top-courses.csv", topCourses ?? [])}>
                <Download className="h-4 w-4 ms-1" /> CSV
              </Button>
            </CardHeader>
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
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>تقدم الطلاب</CardTitle>
              <Button size="sm" variant="outline" onClick={() => downloadCSV("students.csv", students ?? [])}>
                <Download className="h-4 w-4 ms-1" /> CSV
              </Button>
            </CardHeader>
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

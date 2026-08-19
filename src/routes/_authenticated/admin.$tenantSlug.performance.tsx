import { createFileRoute, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Activity, Gauge, ServerCog, AlertTriangle, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/$tenantSlug/performance")({
  component: PerformancePage,
  head: () => ({
    meta: [
      { title: "مراقبة الأداء | لوحة التحكم" },
      { name: "description", content: "أزمنة الاستجابة وسرعة تحميل الصفحات لمنصتك التعليمية مع رصد أبطأ الصفحات والعمليات." },
    ],
  }),
});

type VitalRow = {
  metric: string; path: string; samples: number;
  p50: number; p75: number; p95: number; poor_ratio: number;
};
type ServerRow = {
  name: string; kind: string; calls: number; errors: number;
  avg_ms: number; p95_ms: number; max_ms: number;
};
type ErrorRow = {
  id: string; message: string; source: string; path: string | null;
  tenant_slug: string | null; count: number; status: string;
  first_seen: string; last_seen: string;
};
type HealthRow = {
  name: string; status: string; latency_ms: number | null;
  error_message: string | null; last_ok_at: string | null;
  checked_at: string; consecutive_failures: number;
};


const RANGES = [
  { hours: 1, label: "آخر ساعة" },
  { hours: 24, label: "آخر 24 ساعة" },
  { hours: 24 * 7, label: "آخر 7 أيام" },
];

// Web-vitals "good" thresholds (ms, except CLS which is unitless).
const GOOD: Record<string, number> = { LCP: 2500, FCP: 1800, TTFB: 800, INP: 200, CLS: 0.1 };
const NEEDS: Record<string, number> = { LCP: 4000, FCP: 3000, TTFB: 1800, INP: 500, CLS: 0.25 };

function fmtMetric(metric: string, value: number) {
  if (metric === "CLS") return value.toFixed(3);
  if (value >= 1000) return `${(value / 1000).toFixed(2)} ث`;
  return `${Math.round(value)} م.ث`;
}

function ratingOf(metric: string, value: number): "good" | "needs" | "poor" {
  const good = GOOD[metric];
  const needs = NEEDS[metric];
  if (good == null) return "good";
  if (value <= good) return "good";
  if (value <= needs) return "needs";
  return "poor";
}

function RatingBadge({ metric, value }: { metric: string; value: number }) {
  const r = ratingOf(metric, value);
  if (r === "good") return <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30">جيد</Badge>;
  if (r === "needs") return <Badge className="bg-amber-500/15 text-amber-700 border-amber-500/30">يحتاج تحسين</Badge>;
  return <Badge variant="destructive">بطيء</Badge>;
}

function PerformancePage() {
  const { tenantSlug } = useParams({ from: "/_authenticated/admin/$tenantSlug/performance" });
  const [hours, setHours] = useState(24);

  const vitals = useQuery({
    queryKey: ["perf-vitals", tenantSlug, hours],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("perf_vitals_summary", {
        _tenant_slug: tenantSlug,
        _hours: hours,
      });
      if (error) throw error;
      return (data ?? []) as VitalRow[];
    },
  });

  const server = useQuery({
    queryKey: ["perf-server", tenantSlug, hours],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("perf_server_summary", {
        _tenant_slug: tenantSlug,
        _hours: hours,
      });
      if (error) throw error;
      return (data ?? []) as ServerRow[];
    },
  });

  // Aggregated production errors (visible to super admins; returns empty otherwise).
  const errors = useQuery({
    queryKey: ["error-events", hours],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("error_events_summary", { _hours: hours, _limit: 30 });
      if (error) throw error;
      return (data ?? []) as ErrorRow[];
    },
  });

  // Health of external dependencies (video Worker).
  const health = useQuery({
    queryKey: ["service-health"],
    staleTime: 30_000,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data } = await supabase.from("service_health").select("*");
      return (data ?? []) as HealthRow[];
    },
  });

  const rows = vitals.data ?? [];
  const srv = server.data ?? [];


  // Overall per-metric numbers (weighted by sample count).
  const overview = ["LCP", "TTFB", "INP", "CLS"].map((metric) => {
    const m = rows.filter((r) => r.metric === metric);
    const total = m.reduce((a, r) => a + Number(r.samples), 0);
    const p75 = total > 0 ? m.reduce((a, r) => a + Number(r.p75) * Number(r.samples), 0) / total : 0;
    return { metric, p75, samples: total };
  });

  const slowPages = [...rows.filter((r) => r.metric === "LCP")]
    .sort((a, b) => Number(b.p75) - Number(a.p75))
    .slice(0, 10);

  const errorCalls = srv.filter((s) => Number(s.errors) > 0);
  const totalCalls = srv.reduce((a, s) => a + Number(s.calls), 0);
  const totalErrors = srv.reduce((a, s) => a + Number(s.errors), 0);

  const loading = vitals.isLoading || server.isLoading;

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="h-6 w-6" /> مراقبة الأداء
          </h1>
          <p className="text-sm text-muted-foreground">
            أزمنة استجابة الخادم وسرعة تحميل الصفحات كما يعيشها المستخدمون فعليًا.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {RANGES.map((r) => (
            <Button
              key={r.hours}
              size="sm"
              variant={hours === r.hours ? "default" : "outline"}
              onClick={() => setHours(r.hours)}
            >
              {r.label}
            </Button>
          ))}
          <Button
            size="icon"
            variant="ghost"
            onClick={() => { vitals.refetch(); server.refetch(); }}
            aria-label="تحديث"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Core Web Vitals overview */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {overview.map((o) => (
          <Card key={o.metric}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Gauge className="h-4 w-4 text-muted-foreground" /> {o.metric}
                </span>
                {o.samples > 0 && <RatingBadge metric={o.metric} value={o.p75} />}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tabular-nums">
                {o.samples > 0 ? fmtMetric(o.metric, o.p75) : "—"}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {o.samples > 0 ? `الشريحة 75% · ${o.samples} قياس` : "لا توجد قياسات بعد"}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Server response times */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-base">
            <span className="flex items-center gap-2"><ServerCog className="h-5 w-5" /> أبطأ عمليات الخادم</span>
            <span className="text-xs font-normal text-muted-foreground">
              {totalCalls} عملية · {totalErrors} خطأ
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {srv.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              {loading ? "جارٍ التحميل..." : "لا توجد بيانات بعد — ستظهر تلقائيًا مع استخدام المنصة."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-start">العملية</TableHead>
                    <TableHead className="text-start">النوع</TableHead>
                    <TableHead className="text-start">عدد</TableHead>
                    <TableHead className="text-start">متوسط</TableHead>
                    <TableHead className="text-start">p95</TableHead>
                    <TableHead className="text-start">الأقصى</TableHead>
                    <TableHead className="text-start">أخطاء</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {srv.slice(0, 20).map((s) => (
                    <TableRow key={s.name}>
                      <TableCell className="font-mono text-xs max-w-[16rem] truncate" title={s.name}>{s.name}</TableCell>
                      <TableCell><Badge variant="secondary" className="text-[10px]">{s.kind}</Badge></TableCell>
                      <TableCell className="tabular-nums">{s.calls}</TableCell>
                      <TableCell className="tabular-nums">{Math.round(Number(s.avg_ms))} م.ث</TableCell>
                      <TableCell className="tabular-nums font-medium">
                        <span className={Number(s.p95_ms) > 1000 ? "text-destructive" : Number(s.p95_ms) > 500 ? "text-amber-600" : ""}>
                          {Math.round(Number(s.p95_ms))} م.ث
                        </span>
                      </TableCell>
                      <TableCell className="tabular-nums">{Math.round(Number(s.max_ms))} م.ث</TableCell>
                      <TableCell className="tabular-nums">
                        {Number(s.errors) > 0 ? <span className="text-destructive">{s.errors}</span> : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Slowest pages by LCP */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">أبطأ الصفحات (زمن ظهور المحتوى الرئيسي)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {slowPages.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              {loading ? "جارٍ التحميل..." : "لا توجد قياسات صفحات بعد."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-start">الصفحة</TableHead>
                    <TableHead className="text-start">زيارات</TableHead>
                    <TableHead className="text-start">p50</TableHead>
                    <TableHead className="text-start">p75</TableHead>
                    <TableHead className="text-start">p95</TableHead>
                    <TableHead className="text-start">التقييم</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {slowPages.map((r) => (
                    <TableRow key={r.path}>
                      <TableCell className="font-mono text-xs max-w-[16rem] truncate" title={r.path}>{r.path}</TableCell>
                      <TableCell className="tabular-nums">{r.samples}</TableCell>
                      <TableCell className="tabular-nums">{fmtMetric("LCP", Number(r.p50))}</TableCell>
                      <TableCell className="tabular-nums font-medium">{fmtMetric("LCP", Number(r.p75))}</TableCell>
                      <TableCell className="tabular-nums">{fmtMetric("LCP", Number(r.p95))}</TableCell>
                      <TableCell><RatingBadge metric="LCP" value={Number(r.p75)} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {errorCalls.length > 0 && (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" /> عمليات فيها أخطاء
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {errorCalls.slice(0, 10).map((s) => (
              <div key={s.name} className="flex items-center justify-between text-sm border-b pb-2 last:border-0">
                <span className="font-mono text-xs truncate max-w-[70%]" title={s.name}>{s.name}</span>
                <span className="text-destructive tabular-nums">{s.errors} / {s.calls}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

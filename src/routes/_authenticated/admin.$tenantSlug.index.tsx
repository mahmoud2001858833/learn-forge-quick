import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BookOpen, Users, GraduationCap, DollarSign, Receipt, Award, Star, BarChart3,
  TrendingUp, HardDrive, UserCheck, Video, Sparkles, Plus, ArrowUpRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { OverviewTrends } from "@/components/admin/overview-trends";

export const Route = createFileRoute("/_authenticated/admin/$tenantSlug/")({
  component: Overview,
});

function fmtBytes(n: number): string {
  if (!n) return "0 B";
  const u = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(n) / Math.log(1024));
  return `${(n / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${u[i]}`;
}

function Overview() {
  const { tenantSlug } = useParams({ from: "/_authenticated/admin/$tenantSlug/" });

  const { data: tenant } = useQuery({
    queryKey: ["tenant-overview-meta", tenantSlug],
    queryFn: async () =>
      (await supabase
        .from("tenants")
        .select("id, name, currency, storage_quota_bytes, storage_used_bytes, primary_color, secondary_color")
        .eq("slug", tenantSlug)
        .single()).data,
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

  const { data: pendingInstructors = 0 } = useQuery({
    queryKey: ["pending-instructors-count", tenant?.id],
    enabled: !!tenant?.id,
    queryFn: async () => {
      const { count } = await supabase
        .from("tenant_members")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenant!.id)
        .eq("role", "pending_instructor");
      return count ?? 0;
    },
  });

  const currency = tenant?.currency ?? "ر.س";
  const quota = Number(tenant?.storage_quota_bytes ?? 0);
  const used = Number(tenant?.storage_used_bytes ?? 0);
  const storagePct = quota > 0 ? Math.min(100, (used / quota) * 100) : 0;

  return (
    <div className="space-y-8">
      {/* Hero header */}
      <div
        className="relative overflow-hidden rounded-3xl p-8 lg:p-10 text-white shadow-xl"
        style={{
          background: `linear-gradient(135deg, var(--tenant-primary), var(--tenant-secondary))`,
        }}
      >
        <div
          className="absolute inset-0 opacity-30 pointer-events-none"
          style={{
            background:
              "radial-gradient(circle at 15% 20%, rgba(255,255,255,0.4) 0%, transparent 45%), radial-gradient(circle at 85% 80%, rgba(255,255,255,0.25) 0%, transparent 45%)",
          }}
        />
        <div className="relative flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-medium bg-white/15 backdrop-blur-md border border-white/25 rounded-full px-3 py-1 mb-4">
              <Sparkles className="h-3 w-3" /> لوحة قيادة {tenant?.name ?? ""}
            </div>
            <h1 className="text-3xl lg:text-4xl font-black mb-1 drop-shadow">مرحباً بعودتك</h1>
            <p className="text-white/85 text-sm lg:text-base max-w-xl">
              نظرة سريعة على أداء منصتك اليوم. تابع نموّك وأدر كل شيء من هنا.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/admin/$tenantSlug/courses" params={{ tenantSlug }}>
              <Button variant="secondary" className="bg-white/95 hover:bg-white text-foreground shadow-md">
                <Plus className="h-4 w-4 ml-1" /> دورة جديدة
              </Button>
            </Link>
            <Link to="/admin/$tenantSlug/reports" params={{ tenantSlug }}>
              <Button variant="outline" className="bg-white/10 border-white/30 text-white hover:bg-white/20 hover:text-white">
                <BarChart3 className="h-4 w-4 ml-1" /> التقارير
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Primary KPI cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={DollarSign}
          label="إجمالي الإيرادات"
          value={`${Number(stats?.revenue ?? 0).toLocaleString()} ${currency}`}
          accent="from-emerald-500 to-teal-500"
          hint="آخر 30 يوماً"
        />
        <KpiCard
          icon={Users}
          label="الطلاب النشطون"
          value={stats?.students ?? 0}
          accent="from-blue-500 to-indigo-500"
          hint={`${stats?.active_enrollments ?? 0} تسجيلاً نشطاً`}
        />
        <KpiCard
          icon={GraduationCap}
          label="التسجيلات"
          value={stats?.enrollments ?? 0}
          accent="from-violet-500 to-purple-500"
          hint={`${stats?.certificates ?? 0} شهادة صادرة`}
        />
        <KpiCard
          icon={BookOpen}
          label="الدورات"
          value={`${stats?.published_courses ?? 0}/${stats?.courses ?? 0}`}
          accent="from-amber-500 to-orange-500"
          hint="منشورة من الإجمالي"
        />
      </div>

      {/* Two-column: storage + secondary stats */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 overflow-hidden border-2 border-dashed border-muted-foreground/10">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <HardDrive className="h-4 w-4 text-muted-foreground" /> حصة التخزين
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">مستخدم من إجمالي الحصة المخصصة</p>
            </div>
            <Link to="/admin/$tenantSlug/storage" params={{ tenantSlug }}>
              <Button variant="ghost" size="sm">
                إدارة <ArrowUpRight className="h-3 w-3 mr-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-baseline justify-between">
              <div className="text-3xl font-black tabular-nums">{fmtBytes(used)}</div>
              <div className="text-sm text-muted-foreground">من {fmtBytes(quota)}</div>
            </div>
            <Progress value={storagePct} className="h-2.5" />
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{storagePct.toFixed(1)}% مستخدم</span>
              {storagePct >= 85 ? (
                <Badge className="bg-amber-500/15 text-amber-700 border-amber-500/30">اقتربت من الحد</Badge>
              ) : (
                <Badge variant="secondary">ضمن الحد</Badge>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-dashed border-muted-foreground/10">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" /> إحصاءات إضافية
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <MiniStat icon={Receipt} label="طلبات دفع معلّقة" value={stats?.pending_payments ?? 0} />
            <MiniStat icon={Award} label="شهادات صادرة" value={stats?.certificates ?? 0} />
            <MiniStat
              icon={Star}
              label="متوسط التقييم"
              value={Number(stats?.avg_rating ?? 0).toFixed(2)}
              suffix="/5"
            />
            <MiniStat icon={UserCheck} label="طلبات معلمين معلّقة" value={pendingInstructors} highlight={pendingInstructors > 0} />
          </CardContent>
        </Card>
      </div>

      {/* 14-day trends */}
      {tenant?.id && <OverviewTrends tenantId={tenant.id} currency={currency} />}


      {/* Quick actions */}
      <div>
        <h2 className="text-lg font-bold mb-3">إجراءات سريعة</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <QuickAction to="/admin/$tenantSlug/courses" tenantSlug={tenantSlug} icon={BookOpen} title="إدارة الدورات" desc="أضف أو حرّر دوراتك" />
          <QuickAction to="/admin/$tenantSlug/live-sessions" tenantSlug={tenantSlug} icon={Video} title="جلسة حيّة" desc="جدول محاضرة قادمة" />
          <QuickAction to="/admin/$tenantSlug/instructor-approvals" tenantSlug={tenantSlug} icon={UserCheck} title="طلبات المعلمين" desc={pendingInstructors > 0 ? `${pendingInstructors} بانتظار الموافقة` : "لا توجد طلبات"} badge={pendingInstructors > 0 ? String(pendingInstructors) : undefined} />
          <QuickAction to="/admin/$tenantSlug/settings" tenantSlug={tenantSlug} icon={Sparkles} title="تخصيص المنصة" desc="الشعار والألوان والنطاق" />
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  accent,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
  accent: string;
  hint?: string;
}) {
  return (
    <Card className="relative overflow-hidden group transition-all hover:shadow-lg hover:-translate-y-0.5">
      <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${accent}`} />
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
        <div className={`h-9 w-9 rounded-xl bg-gradient-to-br ${accent} grid place-items-center text-white shadow-sm`}>
          <Icon className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl lg:text-3xl font-black tabular-nums">{value}</div>
        {hint && <div className="text-[11px] text-muted-foreground mt-1">{hint}</div>}
      </CardContent>
    </Card>
  );
}

function MiniStat({
  icon: Icon,
  label,
  value,
  suffix,
  highlight,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
  suffix?: string;
  highlight?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between p-2.5 rounded-lg ${highlight ? "bg-amber-500/10 border border-amber-500/30" : "bg-muted/30"}`}>
      <div className="flex items-center gap-2 text-sm">
        <Icon className={`h-4 w-4 ${highlight ? "text-amber-600" : "text-muted-foreground"}`} />
        <span>{label}</span>
      </div>
      <div className="font-bold tabular-nums text-sm">
        {value}
        {suffix && <span className="text-xs text-muted-foreground font-normal">{suffix}</span>}
      </div>
    </div>
  );
}

function QuickAction({
  to,
  tenantSlug,
  icon: Icon,
  title,
  desc,
  badge,
}: {
  to: string;
  tenantSlug: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
  badge?: string;
}) {
  return (
    <Link to={to} params={{ tenantSlug }} className="group">
      <Card className="h-full transition-all hover:shadow-md hover:-translate-y-0.5 hover:border-primary/40">
        <CardContent className="p-4 flex items-start gap-3">
          <div
            className="h-10 w-10 rounded-lg grid place-items-center text-white shadow-sm shrink-0"
            style={{ background: `linear-gradient(135deg, var(--tenant-primary), var(--tenant-secondary))` }}
          >
            <Icon className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <div className="font-semibold text-sm">{title}</div>
              {badge && <Badge variant="destructive" className="h-4 px-1.5 text-[10px]">{badge}</Badge>}
            </div>
            <div className="text-xs text-muted-foreground truncate mt-0.5">{desc}</div>
          </div>
          <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        </CardContent>
      </Card>
    </Link>
  );
}

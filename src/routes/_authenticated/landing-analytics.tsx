import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getLandingAnalytics } from "@/lib/landing.functions";
import { ArrowRight, Eye, MousePointerClick, UserPlus, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/_authenticated/landing-analytics")({
  component: LandingAnalytics,
});

function LandingAnalytics() {
  const [days, setDays] = useState(30);
  const { data, isLoading } = useQuery({
    queryKey: ["landing-analytics", days],
    queryFn: () => getLandingAnalytics({ data: { days } }),
  });

  const totals = data?.totals ?? { views: 0, cta_clicks: 0, signups: 0, ctr: 0, conversion: 0 };
  const byCta = (data?.by_cta ?? []) as Array<{ cta_id: string; clicks: number }>;
  const byDay = (data?.by_day ?? []) as Array<{ day: string; views: number; clicks: number; signups: number }>;
  const maxDay = Math.max(1, ...byDay.map((d) => Number(d.views) || 0));

  return (
    <div className="container mx-auto px-4 sm:px-6 py-8 sm:py-10 max-w-6xl" dir="rtl">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <div>
          <Link to="/super-admin" className="text-sm text-muted-foreground hover:underline inline-flex items-center gap-1">
            <ArrowRight className="h-3 w-3" /> الرجوع
          </Link>
          <h1 className="text-2xl sm:text-3xl font-black mt-2">تحليلات الصفحة الرئيسية</h1>
          <p className="text-sm text-muted-foreground">نقرات CTA والتحويلات على landing.</p>
        </div>
        <div className="flex gap-2">
          {[7, 30, 90].map((d) => (
            <Button key={d} variant={days === d ? "default" : "outline"} size="sm" onClick={() => setDays(d)}>
              آخر {d} يوم
            </Button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-20 text-muted-foreground">جارٍ التحميل...</div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 mb-8">
            <StatCard icon={Eye} label="المشاهدات" value={totals.views} color="text-blue-500" />
            <StatCard icon={MousePointerClick} label="نقرات CTA" value={totals.cta_clicks} color="text-purple-500" />
            <StatCard icon={UserPlus} label="تسجيلات" value={totals.signups} color="text-green-500" />
            <StatCard icon={TrendingUp} label="CTR" value={`${totals.ctr}%`} color="text-orange-500" />
            <StatCard icon={TrendingUp} label="معدل التحويل" value={`${totals.conversion}%`} color="text-rose-500" />
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>النقرات حسب الزر</CardTitle>
                <CardDescription>أكثر أزرار CTA نقراً</CardDescription>
              </CardHeader>
              <CardContent>
                {byCta.length === 0 ? (
                  <p className="text-sm text-muted-foreground">لا توجد بيانات بعد.</p>
                ) : (
                  <ul className="space-y-3">
                    {byCta.map((c) => {
                      const max = Math.max(...byCta.map((x) => Number(x.clicks)));
                      const pct = max ? (Number(c.clicks) / max) * 100 : 0;
                      return (
                        <li key={c.cta_id}>
                          <div className="flex items-center justify-between text-sm mb-1">
                            <span className="font-medium truncate">{c.cta_id}</span>
                            <span className="text-muted-foreground">{c.clicks}</span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>الاتجاه اليومي</CardTitle>
                <CardDescription>المشاهدات مقابل التفاعل</CardDescription>
              </CardHeader>
              <CardContent>
                {byDay.length === 0 ? (
                  <p className="text-sm text-muted-foreground">لا توجد بيانات بعد.</p>
                ) : (
                  <div className="flex items-end gap-1 h-40">
                    {byDay.map((d) => {
                      const h = (Number(d.views) / maxDay) * 100;
                      return (
                        <div key={d.day} className="flex-1 flex flex-col items-center gap-1 group">
                          <div className="relative w-full flex-1 flex items-end">
                            <div
                              className="w-full bg-primary/30 group-hover:bg-primary transition rounded-t"
                              style={{ height: `${h}%` }}
                              title={`${d.day}: ${d.views} مشاهدة، ${d.clicks} نقرة`}
                            />
                          </div>
                          <span className="text-[9px] text-muted-foreground rotate-45 origin-top-left whitespace-nowrap">{d.day.slice(5)}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: any; color: string }) {
  return (
    <Card>
      <CardContent className="p-4 sm:p-5">
        <Icon className={`h-5 w-5 mb-2 ${color}`} />
        <div className="text-2xl sm:text-3xl font-black">{value}</div>
        <div className="text-xs text-muted-foreground mt-1">{label}</div>
      </CardContent>
    </Card>
  );
}

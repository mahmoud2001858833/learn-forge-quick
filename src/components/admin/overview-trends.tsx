import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";

type Props = { tenantId: string; currency: string };

export function OverviewTrends({ tenantId, currency }: Props) {
  const { data: revenue = [] } = useQuery({
    queryKey: ["overview-revenue-14", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("tenant_revenue_by_day", {
        _tenant_id: tenantId,
        _days: 14,
      });
      if (error) throw error;
      return (data ?? []) as { day: string; revenue: number }[];
    },
  });

  const { data: enrollments = [] } = useQuery({
    queryKey: ["overview-enrollments-14", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("tenant_enrollments_by_day", {
        _tenant_id: tenantId,
        _days: 14,
      });
      if (error) throw error;
      return (data ?? []) as { day: string; count: number }[];
    },
  });

  const merged = revenue.map((r, i) => ({
    day: r.day?.slice(5) ?? "",
    revenue: Number(r.revenue ?? 0),
    enrollments: Number(enrollments[i]?.count ?? 0),
  }));

  const totalRev = merged.reduce((s, d) => s + d.revenue, 0);
  const totalEnr = merged.reduce((s, d) => s + d.enrollments, 0);

  return (
    <Card className="border-2 border-dashed border-muted-foreground/10">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" /> اتجاه آخر 14 يوماً
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            الإيرادات {totalRev.toLocaleString()} {currency} · {totalEnr} تسجيل
          </p>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={merged} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--tenant-primary)" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="var(--tenant-primary)" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="enr" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--tenant-secondary)" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="var(--tenant-secondary)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="l" tick={{ fontSize: 11 }} width={40} />
              <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 11 }} width={30} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
                formatter={(value: number, name) =>
                  name === "revenue"
                    ? [`${value.toLocaleString()} ${currency}`, "الإيرادات"]
                    : [value, "التسجيلات"]
                }
              />
              <Area yAxisId="l" type="monotone" dataKey="revenue" stroke="var(--tenant-primary)" fill="url(#rev)" strokeWidth={2} />
              <Area yAxisId="r" type="monotone" dataKey="enrollments" stroke="var(--tenant-secondary)" fill="url(#enr)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

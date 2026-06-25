import { createFileRoute, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Trophy, Flame, Star, Medal, Crown, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/t/$slug/leaderboard")({
  component: LeaderboardPage,
});

type Row = {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  total_xp: number;
  level: number;
  current_streak: number;
  rank: number;
};

type Summary = {
  total_xp: number;
  level: number;
  xp_into_level: number;
  xp_for_next: number;
  current_streak: number;
  longest_streak: number;
  rank: number;
};

function LeaderboardPage() {
  const { slug } = useParams({ from: "/t/$slug/leaderboard" });
  const { user } = useAuth();
  const [period, setPeriod] = useState<"week" | "month" | "all">("all");

  const { data: tenant } = useQuery({
    queryKey: ["public-tenant-id", slug],
    queryFn: async () => (await supabase.from("tenants").select("id, primary_color, secondary_color").eq("slug", slug).maybeSingle()).data,
  });

  const { data: rows } = useQuery({
    enabled: !!tenant?.id,
    queryKey: ["leaderboard", tenant?.id, period],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("tenant_leaderboard" as any, {
        _tenant_id: tenant!.id, _period: period, _limit: 50,
      });
      if (error) throw new Error(error.message);
      return (data ?? []) as Row[];
    },
  });

  const { data: me } = useQuery({
    enabled: !!tenant?.id && !!user?.id,
    queryKey: ["my-gamification", tenant?.id, user?.id],
    queryFn: async () => {
      const { data } = await supabase.rpc("user_gamification_summary" as any, {
        _tenant_id: tenant!.id, _user_id: user!.id,
      });
      return (data?.[0] ?? null) as Summary | null;
    },
  });

  const primary = tenant?.primary_color ?? "#6366f1";
  const secondary = tenant?.secondary_color ?? "#D4AF37";

  return (
    <div className="container mx-auto px-4 py-8 space-y-6" dir="rtl">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-2xl grid place-items-center text-white shadow-lg" style={{ background: `linear-gradient(135deg, ${primary}, ${secondary})` }}>
          <Trophy className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">لوحة المتصدّرين</h1>
          <p className="text-muted-foreground">تنافس مع زملائك واكسب نقاط الخبرة</p>
        </div>
      </div>

      {/* My stats */}
      {user && me && (
        <Card className="overflow-hidden border-2" style={{ borderColor: primary + "40" }}>
          <div className="h-2" style={{ background: `linear-gradient(90deg, ${primary}, ${secondary})` }} />
          <CardContent className="p-6 grid sm:grid-cols-4 gap-4">
            <StatBlock icon={<Star className="h-5 w-5" />} label="نقاط الخبرة" value={me.total_xp.toLocaleString("ar-EG")} color={primary} />
            <StatBlock icon={<Crown className="h-5 w-5" />} label="المستوى" value={`Lv. ${me.level}`} color={secondary} />
            <StatBlock icon={<Flame className="h-5 w-5" />} label="سلسلة الأيام" value={`${me.current_streak} 🔥`} color="#f97316" />
            <StatBlock icon={<Medal className="h-5 w-5" />} label="ترتيبك" value={me.rank > 0 ? `#${me.rank}` : "—"} color="#10b981" />
            <div className="sm:col-span-4">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                <span>التقدم إلى المستوى {me.level + 1}</span>
                <span>{me.xp_into_level} / {me.xp_for_next} XP</span>
              </div>
              <Progress value={(me.xp_into_level / Math.max(me.xp_for_next, 1)) * 100} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Period tabs */}
      <Tabs value={period} onValueChange={(v) => setPeriod(v as any)}>
        <TabsList>
          <TabsTrigger value="week">الأسبوع</TabsTrigger>
          <TabsTrigger value="month">الشهر</TabsTrigger>
          <TabsTrigger value="all">كل الأوقات</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Top 3 podium */}
      {rows && rows.length >= 3 && (
        <div className="grid grid-cols-3 gap-3">
          {[rows[1], rows[0], rows[2]].map((r, i) => {
            const place = i === 1 ? 1 : i === 0 ? 2 : 3;
            const heights = [120, 160, 100];
            const colors = ["#9ca3af", "#fbbf24", "#cd7f32"];
            return (
              <div key={r.user_id} className="flex flex-col items-center justify-end">
                <Avatar className="h-16 w-16 mb-2 ring-4" style={{ ["--tw-ring-color" as any]: colors[i] }}>
                  <AvatarImage src={r.avatar_url ?? undefined} />
                  <AvatarFallback>{r.full_name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="font-bold text-sm text-center line-clamp-1">{r.full_name}</div>
                <div className="text-xs text-muted-foreground">{r.total_xp.toLocaleString("ar-EG")} XP</div>
                <div
                  className="w-full mt-2 rounded-t-xl grid place-items-start justify-center pt-2 text-white font-bold text-xl"
                  style={{ background: `linear-gradient(180deg, ${colors[i]}, ${colors[i]}cc)`, height: heights[i] }}
                >
                  #{place}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Full ranking */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2"><TrendingUp className="h-5 w-5" /> الترتيب الكامل</CardTitle>
        </CardHeader>
        <CardContent className="divide-y">
          {!rows?.length && (
            <div className="text-center py-12 text-muted-foreground">
              <Trophy className="h-10 w-10 mx-auto mb-2 opacity-40" />
              لا توجد نتائج بعد. ابدأ الدراسة لكسب نقاط الخبرة!
            </div>
          )}
          {rows?.map((r) => {
            const isMe = user?.id === r.user_id;
            return (
              <div key={r.user_id} className={`flex items-center gap-3 py-3 ${isMe ? "bg-primary/5 -mx-6 px-6" : ""}`}>
                <div className={`w-10 text-center font-bold ${r.rank <= 3 ? "text-lg" : "text-sm text-muted-foreground"}`}>
                  {r.rank <= 3 ? ["🥇", "🥈", "🥉"][r.rank - 1] : `#${r.rank}`}
                </div>
                <Avatar className="h-10 w-10">
                  <AvatarImage src={r.avatar_url ?? undefined} />
                  <AvatarFallback>{r.full_name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate flex items-center gap-2">
                    {r.full_name}
                    {isMe && <Badge variant="secondary" className="text-xs">أنت</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-2">
                    <span>Lv. {r.level}</span>
                    {r.current_streak > 0 && <span className="flex items-center gap-0.5"><Flame className="h-3 w-3 text-orange-500" />{r.current_streak}</span>}
                  </div>
                </div>
                <div className="text-left">
                  <div className="font-bold" style={{ color: primary }}>{Number(r.total_xp).toLocaleString("ar-EG")}</div>
                  <div className="text-[10px] text-muted-foreground">XP</div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

function StatBlock({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-10 w-10 rounded-xl grid place-items-center text-white" style={{ background: color }}>{icon}</div>
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="font-bold text-lg">{value}</div>
      </div>
    </div>
  );
}

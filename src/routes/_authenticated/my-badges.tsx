import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, Award, Sparkles, Trophy, Star, GraduationCap } from "lucide-react";

export const Route = createFileRoute("/_authenticated/my-badges")({
  component: MyBadgesPage,
});

const ICON_MAP: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  award: Award, sparkles: Sparkles, trophy: Trophy, star: Star, "graduation-cap": GraduationCap,
};

function MyBadgesPage() {
  const { user } = useAuth();

  const { data: earned } = useQuery({
    queryKey: ["my-badges", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("user_badges")
        .select("*, badges(*)")
        .eq("user_id", user!.id).order("awarded_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: allBadges } = useQuery({
    queryKey: ["all-badges"],
    queryFn: async () => (await supabase.from("badges").select("*").is("tenant_id", null)).data ?? [],
  });

  const earnedIds = new Set((earned ?? []).map((e) => e.badge_id));

  return (
    <main dir="rtl" className="container mx-auto px-6 py-10 max-w-3xl">
      <Link to="/dashboard" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowRight className="h-4 w-4" /> لوحة التحكم
      </Link>
      <h1 className="text-2xl font-bold mb-2">شاراتي</h1>
      <p className="text-sm text-muted-foreground mb-6">
        مكتسبة: {earned?.length ?? 0} من {allBadges?.length ?? 0}
      </p>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {allBadges?.map((b) => {
          const isEarned = earnedIds.has(b.id);
          const Icon = ICON_MAP[b.icon] ?? Award;
          return (
            <Card key={b.id} className={isEarned ? "border-2" : "opacity-40 grayscale"} style={{ borderColor: isEarned ? b.color : undefined }}>
              <CardContent className="p-5 text-center space-y-2">
                <Icon className="h-12 w-12 mx-auto" style={{ color: b.color }} />
                <div className="font-bold">{b.name}</div>
                <div className="text-xs text-muted-foreground">{b.description}</div>
                {isEarned && (
                  <div className="text-xs font-medium" style={{ color: b.color }}>✓ مكتسبة</div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </main>
  );
}

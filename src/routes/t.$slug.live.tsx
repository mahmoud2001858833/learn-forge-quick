import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Video, ExternalLink, Calendar, PlayCircle, Radio } from "lucide-react";

export const Route = createFileRoute("/t/$slug/live")({
  component: TenantLivePage,
  head: () => ({
    meta: [{ title: "الجلسات الحيّة" }, { name: "description", content: "جدول الجلسات الحيّة القادمة وتسجيلات الجلسات السابقة." }],
  }),
});

function TenantLivePage() {
  const { slug } = useParams({ from: "/t/$slug/live" });

  const { data: tenant } = useQuery({
    queryKey: ["public-tenant", slug],
    queryFn: async () => (await supabase.from("tenants").select("id, name, primary_color, secondary_color").eq("slug", slug).maybeSingle()).data,
  });

  const { data: sessions } = useQuery({
    enabled: !!tenant?.id,
    queryKey: ["live-sessions-public", tenant?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("live_sessions")
        .select("*")
        .eq("tenant_id", tenant!.id)
        .order("scheduled_at", { ascending: false });
      return data ?? [];
    },
  });

  if (!tenant) return <div className="p-10 text-center text-muted-foreground">جارٍ التحميل...</div>;

  const primary = tenant.primary_color ?? "#6366f1";
  const secondary = tenant.secondary_color ?? "#D4AF37";

  const now = Date.now();
  const upcoming = (sessions ?? []).filter((s: any) => new Date(s.scheduled_at).getTime() + s.duration_minutes * 60_000 >= now)
    .sort((a: any, b: any) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
  const past = (sessions ?? []).filter((s: any) => new Date(s.scheduled_at).getTime() + s.duration_minutes * 60_000 < now);

  return (
    <div className="container mx-auto max-w-4xl px-4 py-10">
      <div className="flex items-center gap-3 mb-8">
        <div className="h-12 w-12 rounded-2xl grid place-items-center text-white shadow-md" style={{ background: `linear-gradient(135deg, ${primary}, ${secondary})` }}>
          <Video className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">الجلسات الحيّة</h1>
          <p className="text-sm text-muted-foreground">انضم للجلسات القادمة وراجع تسجيلات السابقة.</p>
        </div>
      </div>

      <section className="mb-10">
        <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
          <Radio className="h-5 w-5 text-emerald-500" /> القادمة ({upcoming.length})
        </h2>
        {upcoming.length === 0 && (
          <Card><CardContent className="py-8 text-center text-muted-foreground">لا توجد جلسات قادمة حالياً.</CardContent></Card>
        )}
        <div className="space-y-3">
          {upcoming.map((s: any) => {
            const when = new Date(s.scheduled_at);
            const isLive = when.getTime() <= now;
            return (
              <Card key={s.id} className={isLive ? "border-red-500/50 shadow-md" : ""}>
                <CardContent className="p-4 flex items-start gap-3 flex-wrap">
                  <div className="flex-1 min-w-[220px]">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="font-bold">{s.title}</h3>
                      {isLive && <Badge className="bg-red-500 text-white animate-pulse">مباشر الآن</Badge>}
                      <Badge variant="outline" className="text-xs">{s.provider}</Badge>
                    </div>
                    {s.description && <p className="text-sm text-muted-foreground line-clamp-2">{s.description}</p>}
                    <div className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      {when.toLocaleString("ar-EG", { dateStyle: "full", timeStyle: "short" })} · {s.duration_minutes} دقيقة
                    </div>
                  </div>
                  <a href={s.meeting_url} target="_blank" rel="noreferrer">
                    <Button className="text-white border-0" style={{ background: `linear-gradient(135deg, ${primary}, ${secondary})` }}>
                      <ExternalLink className="h-4 w-4 ms-1" />
                      {isLive ? "انضم الآن" : "رابط الانضمام"}
                    </Button>
                  </a>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
          <PlayCircle className="h-5 w-5 text-muted-foreground" /> الجلسات السابقة ({past.length})
        </h2>
        {past.length === 0 && (
          <Card><CardContent className="py-8 text-center text-muted-foreground">لا توجد جلسات سابقة بعد.</CardContent></Card>
        )}
        <div className="space-y-3">
          {past.map((s: any) => {
            const when = new Date(s.scheduled_at);
            return (
              <Card key={s.id}>
                <CardContent className="p-4 flex items-start gap-3 flex-wrap opacity-90">
                  <div className="flex-1 min-w-[220px]">
                    <h3 className="font-bold">{s.title}</h3>
                    {s.description && <p className="text-sm text-muted-foreground line-clamp-2">{s.description}</p>}
                    <div className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      {when.toLocaleDateString("ar-EG", { dateStyle: "medium" })}
                    </div>
                  </div>
                  {s.recording_url ? (
                    <a href={s.recording_url} target="_blank" rel="noreferrer">
                      <Button variant="outline"><PlayCircle className="h-4 w-4 ms-1" /> شاهد التسجيل</Button>
                    </a>
                  ) : (
                    <Badge variant="outline" className="text-xs">لا يوجد تسجيل</Badge>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <div className="mt-10 text-center">
        <Link to="/t/$slug" params={{ slug }} className="text-sm text-muted-foreground hover:text-foreground">
          ← العودة للرئيسية
        </Link>
      </div>
    </div>
  );
}

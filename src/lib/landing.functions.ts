import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function publicClient() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

export type LandingData = {
  config: any | null;
  stats: { tenants: number; courses: number; students: number };
  tenants: Array<{ id: string; slug: string; name: string; logo_url: string | null; welcome_message: string | null; primary_color: string | null; secondary_color: string | null }>;
};

export const getLandingData = createServerFn({ method: "GET" }).handler(async (): Promise<LandingData> => {
  const sb = publicClient();
  const [cfgRes, tRes, cRes, eRes, tnRes] = await Promise.all([
    sb.from("landing_config").select("*").eq("is_active", true).order("updated_at", { ascending: false }).limit(1).maybeSingle(),
    sb.from("tenants").select("id", { count: "exact", head: true }).eq("status", "active"),
    sb.from("courses").select("id", { count: "exact", head: true }).eq("status", "published"),
    sb.from("enrollments").select("id", { count: "exact", head: true }),
    sb.from("tenants").select("id, slug, name, logo_url, welcome_message, primary_color, secondary_color")
      .eq("status", "active").order("created_at", { ascending: false }).limit(8),
  ]);
  return {
    config: cfgRes.data ?? null,
    stats: { tenants: tRes.count ?? 0, courses: cRes.count ?? 0, students: eRes.count ?? 0 },
    tenants: (tnRes.data as any) ?? [],
  };
});

export const getLandingAnalytics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { days?: number }) => d)
  .handler(async ({ data, context }) => {
    const { data: summary, error } = await context.supabase.rpc("landing_events_summary" as any, { _days: data.days ?? 30 });
    if (error) throw new Error(error.message);
    return summary as any;
  });

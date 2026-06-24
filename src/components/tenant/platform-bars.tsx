import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Wrench } from "lucide-react";

type Settings = {
  maintenance_mode: boolean;
  maintenance_message: string | null;
  marquee_enabled: boolean;
  marquee_text: string | null;
  marquee_color: string | null;
};

export function useTenantSettings(tenantId: string | undefined) {
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => {
    if (!tenantId) return;
    let alive = true;
    supabase
      .from("platform_settings")
      .select("maintenance_mode, maintenance_message, marquee_enabled, marquee_text, marquee_color")
      .eq("tenant_id", tenantId)
      .maybeSingle()
      .then(({ data }) => {
        if (alive && data) setSettings(data as Settings);
      });
    const ch = supabase
      .channel(`platform_settings:${tenantId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "platform_settings", filter: `tenant_id=eq.${tenantId}` },
        (payload) => {
          const row = payload.new as Settings | null;
          if (row) setSettings(row);
        },
      )
      .subscribe();
    return () => {
      alive = false;
      supabase.removeChannel(ch);
    };
  }, [tenantId]);

  return settings;
}

export function MarqueeBar({ settings }: { settings: Settings | null }) {
  if (!settings?.marquee_enabled || !settings.marquee_text) return null;
  return (
    <div
      className="overflow-hidden whitespace-nowrap py-2 text-sm font-medium"
      style={{ background: settings.marquee_color ?? "#D4AF37", color: "#000" }}
    >
      <div className="inline-block animate-[marquee_30s_linear_infinite] px-4">
        {settings.marquee_text} &nbsp;·&nbsp; {settings.marquee_text} &nbsp;·&nbsp; {settings.marquee_text}
      </div>
      <style>{`@keyframes marquee { from { transform: translateX(100%); } to { transform: translateX(-100%); } }`}</style>
    </div>
  );
}

/**
 * Renders a maintenance overlay unless the current user is super_admin or tenant owner.
 * If overlay is rendered, page content should not show.
 */
export function MaintenanceGate({
  settings,
  ownerId,
  children,
}: {
  settings: Settings | null;
  ownerId: string | undefined;
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const [bypass, setBypass] = useState(false);

  useEffect(() => {
    if (!user) {
      setBypass(false);
      return;
    }
    if (ownerId && user.id === ownerId) {
      setBypass(true);
      return;
    }
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "super_admin")
      .maybeSingle()
      .then(({ data }) => setBypass(!!data));
  }, [user, ownerId]);

  if (!settings?.maintenance_mode) return <>{children}</>;
  if (bypass) {
    return (
      <>
        <div className="bg-yellow-500/10 border-y border-yellow-500/30 px-4 py-2 text-center text-sm">
          ⚠️ المنصة في وضع الصيانة — هذا العرض مرئي لك فقط لأنك مالك/سوبر-أدمن
        </div>
        {children}
      </>
    );
  }
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-6" dir="rtl">
      <div className="max-w-md text-center space-y-4">
        <Wrench className="h-12 w-12 mx-auto text-muted-foreground" />
        <h1 className="text-2xl font-bold">المنصة في وضع الصيانة</h1>
        <p className="text-muted-foreground">
          {settings.maintenance_message ?? "نعمل على تحديثات قصيرة، سنعود قريباً."}
        </p>
      </div>
    </div>
  );
}

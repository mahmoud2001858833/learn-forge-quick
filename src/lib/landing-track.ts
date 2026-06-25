import { supabase } from "@/integrations/supabase/client";

const SID_KEY = "lf_sid";
function sessionId() {
  if (typeof window === "undefined") return null;
  let s = localStorage.getItem(SID_KEY);
  if (!s) {
    s = crypto.randomUUID();
    localStorage.setItem(SID_KEY, s);
  }
  return s;
}

const sent = new Set<string>();

export async function trackLanding(eventType: string, ctaId?: string, metadata: Record<string, any> = {}) {
  if (typeof window === "undefined") return;
  // De-dupe views per session per path
  if (eventType === "view") {
    const key = `view:${location.pathname}:${sessionId()}`;
    if (sent.has(key)) return;
    sent.add(key);
  }
  try {
    await supabase.from("landing_events" as any).insert({
      event_type: eventType,
      cta_id: ctaId ?? null,
      session_id: sessionId(),
      path: location.pathname,
      referrer: document.referrer || null,
      user_agent: navigator.userAgent.slice(0, 240),
      metadata,
    } as any);
  } catch {
    /* ignore tracking failures */
  }
}

import { createFileRoute } from "@tanstack/react-router";

/**
 * Public error-ingest endpoint used by the browser.
 *
 * Writes go through the `record_error_event` SECURITY DEFINER function, which
 * aggregates by fingerprint — so a flooding client only bumps a counter.
 * Always answers 204: telemetry must never surface as an app error.
 */
export const Route = createFileRoute("/api/public/hooks/errors")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json().catch(() => null)) as {
            source?: string;
            message?: string;
            stack?: string;
            path?: string;
            tenant_slug?: string | null;
            user_agent?: string;
          } | null;

          if (!body?.message || typeof body.message !== "string") {
            return new Response(null, { status: 204 });
          }

          const url = process.env.SUPABASE_URL;
          const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
          if (!url || !key) {
            console.error("[errors-hook] SUPABASE_SERVICE_ROLE_KEY missing — error not recorded");
            return new Response(null, { status: 204 });
          }

          await fetch(`${url}/rest/v1/rpc/record_error_event`, {
            method: "POST",
            headers: {
              apikey: key,
              Authorization: `Bearer ${key}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              _source: body.source === "server" ? "server" : "client",
              _message: body.message.slice(0, 500),
              _stack: body.stack ? body.stack.slice(0, 4000) : null,
              _path: body.path ? body.path.slice(0, 300) : null,
              _tenant_slug: body.tenant_slug ?? null,
              _user_agent: body.user_agent ? body.user_agent.slice(0, 300) : null,
              _environment: process.env.NODE_ENV === "production" ? "production" : "development",
            }),
          }).catch(() => {});
        } catch {
          /* swallow */
        }
        return new Response(null, { status: 204 });
      },
    },
  },
});

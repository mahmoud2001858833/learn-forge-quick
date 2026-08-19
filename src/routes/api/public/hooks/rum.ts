import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/rum")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // RUM is fire-and-forget: never fail the client. Always return 204.
        try {
          const body = (await request.json().catch(() => null)) as
            | {
                metric?: string;
                value?: number;
                rating?: string;
                url?: string;
                path?: string;
                user_agent?: string;
                tenant_slug?: string | null;
              }
            | null;

          if (!body || !body.metric || typeof body.value !== "number") {
            return new Response(null, { status: 204 });
          }

          const url = process.env.SUPABASE_URL;
          const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
          if (!url || !key) {
            console.error("[rum] SUPABASE_SERVICE_ROLE_KEY missing — vitals not recorded");
            return new Response(null, { status: 204 });
          }

          // Direct PostgREST call — avoids importing supabase-js at module scope.
          await fetch(`${url}/rest/v1/web_vitals`, {
            method: "POST",
            headers: {
              apikey: key,
              Authorization: `Bearer ${key}`,
              "Content-Type": "application/json",
              Prefer: "return=minimal",
            },
            body: JSON.stringify({
              metric: body.metric,
              value: body.value,
              rating: body.rating ?? null,
              url: body.url ?? null,
              path: body.path ?? null,
              user_agent: body.user_agent ?? null,
              tenant_slug: body.tenant_slug ?? null,
            }),
          }).catch(() => {});
        } catch {
          /* swallow — never 500 for RUM */
        }
        return new Response(null, { status: 204 });
      },
    },
  },
});

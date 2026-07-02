import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

export const Route = createFileRoute("/api/public/hooks/rum")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as {
            metric?: string;
            value?: number;
            rating?: string;
            url?: string;
            path?: string;
            user_agent?: string;
            tenant_slug?: string | null;
          };

          if (!body?.metric || typeof body.value !== "number") {
            return new Response("bad request", { status: 400 });
          }

          const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
            auth: { persistSession: false, autoRefreshToken: false },
          });

          await supabase.from("web_vitals").insert({
            metric: body.metric,
            value: body.value,
            rating: body.rating ?? null,
            url: body.url ?? null,
            path: body.path ?? null,
            user_agent: body.user_agent ?? null,
            tenant_slug: body.tenant_slug ?? null,
          });

          return new Response("ok", { status: 204 });
        } catch {
          return new Response("error", { status: 500 });
        }
      },
    },
  },
});

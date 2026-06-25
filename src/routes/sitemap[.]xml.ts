import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const BASE_URL = "https://learn-forge-quick.lovable.app";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const supabase = createClient<Database>(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_PUBLISHABLE_KEY!,
          { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
        );

        const [{ data: tenants }, { data: courses }] = await Promise.all([
          supabase
            .from("tenants")
            .select("slug, updated_at, status")
            .eq("status", "active"),
          supabase
            .from("courses")
            .select("slug, updated_at, tenants!inner(slug, status)")
            .eq("status", "published"),
        ]);

        const urls: { loc: string; lastmod?: string; priority?: string }[] = [
          { loc: `${BASE_URL}/`, priority: "1.0" },
          { loc: `${BASE_URL}/auth`, priority: "0.3" },
        ];

        for (const t of tenants ?? []) {
          const base = `${BASE_URL}/t/${t.slug}`;
          urls.push({ loc: base, lastmod: t.updated_at ?? undefined, priority: "0.9" });
          urls.push({ loc: `${base}/courses`, lastmod: t.updated_at ?? undefined, priority: "0.8" });
          urls.push({ loc: `${base}/about`, priority: "0.5" });
          urls.push({ loc: `${base}/contact`, priority: "0.5" });
          urls.push({ loc: `${base}/privacy`, priority: "0.3" });
          urls.push({ loc: `${base}/terms`, priority: "0.3" });
        }

        for (const c of courses ?? []) {
          const tslug = (c as unknown as { tenants: { slug: string; status: string } }).tenants;
          if (!tslug || tslug.status !== "active") continue;
          urls.push({
            loc: `${BASE_URL}/t/${tslug.slug}/courses/${c.slug}`,
            lastmod: c.updated_at ?? undefined,
            priority: "0.7",
          });
        }

        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) =>
      `  <url>\n    <loc>${u.loc}</loc>${u.lastmod ? `\n    <lastmod>${u.lastmod}</lastmod>` : ""}${u.priority ? `\n    <priority>${u.priority}</priority>` : ""}\n  </url>`,
  )
  .join("\n")}
</urlset>`;

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});

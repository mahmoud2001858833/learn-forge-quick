import { createFileRoute } from "@tanstack/react-router";

const BASE_URL = "https://learn-forge-quick.lovable.app";

export const Route = createFileRoute("/robots[.]txt")({
  server: {
    handlers: {
      GET: async () => {
        const body = `User-agent: *
Allow: /
Disallow: /admin/
Disallow: /_authenticated/
Disallow: /dashboard
Disallow: /super-admin
Disallow: /my-payments
Disallow: /my-referrals
Disallow: /my-certificates
Disallow: /my-badges
Disallow: /notifications
Disallow: /learn/
Disallow: /api/

Sitemap: ${BASE_URL}/sitemap.xml
`;
        return new Response(body, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "public, max-age=86400",
          },
        });
      },
    },
  },
});

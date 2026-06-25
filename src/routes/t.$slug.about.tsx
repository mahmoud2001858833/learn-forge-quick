import { createFileRoute, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Info } from "lucide-react";

export const Route = createFileRoute("/t/$slug/about")({
  head: ({ params }) => ({
    meta: [
      { title: `من نحن — ${params.slug}` },
      { name: "description", content: `تعرّف على منصة ${params.slug} ورسالتنا.` },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  const { slug } = useParams({ from: "/t/$slug/about" });
  const { data: tenant } = useQuery({
    queryKey: ["public-tenant", slug],
    queryFn: async () => (await supabase.from("tenants").select("*").eq("slug", slug).single()).data,
  });
  if (!tenant) return null;
  const primary = tenant.primary_color ?? "#6366f1";

  return (
    <div className="container mx-auto px-6 py-12 max-w-4xl" dir="rtl">
      <div className="text-sm font-semibold mb-2 flex items-center gap-2" style={{ color: primary }}>
        <Info className="h-4 w-4" /> تعرّف علينا
      </div>
      <h1 className="text-4xl md:text-5xl font-bold mb-6">من نحن</h1>
      <div className="prose prose-lg max-w-none">
        {tenant.about_text ? (
          <p className="text-lg leading-relaxed text-muted-foreground whitespace-pre-line">{tenant.about_text}</p>
        ) : tenant.description ? (
          <p className="text-lg leading-relaxed text-muted-foreground whitespace-pre-line">{tenant.description}</p>
        ) : (
          <p className="text-muted-foreground italic">لم يتم إضافة محتوى تعريفي بعد.</p>
        )}
      </div>
    </div>
  );
}

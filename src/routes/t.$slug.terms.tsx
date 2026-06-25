import { createFileRoute, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FileText } from "lucide-react";

export const Route = createFileRoute("/t/$slug/terms")({
  head: ({ params }) => ({
    meta: [
      { title: `الشروط — ${params.slug}` },
      { name: "description", content: `شروط الاستخدام لمنصة ${params.slug}.` },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  const { slug } = useParams({ from: "/t/$slug/terms" });
  const { data: tenant } = useQuery({
    queryKey: ["public-tenant", slug],
    queryFn: async () => (await supabase.from("tenants").select("*").eq("slug", slug).single()).data,
  });
  if (!tenant) return null;
  const primary = tenant.primary_color ?? "#6366f1";

  return (
    <div className="container mx-auto px-6 py-12 max-w-4xl" dir="rtl">
      <div className="text-sm font-semibold mb-2 flex items-center gap-2" style={{ color: primary }}>
        <FileText className="h-4 w-4" /> الشروط
      </div>
      <h1 className="text-4xl md:text-5xl font-bold mb-6">شروط الاستخدام</h1>
      <div className="prose prose-lg max-w-none">
        {tenant.terms_text ? (
          <p className="text-lg leading-relaxed text-muted-foreground whitespace-pre-line">{tenant.terms_text}</p>
        ) : (
          <p className="text-muted-foreground italic">لم يتم إضافة شروط استخدام بعد. يمكن لإدارة المنصة إضافتها من لوحة التحكم.</p>
        )}
      </div>
    </div>
  );
}

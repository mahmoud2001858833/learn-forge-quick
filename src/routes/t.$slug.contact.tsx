import { createFileRoute, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Mail, Phone, MapPin } from "lucide-react";

export const Route = createFileRoute("/t/$slug/contact")({
  head: ({ params }) => ({
    meta: [
      { title: `تواصل معنا — ${params.slug}` },
      { name: "description", content: `تواصل مع منصة ${params.slug}.` },
    ],
  }),
  component: ContactPage,
});

function ContactPage() {
  const { slug } = useParams({ from: "/t/$slug/contact" });
  const { data: tenant } = useQuery({
    queryKey: ["public-tenant", slug],
    queryFn: async () => (await supabase.from("tenants").select("*").eq("slug", slug).single()).data,
  });
  if (!tenant) return null;
  const primary = tenant.primary_color ?? "#6366f1";
  const secondary = tenant.secondary_color ?? "#D4AF37";

  return (
    <div className="container mx-auto px-6 py-12 max-w-4xl" dir="rtl">
      <div className="text-sm font-semibold mb-2 flex items-center gap-2" style={{ color: primary }}>
        <Mail className="h-4 w-4" /> تواصل
      </div>
      <h1 className="text-4xl md:text-5xl font-bold mb-2">تواصل معنا</h1>
      <p className="text-muted-foreground mb-10 text-lg">يسعدنا تواصلك معنا في أي وقت.</p>

      <div className="grid md:grid-cols-2 gap-4">
        {tenant.contact_email && (
          <a
            href={`mailto:${tenant.contact_email}`}
            className="group p-6 rounded-2xl border bg-card hover:border-[var(--c)] transition-all hover:shadow-lg"
            style={{ "--c": primary } as React.CSSProperties}
          >
            <div
              className="w-12 h-12 rounded-xl grid place-items-center text-white mb-4"
              style={{ background: `linear-gradient(135deg, ${primary}, ${secondary})` }}
            >
              <Mail className="h-6 w-6" />
            </div>
            <div className="text-sm text-muted-foreground mb-1">البريد الإلكتروني</div>
            <div className="font-semibold text-lg break-all">{tenant.contact_email}</div>
          </a>
        )}
        {tenant.contact_phone && (
          <a
            href={`tel:${tenant.contact_phone}`}
            className="group p-6 rounded-2xl border bg-card hover:border-[var(--c)] transition-all hover:shadow-lg"
            style={{ "--c": primary } as React.CSSProperties}
          >
            <div
              className="w-12 h-12 rounded-xl grid place-items-center text-white mb-4"
              style={{ background: `linear-gradient(135deg, ${primary}, ${secondary})` }}
            >
              <Phone className="h-6 w-6" />
            </div>
            <div className="text-sm text-muted-foreground mb-1">الهاتف</div>
            <div className="font-semibold text-lg">{tenant.contact_phone}</div>
          </a>
        )}
        {!tenant.contact_email && !tenant.contact_phone && (
          <div className="md:col-span-2 p-10 text-center text-muted-foreground border rounded-2xl">
            <MapPin className="h-12 w-12 mx-auto mb-3 opacity-40" />
            لم تتم إضافة معلومات تواصل بعد.
          </div>
        )}
      </div>
    </div>
  );
}

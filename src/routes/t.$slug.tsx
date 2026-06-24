import { createFileRoute, Link, Outlet, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { GraduationCap } from "lucide-react";

export const Route = createFileRoute("/t/$slug")({
  component: TenantLayout,
});

function TenantLayout() {
  const { slug } = useParams({ from: "/t/$slug" });
  const { data: tenant } = useQuery({
    queryKey: ["public-tenant", slug],
    queryFn: async () => (await supabase.from("tenants").select("*").eq("slug", slug).eq("status", "active").maybeSingle()).data,
  });

  if (!tenant) return <div className="min-h-screen flex items-center justify-center">المنصة غير موجودة</div>;

  return (
    <div className="min-h-screen bg-background" style={{ "--tenant-color": tenant.primary_color } as React.CSSProperties}>
      <header className="border-b">
        <div className="container mx-auto flex items-center justify-between px-6 py-4">
          <Link to="/t/$slug" params={{ slug }} className="flex items-center gap-2 font-bold">
            {tenant.logo_url ? <img src={tenant.logo_url} alt={tenant.name} className="h-8 w-8 rounded" /> : <GraduationCap className="h-6 w-6" style={{ color: tenant.primary_color }} />}
            <span>{tenant.name}</span>
          </Link>
          <Link to="/auth" className="text-sm hover:underline">تسجيل الدخول</Link>
        </div>
      </header>
      <Outlet />
    </div>
  );
}

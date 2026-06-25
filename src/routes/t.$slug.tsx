import { createFileRoute, Link, Outlet, useParams, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { GraduationCap, BookOpen, Info, Shield, FileText, Mail, Sparkles } from "lucide-react";
import { useTenantSettings, MarqueeBar, MaintenanceGate } from "@/components/tenant/platform-bars";
import { Button } from "@/components/ui/button";
import { FloatingChat } from "@/components/tenant/floating-chat";

export const Route = createFileRoute("/t/$slug")({
  component: TenantLayout,
  validateSearch: (s: Record<string, unknown>) => ({ ref: typeof s.ref === "string" ? s.ref : undefined }),
});

function TenantLayout() {
  const { slug } = useParams({ from: "/t/$slug" });
  const search = Route.useSearch();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isAuthRoute = pathname.endsWith("/auth");

  useEffect(() => {
    if (search.ref && typeof window !== "undefined") {
      localStorage.setItem("ref_code", search.ref.toUpperCase());
    }
  }, [search.ref]);

  const { data: tenant } = useQuery({
    queryKey: ["public-tenant", slug],
    queryFn: async () => (await supabase.from("tenants").select("*").eq("slug", slug).maybeSingle()).data,
  });

  const settings = useTenantSettings(tenant?.id);

  if (!tenant) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">جارٍ التحميل أو المنصة غير موجودة...</div>;
  if (tenant.status === "suspended") {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" dir="rtl">
        <div className="max-w-md text-center space-y-2">
          <h1 className="text-2xl font-bold">هذه المنصة موقوفة</h1>
          <p className="text-muted-foreground">{tenant.suspension_reason ?? "للمزيد من المعلومات تواصل مع الإدارة."}</p>
        </div>
      </div>
    );
  }

  const primary = tenant.primary_color ?? "#6366f1";
  const secondary = tenant.secondary_color ?? "#D4AF37";

  if (isAuthRoute) {
    return (
      <MaintenanceGate settings={settings} ownerId={tenant.owner_id}>
        <div
          style={{ "--tenant-primary": primary, "--tenant-secondary": secondary } as React.CSSProperties}
          dir="rtl"
        >
          <Outlet />
        </div>
      </MaintenanceGate>
    );
  }

  return (
    <MaintenanceGate settings={settings} ownerId={tenant.owner_id}>
      <div
        className="min-h-screen bg-background flex flex-col"
        style={{
          "--tenant-primary": primary,
          "--tenant-secondary": secondary,
        } as React.CSSProperties}
        dir="rtl"
      >
        <MarqueeBar settings={settings} />

        {/* Header with logo in corner + nav tabs */}
        <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-md">
          <div className="container mx-auto flex items-center justify-between gap-4 px-4 sm:px-6 py-3">
            {/* Logo corner */}
            <Link to="/t/$slug" params={{ slug }} className="flex items-center gap-2 shrink-0 group">
              {tenant.logo_url ? (
                <img
                  src={tenant.logo_url}
                  alt={tenant.name}
                  className="h-10 w-10 rounded-xl object-cover ring-2 ring-offset-2 ring-offset-background transition-all group-hover:scale-105"
                  style={{ "--tw-ring-color": primary } as React.CSSProperties}
                />
              ) : (
                <div
                  className="h-10 w-10 rounded-xl grid place-items-center text-white shadow-md transition-transform group-hover:scale-105"
                  style={{ background: `linear-gradient(135deg, ${primary}, ${secondary})` }}
                >
                  <GraduationCap className="h-5 w-5" />
                </div>
              )}
              <div className="hidden sm:block min-w-0">
                <div className="font-bold text-sm leading-tight truncate">{tenant.name}</div>
                <div className="text-[10px] text-muted-foreground">منصة تعليمية</div>
              </div>
            </Link>

            {/* Nav tabs */}
            <nav className="hidden md:flex items-center gap-1">
              <NavTab to="/t/$slug" params={{ slug }} icon={Info} label="الرئيسية" exact />
              <NavTab to="/t/$slug/courses" params={{ slug }} icon={BookOpen} label="الدورات" />
              <NavTab to="/t/$slug/about" params={{ slug }} icon={Info} label="من نحن" />
              <NavTab to="/t/$slug/privacy" params={{ slug }} icon={Shield} label="الخصوصية" />
              <NavTab to="/t/$slug/terms" params={{ slug }} icon={FileText} label="الشروط" />
              <NavTab to="/t/$slug/contact" params={{ slug }} icon={Mail} label="تواصل" />
            </nav>

            {/* Auth actions */}
            <div className="flex items-center gap-2 shrink-0">
              <Link to="/t/$slug/auth" params={{ slug }} search={{ mode: "signin" }} className="hidden sm:block">
                <Button variant="ghost" size="sm">تسجيل الدخول</Button>
              </Link>
              <Link to="/t/$slug/auth" params={{ slug }} search={{ mode: "signup" }}>
                <Button
                  size="sm"
                  className="text-white border-0"
                  style={{ background: `linear-gradient(135deg, ${primary}, ${secondary})` }}
                >
                  إنشاء حساب
                </Button>
              </Link>
            </div>
          </div>

          {/* Mobile nav strip */}
          <div className="md:hidden border-t overflow-x-auto">
            <div className="flex items-center gap-1 px-3 py-2 min-w-max">
              <NavTab to="/t/$slug" params={{ slug }} icon={Info} label="الرئيسية" exact />
              <NavTab to="/t/$slug/courses" params={{ slug }} icon={BookOpen} label="الدورات" />
              <NavTab to="/t/$slug/about" params={{ slug }} icon={Info} label="من نحن" />
              <NavTab to="/t/$slug/privacy" params={{ slug }} icon={Shield} label="الخصوصية" />
              <NavTab to="/t/$slug/terms" params={{ slug }} icon={FileText} label="الشروط" />
              <NavTab to="/t/$slug/contact" params={{ slug }} icon={Mail} label="تواصل" />
            </div>
          </div>
        </header>

        <main className="flex-1">
          <Outlet />
        </main>

        {/* Footer */}
        <footer className="border-t mt-12 bg-muted/30">
          <div className="container mx-auto px-6 py-8 grid sm:grid-cols-3 gap-6 text-sm">
            <div>
              <div className="font-bold text-base mb-2">{tenant.name}</div>
              {tenant.description && <p className="text-muted-foreground line-clamp-3">{tenant.description}</p>}
            </div>
            <div>
              <div className="font-semibold mb-2">روابط</div>
              <ul className="space-y-1 text-muted-foreground">
                <li><Link to="/t/$slug/courses" params={{ slug }} className="hover:text-foreground">الدورات</Link></li>
                <li><Link to="/t/$slug/about" params={{ slug }} className="hover:text-foreground">من نحن</Link></li>
                <li><Link to="/t/$slug/privacy" params={{ slug }} className="hover:text-foreground">سياسة الخصوصية</Link></li>
                <li><Link to="/t/$slug/terms" params={{ slug }} className="hover:text-foreground">الشروط</Link></li>
              </ul>
            </div>
            <div>
              <div className="font-semibold mb-2">تواصل</div>
              <ul className="space-y-1 text-muted-foreground">
                {tenant.contact_email && <li>📧 {tenant.contact_email}</li>}
                {tenant.contact_phone && <li>📞 {tenant.contact_phone}</li>}
                <li><Link to="/t/$slug/contact" params={{ slug }} className="hover:text-foreground">صفحة التواصل</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t py-4 text-center text-xs text-muted-foreground">
            © {new Date().getFullYear()} {tenant.name} — مدعومة بـ <span className="font-semibold">EduForge</span>
          </div>
        </footer>

        <FloatingChat
          tenantId={tenant.id}
          tenantName={tenant.name}
          primaryColor={primary}
          secondaryColor={secondary}
        />
      </div>
    </MaintenanceGate>
  );
}

function NavTab({
  to,
  params,
  icon: Icon,
  label,
  exact,
}: {
  to: string;
  params: Record<string, string>;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  exact?: boolean;
}) {
  return (
    <Link
      to={to}
      params={params}
      activeOptions={{ exact }}
      activeProps={{
        className: "bg-[var(--tenant-primary)] text-white",
      }}
      inactiveProps={{ className: "text-muted-foreground hover:text-foreground hover:bg-accent" }}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
    >
      <Icon className="h-4 w-4" />
      {label}
    </Link>
  );
}

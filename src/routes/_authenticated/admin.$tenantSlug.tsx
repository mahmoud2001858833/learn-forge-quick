import { createFileRoute, Link, Outlet, useParams, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  LayoutDashboard, BookOpen, Users, Settings, GraduationCap, Package, Landmark, Receipt, Ticket,
  Share2, Activity, BarChart3, MessageCircle, Video, Library, ClipboardCheck, UserCheck, HardDrive,
  ChevronRight, Home, Search, HelpCircle,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger,
  SidebarSeparator, useSidebar,
} from "@/components/ui/sidebar";
import { NotificationsBell } from "@/components/notifications-bell";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useTenantRole } from "@/hooks/use-tenant-role";
import { AccessDenied } from "@/components/access-denied";
import { ErrorBoundary } from "@/components/error-boundary";

export const Route = createFileRoute("/_authenticated/admin/$tenantSlug")({
  component: AdminLayout,
});

type NavItem = {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
  requiresOwner?: boolean;
  requiresAdmin?: boolean;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const NAV_GROUPS = (slug: string): NavGroup[] => [
  {
    label: "نظرة عامة",
    items: [
      { to: "/admin/$tenantSlug", label: "لوحة القيادة", icon: LayoutDashboard, exact: true },
      { to: "/admin/$tenantSlug/reports", label: "التقارير", icon: BarChart3 },
      { to: "/admin/$tenantSlug/activity", label: "سجل النشاط", icon: Activity },
    ],
  },
  {
    label: "المحتوى التعليمي",
    items: [
      { to: "/admin/$tenantSlug/courses", label: "الدورات", icon: BookOpen },
      { to: "/admin/$tenantSlug/bundles", label: "الحزم", icon: Package },
      { to: "/admin/$tenantSlug/question-bank", label: "بنك الأسئلة", icon: Library },
      { to: "/admin/$tenantSlug/assignments", label: "الواجبات", icon: ClipboardCheck },
      { to: "/admin/$tenantSlug/academic", label: "الهيكل الأكاديمي", icon: GraduationCap },
      { to: "/admin/$tenantSlug/live-sessions", label: "الجلسات الحيّة", icon: Video },
    ],
  },
  {
    label: "المستخدمون",
    items: [
      { to: "/admin/$tenantSlug/students", label: "الطلاب", icon: Users, requiresAdmin: true },
      { to: "/admin/$tenantSlug/instructor-approvals", label: "طلبات المعلمين", icon: UserCheck, requiresAdmin: true },
      { to: "/admin/$tenantSlug/chat", label: "المحادثات", icon: MessageCircle },
    ],
  },
  {
    label: "المالية والنمو",
    items: [
      { to: "/admin/$tenantSlug/payments", label: "طلبات الدفع", icon: Receipt, requiresOwner: true },
      { to: "/admin/$tenantSlug/bank-accounts", label: "الحسابات البنكية", icon: Landmark, requiresOwner: true },
      { to: "/admin/$tenantSlug/coupons", label: "الكوبونات", icon: Ticket, requiresAdmin: true },
      { to: "/admin/$tenantSlug/referrals", label: "الإحالات", icon: Share2, requiresAdmin: true },
    ],
  },
  {
    label: "النظام",
    items: [
      { to: "/admin/$tenantSlug/storage", label: "التخزين", icon: HardDrive, requiresAdmin: true },
      { to: "/admin/$tenantSlug/settings", label: "الإعدادات", icon: Settings, requiresOwner: true },
    ],
  },
];

function AdminLayout() {
  const { tenantSlug } = useParams({ from: "/_authenticated/admin/$tenantSlug" });

  const { data: tenant, isLoading: isTenantLoading } = useQuery({
    queryKey: ["tenant", tenantSlug],
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.from("tenants").select("*").eq("slug", tenantSlug).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { role, isOwner, isAdmin, isStaff, isLoading: isRoleLoading } = useTenantRole(tenant?.id, tenant?.owner_id);

  // Only block while we truly have nothing to paint. Once the tenant is known
  // (usually instantly from cache) the shell renders while the role resolves.
  if (!tenant && isTenantLoading) {
    return (
      <div className="min-h-screen grid place-items-center text-muted-foreground bg-muted/20" dir="rtl">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 border-3 border-primary border-t-transparent rounded-full animate-spin" />
          <div className="text-sm font-medium">جارٍ تحميل لوحة التحكم...</div>
        </div>
      </div>
    );
  }

  if (!tenant) {
    return <AccessDenied title="المنصة غير موجودة" description="لم يتم العثور على المنصة المطلوبة، قد يكون تم حذفها أو تعديل رابطها." />;
  }

  if (!isStaff && !isRoleLoading) {
    return (
      <AccessDenied
        title="غير مصرح لك بالدخول"
        description="ليس لديك صلاحيات إدارة أو تدريس في هذه المنصة. إذا كنت تعتقد أن هذا خطأ، يرجى التواصل مع مالك الأكاديمية."
        tenantSlug={tenant.slug}
      />
    );
  }


  const primary = tenant.primary_color ?? "#6366f1";
  const secondary = tenant.secondary_color ?? "#D4AF37";

  return (
    <SidebarProvider>
      <div
        className="min-h-screen flex w-full bg-gradient-to-br from-muted/40 via-background to-muted/20"
        dir="rtl"
        style={{ ["--tenant-primary" as string]: primary, ["--tenant-secondary" as string]: secondary }}
      >
        <AdminSidebar tenant={tenant} isOwner={isOwner} isAdmin={isAdmin} />

        <div className="flex-1 flex flex-col min-w-0">
          <AdminHeader tenant={tenant} role={role} />
          <main className="flex-1 overflow-auto">
            <div className="p-6 lg:p-8 max-w-[1600px] mx-auto w-full">
              <ErrorBoundary fallbackTitle="حدث خطأ في عرض هذه الصفحة" fallbackDescription="تعذر تحميل جزء من لوحة التحكم، يرجى إعادة المحاولة.">
                <Outlet />
              </ErrorBoundary>
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function AdminSidebar({
  tenant,
  isOwner,
  isAdmin,
}: {
  tenant: { name: string; slug: string; logo_url: string | null; primary_color: string | null; secondary_color: string | null };
  isOwner: boolean;
  isAdmin: boolean;
}) {
  const { tenantSlug } = useParams({ from: "/_authenticated/admin/$tenantSlug" });
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const primary = tenant.primary_color ?? "#6366f1";
  const secondary = tenant.secondary_color ?? "#D4AF37";

  return (
    <Sidebar collapsible="icon" side="right" className="border-l">
      <SidebarHeader className="border-b">
        <div className="flex items-center gap-3 px-1 py-2">
          <div
            className="h-10 w-10 rounded-xl grid place-items-center shrink-0 ring-2 ring-background shadow-md overflow-hidden"
            style={{ background: `linear-gradient(135deg, ${primary}, ${secondary})` }}
          >
            {tenant.logo_url ? (
              <img src={tenant.logo_url} alt={tenant.name} className="h-full w-full object-cover" />
            ) : (
              <GraduationCap className="h-5 w-5 text-white" />
            )}
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <div className="font-bold text-sm truncate">{tenant.name}</div>
              <Link
                to="/t/$slug"
                params={{ slug: tenant.slug }}
                target="_blank"
                className="text-[11px] text-muted-foreground hover:text-foreground truncate flex items-center gap-1"
              >
                عرض الموقع العام <ChevronRight className="h-3 w-3 rotate-180" />
              </Link>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="gap-0">
        {NAV_GROUPS(tenantSlug).map((group) => {
          const visibleItems = group.items.filter((item) => {
            if (item.requiresOwner && !isOwner) return false;
            if (item.requiresAdmin && !isAdmin) return false;
            return true;
          });
          if (visibleItems.length === 0) return null;

          return (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-semibold">
                {group.label}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {visibleItems.map((item) => {
                    const targetPath = item.to.replace("$tenantSlug", tenantSlug);
                    const isActive = item.exact ? pathname === targetPath : pathname.startsWith(targetPath);
                    return (
                      <SidebarMenuItem key={item.to}>
                        <SidebarMenuButton asChild isActive={isActive} tooltip={item.label} className="data-[active=true]:font-semibold">
                          <Link to={item.to} params={{ tenantSlug }} className="flex items-center gap-2">
                            <item.icon className="h-4 w-4 shrink-0" />
                            <span className="truncate">{item.label}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>

      <SidebarSeparator />
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="لوحة الحسابات">
              <Link to="/dashboard" className="flex items-center gap-2">
                <Home className="h-4 w-4" />
                <span className="truncate">جميع المنصات</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

function AdminHeader({ tenant, role }: { tenant: { name: string; plan?: string | null }; role?: string | null }) {
  const { user } = useAuth();
  const initials = (user?.user_metadata?.full_name ?? user?.email ?? "?").slice(0, 1).toUpperCase();

  const roleLabel =
    role === "owner" || role === "super_admin"
      ? "مالك المنصة"
      : role === "admin"
      ? "مدير"
      : role === "instructor"
      ? "معلم"
      : "عضو";

  return (
    <header className="sticky top-0 z-20 h-16 flex items-center gap-3 px-4 lg:px-6 border-b bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
      <SidebarTrigger className="-ms-1" />
      <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground">
        <LayoutDashboard className="h-4 w-4" />
        <span className="font-semibold text-foreground">{tenant.name}</span>
        {role && (
          <span className="text-[11px] px-2 py-0.5 rounded-md bg-primary/10 text-primary font-medium">
            {roleLabel}
          </span>
        )}
        {tenant.plan && (
          <span
            className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full text-white"
            style={{ background: "var(--tenant-primary)" }}
          >
            {tenant.plan}
          </span>
        )}
      </div>

      <div className="hidden lg:flex flex-1 max-w-md mx-auto">
        <div className="relative w-full">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="ابحث في المنصة..."
            className="pr-9 h-9 bg-muted/40 border-transparent focus-visible:bg-background"
          />
        </div>
      </div>

      <div className="flex-1 lg:hidden" />

      <div className="flex items-center gap-2">
        <NotificationsBell />
        <Avatar className="h-8 w-8 ring-2 ring-background shadow">
          <AvatarImage src={user?.user_metadata?.avatar_url} />
          <AvatarFallback
            className="text-white text-xs font-bold"
            style={{ background: `linear-gradient(135deg, var(--tenant-primary), var(--tenant-secondary))` }}
          >
            {initials}
          </AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
}

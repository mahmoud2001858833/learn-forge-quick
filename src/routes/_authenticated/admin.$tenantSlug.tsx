import { createFileRoute, Link, Outlet, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { LayoutDashboard, BookOpen, Users, Settings, ArrowRight, GraduationCap, Package, Landmark, Receipt, Ticket, Share2, Activity, BarChart3, MessageCircle, Video, Library, ClipboardCheck, UserCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { NotificationsBell } from "@/components/notifications-bell";

export const Route = createFileRoute("/_authenticated/admin/$tenantSlug")({
  component: AdminLayout,
});

function AdminLayout() {
  const { tenantSlug } = useParams({ from: "/_authenticated/admin/$tenantSlug" });

  const { data: tenant, isLoading } = useQuery({
    queryKey: ["tenant", tenantSlug],
    queryFn: async () => {
      const { data, error } = await supabase.from("tenants").select("*").eq("slug", tenantSlug).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) return <div className="p-10 text-center">جارٍ التحميل...</div>;
  if (!tenant) return <div className="p-10 text-center">المنصة غير موجودة</div>;

  return (
    <div className="min-h-screen flex bg-muted/20">
      <aside className="w-64 bg-background border-l p-4 space-y-1">
        <Link to="/dashboard" className="flex items-center gap-2 text-sm text-muted-foreground mb-6 hover:text-foreground">
          <ArrowRight className="h-4 w-4" /> الرئيسية
        </Link>
        <div className="flex items-center gap-2 mb-4 px-2">
          <span className="w-3 h-3 rounded-full" style={{ background: tenant.primary_color }} />
          <span className="font-bold truncate">{tenant.name}</span>
        </div>
        <NavItem to="/admin/$tenantSlug" params={{ tenantSlug }} icon={LayoutDashboard} label="نظرة عامة" exact />
        <NavItem to="/admin/$tenantSlug/courses" params={{ tenantSlug }} icon={BookOpen} label="الدورات" />
        <NavItem to="/admin/$tenantSlug/bundles" params={{ tenantSlug }} icon={Package} label="الحزم" />
        <NavItem to="/admin/$tenantSlug/question-bank" params={{ tenantSlug }} icon={Library} label="بنك الأسئلة" />
        <NavItem to="/admin/$tenantSlug/assignments" params={{ tenantSlug }} icon={ClipboardCheck} label="الواجبات" />
        <NavItem to="/admin/$tenantSlug/academic" params={{ tenantSlug }} icon={GraduationCap} label="الهيكل الأكاديمي" />
        <NavItem to="/admin/$tenantSlug/students" params={{ tenantSlug }} icon={Users} label="الطلاب" />
        <NavItem to="/admin/$tenantSlug/payments" params={{ tenantSlug }} icon={Receipt} label="طلبات الدفع" />
        <NavItem to="/admin/$tenantSlug/bank-accounts" params={{ tenantSlug }} icon={Landmark} label="الحسابات البنكية" />
        <NavItem to="/admin/$tenantSlug/coupons" params={{ tenantSlug }} icon={Ticket} label="الكوبونات" />
        <NavItem to="/admin/$tenantSlug/referrals" params={{ tenantSlug }} icon={Share2} label="الإحالات" />
        <NavItem to="/admin/$tenantSlug/chat" params={{ tenantSlug }} icon={MessageCircle} label="المحادثات" />
        <NavItem to="/admin/$tenantSlug/live-sessions" params={{ tenantSlug }} icon={Video} label="الجلسات الحيّة" />
        <NavItem to="/admin/$tenantSlug/activity" params={{ tenantSlug }} icon={Activity} label="سجل النشاط" />
        <NavItem to="/admin/$tenantSlug/reports" params={{ tenantSlug }} icon={BarChart3} label="التقارير" />
        <NavItem to="/admin/$tenantSlug/settings" params={{ tenantSlug }} icon={Settings} label="الإعدادات" />
      </aside>
      <main className="flex-1 overflow-auto">
        <header className="flex items-center justify-end gap-2 px-6 py-3 border-b bg-background">
          <NotificationsBell />
        </header>
        <div className="p-8"><Outlet /></div>
      </main>
    </div>
  );
}

function NavItem({ to, params, icon: Icon, label, exact }: { to: string; params: Record<string, string>; icon: React.ComponentType<{ className?: string }>; label: string; exact?: boolean }) {
  return (
    <Link
      to={to}
      params={params}
      activeOptions={{ exact }}
      activeProps={{ className: "bg-primary text-primary-foreground" }}
      className={cn("flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-accent transition-colors")}
    >
      <Icon className="h-4 w-4" />
      {label}
    </Link>
  );
}

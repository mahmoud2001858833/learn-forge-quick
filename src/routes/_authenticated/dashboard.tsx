import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { GraduationCap, LogOut, BookOpen, Settings, ExternalLink, Shield, Award, Sparkles, Share2, Receipt } from "lucide-react";
import { NotificationsBell } from "@/components/notifications-bell";
import { Plus } from "lucide-react";
import { CreateTenantWizard } from "@/components/tenant/create-tenant-wizard";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [wizardOpen, setWizardOpen] = useState(false);
  const autoOpenedRef = useRef(false);

  const { data: ownedTenants } = useQuery({
    queryKey: ["my-tenants", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenants")
        .select("*")
        .eq("owner_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: enrollments } = useQuery({
    queryKey: ["my-enrollments", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("enrollments")
        .select("*, courses(title, cover_url, slug, tenants(slug, name))")
        .eq("student_id", user!.id);
      if (error) throw error;
      return data;
    },
  });

  const { data: isSuper } = useQuery({
    queryKey: ["is-super-admin", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id)
        .eq("role", "super_admin")
        .maybeSingle();
      return !!data;
    },
  });


  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-muted/20">
      <header className="border-b bg-background">
        <div className="container mx-auto flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2 font-bold">
            <GraduationCap className="h-6 w-6 text-primary" />
            EduForge
          </div>
          <div className="flex items-center gap-2">
            <NotificationsBell />
            {isSuper && (
              <Link to="/super-admin">
                <Button variant="outline" size="sm">
                  <Shield className="h-4 w-4 ml-2" /> سوبر-أدمن
                </Button>
              </Link>
            )}
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="h-4 w-4 ml-2" /> خروج
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8 space-y-10">
        <section>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold">منصاتي</h2>
              <p className="text-muted-foreground text-sm">المنصات التعليمية التي تملكها</p>
            </div>
            <Button asChild><Link to="/onboard/new-tenant"><Plus className="h-4 w-4 ml-1" /> منصة جديدة</Link></Button>
          </div>
          {ownedTenants && ownedTenants.length === 0 && (
            <Card><CardContent className="p-10 text-center text-muted-foreground">لم تنشئ أي منصة بعد. اضغط "منصة جديدة" للبدء.</CardContent></Card>
          )}
          <div className="grid md:grid-cols-3 gap-4">
            {ownedTenants?.map((t) => (
              <Card key={t.id}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full" style={{ background: t.primary_color }} />
                    {t.name}
                  </CardTitle>
                  <CardDescription>/{t.slug}</CardDescription>
                </CardHeader>
                <CardContent className="flex gap-2">
                  <Link to="/admin/$tenantSlug" params={{ tenantSlug: t.slug }} className="flex-1">
                    <Button variant="default" size="sm" className="w-full"><Settings className="h-4 w-4 ml-1" /> إدارة</Button>
                  </Link>
                  <Link to="/t/$slug" params={{ slug: t.slug }} className="flex-1">
                    <Button variant="outline" size="sm" className="w-full"><ExternalLink className="h-4 w-4 ml-1" /> عرض</Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-lg font-bold mb-3">روابط سريعة</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <QuickLink to="/my-certificates" icon={Award} label="شهاداتي" color="text-amber-500" />
            <QuickLink to="/my-badges" icon={Sparkles} label="شاراتي" color="text-blue-500" />
            <QuickLink to="/my-referrals" icon={Share2} label="إحالاتي" color="text-green-500" />
            <QuickLink to="/my-payments" icon={Receipt} label="طلبات الدفع" color="text-purple-500" />
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-4">دوراتي</h2>
          {enrollments && enrollments.length === 0 && (
            <Card><CardContent className="p-10 text-center text-muted-foreground">لم تسجل في أي دورة بعد.</CardContent></Card>
          )}
          <div className="grid md:grid-cols-3 gap-4">
            {enrollments?.map((e) => (
              <Card key={e.id}>
                <CardHeader>
                  <CardTitle className="text-base">{e.courses?.title}</CardTitle>
                  <CardDescription>{e.courses?.tenants?.name}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Link to="/learn/$enrollmentId" params={{ enrollmentId: e.id }}>
                    <Button size="sm" className="w-full"><BookOpen className="h-4 w-4 ml-1" /> متابعة التعلم</Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

function QuickLink({ to, icon: Icon, label, color }: { to: string; icon: React.ComponentType<{ className?: string }>; label: string; color: string }) {
  return (
    <Link to={to}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer">
        <CardContent className="p-4 flex items-center gap-3">
          <Icon className={`h-6 w-6 ${color}`} />
          <span className="font-medium">{label}</span>
        </CardContent>
      </Card>
    </Link>
  );
}


import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Shield, Building2, Users, BookOpen, GraduationCap, Power, PowerOff, Plus, ArrowRight } from "lucide-react";
import {
  listAllTenantsAdmin,
  getPlatformStats,
  setTenantStatus,
  grantSuperAdmin,
} from "@/lib/tenants.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/super-admin")({
  component: SuperAdminPage,
});

function SuperAdminPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Verify role client-side as a courtesy; server functions enforce it.
  const { data: isSuper, isLoading: roleLoading } = useQuery({
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

  if (roleLoading) return <div className="p-10 text-center">جارٍ التحقق...</div>;
  if (!isSuper) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" dir="rtl">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>غير مصرّح</CardTitle>
            <CardDescription>هذه الصفحة مخصصة للسوبر-أدمن فقط.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <BootstrapSuperAdminForm onDone={() => window.location.reload()} />
            <Button variant="outline" className="w-full" onClick={() => navigate({ to: "/dashboard" })}>
              العودة للوحة التحكم
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/20" dir="rtl">
      <header className="border-b bg-background">
        <div className="container mx-auto flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2 font-bold">
            <Shield className="h-6 w-6 text-primary" />
            لوحة السوبر-أدمن
          </div>
          <Link to="/dashboard" className="text-sm hover:underline">العودة للوحة التحكم</Link>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8 space-y-8">
        <StatsCards />
        <TenantsTable />
        <GrantSuperAdminCard />
      </main>
    </div>
  );
}

function StatsCards() {
  const { data } = useQuery({
    queryKey: ["platform-stats"],
    queryFn: () => getPlatformStats(),
  });
  const items = [
    { label: "المنصات", value: data?.tenants ?? "—", icon: Building2 },
    { label: "المستخدمون", value: data?.users ?? "—", icon: Users },
    { label: "الكورسات", value: data?.courses ?? "—", icon: BookOpen },
    { label: "التسجيلات", value: data?.enrollments ?? "—", icon: GraduationCap },
  ];
  return (
    <div className="grid md:grid-cols-4 gap-4">
      {items.map(({ label, value, icon: Icon }) => (
        <Card key={label}>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-lg bg-primary/10 p-3"><Icon className="h-6 w-6 text-primary" /></div>
            <div>
              <div className="text-2xl font-bold">{value}</div>
              <div className="text-sm text-muted-foreground">{label}</div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function TenantsTable() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["all-tenants-admin"],
    queryFn: () => listAllTenantsAdmin(),
  });

  const toggle = useMutation({
    mutationFn: (vars: { id: string; status: "active" | "suspended" }) =>
      setTenantStatus({ data: { tenant_id: vars.id, status: vars.status } }),
    onSuccess: () => {
      toast.success("تم التحديث");
      qc.invalidateQueries({ queryKey: ["all-tenants-admin"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>كل المنصات</CardTitle>
        <CardDescription>إدارة، تعليق، وتفعيل المنصات</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b">
              <tr className="text-right">
                <th className="py-2 px-2">المنصة</th>
                <th className="py-2 px-2">المعرّف</th>
                <th className="py-2 px-2">الحالة</th>
                <th className="py-2 px-2">العملة</th>
                <th className="py-2 px-2">تاريخ الإنشاء</th>
                <th className="py-2 px-2">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {data?.tenants.map((t) => (
                <tr key={t.id} className="border-b">
                  <td className="py-2 px-2 font-medium flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full" style={{ background: t.primary_color }} />
                    {t.name}
                  </td>
                  <td className="py-2 px-2 text-muted-foreground">{t.slug}</td>
                  <td className="py-2 px-2">
                    <Badge variant={t.status === "active" ? "default" : t.status === "suspended" ? "destructive" : "secondary"}>
                      {t.status === "active" ? "نشطة" : t.status === "suspended" ? "موقوفة" : t.status}
                    </Badge>
                  </td>
                  <td className="py-2 px-2">{t.currency}</td>
                  <td className="py-2 px-2 text-muted-foreground">{new Date(t.created_at).toLocaleDateString("ar")}</td>
                  <td className="py-2 px-2 flex gap-2">
                    <Link to="/t/$slug" params={{ slug: t.slug }}>
                      <Button size="sm" variant="outline"><ArrowRight className="h-3 w-3 ml-1" />فتح</Button>
                    </Link>
                    {t.status === "active" ? (
                      <Button size="sm" variant="destructive" onClick={() => toggle.mutate({ id: t.id, status: "suspended" })}>
                        <PowerOff className="h-3 w-3 ml-1" />تعليق
                      </Button>
                    ) : (
                      <Button size="sm" variant="default" onClick={() => toggle.mutate({ id: t.id, status: "active" })}>
                        <Power className="h-3 w-3 ml-1" />تفعيل
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
              {data && data.tenants.length === 0 && (
                <tr><td colSpan={6} className="py-10 text-center text-muted-foreground">لا توجد منصات بعد</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function GrantSuperAdminCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>منح صلاحية السوبر-أدمن</CardTitle>
        <CardDescription>أضف مستخدماً آخر لإدارة كل المنصات</CardDescription>
      </CardHeader>
      <CardContent>
        <GrantForm />
      </CardContent>
    </Card>
  );
}

function GrantForm({ onDone }: { onDone?: () => void } = {}) {
  const [email, setEmail] = useState("");
  const grant = useMutation({
    mutationFn: () => grantSuperAdmin({ data: { email: email.trim() } }),
    onSuccess: () => {
      toast.success("تم المنح");
      setEmail("");
      onDone?.();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <form onSubmit={(e) => { e.preventDefault(); grant.mutate(); }} className="flex gap-2">
      <Input type="email" required placeholder="email@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
      <Button type="submit" disabled={grant.isPending}>
        <Plus className="h-4 w-4 ml-1" />منح
      </Button>
    </form>
  );
}

function BootstrapSuperAdminForm({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="default" className="w-full">منحي صلاحية السوبر-أدمن (إن لم يوجد أحد بعد)</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>تفعيل السوبر-أدمن لأول مرة</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          إذا لم يكن هناك أي سوبر-أدمن في النظام بعد، يمكنك منح نفسك الصلاحية. هذا متاح مرة واحدة فقط.
        </p>
        <GrantForm onDone={() => { setOpen(false); onDone(); }} />
        <DialogFooter />
      </DialogContent>
    </Dialog>
  );
}

import { createFileRoute, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Edit, Ticket } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/$tenantSlug/coupons")({
  component: CouponsPage,
});

type CouponForm = {
  id?: string;
  code: string;
  type: "percent" | "fixed";
  value: number;
  scope: "all" | "course" | "bundle";
  course_id: string | null;
  bundle_id: string | null;
  min_amount: number;
  max_uses: number | null;
  per_user_limit: number;
  expires_at: string;
  is_active: boolean;
};

const EMPTY: CouponForm = {
  code: "", type: "percent", value: 10, scope: "all",
  course_id: null, bundle_id: null,
  min_amount: 0, max_uses: null, per_user_limit: 1, expires_at: "", is_active: true,
};

function CouponsPage() {
  const { tenantSlug } = useParams({ from: "/_authenticated/admin/$tenantSlug/coupons" });
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<CouponForm>(EMPTY);

  const { data: tenant } = useQuery({
    queryKey: ["tenant", tenantSlug],
    queryFn: async () => (await supabase.from("tenants").select("id").eq("slug", tenantSlug).single()).data,
  });

  const { data: coupons } = useQuery({
    queryKey: ["coupons", tenant?.id],
    enabled: !!tenant,
    queryFn: async () => {
      const { data, error } = await supabase.from("coupons").select("*, courses(title), course_bundles(name)")
        .eq("tenant_id", tenant!.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: courses } = useQuery({
    queryKey: ["tenant-courses-list", tenant?.id],
    enabled: !!tenant,
    queryFn: async () => (await supabase.from("courses").select("id, title").eq("tenant_id", tenant!.id)).data ?? [],
  });

  const { data: bundles } = useQuery({
    queryKey: ["tenant-bundles-list", tenant?.id],
    enabled: !!tenant,
    queryFn: async () => (await supabase.from("course_bundles").select("id, name").eq("tenant_id", tenant!.id)).data ?? [],
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!tenant) throw new Error("no tenant");
      const payload = {
        tenant_id: tenant.id,
        code: form.code.toUpperCase().trim(),
        type: form.type,
        value: form.value,
        scope: form.scope,
        course_id: form.scope === "course" ? form.course_id : null,
        bundle_id: form.scope === "bundle" ? form.bundle_id : null,
        min_amount: form.min_amount,
        max_uses: form.max_uses,
        per_user_limit: form.per_user_limit,
        expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
        is_active: form.is_active,
      };
      if (form.id) {
        const { error } = await supabase.from("coupons").update(payload).eq("id", form.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("coupons").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("تم الحفظ");
      qc.invalidateQueries({ queryKey: ["coupons"] });
      setOpen(false);
      setForm(EMPTY);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("coupons").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم الحذف");
      qc.invalidateQueries({ queryKey: ["coupons"] });
    },
  });

  return (
    <div dir="rtl" className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">الكوبونات</h1>
          <p className="text-sm text-muted-foreground">إنشاء أكواد خصم للطلاب</p>
        </div>
        <Button onClick={() => { setForm(EMPTY); setOpen(true); }}>
          <Plus className="h-4 w-4 ml-2" /> كوبون جديد
        </Button>
      </div>

      <div className="grid gap-3">
        {coupons?.length === 0 && (
          <Card><CardContent className="p-8 text-center text-muted-foreground">لا توجد كوبونات</CardContent></Card>
        )}
        {coupons?.map((c) => (
          <Card key={c.id} className={!c.is_active ? "opacity-60" : ""}>
            <CardContent className="p-4 flex items-start gap-4">
              <Ticket className="h-6 w-6 text-primary mt-1" />
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <code className="font-bold text-lg bg-primary/10 px-2 py-1 rounded">{c.code}</code>
                  <Badge variant={c.is_active ? "default" : "secondary"}>
                    {c.type === "percent" ? `${c.value}%` : `${c.value} خصم ثابت`}
                  </Badge>
                  {c.scope !== "all" && (
                    <Badge variant="outline">
                      {c.scope === "course" ? `دورة: ${c.courses?.title}` : `حزمة: ${c.course_bundles?.name}`}
                    </Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  استخدم {c.used_count}{c.max_uses ? ` / ${c.max_uses}` : ""} مرة
                  {c.expires_at && ` • ينتهي ${new Date(c.expires_at).toLocaleDateString("ar-SA")}`}
                  {c.min_amount > 0 && ` • حد أدنى ${c.min_amount}`}
                </div>
              </div>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" onClick={() => {
                  setForm({
                    id: c.id, code: c.code, type: c.type, value: Number(c.value),
                    scope: c.scope, course_id: c.course_id, bundle_id: c.bundle_id,
                    min_amount: Number(c.min_amount), max_uses: c.max_uses, per_user_limit: c.per_user_limit,
                    expires_at: c.expires_at ? c.expires_at.slice(0, 16) : "", is_active: c.is_active,
                  });
                  setOpen(true);
                }}><Edit className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => { if (confirm("حذف الكوبون؟")) del.mutate(c.id); }}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent dir="rtl" className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{form.id ? "تعديل كوبون" : "كوبون جديد"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>الكود *</Label>
              <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="SAVE20" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>النوع</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as "percent" | "fixed" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">نسبة %</SelectItem>
                    <SelectItem value="fixed">مبلغ ثابت</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>القيمة</Label>
                <Input type="number" value={form.value} onChange={(e) => setForm({ ...form, value: Number(e.target.value) })} />
              </div>
            </div>
            <div>
              <Label>النطاق</Label>
              <Select value={form.scope} onValueChange={(v) => setForm({ ...form, scope: v as CouponForm["scope"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل الدورات والحزم</SelectItem>
                  <SelectItem value="course">دورة محددة</SelectItem>
                  <SelectItem value="bundle">حزمة محددة</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.scope === "course" && (
              <div>
                <Label>الدورة</Label>
                <Select value={form.course_id ?? ""} onValueChange={(v) => setForm({ ...form, course_id: v })}>
                  <SelectTrigger><SelectValue placeholder="اختر دورة" /></SelectTrigger>
                  <SelectContent>
                    {courses?.map((c) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {form.scope === "bundle" && (
              <div>
                <Label>الحزمة</Label>
                <Select value={form.bundle_id ?? ""} onValueChange={(v) => setForm({ ...form, bundle_id: v })}>
                  <SelectTrigger><SelectValue placeholder="اختر حزمة" /></SelectTrigger>
                  <SelectContent>
                    {bundles?.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>الحد الأدنى للمبلغ</Label>
                <Input type="number" value={form.min_amount} onChange={(e) => setForm({ ...form, min_amount: Number(e.target.value) })} />
              </div>
              <div>
                <Label>أقصى استخدامات (فارغ = غير محدود)</Label>
                <Input type="number" value={form.max_uses ?? ""} onChange={(e) => setForm({ ...form, max_uses: e.target.value ? Number(e.target.value) : null })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>أقصى مرات لكل طالب</Label>
                <Input type="number" min={1} value={form.per_user_limit} onChange={(e) => setForm({ ...form, per_user_limit: Number(e.target.value) })} />
              </div>
              <div>
                <Label>ينتهي في</Label>
                <Input type="datetime-local" value={form.expires_at} onChange={(e) => setForm({ ...form, expires_at: e.target.value })} />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label>مفعّل</Label>
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
            <Button onClick={() => save.mutate()} disabled={!form.code || save.isPending}>حفظ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { createFileRoute, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Building2, Edit } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/$tenantSlug/bank-accounts")({
  component: BankAccountsPage,
});

type BankForm = {
  id?: string;
  bank_name: string;
  account_holder: string;
  iban: string;
  account_number: string;
  notes: string;
  is_active: boolean;
};

const EMPTY: BankForm = { bank_name: "", account_holder: "", iban: "", account_number: "", notes: "", is_active: true };

function BankAccountsPage() {
  const { tenantSlug } = useParams({ from: "/_authenticated/admin/$tenantSlug/bank-accounts" });
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<BankForm>(EMPTY);

  const { data: tenant } = useQuery({
    queryKey: ["tenant", tenantSlug],
    queryFn: async () => (await supabase.from("tenants").select("id").eq("slug", tenantSlug).single()).data,
  });

  const { data: accounts } = useQuery({
    queryKey: ["bank-accounts", tenant?.id],
    enabled: !!tenant,
    queryFn: async () => {
      const { data, error } = await supabase.from("bank_accounts").select("*")
        .eq("tenant_id", tenant!.id).order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!tenant) throw new Error("no tenant");
      const payload = {
        tenant_id: tenant.id,
        bank_name: form.bank_name,
        account_holder: form.account_holder,
        iban: form.iban || null,
        account_number: form.account_number || null,
        notes: form.notes || null,
        is_active: form.is_active,
      };
      if (form.id) {
        const { error } = await supabase.from("bank_accounts").update(payload).eq("id", form.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("bank_accounts").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("تم الحفظ");
      qc.invalidateQueries({ queryKey: ["bank-accounts"] });
      setOpen(false);
      setForm(EMPTY);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("bank_accounts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم الحذف");
      qc.invalidateQueries({ queryKey: ["bank-accounts"] });
    },
  });

  return (
    <div dir="rtl" className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">الحسابات البنكية</h1>
          <p className="text-sm text-muted-foreground">الحسابات التي يحوّل عليها الطلاب عند الدفع اليدوي</p>
        </div>
        <Button onClick={() => { setForm(EMPTY); setOpen(true); }}>
          <Plus className="h-4 w-4 ml-2" /> إضافة حساب
        </Button>
      </div>

      <div className="grid gap-3">
        {accounts?.length === 0 && (
          <Card><CardContent className="p-8 text-center text-muted-foreground">لا توجد حسابات بنكية بعد</CardContent></Card>
        )}
        {accounts?.map((a) => (
          <Card key={a.id} className={!a.is_active ? "opacity-60" : ""}>
            <CardContent className="p-4 flex items-start gap-4">
              <Building2 className="h-6 w-6 text-muted-foreground mt-1" />
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold">{a.bank_name}</span>
                  {!a.is_active && <span className="text-xs bg-muted px-2 py-0.5 rounded">معطّل</span>}
                </div>
                <div className="text-sm">المستفيد: {a.account_holder}</div>
                {a.iban && <div className="text-sm text-muted-foreground">IBAN: {a.iban}</div>}
                {a.account_number && <div className="text-sm text-muted-foreground">الحساب: {a.account_number}</div>}
                {a.notes && <div className="text-xs text-muted-foreground">{a.notes}</div>}
              </div>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" onClick={() => {
                  setForm({
                    id: a.id,
                    bank_name: a.bank_name,
                    account_holder: a.account_holder,
                    iban: a.iban ?? "",
                    account_number: a.account_number ?? "",
                    notes: a.notes ?? "",
                    is_active: a.is_active,
                  });
                  setOpen(true);
                }}>
                  <Edit className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => { if (confirm("حذف الحساب؟")) del.mutate(a.id); }}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>{form.id ? "تعديل حساب" : "إضافة حساب بنكي"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>اسم البنك *</Label>
              <Input value={form.bank_name} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} />
            </div>
            <div>
              <Label>اسم المستفيد *</Label>
              <Input value={form.account_holder} onChange={(e) => setForm({ ...form, account_holder: e.target.value })} />
            </div>
            <div>
              <Label>رقم الآيبان (IBAN)</Label>
              <Input value={form.iban} onChange={(e) => setForm({ ...form, iban: e.target.value })} />
            </div>
            <div>
              <Label>رقم الحساب</Label>
              <Input value={form.account_number} onChange={(e) => setForm({ ...form, account_number: e.target.value })} />
            </div>
            <div>
              <Label>ملاحظات</Label>
              <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <div className="flex items-center justify-between">
              <Label>الحساب مفعّل</Label>
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
            <Button onClick={() => save.mutate()} disabled={!form.bank_name || !form.account_holder || save.isPending}>حفظ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

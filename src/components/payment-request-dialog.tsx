import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Copy, Upload, Building2 } from "lucide-react";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tenantId: string;
  amount: number;
  currency: string;
  target: { type: "course"; courseId: string } | { type: "bundle"; bundleId: string };
  onSuccess?: () => void;
};

export function PaymentRequestDialog({ open, onOpenChange, tenantId, amount, currency, target, onSuccess }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [selectedBankId, setSelectedBankId] = useState<string | null>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [notes, setNotes] = useState("");
  const [uploading, setUploading] = useState(false);

  const { data: banks } = useQuery({
    queryKey: ["bank-accounts", tenantId],
    enabled: open && !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bank_accounts").select("*")
        .eq("tenant_id", tenantId).eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const submit = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("يجب تسجيل الدخول");
      if (!receiptFile) throw new Error("يرجى رفع صورة الإيصال");
      setUploading(true);
      const ext = receiptFile.name.split(".").pop() || "jpg";
      const path = `${tenantId}/${user.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("receipts").upload(path, receiptFile, { upsert: false });
      if (upErr) throw upErr;

      const payload: Record<string, unknown> = {
        tenant_id: tenantId,
        student_id: user.id,
        bank_account_id: selectedBankId,
        amount,
        currency,
        receipt_url: path,
        student_notes: notes || null,
      };
      if (target.type === "course") payload.course_id = target.courseId;
      else payload.bundle_id = target.bundleId;

      // Ensure tenant_member exists (student role)
      await supabase.from("tenant_members").insert({ tenant_id: tenantId, user_id: user.id, role: "student" }).select();

      const { error } = await supabase.from("payment_requests").insert(payload as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم إرسال طلب الدفع، بانتظار مراجعة الإدارة");
      qc.invalidateQueries({ queryKey: ["my-payment-requests"] });
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (e: Error) => toast.error(e.message),
    onSettled: () => setUploading(false),
  });

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("تم النسخ");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>الدفع بالتحويل البنكي</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
            <div className="text-sm text-muted-foreground">المبلغ المطلوب</div>
            <div className="text-3xl font-bold text-primary">{amount} {currency}</div>
          </div>

          <div>
            <Label className="mb-2 block">اختر حساباً للتحويل عليه:</Label>
            {!banks?.length && (
              <p className="text-sm text-muted-foreground py-4">لم يتم إضافة حسابات بنكية بعد. تواصل مع إدارة المنصة.</p>
            )}
            <div className="space-y-2">
              {banks?.map((b) => (
                <Card
                  key={b.id}
                  className={`p-4 cursor-pointer transition-all ${selectedBankId === b.id ? "border-primary border-2" : ""}`}
                  onClick={() => setSelectedBankId(b.id)}
                >
                  <div className="flex items-start gap-3">
                    <Building2 className="h-5 w-5 mt-1 text-muted-foreground" />
                    <div className="flex-1 space-y-1">
                      <div className="font-bold">{b.bank_name}</div>
                      <div className="text-sm">المستفيد: {b.account_holder}</div>
                      {b.iban && (
                        <div className="text-sm flex items-center gap-2">
                          IBAN: <code className="bg-muted px-2 py-0.5 rounded">{b.iban}</code>
                          <Button size="icon" variant="ghost" type="button" onClick={(e) => { e.stopPropagation(); copy(b.iban!); }}>
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                      {b.account_number && (
                        <div className="text-sm flex items-center gap-2">
                          رقم الحساب: <code className="bg-muted px-2 py-0.5 rounded">{b.account_number}</code>
                          <Button size="icon" variant="ghost" type="button" onClick={(e) => { e.stopPropagation(); copy(b.account_number!); }}>
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                      {b.notes && <div className="text-xs text-muted-foreground">{b.notes}</div>}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          <div>
            <Label htmlFor="receipt" className="mb-2 block">
              <Upload className="inline h-4 w-4 ml-1" />
              صورة إيصال التحويل *
            </Label>
            <Input
              id="receipt"
              type="file"
              accept="image/*,.pdf"
              onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)}
            />
          </div>

          <div>
            <Label htmlFor="notes" className="mb-2 block">ملاحظات (اختياري)</Label>
            <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="رقم العملية، تاريخ التحويل، أي تفاصيل..." />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button onClick={() => submit.mutate()} disabled={!receiptFile || submit.isPending || uploading}>
            {submit.isPending ? "جارٍ الإرسال..." : "إرسال طلب الدفع"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

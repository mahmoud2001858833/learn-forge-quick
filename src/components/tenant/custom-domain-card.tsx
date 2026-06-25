import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Copy, Globe, RefreshCw, Trash2, CheckCircle2, AlertCircle } from "lucide-react";
import {
  requestCustomDomain,
  removeCustomDomain,
  checkDomainDns,
} from "@/lib/custom-domain.functions";

type Tenant = {
  id: string;
  custom_domain: string | null;
  custom_domain_verified: boolean;
  custom_domain_verification_token: string | null;
};

export function CustomDomainCard({ tenant }: { tenant: Tenant }) {
  const qc = useQueryClient();
  const [input, setInput] = useState(tenant.custom_domain ?? "");
  const [lastCheck, setLastCheck] = useState<{ verified: boolean; records: string[] } | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["tenant"] });

  const requestM = useMutation({
    mutationFn: () => requestCustomDomain({ data: { tenant_id: tenant.id, domain: input.trim().toLowerCase() } }),
    onSuccess: () => { toast.success("تم تسجيل الدومين. أضف سجلات DNS ثم اضغط تحقّق."); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const checkM = useMutation({
    mutationFn: () => checkDomainDns({ data: { tenant_id: tenant.id } }),
    onSuccess: (res) => {
      setLastCheck(res);
      if (res.verified) toast.success("✓ تم التحقق من الدومين بنجاح");
      else toast.error("لم يُعثر على سجل TXT المطلوب بعد. قد يستغرق DNS حتى 24 ساعة.");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeM = useMutation({
    mutationFn: () => removeCustomDomain({ data: { tenant_id: tenant.id } }),
    onSuccess: () => { toast.success("تم إلغاء ربط الدومين"); setInput(""); setLastCheck(null); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const copy = (txt: string) => {
    navigator.clipboard.writeText(txt);
    toast.success("تم النسخ");
  };

  const hasPending = tenant.custom_domain && !tenant.custom_domain_verified;
  const isVerified = tenant.custom_domain && tenant.custom_domain_verified;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5" /> الدومين المخصص
        </CardTitle>
        <CardDescription>
          اربط دومينك الخاص (مثل academy.example.com) ليعمل بدلاً من رابط /t/{"<slug>"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isVerified && (
          <div className="flex items-center justify-between gap-3 p-3 rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-900">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <div>
                <div className="font-medium">{tenant.custom_domain}</div>
                <div className="text-xs text-muted-foreground">دومين مُفعَّل وموثَّق</div>
              </div>
            </div>
            <Badge variant="default" className="bg-green-600">نشط</Badge>
          </div>
        )}

        {hasPending && (
          <div className="flex items-center justify-between gap-3 p-3 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-600" />
              <div>
                <div className="font-medium">{tenant.custom_domain}</div>
                <div className="text-xs text-muted-foreground">بانتظار التحقق من DNS</div>
              </div>
            </div>
            <Badge variant="outline">معلّق</Badge>
          </div>
        )}

        {!tenant.custom_domain && (
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="academy.example.com"
              dir="ltr"
            />
            <Button onClick={() => requestM.mutate()} disabled={!input.trim() || requestM.isPending}>
              {requestM.isPending ? "جارٍ..." : "تسجيل الدومين"}
            </Button>
          </div>
        )}

        {tenant.custom_domain && tenant.custom_domain_verification_token && (
          <div className="space-y-3 pt-2 border-t">
            <div>
              <Label className="text-sm font-semibold mb-2 block">تعليمات إعداد DNS</Label>
              <p className="text-xs text-muted-foreground mb-3">
                أضف السجلين التاليين في لوحة إدارة دومينك:
              </p>
            </div>

            <DnsRow
              type="A"
              name={tenant.custom_domain}
              value="185.158.133.1"
              onCopy={copy}
            />
            <DnsRow
              type="TXT"
              name={`_lovable.${tenant.custom_domain}`}
              value={tenant.custom_domain_verification_token}
              onCopy={copy}
            />

            <div className="flex flex-wrap gap-2 pt-2">
              <Button onClick={() => checkM.mutate()} disabled={checkM.isPending} variant="default">
                <RefreshCw className={`h-4 w-4 ms-2 ${checkM.isPending ? "animate-spin" : ""}`} />
                {checkM.isPending ? "جارٍ الفحص..." : "تحقق من DNS"}
              </Button>
              <Button variant="outline" onClick={() => removeM.mutate()} disabled={removeM.isPending}>
                <Trash2 className="h-4 w-4 ms-2" /> إلغاء الربط
              </Button>
            </div>

            {lastCheck && lastCheck.records.length > 0 && (
              <div className="text-xs bg-muted/30 p-3 rounded-lg space-y-1">
                <div className="font-medium">سجلات TXT الموجودة حالياً:</div>
                {lastCheck.records.map((r, i) => (
                  <div key={i} className="font-mono text-[10px] break-all" dir="ltr">{r}</div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="text-xs text-muted-foreground pt-2 border-t">
          ملاحظة: بعد التحقق، قد يستغرق إصدار شهادة SSL حتى 30 دقيقة. يجب أن يكون الدومين فريداً ولا يستخدمه مشروع آخر.
        </div>
      </CardContent>
    </Card>
  );
}

function DnsRow({ type, name, value, onCopy }: { type: string; name: string; value: string; onCopy: (v: string) => void }) {
  return (
    <div className="grid grid-cols-[60px_1fr_1fr_auto] gap-2 items-center text-xs p-2 rounded-lg border bg-muted/20" dir="ltr">
      <Badge variant="secondary" className="justify-self-start">{type}</Badge>
      <div className="font-mono truncate" title={name}>{name}</div>
      <div className="font-mono truncate" title={value}>{value}</div>
      <Button size="sm" variant="ghost" onClick={() => onCopy(value)} className="h-7 w-7 p-0">
        <Copy className="h-3 w-3" />
      </Button>
    </div>
  );
}

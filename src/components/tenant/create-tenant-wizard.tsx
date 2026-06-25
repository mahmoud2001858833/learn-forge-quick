import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { createTenant } from "@/lib/tenants.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Plus, Check, ChevronRight, ChevronLeft, Sparkles, Palette, Settings2, Rocket } from "lucide-react";
import { cn } from "@/lib/utils";

type StepKey = "basics" | "branding" | "prefs" | "review";

const STEPS: { key: StepKey; title: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "basics", title: "الأساسيات", icon: Sparkles },
  { key: "branding", title: "الهوية البصرية", icon: Palette },
  { key: "prefs", title: "التفضيلات", icon: Settings2 },
  { key: "review", title: "مراجعة وإطلاق", icon: Rocket },
];

const PRESET_PALETTES = [
  { name: "بنفسجي ملكي", primary: "#6366f1", secondary: "#D4AF37" },
  { name: "أزرق محيطي", primary: "#0ea5e9", secondary: "#f59e0b" },
  { name: "زمردي", primary: "#10b981", secondary: "#fbbf24" },
  { name: "وردي عصري", primary: "#ec4899", secondary: "#8b5cf6" },
  { name: "أحمر جريء", primary: "#ef4444", secondary: "#1f2937" },
  { name: "أسود ذهبي", primary: "#111827", secondary: "#D4AF37" },
];

export function CreateTenantWizard() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);

  // Form state
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [primary_color, setPrimary] = useState("#6366f1");
  const [secondary_color, setSecondary] = useState("#D4AF37");
  const [currency, setCurrency] = useState("SAR");
  const [welcome_message, setWelcome] = useState("");

  useEffect(() => {
    if (!open) return;
    setSlug(
      name
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 40),
    );
  }, [name, open]);

  const reset = () => {
    setStepIdx(0);
    setName(""); setSlug(""); setDescription("");
    setPrimary("#6366f1"); setSecondary("#D4AF37");
    setCurrency("SAR"); setWelcome("");
  };

  const create = useMutation({
    mutationFn: () =>
      createTenant({
        data: { name, slug, primary_color, secondary_color, currency, description, welcome_message },
      }),
    onSuccess: (res) => {
      toast.success("تم إنشاء المنصة بنجاح!");
      qc.invalidateQueries({ queryKey: ["my-tenants"] });
      setOpen(false);
      reset();
      const createdSlug = res?.tenant?.slug;
      if (createdSlug) navigate({ to: "/admin/$tenantSlug", params: { tenantSlug: createdSlug } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canNext = () => {
    if (stepIdx === 0) return name.trim().length >= 2 && /^[a-z0-9-]{3,40}$/.test(slug);
    if (stepIdx === 1) return /^#[0-9a-f]{6}$/i.test(primary_color) && /^#[0-9a-f]{6}$/i.test(secondary_color);
    if (stepIdx === 2) return currency.trim().length >= 3;
    return true;
  };

  const current = STEPS[stepIdx];

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 ml-1" /> منصة جديدة
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <current.icon className="h-5 w-5 text-primary" />
            {current.title}
          </DialogTitle>
          <DialogDescription>
            الخطوة {stepIdx + 1} من {STEPS.length} لإطلاق منصتك التعليمية
          </DialogDescription>
        </DialogHeader>

        {/* Stepper */}
        <div className="flex items-center justify-between gap-2 px-1 py-2">
          {STEPS.map((s, i) => (
            <div key={s.key} className="flex items-center gap-2 flex-1">
              <div
                className={cn(
                  "h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold border-2 shrink-0",
                  i < stepIdx && "bg-primary text-primary-foreground border-primary",
                  i === stepIdx && "border-primary text-primary",
                  i > stepIdx && "border-muted text-muted-foreground",
                )}
              >
                {i < stepIdx ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={cn(
                    "h-0.5 flex-1 rounded",
                    i < stepIdx ? "bg-primary" : "bg-muted",
                  )}
                />
              )}
            </div>
          ))}
        </div>

        <div className="min-h-[320px] py-2">
          {current.key === "basics" && (
            <div className="space-y-4">
              <div>
                <Label>اسم المنصة *</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="أكاديمية الإبداع"
                  autoFocus
                />
              </div>
              <div>
                <Label>المعرّف (slug) *</Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">/t/</span>
                  <Input
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    pattern="[a-z0-9-]{3,40}"
                    placeholder="my-academy"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  3-40 حرفاً، أحرف إنجليزية صغيرة وأرقام وشرطات فقط
                </p>
              </div>
              <div>
                <Label>وصف قصير</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="منصة تعليمية لتعليم..."
                  rows={3}
                />
              </div>
            </div>
          )}

          {current.key === "branding" && (
            <div className="space-y-5">
              <div>
                <Label className="mb-2 block">قوالب جاهزة</Label>
                <div className="grid grid-cols-3 gap-2">
                  {PRESET_PALETTES.map((p) => {
                    const active = p.primary === primary_color && p.secondary === secondary_color;
                    return (
                      <button
                        key={p.name}
                        type="button"
                        onClick={() => { setPrimary(p.primary); setSecondary(p.secondary); }}
                        className={cn(
                          "p-3 rounded-lg border-2 text-right hover:bg-muted transition-colors",
                          active ? "border-primary ring-2 ring-primary/20" : "border-border",
                        )}
                      >
                        <div className="flex gap-1 mb-2">
                          <span className="w-6 h-6 rounded-full border" style={{ background: p.primary }} />
                          <span className="w-6 h-6 rounded-full border" style={{ background: p.secondary }} />
                        </div>
                        <p className="text-xs font-medium">{p.name}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>لون أساسي</Label>
                  <div className="flex gap-2">
                    <Input type="color" value={primary_color} onChange={(e) => setPrimary(e.target.value)} className="h-10 w-16 p-1" />
                    <Input value={primary_color} onChange={(e) => setPrimary(e.target.value)} />
                  </div>
                </div>
                <div>
                  <Label>لون ثانوي</Label>
                  <div className="flex gap-2">
                    <Input type="color" value={secondary_color} onChange={(e) => setSecondary(e.target.value)} className="h-10 w-16 p-1" />
                    <Input value={secondary_color} onChange={(e) => setSecondary(e.target.value)} />
                  </div>
                </div>
              </div>
              <div
                className="rounded-lg p-6 text-center border"
                style={{
                  background: `linear-gradient(135deg, ${primary_color}, ${secondary_color})`,
                }}
              >
                <p className="text-white font-bold text-lg drop-shadow">{name || "اسم المنصة"}</p>
                <p className="text-white/90 text-sm mt-1 drop-shadow">معاينة الهوية البصرية</p>
              </div>
            </div>
          )}

          {current.key === "prefs" && (
            <div className="space-y-4">
              <div>
                <Label>العملة *</Label>
                <div className="grid grid-cols-4 gap-2 mb-2">
                  {["SAR", "USD", "EUR", "EGP"].map((c) => (
                    <Button
                      key={c}
                      type="button"
                      variant={currency === c ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCurrency(c)}
                    >
                      {c}
                    </Button>
                  ))}
                </div>
                <Input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} maxLength={5} />
              </div>
              <div>
                <Label>رسالة ترحيبية للطلاب</Label>
                <Textarea
                  value={welcome_message}
                  onChange={(e) => setWelcome(e.target.value)}
                  placeholder="مرحباً بك في منصتنا! نتمنى لك تجربة تعلم رائعة..."
                  rows={4}
                />
                <p className="text-xs text-muted-foreground mt-1">اختياري — تظهر في الصفحة الرئيسية للمنصة</p>
              </div>
            </div>
          )}

          {current.key === "review" && (
            <div className="space-y-3">
              <ReviewRow label="اسم المنصة" value={name} />
              <ReviewRow label="الرابط" value={`/t/${slug}`} />
              {description && <ReviewRow label="الوصف" value={description} />}
              <ReviewRow
                label="الألوان"
                value={
                  <div className="flex gap-2 items-center">
                    <span className="w-5 h-5 rounded-full border" style={{ background: primary_color }} />
                    <span className="w-5 h-5 rounded-full border" style={{ background: secondary_color }} />
                    <span className="text-xs text-muted-foreground">{primary_color} / {secondary_color}</span>
                  </div>
                }
              />
              <ReviewRow label="العملة" value={currency} />
              {welcome_message && <ReviewRow label="رسالة الترحيب" value={welcome_message} />}
              <div className="rounded-lg bg-primary/5 border border-primary/20 p-4 mt-4">
                <p className="text-sm">
                  بالضغط على <strong>إطلاق المنصة</strong>، سيتم إنشاء المنصة وتفعيلها مباشرة. يمكنك تعديل كل شيء لاحقاً من الإعدادات.
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex !justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setStepIdx((i) => Math.max(0, i - 1))}
            disabled={stepIdx === 0 || create.isPending}
          >
            <ChevronRight className="h-4 w-4 ml-1" /> السابق
          </Button>
          {stepIdx < STEPS.length - 1 ? (
            <Button
              type="button"
              onClick={() => setStepIdx((i) => i + 1)}
              disabled={!canNext()}
            >
              التالي <ChevronLeft className="h-4 w-4 mr-1" />
            </Button>
          ) : (
            <Button type="button" onClick={() => create.mutate()} disabled={create.isPending}>
              <Rocket className="h-4 w-4 ml-1" />
              {create.isPending ? "جارٍ الإطلاق..." : "إطلاق المنصة"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReviewRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-start gap-4 py-2 border-b last:border-0">
      <span className="text-sm text-muted-foreground shrink-0">{label}</span>
      <div className="text-sm font-medium text-right">{value}</div>
    </div>
  );
}

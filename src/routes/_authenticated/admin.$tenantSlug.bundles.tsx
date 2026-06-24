import { createFileRoute, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Plus, Trash2, Package } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/$tenantSlug/bundles")({
  component: BundlesPage,
});

function BundlesPage() {
  const { tenantSlug } = useParams({ from: "/_authenticated/admin/$tenantSlug/bundles" });
  const qc = useQueryClient();

  const { data: tenant } = useQuery({
    queryKey: ["tenant", tenantSlug],
    queryFn: async () => (await supabase.from("tenants").select("id").eq("slug", tenantSlug).single()).data,
  });
  const tenantId = tenant?.id;

  const { data: bundles = [] } = useQuery({
    queryKey: ["bundles", tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("course_bundles")
        .select("*, bundle_courses(course_id, courses(id, title))")
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("course_bundles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["bundles", tenantId] }); toast.success("حُذف"); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!tenantId) return <div>جارٍ التحميل...</div>;

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Package className="h-7 w-7 text-primary" /> الحزم
          </h1>
          <p className="text-muted-foreground">جمّع عدة دورات في حزمة واحدة بسعر مخفّض</p>
        </div>
        <NewBundleDialog tenantId={tenantId} />
      </div>

      {bundles.length === 0 && (
        <Card><CardContent className="p-10 text-center text-muted-foreground">لا توجد حزم بعد</CardContent></Card>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {bundles.map((b) => (
          <Card key={b.id}>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">{b.name}</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">{b.description}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => { if (confirm("حذف الحزمة؟")) del.mutate(b.id); }}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between text-sm">
                <span className="font-bold">{b.price} ر.س</span>
                {b.discount_percent > 0 && <span className="text-green-600">خصم {b.discount_percent}%</span>}
              </div>
              <div className="mt-3 space-y-1">
                <p className="text-xs text-muted-foreground">الدورات:</p>
                <ul className="text-sm">
                  {b.bundle_courses?.map((bc: { course_id: string; courses: { id: string; title: string } | null }) => (
                    <li key={bc.course_id} className="text-muted-foreground">• {bc.courses?.title}</li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function NewBundleDialog({ tenantId }: { tenantId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [price, setPrice] = useState("0");
  const [discount, setDiscount] = useState("0");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data: courses = [] } = useQuery({
    queryKey: ["bundle-pickable-courses", tenantId, open],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses").select("id, title").eq("tenant_id", tenantId).order("title");
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { data: bundle, error } = await supabase
        .from("course_bundles")
        .insert({
          tenant_id: tenantId, name, description: desc,
          price: parseFloat(price) || 0, discount_percent: parseFloat(discount) || 0,
        })
        .select("id").single();
      if (error) throw error;
      if (selected.size > 0) {
        const rows = Array.from(selected).map((cid, i) => ({ bundle_id: bundle.id, course_id: cid, sort_order: i }));
        const { error: e2 } = await supabase.from("bundle_courses").insert(rows);
        if (e2) throw e2;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bundles", tenantId] });
      setOpen(false); setName(""); setDesc(""); setPrice("0"); setDiscount("0"); setSelected(new Set());
      toast.success("تم إنشاء الحزمة");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function toggle(id: string) {
    const s = new Set(selected);
    if (s.has(id)) s.delete(id); else s.add(id);
    setSelected(s);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="h-4 w-4 ml-1" /> حزمة جديدة</Button></DialogTrigger>
      <DialogContent dir="rtl" className="max-w-lg">
        <DialogHeader><DialogTitle>حزمة جديدة</DialogTitle></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); create.mutate(); }} className="space-y-3">
          <div><Label>اسم الحزمة</Label><Input required value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><Label>الوصف</Label><Textarea value={desc} onChange={(e) => setDesc(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>السعر</Label><Input type="number" min="0" value={price} onChange={(e) => setPrice(e.target.value)} /></div>
            <div><Label>نسبة الخصم %</Label><Input type="number" min="0" max="100" value={discount} onChange={(e) => setDiscount(e.target.value)} /></div>
          </div>
          <div>
            <Label>الدورات في الحزمة</Label>
            <div className="border rounded p-2 max-h-48 overflow-auto space-y-1">
              {courses.length === 0 && <p className="text-xs text-muted-foreground">لا توجد دورات</p>}
              {courses.map((c) => (
                <label key={c.id} className="flex items-center gap-2 text-sm p-1 hover:bg-accent rounded cursor-pointer">
                  <Checkbox checked={selected.has(c.id)} onCheckedChange={() => toggle(c.id)} />
                  {c.title}
                </label>
              ))}
            </div>
          </div>
          <DialogFooter><Button type="submit" disabled={create.isPending}>إنشاء</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Edit } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/$tenantSlug/courses")({
  component: CoursesPage,
});

function CoursesPage() {
  const { tenantSlug } = useParams({ from: "/_authenticated/admin/$tenantSlug/courses" });

  const { data: tenant } = useQuery({
    queryKey: ["tenant", tenantSlug],
    queryFn: async () => {
      const { data } = await supabase.from("tenants").select("*").eq("slug", tenantSlug).single();
      return data;
    },
  });

  const { data: courses } = useQuery({
    queryKey: ["tenant-courses", tenant?.id],
    enabled: !!tenant,
    queryFn: async () => {
      const { data, error } = await supabase.from("courses").select("*").eq("tenant_id", tenant!.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">الدورات</h1>
          <p className="text-muted-foreground">إدارة دورات منصتك</p>
        </div>
        {tenant && <NewCourseDialog tenantId={tenant.id} />}
      </div>

      {courses && courses.length === 0 && (
        <Card><CardContent className="p-10 text-center text-muted-foreground">لا توجد دورات. ابدأ بإضافة أول دورة.</CardContent></Card>
      )}

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {courses?.map((c) => (
          <Card key={c.id}>
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base">{c.title}</CardTitle>
                <Badge variant={c.status === "published" ? "default" : "secondary"}>
                  {c.status === "published" ? "منشور" : c.status === "draft" ? "مسودة" : "مؤرشف"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="flex justify-between items-center">
              <span className="text-sm font-medium">{c.price > 0 ? `${c.price} ر.س` : "مجاني"}</span>
              <Link to="/admin/$tenantSlug/courses/$courseId" params={{ tenantSlug, courseId: c.id }}>
                <Button variant="outline" size="sm"><Edit className="h-3 w-3 ml-1" /> تحرير</Button>
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function NewCourseDialog({ tenantId }: { tenantId: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("0");

  useEffect(() => {
    setSlug(title.toLowerCase().replace(/[^a-z0-9\u0600-\u06FF-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50));
  }, [title]);

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("courses").insert({
        tenant_id: tenantId, instructor_id: user!.id, title, slug, description, price: parseFloat(price) || 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم إنشاء الدورة");
      qc.invalidateQueries({ queryKey: ["tenant-courses"] });
      setOpen(false); setTitle(""); setSlug(""); setDescription(""); setPrice("0");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="h-4 w-4 ml-1" /> دورة جديدة</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>دورة جديدة</DialogTitle></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); create.mutate(); }} className="space-y-4">
          <div><Label>عنوان الدورة</Label><Input required value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div><Label>المعرّف</Label><Input required value={slug} onChange={(e) => setSlug(e.target.value)} /></div>
          <div><Label>الوصف</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          <div><Label>السعر (ر.س)</Label><Input type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} /></div>
          <DialogFooter><Button type="submit" disabled={create.isPending}>إنشاء</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

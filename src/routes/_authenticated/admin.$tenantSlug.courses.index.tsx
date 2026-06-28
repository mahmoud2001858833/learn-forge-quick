import { createFileRoute, useParams, useNavigate } from "@tanstack/react-router";
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
import { Plus, Edit, CheckCircle, XCircle, Clock, Video } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/$tenantSlug/courses/")({
  component: CoursesPage,
});

type CourseRow = {
  id: string;
  title: string;
  status: string;
  price: number;
  is_free: boolean;
  ad_style: number;
  instructor_id: string;
  approved_at: string | null;
  rejection_reason: string | null;
};

function CoursesPage() {
  const { tenantSlug } = useParams({ from: "/_authenticated/admin/$tenantSlug/courses" });
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: tenant } = useQuery({
    queryKey: ["tenant", tenantSlug],
    queryFn: async () => (await supabase.from("tenants").select("*").eq("slug", tenantSlug).single()).data,
  });

  const isOwner = !!user && !!tenant && tenant.owner_id === user.id;

  const { data: courses } = useQuery({
    queryKey: ["tenant-courses", tenant?.id],
    enabled: !!tenant,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("id, title, status, price, is_free, ad_style, instructor_id, approved_at, rejection_reason")
        .eq("tenant_id", tenant!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as CourseRow[];
    },
  });

  const approve = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("approve_course", { _course_id: id });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tenant-courses"] }); toast.success("تمت الموافقة على الدورة"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const reject = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { error } = await supabase.rpc("reject_course", { _course_id: id, _reason: reason });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tenant-courses"] }); toast.success("تم الرفض"); },
    onError: (e: Error) => toast.error(e.message),
  });

  function statusBadge(c: CourseRow) {
    if (c.status === "published") return <Badge className="bg-green-600">منشور</Badge>;
    if (c.status === "pending_approval") return <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-700"><Clock className="h-3 w-3 ml-1" />بانتظار الموافقة</Badge>;
    if (c.status === "archived") return <Badge variant="outline">مؤرشف</Badge>;
    return <Badge variant="secondary">مسودة</Badge>;
  }

  return (
    <div className="space-y-6" dir="rtl">
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
                {statusBadge(c)}
              </div>
              {c.rejection_reason && (
                <p className="text-xs text-destructive mt-1">سبب الرفض: {c.rejection_reason}</p>
              )}
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">{c.is_free || c.price === 0 ? "مجاني" : `${c.price} ر.س`}</span>
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate({ to: "/admin/$tenantSlug/courses/$courseId", params: { tenantSlug, courseId: c.id }, search: { upload: "1" } as never })}
                    title="رفع فيديو سريع"
                  >
                    <Video className="h-3 w-3 ml-1" /> فيديو
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => navigate({ to: "/admin/$tenantSlug/courses/$courseId", params: { tenantSlug, courseId: c.id } })}
                  >
                    <Edit className="h-3 w-3 ml-1" /> تحرير
                  </Button>
                </div>
              </div>
              {isOwner && c.status === "pending_approval" && (
                <div className="flex gap-2 pt-2 border-t">
                  <Button size="sm" className="flex-1" onClick={() => approve.mutate(c.id)} disabled={approve.isPending}>
                    <CheckCircle className="h-3 w-3 ml-1" /> موافقة
                  </Button>
                  <Button size="sm" variant="destructive" className="flex-1" onClick={() => {
                    const r = prompt("سبب الرفض:");
                    if (r) reject.mutate({ id: c.id, reason: r });
                  }} disabled={reject.isPending}>
                    <XCircle className="h-3 w-3 ml-1" /> رفض
                  </Button>
                </div>
              )}
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
        tenant_id: tenantId, instructor_id: user!.id, title, slug, description,
        price: parseFloat(price) || 0, is_free: parseFloat(price) === 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم إنشاء الدورة (مسودة)");
      qc.invalidateQueries({ queryKey: ["tenant-courses"] });
      setOpen(false); setTitle(""); setSlug(""); setDescription(""); setPrice("0");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="h-4 w-4 ml-1" /> دورة جديدة</Button></DialogTrigger>
      <DialogContent dir="rtl">
        <DialogHeader><DialogTitle>دورة جديدة</DialogTitle></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); create.mutate(); }} className="space-y-4">
          <div><Label>عنوان الدورة</Label><Input required value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div><Label>المعرّف</Label><Input required value={slug} onChange={(e) => setSlug(e.target.value)} /></div>
          <div><Label>الوصف</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          <div><Label>السعر (ر.س) — اكتب 0 لمجاني</Label><Input type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} /></div>
          <DialogFooter><Button type="submit" disabled={create.isPending}>إنشاء</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

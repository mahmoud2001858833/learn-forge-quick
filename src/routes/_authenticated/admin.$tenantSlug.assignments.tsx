import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Edit, Trash2, ClipboardCheck, Calendar, Award, Eye } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/$tenantSlug/assignments")({
  component: AssignmentsAdmin,
});

type A = {
  id: string;
  title: string;
  instructions: string | null;
  course_id: string;
  due_at: string | null;
  max_score: number;
  allow_late: boolean;
  attachment_url: string | null;
  is_published: boolean;
};

function AssignmentsAdmin() {
  const { tenantSlug } = useParams({ from: "/_authenticated/admin/$tenantSlug/assignments" });
  const qc = useQueryClient();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<A | null>(null);
  const [viewSubsId, setViewSubsId] = useState<string | null>(null);

  const { data: tenant } = useQuery({
    queryKey: ["tenant", tenantSlug],
    queryFn: async () => (await supabase.from("tenants").select("id").eq("slug", tenantSlug).single()).data,
  });

  const { data: courses } = useQuery({
    enabled: !!tenant?.id,
    queryKey: ["tenant-courses-list", tenant?.id],
    queryFn: async () => (await supabase.from("courses").select("id, title").eq("tenant_id", tenant!.id)).data ?? [],
  });

  const { data: assignments, refetch } = useQuery({
    enabled: !!tenant?.id,
    queryKey: ["assignments", tenant?.id],
    queryFn: async () => {
      const { data } = await supabase.from("assignments").select("*").eq("tenant_id", tenant!.id).order("created_at", { ascending: false });
      return (data ?? []) as A[];
    },
  });

  async function remove(id: string) {
    if (!confirm("حذف الواجب نهائياً؟")) return;
    const { error } = await supabase.from("assignments").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("حُذف"); refetch();
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-3xl font-bold">الواجبات</h1>
          <p className="text-muted-foreground">أنشئ واجبات وقيّم تسليمات الطلاب.</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
          <DialogTrigger asChild><Button onClick={() => setEditing(null)}><Plus className="h-4 w-4 ms-1" /> واجب جديد</Button></DialogTrigger>
          <AForm key={editing?.id ?? "new"} tenantId={tenant?.id} userId={user?.id} courses={courses ?? []} editing={editing} onDone={() => { setOpen(false); setEditing(null); qc.invalidateQueries({ queryKey: ["assignments"] }); }} />
        </Dialog>
      </div>

      <div className="grid gap-3">
        {assignments?.length === 0 && (
          <Card><CardContent className="py-12 text-center text-muted-foreground">
            <ClipboardCheck className="h-10 w-10 mx-auto mb-2 opacity-40" />
            لا توجد واجبات بعد.
          </CardContent></Card>
        )}
        {assignments?.map((a) => {
          const course = courses?.find((c) => c.id === a.course_id);
          const overdue = a.due_at && new Date(a.due_at) < new Date();
          return (
            <Card key={a.id}>
              <CardContent className="p-4 flex items-start gap-3 flex-wrap">
                <div className="flex-1 min-w-[260px]">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h3 className="font-bold">{a.title}</h3>
                    {!a.is_published && <Badge variant="secondary">مسوّدة</Badge>}
                    {a.due_at && <Badge variant={overdue ? "destructive" : "outline"} className="text-xs"><Calendar className="h-3 w-3 ms-1" />{new Date(a.due_at).toLocaleDateString("ar-EG")}</Badge>}
                    <Badge variant="outline" className="text-xs"><Award className="h-3 w-3 ms-1" />{a.max_score} نقطة</Badge>
                  </div>
                  {course && <p className="text-xs text-muted-foreground">📚 {course.title}</p>}
                  {a.instructions && <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{a.instructions}</p>}
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => setViewSubsId(a.id)}><Eye className="h-4 w-4 ms-1" /> تسليمات</Button>
                  <Button size="sm" variant="ghost" onClick={() => { setEditing(a); setOpen(true); }}><Edit className="h-4 w-4" /></Button>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(a.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={!!viewSubsId} onOpenChange={(v) => !v && setViewSubsId(null)}>
        {viewSubsId && <SubmissionsView assignmentId={viewSubsId} />}
      </Dialog>
    </div>
  );
}

function AForm({ tenantId, userId, courses, editing, onDone }: {
  tenantId?: string; userId?: string; courses: { id: string; title: string }[];
  editing: A | null; onDone: () => void;
}) {
  const [title, setTitle] = useState(editing?.title ?? "");
  const [instructions, setInstructions] = useState(editing?.instructions ?? "");
  const [courseId, setCourseId] = useState(editing?.course_id ?? "");
  const [dueAt, setDueAt] = useState(editing?.due_at ? new Date(editing.due_at).toISOString().slice(0, 16) : "");
  const [maxScore, setMaxScore] = useState(editing?.max_score ?? 100);
  const [allowLate, setAllowLate] = useState(editing?.allow_late ?? true);
  const [attachmentUrl, setAttachmentUrl] = useState(editing?.attachment_url ?? "");
  const [isPublished, setIsPublished] = useState(editing?.is_published ?? true);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!tenantId || !title || !courseId) return toast.error("املأ الحقول المطلوبة");
    setBusy(true);
    const payload = {
      tenant_id: tenantId, title, instructions: instructions || null, course_id: courseId,
      due_at: dueAt ? new Date(dueAt).toISOString() : null,
      max_score: Number(maxScore) || 100, allow_late: allowLate,
      attachment_url: attachmentUrl || null, is_published: isPublished,
      created_by: userId ?? null,
    };
    const { error } = editing
      ? await supabase.from("assignments").update(payload).eq("id", editing.id)
      : await supabase.from("assignments").insert(payload);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(editing ? "تم التحديث" : "تم الإنشاء");
    onDone();
  }

  return (
    <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>{editing ? "تعديل الواجب" : "واجب جديد"}</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div><Label>العنوان *</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
        <div><Label>التعليمات</Label><Textarea value={instructions ?? ""} onChange={(e) => setInstructions(e.target.value)} rows={4} /></div>
        <div>
          <Label>الدورة *</Label>
          <Select value={courseId} onValueChange={setCourseId}>
            <SelectTrigger><SelectValue placeholder="اختر دورة" /></SelectTrigger>
            <SelectContent>{courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div><Label>تاريخ التسليم</Label><Input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} /></div>
          <div><Label>الدرجة الكاملة</Label><Input type="number" min={1} value={maxScore} onChange={(e) => setMaxScore(Number(e.target.value))} /></div>
        </div>
        <div><Label>رابط مرفق (اختياري)</Label><Input value={attachmentUrl ?? ""} onChange={(e) => setAttachmentUrl(e.target.value)} placeholder="https://..." /></div>
        <div className="flex items-center justify-between"><Label>السماح بالتسليم المتأخر</Label><Switch checked={allowLate} onCheckedChange={setAllowLate} /></div>
        <div className="flex items-center justify-between"><Label>منشور للطلاب</Label><Switch checked={isPublished} onCheckedChange={setIsPublished} /></div>
      </div>
      <DialogFooter><Button onClick={save} disabled={busy}>{busy ? "جارٍ الحفظ..." : "حفظ"}</Button></DialogFooter>
    </DialogContent>
  );
}

function SubmissionsView({ assignmentId }: { assignmentId: string }) {
  const qc = useQueryClient();
  const { data, refetch } = useQuery({
    queryKey: ["subs", assignmentId],
    queryFn: async () => {
      const { data: subs } = await supabase.from("assignment_submissions").select("*").eq("assignment_id", assignmentId).order("submitted_at", { ascending: false });
      const ids = (subs ?? []).map((s: any) => s.student_id);
      const { data: profs } = ids.length ? await supabase.from("profiles").select("id, full_name, avatar_url").in("id", ids) : { data: [] as any[] };
      const map = new Map((profs ?? []).map((p: any) => [p.id, p]));
      return (subs ?? []).map((s: any) => ({ ...s, profile: map.get(s.student_id) }));
    },
  });

  const [tab, setTab] = useState("pending");

  async function grade(id: string, score: number, feedback: string) {
    const { error } = await supabase.from("assignment_submissions").update({
      score, feedback, status: "graded", graded_at: new Date().toISOString(),
    }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("تم التقييم"); refetch();
    qc.invalidateQueries({ queryKey: ["subs"] });
  }

  const pending = data?.filter((s: any) => s.status !== "graded") ?? [];
  const graded = data?.filter((s: any) => s.status === "graded") ?? [];

  return (
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>تسليمات الواجب ({data?.length ?? 0})</DialogTitle></DialogHeader>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList><TabsTrigger value="pending">بانتظار التقييم ({pending.length})</TabsTrigger><TabsTrigger value="graded">مُقيّمة ({graded.length})</TabsTrigger></TabsList>
        <TabsContent value="pending" className="space-y-2">
          {pending.length === 0 && <p className="text-center text-sm text-muted-foreground py-6">لا شيء بانتظار التقييم</p>}
          {pending.map((s: any) => <SubCard key={s.id} sub={s} onGrade={grade} />)}
        </TabsContent>
        <TabsContent value="graded" className="space-y-2">
          {graded.length === 0 && <p className="text-center text-sm text-muted-foreground py-6">لا تسليمات مُقيّمة</p>}
          {graded.map((s: any) => <SubCard key={s.id} sub={s} onGrade={grade} />)}
        </TabsContent>
      </Tabs>
    </DialogContent>
  );
}

function SubCard({ sub, onGrade }: { sub: any; onGrade: (id: string, score: number, fb: string) => void }) {
  const [score, setScore] = useState(sub.score ?? 0);
  const [feedback, setFeedback] = useState(sub.feedback ?? "");
  return (
    <Card>
      <CardContent className="p-3 space-y-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="font-semibold">{sub.profile?.full_name ?? "طالب"}</div>
          <div className="text-xs text-muted-foreground">{sub.submitted_at ? new Date(sub.submitted_at).toLocaleString("ar-EG") : ""}</div>
        </div>
        {sub.content && <div className="text-sm whitespace-pre-wrap bg-muted/40 p-2 rounded">{sub.content}</div>}
        {sub.file_url && <a href={sub.file_url} target="_blank" rel="noreferrer" className="text-xs text-primary underline">📎 ملف مرفق</a>}
        <div className="grid grid-cols-[100px_1fr_auto] gap-2 items-end">
          <div><Label className="text-xs">الدرجة</Label><Input type="number" value={score} onChange={(e) => setScore(Number(e.target.value))} /></div>
          <div><Label className="text-xs">ملاحظات</Label><Input value={feedback} onChange={(e) => setFeedback(e.target.value)} /></div>
          <Button size="sm" onClick={() => onGrade(sub.id, score, feedback)}>{sub.status === "graded" ? "تحديث" : "تقييم"}</Button>
        </div>
      </CardContent>
    </Card>
  );
}

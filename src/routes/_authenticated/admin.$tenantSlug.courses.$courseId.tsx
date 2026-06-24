import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Trash2, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/$tenantSlug/courses/$courseId")({
  component: CourseEditor,
});

function CourseEditor() {
  const { tenantSlug, courseId } = useParams({ from: "/_authenticated/admin/$tenantSlug/courses/$courseId" });
  const qc = useQueryClient();

  const { data: course } = useQuery({
    queryKey: ["course", courseId],
    queryFn: async () => {
      const { data, error } = await supabase.from("courses").select("*").eq("id", courseId).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: sections } = useQuery({
    queryKey: ["course-sections", courseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sections")
        .select("*, lessons(*)")
        .eq("course_id", courseId)
        .order("order_index");
      if (error) throw error;
      return data;
    },
  });

  const togglePublish = useMutation({
    mutationFn: async () => {
      const newStatus = course?.status === "published" ? "draft" : "published";
      const { error } = await supabase.from("courses").update({ status: newStatus }).eq("id", courseId);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["course", courseId] }); toast.success("تم التحديث"); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!course) return <div>جارٍ التحميل...</div>;

  return (
    <div className="space-y-6 max-w-4xl">
      <Link to="/admin/$tenantSlug/courses" params={{ tenantSlug }} className="text-sm text-muted-foreground flex items-center gap-1 hover:text-foreground">
        <ArrowRight className="h-3 w-3" /> العودة للدورات
      </Link>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{course.title}</h1>
          <p className="text-muted-foreground text-sm">{course.description}</p>
        </div>
        <Button onClick={() => togglePublish.mutate()} variant={course.status === "published" ? "outline" : "default"}>
          {course.status === "published" ? "إلغاء النشر" : "نشر الدورة"}
        </Button>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">الفصول والدروس</h2>
        <NewSectionDialog courseId={courseId} />
      </div>

      <div className="space-y-4">
        {sections?.map((s) => <SectionCard key={s.id} section={s} />)}
      </div>
    </div>
  );
}

function NewSectionDialog({ courseId }: { courseId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("sections").insert({ course_id: courseId, title });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["course-sections"] }); setOpen(false); setTitle(""); toast.success("تم"); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 ml-1" /> فصل جديد</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>فصل جديد</DialogTitle></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); create.mutate(); }} className="space-y-4">
          <div><Label>عنوان الفصل</Label><Input required value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <DialogFooter><Button type="submit" disabled={create.isPending}>إضافة</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type SectionWithLessons = { id: string; title: string; lessons: Array<{ id: string; title: string; type: string; is_preview: boolean; content_url: string | null }> };

function SectionCard({ section }: { section: SectionWithLessons }) {
  const qc = useQueryClient();
  const del = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("sections").delete().eq("id", section.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["course-sections"] }); toast.success("حُذف"); },
  });
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">{section.title}</CardTitle>
        <div className="flex gap-2">
          <NewLessonDialog sectionId={section.id} />
          <Button variant="ghost" size="sm" onClick={() => del.mutate()}><Trash2 className="h-4 w-4" /></Button>
        </div>
      </CardHeader>
      <CardContent>
        {section.lessons.length === 0 && <p className="text-sm text-muted-foreground">لا توجد دروس</p>}
        <ul className="space-y-2">
          {section.lessons.map((l) => (
            <li key={l.id} className="flex items-center justify-between p-2 bg-muted/40 rounded text-sm">
              <span>{l.title} {l.is_preview && <span className="text-xs text-primary">(معاينة)</span>}</span>
              <DeleteLessonBtn id={l.id} />
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function DeleteLessonBtn({ id }: { id: string }) {
  const qc = useQueryClient();
  const del = useMutation({
    mutationFn: async () => { const { error } = await supabase.from("lessons").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["course-sections"] }),
  });
  return <Button variant="ghost" size="sm" onClick={() => del.mutate()}><Trash2 className="h-3 w-3" /></Button>;
}

function NewLessonDialog({ sectionId }: { sectionId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<"video" | "text" | "pdf">("video");
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [isPreview, setIsPreview] = useState(false);

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("lessons").insert({
        section_id: sectionId, title, type,
        content_url: type !== "text" ? url : null,
        content_text: type === "text" ? text : null,
        is_preview: isPreview,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["course-sections"] });
      setOpen(false); setTitle(""); setUrl(""); setText(""); setIsPreview(false);
      toast.success("تمت إضافة الدرس");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="outline"><Plus className="h-3 w-3 ml-1" /> درس</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>درس جديد</DialogTitle></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); create.mutate(); }} className="space-y-4">
          <div><Label>عنوان الدرس</Label><Input required value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div>
            <Label>النوع</Label>
            <Select value={type} onValueChange={(v) => setType(v as "video" | "text" | "pdf")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="video">فيديو</SelectItem>
                <SelectItem value="text">نص</SelectItem>
                <SelectItem value="pdf">PDF</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {type !== "text" ? (
            <div><Label>رابط {type === "video" ? "الفيديو (YouTube/MP4)" : "الملف"}</Label><Input required value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." /></div>
          ) : (
            <div><Label>المحتوى</Label><Textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} /></div>
          )}
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isPreview} onChange={(e) => setIsPreview(e.target.checked)} />
            متاح كمعاينة مجانية
          </label>
          <DialogFooter><Button type="submit" disabled={create.isPending}>إضافة</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

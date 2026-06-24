import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { generateCourseImage } from "@/lib/courses.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Trash2, ArrowRight, Sparkles, Send, QrCode } from "lucide-react";
import { CourseCard } from "@/components/course-card";

export const Route = createFileRoute("/_authenticated/admin/$tenantSlug/courses/$courseId")({
  component: CourseEditor,
});

function CourseEditor() {
  const { tenantSlug, courseId } = useParams({ from: "/_authenticated/admin/$tenantSlug/courses/$courseId" });
  const qc = useQueryClient();
  const genImg = useServerFn(generateCourseImage);

  const { data: course } = useQuery({
    queryKey: ["course", courseId],
    queryFn: async () => (await supabase.from("courses").select("*").eq("id", courseId).single()).data,
  });

  const { data: sections } = useQuery({
    queryKey: ["course-sections", courseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sections").select("*, lessons(*)").eq("course_id", courseId).order("order_index");
      if (error) throw error;
      return data;
    },
  });

  const update = useMutation({
    mutationFn: async (patch: Partial<Record<string, string | number | boolean | null>>) => {
      const { error } = await supabase.from("courses").update(patch).eq("id", courseId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["course", courseId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const submitForApproval = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("courses").update({ status: "pending_approval" }).eq("id", courseId);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["course", courseId] }); toast.success("تم إرسال الدورة للموافقة"); },
    onError: (e: Error) => toast.error(e.message),
  });

  async function onGenerateImage() {
    const prompt = course?.ai_image_prompt || course?.title;
    if (!prompt) return toast.error("أدخل وصفاً أو عنواناً أولاً");
    toast.info("جارٍ توليد الصورة...");
    try {
      const { image_url } = await genImg({ data: { prompt } });
      await update.mutateAsync({ cover_url: image_url });
      toast.success("تم توليد الصورة");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل التوليد");
    }
  }

  function generateQrCode() {
    const storeUrl = `${window.location.origin}/t/${tenantSlug}/courses/${course?.slug}`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(storeUrl)}`;
    update.mutate({ qr_code_url: qrUrl });
    toast.success("تم توليد QR");
  }

  if (!course) return <div>جارٍ التحميل...</div>;

  return (
    <div className="space-y-6 max-w-5xl" dir="rtl">
      <Link to="/admin/$tenantSlug/courses" params={{ tenantSlug }} className="text-sm text-muted-foreground flex items-center gap-1 hover:text-foreground">
        <ArrowRight className="h-3 w-3" /> العودة للدورات
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <h1 className="text-3xl font-bold">{course.title}</h1>
          <Badge variant={course.status === "published" ? "default" : "secondary"} className="mt-2">{course.status}</Badge>
          {course.rejection_reason && <p className="text-sm text-destructive mt-2">سبب الرفض: {course.rejection_reason}</p>}
        </div>
        <div className="flex gap-2">
          {course.status === "draft" && (
            <Button onClick={() => submitForApproval.mutate()}><Send className="h-4 w-4 ml-1" /> إرسال للموافقة</Button>
          )}
          {course.status === "published" && (
            <Button variant="outline" onClick={() => update.mutate({ status: "draft" })}>إلغاء النشر</Button>
          )}
        </div>
      </div>

      {/* Settings */}
      <Card>
        <CardHeader><CardTitle className="text-base">إعدادات الدورة</CardTitle></CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <Label>وصف قصير (سطر واحد للبطاقة)</Label>
            <Input defaultValue={course.short_description ?? ""} onBlur={(e) => update.mutate({ short_description: e.target.value })} />
          </div>
          <div className="md:col-span-2">
            <Label>الوصف التفصيلي</Label>
            <Textarea defaultValue={course.description ?? ""} rows={4} onBlur={(e) => update.mutate({ description: e.target.value })} />
          </div>
          <div>
            <Label>السعر</Label>
            <Input type="number" min="0" step="0.01" defaultValue={course.price}
              onBlur={(e) => update.mutate({ price: parseFloat(e.target.value) || 0, is_free: parseFloat(e.target.value) === 0 })} />
          </div>
          <div className="flex items-end gap-2">
            <Switch checked={course.is_free} onCheckedChange={(v) => update.mutate({ is_free: v, price: v ? 0 : course.price })} />
            <Label>دورة مجانية</Label>
          </div>
          <div>
            <Label>شكل العرض (1-6)</Label>
            <Select value={String(course.ad_style)} onValueChange={(v) => update.mutate({ ad_style: parseInt(v) })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {[1,2,3,4,5,6].map((n) => <SelectItem key={n} value={String(n)}>الشكل {n}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>رابط الغلاف</Label>
            <Input defaultValue={course.cover_url ?? ""} onBlur={(e) => update.mutate({ cover_url: e.target.value })} placeholder="https://..." />
          </div>
          <div className="md:col-span-2">
            <Label>وصف لتوليد صورة الغلاف بالذكاء الاصطناعي</Label>
            <div className="flex gap-2">
              <Input defaultValue={course.ai_image_prompt ?? ""} onBlur={(e) => update.mutate({ ai_image_prompt: e.target.value })} placeholder="مثلاً: لوحة مفاتيح وكتب برمجة بألوان داكنة" />
              <Button type="button" variant="secondary" onClick={onGenerateImage}>
                <Sparkles className="h-4 w-4 ml-1" /> توليد
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Preview card */}
      <Card>
        <CardHeader><CardTitle className="text-base">معاينة البطاقة</CardTitle></CardHeader>
        <CardContent>
          <div className="max-w-sm">
            <CourseCard
              tenantSlug={tenantSlug}
              course={{
                id: course.id, slug: course.slug, title: course.title,
                short_description: course.short_description, description: course.description,
                cover_url: course.cover_url, price: course.price, is_free: course.is_free,
                ad_style: course.ad_style, students_count: course.students_count,
                total_duration_seconds: course.total_duration_seconds,
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* QR */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <QrCode className="h-4 w-4" /> رمز QR
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-4">
          {course.qr_code_url && <img src={course.qr_code_url} alt="QR" className="w-32 h-32 border rounded" />}
          <Button variant="outline" onClick={generateQrCode}>توليد / تحديث QR</Button>
        </CardContent>
      </Card>

      {/* Sections */}
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
      <DialogContent dir="rtl">
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
    mutationFn: async () => { const { error } = await supabase.from("sections").delete().eq("id", section.id); if (error) throw error; },
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
              <span>{l.title} {l.is_preview && <span className="text-xs text-primary">(معاينة مجانية)</span>}</span>
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
      <DialogContent dir="rtl">
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
            <div><Label>الرابط</Label><Input required value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." /></div>
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

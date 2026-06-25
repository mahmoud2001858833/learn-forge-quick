import { createFileRoute, useParams } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Edit, Library, Check, X, Search } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/$tenantSlug/question-bank")({
  component: QuestionBank,
});

type BankQ = {
  id: string;
  question_text: string;
  question_type: "mcq" | "true_false" | "short_answer";
  points: number;
  explanation: string | null;
  tags: string[];
  difficulty: "easy" | "medium" | "hard";
  course_id: string | null;
};
type Choice = { id?: string; choice_text: string; is_correct: boolean; order_index: number };

function QuestionBank() {
  const { tenantSlug } = useParams({ from: "/_authenticated/admin/$tenantSlug/question-bank" });
  const qc = useQueryClient();
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [diff, setDiff] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<BankQ | null>(null);

  const { data: tenant } = useQuery({
    queryKey: ["tenant", tenantSlug],
    queryFn: async () => (await supabase.from("tenants").select("id").eq("slug", tenantSlug).single()).data,
  });

  const { data: courses } = useQuery({
    enabled: !!tenant?.id,
    queryKey: ["tenant-courses-list", tenant?.id],
    queryFn: async () => (await supabase.from("courses").select("id, title").eq("tenant_id", tenant!.id)).data ?? [],
  });

  const { data: questions, refetch } = useQuery({
    enabled: !!tenant?.id,
    queryKey: ["bank", tenant?.id, q, diff],
    queryFn: async () => {
      let req = supabase.from("question_bank").select("*").eq("tenant_id", tenant!.id).order("created_at", { ascending: false });
      if (q) req = req.ilike("question_text", `%${q}%`);
      if (diff !== "all") req = req.eq("difficulty", diff);
      const { data } = await req;
      return (data ?? []) as BankQ[];
    },
  });

  async function remove(id: string) {
    if (!confirm("حذف السؤال؟")) return;
    const { error } = await supabase.from("question_bank").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("حُذف");
    refetch();
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-3xl font-bold">بنك الأسئلة</h1>
          <p className="text-muted-foreground">أسئلة قابلة لإعادة الاستخدام في الاختبارات.</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditing(null)}><Plus className="h-4 w-4 ms-1" /> سؤال جديد</Button>
          </DialogTrigger>
          <QForm key={editing?.id ?? "new"} tenantId={tenant?.id} userId={user?.id} courses={courses ?? []} editing={editing} onDone={() => { setOpen(false); setEditing(null); qc.invalidateQueries({ queryKey: ["bank"] }); }} />
        </Dialog>
      </div>

      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="h-4 w-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث في الأسئلة..." className="ps-3 pe-9" />
        </div>
        <Select value={diff} onValueChange={setDiff}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الصعوبات</SelectItem>
            <SelectItem value="easy">سهل</SelectItem>
            <SelectItem value="medium">متوسط</SelectItem>
            <SelectItem value="hard">صعب</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-2">
        {questions?.length === 0 && (
          <Card><CardContent className="py-10 text-center text-muted-foreground">
            <Library className="h-10 w-10 mx-auto mb-2 opacity-40" />
            لا توجد أسئلة بعد. ابدأ بإضافة سؤال جديد.
          </CardContent></Card>
        )}
        {questions?.map((bq) => (
          <Card key={bq.id}>
            <CardContent className="p-4 flex items-start justify-between gap-3">
              <div className="flex-1">
                <p className="font-medium">{bq.question_text}</p>
                <div className="flex items-center gap-2 mt-2 flex-wrap text-xs">
                  <Badge variant="outline">{bq.question_type === "mcq" ? "اختيار من متعدد" : bq.question_type === "true_false" ? "صح/خطأ" : "إجابة قصيرة"}</Badge>
                  <Badge variant="secondary">{bq.points} نقطة</Badge>
                  <Badge className={bq.difficulty === "easy" ? "bg-emerald-500/15 text-emerald-700" : bq.difficulty === "hard" ? "bg-red-500/15 text-red-700" : "bg-amber-500/15 text-amber-700"}>{bq.difficulty === "easy" ? "سهل" : bq.difficulty === "hard" ? "صعب" : "متوسط"}</Badge>
                  {bq.tags?.map((t) => <Badge key={t} variant="outline" className="text-[10px]">#{t}</Badge>)}
                </div>
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => { setEditing(bq); setOpen(true); }}><Edit className="h-4 w-4" /></Button>
                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(bq.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function QForm({ tenantId, userId, courses, editing, onDone }: {
  tenantId?: string; userId?: string;
  courses: { id: string; title: string }[];
  editing: BankQ | null; onDone: () => void;
}) {
  const [text, setText] = useState(editing?.question_text ?? "");
  const [type, setType] = useState<BankQ["question_type"]>(editing?.question_type ?? "mcq");
  const [points, setPoints] = useState(editing?.points ?? 1);
  const [explanation, setExplanation] = useState(editing?.explanation ?? "");
  const [tagsStr, setTagsStr] = useState((editing?.tags ?? []).join(", "));
  const [difficulty, setDifficulty] = useState<BankQ["difficulty"]>(editing?.difficulty ?? "medium");
  const [courseId, setCourseId] = useState(editing?.course_id ?? "none");
  const [choices, setChoices] = useState<Choice[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (editing?.id) {
      supabase.from("question_bank_choices").select("*").eq("question_id", editing.id).order("order_index").then(({ data }) => {
        setChoices((data ?? []) as any);
      });
    } else if (type === "true_false") {
      setChoices([{ choice_text: "صح", is_correct: true, order_index: 0 }, { choice_text: "خطأ", is_correct: false, order_index: 1 }]);
    } else if (type === "mcq" && choices.length === 0) {
      setChoices([{ choice_text: "", is_correct: true, order_index: 0 }, { choice_text: "", is_correct: false, order_index: 1 }]);
    } else if (type === "short_answer") {
      setChoices([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing?.id, type]);

  function addChoice() { setChoices([...choices, { choice_text: "", is_correct: false, order_index: choices.length }]); }
  function updateChoice(i: number, patch: Partial<Choice>) { setChoices(choices.map((c, idx) => idx === i ? { ...c, ...patch } : c)); }
  function removeChoice(i: number) { setChoices(choices.filter((_, idx) => idx !== i)); }

  async function save() {
    if (!tenantId || !text.trim()) return toast.error("اكتب السؤال");
    if (type !== "short_answer" && !choices.some((c) => c.is_correct)) return toast.error("حدد الإجابة الصحيحة");

    setBusy(true);
    const payload = {
      tenant_id: tenantId,
      question_text: text,
      question_type: type,
      points: Number(points) || 1,
      explanation: explanation || null,
      tags: tagsStr.split(",").map((t) => t.trim()).filter(Boolean),
      difficulty,
      course_id: courseId === "none" ? null : courseId,
      created_by: userId ?? null,
    };

    let qId = editing?.id;
    if (editing) {
      const { error } = await supabase.from("question_bank").update(payload).eq("id", editing.id);
      if (error) { setBusy(false); return toast.error(error.message); }
      await supabase.from("question_bank_choices").delete().eq("question_id", editing.id);
    } else {
      const { data, error } = await supabase.from("question_bank").insert(payload).select("id").single();
      if (error) { setBusy(false); return toast.error(error.message); }
      qId = data.id;
    }

    if (type !== "short_answer" && qId) {
      const rows = choices.filter((c) => c.choice_text.trim()).map((c, i) => ({ question_id: qId, choice_text: c.choice_text, is_correct: c.is_correct, order_index: i }));
      if (rows.length) {
        const { error } = await supabase.from("question_bank_choices").insert(rows);
        if (error) { setBusy(false); return toast.error(error.message); }
      }
    }

    setBusy(false);
    toast.success(editing ? "تم التحديث" : "تمت الإضافة");
    onDone();
  }

  return (
    <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>{editing ? "تعديل سؤال" : "سؤال جديد"}</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div><Label>نص السؤال *</Label><Textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} /></div>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <Label>النوع</Label>
            <Select value={type} onValueChange={(v) => setType(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="mcq">اختيار من متعدد</SelectItem>
                <SelectItem value="true_false">صح / خطأ</SelectItem>
                <SelectItem value="short_answer">إجابة قصيرة</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>الصعوبة</Label>
            <Select value={difficulty} onValueChange={(v) => setDifficulty(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="easy">سهل</SelectItem>
                <SelectItem value="medium">متوسط</SelectItem>
                <SelectItem value="hard">صعب</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>النقاط</Label><Input type="number" min={1} value={points} onChange={(e) => setPoints(Number(e.target.value))} /></div>
        </div>
        <div>
          <Label>الدورة (اختياري)</Label>
          <Select value={courseId} onValueChange={setCourseId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">عام</SelectItem>
              {courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div><Label>وسوم (مفصولة بفواصل)</Label><Input value={tagsStr} onChange={(e) => setTagsStr(e.target.value)} placeholder="رياضيات, جبر" /></div>

        {type !== "short_answer" && (
          <div>
            <div className="flex items-center justify-between mb-2"><Label>الخيارات</Label>
              {type === "mcq" && <Button size="sm" variant="outline" onClick={addChoice}><Plus className="h-3 w-3 ms-1" />إضافة</Button>}
            </div>
            <div className="space-y-2">
              {choices.map((c, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Button size="sm" variant={c.is_correct ? "default" : "outline"} onClick={() => {
                    if (type === "true_false") setChoices(choices.map((x, idx) => ({ ...x, is_correct: idx === i })));
                    else updateChoice(i, { is_correct: !c.is_correct });
                  }}>
                    {c.is_correct ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                  </Button>
                  <Input value={c.choice_text} onChange={(e) => updateChoice(i, { choice_text: e.target.value })} disabled={type === "true_false"} />
                  {type === "mcq" && choices.length > 2 && <Button size="sm" variant="ghost" onClick={() => removeChoice(i)}><Trash2 className="h-4 w-4" /></Button>}
                </div>
              ))}
            </div>
          </div>
        )}

        <div><Label>تفسير الإجابة (اختياري)</Label><Textarea value={explanation ?? ""} onChange={(e) => setExplanation(e.target.value)} rows={2} /></div>
      </div>
      <DialogFooter><Button onClick={save} disabled={busy}>{busy ? "جارٍ الحفظ..." : "حفظ"}</Button></DialogFooter>
    </DialogContent>
  );
}

import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Edit, ArrowRight, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/$tenantSlug/courses/$courseId/quizzes")({
  component: QuizzesAdminPage,
});

type QuizForm = {
  id?: string;
  title: string;
  description: string;
  passing_score: number;
  attempts_limit: number | null;
  time_limit_minutes: number | null;
  is_final: boolean;
  is_active: boolean;
};

const EMPTY_QUIZ: QuizForm = {
  title: "", description: "", passing_score: 60,
  attempts_limit: null, time_limit_minutes: null,
  is_final: false, is_active: true,
};

type Choice = { id?: string; text: string; is_correct: boolean };
type QuestionForm = {
  id?: string;
  text: string;
  type: "mcq" | "true_false";
  points: number;
  explanation: string;
  choices: Choice[];
};

const EMPTY_QUESTION: QuestionForm = {
  text: "", type: "mcq", points: 1, explanation: "",
  choices: [
    { text: "", is_correct: true },
    { text: "", is_correct: false },
    { text: "", is_correct: false },
    { text: "", is_correct: false },
  ],
};

function QuizzesAdminPage() {
  const { tenantSlug, courseId } = useParams({ from: "/_authenticated/admin/$tenantSlug/courses/$courseId/quizzes" });
  const qc = useQueryClient();
  const [quizDialog, setQuizDialog] = useState(false);
  const [quizForm, setQuizForm] = useState<QuizForm>(EMPTY_QUIZ);
  const [editingQuizId, setEditingQuizId] = useState<string | null>(null);
  const [questionsDialog, setQuestionsDialog] = useState(false);
  const [openQuizId, setOpenQuizId] = useState<string | null>(null);
  const [questionDialog, setQuestionDialog] = useState(false);
  const [questionForm, setQuestionForm] = useState<QuestionForm>(EMPTY_QUESTION);

  const { data: tenant } = useQuery({
    queryKey: ["tenant", tenantSlug],
    queryFn: async () => (await supabase.from("tenants").select("id").eq("slug", tenantSlug).single()).data,
  });

  const { data: course } = useQuery({
    queryKey: ["course", courseId],
    queryFn: async () => (await supabase.from("courses").select("title").eq("id", courseId).single()).data,
  });

  const { data: quizzes } = useQuery({
    queryKey: ["course-quizzes", courseId],
    queryFn: async () => {
      const { data, error } = await supabase.from("quizzes").select("*, quiz_questions(id)")
        .eq("course_id", courseId).order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const { data: questions } = useQuery({
    queryKey: ["quiz-questions", openQuizId],
    enabled: !!openQuizId,
    queryFn: async () => {
      const { data, error } = await supabase.from("quiz_questions")
        .select("*, quiz_choices(*)").eq("quiz_id", openQuizId!).order("order_index");
      if (error) throw error;
      return data;
    },
  });

  const saveQuiz = useMutation({
    mutationFn: async () => {
      if (!tenant) throw new Error("no tenant");
      const payload = { ...quizForm, course_id: courseId, tenant_id: tenant.id };
      if (editingQuizId) {
        const { error } = await supabase.from("quizzes").update(payload).eq("id", editingQuizId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("quizzes").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("تم الحفظ");
      qc.invalidateQueries({ queryKey: ["course-quizzes"] });
      setQuizDialog(false); setEditingQuizId(null); setQuizForm(EMPTY_QUIZ);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteQuiz = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("quizzes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("حُذف"); qc.invalidateQueries({ queryKey: ["course-quizzes"] }); },
  });

  const saveQuestion = useMutation({
    mutationFn: async () => {
      if (!openQuizId) return;
      const baseOrder = (questions?.length ?? 0);
      let qId = questionForm.id;
      if (qId) {
        const { error } = await supabase.from("quiz_questions").update({
          text: questionForm.text, type: questionForm.type,
          points: questionForm.points, explanation: questionForm.explanation || null,
        }).eq("id", qId);
        if (error) throw error;
        await supabase.from("quiz_choices").delete().eq("question_id", qId);
      } else {
        const { data, error } = await supabase.from("quiz_questions").insert({
          quiz_id: openQuizId, text: questionForm.text, type: questionForm.type,
          points: questionForm.points, explanation: questionForm.explanation || null,
          order_index: baseOrder,
        }).select("id").single();
        if (error) throw error;
        qId = data.id;
      }
      const choicesToInsert = questionForm.choices
        .filter((c) => c.text.trim())
        .map((c, i) => ({ question_id: qId!, text: c.text, is_correct: c.is_correct, order_index: i }));
      if (choicesToInsert.length) {
        const { error } = await supabase.from("quiz_choices").insert(choicesToInsert);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("تم حفظ السؤال");
      qc.invalidateQueries({ queryKey: ["quiz-questions"] });
      qc.invalidateQueries({ queryKey: ["course-quizzes"] });
      setQuestionDialog(false); setQuestionForm(EMPTY_QUESTION);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteQuestion = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("quiz_questions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("حُذف"); qc.invalidateQueries({ queryKey: ["quiz-questions"] }); },
  });

  return (
    <div dir="rtl" className="space-y-6">
      <Link to="/admin/$tenantSlug/courses/$courseId" params={{ tenantSlug, courseId }} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowRight className="h-4 w-4" /> العودة للدورة
      </Link>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">اختبارات: {course?.title}</h1>
          <p className="text-sm text-muted-foreground">إنشاء اختبارات للدورة وتحديد الاختبار النهائي</p>
        </div>
        <Button onClick={() => { setQuizForm(EMPTY_QUIZ); setEditingQuizId(null); setQuizDialog(true); }}>
          <Plus className="h-4 w-4 ml-2" /> اختبار جديد
        </Button>
      </div>

      <div className="grid gap-3">
        {quizzes?.length === 0 && (
          <Card><CardContent className="p-8 text-center text-muted-foreground">لا توجد اختبارات</CardContent></Card>
        )}
        {quizzes?.map((q) => (
          <Card key={q.id}>
            <CardContent className="p-4 flex items-start gap-3">
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold">{q.title}</span>
                  {q.is_final && <Badge className="bg-amber-500">اختبار نهائي</Badge>}
                  {!q.is_active && <Badge variant="secondary">معطّل</Badge>}
                  <Badge variant="outline">{q.quiz_questions?.length ?? 0} سؤال</Badge>
                  <Badge variant="outline">نجاح: {q.passing_score}%</Badge>
                </div>
                {q.description && <p className="text-sm text-muted-foreground">{q.description}</p>}
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" onClick={() => { setOpenQuizId(q.id); setQuestionsDialog(true); }}>الأسئلة</Button>
                <Button size="icon" variant="ghost" onClick={() => {
                  setQuizForm({
                    title: q.title, description: q.description ?? "",
                    passing_score: q.passing_score, attempts_limit: q.attempts_limit,
                    time_limit_minutes: q.time_limit_minutes, is_final: q.is_final, is_active: q.is_active,
                  });
                  setEditingQuizId(q.id); setQuizDialog(true);
                }}><Edit className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => { if (confirm("حذف الاختبار؟")) deleteQuiz.mutate(q.id); }}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quiz dialog */}
      <Dialog open={quizDialog} onOpenChange={setQuizDialog}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>{editingQuizId ? "تعديل اختبار" : "اختبار جديد"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>العنوان *</Label>
              <Input value={quizForm.title} onChange={(e) => setQuizForm({ ...quizForm, title: e.target.value })} />
            </div>
            <div>
              <Label>الوصف</Label>
              <Textarea rows={2} value={quizForm.description} onChange={(e) => setQuizForm({ ...quizForm, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>درجة النجاح %</Label>
                <Input type="number" min={0} max={100} value={quizForm.passing_score} onChange={(e) => setQuizForm({ ...quizForm, passing_score: Number(e.target.value) })} />
              </div>
              <div>
                <Label>أقصى محاولات</Label>
                <Input type="number" value={quizForm.attempts_limit ?? ""} onChange={(e) => setQuizForm({ ...quizForm, attempts_limit: e.target.value ? Number(e.target.value) : null })} />
              </div>
              <div>
                <Label>دقائق</Label>
                <Input type="number" value={quizForm.time_limit_minutes ?? ""} onChange={(e) => setQuizForm({ ...quizForm, time_limit_minutes: e.target.value ? Number(e.target.value) : null })} />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label>اختبار نهائي (يُصدر شهادة عند النجاح)</Label>
              <Switch checked={quizForm.is_final} onCheckedChange={(v) => setQuizForm({ ...quizForm, is_final: v })} />
            </div>
            <div className="flex items-center justify-between">
              <Label>مفعّل</Label>
              <Switch checked={quizForm.is_active} onCheckedChange={(v) => setQuizForm({ ...quizForm, is_active: v })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuizDialog(false)}>إلغاء</Button>
            <Button onClick={() => saveQuiz.mutate()} disabled={!quizForm.title || saveQuiz.isPending}>حفظ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Questions dialog */}
      <Dialog open={questionsDialog} onOpenChange={setQuestionsDialog}>
        <DialogContent dir="rtl" className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>أسئلة الاختبار</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Button size="sm" onClick={() => { setQuestionForm(EMPTY_QUESTION); setQuestionDialog(true); }}>
              <Plus className="h-4 w-4 ml-1" /> سؤال جديد
            </Button>
            {questions?.length === 0 && (
              <p className="text-center text-muted-foreground py-6">لا توجد أسئلة</p>
            )}
            {questions?.map((q, idx) => (
              <Card key={q.id}>
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="font-medium">{idx + 1}. {q.text}</div>
                      <div className="mt-2 space-y-1">
                        {[...(q.quiz_choices ?? [])].sort((a, b) => a.order_index - b.order_index).map((c) => (
                          <div key={c.id} className="text-sm flex items-center gap-2">
                            {c.is_correct ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <span className="w-4 h-4 rounded-full border" />}
                            {c.text}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => {
                        setQuestionForm({
                          id: q.id, text: q.text, type: q.type, points: q.points,
                          explanation: q.explanation ?? "",
                          choices: [...(q.quiz_choices ?? [])].sort((a, b) => a.order_index - b.order_index)
                            .map((c) => ({ id: c.id, text: c.text, is_correct: c.is_correct })),
                        });
                        setQuestionDialog(true);
                      }}><Edit className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => { if (confirm("حذف السؤال؟")) deleteQuestion.mutate(q.id); }}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Question editor */}
      <Dialog open={questionDialog} onOpenChange={setQuestionDialog}>
        <DialogContent dir="rtl" className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{questionForm.id ? "تعديل سؤال" : "سؤال جديد"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>نص السؤال *</Label>
              <Textarea rows={2} value={questionForm.text} onChange={(e) => setQuestionForm({ ...questionForm, text: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>الدرجة</Label>
                <Input type="number" min={1} value={questionForm.points} onChange={(e) => setQuestionForm({ ...questionForm, points: Number(e.target.value) })} />
              </div>
              <div>
                <Label>الشرح (يظهر بعد الإجابة)</Label>
                <Input value={questionForm.explanation} onChange={(e) => setQuestionForm({ ...questionForm, explanation: e.target.value })} />
              </div>
            </div>
            <div>
              <Label className="mb-2 block">الخيارات (حدد الإجابة الصحيحة)</Label>
              <div className="space-y-2">
                {questionForm.choices.map((c, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input type="radio" name="correct" checked={c.is_correct} onChange={() => {
                      setQuestionForm({
                        ...questionForm,
                        choices: questionForm.choices.map((ch, idx) => ({ ...ch, is_correct: idx === i })),
                      });
                    }} />
                    <Input value={c.text} placeholder={`الخيار ${i + 1}`} onChange={(e) => {
                      const next = [...questionForm.choices];
                      next[i] = { ...next[i], text: e.target.value };
                      setQuestionForm({ ...questionForm, choices: next });
                    }} />
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuestionDialog(false)}>إلغاء</Button>
            <Button onClick={() => saveQuestion.mutate()} disabled={!questionForm.text || saveQuestion.isPending}>حفظ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

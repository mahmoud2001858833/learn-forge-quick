import { createFileRoute, useParams, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, ArrowRight, Trophy, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/quiz/$quizId")({
  component: TakeQuizPage,
});

function TakeQuizPage() {
  const { quizId } = useParams({ from: "/_authenticated/quiz/$quizId" });
  const navigate = useNavigate();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<{ score: number; max: number; percent: number; passed: boolean } | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  const { data: quiz } = useQuery({
    queryKey: ["quiz", quizId],
    queryFn: async () => (await supabase.from("quizzes").select("*").eq("id", quizId).single()).data,
  });

  const { data: questions } = useQuery({
    queryKey: ["quiz-questions-take", quizId],
    queryFn: async () => {
      const { data, error } = await supabase.from("quiz_questions")
        .select("id, text, type, points, order_index, quiz_choices_public:quiz_choices(id, text, order_index)")
        .eq("quiz_id", quizId).order("order_index");
      if (error) throw error;
      // sort choices client-side
      return data?.map((q) => ({
        ...q,
        choices: [...(q.quiz_choices_public ?? [])].sort((a, b) => a.order_index - b.order_index),
      }));
    },
  });

  const { data: prevAttempts } = useQuery({
    queryKey: ["quiz-attempts-mine", quizId],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return [];
      const { data } = await supabase.from("quiz_attempts").select("*")
        .eq("quiz_id", quizId).eq("student_id", u.user.id).order("submitted_at", { ascending: false });
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!quiz?.time_limit_minutes || result) return;
    setTimeLeft(quiz.time_limit_minutes * 60);
    const t = setInterval(() => {
      setTimeLeft((tl) => {
        if (tl === null) return null;
        if (tl <= 1) { clearInterval(t); submit.mutate(); return 0; }
        return tl - 1;
      });
    }, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quiz?.id, result]);

  const submit = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("submit_quiz_attempt", { _quiz_id: quizId, _answers: answers });
      if (error) throw error;
      const { data: attempt } = await supabase.from("quiz_attempts").select("*").eq("id", data as string).single();
      return attempt;
    },
    onSuccess: (a) => {
      if (!a) return;
      setResult({ score: a.score, max: a.max_score, percent: Number(a.percent), passed: a.passed });
      if (a.passed) toast.success("نجحت في الاختبار! 🎉");
      else toast.error("للأسف لم تجتز هذا الاختبار");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!quiz) return <div className="p-10 text-center">جارٍ التحميل...</div>;

  if (result) {
    return (
      <main dir="rtl" className="container mx-auto px-6 py-10 max-w-2xl">
        <Card className={result.passed ? "border-green-500 border-2" : "border-red-500 border-2"}>
          <CardContent className="p-8 text-center space-y-4">
            {result.passed ? (
              <Trophy className="h-16 w-16 mx-auto text-amber-500" />
            ) : (
              <X className="h-16 w-16 mx-auto text-red-500" />
            )}
            <h2 className="text-2xl font-bold">{result.passed ? "أحسنت! نجحت" : "لم تجتز الاختبار"}</h2>
            <div className="text-5xl font-bold text-primary">{result.percent}%</div>
            <p className="text-muted-foreground">{result.score} من {result.max} نقطة</p>
            <p className="text-sm">درجة النجاح: {quiz.passing_score}%</p>
            <div className="flex gap-2 justify-center pt-3">
              <Button variant="outline" onClick={() => navigate({ to: "/dashboard" })}>لوحة التحكم</Button>
              {!result.passed && (quiz.attempts_limit === null || (prevAttempts?.length ?? 0) < quiz.attempts_limit) && (
                <Button onClick={() => { setResult(null); setAnswers({}); }}>إعادة المحاولة</Button>
              )}
            </div>
          </CardContent>
        </Card>
      </main>
    );
  }

  const mm = timeLeft !== null ? Math.floor(timeLeft / 60) : null;
  const ss = timeLeft !== null ? String(timeLeft % 60).padStart(2, "0") : null;

  return (
    <main dir="rtl" className="container mx-auto px-6 py-10 max-w-2xl">
      <Link to="/dashboard" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowRight className="h-4 w-4" /> لوحة التحكم
      </Link>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{quiz.title}</h1>
          {quiz.description && <p className="text-sm text-muted-foreground">{quiz.description}</p>}
          <div className="flex gap-2 mt-2">
            <Badge variant="outline">نجاح: {quiz.passing_score}%</Badge>
            {quiz.attempts_limit && <Badge variant="outline">محاولات: {(prevAttempts?.length ?? 0)} / {quiz.attempts_limit}</Badge>}
          </div>
        </div>
        {timeLeft !== null && (
          <Badge className="text-lg px-3 py-1.5"><Clock className="h-4 w-4 ml-1" /> {mm}:{ss}</Badge>
        )}
      </div>

      <div className="space-y-4">
        {questions?.map((q, i) => (
          <Card key={q.id}>
            <CardContent className="p-5 space-y-3">
              <div className="font-medium">{i + 1}. {q.text}</div>
              <div className="space-y-2">
                {q.choices.map((c) => (
                  <label key={c.id} className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer hover:bg-muted/50 ${answers[q.id] === c.id ? "border-primary bg-primary/5" : ""}`}>
                    <input type="radio" name={q.id} value={c.id} checked={answers[q.id] === c.id}
                      onChange={() => setAnswers({ ...answers, [q.id]: c.id })} />
                    <span>{c.text}</span>
                  </label>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Button className="w-full mt-6" size="lg" onClick={() => submit.mutate()}
        disabled={submit.isPending || Object.keys(answers).length !== (questions?.length ?? 0)}>
        {submit.isPending ? "جارٍ التصحيح..." : "إرسال الإجابات"}
      </Button>
    </main>
  );
}

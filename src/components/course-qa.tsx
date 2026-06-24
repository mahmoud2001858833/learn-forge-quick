import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

type Q = {
  id: string;
  user_id: string;
  title: string;
  body: string;
  is_answered: boolean;
  answers_count: number;
  created_at: string;
  profiles: { full_name: string | null } | null;
};

export function CourseQA({ courseId }: { courseId: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const { data: questions } = useQuery({
    queryKey: ["course-qa", courseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("course_questions")
        .select("id, user_id, title, body, is_answered, answers_count, created_at, profiles:user_id(full_name)")
        .eq("course_id", courseId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Q[];
    },
  });

  const ask = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("course_questions").insert({
        course_id: courseId, user_id: user!.id, title: title.trim(), body: body.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => { setTitle(""); setBody(""); qc.invalidateQueries({ queryKey: ["course-qa", courseId] }); toast.success("تم نشر السؤال"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <h3 className="font-bold text-lg">الأسئلة والأجوبة</h3>
      <Card>
        <CardContent className="p-4 space-y-2">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="عنوان السؤال" />
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="اشرح سؤالك بالتفصيل..." rows={3} />
          <Button size="sm" disabled={!title.trim() || !body.trim() || ask.isPending} onClick={() => ask.mutate()}>اطرح سؤالاً</Button>
        </CardContent>
      </Card>
      <div className="space-y-3">
        {(questions ?? []).length === 0 && <p className="text-sm text-muted-foreground">لا توجد أسئلة بعد.</p>}
        {(questions ?? []).map((q) => (
          <Card key={q.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold">{q.title}</h4>
                    {q.is_answered && <Badge variant="secondary" className="gap-1"><CheckCircle2 className="h-3 w-3" />تمت الإجابة</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{q.body}</p>
                  <p className="text-xs text-muted-foreground mt-2">{q.profiles?.full_name ?? "طالب"} · {new Date(q.created_at).toLocaleDateString("ar")}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setOpenId(openId === q.id ? null : q.id)}>
                  <MessageCircle className="h-4 w-4 ml-1" />{q.answers_count}
                </Button>
              </div>
              {openId === q.id && <Answers questionId={q.id} courseId={courseId} />}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function Answers({ questionId, courseId }: { questionId: string; courseId: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [text, setText] = useState("");

  const { data: answers } = useQuery({
    queryKey: ["qa-answers", questionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("course_answers")
        .select("id, user_id, content, is_instructor_answer, created_at, profiles:user_id(full_name)")
        .eq("question_id", questionId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: isInstructor } = useQuery({
    queryKey: ["is-instructor", courseId, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: course } = await supabase.from("courses").select("tenant_id").eq("id", courseId).single();
      if (!course) return false;
      const { data } = await supabase.from("tenant_members").select("role").eq("tenant_id", course.tenant_id).eq("user_id", user!.id).maybeSingle();
      return data ? ["owner", "admin", "instructor"].includes(data.role) : false;
    },
  });

  const reply = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("course_answers").insert({
        question_id: questionId, user_id: user!.id, content: text.trim(), is_instructor_answer: !!isInstructor,
      });
      if (error) throw error;
    },
    onSuccess: () => { setText(""); qc.invalidateQueries({ queryKey: ["qa-answers", questionId] }); qc.invalidateQueries({ queryKey: ["course-qa", courseId] }); },
  });

  return (
    <div className="mt-3 space-y-3 border-t pt-3">
      {(answers ?? []).map((a) => (
        <div key={a.id} className="text-sm">
          <div className="flex items-center gap-2">
            <span className="font-medium">{(a as any).profiles?.full_name ?? "طالب"}</span>
            {a.is_instructor_answer && <Badge variant="default" className="text-xs">مدرّب</Badge>}
            <span className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleDateString("ar")}</span>
          </div>
          <p className="mt-1 whitespace-pre-wrap">{a.content}</p>
        </div>
      ))}
      <div className="space-y-2">
        <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="اكتب إجابتك..." rows={2} />
        <Button size="sm" disabled={!text.trim() || reply.isPending} onClick={() => reply.mutate()}>إرسال</Button>
      </div>
    </div>
  );
}

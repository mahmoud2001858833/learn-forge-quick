import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Calendar, Award, ArrowRight, CheckCircle2, Clock, FileText } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/assignment/$assignmentId")({
  component: AssignmentPage,
});

function AssignmentPage() {
  const { assignmentId } = useParams({ from: "/_authenticated/assignment/$assignmentId" });
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: assignment } = useQuery({
    queryKey: ["assignment", assignmentId],
    queryFn: async () => (await supabase.from("assignments").select("*").eq("id", assignmentId).single()).data,
  });

  const { data: submission, refetch } = useQuery({
    enabled: !!user?.id,
    queryKey: ["my-submission", assignmentId, user?.id],
    queryFn: async () => (await supabase.from("assignment_submissions").select("*").eq("assignment_id", assignmentId).eq("student_id", user!.id).maybeSingle()).data,
  });

  const [content, setContent] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (submission) { setContent(submission.content ?? ""); setFileUrl(submission.file_url ?? ""); }
  }, [submission]);

  if (!assignment) return <div className="p-10 text-center">جارٍ التحميل...</div>;

  const overdue = assignment.due_at && new Date(assignment.due_at) < new Date();
  const isGraded = submission?.status === "graded";
  const canSubmit = !overdue || assignment.allow_late;

  async function submit() {
    if (!user?.id || !content.trim()) return toast.error("اكتب إجابتك");
    setBusy(true);
    const payload = {
      assignment_id: assignmentId, student_id: user.id,
      content, file_url: fileUrl || null,
      status: "submitted" as const, submitted_at: new Date().toISOString(),
    };
    const { error } = submission
      ? await supabase.from("assignment_submissions").update(payload).eq("id", submission.id)
      : await supabase.from("assignment_submissions").insert(payload);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("تم التسليم");
    refetch();
    qc.invalidateQueries({ queryKey: ["my-submission"] });
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl space-y-6" dir="rtl">
      <Link to="/dashboard" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowRight className="h-4 w-4" /> الرئيسية</Link>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between flex-wrap gap-2">
            <CardTitle className="text-2xl">{assignment.title}</CardTitle>
            <div className="flex gap-2">
              <Badge variant="outline"><Award className="h-3 w-3 ms-1" />{assignment.max_score} نقطة</Badge>
              {assignment.due_at && (
                <Badge variant={overdue ? "destructive" : "secondary"}><Calendar className="h-3 w-3 ms-1" />
                  {new Date(assignment.due_at).toLocaleString("ar-EG", { dateStyle: "medium", timeStyle: "short" })}
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {assignment.instructions && (
            <div className="prose prose-sm max-w-none whitespace-pre-wrap bg-muted/40 p-4 rounded-lg">{assignment.instructions}</div>
          )}
          {assignment.attachment_url && (
            <a href={assignment.attachment_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm text-primary hover:underline">
              <FileText className="h-4 w-4" /> مرفق الواجب
            </a>
          )}
          {overdue && !assignment.allow_late && (
            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded">انتهى موعد التسليم ولا يُقبل التسليم المتأخر.</div>
          )}
          {overdue && assignment.allow_late && (
            <div className="text-sm text-amber-700 bg-amber-500/10 p-3 rounded flex items-center gap-2"><Clock className="h-4 w-4" /> التسليم المتأخر مسموح به.</div>
          )}
        </CardContent>
      </Card>

      {/* Graded result */}
      {isGraded && (
        <Card className="border-emerald-500/40 bg-emerald-500/5">
          <CardContent className="p-5 space-y-2">
            <div className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-emerald-600" /><span className="font-bold">تم التقييم</span></div>
            <div className="text-3xl font-black text-emerald-700">{submission!.score} / {assignment.max_score}</div>
            {submission!.feedback && <div className="text-sm bg-background p-3 rounded"><div className="font-semibold mb-1">ملاحظات المعلم:</div>{submission!.feedback}</div>}
          </CardContent>
        </Card>
      )}

      {/* Submission form */}
      <Card>
        <CardHeader><CardTitle className="text-lg">{submission ? "تسليمك" : "تسليم الواجب"}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div><Label>إجابتك *</Label><Textarea rows={8} value={content} onChange={(e) => setContent(e.target.value)} disabled={!canSubmit || isGraded} /></div>
          <div><Label>رابط ملف (اختياري — Google Drive / Dropbox)</Label><Input value={fileUrl} onChange={(e) => setFileUrl(e.target.value)} placeholder="https://..." disabled={!canSubmit || isGraded} /></div>
          {!isGraded && canSubmit && (
            <Button onClick={submit} disabled={busy}>{busy ? "جارٍ الإرسال..." : submission ? "تحديث التسليم" : "تسليم"}</Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

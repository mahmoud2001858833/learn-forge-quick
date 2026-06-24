import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, Check, PlayCircle, FileText, FileType, ClipboardCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { VideoPlayer } from "@/components/video-player";

export const Route = createFileRoute("/_authenticated/learn/$enrollmentId")({
  component: LearnPage,
});

function LearnPage() {
  const { enrollmentId } = useParams({ from: "/_authenticated/learn/$enrollmentId" });
  const qc = useQueryClient();

  const { data: enrollment } = useQuery({
    queryKey: ["enrollment", enrollmentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("enrollments")
        .select("*, courses(*, sections(*, lessons(*)))")
        .eq("id", enrollmentId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: progress } = useQuery({
    queryKey: ["progress", enrollmentId],
    queryFn: async () => {
      const { data, error } = await supabase.from("lesson_progress").select("*").eq("enrollment_id", enrollmentId);
      if (error) throw error;
      return data;
    },
  });
  const { data: quizzes } = useQuery({
    queryKey: ["course-quizzes-learn", enrollment?.course_id],
    enabled: !!enrollment?.course_id,
    queryFn: async () => {
      const { data } = await supabase.from("quizzes").select("id, title, is_final, passing_score, is_active")
        .eq("course_id", enrollment!.course_id).eq("is_active", true).order("is_final");
      return data ?? [];
    },
  });

  const lessons = useMemo(() => {
    if (!enrollment?.courses?.sections) return [];
    return [...enrollment.courses.sections]
      .sort((a, b) => a.order_index - b.order_index)
      .flatMap((s) => [...s.lessons].sort((a, b) => a.order_index - b.order_index).map((l) => ({ ...l, sectionTitle: s.title })));
  }, [enrollment]);

  const [activeId, setActiveId] = useState<string | null>(null);
  const activeLesson = lessons.find((l) => l.id === activeId) ?? lessons[0] ?? null;
  const completedIds = new Set(progress?.filter((p) => p.completed).map((p) => p.lesson_id));

  const toggleComplete = useMutation({
    mutationFn: async (lessonId: string) => {
      const isCompleted = completedIds.has(lessonId);
      const { error } = await supabase.from("lesson_progress").upsert(
        { enrollment_id: enrollmentId, lesson_id: lessonId, completed: !isCompleted, watched_seconds: 0 },
        { onConflict: "enrollment_id,lesson_id" }
      );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["progress", enrollmentId] });
    },
  });

  if (!enrollment) return <div className="p-10">جارٍ التحميل...</div>;

  return (
    <div className="min-h-screen flex bg-background">
      <aside className="w-80 border-l overflow-auto">
        <Link to="/dashboard" className="flex items-center gap-2 text-sm p-4 text-muted-foreground hover:text-foreground border-b">
          <ArrowRight className="h-4 w-4" /> دوراتي
        </Link>
        <div className="p-4 border-b">
          <h2 className="font-bold">{enrollment.courses?.title}</h2>
          <p className="text-xs text-muted-foreground mt-1">{completedIds.size} / {lessons.length} درس مكتمل</p>
        </div>
        <ul>
          {lessons.map((l) => (
            <li key={l.id}>
              <button
                onClick={() => setActiveId(l.id)}
                className={cn(
                  "w-full text-right p-3 flex items-center gap-2 text-sm hover:bg-accent border-b",
                  activeLesson?.id === l.id && "bg-accent"
                )}
              >
                {completedIds.has(l.id) ? <Check className="h-4 w-4 text-green-600 shrink-0" /> :
                  l.type === "video" ? <PlayCircle className="h-4 w-4 shrink-0" /> :
                  l.type === "pdf" ? <FileType className="h-4 w-4 shrink-0" /> :
                  <FileText className="h-4 w-4 shrink-0" />}
                <span className="truncate">{l.title}</span>
              </button>
            </li>
          ))}
        </ul>
        {quizzes && quizzes.length > 0 && (
          <div className="p-3 border-t">
            <div className="text-xs font-bold text-muted-foreground mb-2 px-1">الاختبارات</div>
            {quizzes.map((q) => (
              <Link key={q.id} to="/quiz/$quizId" params={{ quizId: q.id }}
                className="flex items-center gap-2 p-2 hover:bg-accent rounded text-sm">
                <ClipboardCheck className={cn("h-4 w-4", q.is_final ? "text-amber-500" : "text-muted-foreground")} />
                <span className="truncate flex-1">{q.title}</span>
                {q.is_final && <span className="text-xs text-amber-600">نهائي</span>}
              </Link>
            ))}
          </div>
        )}
      </aside>

      <main className="flex-1 p-8 overflow-auto">
        {activeLesson ? (
          <div className="max-w-4xl mx-auto space-y-4">
            <h1 className="text-2xl font-bold">{activeLesson.title}</h1>
            <Card>
              <CardContent className="p-0">
                <LessonContent lesson={activeLesson} />
              </CardContent>
            </Card>
            <Button onClick={() => toggleComplete.mutate(activeLesson.id)} variant={completedIds.has(activeLesson.id) ? "outline" : "default"}>
              <Check className="h-4 w-4 ml-1" />
              {completedIds.has(activeLesson.id) ? "تم — إلغاء" : "وضع علامة مكتمل"}
            </Button>
          </div>
        ) : (
          <div className="text-center text-muted-foreground py-20">لا توجد دروس في هذه الدورة بعد</div>
        )}
      </main>
    </div>
  );
}

function LessonContent({ lesson }: { lesson: { type: string; content_url: string | null; content_text: string | null; video_asset_id?: string | null } }) {
  if (lesson.type === "video" && lesson.video_asset_id) {
    return <VideoPlayer assetId={lesson.video_asset_id} className="w-full aspect-video" />;
  }
  if (lesson.type === "video" && lesson.content_url) {
    const ytMatch = lesson.content_url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([\w-]+)/);
    if (ytMatch) {
      return (
        <div className="aspect-video">
          <iframe src={`https://www.youtube.com/embed/${ytMatch[1]}`} className="w-full h-full" allowFullScreen />
        </div>
      );
    }
    return <video src={lesson.content_url} controls className="w-full aspect-video" />;
  }
  if (lesson.type === "pdf" && lesson.content_url) {
    return <iframe src={lesson.content_url} className="w-full h-[600px]" />;
  }
  return <div className="p-6 prose max-w-none whitespace-pre-wrap">{lesson.content_text}</div>;
}

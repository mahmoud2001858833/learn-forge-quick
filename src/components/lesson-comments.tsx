import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Trash2, Reply } from "lucide-react";
import { toast } from "sonner";

type Comment = {
  id: string;
  user_id: string;
  parent_id: string | null;
  content: string;
  created_at: string;
  profiles: { full_name: string | null; avatar_url: string | null } | null;
};

export function LessonComments({ lessonId }: { lessonId: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");

  const { data: comments } = useQuery({
    queryKey: ["lesson-comments", lessonId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lesson_comments")
        .select("id, user_id, parent_id, content, created_at, profiles:user_id(full_name, avatar_url)")
        .eq("lesson_id", lessonId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as Comment[];
    },
  });

  const add = useMutation({
    mutationFn: async ({ content, parent_id }: { content: string; parent_id: string | null }) => {
      const { error } = await supabase.from("lesson_comments").insert({
        lesson_id: lessonId, user_id: user!.id, content, parent_id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setText(""); setReplyText(""); setReplyTo(null);
      qc.invalidateQueries({ queryKey: ["lesson-comments", lessonId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("lesson_comments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lesson-comments", lessonId] }),
  });

  const roots = (comments ?? []).filter((c) => !c.parent_id);
  const childrenOf = (id: string) => (comments ?? []).filter((c) => c.parent_id === id);

  return (
    <div className="space-y-4">
      <h3 className="font-bold text-lg">المناقشة</h3>
      <div className="space-y-2">
        <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="شارك سؤالاً أو ملاحظة..." rows={3} />
        <Button size="sm" disabled={!text.trim() || add.isPending} onClick={() => add.mutate({ content: text.trim(), parent_id: null })}>
          نشر
        </Button>
      </div>
      <div className="space-y-4">
        {roots.length === 0 && <p className="text-sm text-muted-foreground">لا توجد تعليقات بعد. كن أول من يعلق.</p>}
        {roots.map((c) => (
          <div key={c.id} className="space-y-2">
            <CommentItem c={c} onReply={() => setReplyTo(replyTo === c.id ? null : c.id)} onDelete={() => del.mutate(c.id)} canDelete={user?.id === c.user_id} />
            {replyTo === c.id && (
              <div className="mr-10 space-y-2">
                <Textarea value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder="ردك..." rows={2} />
                <Button size="sm" disabled={!replyText.trim() || add.isPending} onClick={() => add.mutate({ content: replyText.trim(), parent_id: c.id })}>
                  رد
                </Button>
              </div>
            )}
            {childrenOf(c.id).map((rc) => (
              <div key={rc.id} className="mr-10">
                <CommentItem c={rc} onDelete={() => del.mutate(rc.id)} canDelete={user?.id === rc.user_id} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function CommentItem({ c, onReply, onDelete, canDelete }: { c: Comment; onReply?: () => void; onDelete: () => void; canDelete: boolean }) {
  const name = c.profiles?.full_name ?? "طالب";
  return (
    <div className="flex gap-3 items-start">
      <Avatar className="h-8 w-8">
        {c.profiles?.avatar_url ? <img src={c.profiles.avatar_url} alt="" /> : <AvatarFallback>{name[0]}</AvatarFallback>}
      </Avatar>
      <div className="flex-1">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium">{name}</span>
          <span className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleDateString("ar")}</span>
        </div>
        <p className="text-sm mt-1 whitespace-pre-wrap">{c.content}</p>
        <div className="flex gap-2 mt-1">
          {onReply && <Button variant="ghost" size="sm" onClick={onReply}><Reply className="h-3 w-3 ml-1" />رد</Button>}
          {canDelete && <Button variant="ghost" size="sm" onClick={onDelete}><Trash2 className="h-3 w-3" /></Button>}
        </div>
      </div>
    </div>
  );
}

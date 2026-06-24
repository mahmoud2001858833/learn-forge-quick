import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Star, Trash2 } from "lucide-react";
import { toast } from "sonner";

export function CourseReviews({ courseId, canReview }: { courseId: string; canReview: boolean }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [rating, setRating] = useState(5);
  const [review, setReview] = useState("");

  const { data: reviews } = useQuery({
    queryKey: ["course-reviews", courseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("course_reviews")
        .select("id, user_id, rating, review, created_at, profiles:user_id(full_name, avatar_url)")
        .eq("course_id", courseId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const mine = reviews?.find((r) => r.user_id === user?.id);

  useEffect(() => {
    if (mine) { setRating(mine.rating); setReview(mine.review ?? ""); }
  }, [mine?.id]);

  const upsert = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("course_reviews").upsert({
        course_id: courseId, user_id: user!.id, rating, review: review.trim() || null,
      }, { onConflict: "course_id,user_id" });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["course-reviews", courseId] }); toast.success("شكراً لتقييمك"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("course_reviews").delete().eq("course_id", courseId).eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => { setRating(5); setReview(""); qc.invalidateQueries({ queryKey: ["course-reviews", courseId] }); },
  });

  const avg = reviews && reviews.length > 0 ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : "—";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-lg">التقييمات</h3>
        <div className="flex items-center gap-1 text-sm">
          <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
          <span className="font-bold">{avg}</span>
          <span className="text-muted-foreground">({reviews?.length ?? 0})</span>
        </div>
      </div>

      {canReview && user && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} onClick={() => setRating(n)}>
                  <Star className={`h-6 w-6 ${n <= rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />
                </button>
              ))}
            </div>
            <Textarea value={review} onChange={(e) => setReview(e.target.value)} placeholder="شاركنا رأيك في الدورة (اختياري)..." rows={3} />
            <div className="flex gap-2">
              <Button size="sm" onClick={() => upsert.mutate()} disabled={upsert.isPending}>{mine ? "تحديث التقييم" : "نشر التقييم"}</Button>
              {mine && <Button size="sm" variant="outline" onClick={() => del.mutate()}><Trash2 className="h-3 w-3 ml-1" />حذف</Button>}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {(reviews ?? []).length === 0 && <p className="text-sm text-muted-foreground">لا توجد تقييمات بعد.</p>}
        {(reviews ?? []).map((r) => (
          <Card key={r.id}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="font-medium text-sm">{(r as any).profiles?.full_name ?? "طالب"}</div>
                <div className="flex">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star key={n} className={`h-4 w-4 ${n <= r.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />
                  ))}
                </div>
              </div>
              {r.review && <p className="text-sm mt-2 whitespace-pre-wrap">{r.review}</p>}
              <p className="text-xs text-muted-foreground mt-1">{new Date(r.created_at).toLocaleDateString("ar")}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

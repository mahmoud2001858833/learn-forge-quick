import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PlayCircle, FileText, FileType, Lock } from "lucide-react";
import { toast } from "sonner";
import { PaymentRequestDialog } from "@/components/payment-request-dialog";
import { CourseReviews } from "@/components/course-reviews";
import { Star } from "lucide-react";

export const Route = createFileRoute("/t/$slug/courses/$courseSlug")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.courseSlug} — ${params.slug}` },
      { name: "description", content: `تفاصيل دورة ${params.courseSlug} على منصة ${params.slug}.` },
      { property: "og:title", content: params.courseSlug },
      { property: "og:type", content: "article" },
    ],
  }),
  component: CourseDetail,
});


function CourseDetail() {
  const { slug, courseSlug } = useParams({ from: "/t/$slug/courses/$courseSlug" });
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [paymentOpen, setPaymentOpen] = useState(false);

  const { data: tenant } = useQuery({
    queryKey: ["public-tenant", slug],
    queryFn: async () => (await supabase.from("tenants").select("*").eq("slug", slug).single()).data,
  });

  const { data: course } = useQuery({
    queryKey: ["public-course", tenant?.id, courseSlug],
    enabled: !!tenant,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("*, sections(*, lessons(id, title, type, is_preview, order_index))")
        .eq("tenant_id", tenant!.id)
        .eq("slug", courseSlug)
        .eq("status", "published")
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: enrollment } = useQuery({
    queryKey: ["my-enrollment", course?.id, user?.id],
    enabled: !!user && !!course,
    queryFn: async () => {
      const { data } = await supabase.from("enrollments").select("*").eq("course_id", course!.id).eq("student_id", user!.id).maybeSingle();
      return data;
    },
  });

  const enroll = useMutation({
    mutationFn: async () => {
      if (!user) { navigate({ to: "/auth" }); return; }
      // ensure tenant_member exists
      await supabase.from("tenant_members").insert({ tenant_id: tenant!.id, user_id: user.id, role: "student" }).select();
      const { data, error } = await supabase.from("enrollments").insert({
        tenant_id: tenant!.id, course_id: course!.id, student_id: user.id,
      }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (!data) return;
      toast.success("تم التسجيل!");
      qc.invalidateQueries({ queryKey: ["my-enrollment"] });
      navigate({ to: "/learn/$enrollmentId", params: { enrollmentId: data.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!course || !tenant) return <div className="p-10 text-center">جارٍ التحميل...</div>;

  const sections = [...(course.sections ?? [])].sort((a, b) => a.order_index - b.order_index);

  return (
    <main className="container mx-auto px-6 py-12 max-w-4xl">
      <div className="grid md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-6">
          <div>
            <h1 className="text-3xl font-bold">{course.title}</h1>
            {course.reviews_count > 0 && (
              <div className="flex items-center gap-1 mt-2 text-sm">
                <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                <span className="font-bold">{Number(course.average_rating).toFixed(1)}</span>
                <span className="text-muted-foreground">({course.reviews_count} تقييم)</span>
              </div>
            )}
            <p className="text-muted-foreground mt-2">{course.description}</p>
          </div>
          <div>
            <h2 className="text-xl font-bold mb-4">محتوى الدورة</h2>
            <div className="space-y-3">
              {sections.map((s) => (
                <Card key={s.id}>
                  <CardContent className="p-4">
                    <h3 className="font-semibold mb-2">{s.title}</h3>
                    <ul className="space-y-1 text-sm">
                      {[...s.lessons].sort((a, b) => a.order_index - b.order_index).map((l) => (
                        <li key={l.id} className="flex items-center gap-2 py-1 text-muted-foreground">
                          {l.is_preview ? (l.type === "video" ? <PlayCircle className="h-4 w-4" /> : l.type === "pdf" ? <FileType className="h-4 w-4" /> : <FileText className="h-4 w-4" />) : <Lock className="h-4 w-4" />}
                          {l.title}
                          {l.is_preview && <span className="text-xs text-primary mr-auto">معاينة</span>}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
          <div className="pt-4">
            <CourseReviews courseId={course.id} canReview={!!enrollment} />
          </div>
        </div>
        <aside>
          <Card className="sticky top-4">
            {course.cover_url && <img src={course.cover_url} alt={course.title} className="w-full rounded-t-xl" />}
            <CardContent className="p-6 space-y-4">
              <div className="text-3xl font-bold" style={{ color: tenant.primary_color }}>
                {course.price > 0 ? `${course.price} ر.س` : "مجاني"}
              </div>
              {enrollment ? (
                <Button className="w-full" onClick={() => navigate({ to: "/learn/$enrollmentId", params: { enrollmentId: enrollment.id } })}>متابعة التعلم</Button>
              ) : course.is_free || course.price === 0 ? (
                <Button className="w-full" onClick={() => enroll.mutate()} disabled={enroll.isPending} style={{ background: tenant.primary_color }}>
                  سجل مجاناً
                </Button>
              ) : (
                <Button className="w-full" onClick={() => {
                  if (!user) { navigate({ to: "/auth" }); return; }
                  setPaymentOpen(true);
                }} style={{ background: tenant.primary_color }}>
                  اشترك الآن
                </Button>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
      <PaymentRequestDialog
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        tenantId={tenant.id}
        amount={course.price}
        currency={tenant.currency ?? "ر.س"}
        target={{ type: "course", courseId: course.id, allowInstallments: course.allow_installments, minInstallment: course.min_installment_amount }}
        onSuccess={() => navigate({ to: "/my-payments" })}
      />
    </main>
  );
}

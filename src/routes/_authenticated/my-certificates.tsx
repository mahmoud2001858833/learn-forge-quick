import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, Award, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/_authenticated/my-certificates")({
  component: MyCertificatesPage,
});

function MyCertificatesPage() {
  const { user } = useAuth();
  const { data: certs } = useQuery({
    queryKey: ["my-certificates", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("certificates")
        .select("*").eq("student_id", user!.id).order("issued_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <main dir="rtl" className="container mx-auto px-6 py-10 max-w-3xl">
      <Link to="/dashboard" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowRight className="h-4 w-4" /> لوحة التحكم
      </Link>
      <h1 className="text-2xl font-bold mb-6 flex items-center gap-2"><Award className="h-6 w-6 text-amber-500" /> شهاداتي</h1>

      <div className="space-y-3">
        {certs?.length === 0 && (
          <Card><CardContent className="p-8 text-center text-muted-foreground">لم تحصل على شهادات بعد. أكمل دورة لاجتياز اختبارها النهائي.</CardContent></Card>
        )}
        {certs?.map((c) => (
          <Card key={c.id} className="border-amber-200 bg-gradient-to-br from-amber-50/40 to-transparent">
            <CardContent className="p-5 flex items-start gap-4">
              <Award className="h-10 w-10 text-amber-500" />
              <div className="flex-1 space-y-1">
                <div className="font-bold text-lg">{c.course_title}</div>
                <div className="text-sm text-muted-foreground">{c.tenant_name}</div>
                <div className="text-xs">رقم الشهادة: <code className="bg-muted px-2 py-0.5 rounded">{c.certificate_number}</code></div>
                {c.final_score !== null && <div className="text-xs">الدرجة: {c.final_score}%</div>}
                <div className="text-xs text-muted-foreground">{new Date(c.issued_at).toLocaleDateString("ar-SA")}</div>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link to="/verify/$certNumber" params={{ certNumber: c.certificate_number }}>
                  <ExternalLink className="h-4 w-4 ml-1" /> عرض
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  );
}

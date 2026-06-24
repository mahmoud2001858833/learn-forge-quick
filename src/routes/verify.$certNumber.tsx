import { createFileRoute, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Award, CheckCircle2, XCircle } from "lucide-react";

export const Route = createFileRoute("/verify/$certNumber")({
  component: VerifyCertificate,
  head: ({ params }) => ({
    meta: [{ title: `تحقق من الشهادة ${params.certNumber}` }],
  }),
});

function VerifyCertificate() {
  const { certNumber } = useParams({ from: "/verify/$certNumber" });

  const { data: cert, isLoading } = useQuery({
    queryKey: ["verify-cert", certNumber],
    queryFn: async () => {
      const { data } = await supabase.from("certificates").select("*").eq("certificate_number", certNumber).maybeSingle();
      return data;
    },
  });

  if (isLoading) return <div className="p-10 text-center">جارٍ التحقق...</div>;

  return (
    <main dir="rtl" className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-amber-50 to-background">
      <Card className="max-w-2xl w-full border-2">
        <CardContent className="p-10 text-center space-y-6">
          {cert ? (
            <>
              <div className="flex justify-center"><CheckCircle2 className="h-12 w-12 text-green-600" /></div>
              <p className="text-sm text-muted-foreground">شهادة مُتحقَّق منها</p>

              <div className="border-y py-6 space-y-4">
                <Award className="h-16 w-16 mx-auto text-amber-500" />
                <h1 className="text-3xl font-bold">شهادة إنجاز</h1>
                <p className="text-lg">تشهد <strong>{cert.tenant_name}</strong> بأن</p>
                <h2 className="text-4xl font-bold text-primary">{cert.student_name}</h2>
                <p className="text-lg">قد أكمل بنجاح دورة</p>
                <h3 className="text-2xl font-bold">{cert.course_title}</h3>
                {cert.final_score !== null && (
                  <p>بدرجة نهائية: <strong>{cert.final_score}%</strong></p>
                )}
              </div>

              <div className="text-sm text-muted-foreground space-y-1">
                <div>رقم الشهادة: <code className="bg-muted px-2 py-0.5 rounded">{cert.certificate_number}</code></div>
                <div>تاريخ الإصدار: {new Date(cert.issued_at).toLocaleDateString("ar-SA")}</div>
              </div>
            </>
          ) : (
            <>
              <XCircle className="h-12 w-12 text-red-600 mx-auto" />
              <h1 className="text-2xl font-bold">شهادة غير موجودة</h1>
              <p className="text-muted-foreground">لم يتم العثور على شهادة برقم: <code>{certNumber}</code></p>
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

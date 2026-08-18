import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ShieldAlert, Home, ArrowLeft, LogIn } from "lucide-react";
import { Link } from "@tanstack/react-router";

interface AccessDeniedProps {
  title?: string;
  description?: string;
  tenantSlug?: string;
  requireLogin?: boolean;
}

export function AccessDenied({
  title = "غير مصرح لك بالوصول",
  description = "ليس لديك الصلاحيات الكافية للوصول إلى لوحة تحكم هذه المنصة. يجب أن تكون مديراً أو معلماً في الأكاديمية.",
  tenantSlug,
  requireLogin = false,
}: AccessDeniedProps) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-muted/40 via-background to-muted/20" dir="rtl">
      <Card className="max-w-md w-full text-center border-amber-500/20 shadow-xl">
        <CardHeader className="pb-4">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 grid place-items-center mb-3">
            <ShieldAlert className="h-8 w-8" />
          </div>
          <CardTitle className="text-2xl font-bold">{title}</CardTitle>
          <CardDescription className="text-sm leading-relaxed mt-2 text-muted-foreground">
            {description}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          {requireLogin ? (
            <Button asChild className="w-full sm:w-auto flex items-center gap-2">
              <Link to="/auth">
                <LogIn className="h-4 w-4" />
                تسجيل الدخول
              </Link>
            </Button>
          ) : (
            <>
              {tenantSlug && (
                <Button asChild variant="default" className="w-full sm:w-auto flex items-center gap-2">
                  <Link to="/t/$slug" params={{ slug: tenantSlug }}>
                    <ArrowLeft className="h-4 w-4" />
                    زيارة المنصة العامة
                  </Link>
                </Button>
              )}
              <Button asChild variant="outline" className="w-full sm:w-auto flex items-center gap-2">
                <Link to="/dashboard">
                  <Home className="h-4 w-4" />
                  لوحة المنصات
                </Link>
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

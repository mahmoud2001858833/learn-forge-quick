import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, resetLocalSessionToken } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { GraduationCap } from "lucide-react";
import {
  signupDirect,
  claimSession,
} from "@/lib/auth.functions";


export const Route = createFileRoute("/auth")({
  ssr: false,
  component: AuthPage,
});

const COUNTRY_CODES = [
  { code: "+966", label: "🇸🇦 السعودية" },
  { code: "+962", label: "🇯🇴 الأردن" },
  { code: "+971", label: "🇦🇪 الإمارات" },
  { code: "+965", label: "🇰🇼 الكويت" },
  { code: "+974", label: "🇶🇦 قطر" },
  { code: "+973", label: "🇧🇭 البحرين" },
  { code: "+968", label: "🇴🇲 عُمان" },
  { code: "+20", label: "🇪🇬 مصر" },
  { code: "+1", label: "🇺🇸 الولايات المتحدة" },
  { code: "+44", label: "🇬🇧 المملكة المتحدة" },
];

async function finalizeLogin() {
  const token = resetLocalSessionToken();
  await claimSession({
    data: {
      session_token: token,
      user_agent: navigator.userAgent.slice(0, 500),
      device_label: navigator.platform,
    },
  });
}

function AuthPage() {
  const navigate = useNavigate();
  const { session, loading } = useAuth();

  useEffect(() => {
    if (!loading && session) navigate({ to: "/dashboard" });
  }, [loading, session, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4 py-10" dir="rtl">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <GraduationCap className="h-10 w-10 text-primary mb-2" />
          <h1 className="text-2xl font-bold">EduForge</h1>
          <p className="text-sm text-muted-foreground">منصتك التعليمية المتكاملة</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>مرحباً بك</CardTitle>
            <CardDescription>سجل الدخول أو أنشئ حساباً جديداً</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="signin">
              <TabsList className="grid grid-cols-3 mb-4">
                <TabsTrigger value="signin">دخول</TabsTrigger>
                <TabsTrigger value="signup">حساب جديد</TabsTrigger>
                <TabsTrigger value="forgot">استرجاع</TabsTrigger>
              </TabsList>
              <TabsContent value="signin"><SignInForm /></TabsContent>
              <TabsContent value="signup"><SignUpFlow /></TabsContent>
              <TabsContent value="forgot"><ForgotPasswordFlow /></TabsContent>
            </Tabs>
            <div className="my-4 text-center text-xs text-muted-foreground">— أو —</div>
            <GoogleButton />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function GoogleButton() {
  async function onGoogle() {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin + "/auth" },
      });
      if (error) toast.error(error.message);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذّر بدء Google");
    }
  }
  return (
    <Button type="button" variant="outline" className="w-full" onClick={onGoogle}>
      متابعة باستخدام Google
    </Button>
  );
}

function SignInForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setBusy(false);
      return toast.error(error.message);
    }
    try {
      await finalizeLogin();
      toast.success("تم تسجيل الدخول");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطأ في تسجيل الجلسة");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <Label>البريد الإلكتروني</Label>
        <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div>
        <Label>كلمة المرور</Label>
        <Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? "جارٍ..." : "دخول"}
      </Button>
    </form>
  );
}

// =========== SIGNUP (no OTP) ===========
function SignUpFlow() {
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "",
    phone_country_code: "+966",
    phone: "",
    study_year: "",
    research_consent: false,
  });
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await signupDirect({ data: form });
      const { error } = await supabase.auth.signInWithPassword({
        email: form.email.trim(),
        password: form.password,
      });
      if (error) throw error;
      await finalizeLogin();
      toast.success("تم إنشاء الحساب وتسجيل الدخول");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذّر إنشاء الحساب");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div>
        <Label>الاسم الكامل</Label>
        <Input required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
      </div>
      <div>
        <Label>البريد الإلكتروني</Label>
        <Input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
      </div>
      <div className="grid grid-cols-[120px_1fr] gap-2">
        <div>
          <Label>الدولة</Label>
          <Select
            value={form.phone_country_code}
            onValueChange={(v) => setForm({ ...form, phone_country_code: v })}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {COUNTRY_CODES.map((c) => (
                <SelectItem key={c.code} value={c.code}>{c.code} {c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>رقم الهاتف</Label>
          <Input
            required
            inputMode="numeric"
            pattern="\d{6,15}"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, "") })}
          />
        </div>
      </div>
      <div>
        <Label>السنة الدراسية (اختياري)</Label>
        <Input
          value={form.study_year}
          onChange={(e) => setForm({ ...form, study_year: e.target.value })}
          placeholder="مثال: السنة الثالثة"
        />
      </div>
      <div>
        <Label>كلمة المرور</Label>
        <Input
          type="password"
          required
          minLength={6}
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
        />
      </div>
      <label className="flex items-start gap-2 text-sm">
        <Checkbox
          checked={form.research_consent}
          onCheckedChange={(v) => setForm({ ...form, research_consent: v === true })}
        />
        <span>أوافق على استخدام بياناتي لأغراض البحث والتحسين</span>
      </label>
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? "جارٍ..." : "إنشاء الحساب"}
      </Button>
    </form>
  );
}


// =========== PASSWORD RESET 3-STEP ===========
function ForgotPasswordFlow() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);

  async function s1(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { requestPasswordResetOtp } = await import("@/lib/auth.functions");
      await requestPasswordResetOtp({ data: { email: email.trim() } });
      toast.success("إذا كان البريد مسجلاً، فقد تم إرسال الرمز");
      setStep(2);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطأ");
    } finally {
      setBusy(false);
    }
  }

  async function s2(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: otp.trim(),
        type: "email",
      });
      if (error) throw error;
      setStep(3);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "رمز غير صحيح");
    } finally {
      setBusy(false);
    }
  }

  async function s3(e: React.FormEvent) {
    e.preventDefault();
    if (pw !== pw2) return toast.error("كلمتا المرور غير متطابقتين");
    if (pw.length < 8) return toast.error("كلمة المرور 8 أحرف على الأقل");
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pw });
      if (error) throw error;
      const { finalizePasswordChange } = await import("@/lib/auth.functions");
      await finalizePasswordChange();
      await finalizeLogin();
      toast.success("تم تغيير كلمة المرور");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطأ");
    } finally {
      setBusy(false);
    }
  }

  if (step === 1) {
    return (
      <form onSubmit={s1} className="space-y-4">
        <div>
          <Label>البريد الإلكتروني</Label>
          <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "جارٍ..." : "إرسال رمز الاسترجاع"}
        </Button>
      </form>
    );
  }
  if (step === 2) {
    return (
      <form onSubmit={s2} className="space-y-4">
        <p className="text-sm text-muted-foreground">أدخل الرمز المُرسل إلى {email}</p>
        <Input
          inputMode="numeric"
          maxLength={6}
          required
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
          className="text-center text-2xl tracking-widest"
        />
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "جارٍ..." : "تحقق"}
        </Button>
      </form>
    );
  }
  return (
    <form onSubmit={s3} className="space-y-4">
      <div>
        <Label>كلمة المرور الجديدة</Label>
        <Input type="password" required minLength={6} value={pw} onChange={(e) => setPw(e.target.value)} />
      </div>
      <div>
        <Label>تأكيد كلمة المرور</Label>
        <Input type="password" required minLength={6} value={pw2} onChange={(e) => setPw2(e.target.value)} />
      </div>
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? "جارٍ..." : "تغيير وتسجيل الدخول"}
      </Button>
    </form>
  );
}

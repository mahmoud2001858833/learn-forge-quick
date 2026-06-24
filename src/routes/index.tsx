import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { GraduationCap, Layers, Users, Zap } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "EduForge — أنشئ منصتك التعليمية في دقائق" },
      { name: "description", content: "منصة شاملة لبناء وإطلاق منصتك التعليمية الخاصة بدورات، طلاب، وإدارة كاملة." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b">
        <div className="container mx-auto flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2 font-bold text-xl">
            <GraduationCap className="h-6 w-6 text-primary" />
            EduForge
          </div>
          <div className="flex items-center gap-3">
            <Link to="/auth"><Button variant="ghost">تسجيل الدخول</Button></Link>
            <Link to="/auth"><Button>ابدأ مجاناً</Button></Link>
          </div>
        </div>
      </header>

      <section className="container mx-auto px-6 py-24 text-center">
        <h1 className="text-5xl md:text-6xl font-bold tracking-tight">
          أنشئ منصتك التعليمية <span className="text-primary">في دقائق</span>
        </h1>
        <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
          منصة متكاملة لبناء أكاديميتك الإلكترونية الخاصة. أنشئ الدورات، أدر الطلاب، وابدأ التدريس فوراً.
        </p>
        <div className="mt-10 flex justify-center gap-4">
          <Link to="/auth">
            <Button size="lg" className="text-base">ابدأ مجاناً الآن</Button>
          </Link>
        </div>
      </section>

      <section className="container mx-auto px-6 py-20 grid md:grid-cols-3 gap-8">
        <Feature icon={Zap} title="إطلاق سريع" desc="منصتك جاهزة خلال 5 دقائق — اختر اللون، أضف اللوغو، وانطلق." />
        <Feature icon={Layers} title="إدارة دورات كاملة" desc="فصول، دروس فيديو، نصوص، PDF — كل شيء في مكان واحد." />
        <Feature icon={Users} title="إدارة الطلاب" desc="تتبع التقدم، التسجيلات، والإحصائيات لكل طالب." />
      </section>

      <footer className="border-t mt-20">
        <div className="container mx-auto px-6 py-8 text-center text-sm text-muted-foreground">
          © 2026 EduForge. جميع الحقوق محفوظة.
        </div>
      </footer>
    </div>
  );
}

function Feature({ icon: Icon, title, desc }: { icon: React.ComponentType<{ className?: string }>; title: string; desc: string }) {
  return (
    <div className="p-6 rounded-xl border bg-card">
      <Icon className="h-10 w-10 text-primary mb-4" />
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-muted-foreground">{desc}</p>
    </div>
  );
}

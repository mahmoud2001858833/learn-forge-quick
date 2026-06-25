import { Card, CardContent } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Star, Quote, BookOpen, Award, Users, Sparkles, CheckCircle2, Zap, Shield, Trophy, Heart, Target, Rocket } from "lucide-react";

export type Feature = { icon?: string; title: string; text: string };
export type Testimonial = { name: string; role?: string; avatar?: string; quote: string; rating?: number };
export type FAQItem = { q: string; a: string };
export type Stat = { value: string; label: string };

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  sparkles: Sparkles, book: BookOpen, award: Award, users: Users, check: CheckCircle2,
  zap: Zap, shield: Shield, trophy: Trophy, heart: Heart, target: Target, rocket: Rocket, star: Star,
};

export function FeaturesSection({ items, primary }: { items: Feature[]; primary: string }) {
  if (!items?.length) return null;
  return (
    <section className="container mx-auto px-6 py-16">
      <div className="text-center mb-10">
        <div className="text-sm font-semibold mb-1" style={{ color: primary }}>لماذا نحن</div>
        <h2 className="text-3xl font-bold">ما يميّز منصتنا</h2>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((f, i) => {
          const Icon = ICONS[f.icon ?? "sparkles"] ?? Sparkles;
          return (
            <Card key={i} className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="h-12 w-12 rounded-xl grid place-items-center text-white mb-4" style={{ background: primary }}>
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="font-bold text-lg mb-2">{f.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{f.text}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}

export function StatsSection({ items, primary, secondary }: { items: Stat[]; primary: string; secondary: string }) {
  if (!items?.length) return null;
  return (
    <section className="container mx-auto px-6 py-12">
      <div className="rounded-3xl p-8 md:p-12 text-white shadow-xl" style={{ background: `linear-gradient(135deg, ${primary}, ${secondary})` }}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {items.map((s, i) => (
            <div key={i}>
              <div className="text-4xl md:text-5xl font-black mb-1">{s.value}</div>
              <div className="text-sm text-white/80">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function TestimonialsSection({ items, primary }: { items: Testimonial[]; primary: string }) {
  if (!items?.length) return null;
  return (
    <section className="container mx-auto px-6 py-16">
      <div className="text-center mb-10">
        <div className="text-sm font-semibold mb-1" style={{ color: primary }}>آراء طلابنا</div>
        <h2 className="text-3xl font-bold">ماذا يقول المتعلّمون</h2>
      </div>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((t, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <Quote className="h-6 w-6 mb-3" style={{ color: primary }} />
              <p className="text-sm leading-relaxed mb-4">{t.quote}</p>
              {t.rating ? (
                <div className="flex gap-0.5 mb-3">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <Star key={j} className={`h-4 w-4 ${j < t.rating! ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />
                  ))}
                </div>
              ) : null}
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10"><AvatarImage src={t.avatar} /><AvatarFallback>{t.name.charAt(0)}</AvatarFallback></Avatar>
                <div><div className="font-semibold text-sm">{t.name}</div>{t.role && <div className="text-xs text-muted-foreground">{t.role}</div>}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

export function FaqSection({ items, primary }: { items: FAQItem[]; primary: string }) {
  if (!items?.length) return null;
  return (
    <section className="container mx-auto px-6 py-16 max-w-3xl">
      <div className="text-center mb-8">
        <div className="text-sm font-semibold mb-1" style={{ color: primary }}>أسئلة شائعة</div>
        <h2 className="text-3xl font-bold">إجابات قد تهمّك</h2>
      </div>
      <Accordion type="single" collapsible className="bg-card rounded-2xl border px-6">
        {items.map((f, i) => (
          <AccordionItem key={i} value={`${i}`}>
            <AccordionTrigger className="text-right font-semibold">{f.q}</AccordionTrigger>
            <AccordionContent className="text-muted-foreground leading-relaxed whitespace-pre-wrap">{f.a}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}

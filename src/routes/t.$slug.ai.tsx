import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { chatWithTenantTutor } from "@/lib/ai-tutor.functions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Send, Bot, User, BookOpen, Loader2, LogIn } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/t/$slug/ai")({
  ssr: false,
  component: TenantAIPage,
});

type ChatMsg = { role: "user" | "assistant"; content: string };

function TenantAIPage() {
  const { slug } = useParams({ from: "/t/$slug/ai" });
  const { session, loading: authLoading } = useAuth();

  const { data: tenant } = useQuery({
    queryKey: ["public-tenant", slug],
    queryFn: async () => (await supabase.from("tenants").select("id, name, primary_color, secondary_color, logo_url").eq("slug", slug).maybeSingle()).data,
  });

  const { data: courses } = useQuery({
    enabled: !!tenant?.id && !!session,
    queryKey: ["tenant-courses-for-ai", tenant?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("courses")
        .select("id, title")
        .eq("tenant_id", tenant!.id)
        .eq("status", "published")
        .order("created_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });

  const [courseId, setCourseId] = useState<string | "all">("all");
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  if (!tenant) return <div className="p-10 text-center text-muted-foreground">جارٍ التحميل...</div>;

  const primary = tenant.primary_color ?? "#6366f1";
  const secondary = tenant.secondary_color ?? "#D4AF37";

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    const next: ChatMsg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const res = await chatWithTenantTutor({
        data: {
          tenant_id: tenant!.id,
          course_id: courseId === "all" ? null : courseId,
          messages: next.slice(-20),
        },
      });
      setMessages([...next, { role: "assistant", content: res.text }]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "خطأ";
      toast.error(msg);
      setMessages(next);
    } finally {
      setBusy(false);
    }
  }

  // Not signed in → CTA
  if (!authLoading && !session) {
    return (
      <div className="container mx-auto max-w-2xl px-6 py-20 text-center">
        <div className="inline-flex h-16 w-16 rounded-2xl items-center justify-center mb-5 text-white" style={{ background: `linear-gradient(135deg, ${primary}, ${secondary})` }}>
          <Sparkles className="h-8 w-8" />
        </div>
        <h1 className="text-3xl font-bold mb-3">المساعد الذكي لـ {tenant.name}</h1>
        <p className="text-muted-foreground mb-6">
          اطرح أسئلتك حول الدورات وستحصل على إجابات فورية مدعومة بالذكاء الاصطناعي.
          يجب تسجيل الدخول والاشتراك بإحدى الدورات لاستخدام المساعد.
        </p>
        <Link to="/t/$slug/auth" params={{ slug }} search={{ mode: "signin" }}>
          <Button size="lg" className="text-white border-0" style={{ background: `linear-gradient(135deg, ${primary}, ${secondary})` }}>
            <LogIn className="h-4 w-4 ms-2" /> تسجيل الدخول
          </Button>
        </Link>
      </div>
    );
  }

  const suggestions = [
    "لخّص لي أهم نقاط الدورة",
    "ما الذي يجب أن أتعلمه أولاً؟",
    "اشرح لي مفهوماً صعباً بأسلوب مبسّط",
    "اقترح لي خطة دراسة أسبوعية",
  ];

  return (
    <div className="container mx-auto max-w-4xl px-4 py-6 sm:py-10">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl grid place-items-center text-white shadow-md" style={{ background: `linear-gradient(135deg, ${primary}, ${secondary})` }}>
            <Sparkles className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold leading-tight">المساعد الذكي</h1>
            <p className="text-xs text-muted-foreground">مدعوم بالذكاء الاصطناعي · {tenant.name}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 min-w-[200px]">
          <BookOpen className="h-4 w-4 text-muted-foreground" />
          <Select value={courseId} onValueChange={(v) => setCourseId(v as string)}>
            <SelectTrigger className="text-xs"><SelectValue placeholder="السياق" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">عام (كل المنصة)</SelectItem>
              {courses?.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Chat area */}
      <Card className="flex flex-col h-[65vh] overflow-hidden">
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center px-6">
              <div className="h-16 w-16 rounded-full grid place-items-center mb-4" style={{ background: `${primary}15`, color: primary }}>
                <Bot className="h-8 w-8" />
              </div>
              <h2 className="text-lg font-bold mb-2">مرحباً! كيف يمكنني مساعدتك؟</h2>
              <p className="text-sm text-muted-foreground mb-6 max-w-md">
                اسألني عن أي درس، اطلب شرحاً مبسطاً، أو احصل على خطة دراسة. أنا هنا لمساعدتك على التعلّم بشكل أسرع.
              </p>
              <div className="grid sm:grid-cols-2 gap-2 w-full max-w-md">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => setInput(s)}
                    className="text-xs sm:text-sm text-start border rounded-xl px-3 py-2 hover:bg-accent transition"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <MessageBubble key={i} msg={m} primary={primary} secondary={secondary} />
          ))}

          {busy && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> يفكّر المساعد...
            </div>
          )}
        </div>

        {/* Input */}
        <div className="border-t p-3 bg-muted/30">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="flex items-end gap-2"
          >
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="اكتب سؤالك هنا... (Enter للإرسال، Shift+Enter لسطر جديد)"
              rows={2}
              className="resize-none bg-background"
              disabled={busy}
            />
            <Button
              type="submit"
              disabled={busy || !input.trim()}
              className="text-white border-0 shrink-0 h-auto py-3"
              style={{ background: `linear-gradient(135deg, ${primary}, ${secondary})` }}
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
          <p className="text-[10px] text-muted-foreground mt-2 text-center">
            قد يخطئ الذكاء الاصطناعي — تحقّق دائماً من المعلومات المهمة.
          </p>
        </div>
      </Card>
    </div>
  );
}

function MessageBubble({ msg, primary, secondary }: { msg: ChatMsg; primary: string; secondary: string }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex gap-2 ${isUser ? "flex-row-reverse" : ""}`}>
      <div
        className={`h-8 w-8 rounded-full grid place-items-center shrink-0 ${isUser ? "text-white" : ""}`}
        style={
          isUser
            ? { background: `linear-gradient(135deg, ${primary}, ${secondary})` }
            : { background: `${primary}15`, color: primary }
        }
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
          isUser ? "text-white" : "bg-muted"
        }`}
        style={isUser ? { background: `linear-gradient(135deg, ${primary}, ${secondary})` } : undefined}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed prose-p:my-2 prose-headings:my-3 prose-ul:my-2">
            <ReactMarkdown>{msg.content}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}

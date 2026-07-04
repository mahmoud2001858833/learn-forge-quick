import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageCircle, X, Send, LogIn } from "lucide-react";
import { Link, useParams } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_role: "student" | "admin";
  body: string;
  created_at: string;
};

type Props = {
  tenantId: string;
  tenantName: string;
  primaryColor: string;
  secondaryColor: string;
};

export function FloatingChat({ tenantId, tenantName, primaryColor, secondaryColor }: Props) {
  const qc = useQueryClient();
  const { slug } = useParams({ strict: false }) as { slug?: string };
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: session } = useQuery({
    queryKey: ["auth-session"],
    queryFn: async () => (await supabase.auth.getSession()).data.session,
  });

  const userId = session?.user?.id ?? null;

  // Get or create conversation when opened
  const { data: conversation } = useQuery({
    queryKey: ["chat-conv", tenantId, userId],
    enabled: !!userId && open,
    queryFn: async () => {
      const { data: existing } = await supabase
        .from("chat_conversations")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("student_id", userId!)
        .maybeSingle();
      if (existing) return existing;
      const { data: created, error } = await supabase
        .from("chat_conversations")
        .insert({ tenant_id: tenantId, student_id: userId! })
        .select()
        .single();
      if (error) throw error;
      return created;
    },
  });

  const { data: messages = [] } = useQuery({
    queryKey: ["chat-msgs", conversation?.id],
    enabled: !!conversation,
    queryFn: async () => {
      const { data } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("conversation_id", conversation!.id)
        .order("created_at");
      return (data ?? []) as Message[];
    },
  });

  // Unread count badge (always polled lightly even when closed)
  const { data: unread = 0 } = useQuery({
    queryKey: ["chat-unread", tenantId, userId],
    enabled: !!userId,
    refetchInterval: 30000,
    queryFn: async () => {
      const { data } = await supabase
        .from("chat_conversations")
        .select("unread_student")
        .eq("tenant_id", tenantId)
        .eq("student_id", userId!)
        .maybeSingle();
      return data?.unread_student ?? 0;
    },
  });

  // Realtime: subscribe to new messages in this conversation
  useEffect(() => {
    if (!conversation?.id) return;
    const channel = supabase
      .channel(`chat-${conversation.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", filter: `conversation_id=eq.${conversation.id}` },
        () => {
          qc.invalidateQueries({ queryKey: ["chat-msgs", conversation.id] });
          qc.invalidateQueries({ queryKey: ["chat-unread", tenantId, userId] });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversation?.id, qc, tenantId, userId]);

  // Auto-scroll
  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open]);

  // Mark as read when opened
  useEffect(() => {
    if (open && conversation?.id && conversation.unread_student > 0) {
      supabase
        .from("chat_conversations")
        .update({ unread_student: 0 })
        .eq("id", conversation.id)
        .then(() => {
          qc.invalidateQueries({ queryKey: ["chat-unread", tenantId, userId] });
        });
    }
  }, [open, conversation?.id, conversation?.unread_student, qc, tenantId, userId]);

  async function send() {
    if (!body.trim() || !conversation || !userId || sending) return;
    setSending(true);
    const text = body.trim();
    setBody("");
    const { error } = await supabase.from("chat_messages").insert({
      conversation_id: conversation.id,
      tenant_id: tenantId,
      sender_id: userId,
      sender_role: "student",
      body: text,
    });
    if (error) {
      setBody(text);
    } else {
      qc.invalidateQueries({ queryKey: ["chat-msgs", conversation.id] });
    }
    setSending(false);
  }

  return (
    <>
      {/* Floating button */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="محادثة مع الإدارة"
        className="fixed bottom-6 left-6 z-50 h-14 w-14 rounded-full shadow-2xl grid place-items-center text-white transition-all hover:scale-110 active:scale-95"
        style={{ background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})` }}
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
        {!open && unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-[11px] font-bold grid place-items-center ring-2 ring-background">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div
          className="fixed bottom-24 left-6 z-50 w-[92vw] max-w-sm h-[min(560px,75vh)] rounded-2xl shadow-2xl border bg-background flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-200"
          dir="rtl"
        >
          {/* Header */}
          <div
            className="px-4 py-3 text-white flex items-center justify-between shrink-0"
            style={{ background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})` }}
          >
            <div>
              <div className="font-bold text-sm">دعم {tenantName}</div>
              <div className="text-[11px] opacity-90">عادة نرد خلال دقائق</div>
            </div>
            <button onClick={() => setOpen(false)} className="opacity-80 hover:opacity-100" aria-label="إغلاق">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Body */}
          {!userId ? (
            <div className="flex-1 grid place-items-center p-6 text-center">
              <div>
                <LogIn className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
                <p className="font-semibold mb-1">سجّل الدخول للمحادثة</p>
                <p className="text-sm text-muted-foreground mb-4">لإرسال رسالة لإدارة المنصة يجب تسجيل الدخول أولاً</p>
                <Link to="/t/$slug/auth" params={{ slug: slug ?? "" }} search={{ mode: "signin" as const }}>
                  <Button size="sm" style={{ background: primaryColor }} className="text-white">تسجيل الدخول</Button>
                </Link>
              </div>
            </div>
          ) : (
            <>
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-muted/20">
                {messages.length === 0 ? (
                  <div className="text-center text-sm text-muted-foreground py-8">
                    👋 أهلاً بك! اكتب رسالتك وسيرد عليك فريق الإدارة.
                  </div>
                ) : (
                  messages.map((m) => (
                    <div
                      key={m.id}
                      className={`flex ${m.sender_role === "student" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm shadow-sm ${
                          m.sender_role === "student"
                            ? "rounded-bl-md text-white"
                            : "rounded-br-md bg-background border"
                        }`}
                        style={
                          m.sender_role === "student"
                            ? { background: primaryColor }
                            : undefined
                        }
                      >
                        <div className="whitespace-pre-wrap break-words">{m.body}</div>
                        <div className={`text-[10px] mt-1 ${m.sender_role === "student" ? "opacity-80" : "text-muted-foreground"}`}>
                          {new Date(m.created_at).toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="border-t p-3 bg-background shrink-0">
                <div className="flex items-end gap-2">
                  <Textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        send();
                      }
                    }}
                    placeholder="اكتب رسالتك..."
                    rows={1}
                    className="min-h-[40px] max-h-32 resize-none text-sm"
                    disabled={sending}
                  />
                  <Button
                    size="icon"
                    onClick={send}
                    disabled={!body.trim() || sending}
                    style={{ background: primaryColor }}
                    className="text-white shrink-0"
                    aria-label="إرسال"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}

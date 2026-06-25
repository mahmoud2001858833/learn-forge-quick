import { createFileRoute, useParams } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Send, Search, MessageCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/$tenantSlug/chat")({
  component: AdminChat,
});

type Conv = {
  id: string;
  tenant_id: string;
  student_id: string;
  last_message_at: string;
  last_message_preview: string | null;
  unread_admin: number;
  status: string;
};
type Msg = {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_role: "student" | "admin";
  body: string;
  created_at: string;
};

function AdminChat() {
  const { tenantSlug } = useParams({ from: "/_authenticated/admin/$tenantSlug/chat" });
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: tenant } = useQuery({
    queryKey: ["admin-tenant", tenantSlug],
    queryFn: async () => (await supabase.from("tenants").select("id,name,primary_color").eq("slug", tenantSlug).single()).data,
  });

  const { data: session } = useQuery({
    queryKey: ["auth-session"],
    queryFn: async () => (await supabase.auth.getSession()).data.session,
  });
  const adminId = session?.user?.id ?? null;

  const { data: conversations = [] } = useQuery({
    queryKey: ["admin-chat-convs", tenant?.id],
    enabled: !!tenant,
    refetchInterval: 15000,
    queryFn: async () => {
      const { data } = await supabase
        .from("chat_conversations")
        .select("*")
        .eq("tenant_id", tenant!.id)
        .order("last_message_at", { ascending: false });
      return (data ?? []) as Conv[];
    },
  });

  // Fetch student names
  const studentIds = conversations.map((c) => c.student_id);
  const { data: profiles = [] } = useQuery({
    queryKey: ["admin-chat-profiles", studentIds.join(",")],
    enabled: studentIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name").in("id", studentIds);
      return data ?? [];
    },
  });
  const nameOf = (id: string) => profiles.find((p) => p.id === id)?.full_name ?? "طالب";

  const filteredConvs = conversations.filter((c) => {
    if (!search) return true;
    return nameOf(c.student_id).toLowerCase().includes(search.toLowerCase());
  });

  const { data: messages = [] } = useQuery({
    queryKey: ["admin-chat-msgs", selectedId],
    enabled: !!selectedId,
    queryFn: async () => {
      const { data } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("conversation_id", selectedId!)
        .order("created_at");
      return (data ?? []) as Msg[];
    },
  });

  // Realtime
  useEffect(() => {
    if (!tenant?.id) return;
    const channel = supabase
      .channel(`admin-chat-${tenant.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_messages", filter: `tenant_id=eq.${tenant.id}` },
        (payload) => {
          qc.invalidateQueries({ queryKey: ["admin-chat-convs", tenant.id] });
          const convId = (payload.new as Msg | undefined)?.conversation_id;
          if (convId) qc.invalidateQueries({ queryKey: ["admin-chat-msgs", convId] });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenant?.id, qc]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  // Mark as read when conversation opened
  useEffect(() => {
    if (!selectedId) return;
    const conv = conversations.find((c) => c.id === selectedId);
    if (conv && conv.unread_admin > 0) {
      supabase.from("chat_conversations").update({ unread_admin: 0 }).eq("id", selectedId).then(() => {
        qc.invalidateQueries({ queryKey: ["admin-chat-convs", tenant?.id] });
      });
    }
  }, [selectedId, conversations, tenant?.id, qc]);

  async function send() {
    if (!body.trim() || !selectedId || !adminId || !tenant?.id || sending) return;
    setSending(true);
    const text = body.trim();
    setBody("");
    const { error } = await supabase.from("chat_messages").insert({
      conversation_id: selectedId,
      tenant_id: tenant.id,
      sender_id: adminId,
      sender_role: "admin",
      body: text,
    });
    if (error) setBody(text);
    else qc.invalidateQueries({ queryKey: ["admin-chat-msgs", selectedId] });
    setSending(false);
  }

  const primary = tenant?.primary_color ?? "#6366f1";

  return (
    <div className="h-[calc(100vh-120px)] grid grid-cols-1 md:grid-cols-[320px_1fr] gap-0 border rounded-2xl overflow-hidden bg-card" dir="rtl">
      {/* Sidebar */}
      <div className="border-l flex flex-col bg-muted/20">
        <div className="p-3 border-b">
          <h2 className="font-bold mb-2 flex items-center gap-2">
            <MessageCircle className="h-4 w-4" />
            المحادثات ({conversations.length})
          </h2>
          <div className="relative">
            <Search className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث..." className="pr-8 h-9 text-sm" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filteredConvs.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">لا توجد محادثات</div>
          ) : (
            filteredConvs.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                className={`w-full text-right p-3 border-b hover:bg-accent transition-colors ${selectedId === c.id ? "bg-accent" : ""}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-sm truncate">{nameOf(c.student_id)}</div>
                    <div className="text-xs text-muted-foreground truncate mt-0.5">
                      {c.last_message_preview ?? "—"}
                    </div>
                  </div>
                  {c.unread_admin > 0 && (
                    <span className="shrink-0 min-w-[20px] h-5 px-1.5 rounded-full text-white text-[11px] font-bold grid place-items-center" style={{ background: primary }}>
                      {c.unread_admin}
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-muted-foreground mt-1">
                  {new Date(c.last_message_at).toLocaleString("ar", { dateStyle: "short", timeStyle: "short" })}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Conversation pane */}
      {!selectedId ? (
        <div className="grid place-items-center text-muted-foreground p-8 text-center">
          <div>
            <MessageCircle className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>اختر محادثة للعرض والرد</p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col">
          <div className="px-4 py-3 border-b font-semibold">
            {nameOf(conversations.find((c) => c.id === selectedId)?.student_id ?? "")}
          </div>
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-muted/10">
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.sender_role === "admin" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[70%] px-3 py-2 rounded-2xl text-sm shadow-sm ${
                    m.sender_role === "admin" ? "text-white" : "bg-background border"
                  }`}
                  style={m.sender_role === "admin" ? { background: primary } : undefined}
                >
                  <div className="whitespace-pre-wrap break-words">{m.body}</div>
                  <div className={`text-[10px] mt-1 ${m.sender_role === "admin" ? "opacity-80" : "text-muted-foreground"}`}>
                    {new Date(m.created_at).toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="border-t p-3 bg-background">
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
                placeholder="اكتب ردك..."
                rows={1}
                className="min-h-[40px] max-h-32 resize-none"
                disabled={sending}
              />
              <Button onClick={send} disabled={!body.trim() || sending} style={{ background: primary }} className="text-white">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

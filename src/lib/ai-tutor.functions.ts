import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// ----------------------------------------------------------------------------
// Authorization helper
// ----------------------------------------------------------------------------
async function ensureTenantAccess(supabase: any, tenantId: string, userId: string) {
  const { data: member } = await supabase
    .from("tenant_members")
    .select("user_id")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .maybeSingle();
  if (member) return;

  const { data: enrol } = await supabase
    .from("enrollments")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("student_id", userId)
    .limit(1)
    .maybeSingle();

  if (!enrol) {
    throw new Error("ليس لديك صلاحية لاستخدام المساعد في هذه المنصة. يجب التسجيل في إحدى الدورات أولاً.");
  }
}

// ----------------------------------------------------------------------------
// List conversations for the current user in a tenant
// ----------------------------------------------------------------------------
export const listAiConversations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ tenant_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: rows, error } = await supabase
      .from("ai_conversations")
      .select("id, title, course_id, updated_at, created_at")
      .eq("tenant_id", data.tenant_id)
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

// ----------------------------------------------------------------------------
// Get messages of a conversation
// ----------------------------------------------------------------------------
export const getAiConversation = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ conversation_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: conv, error } = await supabase
      .from("ai_conversations")
      .select("id, title, tenant_id, course_id")
      .eq("id", data.conversation_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!conv) throw new Error("المحادثة غير موجودة");
    const { data: msgs } = await supabase
      .from("ai_messages")
      .select("role, content, created_at")
      .eq("conversation_id", data.conversation_id)
      .order("created_at", { ascending: true });
    return { conversation: conv, messages: (msgs ?? []) as { role: "user" | "assistant"; content: string; created_at: string }[] };
  });

// ----------------------------------------------------------------------------
// Delete a conversation
// ----------------------------------------------------------------------------
export const deleteAiConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ conversation_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("ai_conversations").delete().eq("id", data.conversation_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ----------------------------------------------------------------------------
// Chat: optionally creates conversation, persists messages, returns reply
// ----------------------------------------------------------------------------
const ChatInput = z.object({
  tenant_id: z.string().uuid(),
  course_id: z.string().uuid().optional().nullable(),
  conversation_id: z.string().uuid().optional().nullable(),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(4000),
      }),
    )
    .min(1)
    .max(30),
});

export const chatWithTenantTutor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => ChatInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensureTenantAccess(supabase, data.tenant_id, userId);

    // ----- Tenant context -----
    const { data: tenant } = await supabase
      .from("tenants")
      .select("name, description, welcome_message")
      .eq("id", data.tenant_id)
      .maybeSingle();

    // ----- Course + lesson RAG context -----
    let courseCtx = "";
    if (data.course_id) {
      const { data: course } = await supabase
        .from("courses")
        .select("title, short_description, description")
        .eq("id", data.course_id)
        .maybeSingle();

      if (course) {
        // Fetch lessons with actual text content (RAG-lite)
        const { data: lessons } = await supabase
          .from("lessons")
          .select("title, content_text, sections!inner(course_id, title, order_index)")
          .eq("sections.course_id", data.course_id)
          .order("order_index", { ascending: true })
          .limit(60);

        // Naive retrieval: pick lessons whose title/content overlap with last user message keywords
        const lastUser = [...data.messages].reverse().find((m) => m.role === "user")?.content ?? "";
        const keywords = lastUser
          .toLowerCase()
          .split(/\s+/)
          .filter((w) => w.length >= 3)
          .slice(0, 12);

        const scored = (lessons ?? []).map((l: any) => {
          const hay = `${l.title} ${l.content_text ?? ""}`.toLowerCase();
          const score = keywords.reduce((s, k) => s + (hay.includes(k) ? 1 : 0), 0);
          return { l, score };
        });
        scored.sort((a, b) => b.score - a.score);

        const topLessons = scored.slice(0, 6).filter((s) => s.score > 0 || keywords.length === 0).slice(0, 6);
        const lessonChunks = topLessons
          .map(({ l }) => {
            const txt = (l.content_text ?? "").trim();
            const excerpt = txt ? txt.slice(0, 700) : "(لا يوجد نص للدرس)";
            return `### ${l.title}\n${excerpt}`;
          })
          .join("\n\n");

        const allTitles = (lessons ?? []).map((l: any) => `- ${l.title}`).join("\n");

        courseCtx = `

السياق - الدورة الحالية:
العنوان: ${course.title}
${course.short_description ? `نبذة: ${course.short_description}` : ""}
${course.description ? `الوصف: ${course.description.slice(0, 500)}` : ""}

عناوين كل الدروس:
${allTitles}

${lessonChunks ? `مقتطفات من الدروس الأكثر صلة بالسؤال:\n${lessonChunks}` : ""}`;
      }
    }

    const system = `أنت مساعد تعليمي ذكي لمنصة "${tenant?.name ?? ""}".
${tenant?.description ? `وصف المنصة: ${tenant.description}` : ""}
${tenant?.welcome_message ? `رسالة المنصة: ${tenant.welcome_message}` : ""}
${courseCtx}

التعليمات:
- ردّ باللغة العربية الفصحى المبسطة.
- اعتمد أساساً على "مقتطفات الدروس" أعلاه عند الإجابة، واذكر اسم الدرس بين قوسين عند الاقتباس.
- إذا لم تتوفر المعلومة في الدروس، قل بصراحة أنها غير مذكورة، ثم قدّم إجابة عامة موجزة.
- لا تختلق محتوى للدورة.
- استخدم تنسيق Markdown مع عناوين قصيرة ونقاط عند الحاجة.
- اجعل ردودك واضحة ومنظّمة (3-6 فقرات قصيرة كحد أقصى).`;

    const { getAiModel } = await import("@/integrations/ai/gateway.server");
    const { generateText } = await import("ai");

    let replyText = "";
    try {
      const model = getAiModel();
      const result = await generateText({
        model,
        messages: [
          { role: "system", content: system },
          ...data.messages.map((m) => ({ role: m.role, content: m.content })),
        ],
      });
      replyText = result.text;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "تعذّر الحصول على رد";
      if (msg.includes("429")) throw new Error("تم تجاوز حد الاستخدام مؤقتاً، حاول لاحقاً.");
      if (msg.includes("402")) throw new Error("تم استنفاد رصيد الذكاء الاصطناعي للمنصة.");
      throw new Error(msg);
    }

    // ----- Persist conversation + messages -----
    let conversationId: string;
    const lastUserMsg = [...data.messages].reverse().find((m) => m.role === "user")?.content ?? "محادثة";

    if (!data.conversation_id) {
      const title = lastUserMsg.slice(0, 60);
      const { data: conv, error: convErr } = await supabase
        .from("ai_conversations")
        .insert({
          tenant_id: data.tenant_id,
          user_id: userId,
          course_id: data.course_id ?? null,
          title,
        })
        .select("id")
        .single();
      if (convErr) throw new Error(convErr.message);
      conversationId = conv.id;

      const rowsToInsert = [
        ...data.messages.map((m) => ({ conversation_id: conversationId, role: m.role, content: m.content })),
        { conversation_id: conversationId, role: "assistant", content: replyText },
      ];
      await supabase.from("ai_messages").insert(rowsToInsert);
    } else {
      conversationId = data.conversation_id;
      const lastClientMsg = data.messages[data.messages.length - 1];
      const rows: { conversation_id: string; role: string; content: string }[] = [];
      if (lastClientMsg && lastClientMsg.role === "user") {
        rows.push({ conversation_id: conversationId, role: "user", content: lastClientMsg.content });
      }
      rows.push({ conversation_id: conversationId, role: "assistant", content: replyText });
      await supabase.from("ai_messages").insert(rows);
      await supabase.from("ai_conversations").update({ updated_at: new Date().toISOString() }).eq("id", conversationId);
    }

    return { text: replyText, conversation_id: conversationId };
  });

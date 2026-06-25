import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const ChatInput = z.object({
  tenant_id: z.string().uuid(),
  course_id: z.string().uuid().optional().nullable(),
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

    // Authorize: user must be a tenant member OR be enrolled in the tenant
    const { data: member } = await supabase
      .from("tenant_members")
      .select("user_id")
      .eq("tenant_id", data.tenant_id)
      .eq("user_id", userId)
      .maybeSingle();

    if (!member) {
      const { data: enrol } = await supabase
        .from("enrollments")
        .select("id")
        .eq("tenant_id", data.tenant_id)
        .eq("student_id", userId)
        .limit(1)
        .maybeSingle();
      if (!enrol) {
        throw new Error("ليس لديك صلاحية لاستخدام المساعد في هذه المنصة. يجب التسجيل في إحدى الدورات أولاً.");
      }
    }

    // Build tenant + (optional) course context
    const { data: tenant } = await supabase
      .from("tenants")
      .select("name, description, welcome_message")
      .eq("id", data.tenant_id)
      .maybeSingle();

    let courseCtx = "";
    if (data.course_id) {
      const { data: course } = await supabase
        .from("courses")
        .select("title, short_description, description")
        .eq("id", data.course_id)
        .maybeSingle();

      if (course) {
        const { data: lessons } = await supabase
          .from("lessons")
          .select("title, sections!inner(course_id)")
          .eq("sections.course_id", data.course_id)
          .limit(40);

        const lessonTitles = (lessons ?? [])
          .map((l: { title: string }) => `- ${l.title}`)
          .join("\n");

        courseCtx = `

السياق - الدورة الحالية:
العنوان: ${course.title}
${course.short_description ? `نبذة: ${course.short_description}` : ""}
${course.description ? `الوصف: ${course.description.slice(0, 600)}` : ""}
${lessonTitles ? `\nعناوين الدروس:\n${lessonTitles}` : ""}`;
      }
    }

    const system = `أنت مساعد تعليمي ذكي لمنصة "${tenant?.name ?? ""}".
${tenant?.description ? `وصف المنصة: ${tenant.description}` : ""}
${tenant?.welcome_message ? `رسالة المنصة: ${tenant.welcome_message}` : ""}
${courseCtx}

التعليمات:
- ردّ باللغة العربية الفصحى المبسطة.
- اشرح بطريقة تعليمية واضحة مع أمثلة.
- إذا سُئلت عن موضوع خارج الدورة/المنصة، أجب بشكل عام ثم وجّه الطالب لمحتوى المنصة.
- لا تختلق معلومات عن الدورة؛ إذا لم تكن متأكداً، اطلب من الطالب مراجعة الدرس المعني.
- اجعل ردودك مختصرة (3-6 فقرات قصيرة كحد أقصى) واستخدم تنسيق Markdown عند الحاجة.`;

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY غير مضبوط");

    const { createLovableAi } = await import("@/integrations/ai/gateway.server");
    const { generateText } = await import("ai");

    const provider = createLovableAi(apiKey);
    const model = provider("google/gemini-3-flash-preview");

    try {
      const result = await generateText({
        model,
        messages: [
          { role: "system", content: system },
          ...data.messages.map((m) => ({ role: m.role, content: m.content })),
        ],
      });
      return { text: result.text };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "تعذّر الحصول على رد";
      if (msg.includes("429")) throw new Error("تم تجاوز حد الاستخدام مؤقتاً، حاول لاحقاً.");
      if (msg.includes("402")) throw new Error("تم استنفاد رصيد الذكاء الاصطناعي للمنصة.");
      throw new Error(msg);
    }
  });

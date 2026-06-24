import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const slugRegex = /^[a-z0-9-]{3,40}$/;

const createTenantSchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z.string().regex(slugRegex),
  description: z.string().max(500).optional().nullable(),
  primary_color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#6366f1"),
  secondary_color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#D4AF37"),
  currency: z.string().min(3).max(5).default("SAR"),
  welcome_message: z.string().max(500).optional().nullable(),
});

export const createTenant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createTenantSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Reject reserved slugs
    const reserved = new Set(["admin", "auth", "dashboard", "api", "learn", "t", "onboard", "super-admin"]);
    if (reserved.has(data.slug)) throw new Error("هذا المعرّف محجوز");

    const { data: existing } = await supabaseAdmin
      .from("tenants")
      .select("id")
      .eq("slug", data.slug)
      .maybeSingle();
    if (existing) throw new Error("المعرّف مستخدم، اختر معرّفاً آخر");

    const { data: tenant, error } = await supabaseAdmin
      .from("tenants")
      .insert({
        name: data.name,
        slug: data.slug,
        description: data.description ?? null,
        primary_color: data.primary_color,
        secondary_color: data.secondary_color,
        currency: data.currency,
        welcome_message: data.welcome_message ?? null,
        owner_id: context.userId,
        status: "active",
        activated_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { tenant };
  });

export const setTenantStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      tenant_id: z.string().uuid(),
      status: z.enum(["active", "suspended", "trial"]),
      reason: z.string().max(500).optional().nullable(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: isSuper } = await supabaseAdmin.rpc("has_role", {
      _user_id: context.userId,
      _role: "super_admin",
    });
    if (!isSuper) throw new Error("صلاحيات السوبر-أدمن مطلوبة");

    const patch: Record<string, unknown> = { status: data.status };
    if (data.status === "suspended") {
      patch.suspended_at = new Date().toISOString();
      patch.suspension_reason = data.reason ?? null;
    } else if (data.status === "active") {
      patch.suspended_at = null;
      patch.suspension_reason = null;
      patch.activated_at = new Date().toISOString();
    }
    const { error } = await supabaseAdmin.from("tenants").update(patch).eq("id", data.tenant_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const grantSuperAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ email: z.string().trim().email() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Allow only existing super_admin, OR bootstrap if no super_admin exists yet
    const { count } = await supabaseAdmin
      .from("user_roles")
      .select("*", { count: "exact", head: true })
      .eq("role", "super_admin");

    if ((count ?? 0) > 0) {
      const { data: isSuper } = await supabaseAdmin.rpc("has_role", {
        _user_id: context.userId,
        _role: "super_admin",
      });
      if (!isSuper) throw new Error("صلاحيات السوبر-أدمن مطلوبة");
    }

    const { data: list } = await supabaseAdmin.auth.admin.listUsers();
    const user = list?.users.find((u) => u.email?.toLowerCase() === data.email.toLowerCase());
    if (!user) throw new Error("لا يوجد مستخدم بهذا البريد");

    const { error } = await supabaseAdmin.from("user_roles").insert({
      user_id: user.id,
      role: "super_admin",
    });
    if (error && !error.message.includes("duplicate")) throw new Error(error.message);

    // Also add to admin_emails whitelist
    await supabaseAdmin
      .from("admin_emails")
      .upsert({ email: data.email.toLowerCase(), note: "super_admin" }, { onConflict: "email" });

    return { ok: true };
  });

export const listAllTenantsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: isSuper } = await supabaseAdmin.rpc("has_role", {
      _user_id: context.userId,
      _role: "super_admin",
    });
    if (!isSuper) throw new Error("ممنوع");

    const { data, error } = await supabaseAdmin
      .from("tenants")
      .select("*, platform_settings(maintenance_mode, marquee_enabled)")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { tenants: data ?? [] };
  });

export const getPlatformStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: isSuper } = await supabaseAdmin.rpc("has_role", {
      _user_id: context.userId,
      _role: "super_admin",
    });
    if (!isSuper) throw new Error("ممنوع");

    const [tenants, users, courses, enrollments] = await Promise.all([
      supabaseAdmin.from("tenants").select("*", { count: "exact", head: true }),
      supabaseAdmin.from("profiles").select("*", { count: "exact", head: true }),
      supabaseAdmin.from("courses").select("*", { count: "exact", head: true }),
      supabaseAdmin.from("enrollments").select("*", { count: "exact", head: true }),
    ]);

    return {
      tenants: tenants.count ?? 0,
      users: users.count ?? 0,
      courses: courses.count ?? 0,
      enrollments: enrollments.count ?? 0,
    };
  });

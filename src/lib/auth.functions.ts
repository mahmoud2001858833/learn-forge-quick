import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MASTER_CODE = "112233";

// ============= SIGNUP via OTP =============

const signupSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(72),
  full_name: z.string().trim().min(2).max(100),
  phone_country_code: z.string().regex(/^\+\d{1,4}$/),
  phone: z.string().regex(/^\d{6,15}$/),
  study_year: z.string().max(50).optional(),
  research_consent: z.boolean().optional(),
});

/**
 * Step 1 of signup: validates input, creates the user (unconfirmed) via admin API,
 * and triggers Supabase's email OTP. Returns ok=true; the actual OTP is sent by Supabase
 * (the email template must use {{ .Token }}).
 */
export const requestSignupOtp = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => signupSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Check if user already exists & confirmed
    const { data: existing } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1 });
    const found = existing?.users.find((u) => u.email?.toLowerCase() === data.email.toLowerCase());
    if (found?.email_confirmed_at) {
      throw new Error("هذا البريد مسجّل مسبقاً، يرجى تسجيل الدخول");
    }

    // Delete any unconfirmed leftover so we can recreate cleanly
    if (found && !found.email_confirmed_at) {
      await supabaseAdmin.auth.admin.deleteUser(found.id);
    }

    // Create user (unconfirmed) with metadata
    const { error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: false,
      user_metadata: {
        full_name: data.full_name,
        phone: data.phone,
        phone_country_code: data.phone_country_code,
        study_year: data.study_year ?? null,
        research_consent: data.research_consent ?? false,
      },
    });
    if (createErr) throw new Error(createErr.message);

    // Send OTP email (signup type → 6-digit code if template uses {{ .Token }})
    const { error: otpErr } = await supabaseAdmin.auth.signInWithOtp({
      email: data.email,
      options: { shouldCreateUser: false },
    });
    if (otpErr) throw new Error(otpErr.message);

    return { ok: true };
  });

/**
 * Step 2 of signup: client calls supabase.auth.verifyOtp directly to sign in.
 * Master code 112233 bypass — verifies on server for whitelisted admin emails only.
 */
export const verifyMasterCode = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ email: z.string().trim().email(), code: z.string() }).parse(input),
  )
  .handler(async ({ data }) => {
    if (data.code !== MASTER_CODE) throw new Error("الرمز غير صحيح");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Verify email is whitelisted
    const { data: isAdmin, error: chkErr } = await supabaseAdmin.rpc("is_admin_email", {
      _email: data.email,
    });
    if (chkErr) throw new Error(chkErr.message);
    if (!isAdmin) throw new Error("الرمز الرئيسي غير مسموح لهذا البريد");

    // Confirm the user (if exists) and return a magic-link token to sign in
    const { data: list } = await supabaseAdmin.auth.admin.listUsers();
    const user = list?.users.find((u) => u.email?.toLowerCase() === data.email.toLowerCase());
    if (!user) throw new Error("الحساب غير موجود");

    await supabaseAdmin.auth.admin.updateUserById(user.id, { email_confirm: true });
    const { data: link, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: data.email,
    });
    if (linkErr) throw new Error(linkErr.message);

    // Return the hashed token + email so the client can verifyOtp({ token_hash })
    return {
      token_hash: link.properties.hashed_token,
      type: "magiclink" as const,
    };
  });

// ============= PASSWORD RESET via OTP (3 steps) =============

/** Step 1: request password reset OTP. Uses Supabase native email OTP. */
export const requestPasswordResetOtp = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ email: z.string().trim().email().max(255) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Confirm user exists & is verified — don't leak existence
    const { data: list } = await supabaseAdmin.auth.admin.listUsers();
    const user = list?.users.find((u) => u.email?.toLowerCase() === data.email.toLowerCase());
    if (!user || !user.email_confirmed_at) {
      // Silent success to avoid email enumeration
      return { ok: true };
    }

    const { error } = await supabaseAdmin.auth.signInWithOtp({
      email: data.email,
      options: { shouldCreateUser: false },
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Step 2 = client verifyOtp directly (returns a session).
// Step 3 = client calls updateUser({password}) then we bump global_logout below.

/** After password change: bump global_logout_at to force other sessions to sign out. */
export const finalizePasswordChange = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc("bump_global_logout", {
      _user_id: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============= SINGLE-DEVICE SESSION =============

const claimSchema = z.object({
  session_token: z.string().min(8).max(128),
  user_agent: z.string().max(500).optional(),
  device_label: z.string().max(120).optional(),
});

/**
 * Called right after a successful login. Upserts (user_id) → session_token,
 * which kicks every other device off via Realtime.
 */
export const claimSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => claimSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("active_sessions")
      .upsert(
        {
          user_id: context.userId,
          session_token: data.session_token,
          user_agent: data.user_agent ?? null,
          device_label: data.device_label ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const releaseSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("active_sessions").delete().eq("user_id", context.userId);
    return { ok: true };
  });

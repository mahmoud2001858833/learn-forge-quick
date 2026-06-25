import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Domain like example.com or sub.example.com (no protocol, no path)
const domainRegex = /^(?!:\/\/)([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/;

function genToken() {
  return "lf-verify-" + Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
}

export const requestCustomDomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      tenant_id: z.string().uuid(),
      domain: z.string().trim().toLowerCase().regex(domainRegex, "صيغة دومين غير صحيحة"),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    // Verify caller owns the tenant or is super_admin
    const { data: tenant } = await context.supabase
      .from("tenants")
      .select("id, owner_id")
      .eq("id", data.tenant_id)
      .single();
    if (!tenant) throw new Error("المنصة غير موجودة");

    const { data: isSuper } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "super_admin",
    });
    if (tenant.owner_id !== context.userId && !isSuper) throw new Error("صلاحيات غير كافية");

    // Check uniqueness
    const { data: taken } = await context.supabase
      .from("tenants")
      .select("id")
      .eq("custom_domain", data.domain)
      .neq("id", data.tenant_id)
      .maybeSingle();
    if (taken) throw new Error("هذا الدومين مرتبط بمنصة أخرى");

    const token = genToken();
    const { error } = await context.supabase
      .from("tenants")
      .update({
        custom_domain: data.domain,
        custom_domain_verified: false,
        custom_domain_verification_token: token,
        custom_domain_requested_at: new Date().toISOString(),
      })
      .eq("id", data.tenant_id);
    if (error) throw new Error(error.message);

    return { ok: true, token, domain: data.domain };
  });

export const removeCustomDomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ tenant_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: tenant } = await context.supabase
      .from("tenants")
      .select("owner_id")
      .eq("id", data.tenant_id)
      .single();
    if (!tenant) throw new Error("المنصة غير موجودة");

    const { data: isSuper } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "super_admin",
    });
    if (tenant.owner_id !== context.userId && !isSuper) throw new Error("صلاحيات غير كافية");

    const { error } = await context.supabase
      .from("tenants")
      .update({
        custom_domain: null,
        custom_domain_verified: false,
        custom_domain_verification_token: null,
        custom_domain_requested_at: null,
      })
      .eq("id", data.tenant_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Super-admin only: mark domain as verified after manual DNS check
export const setDomainVerified = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ tenant_id: z.string().uuid(), verified: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: isSuper } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "super_admin",
    });
    if (!isSuper) throw new Error("صلاحيات السوبر-أدمن مطلوبة");

    const { error } = await context.supabase
      .from("tenants")
      .update({ custom_domain_verified: data.verified })
      .eq("id", data.tenant_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Auto-verify by checking DNS TXT record contains the token
export const checkDomainDns = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ tenant_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: tenant } = await context.supabase
      .from("tenants")
      .select("owner_id, custom_domain, custom_domain_verification_token")
      .eq("id", data.tenant_id)
      .single();
    if (!tenant) throw new Error("المنصة غير موجودة");
    if (tenant.owner_id !== context.userId) {
      const { data: isSuper } = await context.supabase.rpc("has_role", {
        _user_id: context.userId,
        _role: "super_admin",
      });
      if (!isSuper) throw new Error("صلاحيات غير كافية");
    }
    if (!tenant.custom_domain || !tenant.custom_domain_verification_token) {
      throw new Error("لم يُسجَّل دومين بعد");
    }

    // Use Google's DNS-over-HTTPS to look up TXT records
    const dnsName = `_lovable.${tenant.custom_domain}`;
    const res = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(dnsName)}&type=TXT`, {
      headers: { Accept: "application/dns-json" },
    });
    if (!res.ok) throw new Error("تعذّر الوصول إلى خادم DNS");
    const json: { Answer?: { data: string }[] } = await res.json();
    const records = (json.Answer ?? []).map((a) => a.data.replace(/^"|"$/g, ""));
    const found = records.some((r) => r.includes(tenant.custom_domain_verification_token!));

    if (found) {
      await context.supabase
        .from("tenants")
        .update({ custom_domain_verified: true })
        .eq("id", data.tenant_id);
    }
    return { verified: found, records, lookup: dnsName };
  });

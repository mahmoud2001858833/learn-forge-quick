import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function publicClient() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

export const getTenantSeo = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ slug: z.string() }).parse(input))
  .handler(async ({ data }) => {
    const supabase = publicClient();
    const { data: tenant } = await supabase
      .from("tenants")
      .select("name, description, welcome_message, logo_url, hero_image_url, primary_color, status")
      .eq("slug", data.slug)
      .maybeSingle();
    return { tenant };
  });

export const getCourseSeo = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) =>
    z.object({ tenantSlug: z.string(), courseSlug: z.string() }).parse(input),
  )
  .handler(async ({ data }) => {
    const supabase = publicClient();
    const { data: tenant } = await supabase
      .from("tenants")
      .select("id, name")
      .eq("slug", data.tenantSlug)
      .maybeSingle();
    if (!tenant) return { course: null, tenant: null };
    const { data: course } = await supabase
      .from("courses")
      .select("title, short_description, description, cover_url, price, is_free, average_rating, reviews_count, students_count")
      .eq("tenant_id", tenant.id)
      .eq("slug", data.courseSlug)
      .eq("status", "published")
      .maybeSingle();
    return { course, tenant };
  });

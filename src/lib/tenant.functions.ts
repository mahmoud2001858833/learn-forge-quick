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

const slugSchema = z.object({ slug: z.string().min(1).max(120) });

export const getTenantHomeBundle = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => slugSchema.parse(input))
  .handler(async ({ data }) => {
    const supabase = publicClient();
    const { data: bundle, error } = await supabase.rpc("tenant_home_bundle", { _slug: data.slug });
    if (error) throw error;
    return bundle as {
      tenant: Record<string, unknown> | null;
      courses: Array<Record<string, unknown>>;
      stats: { courses_count: number; enrollments_count: number };
    } | null;
  });

export const getTenantCoursesBundle = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => slugSchema.parse(input))
  .handler(async ({ data }) => {
    const supabase = publicClient();
    const { data: bundle, error } = await supabase.rpc("tenant_courses_bundle", { _slug: data.slug });
    if (error) throw error;
    return bundle as {
      tenant: Record<string, unknown> | null;
      courses: Array<Record<string, unknown>>;
      bundles: Array<Record<string, unknown>>;
      colleges: Array<{ id: string; name: string; university_id: string }>;
    } | null;
  });

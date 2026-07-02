import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

// Public bundles are cacheable: browser 60s, edge 5m, SWR 1h
function setPublicCache() {
  try {
    setResponseHeader(
      "Cache-Control",
      "public, max-age=60, s-maxage=300, stale-while-revalidate=3600",
    );
  } catch {
    /* no-op on client */
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;

function publicClient() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

const slugSchema = z.object({ slug: z.string().min(1).max(120) });

export type TenantHomeBundle = {
  tenant: Json;
  courses: Json[];
  stats: { courses_count: number; enrollments_count: number };
} | null;

export type TenantCoursesBundle = {
  tenant: Json;
  courses: Json[];
  bundles: Json[];
  colleges: Array<{ id: string; name: string; university_id: string }>;
} | null;

export const getTenantHomeBundle = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => slugSchema.parse(input))
  .handler(async ({ data }): Promise<TenantHomeBundle> => {
    setPublicCache();
    const supabase = publicClient();
    const { data: bundle, error } = await supabase.rpc("tenant_home_bundle", { _slug: data.slug });
    if (error) throw error;
    return (bundle as TenantHomeBundle) ?? null;
  });

export const getTenantCoursesBundle = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => slugSchema.parse(input))
  .handler(async ({ data }): Promise<TenantCoursesBundle> => {
    setPublicCache();
    const supabase = publicClient();
    const { data: bundle, error } = await supabase.rpc("tenant_courses_bundle", { _slug: data.slug });
    if (error) throw error;
    return (bundle as TenantCoursesBundle) ?? null;
  });

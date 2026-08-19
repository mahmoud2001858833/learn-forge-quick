import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const state = {
  superAdmin: false,
  memberRole: null as string | null,
  ownerId: null as string | null,
};

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ user: { id: "user-1" }, loading: false }),
}));

vi.mock("@/integrations/supabase/client", () => {
  const chain = (table: string) => {
    const result = () => {
      if (table === "user_roles") return { data: state.superAdmin ? { role: "super_admin" } : null };
      if (table === "tenant_members") return { data: state.memberRole ? { role: state.memberRole } : null };
      return { data: state.ownerId ? { owner_id: state.ownerId } : null };
    };
    const api: Record<string, unknown> = {
      select: () => api,
      eq: () => api,
      maybeSingle: async () => result(),
    };
    return api;
  };
  return { supabase: { from: (table: string) => chain(table) } };
});

const { useTenantRole } = await import("./use-tenant-role");

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  state.superAdmin = false;
  state.memberRole = null;
  state.ownerId = null;
});

async function roleFor() {
  const { result } = renderHook(() => useTenantRole("tenant-1"), { wrapper });
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  return result;
}

describe("useTenantRole", () => {
  it("grants full permissions to the tenant owner", async () => {
    state.ownerId = "user-1";
    const r = await roleFor();
    expect(r.current.role).toBe("owner");
    expect(r.current.canManageSettings).toBe(true);
    expect(r.current.canManageFinances).toBe(true);
  });

  it("lets instructors manage courses but not students or finances", async () => {
    state.memberRole = "instructor";
    const r = await roleFor();
    expect(r.current.isStaff).toBe(true);
    expect(r.current.canManageCourses).toBe(true);
    expect(r.current.canManageStudents).toBe(false);
    expect(r.current.canManageFinances).toBe(false);
  });

  it("gives students no management permissions", async () => {
    state.memberRole = "student";
    const r = await roleFor();
    expect(r.current.isStaff).toBe(false);
    expect(r.current.canManageCourses).toBe(false);
    expect(r.current.canManageSettings).toBe(false);
  });

  it("treats super admins as owners everywhere", async () => {
    state.superAdmin = true;
    const r = await roleFor();
    expect(r.current.isSuperAdmin).toBe(true);
    expect(r.current.isOwner).toBe(true);
    expect(r.current.canManageFinances).toBe(true);
  });

  it("returns no role for an unrelated user", async () => {
    const r = await roleFor();
    expect(r.current.role).toBeNull();
    expect(r.current.isStaff).toBe(false);
  });
});

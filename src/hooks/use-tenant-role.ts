import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export type TenantRole = "owner" | "admin" | "instructor" | "student" | "super_admin" | null;

export interface TenantPermissionResult {
  role: TenantRole;
  isOwner: boolean;
  isAdmin: boolean;
  isStaff: boolean; // owner, admin, or instructor
  isSuperAdmin: boolean;
  isLoading: boolean;
  canManageSettings: boolean;
  canManageCourses: boolean;
  canManageStudents: boolean;
  canManageFinances: boolean;
}

export function useTenantRole(tenantId?: string | null, tenantOwnerId?: string | null): TenantPermissionResult {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id;

  const { data, isLoading } = useQuery({
    queryKey: ["tenant-role", tenantId, userId],
    enabled: !!tenantId && !!userId && !authLoading,
    staleTime: 60 * 1000, // 1 minute
    queryFn: async () => {
      if (!tenantId || !userId) return { role: null as TenantRole, isSuperAdmin: false };

      // 1. Check if super admin
      const { data: superRole } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "super_admin")
        .maybeSingle();

      const isSuper = !!superRole;

      // 2. Check if owner from passed prop or db
      if (tenantOwnerId && tenantOwnerId === userId) {
        return { role: "owner" as TenantRole, isSuperAdmin: isSuper };
      }

      // 3. Query tenant_members
      const { data: member } = await supabase
        .from("tenant_members")
        .select("role")
        .eq("tenant_id", tenantId)
        .eq("user_id", userId)
        .maybeSingle();

      if (member) {
        return { role: member.role as TenantRole, isSuperAdmin: isSuper };
      }

      // 4. Double check tenant owner if not passed
      const { data: tenant } = await supabase
        .from("tenants")
        .select("owner_id")
        .eq("id", tenantId)
        .maybeSingle();

      if (tenant?.owner_id === userId) {
        return { role: "owner" as TenantRole, isSuperAdmin: isSuper };
      }

      return { role: null as TenantRole, isSuperAdmin: isSuper };
    },
  });

  const isSuperAdmin = !!data?.isSuperAdmin;
  const role = isSuperAdmin ? "super_admin" : (data?.role ?? null);
  const isOwner = role === "owner" || isSuperAdmin;
  const isAdmin = role === "owner" || role === "admin" || isSuperAdmin;
  const isStaff = isAdmin || role === "instructor";

  return {
    role,
    isOwner,
    isAdmin,
    isStaff,
    isSuperAdmin,
    isLoading: authLoading || isLoading,
    canManageSettings: isOwner,
    canManageCourses: isStaff,
    canManageStudents: isAdmin,
    canManageFinances: isOwner,
  };
}

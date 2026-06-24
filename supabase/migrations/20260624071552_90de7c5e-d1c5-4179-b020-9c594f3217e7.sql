
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.is_tenant_member(UUID, UUID) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.has_tenant_role(UUID, UUID, public.tenant_role[]) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.is_tenant_owner(UUID, UUID) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.course_tenant(UUID) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.section_course(UUID) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.enrollment_student(UUID) FROM authenticated;


REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_tenant_member(UUID, UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_tenant_role(UUID, UUID, public.tenant_role[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_tenant_owner(UUID, UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.course_tenant(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.section_course(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.enrollment_student(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.add_owner_as_member() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_tenant_member(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_tenant_role(UUID, UUID, public.tenant_role[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_tenant_owner(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.course_tenant(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.section_course(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.enrollment_student(UUID) TO authenticated;

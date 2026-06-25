GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_tenant_member(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_tenant_role(UUID, UUID, public.tenant_role[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_tenant_owner(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.course_tenant(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.section_course(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.enrollment_student(UUID) TO authenticated;
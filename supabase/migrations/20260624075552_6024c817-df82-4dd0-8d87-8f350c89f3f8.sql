
REVOKE EXECUTE ON FUNCTION public.approve_course(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.reject_course(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_course(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_course(UUID, TEXT) TO authenticated;

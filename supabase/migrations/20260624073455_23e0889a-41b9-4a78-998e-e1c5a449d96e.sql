
REVOKE EXECUTE ON FUNCTION public.bump_global_logout(UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_admin_email(TEXT) FROM PUBLIC, anon, authenticated;

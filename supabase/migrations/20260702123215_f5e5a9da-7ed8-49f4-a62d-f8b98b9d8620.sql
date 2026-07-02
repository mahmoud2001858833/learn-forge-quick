CREATE OR REPLACE FUNCTION public.trg_notify_badge()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _b RECORD;
BEGIN
  SELECT name, tenant_id INTO _b FROM public.badges WHERE id = NEW.badge_id;
  PERFORM public.create_notification(
    NEW.user_id, _b.tenant_id, 'badge_awarded',
    'حصلت على شارة جديدة!', _b.name, '/my-badges'
  );
  RETURN NEW;
END;
$$;
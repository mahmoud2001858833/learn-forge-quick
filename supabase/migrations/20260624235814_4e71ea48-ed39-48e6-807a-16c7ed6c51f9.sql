
-- 1) notifications
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  link TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_user_unread ON public.notifications(user_id, is_read, created_at DESC);
GRANT SELECT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own notifications" ON public.notifications
FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "users update own notifications" ON public.notifications
FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "users delete own notifications" ON public.notifications
FOR DELETE TO authenticated USING (user_id = auth.uid());

-- 2) activity_logs
CREATE TABLE public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  actor_id UUID,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_activity_logs_tenant ON public.activity_logs(tenant_id, created_at DESC);
GRANT SELECT ON public.activity_logs TO authenticated;
GRANT ALL ON public.activity_logs TO service_role;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant admins read activity" ON public.activity_logs
FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.tenant_members tm
          WHERE tm.tenant_id = activity_logs.tenant_id AND tm.user_id = auth.uid()
          AND tm.role IN ('owner','admin'))
);

-- helper: create a notification
CREATE OR REPLACE FUNCTION public.create_notification(
  _user_id UUID, _tenant_id UUID, _type TEXT, _title TEXT,
  _message TEXT DEFAULT NULL, _link TEXT DEFAULT NULL, _metadata JSONB DEFAULT '{}'::jsonb
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id UUID;
BEGIN
  INSERT INTO public.notifications(user_id, tenant_id, type, title, message, link, metadata)
  VALUES (_user_id, _tenant_id, _type, _title, _message, _link, COALESCE(_metadata, '{}'::jsonb))
  RETURNING id INTO _id;
  RETURN _id;
END $$;

-- helper: log activity
CREATE OR REPLACE FUNCTION public.log_activity(
  _tenant_id UUID, _actor_id UUID, _action TEXT,
  _entity_type TEXT DEFAULT NULL, _entity_id UUID DEFAULT NULL, _metadata JSONB DEFAULT '{}'::jsonb
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.activity_logs(tenant_id, actor_id, action, entity_type, entity_id, metadata)
  VALUES (_tenant_id, _actor_id, _action, _entity_type, _entity_id, COALESCE(_metadata, '{}'::jsonb));
END $$;

-- mark all read
CREATE OR REPLACE FUNCTION public.mark_all_notifications_read()
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _n INTEGER;
BEGIN
  UPDATE public.notifications SET is_read = true
   WHERE user_id = auth.uid() AND is_read = false;
  GET DIAGNOSTICS _n = ROW_COUNT;
  RETURN _n;
END $$;

-- Trigger: new enrollment
CREATE OR REPLACE FUNCTION public.trg_notify_enrollment()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _course RECORD;
BEGIN
  SELECT id, title, tenant_id INTO _course FROM public.courses WHERE id = NEW.course_id;
  PERFORM public.create_notification(
    NEW.student_id, NEW.tenant_id, 'enrollment_created',
    'تم تسجيلك في دورة جديدة', _course.title,
    '/learn/' || NEW.id::text
  );
  PERFORM public.log_activity(NEW.tenant_id, NEW.student_id, 'enrollment.created', 'enrollment', NEW.id,
    jsonb_build_object('course_id', NEW.course_id, 'course_title', _course.title));
  RETURN NEW;
END $$;
CREATE TRIGGER trg_enrollment_notify AFTER INSERT ON public.enrollments
FOR EACH ROW EXECUTE FUNCTION public.trg_notify_enrollment();

-- Trigger: new payment request → notify tenant admins
CREATE OR REPLACE FUNCTION public.trg_notify_payment_request()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _admin RECORD;
BEGIN
  FOR _admin IN
    SELECT user_id FROM public.tenant_members
    WHERE tenant_id = NEW.tenant_id AND role IN ('owner','admin')
  LOOP
    PERFORM public.create_notification(
      _admin.user_id, NEW.tenant_id, 'payment_request_new',
      'طلب دفع جديد', 'طلب بقيمة ' || NEW.amount::text,
      '/admin/' || (SELECT slug FROM public.tenants WHERE id = NEW.tenant_id) || '/payments'
    );
  END LOOP;
  PERFORM public.log_activity(NEW.tenant_id, NEW.user_id, 'payment_request.created', 'payment_request', NEW.id,
    jsonb_build_object('amount', NEW.amount));
  RETURN NEW;
END $$;
CREATE TRIGGER trg_payment_request_notify AFTER INSERT ON public.payment_requests
FOR EACH ROW EXECUTE FUNCTION public.trg_notify_payment_request();

-- Trigger: payment request status change → notify student
CREATE OR REPLACE FUNCTION public.trg_notify_payment_status()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('approved','rejected','partial') THEN
    PERFORM public.create_notification(
      NEW.user_id, NEW.tenant_id,
      'payment_request_' || NEW.status,
      CASE NEW.status
        WHEN 'approved' THEN 'تمت الموافقة على دفعتك'
        WHEN 'rejected' THEN 'تم رفض طلب الدفع'
        ELSE 'تم تسجيل دفعة جزئية'
      END,
      NEW.admin_notes, '/my-payments'
    );
    PERFORM public.log_activity(NEW.tenant_id, auth.uid(), 'payment_request.' || NEW.status,
      'payment_request', NEW.id, jsonb_build_object('amount', NEW.amount));
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_payment_status_notify AFTER UPDATE ON public.payment_requests
FOR EACH ROW EXECUTE FUNCTION public.trg_notify_payment_status();

-- Trigger: user got a badge
CREATE OR REPLACE FUNCTION public.trg_notify_badge()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _b RECORD;
BEGIN
  SELECT title, tenant_id INTO _b FROM public.badges WHERE id = NEW.badge_id;
  PERFORM public.create_notification(
    NEW.user_id, _b.tenant_id, 'badge_awarded',
    'حصلت على شارة جديدة!', _b.title, '/my-badges'
  );
  RETURN NEW;
END $$;
CREATE TRIGGER trg_badge_notify AFTER INSERT ON public.user_badges
FOR EACH ROW EXECUTE FUNCTION public.trg_notify_badge();

-- Trigger: certificate issued
CREATE OR REPLACE FUNCTION public.trg_notify_certificate()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.create_notification(
    NEW.user_id, NEW.tenant_id, 'certificate_issued',
    'مبروك! حصلت على شهادة', 'رقم الشهادة: ' || NEW.certificate_number, '/my-certificates'
  );
  PERFORM public.log_activity(NEW.tenant_id, NEW.user_id, 'certificate.issued', 'certificate', NEW.id,
    jsonb_build_object('certificate_number', NEW.certificate_number));
  RETURN NEW;
END $$;
CREATE TRIGGER trg_certificate_notify AFTER INSERT ON public.certificates
FOR EACH ROW EXECUTE FUNCTION public.trg_notify_certificate();

-- Trigger: new answer to my question
CREATE OR REPLACE FUNCTION public.trg_notify_answer()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _q RECORD; _tenant UUID;
BEGIN
  SELECT q.user_id, q.title, q.course_id INTO _q FROM public.course_questions q WHERE q.id = NEW.question_id;
  IF _q.user_id IS NULL OR _q.user_id = NEW.user_id THEN RETURN NEW; END IF;
  SELECT tenant_id INTO _tenant FROM public.courses WHERE id = _q.course_id;
  PERFORM public.create_notification(
    _q.user_id, _tenant, 'qa_answer',
    'إجابة جديدة على سؤالك', _q.title, NULL
  );
  RETURN NEW;
END $$;
CREATE TRIGGER trg_answer_notify AFTER INSERT ON public.course_answers
FOR EACH ROW EXECUTE FUNCTION public.trg_notify_answer();

-- enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

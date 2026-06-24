-- Bank accounts per tenant
CREATE TABLE public.bank_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  bank_name TEXT NOT NULL,
  account_holder TEXT NOT NULL,
  iban TEXT,
  account_number TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_accounts TO authenticated;
GRANT ALL ON public.bank_accounts TO service_role;

ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view bank accounts"
  ON public.bank_accounts FOR SELECT TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Tenant admins manage bank accounts"
  ON public.bank_accounts FOR ALL TO authenticated
  USING (
    public.is_tenant_owner(auth.uid(), tenant_id)
    OR public.has_tenant_role(auth.uid(), tenant_id, ARRAY['admin']::tenant_role[])
    OR public.has_role(auth.uid(), 'super_admin')
  )
  WITH CHECK (
    public.is_tenant_owner(auth.uid(), tenant_id)
    OR public.has_tenant_role(auth.uid(), tenant_id, ARRAY['admin']::tenant_role[])
    OR public.has_role(auth.uid(), 'super_admin')
  );

CREATE TRIGGER update_bank_accounts_updated_at
  BEFORE UPDATE ON public.bank_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Payment requests
CREATE TYPE public.payment_request_status AS ENUM ('pending', 'approved', 'rejected', 'cancelled');

CREATE TABLE public.payment_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  bundle_id UUID REFERENCES public.course_bundles(id) ON DELETE CASCADE,
  bank_account_id UUID REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
  amount NUMERIC(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'SAR',
  receipt_url TEXT,
  student_notes TEXT,
  admin_notes TEXT,
  status public.payment_request_status NOT NULL DEFAULT 'pending',
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((course_id IS NOT NULL) <> (bundle_id IS NOT NULL))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_requests TO authenticated;
GRANT ALL ON public.payment_requests TO service_role;

ALTER TABLE public.payment_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students see own requests, admins see tenant requests"
  ON public.payment_requests FOR SELECT TO authenticated
  USING (
    student_id = auth.uid()
    OR public.is_tenant_owner(auth.uid(), tenant_id)
    OR public.has_tenant_role(auth.uid(), tenant_id, ARRAY['admin']::tenant_role[])
    OR public.has_role(auth.uid(), 'super_admin')
  );

CREATE POLICY "Students create their own payment requests"
  ON public.payment_requests FOR INSERT TO authenticated
  WITH CHECK (student_id = auth.uid());

CREATE POLICY "Students update own pending requests"
  ON public.payment_requests FOR UPDATE TO authenticated
  USING (student_id = auth.uid() AND status = 'pending')
  WITH CHECK (student_id = auth.uid());

CREATE POLICY "Tenant admins update requests"
  ON public.payment_requests FOR UPDATE TO authenticated
  USING (
    public.is_tenant_owner(auth.uid(), tenant_id)
    OR public.has_tenant_role(auth.uid(), tenant_id, ARRAY['admin']::tenant_role[])
    OR public.has_role(auth.uid(), 'super_admin')
  );

CREATE TRIGGER update_payment_requests_updated_at
  BEFORE UPDATE ON public.payment_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_payment_requests_tenant_status ON public.payment_requests(tenant_id, status);
CREATE INDEX idx_payment_requests_student ON public.payment_requests(student_id);

-- Approval RPC: creates enrollment(s) atomically
CREATE OR REPLACE FUNCTION public.approve_payment_request(_req_id UUID, _notes TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _req public.payment_requests;
  _course_id UUID;
BEGIN
  SELECT * INTO _req FROM public.payment_requests WHERE id = _req_id;
  IF _req.id IS NULL THEN RAISE EXCEPTION 'request_not_found'; END IF;
  IF _req.status <> 'pending' THEN RAISE EXCEPTION 'request_not_pending'; END IF;

  IF NOT (public.is_tenant_owner(auth.uid(), _req.tenant_id)
          OR public.has_tenant_role(auth.uid(), _req.tenant_id, ARRAY['admin']::tenant_role[])
          OR public.has_role(auth.uid(), 'super_admin')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF _req.course_id IS NOT NULL THEN
    INSERT INTO public.enrollments (tenant_id, student_id, course_id, status, source)
    VALUES (_req.tenant_id, _req.student_id, _req.course_id, 'active', 'paid')
    ON CONFLICT DO NOTHING;
  ELSIF _req.bundle_id IS NOT NULL THEN
    FOR _course_id IN SELECT course_id FROM public.bundle_courses WHERE bundle_id = _req.bundle_id LOOP
      INSERT INTO public.enrollments (tenant_id, student_id, course_id, status, source)
      VALUES (_req.tenant_id, _req.student_id, _course_id, 'active', 'paid')
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;

  UPDATE public.payment_requests
    SET status = 'approved', reviewed_by = auth.uid(), reviewed_at = now(), admin_notes = COALESCE(_notes, admin_notes)
    WHERE id = _req_id;
END $$;

CREATE OR REPLACE FUNCTION public.reject_payment_request(_req_id UUID, _notes TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _tenant UUID;
BEGIN
  SELECT tenant_id INTO _tenant FROM public.payment_requests WHERE id = _req_id;
  IF _tenant IS NULL THEN RAISE EXCEPTION 'request_not_found'; END IF;
  IF NOT (public.is_tenant_owner(auth.uid(), _tenant)
          OR public.has_tenant_role(auth.uid(), _tenant, ARRAY['admin']::tenant_role[])
          OR public.has_role(auth.uid(), 'super_admin')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  UPDATE public.payment_requests
    SET status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(), admin_notes = COALESCE(_notes, admin_notes)
    WHERE id = _req_id;
END $$;

-- Make sure enrollments has source column for payment tracking
ALTER TABLE public.enrollments ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'free';

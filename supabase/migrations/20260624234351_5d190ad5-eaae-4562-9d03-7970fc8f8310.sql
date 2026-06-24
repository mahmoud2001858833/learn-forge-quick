-- ============ COUPONS ============
CREATE TYPE public.coupon_type AS ENUM ('percent', 'fixed');
CREATE TYPE public.coupon_scope AS ENUM ('all', 'course', 'bundle');

CREATE TABLE public.coupons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  type public.coupon_type NOT NULL DEFAULT 'percent',
  value NUMERIC(10,2) NOT NULL,
  scope public.coupon_scope NOT NULL DEFAULT 'all',
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  bundle_id UUID REFERENCES public.course_bundles(id) ON DELETE CASCADE,
  min_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  max_uses INT,
  used_count INT NOT NULL DEFAULT 0,
  per_user_limit INT NOT NULL DEFAULT 1,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, code)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.coupons TO authenticated;
GRANT ALL ON public.coupons TO service_role;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant admins manage coupons" ON public.coupons FOR ALL TO authenticated
  USING (public.is_tenant_owner(auth.uid(), tenant_id)
         OR public.has_tenant_role(auth.uid(), tenant_id, ARRAY['admin']::tenant_role[])
         OR public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.is_tenant_owner(auth.uid(), tenant_id)
              OR public.has_tenant_role(auth.uid(), tenant_id, ARRAY['admin']::tenant_role[])
              OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Anyone can read active coupons for validation" ON public.coupons FOR SELECT TO authenticated
  USING (is_active = true);

CREATE TRIGGER update_coupons_updated_at BEFORE UPDATE ON public.coupons
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.coupon_redemptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  coupon_id UUID NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  payment_request_id UUID REFERENCES public.payment_requests(id) ON DELETE SET NULL,
  discount_amount NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.coupon_redemptions TO authenticated;
GRANT ALL ON public.coupon_redemptions TO service_role;
ALTER TABLE public.coupon_redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own redemptions, admins see tenant" ON public.coupon_redemptions FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.coupons c
               WHERE c.id = coupon_redemptions.coupon_id
                 AND (public.is_tenant_owner(auth.uid(), c.tenant_id)
                      OR public.has_tenant_role(auth.uid(), c.tenant_id, ARRAY['admin']::tenant_role[])
                      OR public.has_role(auth.uid(), 'super_admin')))
  );

CREATE POLICY "Users create own redemptions" ON public.coupon_redemptions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Validate coupon RPC
CREATE OR REPLACE FUNCTION public.validate_coupon(
  _tenant_id UUID, _code TEXT, _amount NUMERIC,
  _course_id UUID DEFAULT NULL, _bundle_id UUID DEFAULT NULL
) RETURNS TABLE(coupon_id UUID, discount NUMERIC, final_amount NUMERIC, message TEXT)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE _c public.coupons; _user_uses INT; _disc NUMERIC;
BEGIN
  SELECT * INTO _c FROM public.coupons WHERE tenant_id = _tenant_id AND upper(code) = upper(_code) AND is_active = true;
  IF _c.id IS NULL THEN RETURN QUERY SELECT NULL::UUID, 0::NUMERIC, _amount, 'كوبون غير صالح'; RETURN; END IF;
  IF _c.expires_at IS NOT NULL AND _c.expires_at < now() THEN RETURN QUERY SELECT NULL::UUID, 0::NUMERIC, _amount, 'الكوبون منتهي الصلاحية'; RETURN; END IF;
  IF _c.max_uses IS NOT NULL AND _c.used_count >= _c.max_uses THEN RETURN QUERY SELECT NULL::UUID, 0::NUMERIC, _amount, 'انتهى عدد استخدامات الكوبون'; RETURN; END IF;
  IF _amount < _c.min_amount THEN RETURN QUERY SELECT NULL::UUID, 0::NUMERIC, _amount, 'المبلغ أقل من الحد الأدنى للكوبون'; RETURN; END IF;
  IF _c.scope = 'course' AND (_course_id IS NULL OR _c.course_id <> _course_id) THEN RETURN QUERY SELECT NULL::UUID, 0::NUMERIC, _amount, 'الكوبون غير صالح لهذه الدورة'; RETURN; END IF;
  IF _c.scope = 'bundle' AND (_bundle_id IS NULL OR _c.bundle_id <> _bundle_id) THEN RETURN QUERY SELECT NULL::UUID, 0::NUMERIC, _amount, 'الكوبون غير صالح لهذه الحزمة'; RETURN; END IF;

  SELECT COUNT(*) INTO _user_uses FROM public.coupon_redemptions WHERE coupon_id = _c.id AND user_id = auth.uid();
  IF _user_uses >= _c.per_user_limit THEN RETURN QUERY SELECT NULL::UUID, 0::NUMERIC, _amount, 'لقد استخدمت هذا الكوبون من قبل'; RETURN; END IF;

  IF _c.type = 'percent' THEN _disc := ROUND(_amount * _c.value / 100, 2);
  ELSE _disc := LEAST(_c.value, _amount); END IF;

  RETURN QUERY SELECT _c.id, _disc, GREATEST(_amount - _disc, 0), 'ok';
END $$;

-- ============ REFERRALS ============
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS referral_balance NUMERIC(10,2) NOT NULL DEFAULT 0;

ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS referral_commission_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS enable_referrals BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE public.referrals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  referrer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  payment_request_id UUID REFERENCES public.payment_requests(id) ON DELETE SET NULL,
  course_id UUID REFERENCES public.courses(id) ON DELETE SET NULL,
  commission_amount NUMERIC(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | paid | cancelled
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.referrals TO authenticated;
GRANT ALL ON public.referrals TO service_role;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Referrer sees own, admin sees tenant" ON public.referrals FOR SELECT TO authenticated
  USING (
    referrer_id = auth.uid()
    OR public.is_tenant_owner(auth.uid(), tenant_id)
    OR public.has_tenant_role(auth.uid(), tenant_id, ARRAY['admin']::tenant_role[])
    OR public.has_role(auth.uid(), 'super_admin')
  );

CREATE POLICY "Admin updates referrals" ON public.referrals FOR UPDATE TO authenticated
  USING (public.is_tenant_owner(auth.uid(), tenant_id)
         OR public.has_tenant_role(auth.uid(), tenant_id, ARRAY['admin']::tenant_role[])
         OR public.has_role(auth.uid(), 'super_admin'));

-- Generate referral code
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _code TEXT; _exists BOOLEAN;
BEGIN
  IF NEW.referral_code IS NOT NULL THEN RETURN NEW; END IF;
  LOOP
    _code := upper(substr(md5(random()::text || NEW.id::text), 1, 8));
    SELECT EXISTS(SELECT 1 FROM public.profiles WHERE referral_code = _code) INTO _exists;
    EXIT WHEN NOT _exists;
  END LOOP;
  NEW.referral_code := _code;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS gen_referral_code ON public.profiles;
CREATE TRIGGER gen_referral_code BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.generate_referral_code();

-- Backfill existing profiles
UPDATE public.profiles SET referral_code = upper(substr(md5(random()::text || id::text), 1, 8))
WHERE referral_code IS NULL;

-- ============ PARTIAL PAYMENTS ============
ALTER TABLE public.enrollments
  ADD COLUMN IF NOT EXISTS total_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(10,2) NOT NULL DEFAULT 0;

ALTER TABLE public.payment_requests
  ADD COLUMN IF NOT EXISTS enrollment_id UUID REFERENCES public.enrollments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS original_amount NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS coupon_id UUID REFERENCES public.coupons(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS referral_code_used TEXT;

ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS allow_installments BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS min_installment_amount NUMERIC(10,2);

-- Updated approve function with coupon + referral + installments
CREATE OR REPLACE FUNCTION public.approve_payment_request(_req_id UUID, _notes TEXT DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _req public.payment_requests;
  _course_id UUID; _cid UUID;
  _course_price NUMERIC;
  _enrollment_id UUID;
  _settings public.platform_settings;
  _referrer_id UUID;
  _commission NUMERIC;
BEGIN
  SELECT * INTO _req FROM public.payment_requests WHERE id = _req_id;
  IF _req.id IS NULL THEN RAISE EXCEPTION 'request_not_found'; END IF;
  IF _req.status <> 'pending' THEN RAISE EXCEPTION 'request_not_pending'; END IF;

  IF NOT (public.is_tenant_owner(auth.uid(), _req.tenant_id)
          OR public.has_tenant_role(auth.uid(), _req.tenant_id, ARRAY['admin']::tenant_role[])
          OR public.has_role(auth.uid(), 'super_admin')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- Single course path
  IF _req.course_id IS NOT NULL THEN
    SELECT price INTO _course_price FROM public.courses WHERE id = _req.course_id;

    -- Find or create enrollment
    IF _req.enrollment_id IS NOT NULL THEN
      _enrollment_id := _req.enrollment_id;
      UPDATE public.enrollments SET paid_amount = paid_amount + _req.amount WHERE id = _enrollment_id;
    ELSE
      SELECT id INTO _enrollment_id FROM public.enrollments
        WHERE tenant_id = _req.tenant_id AND student_id = _req.student_id AND course_id = _req.course_id;
      IF _enrollment_id IS NULL THEN
        INSERT INTO public.enrollments (tenant_id, student_id, course_id, status, source, total_amount, paid_amount)
        VALUES (_req.tenant_id, _req.student_id, _req.course_id, 'active', 'paid', COALESCE(_course_price,0), _req.amount)
        RETURNING id INTO _enrollment_id;
      ELSE
        UPDATE public.enrollments SET paid_amount = paid_amount + _req.amount, status = 'active' WHERE id = _enrollment_id;
      END IF;
    END IF;

  -- Bundle path
  ELSIF _req.bundle_id IS NOT NULL THEN
    FOR _cid IN SELECT course_id FROM public.bundle_courses WHERE bundle_id = _req.bundle_id LOOP
      INSERT INTO public.enrollments (tenant_id, student_id, course_id, status, source, total_amount, paid_amount)
      VALUES (_req.tenant_id, _req.student_id, _cid, 'active', 'paid', 0, 0)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;

  -- Coupon redemption record
  IF _req.coupon_id IS NOT NULL AND _req.discount_amount > 0 THEN
    INSERT INTO public.coupon_redemptions (coupon_id, user_id, payment_request_id, discount_amount)
    VALUES (_req.coupon_id, _req.student_id, _req.id, _req.discount_amount);
    UPDATE public.coupons SET used_count = used_count + 1 WHERE id = _req.coupon_id;
  END IF;

  -- Referral commission
  IF _req.referral_code_used IS NOT NULL THEN
    SELECT id INTO _referrer_id FROM public.profiles WHERE referral_code = _req.referral_code_used;
    SELECT * INTO _settings FROM public.platform_settings WHERE tenant_id = _req.tenant_id;
    IF _referrer_id IS NOT NULL AND _referrer_id <> _req.student_id
       AND _settings.enable_referrals = true AND _settings.referral_commission_percent > 0 THEN
      _commission := ROUND(_req.amount * _settings.referral_commission_percent / 100, 2);
      INSERT INTO public.referrals (tenant_id, referrer_id, referred_user_id, payment_request_id, course_id, commission_amount, status)
      VALUES (_req.tenant_id, _referrer_id, _req.student_id, _req.id, _req.course_id, _commission, 'pending');
      UPDATE public.profiles SET referral_balance = referral_balance + _commission WHERE id = _referrer_id;
    END IF;
  END IF;

  UPDATE public.payment_requests
    SET status = 'approved', reviewed_by = auth.uid(), reviewed_at = now(),
        admin_notes = COALESCE(_notes, admin_notes), enrollment_id = COALESCE(enrollment_id, _enrollment_id)
    WHERE id = _req_id;
END $$;

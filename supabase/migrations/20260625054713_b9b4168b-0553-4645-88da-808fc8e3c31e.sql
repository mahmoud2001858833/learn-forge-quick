
CREATE TABLE public.landing_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  is_active boolean NOT NULL DEFAULT true,
  hero_eyebrow text, hero_title text, hero_subtitle text,
  cta_primary_label text, cta_secondary_label text,
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  pricing jsonb NOT NULL DEFAULT '[]'::jsonb,
  testimonials jsonb NOT NULL DEFAULT '[]'::jsonb,
  faq jsonb NOT NULL DEFAULT '[]'::jsonb,
  show_features boolean NOT NULL DEFAULT true,
  show_pricing boolean NOT NULL DEFAULT true,
  show_testimonials boolean NOT NULL DEFAULT true,
  show_faq boolean NOT NULL DEFAULT true,
  show_tenants boolean NOT NULL DEFAULT true,
  show_stats boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.landing_config TO anon, authenticated;
GRANT ALL ON public.landing_config TO service_role;
ALTER TABLE public.landing_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "landing_config public read" ON public.landing_config FOR SELECT USING (true);
CREATE POLICY "landing_config super_admin write" ON public.landing_config FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));
CREATE TRIGGER trg_landing_config_updated BEFORE UPDATE ON public.landing_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.landing_config (
  hero_eyebrow, hero_title, hero_subtitle, cta_primary_label, cta_secondary_label,
  features, steps, pricing, testimonials, faq
) VALUES (
  'الجيل الجديد من منصات التعليم العربية',
  'أكاديميتك الإلكترونية جاهزة في دقائق',
  'أنشئ منصة دورات احترافية بعلامتك التجارية، أدر الطلاب والمدفوعات، وأطلق الشهادات — كل ذلك من مكان واحد، بدون أي كود.',
  'أنشئ منصتك مجاناً', 'شاهد العرض',
  '[
    {"icon":"Zap","title":"إطلاق فوري","desc":"ابدأ منصتك خلال 5 دقائق — اختر اللون، أضف اللوغو، انطلق.","color":"from-yellow-500 to-orange-500"},
    {"icon":"Video","title":"إدارة دورات احترافية","desc":"فصول، دروس فيديو، اختبارات، واجبات وشهادات — كل شيء في مكان واحد.","color":"from-blue-500 to-indigo-500"},
    {"icon":"Users","title":"إدارة طلاب متكاملة","desc":"تتبّع التقدم، التسجيلات، المدفوعات، والإحصائيات لحظة بلحظة.","color":"from-green-500 to-emerald-500"},
    {"icon":"CreditCard","title":"مدفوعات متعددة","desc":"تحويل بنكي، Stripe، Paddle، أو كوبونات خصم.","color":"from-purple-500 to-pink-500"},
    {"icon":"Award","title":"شهادات قابلة للتحقق","desc":"شهادات بتصميمك مع رابط تحقق فريد.","color":"from-red-500 to-rose-500"},
    {"icon":"BarChart3","title":"تحليلات ذكية","desc":"لوحات تحكم تفاعلية للإيرادات والطلاب.","color":"from-cyan-500 to-teal-500"},
    {"icon":"Palette","title":"تخصيص كامل","desc":"ألوانك، خطك، صورك، ودومينك الخاص.","color":"from-fuchsia-500 to-purple-500"},
    {"icon":"ShieldCheck","title":"أمان مؤسسي","desc":"RLS، عزل بيانات كامل، حماية ضد الاختراق.","color":"from-slate-500 to-slate-700"},
    {"icon":"Globe","title":"دومين مخصص","desc":"اربط نطاقك الخاص وحوّل المنصة لعلامتك.","color":"from-amber-500 to-yellow-600"}
  ]'::jsonb,
  '[
    {"n":"01","title":"أنشئ حسابك","desc":"سجّل في أقل من دقيقة عبر البريد أو Google."},
    {"n":"02","title":"خصّص منصتك","desc":"اختر اللون، ارفع اللوغو، أضف اسم الأكاديمية."},
    {"n":"03","title":"أضف دوراتك","desc":"ارفع الفيديوهات، أنشئ الفصول، حدّد الأسعار."},
    {"n":"04","title":"اطلق وابدأ","desc":"شارك رابطك، استقبل الطلاب، حصّل الأرباح."}
  ]'::jsonb,
  '[
    {"name":"المجاني","price":"0","period":"للأبد","desc":"للبدء واختبار المنصة.","features":["منصة واحدة","حتى 50 طالباً","5 دورات","علامة EduForge"],"cta":"ابدأ الآن","featured":false},
    {"name":"الاحترافي","price":"99","period":"ر.س/شهر","desc":"للأكاديميات النامية.","features":["طلاب غير محدودين","دورات غير محدودة","دومين مخصص","إزالة العلامة","دعم أولوية"],"cta":"ابدأ التجربة","featured":true},
    {"name":"المؤسسات","price":"تواصل","period":"حسب الحاجة","desc":"للمؤسسات الكبرى.","features":["منصات متعددة","API كامل","تكامل مخصص","مدير حساب مخصص","SLA مضمون"],"cta":"تواصل معنا","featured":false}
  ]'::jsonb,
  '[
    {"name":"د. أحمد المالكي","role":"أكاديمية الأعمال","text":"أطلقت منصتي خلال يوم واحد، والآن لديّ 500 طالب نشط.","stars":5},
    {"name":"سارة العتيبي","role":"معلمة لغة إنجليزية","text":"كل ما أحتاجه في مكان واحد — لا حاجة لمطورين.","stars":5},
    {"name":"خالد الحربي","role":"مدرّب تطوير ذاتي","text":"نظام المدفوعات والشهادات وفّر عليّ ساعات من العمل.","stars":5}
  ]'::jsonb,
  '[
    {"q":"هل أحتاج لخبرة تقنية لاستخدام EduForge؟","a":"أبداً. المنصة مصممة بحيث يستطيع أي معلم إنشاء أكاديميته دون أي معرفة تقنية."},
    {"q":"هل يمكنني استخدام دوميني الخاص؟","a":"نعم، الخطة الاحترافية تتيح ربط دومين مخصص بسهولة عبر إعدادات DNS."},
    {"q":"كيف تتم عملية الدفع من الطلاب؟","a":"ندعم التحويل البنكي، Stripe وPaddle، بالإضافة للكوبونات."},
    {"q":"هل بياناتي ودوراتي آمنة؟","a":"نعم، نستخدم RLS وعزل بيانات كامل مع نسخ احتياطي يومي."},
    {"q":"هل توجد عمولة على المبيعات؟","a":"في الخطة الاحترافية لا توجد أي عمولة — تحتفظ بـ 100٪ من إيراداتك."}
  ]'::jsonb
);

CREATE TABLE public.landing_events (
  id bigserial PRIMARY KEY,
  event_type text NOT NULL,
  cta_id text,
  session_id text,
  path text,
  referrer text,
  user_agent text,
  user_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX landing_events_created_idx ON public.landing_events (created_at DESC);
CREATE INDEX landing_events_type_idx ON public.landing_events (event_type, created_at DESC);
CREATE INDEX landing_events_cta_idx ON public.landing_events (cta_id, created_at DESC);

GRANT INSERT ON public.landing_events TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.landing_events_id_seq TO anon, authenticated;
GRANT ALL ON public.landing_events TO service_role;
ALTER TABLE public.landing_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "landing_events anyone insert" ON public.landing_events FOR INSERT
  TO anon, authenticated WITH CHECK (true);
CREATE POLICY "landing_events super_admin read" ON public.landing_events FOR SELECT
  TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));

CREATE OR REPLACE FUNCTION public.landing_events_summary(_days integer DEFAULT 30)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  result jsonb;
  total_views bigint; total_clicks bigint; total_signups bigint;
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT COUNT(*) INTO total_views FROM public.landing_events
    WHERE event_type = 'view' AND created_at >= now() - (_days || ' days')::interval;
  SELECT COUNT(*) INTO total_clicks FROM public.landing_events
    WHERE event_type = 'cta_click' AND created_at >= now() - (_days || ' days')::interval;
  SELECT COUNT(*) INTO total_signups FROM public.landing_events
    WHERE event_type = 'signup_completed' AND created_at >= now() - (_days || ' days')::interval;
  SELECT jsonb_build_object(
    'totals', jsonb_build_object(
      'views', total_views, 'cta_clicks', total_clicks, 'signups', total_signups,
      'ctr', CASE WHEN total_views > 0 THEN ROUND(total_clicks::numeric * 100 / total_views, 2) ELSE 0 END,
      'conversion', CASE WHEN total_views > 0 THEN ROUND(total_signups::numeric * 100 / total_views, 2) ELSE 0 END
    ),
    'by_cta', (SELECT COALESCE(jsonb_agg(row), '[]'::jsonb) FROM (
        SELECT cta_id, COUNT(*) AS clicks FROM public.landing_events
        WHERE event_type = 'cta_click' AND created_at >= now() - (_days || ' days')::interval AND cta_id IS NOT NULL
        GROUP BY cta_id ORDER BY clicks DESC) row),
    'by_day', (SELECT COALESCE(jsonb_agg(row ORDER BY (row->>'day')), '[]'::jsonb) FROM (
        SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
               COUNT(*) FILTER (WHERE event_type = 'view') AS views,
               COUNT(*) FILTER (WHERE event_type = 'cta_click') AS clicks,
               COUNT(*) FILTER (WHERE event_type = 'signup_completed') AS signups
        FROM public.landing_events
        WHERE created_at >= now() - (_days || ' days')::interval
        GROUP BY 1) row)
  ) INTO result;
  RETURN result;
END $$;

GRANT EXECUTE ON FUNCTION public.landing_events_summary(integer) TO authenticated;

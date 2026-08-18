-- Allow the server runtime to record timing samples with the publishable key
-- (write-only: nobody but super admins can read them back).
GRANT INSERT ON public.perf_samples TO anon, authenticated;
GRANT INSERT ON public.web_vitals TO anon, authenticated;

CREATE POLICY "perf_samples insert only"
  ON public.perf_samples FOR INSERT TO anon, authenticated
  WITH CHECK (name IS NOT NULL AND length(name) <= 200 AND duration_ms >= 0);

GRANT SELECT ON public.universities TO anon;
GRANT SELECT ON public.colleges TO anon;
GRANT SELECT ON public.majors TO anon;

CREATE POLICY "public read universities" ON public.universities FOR SELECT TO anon USING (true);
CREATE POLICY "public read colleges" ON public.colleges FOR SELECT TO anon USING (true);
CREATE POLICY "public read majors" ON public.majors FOR SELECT TO anon USING (true);

-- تثبيت search_path للدوال التي تملك سياقًا قابلًا للتغيير.
-- لا يغيّر ذلك منطق الأعمال، ويقلل مخاطر حجب كائنات أو دوال غير موثوقة.
ALTER FUNCTION public.regenerate_installments() SET search_path = public;
ALTER FUNCTION public.generate_installments(uuid, date, public.payment_method, numeric) SET search_path = public;
ALTER FUNCTION public.set_daily_agent_stats_updated_at() SET search_path = public;
ALTER FUNCTION public.set_performance_activity_targets_updated_at() SET search_path = public;

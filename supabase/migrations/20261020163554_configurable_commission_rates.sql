-- Existing rates remain the baseline. Payment dates choose the applicable version.
CREATE TABLE public.commission_rate_schedule (
  effective_from date PRIMARY KEY CHECK (isfinite(effective_from)),
  year1_percent numeric(8,4) NOT NULL CHECK (year1_percent BETWEEN 0 AND 100),
  renewal_percent numeric(8,4) NOT NULL CHECK (renewal_percent BETWEEN 0 AND 100),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid DEFAULT auth.uid()
);
INSERT INTO public.commission_rate_schedule(effective_from, year1_percent, renewal_percent)
VALUES ('1900-01-01', 2.2, 0.05);
ALTER TABLE public.commission_rate_schedule ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.commission_rate_schedule FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.commission_rate_schedule TO authenticated;
GRANT ALL ON public.commission_rate_schedule TO service_role;
CREATE POLICY commission_rates_read ON public.commission_rate_schedule FOR SELECT TO authenticated USING (true);
CREATE POLICY commission_rates_insert_admin ON public.commission_rate_schedule FOR INSERT TO authenticated
WITH CHECK (
 effective_from > (now() AT TIME ZONE 'Africa/Cairo')::date
 AND EXISTS (SELECT 1 FROM public.users WHERE id = (SELECT auth.uid()) AND role = 'super_admin')
);
CREATE POLICY commission_rates_update_admin_future ON public.commission_rate_schedule FOR UPDATE TO authenticated
USING (
 effective_from > (now() AT TIME ZONE 'Africa/Cairo')::date
 AND EXISTS (SELECT 1 FROM public.users WHERE id = (SELECT auth.uid()) AND role = 'super_admin')
)
WITH CHECK (
 effective_from > (now() AT TIME ZONE 'Africa/Cairo')::date
 AND EXISTS (SELECT 1 FROM public.users WHERE id = (SELECT auth.uid()) AND role = 'super_admin')
);
CREATE FUNCTION public.stamp_commission_rate_change() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
 NEW.updated_at := now();
 NEW.updated_by := auth.uid();
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.stamp_commission_rate_change() FROM PUBLIC, anon;
CREATE TRIGGER stamp_commission_rate_change BEFORE INSERT OR UPDATE ON public.commission_rate_schedule
FOR EACH ROW EXECUTE FUNCTION public.stamp_commission_rate_change();

-- Read-only display context. Payment dates, allocations, commissions and
-- cancellation/renewal calendars remain governed by their existing functions.
CREATE OR REPLACE FUNCTION public.get_operational_reporting_month()
RETURNS TABLE (
  reporting_month date, calendar_month date, cairo_date date,
  extended_until date, server_now timestamptz, valid_until timestamptz
)
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = public
AS $function$
  WITH clock AS (
    SELECT (CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Cairo')::date AS today
  ), period AS (
    SELECT today, date_trunc('month', today)::date AS month FROM clock
  )
  SELECT coalesce(extension.month, period.month), period.month, period.today,
         extension.extended_until, CURRENT_TIMESTAMP,
         (period.today + 1)::timestamp AT TIME ZONE 'Africa/Cairo'
  FROM period
  LEFT JOIN public.closing_period_extensions extension
    ON extension.month = (period.month - interval '1 month')::date
   AND period.today <= extension.extended_until;
$function$;
REVOKE ALL ON FUNCTION public.get_operational_reporting_month() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_operational_reporting_month() TO authenticated, service_role;

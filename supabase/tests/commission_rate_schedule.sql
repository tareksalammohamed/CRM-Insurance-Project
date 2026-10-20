-- Transactional checks: no financial operations; test schedule rows are rolled back.
BEGIN;
DO $$
DECLARE admin_id uuid; member_id uuid; affected integer;
BEGIN
 SELECT id INTO admin_id FROM public.users WHERE role = 'super_admin' LIMIT 1;
 SELECT id INTO member_id FROM public.users WHERE role = 'agent' LIMIT 1;
 IF admin_id IS NULL OR member_id IS NULL THEN RAISE EXCEPTION 'Need existing admin and agent for RLS test'; END IF;
 PERFORM set_config('request.jwt.claim.sub', admin_id::text, true);
 PERFORM set_config('role', 'authenticated', true);
 INSERT INTO public.commission_rate_schedule(effective_from, year1_percent, renewal_percent) VALUES ('2999-01-01', 3, 0.1);
 UPDATE public.commission_rate_schedule SET year1_percent = 4 WHERE effective_from = '2999-01-01';
 GET DIAGNOSTICS affected = ROW_COUNT;
 IF affected <> 1 THEN RAISE EXCEPTION 'Admin future update failed'; END IF;
 UPDATE public.commission_rate_schedule SET year1_percent = 10 WHERE effective_from = '1900-01-01';
 GET DIAGNOSTICS affected = ROW_COUNT;
 IF affected <> 0 THEN RAISE EXCEPTION 'Historical rates were writable'; END IF;
 BEGIN
   INSERT INTO public.commission_rate_schedule VALUES ('2000-01-01', 3, 0.1, now(), admin_id);
   RAISE EXCEPTION 'Past insert was permitted';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
   INSERT INTO public.commission_rate_schedule(effective_from, year1_percent, renewal_percent) VALUES ('2999-01-02', -1, 0.1);
   RAISE EXCEPTION 'Invalid percent was permitted';
 EXCEPTION WHEN check_violation THEN NULL; END;
 PERFORM set_config('role', 'none', true);
 PERFORM set_config('request.jwt.claim.sub', member_id::text, true);
 PERFORM set_config('role', 'authenticated', true);
 PERFORM 1 FROM public.commission_rate_schedule WHERE effective_from = '1900-01-01';
 IF NOT FOUND THEN RAISE EXCEPTION 'Member cannot read rates'; END IF;
 BEGIN
   INSERT INTO public.commission_rate_schedule(effective_from, year1_percent, renewal_percent) VALUES ('2999-01-03', 3, 0.1);
   RAISE EXCEPTION 'Member write was permitted';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 UPDATE public.commission_rate_schedule SET year1_percent = 9 WHERE effective_from = '2999-01-01';
 GET DIAGNOSTICS affected = ROW_COUNT;
 IF affected <> 0 THEN RAISE EXCEPTION 'Member update was permitted'; END IF;
 BEGIN
   DELETE FROM public.commission_rate_schedule WHERE effective_from = '2999-01-01';
   RAISE EXCEPTION 'Delete was permitted';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 PERFORM set_config('role', 'none', true);
 PERFORM set_config('role', 'anon', true);
 BEGIN
   PERFORM 1 FROM public.commission_rate_schedule;
   RAISE EXCEPTION 'Anonymous read was permitted';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 PERFORM set_config('role', 'none', true);
END;
$$;
ROLLBACK;

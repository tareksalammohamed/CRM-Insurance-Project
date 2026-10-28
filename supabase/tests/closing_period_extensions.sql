-- Run ONLY against the isolated tests/sql/closing-extensions-bootstrap.sql fixture.
-- All rows below are synthetic. No production payment operations are performed.
do $$
declare v_super uuid := '00000000-0000-0000-0000-000000000001';
 v_agent uuid := '00000000-0000-0000-0000-000000000002';
 v_inst uuid := '00000000-0000-0000-0000-000000000005';
 v_id uuid; v_before uuid; v_last uuid; v_after uuid; v_hist uuid; v_ext uuid; v_result jsonb;
 v_total numeric; v_count integer;
begin
 perform set_config('request.jwt.claim.sub',v_super::text,true);
 -- A real payment predating the setting must be included by an explicit save.
 insert into payments(installment_id,amount,paid_at,paid_by_user_id,payment_month)
 values(v_inst,100,timestamp '2999-02-01 12:00' at time zone 'Africa/Cairo',v_super,'2999-02-01') returning id into v_id;
 if (select closing_month is not null from payments where id=v_id) then raise exception 'Ordinary payment changed'; end if;
 v_result := set_closing_period_extension('2999-01-01','2999-02-01','Fixture holiday');
 v_ext := (v_result->'extension'->>'id')::uuid;
 if (v_result->>'assigned_count')::int <> 1 then raise exception 'Existing eligible payment was not assigned'; end if;
 if not exists(select 1 from payments where id=v_id and closing_month='2999-01-01' and payment_month='2999-02-01'
   and paid_at=timestamp '2999-02-01 12:00' at time zone 'Africa/Cairo' and amount=100) then raise exception 'Original payment fields changed'; end if;
 -- Cairo calendar boundaries, ordinary preceding day and following day.
 insert into payments(installment_id,amount,paid_at,paid_by_user_id,payment_month) values
 (v_inst,10,timestamp '2999-01-31 23:59:59' at time zone 'Africa/Cairo',v_super,'2999-01-01') returning id into v_before;
 insert into payments(installment_id,amount,paid_at,paid_by_user_id,payment_month) values
 (v_inst,20,timestamp '2999-02-01 23:59:59.999999' at time zone 'Africa/Cairo',v_super,'2999-02-01') returning id into v_last;
 insert into payments(installment_id,amount,paid_at,paid_by_user_id,payment_month) values
 (v_inst,30,timestamp '2999-02-02 00:00' at time zone 'Africa/Cairo',v_super,'2999-02-01') returning id into v_after;
 insert into payments(installment_id,amount,paid_at,paid_by_user_id,payment_month,is_historical) values
 (v_inst,40,timestamp '2999-02-01 12:00' at time zone 'Africa/Cairo',v_super,'2999-02-01',true) returning id into v_hist;
 if (select closing_month is not null from payments where id in(v_before,v_after,v_hist) and closing_month is not null limit 1) then raise exception 'Ordinary/historical attribution changed'; end if;
 if (select closing_month from payments where id=v_last) <> '2999-01-01'::date then raise exception 'Last instant excluded'; end if;
 select sum(amount) into v_total from closing_payments where accounting_month='2999-01-01' and not is_cancelled;
 if v_total <> 130 then raise exception 'Wrong extended total %',v_total; end if;
 select sum(amount) into v_total from closing_payments where accounting_month='2999-02-01' and not is_cancelled;
 if v_total <> 70 then raise exception 'Double counting in next month %',v_total; end if;
 -- Caller cannot supply a forged reporting month; stored allocation stays stable on cancellation.
 update payments set closing_month='2999-02-01',closing_extension_id=null,is_cancelled=true where id=v_id;
 if (select closing_month from payments where id=v_id) <> '2999-01-01'::date then raise exception 'Allocation was mutable'; end if;
 select sum(amount) into v_total from closing_payments where accounting_month='2999-01-01' and not is_cancelled;
 if v_total <> 30 then raise exception 'Cancelled payment remained counted'; end if;
 if (select amount from payments where id=v_id) <> 100 then raise exception 'Cancellation changed money'; end if;
 begin
   perform set_closing_period_extension('2999-01-01','2999-02-01','stale write','2999-02-02');
   raise exception 'Concurrent edit accepted';
 exception when raise_exception then if sqlerrm='Concurrent edit accepted' then raise; end if; end;
 perform set_closing_period_extension('2999-01-01','2999-02-02','Longer holiday','2999-02-01');
 begin
   perform set_closing_period_extension('2999-01-01','2999-02-01','Shorten','2999-02-02');
   raise exception 'Applied extension could be shortened';
 exception when raise_exception then if sqlerrm='Applied extension could be shortened' then raise; end if; end;
 -- Paid drill-down uses the same month as closing and production summaries.
 v_result := get_collection_page('paid','all',1,'',null,null,'2999-01-01');
 if (v_result->>'totalCount')::int <> 1 then raise exception 'Paid drill-down lost extended payments'; end if;
 perform set_config('request.jwt.claim.sub',v_agent::text,true);
 begin
   perform set_closing_period_extension('2999-03-01','2999-04-01','Unauthorized');
   raise exception 'Agent could set company period';
 exception when raise_exception then if sqlerrm='Agent could set company period' then raise; end if; end;
 perform set_config('role','authenticated',true);
 select count(*) into v_count from closing_payments;
 if v_count <> 0 then raise exception 'View bypassed payment RLS'; end if;
 begin
   insert into closing_period_extensions(month,extended_until,reason,created_by,updated_by)
   values('2999-03-01','2999-04-01','Bypass',v_agent,v_agent);
   raise exception 'Direct setting bypass accepted';
 exception when insufficient_privilege then null; end;
 -- Real authenticated writes still work; the trigger ignores forged client overrides.
 insert into payments(installment_id,amount,paid_at,paid_by_user_id,payment_month,closing_month,closing_extension_id)
 values('00000000-0000-0000-0000-000000000009',11,timestamp '2999-02-01 09:00' at time zone 'Africa/Cairo',v_agent,'2999-02-01','2998-01-01',v_ext);
 select count(*) into v_count from closing_payments;
 if v_count <> 1 then raise exception 'Authenticated payment write or RLS failed'; end if;
 if not exists(select 1 from closing_payments where paid_by_user_id=v_agent and closing_month='2999-01-01') then raise exception 'Client override was not corrected'; end if;
 perform set_config('role','none',true);
 perform set_config('role','anon',true);
 begin
   perform 1 from closing_payments;
   raise exception 'Anonymous financial read accepted';
 exception when insufficient_privilege then null; end;
 perform set_config('role','none',true);
end;
$$;

-- A later company decision is independent, including December-to-January transitions.
do $$
declare v_actor uuid := '00000000-0000-0000-0000-000000000001'; v_id uuid; v_production numeric;
begin
 perform set_config('request.jwt.claim.sub',v_actor::text,true);
 select production into v_production from get_org_node_production_branch_aware(array[v_actor], '2999-01-01', null);
 if v_production <> 60 then raise exception 'Organization performance differs from closing attribution %',v_production; end if;
 perform set_closing_period_extension('2999-12-01','3000-01-01','Year-end holiday');
 insert into payments(installment_id,amount,paid_at,paid_by_user_id,payment_month)
 values('00000000-0000-0000-0000-000000000005',99,timestamp '3000-01-01 12:00' at time zone 'Africa/Cairo',v_actor,'3000-01-01') returning id into v_id;
 if not exists(select 1 from closing_payments where id=v_id and accounting_month='2999-12-01' and payment_month='3000-01-01') then raise exception 'Year boundary failed'; end if;
 insert into monthly_closings(month,is_open) values('2999-03-01',false);
 begin
  perform set_closing_period_extension('2999-03-01','2999-04-01','Closed');
  raise exception 'Closed month extension accepted';
 exception when raise_exception then if sqlerrm <> 'افتح الشهر أولًا قبل تعديل فترة الإقفال' then raise; end if; end;
 begin
  perform set_closing_period_extension('2999-04-01','2999-06-01','Overlapping');
  raise exception 'Overlapping periods accepted';
 exception when raise_exception then if sqlerrm <> 'راجع الشهر وتاريخ نهاية التمديد وسبب التمديد' then raise; end if; end;
end;
$$;

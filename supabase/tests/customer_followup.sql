-- Run against a database with at least two unrelated agents and an existing policy.
-- Every fixture and simulated settlement is rolled back. No existing customer is modified.
begin;
select set_config('request.jwt.claim.sub',p.owner_id::text,true), set_config('test.followup_branch',p.branch_id::text,true)
from public.policies p join public.users u on u.id=p.owner_id where u.role='agent' limit 1;
select set_config('test.other_agent',id::text,true) from public.users
where role='agent' and id <> auth.uid() and not (auth.uid() = any(public.get_user_subtree(id))) limit 1;
set local role authenticated;
do $$
declare
  c uuid := gen_random_uuid(); c2 uuid := gen_random_uuid(); c3 uuid := gen_random_uuid();
  p uuid := gen_random_uuid(); i uuid := gen_random_uuid(); f uuid := gen_random_uuid(); f2 uuid := gen_random_uuid();
  op uuid := gen_random_uuid(); ym date := date_trunc('month',now() at time zone 'Africa/Cairo')::date;
  today date := (now() at time zone 'Africa/Cairo')::date;
  before_i jsonb; before_p jsonb; before_y bigint;
begin
  if auth.uid() is null then raise exception 'Missing agent fixture'; end if;
  insert into public.customers(id,name,owner_id) values(c,'اختبار متابعة مؤقت',auth.uid()),(c2,'اختبار سبب التلف المؤقت',auth.uid()),(c3,'اختبار التوافق المؤقت',auth.uid());
  insert into public.policies(id,policy_number,customer_id,owner_id,branch_id,policy_type,start_date,payment_method,premium_amount,sum_assured)
  values(p,'FOLLOWUP-TEST-'||p,c,auth.uid(),current_setting('test.followup_branch')::uuid,'quadruple','2020-01-01','monthly',100,10000);
  insert into public.installments(id,policy_id,installment_number,amount,due_date) values(i,p,1,100,today);
  select to_jsonb(t) into before_i from public.installments t where id=i;
  select to_jsonb(t) into before_p from public.policies t where id=p;
  select count(*) into before_y from public.year2_payments where policy_id=p;
  insert into public.customer_followups(id,customer_id,kind,outcome,notes,next_date,policy_id,installment_id)
    values(f,c,'promise','payment_promise','اتفاق تجريبي',today,p,i);
  if (select followup_status from public.customer_followup_status where id=f) <> 'today' then raise exception 'Expected today promise'; end if;
  if before_i is distinct from (select to_jsonb(t) from public.installments t where id=i)
    or before_p is distinct from (select to_jsonb(t) from public.policies t where id=p)
    or before_y <> (select count(*) from public.year2_payments where policy_id=p)
  then raise exception 'Follow-up changed financial state'; end if;
  begin
    insert into public.customer_followups(customer_id,kind,outcome,notes,next_date,policy_id,installment_id) values(c,'promise','payment_promise','تكرار',today,p,i);
    raise exception 'Duplicate promise allowed';
  exception when unique_violation then null; end;
  begin
    insert into public.customer_followups(customer_id,kind,outcome,notes,next_date,policy_id,installment_id) values(c2,'promise','payment_promise','عميل خاطئ',today,p,i);
    raise exception 'Wrong customer allowed';
  exception when raise_exception then if sqlerrm <> 'الوثيقة لا تخص العميل أو لا تملك صلاحية الوصول إليها' then raise; end if; end;
  begin
    insert into public.customer_followups(customer_id,kind,outcome,notes,next_date,next_action) values(c,'contact','reached','تاريخ قديم',today-1,'اتصال');
    raise exception 'Past follow-up allowed';
  exception when raise_exception then if sqlerrm <> 'موعد المتابعة أو وعد السداد يجب أن يكون اليوم أو بعده' then raise; end if; end;
  begin
    insert into public.customer_followups(customer_id,kind,outcome,notes,next_date) values(c,'contact','reached','بدون خطوة',today);
    raise exception 'Missing next action allowed';
  exception when check_violation then null; end;
  update public.installments set status='paid' where id=i;
  if (select followup_status from public.customer_followup_status where id=f) <> 'paid' then raise exception 'Payment not reflected'; end if;
  update public.installments set status='pending' where id=i;
  if (select followup_status from public.customer_followup_status where id=f) <> 'today' then raise exception 'Cancellation not reflected'; end if;
  update public.customer_followups set close_note='العميل غيّر الموعد' where id=f;
  if not exists(select 1 from public.customer_followups where id=f and closed_at is not null and closed_by=auth.uid()) then raise exception 'Closure not attributed'; end if;
  if (select status from public.installments where id=i) <> 'pending' then raise exception 'Closing promise settled installment'; end if;
  begin
    update public.customer_followups set notes='تغيير التاريخ' where id=f;
    raise exception 'Immutable note editable';
  exception when insufficient_privilege then null; end;
  insert into public.customer_followups(id,customer_id,kind,outcome,notes,next_date,policy_id,payment_month) values(f2,c,'promise','payment_promise','وعد سنة ثانية',today,p,ym);
  insert into public.year2_payments(policy_id,amount,payment_date,payment_month,paid_by_user_id) values(p,100,today,ym,auth.uid());
  if (select followup_status from public.customer_followup_status where id=f2) <> 'paid' then raise exception 'Year two payment not reflected'; end if;
  update public.year2_payments set is_cancelled=true where policy_id=p;
  if (select followup_status from public.customer_followup_status where id=f2) <> 'today' then raise exception 'Year two cancellation not reflected'; end if;
  perform public.mark_customer_request_expired_with_reason(c2,'unreachable','تعذّر التواصل',op);
  perform public.mark_customer_request_expired_with_reason(c2,'unreachable','تعذّر التواصل',op);
  if (select count(*) from public.customer_followups where id=op) <> 1 then raise exception 'Expiry retry duplicated'; end if;
  if not exists(select 1 from public.customers where id=c2 and request_manually_expired and request_expiry_reason='unreachable') then raise exception 'Expiry reason not saved'; end if;
  perform public.mark_customer_request_expired(c3);
  if not exists(select 1 from public.customers where id=c3 and request_manually_expired and request_expiry_reason is null) then raise exception 'Legacy RPC changed'; end if;
  begin
    perform public.mark_customer_request_expired_with_reason(c,'other','اختبار',gen_random_uuid());
    raise exception 'Issued customer expired';
  exception when raise_exception then if sqlerrm <> 'لا يمكن تحويل الطلب إلى تالف لوجود وثيقة مرتبطة به' then raise; end if; end;
  perform set_config('test.followup_customer',c::text,true);
  perform set_config('test.followup_record',f::text,true);
end $$;
select set_config('request.jwt.claim.sub',current_setting('test.other_agent'),true);
do $$ begin
  if exists(select 1 from public.customer_followup_status where customer_id=current_setting('test.followup_customer')::uuid) then raise exception 'Cross-agent read allowed'; end if;
  begin
    insert into public.customer_followups(customer_id,kind,outcome,notes) values(current_setting('test.followup_customer')::uuid,'contact','reached','غير مصرح');
    raise exception 'Cross-agent insert allowed';
  exception when insufficient_privilege then null; end;
  update public.customer_followups set close_note='غير مصرح' where id=current_setting('test.followup_record')::uuid;
  if found then raise exception 'Cross-agent update allowed'; end if;
end $$;
rollback;
select 'All follow-up SQL assertions passed; fixtures rolled back' as verification;

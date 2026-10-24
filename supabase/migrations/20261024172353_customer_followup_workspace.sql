-- Additive operational follow-up only. No writes to payments, installments or financial rules.
create table public.customer_followups (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  author_id uuid default auth.uid() references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  kind text not null check (kind in ('contact','promise','expiry')),
  outcome text not null,
  notes text not null check (length(btrim(notes)) between 1 and 2000),
  next_action text check (length(next_action) <= 500),
  next_date date,
  policy_id uuid references public.policies(id) on delete cascade,
  installment_id uuid references public.installments(id) on delete cascade,
  payment_month date,
  close_note text check (length(btrim(close_note)) between 1 and 500),
  closed_at timestamptz,
  closed_by uuid references public.users(id) on delete set null,
  constraint followup_shape check (
    (kind = 'contact' and outcome in ('reached','no_answer','postponed','documents','declined','other') and policy_id is null and installment_id is null and payment_month is null)
    or (kind = 'promise' and outcome = 'payment_promise' and next_date is not null and policy_id is not null and ((installment_id is not null and payment_month is null) or (installment_id is null and payment_month is not null and extract(day from payment_month) = 1)))
    or (kind = 'expiry' and outcome in ('declined','postponed','unreachable','documents','other') and next_date is null and policy_id is null and installment_id is null and payment_month is null)
  ),
  constraint followup_next_action check (kind <> 'contact' or next_date is null or coalesce(length(btrim(next_action)),0) > 0)
);
create index customer_followups_customer_time on public.customer_followups(customer_id, created_at desc, id);
create index customer_followups_author on public.customer_followups(author_id);
create index customer_followups_closed_by on public.customer_followups(closed_by);
create index customer_followups_policy on public.customer_followups(policy_id) where policy_id is not null;
create index customer_followups_due on public.customer_followups(next_date, customer_id) where closed_at is null and next_date is not null;
create unique index customer_followups_open_installment on public.customer_followups(installment_id) where kind = 'promise' and closed_at is null and installment_id is not null;
create unique index customer_followups_open_month on public.customer_followups(policy_id, payment_month) where kind = 'promise' and closed_at is null and installment_id is null;
alter table public.customer_followups enable row level security;
create policy followups_select on public.customer_followups for select to authenticated
using (exists(select 1 from public.customers c where c.id = customer_id) and (policy_id is null or exists(select 1 from public.policies p where p.id = policy_id)));
create policy followups_insert on public.customer_followups for insert to authenticated
with check (author_id = (select auth.uid()) and exists(select 1 from public.customers c where c.id = customer_id) and (policy_id is null or exists(select 1 from public.policies p where p.id = policy_id)));
create policy followups_close on public.customer_followups for update to authenticated
using (exists(select 1 from public.customers c where c.id = customer_id) and (policy_id is null or exists(select 1 from public.policies p where p.id = policy_id)))
with check (exists(select 1 from public.customers c where c.id = customer_id) and (policy_id is null or exists(select 1 from public.policies p where p.id = policy_id)));
revoke all on public.customer_followups from public, anon, authenticated;
grant select on public.customer_followups to authenticated;
grant insert(id,customer_id,kind,outcome,notes,next_action,next_date,policy_id,installment_id,payment_month) on public.customer_followups to authenticated;
grant update(close_note) on public.customer_followups to authenticated;

create function public.validate_customer_followup() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare v_policy public.policies; v_installment public.installments;
begin
  if auth.uid() is null then raise exception 'يجب تسجيل الدخول أولًا'; end if;
  if tg_op = 'UPDATE' then
    if old.closed_at is not null then raise exception 'هذه المتابعة مغلقة بالفعل'; end if;
    if new.close_note is null or length(btrim(new.close_note)) = 0 then raise exception 'اكتب نتيجة المتابعة أو سبب إلغاء الوعد'; end if;
    new.closed_at := now(); new.closed_by := auth.uid();
    return new;
  end if;
  new.author_id := auth.uid(); new.created_at := now();
  new.closed_at := null; new.closed_by := null; new.close_note := null;
  if new.next_date is not null and new.next_date < (now() at time zone 'Africa/Cairo')::date then
    raise exception 'موعد المتابعة أو وعد السداد يجب أن يكون اليوم أو بعده';
  end if;
  if new.kind = 'promise' then
    select * into v_policy from public.policies where id = new.policy_id;
    if not found or v_policy.customer_id <> new.customer_id then raise exception 'الوثيقة لا تخص العميل أو لا تملك صلاحية الوصول إليها'; end if;
    if v_policy.status <> 'active' then raise exception 'وعد السداد متاح للوثائق النشطة فقط'; end if;
    if new.installment_id is not null then
      select * into v_installment from public.installments where id = new.installment_id;
      if not found or v_installment.policy_id <> new.policy_id then raise exception 'القسط لا يخص الوثيقة المحددة'; end if;
      if v_installment.status = 'paid' then raise exception 'القسط مسدد بالفعل؛ لا يحتاج وعد سداد'; end if;
    else
      if (now() at time zone 'Africa/Cairo')::date < (v_policy.start_date + interval '1 year')::date then raise exception 'الوثيقة لم تدخل السنة الثانية بعد'; end if;
      if new.payment_month < date_trunc('month', v_policy.start_date + interval '1 year')::date then
        raise exception 'شهر التحصيل يجب أن يكون ضمن السنة الثانية أو بعدها';
      end if;
      if exists(select 1 from public.year2_payments where policy_id = new.policy_id and payment_month = new.payment_month and not is_cancelled) then
        raise exception 'شهر التحصيل المحدد مسدد بالفعل';
      end if;
    end if;
  end if;
  return new;
end $$;
revoke all on function public.validate_customer_followup() from public, anon, authenticated;
create trigger validate_customer_followup before insert or update on public.customer_followups for each row execute function public.validate_customer_followup();

-- The view reads actual settlement state; it never marks an installment as paid.
create view public.customer_followup_status with (security_invoker = true) as
select f.*, c.name as customer_name, c.phone as customer_phone, c.owner_id,
  p.branch_id, p.policy_number, i.installment_number, i.due_date,
  u.name as author_name,
  case
    when f.closed_at is not null then 'closed'
    when f.kind = 'promise' and (i.status = 'paid' or (f.installment_id is null and exists(
      select 1 from public.year2_payments y where y.policy_id = f.policy_id and y.payment_month = f.payment_month and not y.is_cancelled
    ))) then 'paid'
    when f.kind = 'promise' and p.status <> 'active' then 'inactive'
    when f.next_date < (now() at time zone 'Africa/Cairo')::date then 'overdue'
    when f.next_date = (now() at time zone 'Africa/Cairo')::date then 'today'
    when f.next_date is not null then 'upcoming'
    else 'logged'
  end as followup_status
from public.customer_followups f
join public.customers c on c.id = f.customer_id
left join public.policies p on p.id = f.policy_id
left join public.installments i on i.id = f.installment_id
left join public.users u on u.id = f.author_id;
revoke all on public.customer_followup_status from public, anon, authenticated;
grant select on public.customer_followup_status to authenticated;

alter table public.customers add column request_expiry_reason text check (request_expiry_reason in ('declined','postponed','unreachable','documents','other')),
  add column request_expiry_note text check (length(request_expiry_note) <= 500);
-- Keep the previous RPC unchanged for already-open browser sessions.
create function public.mark_customer_request_expired_with_reason(p_customer_id uuid, p_reason text, p_note text, p_operation_id uuid)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  perform id from public.customers where id = p_customer_id for update;
  if not found then raise exception 'الطلب غير موجود أو ليس لديك صلاحية تعديله'; end if;
  if exists(select 1 from public.customer_followups where id = p_operation_id and customer_id = p_customer_id and kind = 'expiry' and outcome = p_reason) then return; end if;
  if p_reason is null or p_reason not in ('declined','postponed','unreachable','documents','other') then raise exception 'اختر سبب تحويل الطلب إلى تالف'; end if;
  if p_reason = 'other' and coalesce(length(btrim(p_note)),0) = 0 then raise exception 'اكتب سبب تحويل الطلب إلى تالف'; end if;
  if exists(select 1 from public.customers where id = p_customer_id and request_manually_expired) then raise exception 'تم تحويل الطلب إلى تالف بالفعل؛ حدّث القائمة'; end if;
  perform public.mark_customer_request_expired(p_customer_id);
  update public.customers set request_expiry_reason = p_reason, request_expiry_note = nullif(btrim(p_note),'') where id = p_customer_id;
  insert into public.customer_followups(id,customer_id,kind,outcome,notes)
    values(p_operation_id,p_customer_id,'expiry',p_reason,coalesce(nullif(btrim(p_note),''),'تحويل يدوي إلى طلب تالف'));
end $$;
revoke all on function public.mark_customer_request_expired_with_reason(uuid,text,text,uuid) from public, anon;
grant execute on function public.mark_customer_request_expired_with_reason(uuid,text,text,uuid) to authenticated;

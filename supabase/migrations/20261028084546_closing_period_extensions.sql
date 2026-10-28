-- Opt-in company-wide exceptions. Original payment dates/months and money are unchanged.
create table public.closing_period_extensions (
  id uuid primary key default gen_random_uuid(),
  month date not null unique check (extract(day from month) = 1),
  extended_until date not null,
  reason text not null check (length(trim(reason)) between 1 and 500),
  created_at timestamptz not null default now(),
  created_by uuid not null references public.users(id),
  updated_at timestamptz not null default now(),
  updated_by uuid not null references public.users(id),
  history jsonb not null default '[]'::jsonb,
  check (extended_until >= (month + interval '1 month')::date
    and extended_until < (month + interval '2 months')::date)
);
alter table public.closing_period_extensions enable row level security;
create policy closing_extensions_read on public.closing_period_extensions for select to authenticated using (true);
revoke all on public.closing_period_extensions from public, anon, authenticated;
grant select on public.closing_period_extensions to authenticated;
grant all on public.closing_period_extensions to service_role;

alter table public.payments
  add column closing_month date,
  add column closing_extension_id uuid references public.closing_period_extensions(id),
  add constraint payments_closing_allocation_pair check (
    (closing_month is null and closing_extension_id is null) or
    (closing_month is not null and closing_extension_id is not null and extract(day from closing_month) = 1)
  );
create index payments_closing_extension_idx on public.payments(closing_extension_id) where closing_extension_id is not null;
create index payments_accounting_month_idx on public.payments((coalesce(closing_month, payment_month)));

-- Invoker trigger: only reads public configuration, and never changes the payment operation.
create function public.assign_payment_closing_period() returns trigger
language plpgsql set search_path = public, pg_temp as $$
declare v_date date; v_extension public.closing_period_extensions;
begin
  if tg_op = 'UPDATE' and old.closing_extension_id is not null then
    new.closing_month := old.closing_month;
    new.closing_extension_id := old.closing_extension_id;
    return new;
  end if;
  -- Ignore any client-provided override. Historical imports keep their existing attribution.
  new.closing_month := null;
  new.closing_extension_id := null;
  if coalesce(new.is_historical, false) or new.is_cancelled then return new; end if;
  -- Inserts synchronize with an explicit setting save. Updates already hold row locks;
  -- they must not take the advisory lock (avoids inversion with backfill/cancellation).
  if tg_op = 'INSERT' then perform pg_advisory_xact_lock_shared(hashtext('closing_period_extensions')::bigint); end if;
  v_date := (new.paid_at at time zone 'Africa/Cairo')::date;
  if new.payment_month <> date_trunc('month', v_date)::date then return new; end if;
  select * into v_extension from public.closing_period_extensions e
    where e.month = (date_trunc('month', v_date) - interval '1 month')::date
      and v_date <= e.extended_until;
  if found then
    new.closing_month := v_extension.month;
    new.closing_extension_id := v_extension.id;
  end if;
  return new;
end;
$$;
revoke all on function public.assign_payment_closing_period() from public, anon;
create trigger payments_closing_period before insert or update on public.payments
for each row execute function public.assign_payment_closing_period();

create view public.closing_payments with (security_invoker = true) as
  select p.*, coalesce(p.closing_month, p.payment_month) as accounting_month
  from public.payments p;
revoke all on public.closing_payments from public, anon, authenticated;
grant select on public.closing_payments to authenticated, service_role;

-- Sole configuration write path; matches the existing company-wide close-month capability.
create function public.set_closing_period_extension(
  p_month date, p_extended_until date, p_reason text, p_expected_until date default null
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_actor uuid := auth.uid(); v_old public.closing_period_extensions;
  v_saved public.closing_period_extensions; v_count integer; v_existing boolean;
begin
  if v_actor is null or not exists (
    select 1 from public.users where id = v_actor and is_active and deleted_at is null
      and role in ('super_admin','development_manager','general_supervisor','supervisor')
  ) then raise exception 'غير مصرح بتمديد فترة الإقفال'; end if;
  if p_month is null or extract(day from p_month) <> 1 or p_extended_until is null
    or p_extended_until < (p_month + interval '1 month')::date
    or p_extended_until >= (p_month + interval '2 months')::date
    or length(trim(coalesce(p_reason,''))) not between 1 and 500 then
    raise exception 'راجع الشهر وتاريخ نهاية التمديد وسبب التمديد';
  end if;
  perform pg_advisory_xact_lock(hashtext('closing_period_extensions')::bigint);
  if exists(select 1 from public.monthly_closings where month = p_month and not is_open) then
    raise exception 'افتح الشهر أولًا قبل تعديل فترة الإقفال';
  end if;
  select * into v_old from public.closing_period_extensions where month = p_month for update;
  v_existing := found;
  if v_existing and v_old.extended_until = p_extended_until and v_old.reason = trim(p_reason) then
    return jsonb_build_object('extension', to_jsonb(v_old), 'assigned_count', 0);
  end if;
  if (v_existing and p_expected_until is distinct from v_old.extended_until)
    or (not v_existing and p_expected_until is not null) then
    raise exception 'تغيّرت إعدادات التمديد؛ حدّث الصفحة ثم أعد المحاولة';
  end if;
  if v_existing and p_extended_until < v_old.extended_until and exists (
    select 1 from public.payments where closing_extension_id = v_old.id
  ) then raise exception 'لا يمكن تقصير تمديد احتُسبت عليه مسددات بالفعل'; end if;
  if v_existing then
    update public.closing_period_extensions set extended_until = p_extended_until,
      reason = trim(p_reason), updated_at = now(), updated_by = v_actor,
      history = history || jsonb_build_array(jsonb_build_object('at',now(),'by',v_actor,
        'previous_until',v_old.extended_until,'until',p_extended_until,'reason',trim(p_reason)))
      where id = v_old.id returning * into v_saved;
  else
    insert into public.closing_period_extensions(month,extended_until,reason,created_by,updated_by,history)
      values(p_month,p_extended_until,trim(p_reason),v_actor,v_actor,
        jsonb_build_array(jsonb_build_object('at',now(),'by',v_actor,'until',p_extended_until,'reason',trim(p_reason))))
      returning * into v_saved;
  end if;
  -- Explicit save applies the company decision to matching existing real payments as well.
  -- Shared/exclusive advisory locks also cover concurrent insert/setting races.
  update public.payments set closing_month = p_month, closing_extension_id = v_saved.id
    where closing_month is null and not is_cancelled and not coalesce(is_historical,false)
      and payment_month = (p_month + interval '1 month')::date
      and paid_at >= ((p_month + interval '1 month')::timestamp at time zone 'Africa/Cairo')
      and paid_at < ((p_extended_until + 1)::timestamp at time zone 'Africa/Cairo');
  get diagnostics v_count = row_count;
  return jsonb_build_object('extension',to_jsonb(v_saved),'assigned_count',v_count);
end;
$$;
revoke all on function public.set_closing_period_extension(date,date,text,date) from public, anon;
grant execute on function public.set_closing_period_extension(date,date,text,date) to authenticated;
notify pgrst, 'reload schema';

-- Same pagination and filters; only paid-period attribution uses the exception.
-- Read-only pagination of display groups. Existing table RLS remains authoritative.
CREATE OR REPLACE FUNCTION public.get_collection_page(
  p_filter text, p_sub_type text, p_page integer, p_search text,
  p_branch_id uuid, p_owner_id uuid, p_month date
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_month date := date_trunc('month', p_month)::date;
  v_owners uuid[];
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF p_filter NOT IN ('month','overdue','paid') OR p_filter IS NULL
     OR p_sub_type NOT IN ('all','new','periodic') OR p_sub_type IS NULL
     OR p_page IS NULL OR p_page < 1 OR p_month IS NULL THEN
    RAISE EXCEPTION 'Invalid collection filters';
  END IF;
  IF p_owner_id IS NOT NULL THEN
    v_owners := CASE WHEN p_branch_id IS NULL
      THEN public.get_user_subtree(p_owner_id)
      ELSE public.get_user_subtree_branch_aware(p_owner_id, p_branch_id) END;
  END IF;

  WITH matched AS MATERIALIZED (
    SELECT i.id, i.policy_id, i.due_date,
      CASE WHEN p.policy_type = 'protection_investment'
        AND p.customer_id IS NOT NULL AND p.owner_id IS NOT NULL AND p.start_date IS NOT NULL
        THEN 'group:' || p.customer_id || ':' || p.owner_id || ':' || p.start_date || ':' || i.due_date
        ELSE 'single:' || i.id END AS group_key
    FROM public.installments i
    JOIN public.policies p ON p.id = i.policy_id
    LEFT JOIN public.customers c ON c.id = p.customer_id
    LEFT JOIN public.users u ON u.id = p.owner_id
    WHERE p.status <> 'cancelled'
      AND (p_branch_id IS NULL OR p.branch_id = p_branch_id)
      AND (p_owner_id IS NULL OR p.owner_id = ANY(v_owners))
      AND (p_sub_type = 'all' OR i.is_first = (p_sub_type = 'new'))
      AND (coalesce(trim(p_search), '') = ''
        OR p.policy_number ILIKE '%' || trim(p_search) || '%'
        OR c.name ILIKE '%' || trim(p_search) || '%'
        OR c.phone ILIKE '%' || trim(p_search) || '%'
        OR c.national_id ILIKE '%' || trim(p_search) || '%'
        OR u.name ILIKE '%' || trim(p_search) || '%')
      AND (
        (p_filter = 'month' AND i.status = 'pending'
          AND i.due_date >= v_month AND i.due_date < v_month + interval '1 month')
        OR (p_filter = 'overdue' AND i.status IN ('pending','overdue')
          AND i.due_date >= v_month - interval '2 months' AND i.due_date < v_month)
        OR (p_filter = 'paid' AND i.status = 'paid' AND EXISTS (
          SELECT 1 FROM public.payments pay WHERE pay.installment_id = i.id
            AND coalesce(pay.closing_month, pay.payment_month) = v_month AND pay.is_cancelled = false))
      )
  ), groups AS MATERIALIZED (
    SELECT group_key, min(due_date) AS due_date FROM matched GROUP BY group_key
  ), page_groups AS (
    SELECT group_key FROM groups ORDER BY due_date, group_key
    LIMIT 10 OFFSET ((p_page::bigint - 1) * 10)
  ), page_rows AS MATERIALIZED (
    SELECT m.* FROM matched m JOIN page_groups g USING (group_key)
  ), paid_counts AS (
    SELECT i.policy_id, count(*) AS paid_count FROM public.installments i
    WHERE i.status = 'paid' AND i.policy_id IN (SELECT policy_id FROM page_rows)
    GROUP BY i.policy_id
  )
  SELECT jsonb_build_object(
    'totalCount', (SELECT count(*) FROM groups),
    'totalPages', greatest(1, (SELECT ceil(count(*) / 10.0)::integer FROM groups)),
    'installments', coalesce((
      SELECT jsonb_agg(to_jsonb(i) || jsonb_build_object(
        'policy', to_jsonb(p) || jsonb_build_object(
          'customer', CASE WHEN c.id IS NULL THEN NULL ELSE jsonb_build_object('name', c.name, 'phone', c.phone, 'national_id', c.national_id) END,
          'owner', CASE WHEN u.id IS NULL THEN NULL ELSE jsonb_build_object('name', u.name) END),
        'paid_installments_count', coalesce(pc.paid_count, 0))
        ORDER BY r.due_date, r.group_key, i.id)
      FROM page_rows r
      JOIN public.installments i ON i.id = r.id
      JOIN public.policies p ON p.id = i.policy_id
      LEFT JOIN public.customers c ON c.id = p.customer_id
      LEFT JOIN public.users u ON u.id = p.owner_id
      LEFT JOIN paid_counts pc ON pc.policy_id = i.policy_id
    ), '[]'::jsonb)
  ) INTO v_result;
  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.get_collection_page(text,text,integer,text,uuid,uuid,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_collection_page(text,text,integer,text,uuid,uuid,date) TO authenticated;

create or replace function public.get_org_node_production_branch_aware(p_user_ids uuid[], p_month_start date, p_branch_id uuid default null)
returns table(user_id uuid, production numeric) language plpgsql stable security definer set search_path = public as $$
declare v_caller_subtree uuid[];
begin
  v_caller_subtree := get_user_subtree_branch_aware(auth.uid(), p_branch_id);
  return query select uid, coalesce(sum(pay.amount),0)::numeric
  from unnest(p_user_ids) as uid
  left join lateral (
    select p.amount from public.payments p
    join public.installments i on i.id = p.installment_id
    join public.policies pol on pol.id = i.policy_id
    where pol.owner_id = any(get_user_subtree_branch_aware(uid,p_branch_id))
      and p.is_cancelled = false and coalesce(p.closing_month,p.payment_month) = p_month_start
  ) pay on true where uid = any(v_caller_subtree) group by uid;
end;
$$;
notify pgrst, 'reload schema';

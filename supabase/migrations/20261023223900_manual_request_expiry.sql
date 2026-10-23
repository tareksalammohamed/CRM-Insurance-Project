-- Manual request classification only; policy issuance and financial logic are unchanged.
alter table public.customers
  add column request_manually_expired boolean not null default false;
comment on column public.customers.request_manually_expired is
  'Manual expiry for requests without policies. Any associated policy takes precedence in request classification.';

create function public.mark_customer_request_expired(p_customer_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'يجب تسجيل الدخول أولًا';
  end if;
  -- Respect existing customer RLS and serialize concurrent changes to this customer.
  perform id from public.customers where id = p_customer_id for update;
  if not found then
    raise exception 'الطلب غير موجود أو ليس لديك صلاحية تعديله';
  end if;
  if exists (select 1 from public.policies where customer_id = p_customer_id) then
    raise exception 'لا يمكن تحويل الطلب إلى تالف لوجود وثيقة مرتبطة به';
  end if;
  update public.customers set request_manually_expired = true where id = p_customer_id;
  if not found then
    raise exception 'ليس لديك صلاحية تعديل هذا الطلب';
  end if;
end;
$$;
revoke all on function public.mark_customer_request_expired(uuid) from public, anon;
grant execute on function public.mark_customer_request_expired(uuid) to authenticated;

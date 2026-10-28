-- Isolated local PostgreSQL fixture only. Never run this bootstrap on a deployed database.
create role anon; create role authenticated; create role service_role;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema public, auth to anon, authenticated, service_role;
grant execute on function auth.uid() to authenticated, service_role;
create table public.users(id uuid primary key, name text, role text, manager_id uuid, is_active boolean default true, deleted_at timestamptz);
create table public.customers(id uuid primary key, name text, phone text, national_id text);
create table public.policies(id uuid primary key, owner_id uuid references users, customer_id uuid references customers, branch_id uuid, policy_type text, start_date date, status text, policy_number text);
create table public.installments(id uuid primary key, policy_id uuid references policies, amount numeric, due_date date, is_first boolean, status text);
create table public.payments(id uuid primary key default gen_random_uuid(), installment_id uuid not null references installments, amount numeric not null,
 paid_at timestamptz not null, paid_by_user_id uuid not null references users, payment_month date not null, is_cancelled boolean not null default false,
 is_historical boolean not null default false, created_at timestamptz default now());
create table public.monthly_closings(id uuid primary key default gen_random_uuid(), month date unique, is_open boolean);
create function public.get_user_subtree(user_id uuid) returns uuid[] language sql stable as $$ select array[u.id] from public.users u where u.id=user_id $$;
create function public.get_user_subtree_branch_aware(user_id uuid, branch_id uuid) returns uuid[] language sql stable as $$ select public.get_user_subtree(user_id) $$;
alter table public.payments enable row level security;
create policy payment_owner_read on public.payments for select to authenticated using (paid_by_user_id=auth.uid());
grant select on public.users, public.customers, public.policies, public.installments, public.payments, public.monthly_closings to authenticated;
insert into users(id,name,role) values
 ('00000000-0000-0000-0000-000000000001','Test supervisor','supervisor'),
 ('00000000-0000-0000-0000-000000000002','Test agent','agent');
insert into customers values('00000000-0000-0000-0000-000000000003','Fixture','0','0');
insert into policies values('00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000003',null,'life','2998-01-01','active','fixture');
insert into installments values('00000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000004',100,'2999-01-01',true,'paid');

insert into policies values('00000000-0000-0000-0000-000000000008','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000003',null,'life','2998-01-01','active','agent-fixture');
insert into installments values('00000000-0000-0000-0000-000000000009','00000000-0000-0000-0000-000000000008',11,'2999-01-01',true,'paid');
insert into payments(installment_id,amount,paid_at,paid_by_user_id,payment_month) values
 ('00000000-0000-0000-0000-000000000005',7,'2998-12-15T12:00:00Z','00000000-0000-0000-0000-000000000001','2998-12-01');
grant insert,update on public.payments to authenticated;
create policy payment_owner_insert on public.payments for insert to authenticated with check (paid_by_user_id=auth.uid() and installment_id in(select i.id from public.installments i join public.policies p on p.id=i.policy_id where p.owner_id=auth.uid()));
create policy payment_owner_update on public.payments for update to authenticated using (paid_by_user_id=auth.uid()) with check (paid_by_user_id=auth.uid());

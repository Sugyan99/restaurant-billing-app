-- Staff Management: roles/permission overrides, shifts, performance, commission,
-- login audit, activity history and cashier closing.
create table if not exists public.staff_permission_overrides (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id text not null references public."User"(id) on delete cascade, permission text not null,
  allowed boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (tenant_id,user_id,permission)
);
create index if not exists idx_staff_perm_tenant_user on public.staff_permission_overrides(tenant_id,user_id);

create table if not exists public.staff_shifts (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id text not null references public."User"(id) on delete cascade, shift_date date not null,
  start_time timestamptz not null, end_time timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled','completed','missed','cancelled')),
  note text, created_by text references public."User"(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), check (end_time > start_time)
);
create index if not exists idx_staff_shifts_tenant_date on public.staff_shifts(tenant_id,shift_date);
create index if not exists idx_staff_shifts_tenant_user on public.staff_shifts(tenant_id,user_id);

create table if not exists public.staff_performance (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id text not null references public."User"(id) on delete cascade, reviewer_id text references public."User"(id) on delete set null,
  period_start date not null, period_end date not null, rating numeric(4,2) not null check (rating between 0 and 5),
  target numeric(12,2) not null default 0, achieved numeric(12,2) not null default 0, notes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), check (period_end >= period_start)
);
create index if not exists idx_staff_perf_tenant_user on public.staff_performance(tenant_id,user_id,period_end desc);

create table if not exists public.staff_commissions (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id text not null references public."User"(id) on delete cascade, period_start date not null, period_end date not null,
  basis_amount numeric(14,2) not null default 0, rate numeric(7,4) not null default 0 check (rate between 0 and 100),
  amount numeric(14,2) not null default 0 check (amount >= 0),
  status text not null default 'pending' check (status in ('pending','approved','paid','void')),
  approved_by text references public."User"(id) on delete set null, paid_at timestamptz, note text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), check (period_end >= period_start)
);
create index if not exists idx_staff_comm_tenant_user on public.staff_commissions(tenant_id,user_id,period_end desc);

create table if not exists public.staff_login_logs (
  id uuid primary key default gen_random_uuid(), tenant_id uuid references public.tenants(id) on delete set null,
  user_id text references public."User"(id) on delete set null, email text not null, success boolean not null,
  ip_address text, user_agent text, failure_reason text, created_at timestamptz not null default now()
);
create index if not exists idx_staff_login_logs_tenant_created on public.staff_login_logs(tenant_id,created_at desc);
create index if not exists idx_staff_login_logs_email_created on public.staff_login_logs(lower(email),created_at desc);

create table if not exists public.staff_activity (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id text references public."User"(id) on delete set null, action text not null, entity text not null, entity_id text,
  metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
create index if not exists idx_staff_activity_tenant_created on public.staff_activity(tenant_id,created_at desc);
create index if not exists idx_staff_activity_tenant_user on public.staff_activity(tenant_id,user_id,created_at desc);

create table if not exists public.cashier_closings (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id text not null references public."User"(id) on delete cascade, closing_date date not null,
  opening_cash numeric(14,2) not null default 0, expected_cash numeric(14,2) not null default 0,
  actual_cash numeric(14,2) not null default 0, variance numeric(14,2) generated always as (actual_cash - expected_cash) stored,
  notes text, approved_by text references public."User"(id) on delete set null,
  status text not null default 'submitted' check (status in ('submitted','approved','rejected')),
  closed_at timestamptz not null default now(), created_at timestamptz not null default now(), unique (tenant_id,user_id,closing_date)
);
create index if not exists idx_cashier_closing_tenant_date on public.cashier_closings(tenant_id,closing_date desc);

do $$ declare t text; begin
  foreach t in array array['staff_permission_overrides','staff_shifts','staff_performance','staff_commissions','staff_login_logs','staff_activity','cashier_closings'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('drop policy if exists %I on public.%I',t||'_prisma_app',t);
    execute format('create policy %I on public.%I for all to prisma_app using (tenant_id=get_session_tenant_id()) with check (tenant_id=get_session_tenant_id())',t||'_prisma_app',t);
    execute format('drop policy if exists %I on public.%I',t||'_service_role',t);
    execute format('create policy %I on public.%I for all to service_role using (true) with check (true)',t||'_service_role',t);
  end loop;
end $$;

create or replace function public.staff_set_updated_at() returns trigger language plpgsql set search_path='' as $$
begin new.updated_at=now(); return new; end; $$;

drop trigger if exists staff_perm_updated_at on public.staff_permission_overrides;
create trigger staff_perm_updated_at before update on public.staff_permission_overrides for each row execute function public.staff_set_updated_at();
drop trigger if exists staff_shift_updated_at on public.staff_shifts;
create trigger staff_shift_updated_at before update on public.staff_shifts for each row execute function public.staff_set_updated_at();
drop trigger if exists staff_perf_updated_at on public.staff_performance;
create trigger staff_perf_updated_at before update on public.staff_performance for each row execute function public.staff_set_updated_at();
drop trigger if exists staff_comm_updated_at on public.staff_commissions;
create trigger staff_comm_updated_at before update on public.staff_commissions for each row execute function public.staff_set_updated_at();

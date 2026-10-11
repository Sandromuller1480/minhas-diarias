create extension if not exists "pgcrypto";
create extension if not exists "pg_cron";
create extension if not exists "pg_net";

create table public.app_settings (
  id boolean primary key default true check (id),
  authorized_owner_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  professional_name text not null default 'Sandro Müller',
  default_daily_rate_cents integer not null check (default_daily_rate_cents >= 0),
  timezone text not null default 'America/Cuiaba',
  reminder_weekdays integer[] not null default '{1,2,3,4,5}',
  reminders_enabled boolean not null default false,
  morning_reminder_enabled boolean not null default true,
  afternoon_reminder_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.contractors (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(owner_id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  phone text,
  private_note text,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, id)
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(owner_id) on delete cascade,
  contractor_id uuid not null,
  name text not null check (length(trim(name)) > 0),
  address text,
  start_date date,
  daily_rate_cents integer check (daily_rate_cents is null or daily_rate_cents >= 0),
  status text not null default 'active' check (status in ('active', 'completed', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, id),
  foreign key (owner_id, contractor_id) references public.contractors(owner_id, id)
);

create table public.work_entries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(owner_id) on delete cascade,
  project_id uuid,
  work_date date not null,
  period text not null check (period in ('morning', 'afternoon')),
  status text not null check (status in ('planned', 'worked', 'off')),
  applied_daily_rate_cents integer not null default 0 check (applied_daily_rate_cents >= 0),
  amount_cents integer not null default 0 check (amount_cents >= 0),
  manual_amount_cents integer check (manual_amount_cents is null or manual_amount_cents >= 0),
  manual_reason text,
  private_note text,
  shareable_description text,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, work_date, period),
  unique (owner_id, id),
  foreign key (owner_id, project_id) references public.projects(owner_id, id),
  check ((status = 'off' and project_id is null and amount_cents = 0) or (status <> 'off' and project_id is not null))
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(owner_id) on delete cascade,
  project_id uuid not null,
  paid_at date not null,
  amount_cents integer not null check (amount_cents > 0),
  method text not null check (method in ('pix', 'cash', 'transfer', 'other')),
  note text,
  reversed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (owner_id, id),
  foreign key (owner_id, project_id) references public.projects(owner_id, id)
);

create table public.payment_allocations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(owner_id) on delete cascade,
  payment_id uuid not null,
  work_entry_id uuid not null,
  amount_cents integer not null check (amount_cents > 0),
  created_at timestamptz not null default now(),
  unique (owner_id, payment_id, work_entry_id),
  foreign key (owner_id, payment_id) references public.payments(owner_id, id) on delete cascade,
  foreign key (owner_id, work_entry_id) references public.work_entries(owner_id, id)
);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(owner_id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  device_label text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, endpoint)
);

create table public.reminder_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(owner_id) on delete cascade,
  local_date date not null,
  reminder_hour integer not null check (reminder_hour in (12, 18)),
  status text not null default 'pending' check (status in ('pending', 'sent', 'skipped', 'failed')),
  reason text,
  created_at timestamptz not null default now(),
  unique (owner_id, local_date, reminder_hour)
);

create table public.reminder_deliveries (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.reminder_events(id) on delete cascade,
  subscription_id uuid not null references public.push_subscriptions(id) on delete cascade,
  attempt integer not null default 1,
  result text not null check (result in ('accepted', 'failed', 'expired')),
  error text,
  created_at timestamptz not null default now(),
  unique (event_id, subscription_id, attempt)
);

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(owner_id) on delete cascade,
  entity text not null,
  entity_id uuid,
  operation text not null,
  change jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.authorized_owner_id()
returns uuid
language sql
stable
as $$
  select authorized_owner_id from public.app_settings where id = true
$$;

create or replace function public.is_authorized_owner(owner uuid)
returns boolean
language sql
stable
as $$
  select (select auth.uid()) = owner
    and (public.authorized_owner_id() is null or owner = public.authorized_owner_id())
$$;

alter table public.profiles enable row level security;
alter table public.app_settings enable row level security;
alter table public.contractors enable row level security;
alter table public.projects enable row level security;
alter table public.work_entries enable row level security;
alter table public.payments enable row level security;
alter table public.payment_allocations enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.reminder_events enable row level security;
alter table public.reminder_deliveries enable row level security;
alter table public.audit_log enable row level security;

create policy "owner profile" on public.profiles for all using (public.is_authorized_owner(owner_id)) with check (public.is_authorized_owner(owner_id));
create policy "owner contractors" on public.contractors for all using (public.is_authorized_owner(owner_id)) with check (public.is_authorized_owner(owner_id));
create policy "owner projects" on public.projects for all using (public.is_authorized_owner(owner_id)) with check (public.is_authorized_owner(owner_id));
create policy "owner entries" on public.work_entries for all using (public.is_authorized_owner(owner_id)) with check (public.is_authorized_owner(owner_id));
create policy "owner payments" on public.payments for all using (public.is_authorized_owner(owner_id)) with check (public.is_authorized_owner(owner_id));
create policy "owner allocations" on public.payment_allocations for all using (public.is_authorized_owner(owner_id)) with check (public.is_authorized_owner(owner_id));
create policy "owner push" on public.push_subscriptions for all using (public.is_authorized_owner(owner_id)) with check (public.is_authorized_owner(owner_id));
create policy "owner reminders" on public.reminder_events for select using (public.is_authorized_owner(owner_id));
create policy "owner deliveries" on public.reminder_deliveries for select using (
  exists (select 1 from public.reminder_events e where e.id = event_id and public.is_authorized_owner(e.owner_id))
);
create policy "owner audit" on public.audit_log for select using (public.is_authorized_owner(owner_id));

create or replace function public.ensure_payment_integrity()
returns trigger
language plpgsql
as $$
declare
  payment_project uuid;
  entry_project uuid;
  payment_total integer;
  entry_total integer;
  entry_amount integer;
begin
  select project_id into payment_project from public.payments where id = new.payment_id and owner_id = new.owner_id and reversed_at is null;
  select project_id, amount_cents into entry_project, entry_amount from public.work_entries where id = new.work_entry_id and owner_id = new.owner_id and status = 'worked';
  if payment_project is null or entry_project is null or payment_project <> entry_project then
    raise exception 'Allocation must match active payment and work entry from the same project';
  end if;

  select coalesce(sum(amount_cents), 0) into payment_total from public.payment_allocations where owner_id = new.owner_id and payment_id = new.payment_id;
  select amount_cents into entry_amount from public.work_entries where owner_id = new.owner_id and id = new.work_entry_id;
  select coalesce(sum(amount_cents), 0) into entry_total from public.payment_allocations where owner_id = new.owner_id and work_entry_id = new.work_entry_id;

  if payment_total > (select amount_cents from public.payments where owner_id = new.owner_id and id = new.payment_id) then
    raise exception 'Payment allocation exceeds payment amount';
  end if;
  if entry_total > entry_amount then
    raise exception 'Payment allocation exceeds entry balance';
  end if;
  return new;
end;
$$;

create trigger payment_allocations_integrity
after insert or update on public.payment_allocations
for each row execute function public.ensure_payment_integrity();

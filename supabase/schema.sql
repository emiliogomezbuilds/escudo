-- Escudo — data model + RLS (Feature 3, docs/BUILD_PROMPT.md)
-- Run manually in the Supabase SQL Editor. Kept here for version-controlled
-- reference; this file is not auto-applied by any migration tool yet.

-- family_contacts
create table family_contacts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) default auth.uid(),
  name text not null,
  phone_e164 text not null,
  verified boolean not null default false,
  created_at timestamptz not null default now()
);
alter table family_contacts enable row level security;
create policy "owner full access" on family_contacts
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- alert_thresholds
create table alert_thresholds (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) default auth.uid(),
  min_amount numeric not null,
  protected_person_label text not null,
  created_at timestamptz not null default now()
);
alter table alert_thresholds enable row level security;
create policy "owner full access" on alert_thresholds
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- risk_events
create table risk_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) default auth.uid(),
  event_type text not null,
  amount numeric not null,
  payee_label text not null,
  matched boolean not null default false,
  is_simulated boolean not null default true,
  created_at timestamptz not null default now()
);
alter table risk_events enable row level security;
create policy "owner full access" on risk_events
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- alert_calls
create table alert_calls (
  id uuid primary key default gen_random_uuid(),
  risk_event_id uuid not null references risk_events(id) on delete cascade,
  script_text text not null,
  call_status text not null default 'pending',
  placed_at timestamptz not null default now()
);
alter table alert_calls enable row level security;
create policy "owner via risk_event" on alert_calls
  for all using (
    exists (select 1 from risk_events r where r.id = risk_event_id and r.owner_id = auth.uid())
  ) with check (
    exists (select 1 from risk_events r where r.id = risk_event_id and r.owner_id = auth.uid())
  );

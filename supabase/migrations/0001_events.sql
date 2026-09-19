create table if not exists public.events (
  id          uuid        primary key,
  type        text        not null,
  payload     jsonb       not null,
  occurred_at timestamptz not null,
  recorded_at timestamptz not null,
  device_id   text        not null,
  owner_id    uuid        not null references auth.users(id) on delete cascade,
  server_seq  bigserial
);

create index if not exists events_owner_seq_idx
  on public.events (owner_id, server_seq);

alter table public.events enable row level security;

-- Append-only: insert and select only. No update policy, no delete policy,
-- for anyone. Corrections are compensating events.
create policy events_select_own on public.events
  for select using (auth.uid() = owner_id);

create policy events_insert_own on public.events
  for insert with check (auth.uid() = owner_id);

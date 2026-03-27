-- Run this entire script in Supabase → SQL Editor → New query

-- 1. Deals table
create table if not exists deals (
  id          text primary key,
  company     text,
  contact     text,
  vertical    text,
  stage       text,
  value       numeric default 0,
  close_date  date,
  notes       text,
  owner       text,
  created_at  timestamptz default now(),
  updated_at  timestamptz
);

-- 2. Activity / comments table
create table if not exists activity (
  id         text primary key,
  deal_id    text references deals(id) on delete cascade,
  "user"     text,
  type       text,   -- 'created' | 'stage' | 'assign' | 'value' | 'comment'
  text       text,
  created_at timestamptz default now()
);

-- 3. Enable real-time on both tables
-- (Supabase Dashboard → Database → Replication → toggle both tables on)
-- Or run these:
alter publication supabase_realtime add table deals;
alter publication supabase_realtime add table activity;

-- 4. Open up row-level security for the anon key
--    (fine for an internal team tool; add auth later if needed)
alter table deals    enable row level security;
alter table activity enable row level security;

create policy "Allow all for anon" on deals    for all using (true) with check (true);
create policy "Allow all for anon" on activity for all using (true) with check (true);

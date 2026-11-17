-- iSKOLEKTIB database setup. Paste this whole file into Supabase > SQL Editor > Run.
-- DEMO ONLY: the policies below let the app read/write everything with the public key.

create table if not exists users         (id text   primary key, owner text, data jsonb not null);
create table if not exists scholarships  (id bigint primary key, owner text, data jsonb not null);
create table if not exists applications  (id bigint primary key, owner text, data jsonb not null);

alter table users        enable row level security;
alter table scholarships enable row level security;
alter table applications enable row level security;

drop policy if exists "demo all" on users;
drop policy if exists "demo all" on scholarships;
drop policy if exists "demo all" on applications;
create policy "demo all" on users        for all using (true) with check (true);
create policy "demo all" on scholarships for all using (true) with check (true);
create policy "demo all" on applications for all using (true) with check (true);

-- Private file bucket for announcement PDFs and student documents
insert into storage.buckets (id, name, public) values ('iskolektib-files', 'iskolektib-files', false)
  on conflict (id) do nothing;
drop policy if exists "demo files" on storage.objects;
create policy "demo files" on storage.objects for all
  using (bucket_id = 'iskolektib-files') with check (bucket_id = 'iskolektib-files');

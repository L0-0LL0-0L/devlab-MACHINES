create table public.profiles (
  id uuid primary key,
  display_name text,
  wallet_address text,
  preferred_cluster text not null default 'devnet' check (preferred_cluster in ('devnet','mainnet-beta')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "own profile select" on public.profiles for select to authenticated using (auth.uid() = id);
create policy "own profile insert" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "own profile update" on public.profiles for update to authenticated using (auth.uid() = id);

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name) values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)));
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  cluster text not null default 'devnet' check (cluster in ('devnet','mainnet-beta')),
  status text not null default 'draft' check (status in ('draft','submitted')),
  title text not null check (char_length(title) between 3 and 120),
  symbol text not null check (symbol ~ '^[A-Z0-9]{2,10}$'),
  thesis text not null,
  category text not null,
  evidence jsonb not null default '[]'::jsonb,
  treasury_address text,
  token_supply bigint,
  token_decimals int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.projects to authenticated;
grant all on public.projects to service_role;
alter table public.projects enable row level security;
create policy "own projects all" on public.projects for all to authenticated using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create table public.watchlist (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  cluster text not null default 'devnet',
  label text not null,
  address text not null,
  created_at timestamptz not null default now(),
  unique (owner_id, cluster, address)
);
grant select, insert, update, delete on public.watchlist to authenticated;
grant all on public.watchlist to service_role;
alter table public.watchlist enable row level security;
create policy "own watchlist all" on public.watchlist for all to authenticated using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create table public.research_runs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  question text not null check (char_length(question) between 5 and 2000),
  source_text text,
  paper_query text,
  roles text[] not null default '{}',
  status text not null default 'queued' check (status in ('queued','running','complete','failed')),
  result text,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.research_runs to authenticated;
grant all on public.research_runs to service_role;
alter table public.research_runs enable row level security;
create policy "own runs all" on public.research_runs for all to authenticated using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
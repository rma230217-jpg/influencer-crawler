-- 이름을 붙여 채널을 분류하는 "목록" 기능. 채널 등록 시 목록을 새로 만들거나
-- 기존 목록에 바로 추가할 수 있다. 팀 전체가 공유한다 (기존 saved_channels 즐겨찾기와는 별개 기능).

create table if not exists public.lists (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

create table if not exists public.list_channels (
  list_id uuid not null references public.lists (id) on delete cascade,
  channel_id uuid not null references public.channels (id) on delete cascade,
  added_by uuid references auth.users (id),
  added_at timestamptz not null default now(),
  primary key (list_id, channel_id)
);

alter table public.lists enable row level security;
alter table public.list_channels enable row level security;

drop policy if exists "authenticated can read lists" on public.lists;
create policy "authenticated can read lists" on public.lists
  for select to authenticated using (true);

drop policy if exists "authenticated can insert lists" on public.lists;
create policy "authenticated can insert lists" on public.lists
  for insert to authenticated with check (true);

drop policy if exists "authenticated can delete lists" on public.lists;
create policy "authenticated can delete lists" on public.lists
  for delete to authenticated using (true);

drop policy if exists "authenticated can read list_channels" on public.list_channels;
create policy "authenticated can read list_channels" on public.list_channels
  for select to authenticated using (true);

drop policy if exists "authenticated can insert list_channels" on public.list_channels;
create policy "authenticated can insert list_channels" on public.list_channels
  for insert to authenticated with check (true);

drop policy if exists "authenticated can delete list_channels" on public.list_channels;
create policy "authenticated can delete list_channels" on public.list_channels
  for delete to authenticated using (true);

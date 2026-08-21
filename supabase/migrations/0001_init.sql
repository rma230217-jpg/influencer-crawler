-- 인플루언서 발굴 대시보드 — 초기 스키마 (MVP: 유튜브)
-- Supabase 대시보드 SQL Editor에서 실행하거나 `supabase db push`로 적용하세요.

create extension if not exists "pgcrypto";

-- 카테고리 enum (3.3 카테고리 탭)
do $$
begin
  if not exists (select 1 from pg_type where typname = 'channel_category') then
    create type channel_category as enum (
      '뷰티', '패션', '푸드', '리빙/홈', '육아', '반려동물', '살림'
    );
  end if;
end
$$;

-- channels 테이블
create table if not exists public.channels (
  id uuid primary key default gen_random_uuid(),
  platform text not null default 'youtube',
  youtube_channel_id text unique,
  channel_name text not null,
  channel_url text not null,
  subscriber_count bigint not null default 0,
  avg_views_last_6_shorts numeric,
  contact_email text,
  last_updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id)
);

comment on table public.channels is '수집된 인플루언서(유튜브) 채널';
comment on column public.channels.avg_views_last_6_shorts is '최근 업로드 중 60초 이하(숏폼) 영상 최근 6개 평균 조회수';

-- channel_categories 테이블 (다대다)
create table if not exists public.channel_categories (
  channel_id uuid not null references public.channels (id) on delete cascade,
  category channel_category not null,
  primary key (channel_id, category)
);

create index if not exists channels_subscriber_count_idx on public.channels (subscriber_count desc);
create index if not exists channels_avg_views_idx on public.channels (avg_views_last_6_shorts desc);
create index if not exists channels_channel_name_idx on public.channels using gin (to_tsvector('simple', channel_name));

-- Row Level Security: 내부용 툴이므로 로그인한(=authenticated) 팀원 전체에게 읽기/쓰기 허용
alter table public.channels enable row level security;
alter table public.channel_categories enable row level security;

drop policy if exists "authenticated can read channels" on public.channels;
create policy "authenticated can read channels" on public.channels
  for select to authenticated using (true);

drop policy if exists "authenticated can insert channels" on public.channels;
create policy "authenticated can insert channels" on public.channels
  for insert to authenticated with check (true);

drop policy if exists "authenticated can update channels" on public.channels;
create policy "authenticated can update channels" on public.channels
  for update to authenticated using (true) with check (true);

drop policy if exists "authenticated can delete channels" on public.channels;
create policy "authenticated can delete channels" on public.channels
  for delete to authenticated using (true);

drop policy if exists "authenticated can read channel_categories" on public.channel_categories;
create policy "authenticated can read channel_categories" on public.channel_categories
  for select to authenticated using (true);

drop policy if exists "authenticated can insert channel_categories" on public.channel_categories;
create policy "authenticated can insert channel_categories" on public.channel_categories
  for insert to authenticated with check (true);

drop policy if exists "authenticated can update channel_categories" on public.channel_categories;
create policy "authenticated can update channel_categories" on public.channel_categories
  for update to authenticated using (true) with check (true);

drop policy if exists "authenticated can delete channel_categories" on public.channel_categories;
create policy "authenticated can delete channel_categories" on public.channel_categories
  for delete to authenticated using (true);

-- 매일 자동 갱신(cron)은 Vercel Cron -> /api/channels/refresh 에서
-- Supabase Service Role Key로 RLS를 우회해 처리합니다(서버 전용, 클라이언트에 노출 금지).

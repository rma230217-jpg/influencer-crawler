-- v2 추가 기능: 통합 검색, 컨택하기(연락처 확장), 저장 목록(즐겨찾기)
-- 0001_init.sql 적용 후 Supabase SQL Editor에서 실행하세요.

-- 9.1 통합 검색: 채널 소개란을 저장해두고 검색 대상에 포함시킨다.
alter table public.channels add column if not exists description text;

-- 9.3 컨택하기: 이메일 외 전화번호/인스타그램 연락처도 저장한다 (모두 공개된 정보 기준).
alter table public.channels add column if not exists contact_phone text;
alter table public.channels add column if not exists contact_instagram text;

-- 9.5 저장 목록(즐겨찾기): 팀 전체가 공유하는 목록 (채널당 저장 여부만 관리).
create table if not exists public.saved_channels (
  channel_id uuid primary key references public.channels (id) on delete cascade,
  saved_by uuid references auth.users (id),
  saved_at timestamptz not null default now()
);

comment on table public.saved_channels is '팀 전체가 공유하는 저장(즐겨찾기) 목록. 필요 시 팀원별 개인 목록으로 확장 가능.';

alter table public.saved_channels enable row level security;

drop policy if exists "authenticated can read saved_channels" on public.saved_channels;
create policy "authenticated can read saved_channels" on public.saved_channels
  for select to authenticated using (true);

drop policy if exists "authenticated can insert saved_channels" on public.saved_channels;
create policy "authenticated can insert saved_channels" on public.saved_channels
  for insert to authenticated with check (true);

drop policy if exists "authenticated can delete saved_channels" on public.saved_channels;
create policy "authenticated can delete saved_channels" on public.saved_channels
  for delete to authenticated using (true);

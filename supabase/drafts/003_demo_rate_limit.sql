-- ═══════════════════════════════════════════════════════════════
-- [초안] 003_demo_rate_limit.sql — 쓰기 요청 횟수 제한
--
-- ⚠️ 승인 전 적용 금지.
--
-- 목적: 공개 데모에서 같은 접속자가 등록/수정/삭제/업로드를 짧은 시간에 대량 반복하는 것을 늦춘다.
--       평가자의 일반적인 CRUD·이미지 테스트는 방해하지 않도록 한도를 넉넉하게 잡는다.
--
-- 동작 방식
--   - Next.js 서버가 접속자 IP를 비밀 salt 와 함께 HMAC-SHA256 으로 해시해 client_key 로 보낸다.
--   - "행동 그룹"별로 따로 센다. (예: 수정을 많이 해도 이미지 업로드 한도는 줄지 않음)
--   - 입력 검증에 실패한 요청은 이 함수까지 오지 않으므로 횟수에 포함되지 않는다.
--
-- Vercel 환경
--   - 서버리스 함수는 요청마다 메모리가 초기화될 수 있어, 횟수 기록을 DB에 둔다.
--
-- 개인정보 최소화
--   - IP 원본은 저장하지 않는다 (해시값만 저장).
--   - 24시간이 지난 기록은 함수가 호출될 때마다 일괄 삭제한다.
-- ═══════════════════════════════════════════════════════════════

create table public.demo_write_events (
  id          bigint generated always as identity primary key,
  client_key  text        not null,  -- HMAC-SHA256 hex (64자)
  action      text        not null,  -- 행동 그룹: 'product.write' | 'product.delete' | 'image.upload'
  created_at  timestamptz not null default now(),

  constraint demo_write_events_client_key_format check (client_key ~ '^[0-9a-f]{64}$'),
  constraint demo_write_events_action_valid
    check (action in ('product.write', 'product.delete', 'image.upload'))
);

create index demo_write_events_lookup_idx
  on public.demo_write_events (client_key, action, created_at desc);
create index demo_write_events_created_at_idx
  on public.demo_write_events (created_at);

alter table public.demo_write_events enable row level security;
revoke all on table public.demo_write_events from anon, authenticated;
grant select, insert, delete on table public.demo_write_events to service_role;

-- 허용되면 기록하고 true, 한도를 넘으면 false.
-- 예: select public.consume_write_quota('<hash>', 'product.write', 60, interval '10 minutes');
create or replace function public.consume_write_quota(
  p_client_key text,
  p_action     text,
  p_limit      integer,
  p_window     interval
)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  recent_count integer;
begin
  -- 같은 접속자·같은 행동의 동시 요청은 순서대로 처리 (동시에 보내서 한도를 넘기는 것 방지)
  perform pg_advisory_xact_lock(hashtext(p_client_key || ':' || p_action));

  -- 24시간 지난 기록 일괄 정리 (created_at 인덱스 사용)
  delete from public.demo_write_events
  where created_at < now() - interval '24 hours';

  select count(*) into recent_count
  from public.demo_write_events
  where client_key = p_client_key
    and action     = p_action
    and created_at > now() - p_window;

  if recent_count >= p_limit then
    return false;
  end if;

  insert into public.demo_write_events (client_key, action)
  values (p_client_key, p_action);

  return true;
end;
$$;

revoke execute on function public.consume_write_quota(text, text, integer, interval)
  from public, anon, authenticated;
grant execute on function public.consume_write_quota(text, text, integer, interval)
  to service_role;

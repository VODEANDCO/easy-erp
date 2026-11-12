-- ═══════════════════════════════════════════════════════════════
-- [v1] 사용자 프로필 · 사업장 · 멤버십 (인증 · 사업장별 데이터 분리 1단계)
--
-- ⚠️ Supabase DB 적용은 아직 승인되지 않았습니다.
--    SQL Editor 실행 전에 반드시 별도 승인을 받습니다.
--    사전 검증: PGlite 메모리 DB — 결과는 docs/sql-verification.md 에 추가 예정
--
-- 만드는 것
--   - private 스키마: RLS 정책이 쓰는 검사 함수 보관 (Data API 에 노출되지 않음)
--   - public.profiles     : 사용자 프로필 (가입 시 자동 생성)
--   - public.businesses   : 사업장
--   - public.memberships  : 사업장 멤버와 역할 (owner / admin / staff)
--   - public.create_business() : 사업장 + owner 멤버십을 한 트랜잭션으로 생성
--
-- 접근 원칙
--   - 로그인하지 않은 사용자(anon): 아무것도 볼 수 없음
--   - 로그인 사용자: 내 프로필, 내가 소속된 사업장과 그 멤버만 조회
--   - 멤버십 추가·변경·삭제 정책 없음 → 스스로 남의 사업장에 들어갈 수 없음
--   - 사업자등록번호는 "자기 신고 값"이며 인증 여부는 별도 컬럼(business_number_verified_at)으로 관리
--
-- 기존 객체 영향
--   - SQL 001·002 의 products, 버킷, 함수는 변경하지 않음
--   - Supabase 관리 테이블 auth.users 에 프로필 자동 생성 트리거 1개 추가
--
-- 전제: Supabase(PostgreSQL 15 이상), SQL Editor(postgres 역할)에서 한 번만 실행
-- ═══════════════════════════════════════════════════════════════


-- ── 0. private 스키마 ──────────────────────────────────────────
-- Data API 는 public 등 "노출된 스키마"만 제공하므로 이 스키마의 함수는 API(RPC)로 호출할 수 없습니다.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
-- RLS 정책이 이 스키마의 함수를 호출하려면 사용 권한이 필요합니다. (함수 실행 권한은 아래에서 개별 부여)
grant usage on schema private to authenticated;
-- ⚠️ 규칙: PostgreSQL 은 새 함수에 PUBLIC 실행 권한을 기본으로 줍니다.
--    이 기본값은 스키마 단위로 회수할 수 없으므로(전역 설정만 가능, Supabase 영향 때문에 변경하지 않음)
--    private 스키마에 함수를 추가할 때는 반드시 바로 아래에서
--    "revoke all on function ... from public, anon, authenticated" 를 함께 실행합니다.


-- ── 1. 테이블 ─────────────────────────────────────────────────

create table public.profiles (
  id            uuid        primary key references auth.users (id) on delete cascade,
  display_name  text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint profiles_display_name_valid check (
    display_name is null
    or (
      char_length(display_name) between 1 and 50
      and display_name = btrim(display_name)
      and display_name !~ '[[:cntrl:]]'
    )
  )
);

create table public.businesses (
  id                           uuid        primary key default gen_random_uuid(),
  name                         text        not null,

  -- 사업자등록번호: 선택 입력, 숫자 10자리. 사용자가 입력한 "자기 신고 값"입니다.
  -- ⚠️ 입력했다고 해서 인증된 것이 아닙니다. 다른 사업장과 중복될 수 있습니다(의도적으로 UNIQUE 아님).
  business_number              text,
  -- 사업자 인증 완료 시각. 인증 절차(추후)를 거친 서버만 기록합니다. NULL = 미인증
  business_number_verified_at  timestamptz,

  -- 만든 사용자. 계정이 삭제되면 NULL (사업장 데이터는 유지)
  created_by                   uuid        references auth.users (id) on delete set null,
  created_at                   timestamptz not null default now(),
  updated_at                   timestamptz not null default now(),

  constraint businesses_name_valid check (
    char_length(name) between 1 and 100
    and name = btrim(name)
    and name ~ '[^[:space:]]'
    and name !~ '[[:cntrl:]]'
  ),
  constraint businesses_business_number_format check (
    business_number is null or business_number ~ '^[0-9]{10}$'
  ),
  -- 번호 없이 "인증됨" 상태가 될 수 없음
  constraint businesses_verified_requires_number check (
    business_number_verified_at is null or business_number is not null
  )
);

comment on column public.businesses.business_number is
  '사업자등록번호(자기 신고, 미검증). 인증 여부는 business_number_verified_at 으로만 판단';
comment on column public.businesses.business_number_verified_at is
  '사업자 인증 완료 시각. 사용자는 수정 불가. 번호가 바뀌면 자동으로 NULL';

-- 같은 사용자가 같은 이름(대소문자 무시)의 사업장을 두 번 만들지 못하게 (중복 제출 방지)
create unique index businesses_created_by_name_key
  on public.businesses (created_by, lower(name));

create table public.memberships (
  business_id  uuid        not null references public.businesses (id) on delete cascade,
  user_id      uuid        not null references auth.users (id) on delete cascade,
  role         text        not null,
  created_at   timestamptz not null default now(),

  primary key (business_id, user_id),
  constraint memberships_role_valid check (role in ('owner', 'admin', 'staff'))
);

-- "내가 속한 사업장" 조회용 (PK 는 business_id 가 앞이라 user_id 단독 검색에 별도 인덱스 필요)
create index memberships_user_id_idx on public.memberships (user_id);


-- ── 2. 멤버십 검사 함수 (RLS 정책 전용) ─────────────────────────
-- SECURITY DEFINER: 함수 소유자 권한으로 memberships 를 읽어
-- "memberships 정책이 memberships 를 다시 검사하는" 무한 반복을 피합니다.
-- search_path = '' : 모든 객체를 스키마 이름까지 적어, 같은 이름의 가짜 객체로 바꿔치기하는 공격을 막습니다.

create or replace function private.is_business_member(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.memberships m
     where m.business_id = p_business_id
       and m.user_id = (select auth.uid())
  );
$$;

create or replace function private.has_business_role(p_business_id uuid, p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.memberships m
     where m.business_id = p_business_id
       and m.user_id = (select auth.uid())
       and m.role = any (p_roles)
  );
$$;

revoke all on function private.is_business_member(uuid)        from public, anon, authenticated;
revoke all on function private.has_business_role(uuid, text[]) from public, anon, authenticated;
grant execute on function private.is_business_member(uuid)        to authenticated;
grant execute on function private.has_business_role(uuid, text[]) to authenticated;


-- ── 3. 회원가입 시 프로필 자동 생성 ─────────────────────────────
-- 사용자가 가입 때 보낸 메타데이터(raw_user_meta_data)는 신뢰하지 않고 id 만 넣습니다.
-- (사용자 입력 때문에 제약조건 오류가 나면 회원가입 전체가 실패하므로)

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function private.handle_new_user();

-- 이 트리거보다 먼저 가입한 사용자도 프로필을 갖도록 채워 넣습니다. (여러 번 실행해도 안전)
insert into public.profiles (id)
select u.id from auth.users u
on conflict (id) do nothing;


-- ── 4. 수정 시 자동 관리 (변경 불가 컬럼 보호, updated_at 갱신) ─────

create or replace function private.profiles_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.id         := old.id;
  new.created_at := old.created_at;
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_before_update
  before update on public.profiles
  for each row
  execute function private.profiles_before_update();

-- SECURITY DEFINER: created_by 검사에서 auth.users 를 읽어야 하므로 소유자 권한으로 실행합니다.
-- (트리거 전용 함수라 직접 호출할 수 없고, 실행 권한도 아래에서 모두 회수합니다)
create or replace function private.businesses_before_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.id         := old.id;
  new.created_at := old.created_at;
  new.updated_at := now();

  -- created_by 는 "만든 사용자의 계정이 삭제되어 NULL 이 되는 경우"에만 바뀔 수 있습니다.
  --   - 계정 삭제 시 외래키 ON DELETE SET NULL 이 이 트리거를 거쳐 NULL 로 바꿉니다.
  --     이때는 auth.users 에 해당 사용자가 더 이상 없으므로 허용합니다.
  --   - 그 밖의 변경(관리자 실수로 NULL 처리, 다른 사용자로 변경, NULL 에서 다시 채우기)은
  --     조용히 되돌리지 않고 오류로 알립니다.
  --   - 로그인 사용자는 이 컬럼의 수정 권한 자체가 없습니다.
  if new.created_by is distinct from old.created_by then
    if new.created_by is null
       and not exists (select 1 from auth.users u where u.id = old.created_by) then
      null;  -- 계정 삭제에 따른 정상 처리
    else
      raise exception using
        errcode = '42501',
        message = 'CREATED_BY_IMMUTABLE',
        hint    = 'created_by 는 만든 사용자의 계정이 삭제될 때만 자동으로 NULL 이 됩니다.';
    end if;
  end if;

  -- 사업자등록번호가 바뀌면 인증 상태를 해제합니다. (인증받은 번호를 다른 번호로 바꿔치기 방지)
  if new.business_number is distinct from old.business_number then
    new.business_number_verified_at := null;
  end if;

  return new;
end;
$$;

create trigger businesses_before_update
  before update on public.businesses
  for each row
  execute function private.businesses_before_update();

revoke all on function private.profiles_before_update()   from public, anon, authenticated;
revoke all on function private.businesses_before_update() from public, anon, authenticated;


-- ── 5. 사업장 생성 (사업장 + owner 멤버십을 한 트랜잭션으로) ────────
--
-- 오류 (앱에서 message 로 구분)
--   42501 NOT_AUTHENTICATED        로그인하지 않음
--   22023 INVALID_BUSINESS_NAME    이름이 비었거나 100자 초과, 제어 문자 포함
--   22023 INVALID_BUSINESS_NUMBER  사업자등록번호가 숫자 10자리가 아님 (하이픈·공백은 제거 후 검사)
--   P0001 BUSINESS_LIMIT_REACHED   소유 사업장 3개 초과
--   23505 BUSINESS_NAME_TAKEN      내가 만든 사업장 중 같은 이름이 있음
--   0A000 UNSUPPORTED_ISOLATION_LEVEL  REPEATABLE READ 트랜잭션에서 호출됨
--
-- 동시 요청: 사용자별 advisory lock 으로 순서대로 처리 → 동시에 여러 번 눌러도 3개를 넘지 않음
--   - READ COMMITTED(Supabase 기본값): 잠금을 얻은 뒤의 개수 조회가 새 스냅샷을 쓰므로
--     앞 요청이 커밋한 멤버십까지 보고 판단합니다.
--   - SERIALIZABLE: 동시에 실행되면 PostgreSQL 이 한쪽을 직렬화 오류(40001)로 취소합니다.
--   - REPEATABLE READ: 트랜잭션 시작 시점의 스냅샷을 계속 써서 잠금을 기다린 뒤에도
--     앞 요청의 결과를 보지 못합니다 → 한도를 넘을 수 있으므로 거부합니다.
--   - 다른 경로로 owner 멤버십을 만드는 기능(초대·양도 등)을 추가할 때는 같은 잠금 키를 사용해야 합니다.
-- business_number_verified_at 은 절대 설정하지 않습니다. (항상 미인증으로 생성)

create or replace function public.create_business(p_name text, p_business_number text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  max_owned constant integer := 3;
  v_user    uuid := (select auth.uid());
  v_name    text := btrim(coalesce(p_name, ''));
  v_number  text := nullif(regexp_replace(coalesce(p_business_number, ''), '[-[:space:]]', '', 'g'), '');
  v_id      uuid;
begin
  if v_user is null then
    raise exception using errcode = '42501', message = 'NOT_AUTHENTICATED';
  end if;

  if current_setting('transaction_isolation') = 'repeatable read' then
    raise exception using errcode = '0A000', message = 'UNSUPPORTED_ISOLATION_LEVEL';
  end if;

  if v_name = '' or char_length(v_name) > 100 or v_name ~ '[[:cntrl:]]' then
    raise exception using errcode = '22023', message = 'INVALID_BUSINESS_NAME';
  end if;

  if v_number is not null and v_number !~ '^[0-9]{10}$' then
    raise exception using errcode = '22023', message = 'INVALID_BUSINESS_NUMBER';
  end if;

  -- 같은 사용자의 생성 요청을 한 줄로 세웁니다. (트랜잭션이 끝나면 자동 해제)
  perform pg_advisory_xact_lock(hashtextextended('easy-erp:create_business:' || v_user::text, 0));

  if (select count(*)
        from public.memberships m
       where m.user_id = v_user and m.role = 'owner') >= max_owned then
    raise exception using
      errcode = 'P0001',
      message = 'BUSINESS_LIMIT_REACHED',
      hint    = '사업장은 한 사용자당 최대 3개까지 만들 수 있습니다.';
  end if;

  begin
    insert into public.businesses (name, business_number, created_by)
    values (v_name, v_number, v_user)
    returning id into v_id;
  exception
    when unique_violation then
      raise exception using errcode = '23505', message = 'BUSINESS_NAME_TAKEN';
  end;

  insert into public.memberships (business_id, user_id, role)
  values (v_id, v_user, 'owner');

  return v_id;
end;
$$;

revoke all on function public.create_business(text, text) from public, anon, authenticated;
grant execute on function public.create_business(text, text) to authenticated;


-- ── 6. RLS 와 접근 권한 ─────────────────────────────────────────

alter table public.profiles    enable row level security;
alter table public.businesses  enable row level security;
alter table public.memberships enable row level security;

-- Supabase 가 새 테이블에 자동으로 주는 권한을 먼저 모두 회수하고, 필요한 것만 다시 부여합니다.
revoke all on table public.profiles, public.businesses, public.memberships from anon, authenticated;

-- 로그인 사용자: 조회 + "바꿔도 되는 컬럼"만 수정 (INSERT/DELETE 권한 없음)
grant select, update (display_name)          on table public.profiles    to authenticated;
grant select, update (name, business_number) on table public.businesses  to authenticated;
grant select                                 on table public.memberships to authenticated;

-- 서버 관리 작업용 (RLS 우회 역할). 사용자 권한 판단에는 쓰지 않습니다.
grant select, insert, update, delete
  on table public.profiles, public.businesses, public.memberships to service_role;

-- profiles: 내 프로필만
create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- businesses: 멤버는 조회, owner/admin 은 이름·사업자등록번호 수정
create policy businesses_select_member on public.businesses
  for select to authenticated
  using (private.is_business_member(id));

create policy businesses_update_owner_admin on public.businesses
  for update to authenticated
  using (private.has_business_role(id, array['owner', 'admin']))
  with check (private.has_business_role(id, array['owner', 'admin']));

-- memberships: 같은 사업장 멤버끼리만 조회
-- 추가·수정·삭제 정책은 의도적으로 없습니다. (초대·역할 변경은 추후 별도 함수로)
create policy memberships_select_member on public.memberships
  for select to authenticated
  using (private.is_business_member(business_id));

-- ═══════════════════════════════════════════════════════════════
-- [v3] 상품 테이블 (v3: 판매가·원가 원 단위 정수 제약 추가)
--
-- ⚠️ Supabase DB 적용은 아직 승인되지 않았습니다. (migrations 폴더 이동 ≠ 적용 승인)
--    `supabase db push` 나 SQL Editor 실행 전에 반드시 별도 승인을 받습니다.
--    사전 검증: PGlite(PostgreSQL 18) 메모리 DB — 결과는 docs/sql-verification.md
--
-- 접근 방식 요약
--   - 브라우저(anon / publishable 키)는 이 테이블에 접근할 수 없습니다. (권한 없음 오류)
--   - Next.js 서버만 secret 키(service_role 역할)로 접근합니다.
--   - 사용자별 접근 제어(RLS 정책)는 이번 미션 범위가 아니며, 미션 7 이후에 추가합니다.
--
-- 전제
--   - Supabase(PostgreSQL 15 이상), 트랜잭션 격리 수준 READ COMMITTED(기본값)
-- ═══════════════════════════════════════════════════════════════

create table public.products (
  -- 고유 식별자: 추측하기 어려운 UUID (DB가 자동 생성, PostgreSQL 13+ 기본 함수)
  id              uuid          primary key default gen_random_uuid(),

  name            text          not null,
  sku             text          not null,
  category        text,

  -- 금액: 소수점 오차가 없는 NUMERIC. 최대 9,999,999,999.99
  price           numeric(12,2) not null,
  cost            numeric(12,2),

  stock_quantity  integer       not null default 0,
  safety_stock    integer       not null default 0,

  -- 판매 상태: active(판매중) / inactive(판매중지)
  status          text          not null default 'active',

  description     text,

  -- Storage 안의 파일 경로 (전체 URL이 아닌 "경로"만 저장)
  image_path      text,

  -- 재고 부족 여부: DB가 자동 계산 (직접 값을 넣으면 오류 → 앱은 이 컬럼을 절대 보내지 않음)
  -- Supabase API는 "컬럼끼리 비교" 필터가 없어 '재고 부족' 필터용으로 미리 계산해 둡니다.
  is_low_stock    boolean generated always as (stock_quantity <= safety_stock) stored,

  created_at      timestamptz   not null default now(),
  updated_at      timestamptz   not null default now(),

  -- ── 제약조건: 앱 코드에 실수가 있어도 DB가 잘못된 데이터를 막는 "최후의 방어선" ──

  -- 상품명: 1~100자, 앞뒤 공백 없이 저장, 공백 문자만으로 된 이름 금지
  constraint products_name_valid
    check (
      char_length(name) between 1 and 100
      and name = btrim(name)
      and name ~ '[^[:space:]]'
    ),

  -- SKU: 서버에서 앞뒤 공백 제거 + 대문자 변환 후 저장 → 'ab-1'과 'AB-1'은 같은 SKU
  constraint products_sku_format
    check (sku ~ '^[A-Z0-9][A-Z0-9_-]{1,39}$'),
  constraint products_sku_key
    unique (sku),

  constraint products_category_valid
    check (category is null or (char_length(category) between 1 and 50 and category = btrim(category))),

  constraint products_price_non_negative
    check (price >= 0),
  constraint products_cost_non_negative
    check (cost is null or cost >= 0),

  -- 이번 MVP는 원 단위 정수만 허용합니다. (앱 zod 규칙과 동일)
  -- 컬럼 타입 numeric(12,2)는 유지하고, 소수 부분이 있는 값만 거부합니다.
  -- ⚠️ 주의: numeric(12,2)는 제약조건 검사 "전에" 소수 셋째 자리에서 반올림합니다.
  --    예) 1.5 → 거부, 1.005 → 1.01로 반올림 → 거부, 1.004 → 1.00으로 반올림 → 1로 저장(통과)
  --    그래서 소수 셋째 자리 이하 입력은 앱(zod)이 먼저 거부해야 합니다.
  constraint products_price_whole_won
    check (price = trunc(price)),
  constraint products_cost_whole_won
    check (cost is null or cost = trunc(cost)),

  constraint products_stock_quantity_non_negative
    check (stock_quantity >= 0),
  constraint products_safety_stock_non_negative
    check (safety_stock >= 0),

  constraint products_status_valid
    check (status in ('active', 'inactive')),

  constraint products_description_length
    check (description is null or char_length(description) <= 2000),

  -- 서버가 발급한 경로 형식만 허용: products/<소문자 uuid>.<jpg|png|webp>
  constraint products_image_path_format
    check (
      image_path is null
      or image_path ~ '^products/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$'
    ),
  -- 한 파일을 두 상품이 같이 쓰지 않도록 (삭제 시 다른 상품 이미지가 지워지는 사고 방지)
  -- (NULL 은 UNIQUE 비교에서 서로 다른 값으로 취급되므로, 이미지 없는 상품은 여러 개 가능)
  constraint products_image_path_key
    unique (image_path)
);

comment on table  public.products              is 'Easy ERP 상품 (미션 6: 데모 데이터 전용)';
comment on column public.products.sku          is '상품 코드. 대문자/숫자/-/_ 2~40자, 전체에서 유일';
comment on column public.products.image_path   is 'Storage 버킷 product-images 안의 경로';
comment on column public.products.is_low_stock is '자동 계산: stock_quantity <= safety_stock';
comment on column public.products.updated_at   is '트리거가 자동 갱신. 수정 충돌 검사에 사용';

-- ── 인덱스: 목록 정렬·필터 ──
-- (sku, image_path 는 unique 제약조건이 인덱스를 자동으로 만듭니다)
create index products_created_at_idx on public.products (created_at desc, id desc);
create index products_price_idx      on public.products (price, id);
create index products_category_idx   on public.products (category);
create index products_low_stock_idx  on public.products (is_low_stock) where is_low_stock;


-- ═══════════════════════════════════════════════════════════════
-- 생성일·수정일 자동 관리 (products 전용)
--   - updated_at: 수정될 때마다 현재 시각으로 갱신
--   - created_at, id: 수정 요청에 값이 들어와도 원래 값을 유지 (변조 방지)
-- ═══════════════════════════════════════════════════════════════
create or replace function public.products_before_update()
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

create trigger products_before_update
  before update on public.products
  for each row
  execute function public.products_before_update();


-- ═══════════════════════════════════════════════════════════════
-- 데모 악용 방지: 상품 최대 개수 제한
--
-- 동시성 처리
--   1) 모든 INSERT 가 같은 advisory lock 을 순서대로 획득 → 동시에 두 요청이 "299개"를 보고
--      둘 다 통과하는 일이 없습니다.
--   2) 잠금은 트랜잭션이 끝날(커밋) 때 풀립니다. 다음 요청은 앞 요청의 커밋 결과를 본 뒤 개수를 셉니다.
--      (READ COMMITTED 에서 plpgsql 안의 각 SQL 문은 실행 시점의 최신 스냅샷을 사용)
--   3) 잠금 키는 (네임스페이스, 용도) 두 숫자로 지정해 다른 기능의 잠금과 겹치지 않게 합니다.
--   한계: 행 하나씩 검사하므로, 한 문장으로 여러 행을 넣는 시드 작업은 한도 근처에서 쓰지 않습니다.
-- ═══════════════════════════════════════════════════════════════
create or replace function public.products_enforce_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  max_products constant integer := 300;
begin
  -- 7101 = Easy ERP 네임스페이스, 1 = 상품 개수 제한
  perform pg_advisory_xact_lock(7101, 1);

  if (select count(*) from public.products) >= max_products then
    raise exception using
      errcode = 'P0001',
      message = 'PRODUCT_LIMIT_REACHED',
      hint    = '데모 환경에서는 상품을 최대 300개까지 등록할 수 있습니다.';
  end if;

  return new;
end;
$$;

create trigger products_enforce_limit
  before insert on public.products
  for each row
  execute function public.products_enforce_limit();


-- ═══════════════════════════════════════════════════════════════
-- 접근 권한
--
-- [1단계 방어] 테이블 권한 회수
--   Supabase 는 public 스키마에 새 테이블을 만들면 anon/authenticated 에 권한을 자동 부여합니다.
--   이를 회수하면 공개 키로 요청 시 "permission denied (42501)" 오류가 납니다.
--
-- [2단계 방어] RLS 활성화 + 정책 없음
--   누군가 실수로 권한을 다시 부여해도, 정책이 없으므로 공개 역할에는 행이 0개로 보입니다.
--   (미션 7 이후 사용자별 정책을 추가할 자리)
--
-- service_role(secret 키)
--   - BYPASSRLS 속성이 있어 RLS 영향을 받지 않습니다.
--   - 테이블 권한은 별도로 필요하므로 명시적으로 부여합니다.
--   - 트리거 함수는 실행 권한 회수와 관계없이 INSERT/UPDATE 시 자동 실행됩니다.
-- ═══════════════════════════════════════════════════════════════
alter table public.products enable row level security;

revoke all on table public.products from anon, authenticated;
grant select, insert, update, delete on table public.products to service_role;

-- 트리거 전용 함수는 API(RPC)로 직접 호출할 필요가 없으므로 실행 권한을 회수합니다.
revoke execute on function public.products_before_update() from public, anon, authenticated;
revoke execute on function public.products_enforce_limit() from public, anon, authenticated;

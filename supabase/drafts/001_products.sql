-- ═══════════════════════════════════════════════════════════════
-- [초안] 001_products.sql — 상품 테이블
--
-- ⚠️ 승인 전 적용 금지.
--    승인되면 supabase/migrations/<타임스탬프>_create_products.sql 로 옮긴 뒤 적용합니다.
--
-- 접근 방식 요약
--   - 브라우저(anon / publishable 키)는 이 테이블에 직접 접근할 수 없습니다.
--   - Next.js 서버(Server Component, Server Action)만 secret 키로 접근합니다.
--   - 사용자별 접근 제어(RLS 정책)는 이번 미션 범위가 아니며, 미션 7 이후에 추가합니다.
-- ═══════════════════════════════════════════════════════════════

create table public.products (
  -- 고유 식별자: 추측하기 어려운 UUID (DB가 자동 생성)
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

  -- Storage 안의 파일 경로 (전체 URL이 아닌 "경로"만 저장 → 도메인이 바뀌어도 안전)
  image_path      text,

  -- 재고 부족 여부: DB가 자동 계산하는 컬럼.
  -- Supabase(PostgREST)는 "컬럼끼리 비교" 필터를 지원하지 않으므로,
  -- '재고 부족' 필터를 위해 미리 계산해 저장합니다.
  is_low_stock    boolean generated always as (stock_quantity <= safety_stock) stored,

  created_at      timestamptz   not null default now(),
  updated_at      timestamptz   not null default now(),

  -- ── 제약조건: 앱 코드에 실수가 있어도 DB가 잘못된 데이터를 막는 "최후의 방어선" ──
  constraint products_name_not_blank
    check (char_length(btrim(name)) between 1 and 100),

  -- SKU: 서버에서 앞뒤 공백 제거 + 대문자로 바꿔 저장 → 'ab-1'과 'AB-1'을 같은 값으로 취급
  constraint products_sku_format
    check (sku ~ '^[A-Z0-9][A-Z0-9_-]{1,39}$'),
  constraint products_sku_key
    unique (sku),

  constraint products_category_length
    check (category is null or char_length(btrim(category)) between 1 and 50),

  constraint products_price_non_negative
    check (price >= 0),
  constraint products_cost_non_negative
    check (cost is null or cost >= 0),

  constraint products_stock_quantity_non_negative
    check (stock_quantity >= 0),
  constraint products_safety_stock_non_negative
    check (safety_stock >= 0),

  constraint products_status_valid
    check (status in ('active', 'inactive')),

  constraint products_description_length
    check (description is null or char_length(description) <= 2000),

  -- 서버가 발급한 경로 형식만 허용: products/<uuid>.<jpg|png|webp>
  constraint products_image_path_format
    check (image_path is null or image_path ~ '^products/[0-9a-f-]{36}\.(jpg|png|webp)$'),
  -- 한 파일을 두 상품이 같이 쓰지 않도록 (삭제 시 다른 상품 이미지가 지워지는 사고 방지)
  constraint products_image_path_key
    unique (image_path)
);

comment on table  public.products                is 'Easy ERP 상품 (미션 6: 데모 데이터 전용)';
comment on column public.products.sku            is '상품 코드. 대문자/숫자/-/_ 2~40자, 전체에서 유일';
comment on column public.products.image_path     is 'Storage 버킷 product-images 안의 경로';
comment on column public.products.is_low_stock   is '자동 계산: stock_quantity <= safety_stock';

-- ── 인덱스: 목록 정렬·필터를 빠르게 ──
-- (sku 는 unique 제약조건이 인덱스를 자동으로 만듭니다)
create index products_created_at_idx on public.products (created_at desc, id desc);
create index products_price_idx      on public.products (price, id);
create index products_category_idx   on public.products (category);
create index products_low_stock_idx  on public.products (is_low_stock) where is_low_stock;


-- ═══════════════════════════════════════════════════════════════
-- 생성일·수정일 자동 관리
--   - updated_at: 수정될 때마다 DB가 현재 시각으로 갱신
--   - created_at: 수정 요청에 값이 들어와도 원래 값을 유지 (변조 방지)
-- ═══════════════════════════════════════════════════════════════
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.created_at := old.created_at;
  new.updated_at := now();
  return new;
end;
$$;

create trigger products_set_updated_at
  before update on public.products
  for each row
  execute function public.set_updated_at();


-- ═══════════════════════════════════════════════════════════════
-- 데모 악용 방지: 상품 최대 개수 제한 (공개 배포 시 무한 등록 방지)
--   동시에 여러 요청이 들어와도 한 번에 하나씩 검사하도록 잠금을 겁니다.
-- ═══════════════════════════════════════════════════════════════
create or replace function public.enforce_products_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  max_products constant integer := 300;
begin
  perform pg_advisory_xact_lock(hashtext('public.products.insert_limit'));

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
  execute function public.enforce_products_limit();


-- ═══════════════════════════════════════════════════════════════
-- 접근 권한
--
-- 1) RLS 켜기 + 정책은 만들지 않음
--    → anon/authenticated 역할은 "행이 하나도 없는 것처럼" 보입니다 (기본 차단).
--    → 사용자별 접근 제어 정책을 "구현"하는 것이 아니라, 공개 키로 직접 접근하는 길을 닫는 설정입니다.
--    → 미션 7 이후 business_id 컬럼과 사용자별 정책을 추가할 자리가 됩니다.
--
-- 2) 테이블 권한(GRANT)도 회수
--    → RLS 설정을 실수로 끄더라도 공개 키로는 접근할 수 없도록 한 번 더 막습니다.
--
-- 3) 서버 전용 secret 키(service_role)에만 권한 부여
-- ═══════════════════════════════════════════════════════════════
alter table public.products enable row level security;

revoke all on table public.products from anon, authenticated;
grant select, insert, update, delete on table public.products to service_role;

revoke execute on function public.set_updated_at()          from public, anon, authenticated;
revoke execute on function public.enforce_products_limit()  from public, anon, authenticated;

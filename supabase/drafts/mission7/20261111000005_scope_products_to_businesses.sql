-- ═══════════════════════════════════════════════════════════════
-- [v1] 상품을 사업장별로 분리 (인증 · 사업장별 데이터 분리 2단계)
--
-- ⚠️ Supabase DB 적용은 아직 승인되지 않았습니다.
--    SQL Editor 실행 전에 반드시 별도 승인을 받습니다.
--    선행 조건: SQL 004 (businesses, memberships, private 검사 함수) 적용 완료
--    사전 검증: PGlite 메모리 DB (001 → 002 → 004 → 005)
--
-- 바뀌는 것 (SQL 001 파일은 그대로 두고, 이 마이그레이션이 DB 객체를 변경합니다)
--   1. products.business_id 추가 (NOT NULL, 사업장 삭제 시 상품이 있으면 삭제 거부)
--   2. SKU 중복 기준: 전체 → 사업장 단위 (products_sku_key → products_business_sku_key)
--   3. 이미지 경로: products/<uuid>.<ext> → <business_id>/products/<uuid>.<ext>
--   4. 300개 제한: 전체 → 사업장 단위 (사업장별 잠금)
--   5. 목록 인덱스를 사업장 기준으로 재생성
--   6. 수정 트리거: business_id 변경 금지, staff 의 판매가·원가 수정 금지 추가
--   7. 로그인 사용자 권한 + RLS 정책 (멤버만 조회·등록·수정, 가격 수정·삭제는 owner/admin)
--
-- 기존 데이터: products 가 비어 있을 때만 실행됩니다. (데이터가 있으면 아무것도 바꾸지 않고 중단)
-- 실행: SQL Editor(postgres 역할)에서 한 번만 실행
-- ═══════════════════════════════════════════════════════════════


-- 트랜잭션: SQL Editor 에서 파일 전체를 한 번에 실행하면 PostgreSQL 이 하나의 트랜잭션으로 처리합니다.
--   중간에 하나라도 실패하면 모든 변경이 취소됩니다. (PGlite 로 확인)
--   명시적 begin/commit 은 넣지 않습니다. 오류 시 연결이 "중단된 트랜잭션" 상태로 남아
--   다음 쿼리까지 막히기 때문입니다. (PGlite 로 확인)
--   ⚠️ 일부만 선택해서 실행하지 말고 반드시 파일 전체를 한 번에 실행합니다.

-- ── 0. 안전 확인 ──────────────────────────────────────────────
-- 확인과 변경 사이에 다른 요청이 상품을 넣지 못하도록 먼저 테이블을 잠급니다. (트랜잭션 종료 시 해제)
lock table public.products in access exclusive mode;

do $$
begin
  if exists (select 1 from public.products) then
    raise exception using
      errcode = 'P0001',
      message = 'PRODUCTS_NOT_EMPTY',
      hint    = 'products 에 데이터가 있어 중단했습니다. 기존 상품을 어느 사업장에 둘지 정한 뒤 별도 마이그레이션으로 옮겨야 합니다.';
  end if;

  if to_regclass('public.businesses') is null
     or to_regprocedure('private.is_business_member(uuid)') is null
     or to_regprocedure('private.has_business_role(uuid, text[])') is null then
    raise exception using
      errcode = 'P0001',
      message = 'SQL_004_REQUIRED',
      hint    = 'SQL 004 (businesses, memberships, private 검사 함수)를 먼저 적용해야 합니다.';
  end if;
end;
$$;


-- ── 1. business_id 컬럼 ───────────────────────────────────────
-- 테이블이 비어 있으므로 기본값 없이 NOT NULL 로 바로 추가할 수 있습니다.
-- ON DELETE RESTRICT: 상품이 남아 있는 사업장은 삭제할 수 없습니다. (실수로 상품이 함께 사라지는 것 방지)
alter table public.products
  add column business_id uuid not null
    references public.businesses (id) on delete restrict;

comment on column public.products.business_id is '상품이 속한 사업장. 등록 후 변경 불가';
comment on table  public.products is 'Easy ERP 상품 (사업장별로 분리, RLS 적용)';


-- ── 2. SKU: 사업장 단위로 유일 ─────────────────────────────────
-- 서로 다른 가게는 같은 SKU 를 쓸 수 있습니다. 같은 가게 안에서만 중복을 막습니다.
alter table public.products drop constraint products_sku_key;
alter table public.products
  add constraint products_business_sku_key unique (business_id, sku);

comment on column public.products.sku is '상품 코드. 대문자/숫자/-/_ 2~40자, 사업장 안에서 유일';


-- ── 3. 이미지 경로: 사업장 폴더 아래로 ──────────────────────────
-- 형식: <business_id>/products/<uuid>.<jpg|png|webp>
-- 경로 맨 앞이 이 상품의 business_id 와 같아야 합니다. (다른 가게 폴더의 파일을 가리킬 수 없음)
alter table public.products drop constraint products_image_path_format;
alter table public.products
  add constraint products_image_path_format check (
    image_path is null
    or (
      image_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/products/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$'
      and split_part(image_path, '/', 1) = business_id::text
    )
  );

comment on column public.products.image_path is 'Storage 버킷 product-images 안의 경로: <business_id>/products/<uuid>.<ext>';


-- ── 4. 목록 인덱스: 사업장 기준 ────────────────────────────────
-- 모든 조회가 "내 사업장" 조건을 포함하므로 business_id 를 맨 앞에 둡니다.
-- (business_id 외래키 검색도 이 인덱스들이 함께 처리합니다)
drop index public.products_created_at_idx;
drop index public.products_price_idx;
drop index public.products_category_idx;
drop index public.products_low_stock_idx;

create index products_business_created_at_idx on public.products (business_id, created_at desc, id desc);
create index products_business_price_idx      on public.products (business_id, price, id);
create index products_business_category_idx   on public.products (business_id, category);
create index products_business_low_stock_idx  on public.products (business_id) where is_low_stock;


-- ── 5. 수정 트리거: business_id 변경 금지 + staff 가격 수정 금지 ─────
-- SQL 001 의 동작(id·created_at 유지, updated_at 갱신)은 그대로 두고 검사 2가지를 추가합니다.
--
-- (1) business_id 변경 금지
--   로그인 사용자는 business_id 수정 권한 자체가 없습니다. 이 검사는 관리자(서버 키, SQL Editor) 실수 방지용입니다.
--   (사업장 외래키는 ON DELETE RESTRICT 라 자동 UPDATE 가 일어나지 않으므로 예외 없이 막아도 안전합니다)
--
-- (2) 판매가(price)·원가(cost) 변경은 owner/admin 만
--   - 컬럼 권한은 "로그인 사용자 전체"에만 줄 수 있고, RLS 는 행 단위라 컬럼을 구분하지 못하므로 트리거로 강제합니다.
--   - 값이 "실제로 바뀌는지"를 비교합니다. 한 컬럼만 고치든, 여러 컬럼을 함께 고치든,
--     upsert(INSERT ... ON CONFLICT DO UPDATE)든 모두 이 트리거를 거칩니다.
--   - 같은 값을 다시 보내는 것(12900 → 12900.00 포함)은 변경이 아니므로 허용합니다.
--   - 로그인 사용자 요청(authenticated, anon 역할)에만 적용합니다.
--     서버 관리 작업(service_role)과 SQL Editor(postgres)는 대상이 아닙니다.
create or replace function public.products_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.business_id is distinct from old.business_id then
    raise exception using
      errcode = '42501',
      message = 'BUSINESS_ID_IMMUTABLE',
      hint    = '상품을 다른 사업장으로 옮길 수 없습니다.';
  end if;

  -- ⚠️ 조건을 "A and B and C" 한 줄로 쓰면 PostgreSQL 이 계산 순서를 보장하지 않아,
  --    service_role 요청에서도 권한 확인 함수가 호출되어 오류가 납니다. (PGlite 회귀 테스트에서 발견)
  --    그래서 중첩 IF 로 순서를 고정합니다.
  if current_user in ('authenticated', 'anon') then
    if new.price is distinct from old.price or new.cost is distinct from old.cost then
      if not private.has_business_role(old.business_id, array['owner', 'admin']) then
        raise exception using
          errcode = '42501',
          message = 'PRICE_CHANGE_FORBIDDEN',
          hint    = '판매가와 원가는 사업장 owner 또는 admin 만 수정할 수 있습니다.';
      end if;
    end if;
  end if;

  new.id         := old.id;
  new.created_at := old.created_at;
  new.updated_at := now();
  return new;
end;
$$;


-- ── 6. 사업장당 300개 제한 ─────────────────────────────────────
-- 동시성
--   - 같은 사업장의 INSERT 는 사업장별 advisory lock 을 순서대로 얻습니다. (다른 사업장끼리는 기다리지 않음)
--   - READ COMMITTED(기본값): 잠금을 얻은 뒤의 개수 조회가 새 스냅샷을 써서 앞 요청의 커밋 결과를 봅니다.
--   - SERIALIZABLE: 동시 실행 시 PostgreSQL 이 한쪽을 직렬화 오류(40001)로 취소합니다.
--   - REPEATABLE READ: 시작 시점 스냅샷을 계속 써서 한도를 넘을 수 있으므로 거부합니다.
-- SECURITY DEFINER: 개수는 RLS 와 관계없이 사업장 전체를 셉니다. (나중에 역할별 조회 제한이 생겨도 정확하게)
-- 한계: 한 문장에 여러 사업장의 상품을 섞어 넣으면 잠금 순서에 따라 교착 상태가 생길 수 있습니다.
--       (PostgreSQL 이 감지해 한쪽을 취소하므로 한도는 지켜짐. 앱은 한 번에 한 상품씩 등록)
create or replace function public.products_enforce_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  max_products constant integer := 300;
begin
  if current_setting('transaction_isolation') = 'repeatable read' then
    raise exception using errcode = '0A000', message = 'UNSUPPORTED_ISOLATION_LEVEL';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('easy-erp:products_limit:' || new.business_id::text, 0));

  if (select count(*) from public.products p where p.business_id = new.business_id) >= max_products then
    raise exception using
      errcode = 'P0001',
      message = 'PRODUCT_LIMIT_REACHED',
      hint    = '사업장당 상품은 최대 300개까지 등록할 수 있습니다.';
  end if;

  return new;
end;
$$;

-- CREATE OR REPLACE 는 기존 권한을 유지하지만, 의도를 분명히 하기 위해 다시 회수합니다.
revoke all on function public.products_before_update() from public, anon, authenticated;
revoke all on function public.products_enforce_limit() from public, anon, authenticated;


-- ── 7. 접근 권한 ──────────────────────────────────────────────
-- anon: 계속 아무 권한 없음 (SQL 001 에서 회수)
-- authenticated: 조회·삭제 + "입력해도 되는 컬럼"만 등록·수정
--   - 등록: id, created_at, updated_at, is_low_stock 은 넣을 수 없음 (DB가 자동 생성)
--   - 수정: business_id 도 바꿀 수 없음
-- 행 단위 허용 여부는 아래 RLS 정책이 결정합니다.
revoke all on table public.products from anon, authenticated;

grant select, delete on table public.products to authenticated;
grant insert (business_id, name, sku, category, price, cost, stock_quantity, safety_stock,
              status, description, image_path)
  on table public.products to authenticated;
grant update (name, sku, category, price, cost, stock_quantity, safety_stock,
              status, description, image_path)
  on table public.products to authenticated;

-- service_role: SQL 001 의 권한 유지 (관리 작업용). 사용자 권한 판단에는 쓰지 않습니다.


-- ── 8. RLS 정책 ──────────────────────────────────────────────
-- 역할별 권한
--   | 기능                      | owner | admin | staff | 다른 사업장 사용자 | 비로그인 |
--   | 조회                      |   O   |   O   |   O   |        X          |    X     |
--   | 등록 (판매가·원가 입력 포함) |   O   |   O   |   O   |        X          |    X     |
--   | 수정: 일반 정보            |   O   |   O   |   O   |        X          |    X     |
--   | 수정: 판매가·원가          |   O   |   O   |   X   |        X          |    X     |  ← 5번 트리거가 강제
--   | 삭제                      |   O   |   O   |   X   |        X          |    X     |
-- (SQL 001 에서 RLS 는 이미 켜져 있습니다)

create policy products_select_member on public.products
  for select to authenticated
  using (private.is_business_member(business_id));

create policy products_insert_member on public.products
  for insert to authenticated
  with check (private.is_business_member(business_id));

create policy products_update_member on public.products
  for update to authenticated
  using (private.is_business_member(business_id))
  with check (private.is_business_member(business_id));

create policy products_delete_owner_admin on public.products
  for delete to authenticated
  using (private.has_business_role(business_id, array['owner', 'admin']));

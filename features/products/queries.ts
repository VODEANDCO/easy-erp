import "server-only";
import { connection } from "next/server";
import {
  getBusinessAccess,
  type BusinessAccess,
  type BusinessAccessDeniedReason,
} from "@/lib/auth/business-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { PRODUCTS_PAGE_SIZE, PRODUCT_STATUSES, type ProductStatus } from "./constants";
import { productIdSchema, type ProductListParams } from "./schema";
import type { Product, ProductListResult } from "./types";

/**
 * 상품 조회 (서버 전용)
 *
 * 처리 순서
 *   1. 접근 권한 확인 (getBusinessAccess) → 실패하면 DB에 묻지 않고 바로 거부 결과를 돌려줌
 *   2. Supabase 조회 (secret 키 클라이언트, 서버 전용)
 *
 * 접근 방식별 조회 범위 (lib/auth/business-access.ts)
 *   - demo     : 공개 데모. PRODUCTS_DEMO_MODE=true 일 때만. 사업장 구분 없이 조회 (SQL 001 구조)
 *   - business : 미션 7. 항상 `.eq("business_id", ...)` 조건을 붙입니다.
 *                SQL 005 적용 전에는 business_id 컬럼이 없어 조회 오류가 납니다.
 *                → 누군가 사업장 모드를 먼저 켜도 전체 상품이 공개되지 않는 안전장치입니다.
 *                미션 7 에서는 로그인 사용자 세션 클라이언트(RLS 적용)로 바꾸는 것을 검토합니다.
 *   - 그 외    : 차단 (기본값)
 *
 * 캐시: 사용하지 않습니다. 요청마다 DB를 읽어 등록·수정 직후에도 최신 값을 보여줍니다.
 */

/** 현재 데이터 출처. "preview" 이면 화면에 미리보기 안내가 표시됩니다. */
export const PRODUCT_DATA_SOURCE = "supabase" as "preview" | "supabase";

export function isPreviewMode() {
  return PRODUCT_DATA_SOURCE === "preview";
}

/** 조회 결과: 접근이 거부되면 이유만 돌려주고, 데이터는 담지 않습니다. */
export type ProductQueryResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: BusinessAccessDeniedReason };

/** 화면에 필요한 컬럼만 명시적으로 조회합니다. */
const PRODUCT_COLUMNS =
  "id, name, sku, category, price, cost, stock_quantity, safety_stock, status, description, image_path, is_low_stock, created_at, updated_at";

type ProductRow = Omit<Product, "price" | "cost" | "status"> & {
  /** numeric 은 응답 형식에 따라 문자열로 올 수 있어 숫자로 바꿉니다. */
  price: number | string;
  cost: number | string | null;
  status: string;
};

const statuses: readonly string[] = PRODUCT_STATUSES;

function toProduct(row: ProductRow): Product {
  if (!statuses.includes(row.status)) {
    throw new Error("상품 판매 상태 값이 올바르지 않습니다.");
  }
  return {
    ...row,
    price: Number(row.price),
    cost: row.cost === null ? null : Number(row.cost),
    status: row.status as ProductStatus,
    // created_at, updated_at 은 DB 문자열 그대로 둡니다. (Date 로 바꾸면 수정 충돌 검사가 깨짐)
  };
}

/** 자세한 원인은 서버 로그에만 남기고, 화면에는 일반 문구만 전달합니다. */
function queryFailed(context: string, error: { code?: string; message?: string }) {
  console.error(`[products] ${context} 실패`, { code: error.code, message: error.message });
  return new Error("상품 정보를 불러오지 못했습니다.");
}

/**
 * 검색어를 PostgREST `or` 필터 문자열로 만듭니다.
 * 1) LIKE 특수문자(\ % _)를 이스케이프 → 검색어 안의 %, _ 를 글자 그대로 찾음
 * 2) 값을 큰따옴표로 감싸고 " \ 를 이스케이프 → 검색어 안의 , ( ) 가 필터 문법으로 해석되지 않음
 */
function searchFilter(keyword: string) {
  const likeEscaped = keyword.replace(/[\\%_]/g, (c) => `\\${c}`);
  const quoted = `"%${likeEscaped.replace(/["\\]/g, (c) => `\\${c}`)}%"`;
  return `name.ilike.${quoted},sku.ilike.${quoted}`;
}

type GrantedAccess = Extract<BusinessAccess, { ok: true }>;

/** 접근 방식에 맞는 조회 범위를 적용한 products 쿼리 */
function productsQuery(
  access: GrantedAccess,
  columns: string,
  options?: { count: "exact"; head: true },
) {
  const query = createAdminClient().from("products").select(columns, options);
  return access.mode === "business" ? query.eq("business_id", access.businessId) : query;
}

function filteredProducts(
  access: GrantedAccess,
  params: ProductListParams,
  columns: string,
  options?: { count: "exact"; head: true },
) {
  let query = productsQuery(access, columns, options);

  if (params.q) query = query.or(searchFilter(params.q));
  if (params.category) query = query.eq("category", params.category);
  if (params.stock === "low") query = query.eq("is_low_stock", true);
  return query;
}

export async function listProducts(
  params: ProductListParams,
): Promise<ProductQueryResult<ProductListResult>> {
  // 실제 사용자 요청에서만 실행합니다. Next.js 내부 prerender 에서는 여기서 멈춰 Supabase 조회를 시작하지 않습니다.
  // (prerender 중 중단된 fetch 를 Supabase 가 일반 오류로 바꿔 "조회 실패"로 잘못 기록되던 문제 · ISSUE-1)
  await connection();
  const access = await getBusinessAccess();
  if (!access.ok) return { ok: false, reason: access.reason };

  const hasFilters = Boolean(params.q || params.category || params.stock);
  const [filtered, all] = await Promise.all([
    filteredProducts(access, params, "id", { count: "exact", head: true }),
    hasFilters ? productsQuery(access, "id", { count: "exact", head: true }) : null,
  ]);
  if (filtered.error) throw queryFailed("목록 개수 조회", filtered.error);
  if (all?.error) throw queryFailed("전체 개수 조회", all.error);

  const total = filtered.count ?? 0;
  const totalAll = all ? (all.count ?? 0) : total;
  const pageCount = Math.max(1, Math.ceil(total / PRODUCTS_PAGE_SIZE));
  // 범위를 벗어난 page 는 마지막 페이지로 맞춥니다.
  const page = Math.min(params.page, pageCount);

  if (total === 0) {
    return { ok: true, data: { items: [], total, totalAll, page, pageCount } };
  }

  let query = filteredProducts(access, params, PRODUCT_COLUMNS);
  if (params.sort === "price_asc") {
    query = query.order("price", { ascending: true }).order("id", { ascending: true });
  } else if (params.sort === "price_desc") {
    query = query.order("price", { ascending: false }).order("id", { ascending: true });
  } else {
    query = query.order("created_at", { ascending: false }).order("id", { ascending: false });
  }

  const from = (page - 1) * PRODUCTS_PAGE_SIZE;
  const { data, error } = await query.range(from, from + PRODUCTS_PAGE_SIZE - 1);
  if (error) throw queryFailed("목록 조회", error);

  return {
    ok: true,
    data: {
      items: (data as unknown as ProductRow[]).map(toProduct),
      total,
      totalAll,
      page,
      pageCount,
    },
  };
}

/** 접근이 허용된 경우: ID 형식이 틀리거나 상품이 없으면 data 가 null (페이지에서 notFound() 처리) */
export async function getProduct(id: string): Promise<ProductQueryResult<Product | null>> {
  // 실제 사용자 요청에서만 실행합니다. (listProducts 와 같은 이유 · ISSUE-1)
  await connection();
  // ID 검사보다 권한 확인을 먼저 합니다. (권한 없는 사용자가 ID 존재 여부를 알아내지 못하도록)
  const access = await getBusinessAccess();
  if (!access.ok) return { ok: false, reason: access.reason };

  if (!productIdSchema.safeParse(id).success) return { ok: true, data: null };

  const { data, error } = await productsQuery(access, PRODUCT_COLUMNS)
    .eq("id", id.toLowerCase())
    .maybeSingle();
  if (error) throw queryFailed("상세 조회", error);

  return { ok: true, data: data ? toProduct(data as unknown as ProductRow) : null };
}

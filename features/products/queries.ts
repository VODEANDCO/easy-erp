import "server-only";
import { PRODUCTS_PAGE_SIZE } from "./constants";
import { PREVIEW_PRODUCTS } from "./preview-data";
import { productIdSchema, type ProductListParams } from "./schema";
import type { Product, ProductListResult } from "./types";

/**
 * 상품 조회 (서버 전용)
 *
 * 지금은 DB 연결 전이라 **UI 확인용 예시 데이터**를 읽습니다.
 * Phase 2~3에서 아래 두 함수의 내용만 Supabase 조회로 바꾸면,
 * 페이지와 컴포넌트는 고치지 않아도 되도록 입력·출력 형식을 맞춰 두었습니다.
 */

/** 현재 데이터 출처. "preview" 동안 화면에 미리보기 안내가 표시되고, 저장 기능은 막힙니다. */
export const PRODUCT_DATA_SOURCE: "preview" | "supabase" = "preview";

export function isPreviewMode() {
  return PRODUCT_DATA_SOURCE === "preview";
}

export async function listProducts(params: ProductListParams): Promise<ProductListResult> {
  // TODO(Phase 3·6): Supabase 조회로 교체
  //   .from("products").select("*", { count: "exact" })
  //   검색어는 % _ , ( ) 를 이스케이프한 뒤 name·sku ilike 로 검색 (docs/specs/products.md)
  const keyword = params.q.toLowerCase();

  const filtered = PREVIEW_PRODUCTS.filter((p) => {
    if (keyword && !p.name.toLowerCase().includes(keyword) && !p.sku.toLowerCase().includes(keyword)) {
      return false;
    }
    if (params.category && p.category !== params.category) return false;
    if (params.stock === "low" && !p.is_low_stock) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (params.sort === "price_asc") return a.price - b.price || a.id.localeCompare(b.id);
    if (params.sort === "price_desc") return b.price - a.price || a.id.localeCompare(b.id);
    return b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id);
  });

  const total = sorted.length;
  const pageCount = Math.max(1, Math.ceil(total / PRODUCTS_PAGE_SIZE));
  const page = Math.min(params.page, pageCount);
  const start = (page - 1) * PRODUCTS_PAGE_SIZE;

  return {
    items: sorted.slice(start, start + PRODUCTS_PAGE_SIZE),
    total,
    totalAll: PREVIEW_PRODUCTS.length,
    page,
    pageCount,
  };
}

/** ID 형식이 틀리거나 상품이 없으면 null (페이지에서 notFound() 처리) */
export async function getProduct(id: string): Promise<Product | null> {
  if (!productIdSchema.safeParse(id).success) return null;
  // TODO(Phase 3): Supabase 조회로 교체 → .from("products").select("*").eq("id", id).maybeSingle()
  return PREVIEW_PRODUCTS.find((p) => p.id === id.toLowerCase()) ?? null;
}

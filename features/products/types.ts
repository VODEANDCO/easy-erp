import type { ProductStatus } from "./constants";

/**
 * products 테이블 한 행 (supabase/migrations/20261109000001_create_products.sql)
 * Phase 2에서 DB 타입을 생성하면 그 타입과 맞춰 봅니다.
 */
export type Product = {
  id: string;
  name: string;
  sku: string;
  category: string | null;
  /** 원 단위 정수 */
  price: number;
  cost: number | null;
  stock_quantity: number;
  safety_stock: number;
  status: ProductStatus;
  description: string | null;
  image_path: string | null;
  is_low_stock: boolean;
  /** DB 문자열 그대로 보관 (Date 로 바꾸면 마이크로초가 잘려 수정 충돌 검사가 깨짐) */
  created_at: string;
  updated_at: string;
};

export type ProductListResult = {
  items: Product[];
  /** 조건에 맞는 전체 개수 */
  total: number;
  /** 조건과 상관없는 전체 상품 수 ("등록된 상품 없음"과 "검색 결과 없음" 구분용) */
  totalAll: number;
  page: number;
  pageCount: number;
};

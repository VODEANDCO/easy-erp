/**
 * 상품 관리 상수
 * 화면(폼, 필터)과 서버 검증이 같은 값을 쓰도록 이 파일 한 곳에서 관리합니다.
 */

/** 카테고리 목록. DB는 1~50자만 검사하므로, 목록 제한은 앱(zod)이 담당합니다. */
export const PRODUCT_CATEGORIES = [
  "식품",
  "음료",
  "생활용품",
  "주방용품",
  "문구·사무",
  "의류·잡화",
  "전자기기",
  "기타",
] as const;
export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

export const PRODUCT_STATUSES = ["active", "inactive"] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];
export const PRODUCT_STATUS_LABELS: Record<ProductStatus, string> = {
  active: "판매중",
  inactive: "판매중지",
};

export const PRODUCT_SORTS = ["latest", "price_asc", "price_desc"] as const;
export type ProductSort = (typeof PRODUCT_SORTS)[number];
export const PRODUCT_SORT_LABELS: Record<ProductSort, string> = {
  latest: "최신 등록순",
  price_asc: "가격 낮은순",
  price_desc: "가격 높은순",
};

/** 목록 한 페이지에 보여줄 상품 수 */
export const PRODUCTS_PAGE_SIZE = 10;

/** 입력 길이·값 한도 (DB 제약조건과 같거나 더 엄격하게) */
export const PRODUCT_LIMITS = {
  nameMax: 100,
  skuMin: 2,
  skuMax: 40,
  descriptionMax: 2000,
  searchMax: 50,
  /** 판매가·원가: 원 단위 정수, 100억 원 미만 (DB numeric(12,2) 범위 안) */
  wonMax: 9_999_999_999,
  /** 재고: PostgreSQL integer 최대값 */
  stockMax: 2_147_483_647,
} as const;

/** 상품 이미지 규칙 (docs/specs/storage.md, 버킷 설정과 같아야 함) */
export const PRODUCT_IMAGE = {
  maxBytes: 5 * 1024 * 1024,
  mimeTypes: ["image/jpeg", "image/png", "image/webp"],
  /** <input accept> 값 */
  accept: "image/jpeg,image/png,image/webp",
} as const;
export type ProductImageMime = (typeof PRODUCT_IMAGE.mimeTypes)[number];

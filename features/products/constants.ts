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

/**
 * 상품 이미지 저장소(Supabase Storage) 운영 값 (docs/specs/storage.md)
 * - bucket: SQL 002 로 만든 버킷. 이 버킷 밖의 파일은 다루지 않습니다.
 * - softLimitBytes: 버킷 전체 800MB "소프트 한도" (업로드 URL 발급 직전에만 확인, 강제 아님)
 * - maxUnlinkedFiles: 어떤 상품에도 연결되지 않은 파일이 이 개수 이상이면 새 업로드 URL 발급을 거부합니다.
 *   (업로드 URL 남용으로 고아 파일이 쌓이는 것을 막는 전체 상한 · 최대 약 20 × 5MB)
 * - cacheControlSeconds: 업로드 시 지정하는 CDN 캐시 시간. 삭제 후에도 이 시간 동안 캐시에 남을 수 있습니다.
 */
export const PRODUCT_IMAGE_STORAGE = {
  bucket: "product-images",
  softLimitBytes: 800 * 1024 * 1024,
  maxUnlinkedFiles: 20,
  cacheControlSeconds: "3600",
} as const;

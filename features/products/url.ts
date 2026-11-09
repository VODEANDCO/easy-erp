import type { ProductListParams } from "./schema";

/**
 * 목록 URL 만들기. 기본값인 항목은 URL에서 빼서 주소를 짧게 유지합니다.
 * 예: { q: "녹차", page: 2 } → /products?q=녹차&page=2
 */
export function productListHref(params: Partial<ProductListParams>) {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.category) search.set("category", params.category);
  if (params.stock) search.set("stock", params.stock);
  if (params.sort && params.sort !== "latest") search.set("sort", params.sort);
  if (params.page && params.page > 1) search.set("page", String(params.page));
  const query = search.toString();
  return query ? `/products?${query}` : "/products";
}

export const productHref = (id: string) => `/products/${id}`;
export const productEditHref = (id: string) => `/products/${id}/edit`;

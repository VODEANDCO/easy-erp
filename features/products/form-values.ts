import type { ProductFormValues } from "./schema";
import type { Product } from "./types";

/** 등록 폼의 빈 값 */
export const EMPTY_PRODUCT_FORM: ProductFormValues = {
  name: "",
  sku: "",
  category: "",
  status: "active",
  price: "",
  cost: "",
  stock_quantity: "",
  safety_stock: "",
  description: "",
  image_path: "",
};

/** DB 상품 → 수정 폼 값 (모두 문자열) */
export function toProductFormValues(product: Product): ProductFormValues {
  return {
    name: product.name,
    sku: product.sku,
    category: product.category ?? "",
    status: product.status,
    price: String(product.price),
    cost: product.cost === null ? "" : String(product.cost),
    stock_quantity: String(product.stock_quantity),
    safety_stock: String(product.safety_stock),
    description: product.description ?? "",
    image_path: product.image_path ?? "",
  };
}

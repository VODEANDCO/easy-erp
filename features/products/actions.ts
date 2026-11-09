"use server";

import { toFieldErrors, type ActionResult } from "@/lib/action-result";
import {
  PRODUCT_FORM_FIELDS,
  productIdSchema,
  productInputSchema,
  productUpdateSchema,
  readFormFields,
} from "./schema";

/**
 * 상품 등록·수정·삭제 Server Action
 *
 * Server Action은 누구나 직접 호출할 수 있는 공개 요청 주소이므로,
 * 브라우저에서 검증했더라도 여기서 같은 스키마로 **반드시 다시 검증**합니다.
 *
 * ⚠️ 현재는 DB 연결 전입니다.
 *    검증까지만 실제로 수행하고, 저장하지 않았다는 사실을 그대로 돌려줍니다.
 *    (성공한 것처럼 보이게 하지 않습니다)
 */

const DB_NOT_CONNECTED_MESSAGE =
  "입력값 검증은 통과했지만, 아직 데이터베이스가 연결되지 않아 저장되지 않았습니다.";

export async function createProduct(
  _prev: ActionResult<{ id: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const parsed = productInputSchema.safeParse(readFormFields(formData, PRODUCT_FORM_FIELDS));
  if (!parsed.success) {
    return {
      ok: false,
      code: "VALIDATION_FAILED",
      message: "입력값을 다시 확인해 주세요.",
      fieldErrors: toFieldErrors(parsed.error.issues),
    };
  }

  // TODO(Phase 3): Supabase insert → 성공 시 updateTag + flash 쿠키 + redirect(`/products/${id}`)
  //   오류 매핑: 23505 products_sku_key → sku 칸 "이미 사용 중인 SKU입니다", P0001 → 300개 한도 안내
  return { ok: false, code: "DB_NOT_CONNECTED", message: DB_NOT_CONNECTED_MESSAGE };
}

export async function updateProduct(
  _prev: ActionResult<{ id: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const parsed = productUpdateSchema.safeParse(
    readFormFields(formData, [...PRODUCT_FORM_FIELDS, "id", "updated_at"] as const),
  );
  if (!parsed.success) {
    const fieldErrors = toFieldErrors(parsed.error.issues);
    return {
      ok: false,
      code: "VALIDATION_FAILED",
      message: fieldErrors.id ?? fieldErrors.updated_at ?? "입력값을 다시 확인해 주세요.",
      fieldErrors,
    };
  }

  // TODO(Phase 4): UPDATE ... WHERE id = ? AND updated_at = ? (0행이면 수정 충돌 안내)
  return { ok: false, code: "DB_NOT_CONNECTED", message: DB_NOT_CONNECTED_MESSAGE };
}

export async function deleteProduct(id: string): Promise<ActionResult> {
  if (!productIdSchema.safeParse(id).success) {
    return { ok: false, code: "NOT_FOUND", message: "이미 삭제되었거나 존재하지 않는 상품입니다." };
  }

  // TODO(Phase 4): DELETE ... RETURNING image_path → 성공 후 이미지 파일 삭제 → redirect("/products")
  return {
    ok: false,
    code: "DB_NOT_CONNECTED",
    message: "아직 데이터베이스가 연결되지 않아 삭제되지 않았습니다.",
  };
}

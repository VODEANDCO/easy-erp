"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  FLASH_TOAST_COOKIE,
  FLASH_TOAST_MAX_AGE_SECONDS,
  toFieldErrors,
  type ActionResult,
  type FieldErrors,
  type FlashToastKind,
} from "@/lib/action-result";
import { getBusinessAccess } from "@/lib/auth/business-access";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  IMAGE_PATH_PATTERN,
  PRODUCT_FORM_FIELDS,
  productIdSchema,
  productInputSchema,
  productUpdateSchema,
  readFormFields,
  type ProductFormField,
} from "./schema";

/**
 * 상품 등록·수정·삭제 Server Action
 *
 * Server Action은 누구나 직접 호출할 수 있는 공개 요청 주소입니다. 그래서
 * 1. 가장 먼저 접근 권한(지금은 데모 모드)을 확인하고, 거부되면 DB에 요청하지 않습니다.
 * 2. 브라우저에서 검증했더라도 같은 스키마로 **반드시 다시 검증**합니다.
 * 3. DB 제약조건과 300개 한도 트리거가 마지막 방어선입니다.
 *
 * 현재 상태: 등록(createProduct)·수정(updateProduct)·삭제(deleteProduct)가 실제 DB에 반영됩니다.
 */

const VALIDATION_MESSAGE = "입력값을 다시 확인해 주세요.";

/** DB 제약조건 이름 → 오류를 표시할 입력칸 (supabase/migrations/20261109000001) */
const CHECK_CONSTRAINT_FIELDS: Record<string, ProductFormField> = {
  products_name_valid: "name",
  products_sku_format: "sku",
  products_category_valid: "category",
  products_price_non_negative: "price",
  products_price_whole_won: "price",
  products_cost_non_negative: "cost",
  products_cost_whole_won: "cost",
  products_stock_quantity_non_negative: "stock_quantity",
  products_safety_stock_non_negative: "safety_stock",
  products_status_valid: "status",
  products_description_length: "description",
  products_image_path_format: "image_path",
};

type DbError = { code?: string; message?: string };

/** 서버 로그에는 오류 코드와 DB 메시지만 남깁니다. (입력값이 담길 수 있는 details 와 키 값은 남기지 않음) */
function logDbError(label: string, error: DbError) {
  console.error(`[products] ${label}`, { code: error.code, message: error.message });
}

type WriteKind = "create" | "update";

const WRITE_LABEL: Record<WriteKind, string> = { create: "상품 등록", update: "상품 수정" };

/** 응답을 못 받았을 때: 실제로는 반영됐을 수 있으므로 확인 방법을 함께 안내합니다. */
const UNKNOWN_MESSAGE: Record<WriteKind, string> = {
  // 다시 시도해도 같은 SKU 는 중복으로 막히므로 같은 상품이 두 번 저장되지는 않습니다.
  create:
    "일시적인 오류로 저장하지 못했습니다. 잠시 후 다시 시도해 주세요. 계속 실패하면 상품 목록에서 등록 여부를 먼저 확인해 주세요.",
  // 실제로 반영됐다면 수정일이 바뀌었으므로, 다시 시도하면 "먼저 수정됨" 안내가 나옵니다. (덮어쓰지 않음)
  update:
    "일시적인 오류로 저장하지 못했습니다. 잠시 후 다시 시도해 주세요. 계속 실패하면 상세 화면에서 반영 여부를 먼저 확인해 주세요.",
};

/** INSERT·UPDATE 오류를 사용자 안내로 바꿉니다. */
function writeFailure(kind: WriteKind, error: DbError): ActionResult<{ id: string }> {
  const message = error.message ?? "";

  // 23505 unique_violation: SKU 는 대문자로 바꿔 저장하므로 "ab-1" 과 "AB-1" 도 같은 SKU 입니다.
  if (error.code === "23505" && message.includes("products_sku_key")) {
    return {
      ok: false,
      code: "VALIDATION_FAILED",
      message: "이미 사용 중인 SKU입니다. 다른 SKU를 입력해 주세요.",
      fieldErrors: { sku: "이미 사용 중인 SKU입니다" },
    };
  }

  // P0001: 상품 개수 한도 트리거 (products_enforce_limit)
  if (error.code === "P0001" && message.includes("PRODUCT_LIMIT_REACHED")) {
    return {
      ok: false,
      code: "LIMIT_REACHED",
      message: `데모 환경은 상품을 최대 300개까지 등록할 수 있습니다. 사용하지 않는 상품을 삭제한 뒤 다시 시도해 주세요.`,
    };
  }

  // 23514 check_violation: 정상 사용에서는 zod 가 먼저 막으므로 거의 발생하지 않습니다.
  if (error.code === "23514") {
    logDbError(`${WRITE_LABEL[kind]}: DB 제약조건 위반`, error);
    const constraint = Object.keys(CHECK_CONSTRAINT_FIELDS).find((name) => message.includes(`"${name}"`));
    const fieldErrors: FieldErrors = {};
    if (constraint) fieldErrors[CHECK_CONSTRAINT_FIELDS[constraint]] = "저장 규칙에 맞지 않는 값입니다";
    return { ok: false, code: "VALIDATION_FAILED", message: VALIDATION_MESSAGE, fieldErrors };
  }

  // 네트워크 오류 등
  logDbError(`${WRITE_LABEL[kind]} 실패`, error);
  return { ok: false, code: "UNKNOWN", message: UNKNOWN_MESSAGE[kind] };
}

/** 예상하지 못한 예외(환경변수 오류 등)를 DbError 형태로. 오류 객체 전체를 출력하지 않습니다. */
const thrown = (error: unknown): DbError => ({ message: error instanceof Error ? error.message : "unknown error" });

async function setFlashToast(kind: FlashToastKind) {
  const cookieStore = await cookies();
  cookieStore.set(FLASH_TOAST_COOKIE, kind, {
    path: "/",
    maxAge: FLASH_TOAST_MAX_AGE_SECONDS,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    httpOnly: false, // 브라우저의 Toast 가 읽고 지워야 하므로. 값은 정해진 단어뿐입니다.
  });
}

export async function createProduct(
  _prev: ActionResult<{ id: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  // ① 접근 권한 확인: 데모 모드가 아니면 DB에 요청하지 않습니다.
  const access = await getBusinessAccess();
  if (!access.ok) {
    return {
      ok: false,
      code: "FORBIDDEN",
      message: "지금은 상품을 등록할 수 없습니다. 로그인과 사업장 권한 확인 기능이 준비된 뒤 사용할 수 있습니다.",
    };
  }

  // ② 서버 재검증 (실제 방어선)
  const parsed = productInputSchema.safeParse(readFormFields(formData, PRODUCT_FORM_FIELDS));
  if (!parsed.success) {
    return {
      ok: false,
      code: "VALIDATION_FAILED",
      message: VALIDATION_MESSAGE,
      fieldErrors: toFieldErrors(parsed.error.issues),
    };
  }
  const input = parsed.data;

  // ③ 이미지 업로드는 아직 지원하지 않습니다. (폼은 보내지 않으므로, 조작된 요청만 여기에 걸림)
  if (input.image_path !== null) {
    return {
      ok: false,
      code: "VALIDATION_FAILED",
      message: "이미지 업로드는 아직 지원하지 않습니다. 이미지 없이 등록해 주세요.",
      fieldErrors: { image_path: "이미지 업로드는 아직 지원하지 않습니다" },
    };
  }

  // 데모 모드에서는 사업장 구분 없이 저장합니다.
  // 사업장 모드(미션 7, SQL 005 적용 후)는 business_id 를 함께 저장하도록 바꿔야 합니다.
  if (access.mode !== "demo") {
    return { ok: false, code: "FORBIDDEN", message: "지금은 상품을 등록할 수 없습니다." };
  }

  // ④ 저장: 검증을 통과한 컬럼만 명시적으로 넣습니다. (id·등록일·수정일·재고 부족 여부는 DB가 생성)
  let productId: string;
  try {
    const { data, error } = await createAdminClient()
      .from("products")
      .insert({
        name: input.name,
        sku: input.sku,
        category: input.category,
        status: input.status,
        price: input.price,
        cost: input.cost,
        stock_quantity: input.stock_quantity,
        safety_stock: input.safety_stock,
        description: input.description,
        image_path: null,
      })
      .select("id")
      .single<{ id: string }>();

    if (error) return writeFailure("create", error);
    productId = data.id;
  } catch (error) {
    return writeFailure("create", thrown(error));
  }

  // ⑤ 성공: 안내 쿠키 → 목록 캐시 갱신 → 상세로 이동 (redirect 는 예외를 던지므로 try 밖에서 호출)
  await setFlashToast("created");
  revalidatePath("/products");
  redirect(`/products/${productId}`);
}

/**
 * 폼이 보낸 updated_at 이 DB 가 돌려준 시각 형식인지 확인합니다.
 * - 값은 Date 로 바꾸지 않고 **글자 그대로** DB 에 넘겨 DB 가 비교합니다.
 *   (DB 는 마이크로초(6자리)까지 저장하고, JavaScript Date 는 밀리초(3자리)까지만 다루므로)
 * - 형식이 틀린 값은 DB 에 보내지 않습니다.
 */
const DB_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}(:?\d{2})?)$/;

const NOT_FOUND_MESSAGE = "이미 삭제되었거나 존재하지 않는 상품입니다.";

export async function updateProduct(
  _prev: ActionResult<{ id: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  // ① 접근 권한 확인: 데모 모드가 아니면 DB에 요청하지 않습니다.
  const access = await getBusinessAccess();
  if (!access.ok || access.mode !== "demo") {
    // 사업장 모드(미션 7)는 business_id 조건을 함께 걸도록 바꾼 뒤 허용해야 합니다.
    return {
      ok: false,
      code: "FORBIDDEN",
      message: "지금은 상품을 수정할 수 없습니다. 로그인과 사업장 권한 확인 기능이 준비된 뒤 사용할 수 있습니다.",
    };
  }

  // ② 서버 재검증
  const parsed = productUpdateSchema.safeParse(
    readFormFields(formData, [...PRODUCT_FORM_FIELDS, "id", "updated_at"] as const),
  );
  if (!parsed.success) {
    const fieldErrors = toFieldErrors(parsed.error.issues);
    // 상품 ID 형식이 틀리면 DB 에 묻지 않고 "없는 상품"으로 안내합니다.
    if (fieldErrors.id) return { ok: false, code: "NOT_FOUND", message: NOT_FOUND_MESSAGE };
    return {
      ok: false,
      code: "VALIDATION_FAILED",
      message: fieldErrors.updated_at ?? VALIDATION_MESSAGE,
      fieldErrors,
    };
  }
  const input = parsed.data;
  const productId = input.id.toLowerCase();
  if (!DB_TIMESTAMP_PATTERN.test(input.updated_at)) {
    return {
      ok: false,
      code: "VALIDATION_FAILED",
      message: "수정 기준 시각이 올바르지 않습니다. 페이지를 새로고침한 뒤 다시 수정해 주세요.",
    };
  }

  // ③ 이미지 경로(image_path)는 수정 대상에서 **제외**합니다.
  //    폼은 기존 경로를 그대로 보내지만, 어떤 값이 와도 DB 에 쓰지 않으므로 기존 이미지가 바뀌거나 지워지지 않습니다.
  //    (이미지 교체·삭제는 업로드 기능 단계에서 따로 구현)

  // ④ 수정 충돌 검사: 불러온 시점의 updated_at 과 DB 값이 **정확히 같을 때만** 수정합니다.
  //    수정일(updated_at)은 DB 트리거가 저장 시각으로 바꾸고, 등록일과 id 는 트리거가 바뀌지 않게 막습니다.
  try {
    const db = createAdminClient();
    const { data, error } = await db
      .from("products")
      .update({
        name: input.name,
        sku: input.sku,
        category: input.category,
        status: input.status,
        price: input.price,
        cost: input.cost,
        stock_quantity: input.stock_quantity,
        safety_stock: input.safety_stock,
        description: input.description,
      })
      .eq("id", productId)
      .eq("updated_at", input.updated_at) // 글자 그대로 전달 → DB 가 timestamptz 로 정확히 비교
      .select("id")
      .maybeSingle<{ id: string }>();

    if (error) return writeFailure("update", error);

    // ⑤ 바뀐 행이 없으면: 상품이 아직 있는지 확인해 "삭제됨"과 "먼저 수정됨"을 구분합니다.
    if (!data) {
      const { data: current, error: lookupError } = await db
        .from("products")
        .select("id")
        .eq("id", productId)
        .maybeSingle<{ id: string }>();
      if (lookupError) return writeFailure("update", lookupError);
      if (!current) return { ok: false, code: "NOT_FOUND", message: NOT_FOUND_MESSAGE };
      return {
        ok: false,
        code: "CONFLICT",
        message:
          "이 페이지를 연 뒤에 다른 곳에서 상품 정보가 먼저 수정되었습니다. 덮어쓰지 않도록 저장을 멈췄습니다. 입력한 내용을 따로 복사해 둔 뒤, 최신 내용을 불러와 다시 수정해 주세요.",
      };
    }
  } catch (error) {
    return writeFailure("update", thrown(error));
  }

  // ⑥ 성공: 안내 쿠키 → 목록·상세 캐시 갱신 → 상세로 이동
  await setFlashToast("updated");
  revalidatePath("/products");
  revalidatePath(`/products/${productId}`);
  redirect(`/products/${productId}`);
}

/** 상품 이미지 버킷 (supabase/migrations/20261109000002). 이 버킷 밖의 파일은 지우지 않습니다. */
const PRODUCT_IMAGE_BUCKET = "product-images";

/**
 * 상품 삭제가 **성공한 뒤에만** 호출합니다. (원칙: DB 가 먼저, 파일은 나중 — docs/specs/storage.md)
 * - 허용된 상품 이미지 경로(products/<uuid>.jpg|png|webp)만 대상으로 합니다.
 * - 다른 상품이 같은 경로를 쓰고 있으면 지우지 않습니다. 확인에 실패해도 지우지 않습니다. (확실할 때만 삭제)
 *   (DB 의 unique(image_path) 제약으로 공유는 원래 불가능하지만, 한 번 더 확인합니다)
 * - 실패해도 예외를 던지지 않고 서버 로그에만 남깁니다. 이미 성공한 상품 삭제는 되돌리지 않습니다.
 */
async function removeProductImage(imagePath: string) {
  if (!IMAGE_PATH_PATTERN.test(imagePath)) {
    console.error("[products] 이미지 삭제 건너뜀: 허용되지 않은 경로 형식");
    return;
  }
  try {
    const db = createAdminClient();
    const { data: users, error: lookupError } = await db
      .from("products")
      .select("id")
      .eq("image_path", imagePath)
      .limit(1);
    if (lookupError) {
      logDbError(`이미지 삭제 건너뜀 (사용 여부 확인 실패, orphan 가능): ${imagePath}`, lookupError);
      return;
    }
    if (users.length > 0) {
      console.error(`[products] 이미지 삭제 건너뜀: 다른 상품이 사용 중 (${imagePath})`);
      return;
    }

    const { error } = await db.storage.from(PRODUCT_IMAGE_BUCKET).remove([imagePath]);
    if (error) logDbError(`이미지 파일 삭제 실패 (orphan): ${imagePath}`, { message: error.message });
  } catch (error) {
    logDbError(`이미지 파일 삭제 실패 (orphan): ${imagePath}`, thrown(error));
  }
}

/** 이미 삭제됐거나 없는 상품: 목록으로 이동하고 Toast 로 알립니다. (docs/specs/products.md 5절) */
async function redirectAlreadyDeleted(): Promise<never> {
  await setFlashToast("missing");
  revalidatePath("/products");
  redirect("/products");
}

export async function deleteProduct(id: string): Promise<ActionResult> {
  // ① 접근 권한 확인: 데모 모드가 아니면 DB에 요청하지 않습니다.
  const access = await getBusinessAccess();
  if (!access.ok || access.mode !== "demo") {
    // 사업장 모드(미션 7)는 business_id 조건과 역할(owner/admin) 확인을 넣은 뒤 허용해야 합니다.
    return {
      ok: false,
      code: "FORBIDDEN",
      message: "지금은 상품을 삭제할 수 없습니다. 로그인과 사업장 권한 확인 기능이 준비된 뒤 사용할 수 있습니다.",
    };
  }

  // ② ID 검증: 형식이 틀리면 DB 에 묻지 않고 "없는 상품"으로 처리합니다.
  const parsedId = productIdSchema.safeParse(id);
  if (!parsedId.success) return redirectAlreadyDeleted();
  const productId = parsedId.data.toLowerCase();

  // ③ DB 에서 먼저 삭제하고, 지운 행의 이미지 경로를 돌려받습니다.
  let imagePath: string | null;
  try {
    const { data, error } = await createAdminClient()
      .from("products")
      .delete()
      .eq("id", productId)
      .select("id, image_path")
      .maybeSingle<{ id: string; image_path: string | null }>();

    if (error) {
      logDbError("상품 삭제 실패", error);
      return {
        ok: false,
        code: "UNKNOWN",
        message:
          "일시적인 오류로 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요. 계속 실패하면 상품 목록에서 삭제 여부를 먼저 확인해 주세요.",
      };
    }
    // ④ 지워진 행이 없음 = 이미 삭제됐거나 없는 상품
    if (!data) return redirectAlreadyDeleted();
    imagePath = data.image_path;
  } catch (error) {
    logDbError("상품 삭제 실패", thrown(error));
    return {
      ok: false,
      code: "UNKNOWN",
      message:
        "일시적인 오류로 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요. 계속 실패하면 상품 목록에서 삭제 여부를 먼저 확인해 주세요.",
    };
  }

  // ⑤ DB 삭제 성공 후에만 연결된 이미지 파일 삭제 시도 (실패해도 상품 삭제는 유지)
  if (imagePath) await removeProductImage(imagePath);

  // ⑥ 성공: 안내 쿠키 → 목록·상세 캐시 갱신 → 목록으로 이동
  await setFlashToast("deleted");
  revalidatePath("/products");
  revalidatePath(`/products/${productId}`);
  redirect("/products");
}

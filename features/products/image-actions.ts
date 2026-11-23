"use server";

import type { ActionResult } from "@/lib/action-result";
import { getBusinessAccess } from "@/lib/auth/business-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { PRODUCT_IMAGE_STORAGE } from "./constants";
import { imageFileSchema } from "./image";
import {
  buildImagePath,
  checkDiscardKey,
  checkUploadCapacity,
  createDiscardKey,
  isAllowedImagePath,
  isDiscardSigningReady,
  isProductImageUploadEnabled,
  removeUnusedImage,
  verifyStoredImage,
} from "./image-storage";

/**
 * 상품 이미지 업로드 Server Action (docs/specs/storage.md)
 *
 * 공개 요청 주소이므로 두 Action 모두
 * ① 데모 모드(접근 권한) → ② 업로드 스위치(PRODUCTS_IMAGE_UPLOAD_ENABLED) 를 가장 먼저 확인합니다.
 * 파일은 Next.js 서버를 거치지 않습니다. 서버는 "정해진 경로 1개에만 쓸 수 있는 1회용 업로드 허가"만 발급하고,
 * 업로드 뒤 실제 내용(매직 바이트)을 확인합니다. 상품 저장 시에도 createProduct 가 다시 확인합니다.
 */

const FORBIDDEN_MESSAGE =
  "지금은 이미지를 올릴 수 없습니다. 로그인과 사업장 권한 확인 기능이 준비된 뒤 사용할 수 있습니다.";
const UPLOAD_DISABLED_MESSAGE = "이미지 업로드 기능이 꺼져 있습니다. 이미지 없이 등록해 주세요.";

async function checkUploadAccess() {
  const access = await getBusinessAccess();
  if (!access.ok || access.mode !== "demo") {
    return { ok: false as const, result: { ok: false as const, code: "FORBIDDEN" as const, message: FORBIDDEN_MESSAGE } };
  }
  if (!isProductImageUploadEnabled()) {
    return {
      ok: false as const,
      result: { ok: false as const, code: "UPLOAD_UNAVAILABLE" as const, message: UPLOAD_DISABLED_MESSAGE },
    };
  }
  return { ok: true as const, access };
}

/**
 * 1회용 업로드 허가 발급: 형식·크기 재검사 → 용량 상한 확인(읽기 전용) → 서버가 경로 결정 → 서명 업로드 URL
 * 함께 돌려주는 discardKey 는 "저장 전에 이 업로드를 폐기"하는 용도로만 쓰입니다. (discardImageUpload)
 */
export async function requestImageUpload(
  input: unknown,
): Promise<ActionResult<{ path: string; token: string; discardKey: string }>> {
  const gate = await checkUploadAccess();
  if (!gate.ok) return gate.result;

  // 폐기 서명 키가 없으면 폐기할 수 없는 파일이 생기므로 업로드를 받지 않습니다 (fail-closed).
  if (!isDiscardSigningReady()) {
    console.error("[products] 업로드 거부: PRODUCTS_IMAGE_DISCARD_SECRET 이 없거나 형식이 올바르지 않습니다");
    return { ok: false, code: "UPLOAD_UNAVAILABLE", message: UPLOAD_DISABLED_MESSAGE };
  }

  const file = imageFileSchema.safeParse(input);
  if (!file.success) {
    const message = file.error.issues[0]?.message ?? "이미지를 확인해 주세요";
    return { ok: false, code: "VALIDATION_FAILED", message, fieldErrors: { image_path: message } };
  }

  const capacity = await checkUploadCapacity(file.data.size);
  if (!capacity.ok) {
    const message = {
      UNLINKED_LIMIT: "아직 상품에 저장되지 않은 이미지가 많아 지금은 새 이미지를 올릴 수 없습니다. 잠시 후 다시 시도해 주세요.",
      USAGE_LIMIT: "이미지 저장 공간이 거의 찼습니다. 지금은 새 이미지를 올릴 수 없습니다.",
      CHECK_FAILED: "일시적인 오류로 이미지를 올릴 수 없습니다. 잠시 후 다시 시도해 주세요.",
    }[capacity.reason];
    return { ok: false, code: "UPLOAD_UNAVAILABLE", message };
  }

  const path = buildImagePath(gate.access, file.data.type);
  if (!path) return { ok: false, code: "FORBIDDEN", message: FORBIDDEN_MESSAGE };

  try {
    // upsert: false → 같은 경로에 다시 올리거나 덮어쓸 수 없습니다. 허가는 2시간 동안 이 경로 1개에만 유효합니다.
    const { data, error } = await createAdminClient()
      .storage.from(PRODUCT_IMAGE_STORAGE.bucket)
      .createSignedUploadUrl(path, { upsert: false });
    if (error || !data) {
      console.error("[products] 업로드 URL 발급 실패", { message: error?.message });
      return { ok: false, code: "UNKNOWN", message: "일시적인 오류로 이미지를 올릴 수 없습니다. 잠시 후 다시 시도해 주세요." };
    }
    const discardKey = createDiscardKey(data.path);
    if (!discardKey) return { ok: false, code: "UPLOAD_UNAVAILABLE", message: UPLOAD_DISABLED_MESSAGE };
    return { ok: true, data: { path: data.path, token: data.token, discardKey } };
  } catch (error) {
    console.error("[products] 업로드 URL 발급 실패", { message: error instanceof Error ? error.message : "unknown" });
    return { ok: false, code: "UNKNOWN", message: "일시적인 오류로 이미지를 올릴 수 없습니다. 잠시 후 다시 시도해 주세요." };
  }
}

/**
 * 업로드 직후 확인: 파일이 있고, 5MB 이하이고, 실제 내용이 경로 확장자와 같은 이미지인지.
 * 내용이 틀리거나 너무 크면 **그 파일을 즉시 삭제**합니다 (어떤 상품에도 연결되지 않은 경우에만).
 * 사용자에게 빨리 알려 주기 위한 확인이며, DB 저장의 보증은 createProduct 의 재검증이 맡습니다.
 */
export async function verifyImageUpload(path: unknown): Promise<ActionResult<{ path: string }>> {
  const gate = await checkUploadAccess();
  if (!gate.ok) return gate.result;

  if (!isAllowedImagePath(gate.access, path)) {
    const message = "이미지 정보가 올바르지 않습니다. 이미지를 다시 올려 주세요";
    return { ok: false, code: "VALIDATION_FAILED", message, fieldErrors: { image_path: message } };
  }

  const check = await verifyStoredImage(gate.access, path);
  if (check.ok) return { ok: true, data: { path } };

  if (check.reason === "CONTENT_MISMATCH" || check.reason === "TOO_LARGE") {
    await removeUnusedImage(path);
  }
  return {
    ok: false,
    code: check.reason === "CHECK_FAILED" ? "UNKNOWN" : "VALIDATION_FAILED",
    message: check.message,
    fieldErrors: { image_path: check.message },
  };
}

/**
 * 저장 전 미사용 업로드 폐기 (5-B)
 *
 * 권한 검증 순서: ① 데모 모드 → ② 입력 형태 → ③ 경로 형식 → ④ 폐기 서명(형식·만료·HMAC)
 *               → ⑤ 어떤 상품에도 연결되지 않은 파일인지 확인 후 삭제 (removeUnusedImage)
 * - 서명이 맞아도 **DB 에 연결된 이미지는 삭제하지 않습니다.** 연결 여부 확인이 실패·시간 초과되면 지우지 않습니다.
 * - 업로드 스위치는 확인하지 않습니다. (스위치를 끈 뒤에도 남은 미사용 파일은 정리할 수 있게)
 * - 화면에는 3가지 응답만 돌려줍니다. 자세한 결과는 서버 로그에만 남깁니다. (키·서명·전체 경로는 기록하지 않음)
 *     완료                 → { ok: true }               : 삭제함 / 이미 없음 / 상품에 연결되어 보호함 (셋을 구분하지 않음)
 *     다시 시도 가능한 실패 → { ok: false, "UNKNOWN" }   : 연결 확인 실패 / 삭제 실패 / 시간 초과
 *     거부                 → { ok: false, "FORBIDDEN" } : 데모 모드 아님 / 입력·경로 오류 / 서명 형식·만료·위조 (사유 구분 없이 같은 응답)
 *   "완료"와 "거부"는 구분되지만, 폐기 서명은 서버 비밀 키 없이 만들 수 없어 이 구분으로 얻을 수 있는 정보가 없습니다.
 *   연결 여부·파일 존재 여부는 "완료" 하나로 합쳐 드러나지 않게 합니다.
 * - 같은 요청을 여러 번 보내도 안전합니다. (두 번째부터는 "이미 없음" → 완료)
 * - 한계: 연결 확인과 Storage 삭제 사이에 다른 요청이 같은 경로를 연결하는 경합은 막지 못합니다. (docs/specs/storage.md)
 */
const DISCARD_REJECTED_MESSAGE = "이 이미지는 정리할 수 없습니다.";
const DISCARD_RETRY_MESSAGE = "이미지를 정리하지 못했습니다. 잠시 후 다시 시도해 주세요.";

export async function discardImageUpload(input: unknown): Promise<ActionResult> {
  const startedAt = Date.now();
  const reject = (reason: string): ActionResult => {
    console.error("[products] 이미지 폐기 거부", { reason });
    return { ok: false, code: "FORBIDDEN", message: DISCARD_REJECTED_MESSAGE };
  };

  const access = await getBusinessAccess();
  if (!access.ok || access.mode !== "demo") return reject("ACCESS_DENIED");

  if (typeof input !== "object" || input === null) return reject("MALFORMED_INPUT");
  const { path, discardKey } = input as { path?: unknown; discardKey?: unknown };
  if (typeof path !== "string" || path.length > 200 || typeof discardKey !== "string" || discardKey.length > 100) {
    return reject("MALFORMED_INPUT");
  }
  if (!isAllowedImagePath(access, path)) return reject("INVALID_PATH");

  const key = checkDiscardKey(path, discardKey);
  if (key !== "OK") return reject(key);

  const outcome = await removeUnusedImage(path);
  const ms = Date.now() - startedAt;
  switch (outcome) {
    case "REMOVED":
    case "ALREADY_GONE":
    case "KEPT_LINKED":
      console.info("[products] 미사용 이미지 폐기 완료", { result: outcome, ms });
      return { ok: true, data: undefined };
    case "LOOKUP_FAILED":
    case "REMOVE_FAILED":
      console.error("[products] 미사용 이미지 폐기 실패 (다시 시도 가능)", { result: outcome, ms });
      return { ok: false, code: "UNKNOWN", message: DISCARD_RETRY_MESSAGE };
    case "INVALID_PATH":
      return reject("INVALID_PATH");
  }
}

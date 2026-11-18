"use server";

import type { ActionResult } from "@/lib/action-result";
import { getBusinessAccess } from "@/lib/auth/business-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { PRODUCT_IMAGE_STORAGE } from "./constants";
import { imageFileSchema } from "./image";
import {
  buildImagePath,
  checkUploadCapacity,
  isAllowedImagePath,
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

/** 1회용 업로드 허가 발급: 형식·크기 재검사 → 용량 상한 확인(읽기 전용) → 서버가 경로 결정 → 서명 업로드 URL */
export async function requestImageUpload(input: unknown): Promise<ActionResult<{ path: string; token: string }>> {
  const gate = await checkUploadAccess();
  if (!gate.ok) return gate.result;

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
    return { ok: true, data: { path: data.path, token: data.token } };
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

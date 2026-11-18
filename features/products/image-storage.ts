import "server-only";
import { randomUUID } from "node:crypto";
import type { BusinessAccess } from "@/lib/auth/business-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { PRODUCT_IMAGE, PRODUCT_IMAGE_STORAGE, type ProductImageMime } from "./constants";
import { detectImageMime, IMAGE_CONTENT_MISMATCH_MESSAGE } from "./image";
import { IMAGE_PATH_PATTERN } from "./schema";

/**
 * 상품 이미지 저장소 서버 전용 도우미 (docs/specs/storage.md)
 *
 * - secret 키 클라이언트를 쓰므로 `server-only` 입니다. 브라우저 코드에서 가져오면 빌드가 실패합니다.
 * - Server Action 이 아닌 일반 함수라 외부에서 직접 호출할 수 없습니다.
 *   (공개 진입점은 image-actions.ts 의 Server Action 과 actions.ts 뿐이며, 모두 접근 권한을 먼저 확인합니다)
 * - **경로 규칙은 이 파일에서만** 다룹니다. 미션 7(SQL 005 적용) 때 사업장 경로로 바꿀 곳은 여기입니다.
 */

type GrantedAccess = Extract<BusinessAccess, { ok: true }>;

const EXTENSION_BY_MIME: Record<ProductImageMime, "jpg" | "png" | "webp"> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const MIME_BY_EXTENSION: Record<string, ProductImageMime> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

/** 업로드 전용 차단 스위치: 서버 전용 환경변수가 정확히 "true" 일 때만 업로드를 허용합니다. (기본 = 꺼짐) */
export function isProductImageUploadEnabled(): boolean {
  return process.env.PRODUCTS_IMAGE_UPLOAD_ENABLED === "true";
}

/**
 * 새 이미지 경로를 서버가 정합니다. (파일 이름은 쓰지 않고 랜덤 uuid 사용)
 * - 데모 모드: products/<uuid>.<ext>  (SQL 001 products_image_path_format)
 * - 사업장 모드(미션 7): <business_id>/products/<uuid>.<ext> 로 바꿀 예정 → 그 전까지는 발급하지 않음
 */
export function buildImagePath(access: GrantedAccess, mime: ProductImageMime): string | null {
  if (access.mode !== "demo") return null;
  return `products/${randomUUID()}.${EXTENSION_BY_MIME[mime]}`;
}

/** 이 접근 권한으로 다룰 수 있는 이미지 경로인지 확인합니다. (`../`, 다른 폴더, 허용되지 않은 확장자 거부) */
export function isAllowedImagePath(access: GrantedAccess, path: unknown): path is string {
  if (access.mode !== "demo") return false; // 미션 7: 경로의 사업장 ID = access.businessId 확인
  return typeof path === "string" && IMAGE_PATH_PATTERN.test(path);
}

const HEAD_BYTES = 16;

/**
 * Storage 단계별 시간 제한(ms). 넘으면 "확인 실패"로 끝냅니다 (fail-closed · 파일은 지우지 않음).
 * 설치된 SDK(storage-js 2.119)의 취소 신호 지원 여부
 * - 지원(AbortSignal 로 실제 요청 취소): fetch 범위 요청, download(), list(), DB 조회·rpc(abortSignal)
 * - 미지원(호출한 쪽의 대기만 끝냄 · 요청 자체는 런타임 기본 시간까지 남을 수 있음): createSignedUrl(), info(), remove()
 */
const STEP_TIMEOUT_MS = {
  signedUrl: 5_000,
  rangeRead: 5_000,
  info: 5_000,
  download: 10_000,
  list: 8_000,
  db: 8_000,
  remove: 8_000,
} as const;

class StepTimeoutError extends Error {
  constructor() {
    super("timeout");
  }
}

/** 취소 신호를 받지 않는 SDK 호출용: 정해진 시간이 지나면 기다리기를 그만둡니다. */
async function withDeadline<T>(promise: PromiseLike<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new StepTimeoutError()), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

const isTimeout = (error: unknown) =>
  error instanceof StepTimeoutError ||
  (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError"));

/**
 * 진단 로그: 정상 처리(범위 요청 성공)에는 남기지 않고, 실패·시간 초과·대체 방식 사용 때만 남깁니다.
 * 단계 이름, 결과, 소요 시간만 기록합니다. (secret 키·업로드 토큰·서명 URL·파일 경로는 기록하지 않음)
 */
function logImageStep(step: string, outcome: string, startedAt: number, extra?: Record<string, string | number>) {
  console.error("[products] 이미지 확인 단계", { step, outcome, ms: Date.now() - startedAt, ...extra });
}

function isNotFoundError(error: unknown) {
  const e = error as { status?: number; statusCode?: string; code?: string } | null;
  return e?.code === "NoSuchKey" || e?.status === 404 || e?.statusCode === "404";
}

type HeadRead =
  | { ok: true; head: Uint8Array; size: number }
  | { ok: false; reason: "NOT_FOUND" | "TOO_LARGE" | "CHECK_FAILED" };

/**
 * 파일의 앞 16바이트와 전체 크기를 읽습니다. (매직 바이트·크기 확인용)
 * 1. 60초짜리 서명 URL 로 범위 요청(Range: bytes=0-15)
 *    → 206 이고 Content-Range 가 0번째 바이트부터이며 응답 길이가 맞으면, 16바이트와 전체 크기를 그대로 사용
 *    (스트림을 직접 읽거나 cancel() 을 기다리지 않음 — Next.js 서버에서 무한 대기가 생겼던 방식)
 * 2. 범위 요청이 정상 처리되지 않으면(206 이 아님, 헤더 불일치) 요청을 취소하고
 *    info() 로 크기(5MB 이하)를 확인한 뒤 download() 로 받아 앞부분만 사용
 * 시간 초과·네트워크 오류는 대체 방식으로 넘기지 않고 바로 CHECK_FAILED (fail-closed)
 * 공개 URL(CDN)이 아니라 서명 URL 로 읽어 캐시 영향을 받지 않습니다.
 */
async function readImageHead(path: string): Promise<HeadRead> {
  const storage = createAdminClient().storage.from(PRODUCT_IMAGE_STORAGE.bucket);

  // ① 서명 URL (취소 신호 미지원 → 대기 시간 제한)
  let startedAt = Date.now();
  let signedUrl: string;
  try {
    const { data, error } = await withDeadline(storage.createSignedUrl(path, 60), STEP_TIMEOUT_MS.signedUrl);
    if (error || !data?.signedUrl) {
      if (isNotFoundError(error)) return { ok: false, reason: "NOT_FOUND" };
      logImageStep("signed-url", "error", startedAt);
      return { ok: false, reason: "CHECK_FAILED" };
    }
    signedUrl = data.signedUrl;
  } catch (error) {
    logImageStep("signed-url", isTimeout(error) ? "timeout" : "error", startedAt);
    return { ok: false, reason: "CHECK_FAILED" };
  }

  // ② 범위 요청 (AbortController 로 실제 요청 취소)
  startedAt = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), STEP_TIMEOUT_MS.rangeRead);
  let fallbackReason = "";
  try {
    const res = await fetch(signedUrl, {
      headers: { Range: `bytes=0-${HEAD_BYTES - 1}` },
      cache: "no-store",
      signal: controller.signal,
    });
    const range = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(res.headers.get("content-range") ?? "");
    if (res.status === 206 && range && Number(range[1]) === 0) {
      const size = Number(range[3]);
      const expectedLength = Math.min(HEAD_BYTES, size);
      const declaredLength = res.headers.get("content-length");
      if (
        Number.isSafeInteger(size) &&
        Number(range[2]) === expectedLength - 1 &&
        (declaredLength === null || Number(declaredLength) === expectedLength)
      ) {
        const head = new Uint8Array(await res.arrayBuffer()); // 최대 16바이트
        if (head.length === expectedLength) return { ok: true, head, size };
        fallbackReason = "length-mismatch";
      } else {
        fallbackReason = "range-header-mismatch";
      }
    } else if (res.status === 400 || res.status === 404) {
      controller.abort();
      return { ok: false, reason: "NOT_FOUND" };
    } else {
      fallbackReason = `status-${res.status}`;
    }
    controller.abort(); // 남은 응답 본문을 받지 않고 연결을 끊습니다.
  } catch (error) {
    logImageStep("range-read", isTimeout(error) ? "timeout" : "error", startedAt);
    return { ok: false, reason: "CHECK_FAILED" };
  } finally {
    clearTimeout(timer);
  }
  logImageStep("range-read", "fallback", startedAt, { reason: fallbackReason });

  // ③ 대체: 크기 확인(취소 신호 미지원 → 대기 시간 제한) 후 다운로드(취소 신호 지원)
  startedAt = Date.now();
  let size: number | undefined;
  try {
    const { data, error } = await withDeadline(storage.info(path), STEP_TIMEOUT_MS.info);
    if (error || !data) {
      if (isNotFoundError(error)) return { ok: false, reason: "NOT_FOUND" };
      logImageStep("info", "error", startedAt);
      return { ok: false, reason: "CHECK_FAILED" };
    }
    size = data.size;
  } catch (error) {
    logImageStep("info", isTimeout(error) ? "timeout" : "error", startedAt);
    return { ok: false, reason: "CHECK_FAILED" };
  }
  if (typeof size !== "number" || size < 1 || size > PRODUCT_IMAGE.maxBytes) return { ok: false, reason: "TOO_LARGE" };

  startedAt = Date.now();
  try {
    const { data: blob, error } = await storage.download(path, {}, { signal: AbortSignal.timeout(STEP_TIMEOUT_MS.download) });
    if (error || !blob) {
      logImageStep("download", isTimeout(error) ? "timeout" : "error", startedAt);
      return { ok: false, reason: "CHECK_FAILED" };
    }
    const head = new Uint8Array(await blob.slice(0, HEAD_BYTES).arrayBuffer());
    logImageStep("download", "ok", startedAt);
    return { ok: true, head, size };
  } catch (error) {
    logImageStep("download", isTimeout(error) ? "timeout" : "error", startedAt);
    return { ok: false, reason: "CHECK_FAILED" };
  }
}

export type StoredImageCheck =
  | { ok: true }
  | {
      ok: false;
      reason: "INVALID_PATH" | "NOT_FOUND" | "TOO_LARGE" | "CONTENT_MISMATCH" | "CHECK_FAILED";
      message: string;
    };

const CHECK_FAILED_MESSAGE = "이미지 확인에 실패했습니다. 잠시 후 다시 시도해 주세요";

/**
 * Storage 에 실제로 있는 파일이 허용된 이미지인지 확인합니다. (업로드 직후 + 상품 저장 시 공용)
 * 경로 형식 → 파일 존재 → 크기 → 매직 바이트와 확장자 일치. 확인하지 못하면 실패로 봅니다 (fail-closed).
 * - CHECK_FAILED(시간 초과·네트워크 오류)는 파일 내용 문제와 구분됩니다. 이 경우 호출한 쪽은 파일을 지우지 않습니다.
 * 이 함수는 파일을 지우지 않습니다. 지울지는 호출한 쪽이 결정합니다.
 */
export async function verifyStoredImage(access: GrantedAccess, path: unknown): Promise<StoredImageCheck> {
  if (!isAllowedImagePath(access, path)) {
    return { ok: false, reason: "INVALID_PATH", message: "이미지 정보가 올바르지 않습니다. 이미지를 다시 올려 주세요" };
  }

  const read = await readImageHead(path);
  if (!read.ok) {
    if (read.reason === "NOT_FOUND") {
      return { ok: false, reason: "NOT_FOUND", message: "업로드된 이미지를 찾을 수 없습니다. 이미지를 다시 올려 주세요" };
    }
    if (read.reason === "TOO_LARGE") {
      return { ok: false, reason: "TOO_LARGE", message: "5MB 이하의 이미지 파일만 사용할 수 있습니다" };
    }
    return { ok: false, reason: "CHECK_FAILED", message: CHECK_FAILED_MESSAGE };
  }

  if (read.size < 1 || read.size > PRODUCT_IMAGE.maxBytes) {
    return { ok: false, reason: "TOO_LARGE", message: "5MB 이하의 이미지 파일만 사용할 수 있습니다" };
  }

  const expected = MIME_BY_EXTENSION[path.slice(path.lastIndexOf(".") + 1)];
  if (!expected || detectImageMime(read.head) !== expected) {
    return { ok: false, reason: "CONTENT_MISMATCH", message: IMAGE_CONTENT_MISMATCH_MESSAGE };
  }
  return { ok: true };
}

/**
 * 어떤 상품에도 연결되지 않은 파일만 삭제합니다. (작업 4의 상품 삭제, 검증 실패 파일 정리에 공용)
 * - 허용된 상품 이미지 경로(products/<uuid>.jpg|png|webp)만 대상으로 합니다.
 * - 다른 상품이 같은 경로를 쓰고 있으면 지우지 않습니다. 확인에 실패해도 지우지 않습니다. (확실할 때만 삭제)
 *   (DB 의 unique(image_path) 제약으로 공유는 원래 불가능하지만, 한 번 더 확인합니다)
 * - 실패해도 예외를 던지지 않고 서버 로그에만 남깁니다. 호출한 쪽의 DB 처리는 되돌리지 않습니다.
 */
export async function removeUnusedImage(imagePath: string) {
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
      .limit(1)
      .abortSignal(AbortSignal.timeout(STEP_TIMEOUT_MS.db));
    if (lookupError) {
      console.error(`[products] 이미지 삭제 건너뜀 (사용 여부 확인 실패, orphan 가능): ${imagePath}`, {
        code: lookupError.code,
        message: lookupError.message,
      });
      return;
    }
    if (users.length > 0) {
      console.error(`[products] 이미지 삭제 건너뜀: 다른 상품이 사용 중 (${imagePath})`);
      return;
    }

    // remove() 는 취소 신호를 받지 않으므로 대기 시간만 제한합니다. (시간 초과 시 실제 삭제 여부는 알 수 없음 → orphan 가능으로 기록)
    const { error } = await withDeadline(db.storage.from(PRODUCT_IMAGE_STORAGE.bucket).remove([imagePath]), STEP_TIMEOUT_MS.remove);
    if (error) console.error(`[products] 이미지 파일 삭제 실패 (orphan): ${imagePath}`, { message: error.message });
  } catch (error) {
    console.error(`[products] 이미지 파일 삭제 실패 (orphan): ${imagePath}`, {
      message: error instanceof Error ? error.message : "unknown error",
    });
  }
}

const LIST_LIMIT = 1000;

export type UploadCapacity =
  | { ok: true; unlinkedFiles: number; usageBytes: number }
  | { ok: false; reason: "UNLINKED_LIMIT" | "USAGE_LIMIT" | "CHECK_FAILED" };

/**
 * 새 업로드를 받아도 되는지 **읽기 전용으로** 확인합니다. (파일을 지우지 않음)
 * - 미연결 파일 수: Storage 의 products/ 파일 중 어떤 상품의 image_path 에도 없는 파일 수
 * - 버킷 사용량: product_images_usage_bytes() (SQL 002)
 * 확인하지 못하면 발급하지 않습니다 (fail-closed).
 * 참고: 동시에 들어온 요청들은 같은 개수를 볼 수 있어, 상한을 몇 개 넘을 수 있습니다. (소프트 상한)
 */
export async function checkUploadCapacity(incomingBytes: number): Promise<UploadCapacity> {
  try {
    const db = createAdminClient();
    const [listed, linked, usage] = await Promise.all([
      db.storage
        .from(PRODUCT_IMAGE_STORAGE.bucket)
        .list("products", { limit: LIST_LIMIT }, { signal: AbortSignal.timeout(STEP_TIMEOUT_MS.list) }),
      db
        .from("products")
        .select("image_path")
        .not("image_path", "is", null)
        .abortSignal(AbortSignal.timeout(STEP_TIMEOUT_MS.db)),
      db.rpc("product_images_usage_bytes").abortSignal(AbortSignal.timeout(STEP_TIMEOUT_MS.db)),
    ]);
    if (listed.error || linked.error || usage.error) {
      console.error("[products] 업로드 용량 확인 실패", {
        storage: listed.error?.message,
        products: linked.error?.code,
        usage: usage.error?.code,
      });
      return { ok: false, reason: "CHECK_FAILED" };
    }

    // 목록이 한도까지 찼다면 정확히 셀 수 없으므로 상한에 도달한 것으로 봅니다.
    if (listed.data.length >= LIST_LIMIT) return { ok: false, reason: "UNLINKED_LIMIT" };

    const linkedPaths = new Set((linked.data as { image_path: string }[]).map((r) => r.image_path));
    const unlinkedFiles = listed.data.filter((f) => f.id !== null && !linkedPaths.has(`products/${f.name}`)).length;
    if (unlinkedFiles >= PRODUCT_IMAGE_STORAGE.maxUnlinkedFiles) return { ok: false, reason: "UNLINKED_LIMIT" };

    const usageBytes = Number(usage.data ?? 0);
    if (!Number.isFinite(usageBytes)) return { ok: false, reason: "CHECK_FAILED" };
    if (usageBytes + incomingBytes > PRODUCT_IMAGE_STORAGE.softLimitBytes) return { ok: false, reason: "USAGE_LIMIT" };

    return { ok: true, unlinkedFiles, usageBytes };
  } catch (error) {
    console.error("[products] 업로드 용량 확인 실패", { message: error instanceof Error ? error.message : "unknown" });
    return { ok: false, reason: "CHECK_FAILED" };
  }
}

/**
 * Server Action 공통 결과 형식 (docs/specs/products.md)
 *
 * - ok: true  → 성공. data 에 결과를 담습니다.
 * - ok: false → 실패. message 는 폼 위쪽, fieldErrors 는 각 입력칸 아래에 표시합니다.
 *   code 로 실패 종류를 구분합니다.
 *   - VALIDATION_FAILED: 입력값 오류 (zod 또는 DB 제약조건)
 *   - DB_NOT_CONNECTED : 아직 DB 연결 전인 기능 (현재 상품 기능에서는 사용하지 않음)
 *   - FORBIDDEN        : 접근 권한 없음 (예: 데모 모드가 꺼져 있음). DB에 요청하지 않음
 *   - LIMIT_REACHED    : 상품 개수 한도(300개) 도달
 *   - CONFLICT         : 수정 충돌 (페이지를 연 뒤 다른 곳에서 먼저 수정됨)
 *   - NOT_FOUND        : 대상이 없음
 *   - UNKNOWN          : 네트워크 오류 등 일시적인 오류
 */
export type FieldErrors = Partial<Record<string, string>>;

export type ActionFailureCode =
  | "VALIDATION_FAILED"
  | "DB_NOT_CONNECTED"
  | "FORBIDDEN"
  | "LIMIT_REACHED"
  | "CONFLICT"
  | "NOT_FOUND"
  | "UNKNOWN";

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | {
      ok: false;
      code: ActionFailureCode;
      message: string;
      fieldErrors?: FieldErrors;
    };

/** zod 오류를 "필드 이름 → 첫 번째 오류 문구" 형태로 바꿉니다. */
export function toFieldErrors(issues: ReadonlyArray<{ path: PropertyKey[]; message: string }>) {
  const errors: FieldErrors = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? "_form");
    if (!errors[key]) errors[key] = issue.message;
  }
  return errors;
}

// ─────────────────────────────────────────────────────────────
// 성공 안내(Toast) 전달용 flash 쿠키
// - Server Action 이 redirect 직전에 저장하고, 이동한 페이지의 Toast 가 읽은 뒤 바로 지웁니다.
// - 값은 아래 정해진 단어만 사용합니다. (상품 정보·개인정보를 넣지 않음)
// - 서버(Server Action)와 브라우저(Toast)가 함께 쓰므로 이 파일에 둡니다.
// ─────────────────────────────────────────────────────────────

export const FLASH_TOAST_COOKIE = "easyerp_toast";
export const FLASH_TOAST_MAX_AGE_SECONDS = 60;

export const FLASH_TOAST_MESSAGES = {
  created: "상품이 등록되었습니다",
  updated: "상품이 수정되었습니다",
  deleted: "상품이 삭제되었습니다",
  missing: "이미 삭제되었거나 존재하지 않는 상품입니다",
} as const;

export type FlashToastKind = keyof typeof FLASH_TOAST_MESSAGES;

export function isFlashToastKind(value: string): value is FlashToastKind {
  return Object.prototype.hasOwnProperty.call(FLASH_TOAST_MESSAGES, value);
}

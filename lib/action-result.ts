/**
 * Server Action 공통 결과 형식 (docs/specs/products.md)
 *
 * - ok: true  → 성공. data 에 결과를 담습니다.
 * - ok: false → 실패. message 는 폼 위쪽, fieldErrors 는 각 입력칸 아래에 표시합니다.
 *   code 로 실패 종류를 구분합니다. (예: DB_NOT_CONNECTED = 아직 DB 연결 전)
 */
export type FieldErrors = Partial<Record<string, string>>;

export type ActionFailureCode =
  | "VALIDATION_FAILED"
  | "DB_NOT_CONNECTED"
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

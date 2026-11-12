import "server-only";

/**
 * 현재 요청의 상품 데이터 접근 권한 확인
 *
 * 원칙: 기본값은 거부(fail-closed)
 *   - 상품 데이터를 읽거나 바꾸는 서버 코드(조회 함수, Server Action)는
 *     DB에 묻기 전에 반드시 이 함수를 먼저 호출합니다.
 *   - 확인할 수 없거나 설정이 틀리면 접근을 허용하지 않습니다.
 *
 * 접근 방식 (위에서부터 확인)
 *   1. 공개 데모 모드 (이번 미션: 상품 CRUD)
 *      - 서버 환경변수 PRODUCTS_DEMO_MODE 가 "정확히" "true" 일 때만 허용합니다.
 *        ("TRUE", "1", " true", 빈 값, 미설정은 모두 차단)
 *      - NEXT_PUBLIC_ 이 아니므로 브라우저 코드에 포함되지 않고, 요청으로 바꿀 수 없습니다.
 *      - 누구나 데모 상품을 보고 바꿀 수 있는 "공개 데모"입니다. 화면에 안내를 표시하고 테스트 데이터만 사용합니다.
 *      - 긴급 차단: 값을 지우거나 false 로 바꾸고 다시 배포하면 조회·쓰기가 모두 차단됩니다.
 *   2. 로그인 + 사업장 멤버 (미션 7, 아직 미구현 → 차단)
 *      - 선행 작업: Supabase Auth 연결, SQL 005(products.business_id + RLS) 적용
 *        초안: supabase/drafts/mission7/, 설계: docs/future/auth-organization.md
 *      - 구현 예정: 세션 클라이언트로 getClaims() → memberships 확인 → { mode: "business", userId, businessId }
 *        요청 값(쿼리 문자열, 폼 값)만 믿고 businessId 를 정하지 않습니다.
 */

export type BusinessAccessDeniedReason =
  /** 인증·사업장 기능이 아직 연결되지 않았고, 데모 모드도 꺼져 있음 */
  | "AUTH_NOT_READY"
  /** 로그인하지 않음 (미션 7) */
  | "UNAUTHENTICATED"
  /** 로그인했지만 이 사업장의 멤버가 아님 (미션 7) */
  | "NO_BUSINESS_ACCESS";

export type BusinessAccess =
  /** 공개 데모: 사업장 구분 없이 데모 상품 전체에 접근 (SQL 001 구조) */
  | { ok: true; mode: "demo" }
  /** 미션 7: 로그인 사용자의 사업장 범위로만 접근 */
  | { ok: true; mode: "business"; userId: string; businessId: string }
  | { ok: false; reason: BusinessAccessDeniedReason };

/** 데모 모드 여부. 정확히 "true" 일 때만 true 입니다. */
export function isProductsDemoMode(): boolean {
  return process.env.PRODUCTS_DEMO_MODE === "true";
}

export async function getBusinessAccess(): Promise<BusinessAccess> {
  if (isProductsDemoMode()) return { ok: true, mode: "demo" };

  // 미션 7: 로그인 + 사업장 멤버십 확인을 여기에 구현합니다. 그 전까지는 차단합니다.
  return { ok: false, reason: "AUTH_NOT_READY" };
}

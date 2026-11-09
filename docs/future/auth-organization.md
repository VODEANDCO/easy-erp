# [향후 계획] 인증과 사업장 (미션 7 이후)

> 미션 6 범위에서 제외된 설계입니다. 아직 SQL과 코드는 작성하지 않았고, 아래 설계만 보관합니다.
> 작업용 브랜치 `feature/auth-organization`은 `main`(0단계) 기준으로 만들어 두었습니다(커밋 없음).

## 목표
- 회원가입, 로그인, 로그아웃, 비밀번호 재설정 (Supabase Auth)
- 한 사용자가 여러 사업장에 소속될 수 있는 구조
- 사업장별 데이터 격리 (RLS)

## 테이블 설계안

| 테이블 | 주요 컬럼 | 비고 |
|---|---|---|
| profiles | id(= auth.users.id), display_name | 가입 시 트리거로 자동 생성 |
| businesses | id, name, business_number, created_by | |
| memberships | user_id, business_id, role(OWNER/ADMIN/STAFF) | (user_id, business_id) UNIQUE |

- 최초 사업장 생성: `create_business(name)` DB 함수가 사업장과 OWNER 멤버십을 **한 트랜잭션**으로 만든다.
- 중복 생성 방지: 같은 사용자가 같은 이름으로 사업장을 다시 만들지 못하게 `(created_by, lower(name))` UNIQUE를 건다. 온보딩 버튼은 중복 제출을 막는다.
- 현재 사업장: 세션 또는 쿠키의 `activeBusinessId`. 서버는 매 요청마다 멤버십으로 검증한다.

## products 테이블 확장 계획
1. `business_id uuid references businesses` 컬럼 추가 (기존 데모 데이터는 데모 사업장으로 옮김)
2. SKU 유일성을 `unique (business_id, sku)`로 변경
3. RLS 정책 추가: `business_id in (select business_id from memberships where user_id = auth.uid())`
4. 서버 접근을 secret 키에서 **로그인 사용자 세션 클라이언트**(`lib/supabase/server.ts`)로 바꿔 RLS가 적용되게 함
5. Storage 경로를 `<business_id>/products/<uuid>.<ext>`로 변경하고 정책 추가

## 이미 준비된 코드
- `lib/supabase/server.ts`: 쿠키 세션 기반 서버 클라이언트
- `lib/supabase/client.ts`: 브라우저 클라이언트
- `lib/supabase/proxy.ts`: 세션 갱신 헬퍼 (루트 `proxy.ts`에 연결 예정)

## 권한표 (초안)

| 기능 | OWNER | ADMIN | STAFF |
|---|---|---|---|
| 상품 조회·등록·수정 | ✅ | ✅ | ✅ |
| 상품 삭제 | ✅ | ✅ | ❌ |
| 사업장 설정, 멤버 관리 | ✅ | ✅ | ❌ |
| 사업장 삭제 | ✅ | ❌ | ❌ |

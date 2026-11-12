# 미션 6 개발 체크리스트

> 표기: ✅ 완료(실제로 확인함) · 🔄 진행 중 · ⬜ 시작 전 · ⏸ 승인 대기
> **테스트하지 않은 항목은 ✅로 표시하지 않는다.**

## Phase 0 — 기존 작업 분석과 범위 재정의
- ✅ 프로젝트 구조, 패키지 분석
- ✅ Supabase 클라이언트, 환경변수 검증, 디자인 토큰 초안 (커밋 `11993f7`)
- ✅ 인증·사업장 계획을 미션 7 이후로 분리 → [future/auth-organization.md](./future/auth-organization.md)
- ✅ 상품 관리 CRUD를 핵심 기능으로 확정

## Phase 1 — 기능 명세와 DB 설계
- ✅ 페이지별 기능 명세 → [specs/products.md](./specs/products.md)
- ✅ Storage 설계 → [specs/storage.md](./specs/storage.md)
- ✅ SQL v2 → `supabase/migrations/` (001·002, **DB 미적용**), 선택 작업 → `supabase/drafts/optional/003`
- ✅ PGlite 사전 검증 → [sql-verification.md](./sql-verification.md)
- ✅ 접근 차단 방식 결정: RLS 활성화(정책 없음) + 권한 회수
- ✅ 데모 쓰기 코드 사용 안 함 (결정)
- ✅ 001·002 SQL 코드 검토 및 수정 (v2)
- ✅ 판매가·원가 정수 제약 추가 (v3) + PGlite 재검증
- ⏸ 001·002 Supabase 적용 최종 승인
- ✅ 상품 개수 한도 300개 유지 (Storage 용량은 별도 관리로 결정)

## Phase 2 — Supabase 연결과 테이블 구성
- ⬜ (사용자) Supabase 가입, 프로젝트 생성
- ⬜ (사용자) `.env.local`에 키 3개 입력
- ⬜ `supabase/migrations/` SQL을 Supabase에 적용 (**별도 승인 후**)
- ⬜ `lib/supabase/admin.ts` (secret 키, server-only)
- ⬜ DB 타입 생성 (`database.types.ts`)
- ⬜ 데모 상품 시드 데이터 15~20개
- ⬜ 공개 키로 직접 조회가 막히는지 확인

## Phase 3 — 등록·목록·상세
> 🔄 = DB 연결 없이 화면·검증까지 만든 상태. **실제 저장·조회는 아직 동작하지 않음** (미리보기 데이터 사용)
- 🔄 공통 레이아웃: Sidebar(준비 중 메뉴 포함), Header, Breadcrumb, 모바일 드로어
- 🔄 UI 컴포넌트: Button, Input, Select, Textarea, Field, Badge, Card, Skeleton, Empty/Error State, Alert, Dialog, Pagination (Toast는 DB 연결 후)
- ✅ zod 스키마 (자동 테스트 63개 통과, 원 단위 정수 규칙 포함)
- 🔄 `createProduct` Server Action: 서버 재검증까지만, DB 저장 ⬜
- 🔄 `/products` 목록, `/products/[id]` 상세, `notFound` 처리 (미리보기 데이터 기준 확인)
- 🔄 loading(Suspense) / error / not-found 화면

## Phase 4 — 수정·삭제
- 🔄 `/products/[id]/edit` 화면, `updateProduct` 서버 재검증 (수정 충돌 검사·DB 저장 ⬜)
- 🔄 Confirmation Dialog, `deleteProduct` (ID 검증까지만, DB 삭제 ⬜)
- ⬜ 캐시 무효화로 목록·상세에 바로 반영

## Phase 5 — 이미지 업로드와 상태 처리
- ⬜ 업로드 URL 발급 Action, 업로드 컴포넌트(미리보기, 진행 상태, 재시도)
- ⬜ 교체·삭제 시 파일 정리
- ⬜ 매직 바이트 검사, 실패 상황별 파일 정리 ([storage.md](./specs/storage.md) 표 1~9)
- ⬜ 네트워크 오류, 중복 제출 방지 점검

## Phase 6 — 검색·필터·페이지네이션
- ⬜ 상품명·SKU 검색, 카테고리·재고 부족 필터, 정렬
- ⬜ URL 쿼리 동기화, Pagination
- ⬜ 반응형 (태블릿, 모바일)

## 공개 배포 전 필수 재검토 (미완료 · 2026-11-12 기록)
> 공개 데모 모드(`PRODUCTS_DEMO_MODE=true`)는 로그인 없이 누구나 상품을 보고 바꿀 수 있습니다.
> Vercel 공개 배포 전에 아래 항목을 다시 검토하고 결정합니다.
- ⬜ 요청 횟수 제한 도입 여부와 한도 결정 (`supabase/drafts/optional/003_demo_rate_limit.sql`, fail-closed)
- ⬜ 파일 업로드 악용 방지: 업로드 URL만 받고 상품은 저장하지 않는 반복 요청(고아 파일 누적), 800MB 소프트 한도의 한계, 고아 파일 정리 방법 ([specs/storage.md](./specs/storage.md))
- ⬜ 모든 Server Action(등록·수정·삭제·업로드 URL 발급)이 `getBusinessAccess()` 를 먼저 확인하는지 점검
- ⬜ 배포 빌드의 브라우저 번들에 secret 키·`sb_secret_`·키 이름이 없는지 재검사
- ⬜ Vercel 환경변수: `SUPABASE_SECRET_KEY`, `PRODUCTS_DEMO_MODE` 에 `NEXT_PUBLIC_` 이 붙지 않았는지 확인
- ⬜ 긴급 차단 절차 확인: `PRODUCTS_DEMO_MODE` 를 지우고 재배포하면 상품 화면이 차단되는지

## Phase 7 — QA, README, 배포
- ⬜ (사용자 승인) GitHub 저장소 생성, push
- ⬜ (사용자 승인) Vercel 프로젝트 생성, 환경변수 등록
- ⬜ 배포 환경 전체 QA
- ⬜ README 작성 (GitHub URL, Vercel URL 포함)

## 선택 작업 — 요청 횟수 제한 (보류, 필수 기능 완료 후 검토)
- ⏸ 한도 숫자와 도입 여부 승인
- ⬜ `optional/003` 적용, fail-closed 구현, `RATE_LIMIT_ENABLED` 스위치
- ⬜ 한도 초과 안내 QA

## Phase 8 — 심화 (미션 범위 밖)
- 다중 이미지, 고아 파일 정리, CSV 내보내기, 인증·사업장(미션 7), 주문·재고 연동

---

## QA 결과표

| # | 시나리오 | 기대 결과 | 로컬 | 배포 |
|---|---|---|---|---|
| 1 | 상품명 없이 등록 | 상품명 칸에 오류, 저장 안 됨 | 미검증 | 미검증 |
| 2 | 잘못된 가격 (문자, 소수 3자리) | 판매가 칸에 오류 | 미검증 | 미검증 |
| 3 | 음수 재고 | 재고 칸에 오류 | 미검증 | 미검증 |
| 4 | 중복 SKU (대소문자만 다른 경우 포함) | "이미 사용 중인 SKU" | 미검증 | 미검증 |
| 5 | 정상 등록 | 상세로 이동 + Toast | 미검증 | 미검증 |
| 6 | 등록 후 목록 반영 | 목록 첫 줄에 표시 | 미검증 | 미검증 |
| 7 | 상세 조회 | 모든 필드 표시 | 미검증 | 미검증 |
| 8 | 새로고침 후 유지 | 데이터 그대로 | 미검증 | 미검증 |
| 9 | 정보 수정 | 저장 + Toast | 미검증 | 미검증 |
| 10 | 수정 후 상세·목록 반영, 수정일 갱신 | 반영됨 | 미검증 | 미검증 |
| 11 | 삭제 확인 다이얼로그 | 취소하면 유지, 확인하면 삭제 | 미검증 | 미검증 |
| 12 | 삭제 후 목록 반영 | 목록에서 사라짐 | 미검증 | 미검증 |
| 13 | 없는 상세 URL (`/products/abc`, 없는 uuid) | "상품을 찾을 수 없습니다" | 미검증 | 미검증 |
| 14 | 이미지 없이 등록 | 기본 플레이스홀더 | 미검증 | 미검증 |
| 15 | 정상 이미지 업로드 | 미리보기 → 저장 후 표시 | 미검증 | 미검증 |
| 16 | 허용되지 않은 파일 (gif, pdf, 확장자 위장) | 거부 메시지 | 미검증 | 미검증 |
| 17 | 5MB 초과 | 거부 메시지 | 미검증 | 미검증 |
| 18 | 업로드 실패 (네트워크 끊김) | 실패 안내 + 재시도 | 미검증 | 미검증 |
| 19 | 검색·필터·정렬 | 결과 정확, URL 반영, 새로고침 후 유지 | 미검증 | 미검증 |
| 20 | 페이지네이션 | 페이지 이동, 범위 밖 page 처리 | 미검증 | 미검증 |
| 21 | 배포 환경 전체 CRUD | 1~20 재확인 | — | 미검증 |
| 보안 | 공개 키로 `products` 직접 조회 | 차단됨 | 미검증 | 미검증 |

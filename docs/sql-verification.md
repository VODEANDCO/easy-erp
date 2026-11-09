# SQL 사전 검증 결과 (PGlite)

- 검증일: 2026-11-09
- 대상: `supabase/migrations/20261109000001_create_products.sql`, `20261109000002_create_product_images_bucket.sql`, `supabase/drafts/optional/003_demo_rate_limit.sql`
- 환경: PGlite 0.5.15 (**PostgreSQL 18.6**, 메모리 DB). 프로젝트 밖 임시 폴더에서만 실행했고, 프로젝트 `package.json`은 변경하지 않았다.
- 실제 Supabase DB에는 **적용하지 않았다.**

## Supabase 흉내 방법

| Supabase 요소 | 검증 환경에서의 처리 |
|---|---|
| `anon`, `authenticated` 역할 | 직접 생성 |
| `service_role` (RLS 우회) | `BYPASSRLS` 속성으로 생성 |
| 새 테이블·함수에 공개 역할 권한 자동 부여 | `ALTER DEFAULT PRIVILEGES`로 재현 → 그래서 "권한 회수"가 실제로 효과가 있는지 검증 가능 |
| `storage.buckets`, `storage.objects` | 필요한 컬럼만 가진 가짜 테이블 |

## 결과 요약

| 구분 | 개수 |
|---|---|
| ✅ 성공 | 65 |
| ❌ 실패 (SQL 결함) | 0 |
| ⚪ 미검증 | 자동 테스트 2개 + 환경상 검증할 수 없는 항목 (아래 목록) |

자동 테스트는 67개이다. 스크립트 결과는 "66개 통과, 1개 불일치"였지만, 2개를 미검증으로 다시 분류했다.
- 불일치 1개(JS `Date` 정밀도 함정): SQL 결함이 아니다. PGlite에서는 그 상황을 재현할 수 없었다.
- 통과 1개(anon의 storage 차단): 가짜 스키마의 권한 때문에 막혔을 뿐이고, 실제 차단 이유(RLS)를 검증한 것이 아니다.

## ✅ 성공

**1. 문법**
- 001, 002, 003(선택) 파일 전체 실행
- 002 재실행 시 오류 없음 (`on conflict`, 여러 번 실행해도 안전)

**2. 권한**
- anon, authenticated: products 조회·등록·수정·삭제 모두 `42501 permission denied`
- anon, authenticated: 사용량 함수, 요청 제한 함수 실행 차단 (`42501`)
- anon, authenticated: 요청 제한 기록 테이블 조회 차단 (`42501`)
- **2차 방어**: anon에 조회 권한을 실수로 다시 줘도 RLS(정책 없음) 때문에 **0행** 반환 (실제로는 1행 존재)
- service_role: 등록·조회·수정·삭제 정상, 트리거도 정상 실행

**3. 제약조건** (모두 의도한 제약조건 이름으로 거부됨)
- 상품명: 빈 값, 공백만, 탭·줄바꿈만, 앞뒤 공백, 101자 → 거부 / 100자 → 허용
- SKU: 소문자, 1자, 하이픈으로 시작, 한글, 중복(`23505 products_sku_key`) → 거부
- 판매가·원가·재고·안전재고 음수 → 거부 / 판매가 0 → 허용
- 판매가 100억 이상 → `22003 numeric field overflow`
- 판매 상태 잘못된 값, 설명 2001자, 카테고리 앞뒤 공백 → 거부
- 이미지 경로: 중복, 하이픈 36개, 대문자 UUID, gif, `../` 경로 이탈 → 거부 / 정상 경로 → 허용
- 이미지 없는 상품 여러 개 (NULL 중복) → 허용

**4. 자동 계산·트리거**
- `is_low_stock`: 등록 시 계산, 재고를 수정하면 다시 계산, 직접 값을 넣으면 `428C9` 오류
- 수정 시 `updated_at` 자동 갱신
- 수정 요청에 `created_at`, `updated_at`, `id` 값을 넣어도 원래 값 유지
- 수정 충돌 검사: DB 문자열을 그대로 보내면 1행 수정됨

**5. 300개 제한** (단일 연결 기준)
- 1~300번째 등록 성공, 301번째 `P0001 PRODUCT_LIMIT_REACHED` + 한국어 hint
- 삭제 후 다시 등록 가능
- 298개 상태에서 한 문장으로 3행 등록 → **문장 전체 거부, 298개 유지** (여러 행을 한 번에 넣어도 한도를 넘지 않음)

**6. Storage**
- 버킷 설정값: public, 5242880 bytes, JPEG/PNG/WebP
- service_role: 사용량 함수가 파일 크기 합계를 정확히 계산 (1MB + 2MB = 3145728)

**7. 003 요청 제한 (선택)**
- 한도 2회: 1·2회 허용, 3회 거부
- 행동 그룹별로 따로 셈
- 잘못된 client_key 형식 거부

## ⚠️ 검증 중 발견한 사항 (앱에서 처리 필요)

| 발견 | 처리 |
|---|---|
| 판매가 `1.005`를 넣으면 DB가 **거부하지 않고 `1.01`로 반올림**해 저장 | zod에서 소수 셋째 자리 이상을 **거부** (명세에 이미 있는 규칙, 구현 시 테스트로 확인) |

## ⚪ 미검증

| 항목 | 이유 | 검증 방법 |
|---|---|---|
| `updated_at`을 JS `Date`로 바꾸면 수정 충돌이 잘못 나는 문제 | PGlite 시계가 밀리초 단위라 마이크로초가 생기지 않아 재현 불가 | Supabase 적용 후 실제 값 확인 (`updated_at::text`의 소수 자릿수) |
| anon의 storage.objects 접근 차단 | 테스트에서는 가짜 storage 스키마에 권한이 없어서 막혔을 뿐, 실제 차단 이유인 RLS를 검증한 것이 아님 | Supabase 적용 후 공개 키로 업로드·목록 조회 시도 |
| **동시성**: 300개 제한, 요청 제한 잠금 | PGlite는 연결이 1개뿐이라 동시 요청을 만들 수 없음 | 설계 근거는 PostgreSQL 문서 기준. 필요하면 Supabase에서 동시 요청 스크립트로 확인 |
| PostgreSQL 버전 차이 | 검증은 18.6, Supabase는 15 또는 17 | 사용한 기능(`gen_random_uuid`, generated column, advisory lock)은 모두 PG13+ 기능 → 적용할 때 확인 |
| Supabase 실제 권한 구성 | 실제 기본 권한, `service_role` 설정, storage 스키마 소유권은 흉내만 냄 | 적용 후 QA 보안 항목 |
| `storage.buckets` INSERT 권한 | Supabase SQL Editor 권한은 실제 환경에서만 확인 가능 | 실패하면 대시보드에서 버킷 생성 |
| 버킷의 5MB·형식 제한이 signed upload URL에도 적용되는지 | Storage 서버 기능 | QA 16·17번 |
| Storage 공개 URL 조회, signed upload URL 동작 | Storage 서버 기능 | Phase 5 |
| PostgREST(Supabase API)가 오류 코드를 그대로 전달하는지 (`23505`, `P0001`) | API 계층이 없음 | Phase 3 등록 기능 구현 시 확인 |

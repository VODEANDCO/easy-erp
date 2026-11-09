# Easy ERP 프로젝트 컨텍스트

> 이 문서는 개발자와 AI 도우미가 작업 전에 가장 먼저 읽는 기준 문서입니다.
> 범위, 데이터 구조, 처리 규칙이 바뀌면 이 문서를 먼저 고칩니다.

## 1. 현재 목표 (스프린트 미션 6)

미션 5의 Easy ERP 랜딩페이지와 Figma 디자인을 참고하여, **상품 관리 CRUD MVP**를 완성한다.

- 핵심: **등록 → 목록 → 상세 → 수정 → 삭제** 사이클을 안정적으로 동작시킨다.
- 별도 백엔드 서버 없이 **Next.js + Supabase**로 구성한다.
- 기존 `sprint-mission-5` 프로젝트는 **참고만** 하고 수정하지 않는다.
- 목표 범위: Phase 0 ~ Phase 7 (배포와 QA까지). 상세 체크리스트는 [mission-checklist.md](./mission-checklist.md)를 본다.

### 이번 미션에서 하지 않는 것

| 기능 | 처리 |
|---|---|
| 회원가입, 로그인, 사용자별 권한, 사업장 멤버십 | 미션 7 이후로 미룸 → [future/auth-organization.md](./future/auth-organization.md) |
| 사용자별 RLS 정책 | 구현하지 않음 (공개 키 직접 접근만 차단, 아래 4절 참고) |
| 주문, 재고 입출고, 인보이스, AI 발주, 대시보드 집계 | 사이드바에 **"준비 중"**으로만 표시하고, 동작하는 것처럼 보이게 하지 않음 |
| 다중 이미지 업로드 | Phase 8 심화 기능 |

## 2. 기술 스택

| 영역 | 선택 |
|---|---|
| 프레임워크 | Next.js 16 App Router, React 19, TypeScript |
| 스타일 | Tailwind CSS v4 + `app/globals.css` 디자인 토큰 |
| DB | Supabase PostgreSQL (`products` 테이블) |
| 파일 저장 | Supabase Storage (`product-images` 버킷) |
| 입력 검증 | zod (서버에서 반드시 검증, 브라우저 검증은 편의용) |
| 배포 | GitHub + Vercel |

## 3. 데이터 구조

### products

| 컬럼 | 타입 | 규칙 |
|---|---|---|
| id | uuid PK | DB 자동 생성 |
| name | text NOT NULL | 공백 제거 후 1~100자 |
| sku | text NOT NULL UNIQUE | 앞뒤 공백 제거 + 대문자 변환 후 저장, `A-Z 0-9 - _` 2~40자 |
| category | text | 앱에 정의된 카테고리 목록 중 하나 (DB는 1~50자만 검사 → 나중에 카테고리 테이블로 확장 가능) |
| price | numeric(12,2) NOT NULL | 0 이상, 소수 둘째 자리까지 |
| cost | numeric(12,2) | 선택, 0 이상 |
| stock_quantity | integer NOT NULL | 0 이상 정수 |
| safety_stock | integer NOT NULL | 0 이상 정수 |
| status | text NOT NULL | `active`(판매중) / `inactive`(판매중지), 기본 active |
| description | text | 선택, 2000자 이하 |
| image_path | text UNIQUE | 선택, `products/<uuid>.<jpg/png/webp>` 형식만 허용 |
| is_low_stock | boolean (자동 계산) | `stock_quantity <= safety_stock` |
| created_at | timestamptz | DB 자동 생성, 수정 불가 |
| updated_at | timestamptz | 수정 시 DB 트리거가 자동 갱신 |

SQL 초안: [supabase/drafts/001_products.sql](../supabase/drafts/001_products.sql)

### 재고 상태 표시 규칙 (화면에서 계산)

| 조건 | 뱃지 |
|---|---|
| stock_quantity = 0 | **품절** (danger) |
| 0 < stock_quantity ≤ safety_stock | **재고 부족** (warning) |
| stock_quantity > safety_stock | **정상** (neutral) |

판매 상태(판매중/판매중지)는 별도의 뱃지로 함께 표시합니다.

## 4. 보안 원칙 (인증 없는 데모 환경)

1. **DB 접근은 Next.js 서버에서만 한다.** 브라우저는 Supabase DB에 직접 요청하지 않는다.
2. **공개 키로 직접 접근하는 길은 막는다.** `products`는 RLS를 켜고 정책을 만들지 않으며, `anon`/`authenticated` 권한도 회수한다. 이것은 사용자별 접근 제어가 아니라 "기본 차단" 설정이다.
3. **secret 키는 서버 전용이다.** `SUPABASE_SECRET_KEY`에는 `NEXT_PUBLIC_` 접두사를 붙이지 않고, `server-only`로 보호된 파일에서만 읽는다.
4. **모든 쓰기는 서버에서 검증한다.** zod 검증 후 DB 제약조건이 한 번 더 막는다.
5. **공개 쓰기를 무제한으로 허용하지 않는다.** 평가자가 별도 코드 없이 테스트할 수 있어야 하므로 **데모 쓰기 코드는 쓰지 않는다** (결정됨).
   - 상품 최대 300개 (DB 트리거)
   - 이미지는 5MB, JPEG/PNG/WebP만 허용 (버킷 설정에서 강제). 업로드 후 서버가 파일 앞부분(매직 바이트)을 검사한다.
   - 버킷 전체 800MB를 넘으면 업로드 URL을 발급하지 않는다 (무료 플랜 1GB 보호)
   - IP 해시 기반 요청 횟수 제한 (도입 검토 중) → [003_demo_rate_limit.sql](../supabase/drafts/003_demo_rate_limit.sql)
6. **실제 개인정보나 사업 데이터는 저장하지 않는다.** 데모 상품 데이터만 사용한다.

### 요청 횟수 제한 기준 (초안)

| 행동 그룹 | 대상 | 한도 (IP당) |
|---|---|---|
| `product.write` | 등록, 수정 | 10분에 60회 |
| `product.delete` | 삭제 | 10분에 30회 |
| `image.upload` | 업로드 URL 발급 | 10분에 30회 |
| 조회 | 목록, 상세, 검색 | 제한 없음 |

- 처리 순서: **입력 검증 → 횟수 확인 → DB 저장**. 검증에서 실패한 요청은 횟수에 포함하지 않는다.
- 횟수 확인 자체가 실패하면 요청을 허용하고(fail-open) 서버 로그에 남긴다. 개수와 용량 한도가 최종 안전망이다.
- 한도를 넘으면 "요청이 너무 많습니다. 약 n분 후 다시 시도해 주세요"를 표시하고, 입력 내용은 유지한다.

## 5. 처리 규칙

- **목록 상태는 URL로 관리한다**: `/products?q=&category=&stock=low&sort=latest&page=1`. 잘못된 값은 기본값으로 바꾼다.
- **수정 충돌 방지**: 수정 폼은 불러온 시점의 `updated_at`을 함께 보낸다. 그 사이에 다른 곳에서 수정됐다면 덮어쓰지 않고 안내한다.
- **삭제는 실제 삭제(hard delete)**로 한다. 주문 기능이 생기면 보관(soft delete) 방식으로 바꾼다.
- **이미지 파일 정리**: DB 반영이 성공한 뒤에 이전 파일을 삭제한다. 자세한 내용은 [specs/storage.md](./specs/storage.md)를 본다.
- **데이터를 바꾸면 캐시를 갱신한다**: 등록, 수정, 삭제 후 상품 목록과 상세 캐시를 무효화한다.

## 6. 폴더 구조

```
app/
  (erp)/products/          목록 · new · [id] · [id]/edit
components/
  ui/                      Button, Input, Badge, Dialog, Toast, Skeleton, Pagination ...
  layout/                  Sidebar, Header, Breadcrumb
features/products/
  queries.ts               조회 (server-only)
  actions.ts               등록/수정/삭제/이미지 업로드 URL 발급 Server Action
  schema.ts                zod 규칙 (폼과 서버가 같이 사용)
  constants.ts             카테고리 목록, 페이지 크기
  components/              ProductTable, ProductForm, ProductFilters ...
lib/
  env.ts                   환경변수 검증
  supabase/admin.ts        secret 키 서버 클라이언트 (Phase 2에서 추가)
  supabase/{client,server,proxy}.ts   인증 단계용 (미션 7 이후 사용)
supabase/
  drafts/                  승인 전 SQL 초안 (DB에 적용되지 않음)
  migrations/              승인 후 적용할 SQL
docs/                      이 문서와 명세서
```

## 7. Next.js 16 주의사항

- `middleware.ts`의 이름이 **`proxy.ts`**로 바뀌었다. 이번 미션에서는 사용하지 않는다.
- `cacheComponents: true` 상태이다. `searchParams`, `cookies()` 같은 요청 시점 데이터를 읽는 부분은 `<Suspense>` 안에 둔다.
- `params`와 `searchParams`는 Promise이므로 `await`해서 쓴다.

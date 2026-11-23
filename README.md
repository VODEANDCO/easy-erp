# Easy ERP — 상품 관리 CRUD MVP (스프린트 미션 6)

소규모 사업장을 위한 ERP **Easy ERP**의 첫 기능인 **상품 관리**입니다.
상품 **등록 → 목록 → 상세 → 수정 → 삭제**를 별도 백엔드 서버 없이 **Next.js + Supabase**로 구현했습니다.

| 항목 | 링크 |
|---|---|
| GitHub | https://github.com/VODEANDCO/easy-erp (브랜치 `feature/product-crud`) |
| Vercel Preview | https://easy-f2oze5vj0-vodeandco.vercel.app/products |

> 배포 환경은 **테스트 전용 Supabase 프로젝트**에 연결된 Vercel Preview입니다.
> 로그인 기능이 아직 없어(미션 7 예정) Preview에서만 공개 데모 모드를 켰고, Production 배포는 하지 않았습니다.

---

## 1. 기술 스택

| 영역 | 사용 기술 |
|---|---|
| 프레임워크 | Next.js 16 (App Router, Server Actions), React 19, TypeScript |
| 스타일 | Tailwind CSS v4, `app/globals.css` 디자인 토큰 |
| DB | Supabase PostgreSQL (`products` 테이블) |
| 파일 저장 | Supabase Storage (`product-images` 버킷) |
| 입력 검증 | zod (폼과 서버가 같은 규칙 사용, 서버에서 반드시 검증) |
| 배포 | GitHub + Vercel |

## 2. 기능 명세

| 화면 | 경로 | 기능 |
|---|---|---|
| 상품 목록 | `/products` | 상품 표, 재고 상태 뱃지, 검색(상품명·SKU)·카테고리·재고 부족 필터·정렬·페이지네이션 (목록 상태는 URL 쿼리로 관리) |
| 상품 등록 | `/products/new` | 입력 검증(필수값, 원 단위 정수 가격, 0 이상 재고, SKU 형식·중복), 저장 후 상세로 이동 |
| 상품 상세 | `/products/[id]` | 모든 항목 표시, 없는 상품은 "상품을 찾을 수 없습니다" |
| 상품 수정 | `/products/[id]/edit` | 기존 값 불러오기, **수정 충돌 방지**(다른 곳에서 먼저 수정했으면 덮어쓰지 않고 안내) |
| 상품 삭제 | 상세 화면 | 확인 다이얼로그 후 삭제, 목록에서 즉시 제외 |
| 이미지 | 등록·수정 화면 | JPEG/PNG/WebP, 5MB 이하, 매직 바이트 검사, 교체·제거 — **배포 환경에서는 비활성화** (아래 5절) |

- 재고 상태: 재고 0 = **품절**, 재고 ≤ 안전재고 = **재고 부족**, 그 외 = **정상**
- 판매 상태: 판매중(`active`) / 판매중지(`inactive`)
- 사이드바의 주문·재고·인보이스 등은 **"준비 중"** 표시만 합니다.

## 3. Supabase 테이블 구조

### `products`

| 컬럼 | 타입 | 규칙 |
|---|---|---|
| id | uuid PK | 자동 생성 |
| name | text NOT NULL | 1~100자 |
| sku | text NOT NULL UNIQUE | 대문자로 저장, `A-Z 0-9 - _` 2~40자 |
| category | text | 앱에 정의된 카테고리 중 하나 |
| price | numeric(12,2) NOT NULL | 0 이상, 원 단위 정수 |
| cost | numeric(12,2) | 선택, 0 이상, 원 단위 정수 |
| stock_quantity | integer NOT NULL | 0 이상 |
| safety_stock | integer NOT NULL | 0 이상 |
| status | text NOT NULL | `active` / `inactive` (기본 `active`) |
| description | text | 선택, 2000자 이하 |
| image_path | text UNIQUE | 선택, `products/<uuid>.<jpg/png/webp>` |
| is_low_stock | boolean (자동 계산) | `stock_quantity <= safety_stock` |
| created_at / updated_at | timestamptz | 자동 생성 / 수정 시 트리거로 갱신 |

- 상품 최대 300개 (DB 트리거)
- SQL: [`supabase/migrations/`](./supabase/migrations/) — 001 상품 테이블, 002 이미지 버킷, 004 사업장·멤버십(미션 7용, 현재 미사용)

### 보안 설계 (로그인 없는 데모)

- 브라우저는 DB에 직접 접근하지 않습니다. 모든 조회·쓰기는 **Next.js 서버**가 secret 키로 처리합니다.
- `products`는 **RLS 활성화 + `anon`/`authenticated` 권한 회수** → 공개 키로 직접 조회하면 차단됩니다 (`401 42501` 확인).
- 모든 조회·Server Action은 DB 접근 전에 권한을 확인하며, 데모 모드가 꺼져 있으면 **모두 차단**됩니다 (fail-closed).
- secret 키는 `server-only` 파일에서만 읽고 `NEXT_PUBLIC_`을 붙이지 않습니다.

## 4. 실행 방법

```bash
npm install
cp .env.example .env.local   # 값 입력 (아래 환경변수 표)
# Supabase SQL Editor 에서 supabase/migrations/ 의 001 → 002 → 004 순서로 실행
npm run dev                  # http://localhost:3000/products
```

검사: `npx tsc --noEmit` · `npm run lint` · `npm run build`

### 환경변수 (이름만 · 값은 `.env.example` 설명 참고)

| 이름 | 위치 | 설명 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | 공개 | Supabase 프로젝트 주소 (`https://<20자 ref>.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | 공개 | Publishable 키 (DB 직접 접근은 막혀 있음) |
| `SUPABASE_SECRET_KEY` | **서버 전용** | 서버에서 상품 조회·쓰기에 사용 |
| `PRODUCTS_DEMO_MODE` | 서버 전용 | 정확히 `true`일 때만 로그인 없이 상품 기능 허용 (Preview만 `true`) |
| `PRODUCTS_IMAGE_UPLOAD_ENABLED` | 서버 전용 | 정확히 `true`일 때만 이미지 업로드 허용 (배포 환경 미설정 = 꺼짐) |
| `PRODUCTS_IMAGE_DISCARD_SECRET` | 서버 전용 | 저장 전 업로드 폐기 서명 키, 없으면 업로드 꺼짐 |

## 5. 이미지 업로드를 배포 환경에서 끈 이유

이미지 업로드 기능은 구현되어 있고 로컬 자동 QA(업로드·서버 검증·등록·교체·제거·저장 전 폐기·삭제 시 파일 정리)를 통과했습니다.
다만 **로그인 없는 공개 환경**에서는 아래 위험이 남아 있어, Vercel에는 업로드 환경변수를 설정하지 않았습니다 (업로드 꺼짐).

- 사용자 구분이 없어 누구나 파일을 올릴 수 있음
- 저장하지 않은 업로드 파일(고아 파일)의 자동 정리 기능 없음
- DB 연결 확인과 파일 삭제 사이의 동시성 위험 미해결

→ **배포 환경에서는 미검증**입니다. 미션 7(로그인·사업장 권한) 이후 다시 켜고 검증할 예정입니다.

## 6. QA 결과

### 배포 환경 (Vercel Preview · 테스트 Supabase · 2026-11-23, 실제 브라우저)

| 시나리오 | 결과 |
|---|---|
| 상품 등록 (판매가 15,000원, 원가 8,000원, 재고 100개, 안전재고 10개) | 통과 |
| 목록 조회 (등록 상품 표시) | 통과 |
| 상세 조회 (가격·재고 표시) | 통과 |
| 수정 (판매가 15,000원 → 18,000원, 재고 100개 → 80개) | 통과 |
| 삭제 (목록에서 사라짐) | 통과 |
| 이미지 업로드 | **미검증** (보안상 비활성화) |
| 검색·필터·정렬·페이지네이션 | 미검증 |

### 로컬 (자동 QA + 읽기 전용 DB 확인)

- 입력 검증, 중복 SKU, 등록·수정·삭제, 수정 충돌, 데모 모드 꺼짐 시 차단, 공개 키 직접 접근 차단, 이미지 업로드·교체·제거·폐기 등 통과
- 전체 시나리오와 미검증 항목: [docs/mission-checklist.md](./docs/mission-checklist.md#qa-결과표)

## 7. 알려진 제한과 다음 단계

- 로그인·사업장별 권한 없음 → **미션 7**에서 구현 후 Production 배포 ([docs/future/auth-organization.md](./docs/future/auth-organization.md))
- 이미지 업로드는 배포 환경에서 꺼져 있음 (5절)
- 검색·필터·페이지네이션, 등록·수정 Toast 화면 표시는 브라우저 검증 전
- 요청 횟수 제한은 선택 작업으로 보류

## 문서

- [프로젝트 컨텍스트](./docs/project-context.md) · [상품 기능 명세](./docs/specs/products.md) · [Storage 설계](./docs/specs/storage.md) · [Supabase 설정](./docs/setup-supabase.md) · [미션 체크리스트·QA](./docs/mission-checklist.md)

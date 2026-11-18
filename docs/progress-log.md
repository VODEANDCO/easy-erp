# 진행 기록 (세션 인계용)

> 다음 세션이 바로 이어서 시작할 수 있도록 현재 상태를 기록합니다.
> ⚠️ 이 문서에는 비밀번호, API 키, 환경변수의 실제 값을 절대 적지 않습니다. (변수 **이름**만 기록)

---

## 2026-11-18 세션

### Git 상태
- 브랜치 `feature/product-crud`, 원격보다 **커밋 5개 앞섬, Push 안 함**
  - `8c8d046` chore(db): SQL 004 + 미션 7용 SQL 005 초안
  - `d6cb5be` feat(products): 데모 모드 + 실제 DB 조회 (작업 1)
  - `be45687` feat(products): 상품 등록·수정·삭제를 실제 DB와 연결 (작업 2~4)
  - `b31b63f` docs: 작업 1~4 QA 결과, Supabase 적용 후 검증, 진행 기록
  - `ffbe88b` feat(products): 상품 이미지 업로드·서버 검증·표시 (Phase 5-A, 기능 파일 10개)
- 각 커밋 전 재검사: tsc·eslint·next build 통과, 커밋 대상과 브라우저 번들에 secret 값 0건
- Phase 5-A 문서 3개(`specs/storage.md`, `mission-checklist.md`, 이 문서) 갱신 → 문서 커밋 승인 대기

### DB·Storage 상태 (읽기 전용 확인, 2026-11-18)
- SQL 001·002·004 적용, **005 미적용** (`products.business_id` 컬럼 없음 확인). 005는 PGlite 사전 검증과 실제 DB 읽기 전용 사전 점검만 통과했고, 2026-11-12 결정으로 미션 7로 연기됨
- 상품 **3개**
  - `QA-TEA-001`, `QA-BODY-001`: 기존 상품, 이미지 없음, **변경 없음**
  - `QA-IMG-001`: Phase 5-A QA 로 추가, 이미지 `products/0f42f60c-d1a2-49c0-a724-140c4d40fbf2.png`(1×1 테스트 PNG) 연결
- Storage 파일 1개(`QA-IMG-001` 이미지), **미연결(고아) 파일 0개**, businesses 0행

### Phase 5-A 이미지 업로드
- 구현 완료: 업로드 허가 발급(서버가 경로 결정, 덮어쓰기 금지), 서버 검증(업로드 직후 + 등록 저장 시 매직 바이트·크기·존재), 등록 시 이미지 저장, 목록·상세 `next/image` 표시
- 업로드 제한: 업로드 스위치 `PRODUCTS_IMAGE_UPLOAD_ENABLED`(정확히 true, 기본 꺼짐), 미연결 파일 20개 상한(읽기 전용), 800MB 소프트 한도
- **서버 이미지 확인 무한 대기 해결**: 스트림 직접 읽기·`cancel()` 대기 제거, 범위 요청(206)만 읽기, Storage 단계별 시간 제한(fail-closed, 네트워크 오류로는 파일 삭제 안 함). 수정 후 확인 713~778ms
- 자동 QA: 안전 검사 37개 + 실제 업로드 QA 22개 + B-5 단계 확인 통과. 공개 키의 Storage 직접 업로드·덮어쓰기·삭제·목록 차단 확인
- 업로드 스위치는 검사 서버에만 임시 주입 (`.env.local` 변경 없음)
- **5-B 미착수**: 수정 시 이미지 교체·제거, 저장 전 폐기, 이미지가 있는 상품 삭제 QA(QA-27, `QA-IMG-001` 사용 예정)
- **고아 파일 자동 정리 미구현**

### 남은 확인 (완료로 표시하지 않음)
- 미확인: 삭제 성공 후 빨간 오류 안내 여부
- 미검증 (작업 1~4): 등록·수정 Toast 화면 표시, 수정 충돌 안내·[최신 내용 불러오기] 화면, 300개 한도 안내, 검색·필터·페이지네이션, 배포 환경 QA
- 미검증 (Phase 5-A): **브라우저 화면 QA 미완료**(5-B 이후 진행), 이미지 중복 제약 안내, 대체 읽기 방식(`info`+`download`), 시간 초과 처리, 미연결 파일 상한 도달, JPEG·WebP 실제 업로드, 네트워크 끊김, 이미지가 있는 상품 삭제(5-B 이월)
- 관찰: `/products` prerender 로그(`During prerendering, fetch() rejects…`) — 수정 전 빌드에서 2회 발생, 이후 6회 재발 없음. 발생 조건 미확정, 사용자 화면 영향은 관찰되지 않음

### 다음 순서
1. Phase 5-A 문서 커밋
2. 5-B 설계·구현 (이미지 교체·제거, 저장 전 폐기) → 브라우저 화면 QA (업로드 스위치는 터미널 환경변수로만 켬)
3. 배포 전 보안 점검 (`docs/mission-checklist.md` "공개 배포 전 필수 재검토")
4. GitHub Push 및 Vercel 배포 → 배포 환경 QA, README

---

## 2026-11-12 세션 종료 시점

> 아래 Git 상태는 2026-11-12 기준이다. 이후 작업 2~4가 `be45687`로 커밋되었다 (위 2026-11-18 절 참고).

### 1. Git 상태

- 브랜치: `feature/product-crud`
- 원격보다 **커밋 2개 앞섬, Push 안 함**
  - `8c8d046` chore(db): SQL 004(적용 완료) + 미션 7용 SQL 005 초안
  - `d6cb5be` feat(products): 명시적 데모 모드 + 실제 DB 조회 (작업 1)
- **미커밋 변경 8개 (작업 2~4, 커밋 승인 대기)**

| 상태 | 파일 | 관련 작업 |
|---|---|---|
| 수정 | `features/products/actions.ts` | 2·3·4 |
| 수정 | `lib/action-result.ts` | 2·3·4 |
| 수정 | `features/products/components/product-form.tsx` | 2·3 |
| 수정 | `features/products/components/delete-product-button.tsx` | 4 |
| 수정 | `app/(erp)/layout.tsx` | 2 (Toast 배치) |
| 수정 | `app/(erp)/products/new/page.tsx` | 2 |
| 수정 | `app/(erp)/products/[id]/edit/page.tsx` | 3 |
| 신규 | `components/ui/toast.tsx` | 2 (3·4 재사용) |
| 신규 | `docs/progress-log.md` (이 문서) | 기록 |

- 커밋 직전 점검 완료: tsc·eslint·next build 통과, 브라우저 번들 secret 0건, 변경 파일에 키 값·`console.log`·TODO·임시 경로 0건, `.env.local`은 git 무시 대상
- 추천 커밋 방식: **작업 2~4를 1개 커밋** (파일이 서로 얽혀 있어 나누면 검증하지 않은 중간 상태가 생김). 문서 갱신은 별도 커밋

### 2. 작업별 진행 상황

| 작업 | 내용 | 코드 | QA |
|---|---|---|---|
| 1. 조회 | 목록·상세 실제 DB 조회, 데모 모드 차단 | 커밋됨 | 완료 |
| 2. 등록 | `createProduct` 실제 INSERT, SKU 중복·300개 한도·DB 제약·일시 오류 안내, 성공 시 상세 이동 + Toast | 미커밋 | 자동 19개 통과 |
| 3. 수정 | `updateProduct`, `updated_at` 문자열 그대로 DB 비교(수정 충돌 방지), CONFLICT/NOT_FOUND 구분, image_path 수정 제외 | 미커밋 | 자동 17개 통과 |
| 4. 삭제 | `deleteProduct`, DB 먼저 삭제 → 성공 시에만 Storage 이미지 삭제(버킷·경로 제한, 사용 중이면 건너뜀, 실패는 로그) | 미커밋 | DB 검증 통과 |

공통: 모든 쓰기 Server Action이 `getBusinessAccess()`(데모 모드)를 먼저 확인. 성공 안내는 flash 쿠키(`easyerp_toast`, 60초, 정해진 값만) 기반 Toast.

### 3. Supabase 상태 (프로젝트: Easy-erp)

- SQL 적용: **001(products), 002(product-images 버킷), 004(사업장·멤버십) 적용**
- **005 미적용** (미션 7용 초안, `supabase/drafts/mission7/`). products에 데이터가 있으면 005는 스스로 중단됨 → 미션 7 시작 시 데모 데이터 삭제/이전 결정 필요
- 003(요청 횟수 제한)은 보류 (`supabase/drafts/optional/`)
- 현재 상품 데이터: **테스트 상품 2개** (모두 이미지 없음)
  - `QA-TEA-001` QA 테스트 녹차 티백 (수정 QA로 판매가 13,500 / 재고 25)
  - `QA-BODY-001` QA 테스트 바디로션 (사용자가 브라우저로 등록, 변경 이력 없음)
  - `QA-CUP-002`는 삭제 QA로 사용자가 브라우저에서 삭제함 (다시 등록하지 않기로 함)
- Storage `product-images` 버킷: 파일 0개

### 4. 데모 모드

- 서버 전용 환경변수 `PRODUCTS_DEMO_MODE`: **정확히 `true`일 때만** 상품 조회·등록·수정·삭제 허용, 그 외 값은 모두 차단
- 로컬 `.env.local`에는 `true`로 설정되어 있음 (값 외 다른 키는 이 문서에 기록하지 않음)
- 사용하는 환경변수 이름: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`(서버 전용), `PRODUCTS_DEMO_MODE`(서버 전용)

### 5. QA 결과

**통과 (자동 QA, 앱의 Server Action으로만 실행)**
- 등록: 입력값 오류 7종, 정상 등록 2건, SKU 중복(같은 값·대소문자만 다름), DB 저장값, 목록·상세 반영, 새로고침 유지, Toast 쿠키
- 수정: 데모 차단, 입력값 오류, 정상 수정, 수정일 갱신·등록일 유지, ID·이미지 경로 유지, 상세·목록 반영, 수정 충돌(CONFLICT, 덮어쓰지 않음), 소수점 5자리로 보이는 `updated_at`으로 수정, SKU 중복
- 삭제: 데모 차단, ID 오류·없는 ID 처리, 실제 삭제(사용자 브라우저), 3→2개, 나머지 상품 전체 컬럼 유지, Storage 변화 없음, 삭제된 상품 상세·수정 페이지 "찾을 수 없음", 재삭제 "이미 삭제됨", 삭제된 상품 수정 저장 NOT_FOUND
- 브라우저(사용자 확인): 삭제 확인 창 취소/확인, 삭제 후 목록 이동, 삭제 Toast
- `updated_at` 실제 저장 정밀도: **마이크로초(6자리)**. DB 출력은 끝자리 0을 생략하므로 5자리로 보일 수 있음 → JavaScript Date로 변환 금지

**미검증 / 미확인**
- 등록 Toast·수정 Toast 브라우저 표시 (사용자 확인 예정, 결과 미보고)
- 수정 충돌 화면: 안내, [최신 내용 불러오기] 확인 창, 최신 값 표시 (서버 판정은 통과)
- 삭제 성공 후 빨간 오류 안내 여부: **미확인** (코드 분석상 나올 경로 없음. 재확인하려면 새 테스트 상품 필요)
- 이미지 파일 실제 삭제, 공유 이미지 건너뛰기, 삭제 실패 시 `orphan` 로그 (업로드 기능 이후)
- 300개 한도 안내 (상품 300개 필요)
- 실제 네트워크 끊김 시 안내

### 6. 다음 작업 순서

1. **Git 커밋 준비**: 작업 2~4 커밋(추천: 1개, 메시지 초안은 2026-11-12 대화에 있음) → `docs/mission-checklist.md`·`docs/sql-verification.md` 갱신 후 별도 커밋
2. **이미지 업로드** (`docs/specs/storage.md` 설계 기준)
   - 업로드 주소 발급 Action(데모 모드 확인), 업로드 화면, 저장 시 파일 존재·매직 바이트 재검사
   - 등록이 검증된 image_path를 받도록 변경, 수정 시 이미지 교체·제거(DB 먼저 → 이전 파일 삭제)
   - 이미지 표시(`product-image.tsx` TODO), `next.config.ts`에 `images.remotePatterns`
   - 경로 생성 로직은 한 곳에 모으기 (미션 7의 SQL 005가 `<business_id>/products/…`로 바꿈)
   - 추가 SQL은 필요 없을 것으로 예상 (002 적용됨) — 설계 시 재확인
3. **배포 전 보안 점검** (`docs/mission-checklist.md` "공개 배포 전 필수 재검토" 항목)
   - 요청 횟수 제한(003) 도입 여부, 업로드 악용·고아 파일·800MB 소프트 한도
   - 모든 Server Action의 접근 확인, 배포 번들 secret 재검사, Vercel 환경변수 이름(`NEXT_PUBLIC_` 금지), 긴급 차단 절차
4. **GitHub Push 및 Vercel 배포** → 배포 환경 전체 QA(QA-21), README

### 7. 작업 규칙 (사용자 요청)

- 파일 수정, SQL 실행, DB 데이터 변경, 커밋, Push는 **항상 사전 승인** 후 진행
- SQL은 사용자가 Supabase SQL Editor에서 직접 실행
- 비밀 키·토큰 값은 출력·기록하지 않음
- 테스트 데이터는 `QA-` SKU만 사용하고, 임의로 삭제하지 않음
- 보고는 한국어로, 단계별로

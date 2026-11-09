# Easy ERP 아키텍처 메모

## 기술 스택 (승인됨)

| 영역 | 선택 |
|---|---|
| 프레임워크 | Next.js 16 App Router, React 19, TypeScript |
| 스타일 | Tailwind CSS v4 + `app/globals.css` 디자인 토큰 |
| DB / 인증 | Supabase (PostgreSQL + Supabase Auth + RLS) |
| 입력 검증 | zod |
| 재고 변경 | PostgreSQL 함수(RPC) 안에서 트랜잭션으로 처리 |
| AI 발주 제안 | 1차: 규칙 기반 계산 (Claude API 미연동) |

## 폴더 구조

```
app/
  (marketing)/        랜딩 페이지                       ← 이후 단계
  (auth)/             로그인, 회원가입, 온보딩           ← 1단계
  (erp)/              로그인 후 ERP 화면 (사이드바 레이아웃)
components/
  ui/                 Button, Input, Table 같은 공통 부품 (디자인 토큰만 사용)
  layout/             Sidebar, Topbar, PageHeader
features/
  <도메인>/           products, orders, inventory, invoices ...
    queries.ts        조회 (서버 전용)
    actions.ts        등록/수정 Server Action
    schema.ts         zod 입력 규칙
    components/       해당 기능 전용 화면 부품
lib/
  env.ts              환경변수 검증
  supabase/
    client.ts         브라우저용 클라이언트
    server.ts         서버용 클라이언트 (server-only)
    proxy.ts          세션 갱신 헬퍼 (1단계에서 루트 proxy.ts 에 연결)
supabase/
  migrations/         DB 스키마 SQL (버전 관리, 승인 후 적용)
docs/                 설계 문서
```

## 보안 원칙

1. **businessId는 클라이언트에서 받지 않는다.** 서버가 로그인 세션 + 멤버십으로 결정한다.
2. **모든 업무 테이블에 RLS를 켠다.** 앱 코드에 실수가 있어도 DB가 다른 사업장 데이터를 막는다.
3. **Secret(service_role) 키는 사용하지 않는다.** 필요해지면 별도 승인 후 서버 전용으로 추가한다.
4. **재고는 DB 함수 하나에서만 바꾼다.** 상태 조건부 UPDATE + 재고 `>=` 조건 + UNIQUE 제약으로 중복 출고와 마이너스 재고를 막는다.
5. **proxy.ts는 로그인 여부만 대략 확인한다.** 실제 권한 검사는 서버(DAL)와 RLS가 한다.

## Next.js 16 주의사항

- `middleware.ts` → **`proxy.ts`** 로 이름이 바뀌었다.
- `cacheComponents: true` 상태이므로 `cookies()`를 읽는 컴포넌트(= Supabase 서버 클라이언트 사용)는 `<Suspense>` 안에 둬야 한다.
- `cookies()`, `headers()`, `params` 는 모두 `await` 해야 한다.

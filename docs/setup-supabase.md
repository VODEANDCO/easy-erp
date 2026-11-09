# Supabase 연결 가이드 (미션 6 기준)

> 프로젝트 생성과 키 입력은 **프로젝트 담당자가 직접** 진행합니다.
> 키 값은 채팅, 스크린샷, GitHub 어디에도 붙여넣지 않습니다.

## 1. 가입과 조직 만들기
1. https://supabase.com → **Start your project** (GitHub 계정 로그인 추천)
2. 조직(Organization) 만들기: Type **Personal**, Plan **Free**
3. 결제 카드 입력 화면이 나오면 진행하지 않습니다.

## 2. 프로젝트 만들기
1. **New project**를 누릅니다.
2. 이름: `easy-erp`, 지역: **Northeast Asia (Seoul)**
3. DB 비밀번호: **Generate a password**로 만든 뒤 비밀번호 관리자에 저장합니다.
4. 요금제가 **Free**인지 확인합니다.
5. 생성이 끝날 때까지 1~2분 기다립니다.

## 3. 환경변수 설정
```bash
cp .env.example .env.local
```
Supabase 대시보드 → **Project Settings → API Keys**에서 값을 복사합니다.

| 변수 | 위치 | 노출 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL | 공개 가능 |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key (`sb_publishable_...`) | 공개 가능 |
| `SUPABASE_SECRET_KEY` | Secret keys (`sb_secret_...`) | **서버 전용, 절대 비공개** |

## 4. DB 스키마 적용 (SQL 승인 후)
- 초안: `supabase/drafts/*.sql` → 승인되면 `supabase/migrations/`로 옮깁니다.
- 적용 방법 (택1)
  - 대시보드 **SQL Editor**에 파일 내용을 붙여넣고 Run (초보자 추천)
  - Supabase CLI: `npx supabase link` → `npx supabase db push`
- 적용 확인: Table Editor에 `products`가 보이고, Storage에 `product-images` 버킷이 보이면 성공입니다.

## 5. Vercel 배포 시
Vercel 프로젝트 → Settings → Environment Variables에 위 3개(선택 항목 포함)를 같은 이름으로 등록합니다.

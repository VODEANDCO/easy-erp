# Supabase 연결 가이드

> ⚠️ 아래 1~3번은 **외부 서비스 생성과 비밀값 입력**이 포함되어 있어,
> 프로젝트 담당자의 승인 후에 진행합니다. 코드 쪽 준비는 이미 끝나 있습니다.

## 1. Supabase 프로젝트 만들기 (무료 플랜)

1. https://supabase.com 에 로그인 → **New project**
2. 이름: `easy-erp` / 지역: **Northeast Asia (Seoul)** 권장
3. DB 비밀번호는 비밀번호 관리자에 저장 (코드나 채팅에 붙여넣지 않기)
4. 요금제가 **Free** 인지 확인

## 2. 환경변수 설정

```bash
cp .env.example .env.local
```

Supabase 대시보드 → **Project Settings → API Keys** 에서 복사:

| 변수 | 위치 |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key (`sb_publishable_...`) — 구버전 화면에서는 `anon` key |

`.env.local` 은 git에 올라가지 않습니다. Vercel 배포 시에는 Vercel 프로젝트 설정의 Environment Variables 에 따로 입력합니다.

## 3. 인증 설정 (1단계에서 함께 진행)

- Authentication → Providers → **Email** 활성화
- Authentication → URL Configuration → Site URL: `http://localhost:3000`

## 4. DB 스키마 적용 방식

- 테이블·RLS·함수는 `supabase/migrations/*.sql` 파일로 작성해 **코드 리뷰 후** 적용합니다.
- 적용 방법(택1, 승인 후):
  - Supabase CLI: `npx supabase link` → `npx supabase db push`
  - 또는 대시보드 SQL Editor 에 파일 내용을 붙여넣어 실행
- 적용 후 타입 생성: `npx supabase gen types typescript --linked > lib/supabase/database.types.ts`

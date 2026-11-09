import { createBrowserClient } from "@supabase/ssr";
import { getPublicEnv } from "@/lib/env";

/**
 * 브라우저(Client Component)용 Supabase 클라이언트
 *
 * - 'use client' 컴포넌트 안에서만 사용합니다.
 * - 로그인 세션은 쿠키에 저장되어 서버와 공유됩니다.
 * - 데이터 접근 권한은 DB의 RLS 정책이 최종적으로 검사합니다.
 */
export function createClient() {
  const env = getPublicEnv();
  return createBrowserClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}

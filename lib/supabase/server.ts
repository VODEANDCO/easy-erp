import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { getPublicEnv } from "@/lib/env";

/**
 * 서버(Server Component, Server Action, Route Handler)용 Supabase 클라이언트
 *
 * - 요청마다 새로 만들어야 합니다. (다른 사용자와 세션이 섞이지 않도록)
 * - 로그인한 사용자의 쿠키를 그대로 사용하므로 RLS 정책이 자동 적용됩니다.
 * - cacheComponents 가 켜져 있으므로, 이 함수를 호출하는 컴포넌트는
 *   <Suspense> 경계 안에 있어야 합니다. (cookies()는 요청 시점 데이터)
 */
export async function createClient() {
  const env = getPublicEnv();
  const cookieStore = await cookies();

  return createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Component 에서는 쿠키를 쓸 수 없어 에러가 납니다.
            // 세션 갱신은 proxy.ts 가 담당하므로 여기서는 무시해도 안전합니다.
          }
        },
      },
    },
  );
}

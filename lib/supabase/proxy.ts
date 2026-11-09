import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getPublicEnv } from "@/lib/env";

/**
 * proxy.ts(예전 middleware)에서 호출할 세션 갱신 함수
 *
 * ⚠️ 0단계에서는 "준비"만 해두고, 루트의 proxy.ts 에는 아직 연결하지 않았습니다.
 *    1단계(인증)에서 연결합니다.
 *
 * 역할:
 * 1) 만료된 로그인 토큰을 새로 고쳐 쿠키에 다시 저장
 * 2) 로그인 여부(claims)를 돌려줘서 /login 리다이렉트 판단에 사용
 *
 * 주의: 여기서는 "로그인 했는가"만 대략 확인합니다.
 *       "이 사업장 데이터에 접근 가능한가"는 서버 DAL + RLS 가 검사합니다.
 */
export async function updateSession(request: NextRequest) {
  const env = getPublicEnv();
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          // 인증 쿠키가 담긴 응답이 CDN에 캐시되지 않도록 하는 헤더
          Object.entries(headers).forEach(([key, value]) =>
            response.headers.set(key, value),
          );
        },
      },
    },
  );

  // getClaims(): JWT 서명을 검증하므로 getSession()보다 안전합니다.
  // createServerClient 와 이 호출 사이에 다른 코드를 넣지 마세요.
  const { data } = await supabase.auth.getClaims();

  return { response, claims: data?.claims ?? null };
}

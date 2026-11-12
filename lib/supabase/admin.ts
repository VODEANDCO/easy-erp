import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getPublicEnv } from "@/lib/env";

/**
 * secret 키(service_role)로 접속하는 서버 전용 Supabase 클라이언트
 *
 * - `server-only` 때문에 브라우저용 코드('use client')에서 import 하면 빌드가 실패합니다.
 * - secret 키는 RLS를 건너뛰므로, 이 클라이언트를 쓰는 코드는
 *   **반드시 먼저 접근 권한을 확인**해야 합니다. (lib/auth/business-access.ts)
 * - 환경변수 이름에 NEXT_PUBLIC_ 을 붙이지 않습니다. (브라우저 코드에 삽입되지 않도록)
 * - 로그인 세션을 저장하지 않는 "상태 없는" 클라이언트라 요청 간에 재사용해도 안전합니다.
 */

const secretKeySchema = z
  .string({ error: "SUPABASE_SECRET_KEY 가 비어 있습니다." })
  .regex(/^sb_secret_[A-Za-z0-9_-]+$/, "SUPABASE_SECRET_KEY 형식이 올바르지 않습니다. (sb_secret_ 으로 시작해야 합니다)");

let adminClient: SupabaseClient | null = null;

export function createAdminClient(): SupabaseClient {
  if (adminClient) return adminClient;

  const secretKey = secretKeySchema.safeParse(process.env.SUPABASE_SECRET_KEY);
  if (!secretKey.success) {
    // 오류 문구에 키 값을 넣지 않습니다.
    throw new Error(
      `[환경변수 오류] ${secretKey.error.issues[0]?.message ?? "SUPABASE_SECRET_KEY 를 확인하세요."} (.env.local 참고)`,
    );
  }

  const { NEXT_PUBLIC_SUPABASE_URL } = getPublicEnv();
  adminClient = createClient(NEXT_PUBLIC_SUPABASE_URL, secretKey.data, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  return adminClient;
}

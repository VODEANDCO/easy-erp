import "server-only";
import dns from "node:dns";
import type { LookupFunction } from "node:net";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Agent, fetch as undiciFetch } from "undici";
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

// ── 주소 조회 대체 경로 (ISSUE-4) ─────────────────────────────────────────
// Vercel 실행 환경에서 OS 주소 조회(getaddrinfo)가 EBUSY 로 실패해 Supabase 요청이 "fetch failed" 가 되는 문제 대응.
// - 평소에는 OS 조회(dns.lookup)를 그대로 씁니다. (로컬·정상 환경의 동작은 바뀌지 않음)
// - EBUSY / EAI_AGAIN 일 때만 Node 자체 DNS 조회(dns.resolve4 / resolve6: OS 를 거치지 않고 DNS 서버에 직접 질의)로 한 번 더 시도합니다.
// - 대체 조회도 실패하면 "원래 오류"를 그대로 돌려줍니다. → 기존처럼 조회 실패로 처리됨 (오류를 숨기지 않음)
// - 접속은 여전히 호스트 이름 기준이라 TLS 인증서 검증(SNI·인증서 호스트 확인)은 그대로입니다.

const FALLBACK_CODES = new Set(["EBUSY", "EAI_AGAIN"]);
let fallbackLogged = false;

type Resolved = { address: string; family: 4 | 6 };

/** Node 자체 DNS 조회. family 가 4/6 이면 그 종류만, 0 이면 IPv4 → IPv6 순으로 시도 */
function resolveDirect(hostname: string, family: number, done: (list: Resolved[]) => void) {
  const v4 = (next: () => void) =>
    dns.resolve4(hostname, (err, addrs) => (!err && addrs.length ? done(addrs.map((address) => ({ address, family: 4 }))) : next()));
  const v6 = (next: () => void) =>
    dns.resolve6(hostname, (err, addrs) => (!err && addrs.length ? done(addrs.map((address) => ({ address, family: 6 }))) : next()));
  const none = () => done([]);
  if (family === 4) return v4(none);
  if (family === 6) return v6(none);
  v4(() => v6(none));
}

/**
 * net/tls 의 lookup 자리에 넣는 함수 (dns.lookup 과 같은 호출·콜백 형식)
 * - options.all = true  → callback(null, [{ address, family }, ...])
 * - options.all = false → callback(null, address, family)
 */
export const lookupWithFallback: LookupFunction = (hostname, options, callback) => {
  dns.lookup(hostname, options, (err, address, family) => {
    if (!err) return callback(null, address, family);
    if (!FALLBACK_CODES.has(err.code ?? "")) return callback(err, "", undefined);

    resolveDirect(hostname, options.family === 4 || options.family === 6 ? options.family : 0, (list) => {
      if (list.length === 0) return callback(err, "", undefined); // 대체 조회 실패 → 원래 오류 그대로
      if (!fallbackLogged) {
        fallbackLogged = true;
        console.info("[supabase] OS 주소 조회 실패로 대체 DNS 조회 사용", { reason: err.code });
      }
      if (options.all) return callback(null, list);
      callback(null, list[0].address, list[0].family);
    });
  });
};

/** Supabase 서버 클라이언트 전용 연결 관리자 (주소 조회만 lookupWithFallback 으로 바꿈) */
const supabaseDispatcher = new Agent({ connect: { lookup: lookupWithFallback } });

/** supabase-js 에 넘기는 fetch: undici fetch + 위 연결 관리자. 요청·응답 처리는 표준 fetch 와 같습니다. */
const supabaseFetch: typeof fetch = (input, init) =>
  undiciFetch(input as Parameters<typeof undiciFetch>[0], {
    ...(init as Parameters<typeof undiciFetch>[1]),
    dispatcher: supabaseDispatcher,
  }) as unknown as Promise<Response>;

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
    global: { fetch: supabaseFetch },
  });
  return adminClient;
}

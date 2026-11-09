import { z } from "zod";

/**
 * 공개 환경변수 검증
 *
 * - NEXT_PUBLIC_ 값은 빌드할 때 코드에 그대로 삽입되므로
 *   반드시 `process.env.NEXT_PUBLIC_XXX` 형태로 "직접" 적어야 합니다.
 *   (process.env[name] 처럼 동적으로 읽으면 브라우저에서 undefined 가 됩니다.)
 * - 값이 없거나 형식이 틀리면 원인을 알려주는 에러를 던집니다.
 */
const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url({
    error: "NEXT_PUBLIC_SUPABASE_URL 이 비어 있거나 URL 형식이 아닙니다.",
  }),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z
    .string({ error: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY 가 비어 있습니다." })
    .min(1, "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY 가 비어 있습니다."),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;

let cached: PublicEnv | null = null;

/**
 * Supabase 연결 정보 가져오기.
 * 앱이 시작될 때가 아니라 "처음 사용할 때" 검사하므로,
 * .env.local 이 없어도 Supabase 를 쓰지 않는 페이지는 정상 동작합니다.
 */
export function getPublicEnv(): PublicEnv {
  if (cached) return cached;

  const result = publicEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });

  if (!result.success) {
    const messages = result.error.issues.map((issue) => `- ${issue.message}`);
    throw new Error(
      `[환경변수 오류] .env.local 설정을 확인하세요 (.env.example 참고)\n${messages.join("\n")}`,
    );
  }

  cached = result.data;
  return cached;
}

/** 환경변수가 설정되어 있는지 여부만 확인 (에러를 던지지 않음) */
export function hasSupabaseEnv(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}

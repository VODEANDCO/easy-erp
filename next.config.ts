import type { NextConfig } from "next";

/**
 * 상품 이미지(Supabase Storage 공개 버킷)만 next/image 최적화를 허용합니다.
 * - 허용 범위를 "내 Supabase 주소 + product-images 버킷 공개 경로"로 좁혀,
 *   이 서버가 아무 외부 이미지나 변환해 주는 프록시가 되지 않게 합니다.
 * - 버킷 전체(`product-images/**`)를 허용해, 미션 7에서 경로 구조가 바뀌어도 설정을 바꾸지 않아도 됩니다.
 * - 주소는 빌드 시 NEXT_PUBLIC_SUPABASE_URL 에서 계산합니다. 값이 없거나 형식이 틀리면 빌드를 멈춥니다.
 */
function supabaseImagePattern(): URL {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!raw) {
    throw new Error("[next.config] NEXT_PUBLIC_SUPABASE_URL 이 없습니다. (.env.example 참고)");
  }
  let origin: string;
  try {
    origin = new URL(raw).origin;
  } catch {
    throw new Error("[next.config] NEXT_PUBLIC_SUPABASE_URL 형식이 올바르지 않습니다.");
  }
  return new URL(`${origin}/storage/v1/object/public/product-images/**`);
}

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
  images: {
    remotePatterns: [supabaseImagePattern()],
    // 원본 이미지는 버킷 한도(5MB)를 넘을 수 없으므로 가져오는 크기도 같게 제한합니다. (기본 50MB)
    maximumResponseBody: 5_242_880,
    // 품질은 Next.js 16 기본값(75)만 허용합니다. 변환 조합을 늘리지 않기 위해 명시해 둡니다.
    qualities: [75],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

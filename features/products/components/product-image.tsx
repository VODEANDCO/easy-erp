"use client";

import Image from "next/image";
import { useState } from "react";
import { ImageIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { getPublicEnv } from "@/lib/env";
import { PRODUCT_IMAGE_STORAGE } from "../constants";
import { IMAGE_PATH_PATTERN } from "../schema";

/**
 * 상품 이미지 (없거나 불러오지 못하면 기본 플레이스홀더)
 *
 * - 공개 버킷의 공개 URL 을 next/image 로 최적화해 보여줍니다.
 *   허용 주소는 next.config.ts 의 images.remotePatterns (내 Supabase 버킷 경로만)
 * - 경로 형식이 올바르지 않으면 URL 을 만들지 않습니다.
 * - 공개 URL 은 주소를 아는 누구나 볼 수 있으므로 데모 이미지만 사용합니다.
 */

function publicImageUrl(imagePath: string): string | null {
  if (!IMAGE_PATH_PATTERN.test(imagePath)) return null; // 미션 7: 사업장 경로 규칙과 함께 변경
  const base = getPublicEnv().NEXT_PUBLIC_SUPABASE_URL.replace(/\/+$/, "");
  return `${base}/storage/v1/object/public/${PRODUCT_IMAGE_STORAGE.bucket}/${imagePath}`;
}

export function ProductImage({
  imagePath,
  name,
  size = "sm",
  className,
}: {
  imagePath?: string | null;
  name: string;
  size?: "sm" | "lg";
  className?: string;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const src = imagePath ? publicImageUrl(imagePath) : null;
  const frame = cn(
    "relative flex shrink-0 items-center justify-center overflow-hidden border border-line bg-surface-muted text-ink-muted",
    size === "sm" ? "size-10 rounded-control" : "aspect-square w-full rounded-card",
    className,
  );

  if (!src || failedSrc === src) {
    return (
      <div role="img" aria-label={`${name} 이미지 없음`} className={frame}>
        <ImageIcon size={size === "sm" ? 16 : 40} />
      </div>
    );
  }

  return (
    <div className={frame}>
      <Image
        src={src}
        alt={`${name} 이미지`}
        fill
        sizes={size === "sm" ? "40px" : "(min-width: 1024px) 320px, 100vw"}
        className="object-cover"
        onError={() => setFailedSrc(src)}
      />
    </div>
  );
}

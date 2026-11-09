import { ImageIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";

/**
 * 상품 이미지 자리
 *
 * 지금은 Storage 연결 전이라 항상 기본 플레이스홀더를 보여줍니다.
 * TODO(Phase 5): image_path 가 있으면 공개 URL을 만들어 next/image 로 표시하고,
 *                next.config 의 images.remotePatterns 에 Supabase 도메인을 등록합니다.
 */
export function ProductImage({
  name,
  size = "sm",
  className,
}: {
  imagePath?: string | null;
  name: string;
  size?: "sm" | "lg";
  className?: string;
}) {
  return (
    <div
      role="img"
      aria-label={`${name} 이미지 없음`}
      className={cn(
        "flex shrink-0 items-center justify-center border border-line bg-surface-muted text-ink-muted",
        size === "sm" ? "size-10 rounded-control" : "aspect-square w-full rounded-card",
        className,
      )}
    >
      <ImageIcon size={size === "sm" ? 16 : 40} />
    </div>
  );
}

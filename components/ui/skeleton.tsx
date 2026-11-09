import { cn } from "@/lib/cn";

/** 불러오는 중 자리 표시. 화면 읽기 프로그램에는 상위 요소의 "불러오는 중" 안내만 읽히게 합니다. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn("animate-pulse rounded-control bg-surface-sunken", className)} />
  );
}

/** 상위 컨테이너에 붙이는 접근성 안내 (시각적으로는 숨김) */
export function LoadingLabel({ children = "불러오는 중입니다" }: { children?: string }) {
  return (
    <span role="status" className="sr-only">
      {children}
    </span>
  );
}

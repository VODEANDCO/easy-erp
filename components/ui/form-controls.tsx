import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * 입력 컴포넌트
 * - invalid 이면 빨간 테두리 + aria-invalid
 * - 라벨·오류 문구 연결은 <Field> 가 담당합니다.
 */

const control =
  "w-full rounded-control border bg-surface text-sm text-ink placeholder:text-ink-muted transition-colors " +
  "hover:border-ink-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 " +
  "disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-ink-muted";

const stateClass = (invalid?: boolean) =>
  invalid
    ? "border-danger hover:border-danger focus:border-danger focus:ring-danger/20"
    : "border-line-strong";

type WithInvalid = { invalid?: boolean };

export function Input({ invalid, className, ...props }: ComponentProps<"input"> & WithInvalid) {
  return (
    <input
      aria-invalid={invalid || undefined}
      className={cn(control, stateClass(invalid), "h-10 px-3", className)}
      {...props}
    />
  );
}

export function Textarea({
  invalid,
  className,
  ...props
}: ComponentProps<"textarea"> & WithInvalid) {
  return (
    <textarea
      aria-invalid={invalid || undefined}
      className={cn(control, stateClass(invalid), "min-h-28 px-3 py-2 leading-relaxed", className)}
      {...props}
    />
  );
}

export function Select({ invalid, className, ...props }: ComponentProps<"select"> & WithInvalid) {
  return (
    <select
      aria-invalid={invalid || undefined}
      className={cn(control, stateClass(invalid), "h-10 cursor-pointer pr-8 pl-3", className)}
      {...props}
    />
  );
}

/** 입력칸 오른쪽에 단위("원", "개")를 붙이는 래퍼 */
export function InputWithSuffix({ suffix, children }: { suffix: ReactNode; children: ReactNode }) {
  return (
    <div className="relative">
      {children}
      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-ink-muted">
        {suffix}
      </span>
    </div>
  );
}

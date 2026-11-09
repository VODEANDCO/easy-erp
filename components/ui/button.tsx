import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Spinner } from "./icons";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

const base =
  "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-control font-medium transition-colors " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent " +
  "disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50";

const variants: Record<Variant, string> = {
  primary: "bg-brand text-ink-inverse hover:bg-brand-hover disabled:hover:bg-brand",
  secondary:
    "border border-line-strong bg-surface text-ink hover:bg-surface-muted disabled:hover:bg-surface",
  ghost: "text-ink-secondary hover:bg-surface-sunken hover:text-ink disabled:hover:bg-transparent",
  danger: "bg-danger text-ink-inverse hover:bg-danger/90 disabled:hover:bg-danger",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px]",
  md: "h-10 px-4 text-sm",
};

export function buttonClass({
  variant = "primary",
  size = "md",
  className,
}: { variant?: Variant; size?: Size; className?: string } = {}) {
  return cn(base, variants[variant], sizes[size], className);
}

type ButtonProps = ComponentProps<"button"> & {
  variant?: Variant;
  size?: Size;
  /** true 면 스피너를 보여주고 버튼을 비활성화합니다 (중복 제출 방지) */
  loading?: boolean;
  loadingText?: ReactNode;
};

export function Button({
  variant,
  size,
  loading = false,
  loadingText,
  disabled,
  className,
  children,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClass({ variant, size, className })}
      {...props}
    >
      {loading && <Spinner size={14} />}
      {loading && loadingText ? loadingText : children}
    </button>
  );
}

type LinkButtonProps = ComponentProps<typeof Link> & { variant?: Variant; size?: Size };

/** 버튼 모양의 링크 (페이지 이동은 button 대신 a 를 써야 접근성에 맞음) */
export function LinkButton({ variant, size, className, ...props }: LinkButtonProps) {
  return <Link className={buttonClass({ variant, size, className })} {...props} />;
}

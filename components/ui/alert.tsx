import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { AlertIcon, InfoIcon } from "./icons";

type Tone = "info" | "warning" | "danger";

const tones: Record<Tone, string> = {
  info: "border-info/25 bg-info-soft text-info",
  warning: "border-warning/25 bg-warning-soft text-warning",
  danger: "border-danger/25 bg-danger-soft text-danger",
};

/**
 * 안내 상자. 폼 제출 결과처럼 새로 나타나는 메시지에는 live 를 지정해
 * 화면 읽기 프로그램이 바로 읽도록 합니다.
 */
export function Alert({
  tone = "info",
  title,
  children,
  live,
  className,
}: {
  tone?: Tone;
  title?: ReactNode;
  children?: ReactNode;
  live?: "polite" | "assertive";
  className?: string;
}) {
  const Icon = tone === "info" ? InfoIcon : AlertIcon;
  return (
    <div
      role={live === "assertive" ? "alert" : live === "polite" ? "status" : undefined}
      className={cn("flex gap-2.5 rounded-control border px-3.5 py-3 text-[13px]", tones[tone], className)}
    >
      <Icon size={16} className="mt-px shrink-0" />
      <div className="min-w-0 space-y-0.5">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className="text-ink-secondary">{children}</div>}
      </div>
    </div>
  );
}

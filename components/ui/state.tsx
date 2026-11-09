import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { AlertIcon, BoxIcon } from "./icons";

/** 빈 상태 / 오류 상태 공통 틀 */
function StateBlock({
  icon,
  title,
  description,
  action,
  tone,
  role,
  className,
}: {
  icon: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  tone: "neutral" | "danger";
  role?: "alert";
  className?: string;
}) {
  return (
    <div
      role={role}
      className={cn("flex flex-col items-center justify-center px-6 py-16 text-center", className)}
    >
      <div
        className={cn(
          "mb-4 flex size-12 items-center justify-center rounded-full",
          tone === "danger" ? "bg-danger-soft text-danger" : "bg-surface-sunken text-ink-muted",
        )}
      >
        {icon}
      </div>
      <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
      {description && (
        <p className="mt-1 max-w-sm text-[13px] leading-relaxed text-ink-secondary">{description}</p>
      )}
      {action && <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}

export function EmptyState(props: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return <StateBlock tone="neutral" icon={props.icon ?? <BoxIcon size={22} />} {...props} />;
}

export function ErrorState(props: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return <StateBlock tone="danger" role="alert" icon={<AlertIcon size={22} />} {...props} />;
}

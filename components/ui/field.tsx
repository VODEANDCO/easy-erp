import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type FieldControlProps = {
  id: string;
  "aria-describedby"?: string;
  "aria-required"?: boolean;
  invalid: boolean;
};

/**
 * 라벨 + 입력 + 도움말 + 오류 문구 묶음
 *
 * children 함수가 받은 props 를 입력에 그대로 넘기면
 * 라벨(for), 도움말·오류(aria-describedby), 필수(aria-required)가 자동으로 연결됩니다.
 */
export function Field({
  id,
  label,
  required,
  hint,
  error,
  className,
  children,
}: {
  id: string;
  label: ReactNode;
  required?: boolean;
  hint?: ReactNode;
  error?: string;
  className?: string;
  children: (props: FieldControlProps) => ReactNode;
}) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-[13px] font-medium text-ink">
        {label}
        {required && (
          <span className="ml-0.5 text-danger" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {children({
        id,
        "aria-describedby": describedBy,
        "aria-required": required || undefined,
        invalid: Boolean(error),
      })}
      {error ? (
        <p id={errorId} className="text-[13px] text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-[13px] text-ink-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

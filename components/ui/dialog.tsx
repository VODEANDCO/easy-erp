"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

/**
 * 확인 다이얼로그 (브라우저 기본 <dialog> 사용)
 *
 * - showModal() 로 열면 브라우저가 포커스 가두기, 배경 클릭 차단, 화면 읽기 프로그램 안내를 처리합니다.
 * - busy(처리 중)일 때는 Esc 키와 바깥 클릭으로 닫히지 않습니다.
 * - 닫히면 다이얼로그를 연 버튼으로 포커스가 돌아갑니다(브라우저 기본 동작).
 */
export function Dialog({
  open,
  onClose,
  busy = false,
  title,
  description,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  busy?: boolean;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onCancel={(e) => {
        // Esc 키
        e.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(e) => {
        // 바깥(배경) 클릭: 클릭 대상이 dialog 자신이면 내용 바깥을 누른 것
        if (e.target === e.currentTarget && !busy) onClose();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-card border border-line bg-surface p-0 text-ink shadow-overlay backdrop:bg-ink/40"
    >
      <div className="p-6">
        <h2 id={titleId} className="text-base font-semibold">
          {title}
        </h2>
        {description && (
          <div id={descId} className="mt-2 text-sm leading-relaxed text-ink-secondary">
            {description}
          </div>
        )}
        {children && <div className="mt-4">{children}</div>}
      </div>
      <div className="flex justify-end gap-2 border-t border-line bg-surface-muted px-6 py-4">{footer}</div>
    </dialog>
  );
}

"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { CloseIcon, MenuIcon } from "@/components/ui/icons";

/**
 * 1024px 미만 화면에서 쓰는 메뉴 드로어
 * - 햄버거 버튼으로 열고, Esc·배경 클릭·메뉴 링크 클릭으로 닫힙니다.
 * - <dialog> 를 써서 열려 있는 동안 포커스가 메뉴 안에 머뭅니다.
 */
export function MobileNav({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="메뉴 열기"
        aria-expanded={open}
        className="inline-flex size-9 items-center justify-center rounded-control text-ink-secondary hover:bg-surface-sunken focus-visible:outline-2 focus-visible:outline-accent lg:hidden"
      >
        <MenuIcon size={20} />
      </button>

      <dialog
        ref={ref}
        aria-label="주 메뉴"
        onClose={() => setOpen(false)}
        onClick={(e) => {
          if (e.target === e.currentTarget) setOpen(false);
          // 메뉴 링크를 누르면 닫기
          if ((e.target as HTMLElement).closest("a")) setOpen(false);
        }}
        className="m-0 h-dvh max-h-dvh w-72 max-w-[85vw] border-r border-line bg-surface p-0 backdrop:bg-ink/40"
      >
        <div className="flex h-topbar items-center justify-between border-b border-line px-5">
          <span className="text-[15px] font-bold text-ink">Easy ERP</span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="메뉴 닫기"
            className="inline-flex size-9 items-center justify-center rounded-control text-ink-secondary hover:bg-surface-sunken focus-visible:outline-2 focus-visible:outline-accent"
          >
            <CloseIcon size={18} />
          </button>
        </div>
        <div className="py-4">{children}</div>
      </dialog>
    </>
  );
}

"use client";

import { usePathname } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { FLASH_TOAST_COOKIE, FLASH_TOAST_MESSAGES, isFlashToastKind } from "@/lib/action-result";
import { CloseIcon } from "./icons";

/**
 * 성공 안내(Toast)
 *
 * - Server Action 이 redirect 직전에 저장한 flash 쿠키(easyerp_toast)를 읽어 한 번 보여주고 바로 지웁니다.
 * - 쿠키 값은 정해진 단어(created 등)만 인정하고, 그 밖의 값은 무시합니다. 화면에 쿠키 값을 그대로 출력하지 않습니다.
 * - 주소가 바뀔 때마다(페이지 이동) 쿠키를 확인합니다.
 * - 알림 영역(role="status")은 항상 있어서 화면 읽기 프로그램이 새 안내를 읽어 줍니다.
 */

const VISIBLE_MS = 4000;

/** flash 쿠키를 읽고 즉시 지웁니다. 인정된 값이면 안내 문구를 돌려줍니다. */
function takeFlashToast(): string | null {
  const prefix = `${FLASH_TOAST_COOKIE}=`;
  const raw = document.cookie.split("; ").find((c) => c.startsWith(prefix));
  if (!raw) return null;

  document.cookie = `${FLASH_TOAST_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax`;

  let value = "";
  try {
    value = decodeURIComponent(raw.slice(prefix.length));
  } catch {
    return null;
  }
  return isFlashToastKind(value) ? FLASH_TOAST_MESSAGES[value] : null;
}

function FlashToast() {
  const pathname = usePathname();
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);

  // 페이지가 바뀌면 쿠키를 확인합니다. (타이머 안에서 읽어 개발 모드의 effect 중복 실행에도 한 번만 소비)
  useEffect(() => {
    const timer = setTimeout(() => {
      const text = takeFlashToast();
      if (text) setToast({ id: Date.now(), text });
    }, 0);
    return () => clearTimeout(timer);
  }, [pathname]);

  // 일정 시간이 지나면 자동으로 닫습니다.
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4 sm:bottom-6 sm:justify-end sm:px-6"
    >
      {toast && (
        <div
          key={toast.id}
          className="pointer-events-auto flex max-w-sm items-center gap-3 rounded-control bg-brand py-3 pr-2 pl-4 text-sm text-ink-inverse shadow-overlay"
        >
          <span className="size-2 shrink-0 rounded-full bg-success-soft" aria-hidden />
          <p className="min-w-0 flex-1">{toast.text}</p>
          <button
            type="button"
            onClick={() => setToast(null)}
            aria-label="알림 닫기"
            className="flex size-7 shrink-0 items-center justify-center rounded-control text-ink-inverse/70 hover:bg-white/10 hover:text-ink-inverse focus-visible:outline-2 focus-visible:outline-ink-inverse"
          >
            <CloseIcon size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * 레이아웃에 한 번 배치합니다.
 * usePathname 은 동적 주소(/products/[id])에서 미리 렌더링할 때 대기하므로 Suspense 로 감쌉니다. (cacheComponents)
 */
export function Toaster() {
  return (
    <Suspense fallback={null}>
      <FlashToast />
    </Suspense>
  );
}

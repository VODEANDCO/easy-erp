import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { MobileNav } from "./mobile-nav";
import { Logo, SidebarNav } from "./sidebar-nav";

/**
 * ERP 공통 레이아웃
 *
 * ┌ Sidebar 240px ┬ Header 64px ───────────────────┐
 * │               ├─────────────────────────────────┤
 * │               │ 본문 (최대 1200px)               │
 *
 * - 1024px 이상: 고정 사이드바
 * - 1024px 미만: 햄버거 버튼 → 드로어
 */
export function AppShell({ preview, children }: { preview: boolean; children: ReactNode }) {
  return (
    <div className="flex min-h-dvh">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-control focus:bg-brand focus:px-3 focus:py-2 focus:text-sm focus:text-ink-inverse"
      >
        본문으로 건너뛰기
      </a>

      <aside className="sticky top-0 hidden h-dvh w-sidebar shrink-0 flex-col border-r border-line bg-surface lg:flex">
        <div className="flex h-topbar items-center border-b border-line px-5">
          <Logo />
        </div>
        <div className="flex-1 overflow-y-auto py-4">
          <SidebarNav />
        </div>
        <p className="border-t border-line px-5 py-4 text-xs leading-relaxed text-ink-muted">
          데모 환경입니다. 실제 사업 데이터나 개인정보를 입력하지 마세요.
        </p>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-topbar shrink-0 items-center justify-between gap-3 border-b border-line bg-surface/95 px-4 backdrop-blur sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 lg:hidden">
            <MobileNav>
              <SidebarNav />
            </MobileNav>
            <Logo />
          </div>
          <div className="hidden text-sm text-ink-secondary lg:block">소상공인 ERP</div>
          {preview && (
            <Badge tone="warning" dot>
              DB 연결 전 · 미리보기
            </Badge>
          )}
        </header>

        <main id="main" className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto w-full max-w-content">{children}</div>
        </main>
      </div>
    </div>
  );
}

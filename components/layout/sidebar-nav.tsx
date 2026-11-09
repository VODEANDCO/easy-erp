import Link from "next/link";
import type { ReactNode } from "react";
import {
  BoxIcon,
  CartIcon,
  ReceiptIcon,
  SettingsIcon,
  SparkIcon,
  SwapIcon,
} from "@/components/ui/icons";

type NavItem = {
  label: string;
  icon: ReactNode;
  /** 링크가 있으면 사용 가능한 메뉴, 없으면 "준비 중" */
  href?: string;
};

/**
 * 사이드바 메뉴
 * 이번 미션에서 동작하는 메뉴는 "상품 관리" 하나입니다.
 * 나머지는 링크 없이 "준비 중"으로만 보여주어 동작하는 것처럼 보이지 않게 합니다.
 */
const NAV_ITEMS: NavItem[] = [
  { label: "상품 관리", icon: <BoxIcon size={18} />, href: "/products" },
  { label: "주문 관리", icon: <CartIcon size={18} /> },
  { label: "재고 입출고", icon: <SwapIcon size={18} /> },
  { label: "인보이스", icon: <ReceiptIcon size={18} /> },
  { label: "AI 발주 추천", icon: <SparkIcon size={18} /> },
  { label: "설정", icon: <SettingsIcon size={18} /> },
];

export function Logo() {
  return (
    <Link
      href="/products"
      className="flex items-center gap-2 rounded-control text-[15px] font-bold tracking-tight text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <span className="flex size-7 items-center justify-center rounded-control bg-brand text-xs font-bold text-ink-inverse">
        E
      </span>
      Easy ERP
    </Link>
  );
}

export function SidebarNav() {
  return (
    <nav aria-label="주 메뉴" className="flex flex-col gap-0.5 px-3">
      <ul className="flex flex-col gap-0.5">
        {NAV_ITEMS.map((item) =>
          item.href ? (
            <li key={item.label}>
              {/* 현재 /products 아래 화면만 있으므로 항상 선택 상태로 표시 */}
              <Link
                href={item.href}
                aria-current="page"
                className="flex h-10 items-center gap-3 rounded-control bg-accent-soft px-3 text-sm font-semibold text-ink transition-colors hover:bg-accent-soft/80 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent"
              >
                <span className="text-accent">{item.icon}</span>
                {item.label}
              </Link>
            </li>
          ) : (
            <li key={item.label}>
              <span
                aria-disabled="true"
                className="flex h-10 cursor-not-allowed items-center gap-3 rounded-control px-3 text-sm text-ink-muted"
              >
                {item.icon}
                <span className="flex-1">{item.label}</span>
                <span className="rounded-full border border-line px-1.5 py-px text-[11px] font-medium text-ink-muted">
                  준비 중
                </span>
              </span>
            </li>
          ),
        )}
      </ul>
    </nav>
  );
}

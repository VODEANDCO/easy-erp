import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { ChevronLeftIcon, ChevronRightIcon } from "./icons";

/** 현재 페이지 주변 번호만 보여줍니다. 예: 1 … 4 5 [6] 7 8 … 20 */
function pageWindow(page: number, pageCount: number): Array<number | "gap"> {
  const pages = new Set([1, pageCount, page - 1, page, page + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= pageCount).sort((a, b) => a - b);
  const result: Array<number | "gap"> = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) result.push("gap");
    result.push(p);
  });
  return result;
}

const itemClass =
  "inline-flex h-8 min-w-8 items-center justify-center rounded-control px-2 text-[13px] transition-colors " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export function Pagination({
  page,
  pageCount,
  total,
  pageSize,
  hrefFor,
}: {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  hrefFor: (page: number) => string;
}) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const edge = (target: number, label: string, icon: ReactNode, disabled: boolean) =>
    disabled ? (
      <span aria-disabled="true" className={cn(itemClass, "cursor-not-allowed text-ink-muted/60")}>
        {icon}
        <span className="sr-only">{label}</span>
      </span>
    ) : (
      <Link href={hrefFor(target)} scroll={false} className={cn(itemClass, "text-ink-secondary hover:bg-surface-sunken")}>
        {icon}
        <span className="sr-only">{label}</span>
      </Link>
    );

  return (
    <nav
      aria-label="페이지 이동"
      className="flex flex-col items-center justify-between gap-3 sm:flex-row"
    >
      <p className="text-[13px] text-ink-secondary">
        <span className="font-medium text-ink">
          {from}–{to}
        </span>{" "}
        / 전체 {total}개
      </p>
      <ul className="flex items-center gap-1">
        <li>{edge(page - 1, "이전 페이지", <ChevronLeftIcon />, page <= 1)}</li>
        {pageWindow(page, pageCount).map((p, i) =>
          p === "gap" ? (
            <li key={`gap-${i}`} className="px-1 text-ink-muted" aria-hidden="true">
              …
            </li>
          ) : (
            <li key={p}>
              <Link
                href={hrefFor(p)}
                scroll={false}
                aria-current={p === page ? "page" : undefined}
                className={cn(
                  itemClass,
                  p === page
                    ? "bg-brand font-semibold text-ink-inverse"
                    : "text-ink-secondary hover:bg-surface-sunken",
                )}
              >
                <span className="sr-only">페이지 </span>
                {p}
              </Link>
            </li>
          ),
        )}
        <li>{edge(page + 1, "다음 페이지", <ChevronRightIcon />, page >= pageCount)}</li>
      </ul>
    </nav>
  );
}

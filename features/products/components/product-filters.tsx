"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/form-controls";
import { SearchIcon, Spinner } from "@/components/ui/icons";
import {
  PRODUCT_CATEGORIES,
  PRODUCT_LIMITS,
  PRODUCT_SORTS,
  PRODUCT_SORT_LABELS,
} from "../constants";
import type { ProductListParams } from "../schema";
import { productListHref } from "../url";

/**
 * 목록 검색·필터·정렬 툴바
 * - 모든 상태는 URL 에 저장합니다. (새로고침, 링크 공유 시 그대로 유지)
 * - 검색어는 입력이 300ms 멈추면 반영합니다.
 * - 조건이 바뀌면 1페이지로 돌아갑니다.
 */
export function ProductFilters({ params }: { params: ProductListParams }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  /** 입력칸에 보이는 검색어 */
  const [query, setQuery] = useState(params.q);
  /** 이 컴포넌트가 마지막으로 URL 에 반영한 검색어 */
  const [pushedQ, setPushedQ] = useState(params.q);
  const [syncedQ, setSyncedQ] = useState(params.q);

  // 뒤로 가기처럼 바깥에서 URL 이 바뀐 경우에만 입력칸을 URL 값으로 맞춥니다.
  // (렌더 중 상태 조정: https://react.dev/learn/you-might-not-need-an-effect)
  if (params.q !== syncedQ) {
    setSyncedQ(params.q);
    if (params.q !== pushedQ) {
      setQuery(params.q);
      setPushedQ(params.q);
    }
  }

  const navigate = (next: Partial<ProductListParams>) => {
    const href = productListHref({ ...params, ...next, page: 1 });
    startTransition(() => router.replace(href, { scroll: false }));
  };
  const navigateRef = useRef(navigate);
  useEffect(() => {
    navigateRef.current = navigate;
  });

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed === pushedQ) return;
    const timer = setTimeout(() => {
      setPushedQ(trimmed);
      navigateRef.current({ q: trimmed });
    }, 300);
    return () => clearTimeout(timer);
  }, [query, pushedQ]);

  const filtered = Boolean(params.q || params.category || params.stock || params.sort !== "latest");

  return (
    <div
      role="search"
      aria-busy={pending}
      className="flex flex-col gap-2 border-b border-line p-4 md:flex-row md:items-center"
    >
      <div className="relative md:max-w-xs md:flex-1">
        <label htmlFor="product-search" className="sr-only">
          상품명 또는 SKU 검색
        </label>
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-ink-muted">
          {pending ? <Spinner size={15} /> : <SearchIcon size={15} />}
        </span>
        <Input
          id="product-search"
          type="search"
          value={query}
          maxLength={PRODUCT_LIMITS.searchMax}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="상품명 또는 SKU 검색"
          className="pl-9"
        />
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:flex md:flex-1 md:justify-end">
        <label className="sr-only" htmlFor="filter-category">
          카테고리
        </label>
        <Select
          id="filter-category"
          value={params.category ?? ""}
          onChange={(e) => navigate({ category: (e.target.value || null) as ProductListParams["category"] })}
          className="md:w-36"
        >
          <option value="">전체 카테고리</option>
          {PRODUCT_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>

        <label className="sr-only" htmlFor="filter-stock">
          재고 상태
        </label>
        <Select
          id="filter-stock"
          value={params.stock ?? ""}
          onChange={(e) => navigate({ stock: e.target.value === "low" ? "low" : null })}
          className="md:w-32"
        >
          <option value="">전체 재고</option>
          <option value="low">재고 부족</option>
        </Select>

        <label className="sr-only" htmlFor="filter-sort">
          정렬
        </label>
        <Select
          id="filter-sort"
          value={params.sort}
          onChange={(e) => navigate({ sort: e.target.value as ProductListParams["sort"] })}
          className="col-span-2 sm:col-span-1 md:w-36"
        >
          {PRODUCT_SORTS.map((s) => (
            <option key={s} value={s}>
              {PRODUCT_SORT_LABELS[s]}
            </option>
          ))}
        </Select>

        {filtered && (
          <Button
            variant="ghost"
            onClick={() => {
              setPushedQ("");
              setQuery("");
              startTransition(() => router.replace("/products", { scroll: false }));
            }}
            className="col-span-2 sm:col-span-3 md:col-span-1"
          >
            필터 초기화
          </Button>
        )}
      </div>
    </div>
  );
}

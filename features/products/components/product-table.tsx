import Link from "next/link";
import { formatCount, formatDate, formatWon } from "../format";
import type { Product } from "../types";
import { productHref } from "../url";
import { StatusBadge, StockBadge } from "./product-badges";
import { ProductImage } from "./product-image";

/**
 * 상품 목록 표
 * - 768px 이상: 표
 * - 768px 미만: 카드 목록
 * 행 전체를 누르면 상세로 이동합니다. (상품명 링크를 행 전체로 넓히는 방식이라 키보드로도 이동 가능)
 */
export function ProductTable({ products }: { products: Product[] }) {
  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[760px] text-left text-sm">
          <caption className="sr-only">상품 목록</caption>
          <thead className="border-b border-line bg-surface-muted text-[12px] font-medium text-ink-secondary">
            <tr>
              <th scope="col" className="py-2.5 pr-3 pl-5 font-medium">
                상품
              </th>
              <th scope="col" className="px-3 py-2.5 font-medium">
                카테고리
              </th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">
                판매가
              </th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">
                재고 <span className="text-ink-muted">(현재 / 안전)</span>
              </th>
              <th scope="col" className="px-3 py-2.5 font-medium">
                상태
              </th>
              <th scope="col" className="py-2.5 pr-5 pl-3 text-right font-medium">
                수정일
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {products.map((p) => (
              <tr key={p.id} className="relative transition-colors hover:bg-surface-muted">
                <td className="py-3 pr-3 pl-5">
                  <div className="flex items-center gap-3">
                    <ProductImage name={p.name} imagePath={p.image_path} />
                    <div className="min-w-0">
                      <Link
                        href={productHref(p.id)}
                        className="block max-w-72 truncate font-medium text-ink after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-accent"
                      >
                        {p.name}
                      </Link>
                      <p className="font-mono text-xs text-ink-muted">{p.sku}</p>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3 text-ink-secondary">{p.category ?? "—"}</td>
                <td className="px-3 py-3 text-right font-medium text-ink">{formatWon(p.price)}</td>
                <td className="px-3 py-3 text-right">
                  <span className={p.is_low_stock ? "font-semibold text-warning" : "text-ink"}>
                    {formatCount(p.stock_quantity)}
                  </span>
                  <span className="text-ink-muted"> / {formatCount(p.safety_stock)}</span>
                </td>
                <td className="px-3 py-3">
                  <div className="flex flex-wrap gap-1">
                    <StockBadge stock={p.stock_quantity} safety={p.safety_stock} />
                    <StatusBadge status={p.status} />
                  </div>
                </td>
                <td className="py-3 pr-5 pl-3 text-right text-[13px] text-ink-secondary">
                  {formatDate(p.updated_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="divide-y divide-line md:hidden">
        {products.map((p) => (
          <li key={p.id}>
            <Link
              href={productHref(p.id)}
              className="flex gap-3 px-4 py-3.5 transition-colors hover:bg-surface-muted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
            >
              <ProductImage name={p.name} imagePath={p.image_path} />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="truncate text-sm font-medium text-ink">{p.name}</p>
                  <p className="shrink-0 text-sm font-medium text-ink">{formatWon(p.price)}</p>
                </div>
                <p className="font-mono text-xs text-ink-muted">{p.sku}</p>
                <div className="mt-2 flex flex-wrap items-center gap-1">
                  <StockBadge stock={p.stock_quantity} safety={p.safety_stock} />
                  <StatusBadge status={p.status} />
                  <span className="ml-auto text-xs text-ink-secondary">
                    재고 {formatCount(p.stock_quantity)} / {formatCount(p.safety_stock)}
                  </span>
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

/** 재고 상태 (docs/project-context.md "재고 상태 표시 규칙") */
export type StockLevel = "out" | "low" | "normal";

export function getStockLevel(stock: number, safety: number): StockLevel {
  if (stock === 0) return "out";
  if (stock <= safety) return "low";
  return "normal";
}

export const STOCK_LEVEL_LABELS: Record<StockLevel, string> = {
  out: "품절",
  low: "재고 부족",
  normal: "정상",
};

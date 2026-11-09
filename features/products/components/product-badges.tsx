import { Badge, type BadgeTone } from "@/components/ui/badge";
import { PRODUCT_STATUS_LABELS, type ProductStatus } from "../constants";
import { getStockLevel, STOCK_LEVEL_LABELS, type StockLevel } from "../stock";

const stockTone: Record<StockLevel, BadgeTone> = {
  out: "danger",
  low: "warning",
  normal: "neutral",
};

export function StockBadge({ stock, safety }: { stock: number; safety: number }) {
  const level = getStockLevel(stock, safety);
  return (
    <Badge tone={stockTone[level]} dot>
      {STOCK_LEVEL_LABELS[level]}
    </Badge>
  );
}

export function StatusBadge({ status }: { status: ProductStatus }) {
  return (
    <Badge tone={status === "active" ? "success" : "muted"}>{PRODUCT_STATUS_LABELS[status]}</Badge>
  );
}

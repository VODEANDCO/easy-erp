import { Card } from "@/components/ui/card";
import { LoadingLabel, Skeleton } from "@/components/ui/skeleton";
import { PRODUCTS_PAGE_SIZE } from "../constants";

export function ProductListSkeleton() {
  return (
    <Card>
      <LoadingLabel>상품 목록을 불러오는 중입니다</LoadingLabel>
      <div className="flex flex-col gap-2 border-b border-line p-4 md:flex-row">
        <Skeleton className="h-10 md:w-80" />
        <div className="flex flex-1 gap-2 md:justify-end">
          <Skeleton className="h-10 flex-1 md:w-36 md:flex-none" />
          <Skeleton className="h-10 flex-1 md:w-32 md:flex-none" />
          <Skeleton className="h-10 flex-1 md:w-36 md:flex-none" />
        </div>
      </div>
      <div className="h-10 border-b border-line bg-surface-muted" />
      <ul className="divide-y divide-line">
        {Array.from({ length: PRODUCTS_PAGE_SIZE }, (_, i) => (
          <li key={i} className="flex items-center gap-3 px-5 py-3">
            <Skeleton className="size-10" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-48 max-w-full" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="hidden h-3.5 w-20 md:block" />
            <Skeleton className="hidden h-3.5 w-16 md:block" />
            <Skeleton className="h-6 w-16 rounded-full" />
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function ProductDetailSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <LoadingLabel>상품 정보를 불러오는 중입니다</LoadingLabel>
      <Card className="p-5">
        <Skeleton className="aspect-square w-full rounded-card" />
      </Card>
      <Card className="space-y-4 p-5">
        <Skeleton className="h-6 w-64 max-w-full" />
        <Skeleton className="h-4 w-32" />
        <div className="grid grid-cols-2 gap-4 pt-4 sm:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-5 w-24" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

export function ProductFormSkeleton() {
  return (
    <div className="space-y-6">
      <LoadingLabel>상품 정보를 불러오는 중입니다</LoadingLabel>
      {Array.from({ length: 3 }, (_, i) => (
        <Card key={i} className="space-y-4 p-5">
          <Skeleton className="h-5 w-24" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
          </div>
        </Card>
      ))}
    </div>
  );
}

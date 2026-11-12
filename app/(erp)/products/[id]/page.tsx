import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { LinkButton } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EditIcon } from "@/components/ui/icons";
import { Skeleton } from "@/components/ui/skeleton";
import { AccessBlocked } from "@/features/products/components/access-blocked";
import { DeleteProductButton } from "@/features/products/components/delete-product-button";
import { PreviewNotice } from "@/features/products/components/preview-notice";
import { StatusBadge, StockBadge } from "@/features/products/components/product-badges";
import { ProductImage } from "@/features/products/components/product-image";
import { ProductDetailSkeleton } from "@/features/products/components/skeletons";
import { formatCount, formatDateTime, formatWon, marginRate } from "@/features/products/format";
import { getProduct, isPreviewMode } from "@/features/products/queries";
import { productEditHref } from "@/features/products/url";

export const metadata: Metadata = { title: "상품 상세" };

export default function ProductDetailPage({ params }: PageProps<"/products/[id]">) {
  return (
    <Suspense
      fallback={
        <>
          <div className="mb-6 space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-7 w-64 max-w-full" />
          </div>
          <ProductDetailSkeleton />
        </>
      }
    >
      <ProductDetail params={params} />
    </Suspense>
  );
}

async function ProductDetail({ params }: { params: PageProps<"/products/[id]">["params"] }) {
  const { id } = await params;
  const query = await getProduct(id);
  // 접근 권한이 확인되지 않으면 상품 존재 여부도 알려주지 않고 차단 안내만 보여줍니다.
  if (!query.ok) return <AccessBlocked reason={query.reason} />;
  // ID 형식이 틀리거나 상품이 없으면 not-found.tsx 화면을 보여줍니다.
  const product = query.data;
  if (!product) notFound();

  const margin = marginRate(product.price, product.cost);

  return (
    <>
      <PageHeader
        breadcrumb={[{ label: "상품 관리", href: "/products" }, { label: product.name }]}
        title={product.name}
        description={<span className="font-mono">{product.sku}</span>}
        actions={
          <>
            <DeleteProductButton id={product.id} name={product.name} />
            <LinkButton href={productEditHref(product.id)}>
              <EditIcon size={15} />
              수정
            </LinkButton>
          </>
        }
      />
      {isPreviewMode() && <PreviewNotice variant="detail" />}

      <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <Card className="h-fit p-5">
          <ProductImage name={product.name} imagePath={product.image_path} size="lg" />
          <div className="mt-4 flex flex-wrap gap-1.5">
            <StatusBadge status={product.status} />
            <StockBadge stock={product.stock_quantity} safety={product.safety_stock} />
            {product.category && (
              <span className="inline-flex h-6 items-center rounded-full border border-line px-2.5 text-xs text-ink-secondary">
                {product.category}
              </span>
            )}
          </div>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="가격 · 재고" />
            <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-b-card bg-line sm:grid-cols-3">
              <Info label="판매가" strong>
                {formatWon(product.price)}
              </Info>
              <Info label="원가">{formatWon(product.cost)}</Info>
              <Info label="마진율">{margin === null ? "—" : `${margin}%`}</Info>
              <Info label="현재 재고" strong>
                <span className={product.is_low_stock ? "text-warning" : undefined}>
                  {formatCount(product.stock_quantity)}개
                </span>
              </Info>
              <Info label="안전재고">{formatCount(product.safety_stock)}개</Info>
              <Info label="재고 상태">
                <StockBadge stock={product.stock_quantity} safety={product.safety_stock} />
              </Info>
            </dl>
          </Card>

          <Card>
            <CardHeader title="상품 설명" />
            <CardBody>
              {product.description ? (
                <p className="text-sm leading-relaxed whitespace-pre-line text-ink">{product.description}</p>
              ) : (
                <p className="text-sm text-ink-muted">등록된 설명이 없습니다.</p>
              )}
            </CardBody>
          </Card>

          <Card className="overflow-hidden">
            <dl className="grid grid-cols-1 gap-px bg-line sm:grid-cols-2">
              <Info label="등록일">{formatDateTime(product.created_at)}</Info>
              <Info label="수정일">{formatDateTime(product.updated_at)}</Info>
            </dl>
          </Card>
        </div>
      </div>
    </>
  );
}

function Info({ label, strong, children }: { label: string; strong?: boolean; children: ReactNode }) {
  return (
    <div className="bg-surface px-5 py-4">
      <dt className="text-[13px] text-ink-secondary">{label}</dt>
      <dd className={strong ? "mt-1 text-lg font-semibold text-ink" : "mt-1 text-sm text-ink"}>{children}</dd>
    </div>
  );
}

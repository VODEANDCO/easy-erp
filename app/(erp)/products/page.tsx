import type { Metadata } from "next";
import { Suspense } from "react";
import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PlusIcon } from "@/components/ui/icons";
import { EmptyState } from "@/components/ui/state";
import { PageHeader } from "@/components/layout/page-header";
import { Pagination } from "@/components/ui/pagination";
import { PRODUCTS_PAGE_SIZE } from "@/features/products/constants";
import { PreviewNotice } from "@/features/products/components/preview-notice";
import { ProductFilters } from "@/features/products/components/product-filters";
import { ProductTable } from "@/features/products/components/product-table";
import { ProductListSkeleton } from "@/features/products/components/skeletons";
import { isPreviewMode, listProducts } from "@/features/products/queries";
import { parseProductListParams } from "@/features/products/schema";
import { productListHref } from "@/features/products/url";

export const metadata: Metadata = { title: "상품 관리" };

export default function ProductsPage({ searchParams }: PageProps<"/products">) {
  return (
    <>
      <PageHeader
        title="상품 관리"
        description="판매 중인 상품의 가격과 재고를 관리합니다."
        actions={
          <LinkButton href="/products/new">
            <PlusIcon size={15} />
            상품 등록
          </LinkButton>
        }
      />
      {isPreviewMode() && <PreviewNotice variant="list" />}
      {/* searchParams 는 요청 시점 데이터이므로 Suspense 안에서 읽습니다 (cacheComponents) */}
      <Suspense fallback={<ProductListSkeleton />}>
        <ProductList searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function ProductList({ searchParams }: { searchParams: PageProps<"/products">["searchParams"] }) {
  const params = parseProductListParams(await searchParams);
  const result = await listProducts(params);
  const current = { ...params, page: result.page };

  if (result.totalAll === 0) {
    return (
      <Card>
        <EmptyState
          title="등록된 상품이 없습니다"
          description="첫 상품을 등록하면 이곳에서 가격과 재고를 한눈에 볼 수 있습니다."
          action={
            <LinkButton href="/products/new">
              <PlusIcon size={15} />
              상품 등록
            </LinkButton>
          }
        />
      </Card>
    );
  }

  return (
    <Card>
      <ProductFilters params={current} />
      {result.items.length === 0 ? (
        <EmptyState
          title="조건에 맞는 상품이 없습니다"
          description="검색어나 필터를 바꿔 다시 찾아보세요."
          action={
            <LinkButton href="/products" variant="secondary">
              필터 초기화
            </LinkButton>
          }
        />
      ) : (
        <>
          <ProductTable products={result.items} />
          <div className="border-t border-line px-5 py-3">
            <Pagination
              page={result.page}
              pageCount={result.pageCount}
              total={result.total}
              pageSize={PRODUCTS_PAGE_SIZE}
              hrefFor={(page) => productListHref({ ...current, page })}
            />
          </div>
        </>
      )}
    </Card>
  );
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { AccessBlocked } from "@/features/products/components/access-blocked";
import { PreviewNotice } from "@/features/products/components/preview-notice";
import { ProductForm } from "@/features/products/components/product-form";
import { ProductFormSkeleton } from "@/features/products/components/skeletons";
import { toProductFormValues } from "@/features/products/form-values";
import { getProduct, isPreviewMode } from "@/features/products/queries";
import { productHref } from "@/features/products/url";
import { isProductsDemoMode } from "@/lib/auth/business-access";

export const metadata: Metadata = { title: "상품 수정" };

export default function EditProductPage({ params }: PageProps<"/products/[id]/edit">) {
  return (
    <Suspense
      fallback={
        <>
          <div className="mb-6 space-y-2">
            <Skeleton className="h-4 w-56" />
            <Skeleton className="h-7 w-40" />
          </div>
          <ProductFormSkeleton />
        </>
      }
    >
      <EditProduct params={params} />
    </Suspense>
  );
}

async function EditProduct({ params }: { params: PageProps<"/products/[id]/edit">["params"] }) {
  const { id } = await params;
  const query = await getProduct(id);
  // 접근 권한이 확인되지 않으면 수정 폼(기존 값)을 보여주지 않습니다.
  if (!query.ok) return <AccessBlocked reason={query.reason} />;
  const product = query.data;
  if (!product) notFound();

  return (
    <>
      <PageHeader
        breadcrumb={[
          { label: "상품 관리", href: "/products" },
          { label: product.name, href: productHref(product.id) },
          { label: "수정" },
        ]}
        title="상품 수정"
        description="* 표시는 필수 입력 항목입니다."
      />
      {isPreviewMode() && <PreviewNotice variant="form" />}
      {isProductsDemoMode() && (
        <Alert tone="warning" title="공개 데모 · 테스트 데이터만 입력하세요" className="mb-5">
          누구나 볼 수 있는 화면입니다. 실제 상품·거래처·개인정보는 입력하지 마세요.
        </Alert>
      )}
      <ProductForm
        key={product.updated_at}
        mode="edit"
        productId={product.id}
        updatedAt={product.updated_at}
        initialValues={toProductFormValues(product)}
        cancelHref={productHref(product.id)}
      />
    </>
  );
}

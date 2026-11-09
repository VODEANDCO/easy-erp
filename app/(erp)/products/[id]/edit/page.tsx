import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { PreviewNotice } from "@/features/products/components/preview-notice";
import { ProductForm } from "@/features/products/components/product-form";
import { ProductFormSkeleton } from "@/features/products/components/skeletons";
import { toProductFormValues } from "@/features/products/form-values";
import { getProduct, isPreviewMode } from "@/features/products/queries";
import { productHref } from "@/features/products/url";

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
  const product = await getProduct(id);
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

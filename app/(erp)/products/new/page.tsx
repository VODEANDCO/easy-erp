import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { PreviewNotice } from "@/features/products/components/preview-notice";
import { ProductForm } from "@/features/products/components/product-form";
import { EMPTY_PRODUCT_FORM } from "@/features/products/form-values";
import { isPreviewMode } from "@/features/products/queries";

export const metadata: Metadata = { title: "상품 등록" };

export default function NewProductPage() {
  return (
    <>
      <PageHeader
        breadcrumb={[{ label: "상품 관리", href: "/products" }, { label: "상품 등록" }]}
        title="상품 등록"
        description="* 표시는 필수 입력 항목입니다."
      />
      {isPreviewMode() && <PreviewNotice variant="form" />}
      <ProductForm mode="create" initialValues={EMPTY_PRODUCT_FORM} cancelHref="/products" />
    </>
  );
}

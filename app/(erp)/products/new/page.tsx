import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { AccessBlocked } from "@/features/products/components/access-blocked";
import { PreviewNotice } from "@/features/products/components/preview-notice";
import { ProductForm } from "@/features/products/components/product-form";
import { ProductFormSkeleton } from "@/features/products/components/skeletons";
import { EMPTY_PRODUCT_FORM } from "@/features/products/form-values";
import { isPreviewMode } from "@/features/products/queries";
import { getBusinessAccess } from "@/lib/auth/business-access";

export const metadata: Metadata = { title: "상품 등록" };

/**
 * 상품 등록
 * - 접근 권한이 없으면(데모 모드 꺼짐) 폼 대신 차단 화면을 보여줍니다.
 * - 권한 확인은 빌드 시점이 아니라 **요청 시점**에 합니다. (connection)
 * - 화면 차단은 안내용이고, 실제 차단은 createProduct Server Action 이 다시 확인합니다.
 */
export default function NewProductPage() {
  return (
    <>
      <PageHeader
        breadcrumb={[{ label: "상품 관리", href: "/products" }, { label: "상품 등록" }]}
        title="상품 등록"
        description="* 표시는 필수 입력 항목입니다."
      />
      <Suspense fallback={<ProductFormSkeleton />}>
        <NewProduct />
      </Suspense>
    </>
  );
}

async function NewProduct() {
  await connection();
  const access = await getBusinessAccess();
  if (!access.ok) return <AccessBlocked reason={access.reason} />;

  return (
    <>
      {isPreviewMode() && <PreviewNotice variant="form" />}
      {access.mode === "demo" && (
        <Alert tone="warning" title="공개 데모 환경입니다" className="mb-5">
          누구나 볼 수 있는 화면입니다. 실제 상품·거래처·개인정보는 입력하지 말고 테스트 데이터만 입력해 주세요.
        </Alert>
      )}
      <ProductForm mode="create" initialValues={EMPTY_PRODUCT_FORM} cancelHref="/products" />
    </>
  );
}

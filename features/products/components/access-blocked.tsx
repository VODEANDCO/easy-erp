import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { InfoIcon } from "@/components/ui/icons";
import { EmptyState } from "@/components/ui/state";
import type { BusinessAccessDeniedReason } from "@/lib/auth/business-access";

/**
 * 접근 권한 확인에 실패했을 때 상품 데이터 대신 보여주는 화면
 * 어떤 상품이 있는지(개수, 이름, ID 존재 여부)는 드러내지 않습니다.
 */
const MESSAGES: Record<BusinessAccessDeniedReason, { title: string; description: string }> = {
  AUTH_NOT_READY: {
    title: "상품 정보에 접근할 수 없습니다",
    description:
      "로그인과 사업장 권한 확인 기능이 아직 준비되지 않아, 안전을 위해 상품 조회를 차단했습니다.",
  },
  UNAUTHENTICATED: {
    title: "로그인이 필요합니다",
    description: "상품 정보를 보려면 먼저 로그인해 주세요.",
  },
  NO_BUSINESS_ACCESS: {
    title: "사업장 접근 권한이 없습니다",
    description: "이 사업장의 상품을 볼 수 있는 권한이 없습니다. 사업장 관리자에게 문의해 주세요.",
  },
};

export function AccessBlocked({ reason }: { reason: BusinessAccessDeniedReason }) {
  const { title, description } = MESSAGES[reason];
  return (
    <Card>
      <EmptyState
        icon={<InfoIcon size={22} />}
        title={title}
        description={description}
        action={
          <LinkButton href="/products" variant="secondary">
            상품 관리로
          </LinkButton>
        }
      />
    </Card>
  );
}

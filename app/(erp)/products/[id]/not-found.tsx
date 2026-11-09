import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/state";

/** 잘못된 상품 ID, 없는 상품, 이미 삭제된 상품 (상세·수정 화면 공통) */
export default function ProductNotFound() {
  return (
    <Card>
      <EmptyState
        title="상품을 찾을 수 없습니다"
        description="주소가 잘못되었거나 이미 삭제된 상품입니다."
        action={<LinkButton href="/products">목록으로</LinkButton>}
      />
    </Card>
  );
}

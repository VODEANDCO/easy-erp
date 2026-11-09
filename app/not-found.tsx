import { LinkButton } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/state";

/** 존재하지 않는 주소 (상품 화면 밖) */
export default function NotFound() {
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <EmptyState
        title="페이지를 찾을 수 없습니다"
        description="주소를 다시 확인해 주세요."
        action={<LinkButton href="/products">상품 관리로 이동</LinkButton>}
      />
    </main>
  );
}

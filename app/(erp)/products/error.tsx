"use client";

import { useEffect } from "react";
import { Button, LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/state";

/**
 * 상품 화면에서 예상하지 못한 오류가 나면 보여주는 화면
 * 자세한 오류 내용은 화면에 보여주지 않고 콘솔(서버 로그)에만 남깁니다.
 */
export default function ProductsError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Card>
      <ErrorState
        title="상품 정보를 불러오지 못했습니다"
        description="일시적인 문제일 수 있습니다. 잠시 후 다시 시도해 주세요."
        action={
          <>
            <Button onClick={() => retry()}>다시 시도</Button>
            <LinkButton href="/products" variant="secondary">
              목록으로
            </LinkButton>
          </>
        }
      />
    </Card>
  );
}

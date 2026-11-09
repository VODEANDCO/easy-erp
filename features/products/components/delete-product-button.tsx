"use client";

import { useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { TrashIcon } from "@/components/ui/icons";
import type { ActionResult } from "@/lib/action-result";
import { deleteProduct } from "../actions";

/**
 * 삭제 버튼 + 확인 다이얼로그
 * - 처리 중에는 버튼 비활성화, Esc·바깥 클릭으로 닫히지 않음
 * - 실패하면 다이얼로그 안에 이유를 보여줌
 * TODO(Phase 4): 성공 시 서버가 /products 로 이동시키고 Toast "삭제되었습니다"
 */
export function DeleteProductButton({ id, name }: { id: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  const close = () => {
    setOpen(false);
    setResult(null);
  };

  const confirm = () => {
    startTransition(async () => {
      try {
        setResult(await deleteProduct(id));
      } catch {
        setResult({
          ok: false,
          code: "UNKNOWN",
          message: "네트워크 연결을 확인하고 다시 시도해 주세요.",
        });
      }
    });
  };

  const failed = result && !result.ok ? result : null;

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)} className="text-danger">
        <TrashIcon size={15} />
        삭제
      </Button>

      <Dialog
        open={open}
        onClose={close}
        busy={pending}
        title="상품을 삭제할까요?"
        description={
          <>
            <strong className="font-semibold text-ink">‘{name}’</strong>을(를) 삭제합니다. 이 작업은 되돌릴 수
            없습니다.
          </>
        }
        footer={
          <>
            <Button variant="secondary" onClick={close} disabled={pending} autoFocus>
              취소
            </Button>
            <Button
              variant="danger"
              onClick={confirm}
              loading={pending}
              loadingText="삭제 중…"
              disabled={failed?.code === "DB_NOT_CONNECTED"}
            >
              삭제
            </Button>
          </>
        }
      >
        {failed && (
          <Alert tone={failed.code === "DB_NOT_CONNECTED" ? "warning" : "danger"} live="assertive">
            {failed.message}
          </Alert>
        )}
      </Dialog>
    </>
  );
}

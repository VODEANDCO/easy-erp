import { Alert } from "@/components/ui/alert";

/** DB 연결 전 미리보기임을 알리는 안내. 미리보기 데이터를 보여주는 모든 화면에 표시합니다. */
export function PreviewNotice({ variant = "list" }: { variant?: "list" | "form" | "detail" }) {
  const body = {
    list: "아래 상품은 화면 확인용 예시 데이터입니다. 아직 데이터베이스가 연결되지 않아 실제로 저장된 상품이 아닙니다.",
    detail: "화면 확인용 예시 데이터입니다. 수정·삭제 버튼을 눌러도 실제로 바뀌지 않습니다.",
    form: "입력값 검증은 실제로 동작하지만, 데이터베이스 연결 전이라 [저장]을 눌러도 상품이 저장되지 않습니다.",
  }[variant];

  return (
    <Alert tone="warning" title="DB 연결 전 미리보기" className="mb-5">
      {body}
    </Alert>
  );
}

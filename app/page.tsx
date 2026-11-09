import { redirect } from "next/navigation";

/**
 * 첫 화면은 상품 관리로 보냅니다.
 * 랜딩 페이지 이식 여부는 Figma 자료를 받은 뒤 결정합니다.
 */
export default function Home() {
  redirect("/products");
}

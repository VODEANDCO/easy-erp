import "server-only";
import type { Product } from "./types";

/**
 * ⚠️ UI 확인용 예시 데이터입니다. 저장소가 아닙니다.
 *
 * - DB 연결 전(Phase 2 이전)에 화면 모양을 확인하기 위해서만 씁니다.
 * - 이 배열은 읽기 전용이며, 등록·수정·삭제 요청이 와도 바뀌지 않습니다.
 * - 화면에는 항상 "미리보기 데이터" 안내가 함께 표시됩니다.
 * - Supabase 연결 후 queries.ts 가 DB를 읽도록 바꾸면 이 파일은 삭제합니다.
 */

type Seed = Omit<Product, "is_low_stock" | "image_path" | "updated_at"> & {
  updated_at?: string;
};

const seeds: Seed[] = [
  { id: "0b9a6c3e-1f2d-4a5b-8c7d-000000000001", name: "유기농 녹차 티백 50입", sku: "TEA-GRN-050", category: "식품", price: 12900, cost: 7200, stock_quantity: 42, safety_stock: 10, status: "active", description: "제주산 유기농 녹차잎으로 만든 티백입니다.\n개별 포장으로 보관이 편리합니다.", created_at: "2026-11-08T09:12:00.000000+00:00" },
  { id: "0b9a6c3e-1f2d-4a5b-8c7d-000000000002", name: "콜드브루 원액 500ml", sku: "CFE-CB-500", category: "음료", price: 15800, cost: 9100, stock_quantity: 6, safety_stock: 8, status: "active", description: null, created_at: "2026-11-07T14:30:00.000000+00:00" },
  { id: "0b9a6c3e-1f2d-4a5b-8c7d-000000000003", name: "대나무 칫솔 4개입", sku: "LIV-BTB-04", category: "생활용품", price: 6900, cost: 3100, stock_quantity: 0, safety_stock: 5, status: "active", description: "자연 분해되는 대나무 손잡이 칫솔입니다.", created_at: "2026-11-06T02:05:00.000000+00:00" },
  { id: "0b9a6c3e-1f2d-4a5b-8c7d-000000000004", name: "스테인리스 텀블러 473ml", sku: "KIT-TMB-473", category: "주방용품", price: 24000, cost: 13500, stock_quantity: 31, safety_stock: 6, status: "active", description: null, created_at: "2026-11-05T07:44:00.000000+00:00" },
  { id: "0b9a6c3e-1f2d-4a5b-8c7d-000000000005", name: "A5 무지 노트 (3권 세트)", sku: "STN-NB-A5-3", category: "문구·사무", price: 8500, cost: 4200, stock_quantity: 120, safety_stock: 20, status: "active", description: null, created_at: "2026-11-04T11:20:00.000000+00:00" },
  { id: "0b9a6c3e-1f2d-4a5b-8c7d-000000000006", name: "린넨 에코백", sku: "APP-ECO-LN", category: "의류·잡화", price: 19000, cost: 8800, stock_quantity: 3, safety_stock: 5, status: "active", description: "천연 린넨 소재의 가벼운 에코백입니다.", created_at: "2026-11-03T05:10:00.000000+00:00" },
  { id: "0b9a6c3e-1f2d-4a5b-8c7d-000000000007", name: "USB-C 고속 충전 케이블 1m", sku: "ELC-USBC-1M", category: "전자기기", price: 9900, cost: 3900, stock_quantity: 58, safety_stock: 15, status: "active", description: null, created_at: "2026-11-02T13:00:00.000000+00:00" },
  { id: "0b9a6c3e-1f2d-4a5b-8c7d-000000000008", name: "수제 그래놀라 300g", sku: "FOD-GRN-300", category: "식품", price: 11500, cost: 6400, stock_quantity: 9, safety_stock: 9, status: "active", description: null, created_at: "2026-11-01T08:25:00.000000+00:00" },
  { id: "0b9a6c3e-1f2d-4a5b-8c7d-000000000009", name: "탄산수 레몬 355ml (24입)", sku: "BEV-SPK-LM24", category: "음료", price: 17900, cost: 11200, stock_quantity: 25, safety_stock: 10, status: "inactive", description: "시즌 종료로 판매를 잠시 멈춘 상품입니다.", created_at: "2026-10-31T03:40:00.000000+00:00" },
  { id: "0b9a6c3e-1f2d-4a5b-8c7d-00000000000a", name: "실리콘 주방 집게", sku: "KIT-TNG-SL", category: "주방용품", price: 7500, cost: null, stock_quantity: 14, safety_stock: 4, status: "active", description: null, created_at: "2026-10-30T10:15:00.000000+00:00" },
  { id: "0b9a6c3e-1f2d-4a5b-8c7d-00000000000b", name: "중성펜 0.5mm 블랙 (12자루)", sku: "STN-PEN-05BK", category: "문구·사무", price: 6000, cost: 2700, stock_quantity: 2, safety_stock: 10, status: "active", description: null, created_at: "2026-10-29T06:00:00.000000+00:00" },
  { id: "0b9a6c3e-1f2d-4a5b-8c7d-00000000000c", name: "포장용 크라프트 박스 (S, 50매)", sku: "ETC-BOX-S50", category: "기타", price: 22000, cost: 14000, stock_quantity: 0, safety_stock: 2, status: "inactive", description: null, created_at: "2026-10-28T12:30:00.000000+00:00" },
];

export const PREVIEW_PRODUCTS: readonly Product[] = Object.freeze(
  seeds.map((seed) => ({
    ...seed,
    image_path: null,
    is_low_stock: seed.stock_quantity <= seed.safety_stock,
    updated_at: seed.updated_at ?? seed.created_at,
  })),
);

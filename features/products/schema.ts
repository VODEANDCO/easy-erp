import { z } from "zod";
import {
  PRODUCT_CATEGORIES,
  PRODUCT_LIMITS,
  PRODUCT_SORTS,
  PRODUCT_STATUSES,
  type ProductCategory,
} from "./constants";

/**
 * 상품 입력값 검증 규칙
 *
 * - 브라우저(폼)와 서버(Server Action)가 **같은 스키마**를 씁니다.
 *   브라우저 검증은 편의용이고, 서버에서 반드시 다시 검증합니다.
 * - 폼 값은 모두 문자열로 들어오므로, 여기서 숫자·null 로 바꿔 DB에 넣을 모양을 만듭니다.
 * - DB 제약조건(supabase/migrations/20261109000001)과 같거나 더 엄격합니다.
 */

/** products.image_path 형식 (DB 제약조건 products_image_path_format 과 동일) */
export const IMAGE_PATH_PATTERN =
  /^products\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/;

/** products.sku 형식 (DB 제약조건 products_sku_format 과 동일) */
export const SKU_PATTERN = /^[A-Z0-9][A-Z0-9_-]{1,39}$/;

/** 줄바꿈·탭 같은 제어 문자 */
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/;

type IntegerRule = {
  max: number;
  required: string;
  invalid: string;
  negative: string;
  decimal: string;
  tooLarge: string;
};

/**
 * "12,000" 같은 문자열을 정수로 바꿉니다.
 * - 쉼표와 앞뒤 공백은 지운 뒤 검사합니다.
 * - 소수점이 있으면 반올림하지 않고 **거부**합니다.
 *   (DB numeric(12,2)는 1.005를 1.01로 조용히 반올림하므로 앱에서 막아야 함: docs/sql-verification.md)
 * - 빈 값이면 null 을 돌려줍니다.
 */
function parseIntegerText(raw: string, rule: IntegerRule, ctx: z.RefinementCtx) {
  const text = raw.trim().replace(/,/g, "");
  if (text === "") return null;

  const fail = (message: string) => {
    ctx.addIssue({ code: "custom", message });
    return z.NEVER;
  };

  if (!/^[+-]?(\d+(\.\d*)?|\.\d+)$/.test(text)) return fail(rule.invalid);
  if (text.startsWith("-") && Number(text) !== 0) return fail(rule.negative);
  if (text.includes(".")) return fail(rule.decimal);

  const value = Number(text);
  if (!Number.isSafeInteger(value) || value > rule.max) return fail(rule.tooLarge);
  return Math.abs(value); // "-0" → 0
}

function requiredInteger(rule: IntegerRule) {
  return z.string().transform((raw, ctx): number => {
    const value = parseIntegerText(raw, rule, ctx);
    if (value === null) {
      ctx.addIssue({ code: "custom", message: rule.required });
      return z.NEVER;
    }
    return value;
  });
}

function optionalInteger(rule: IntegerRule) {
  return z.string().transform((raw, ctx): number | null => parseIntegerText(raw, rule, ctx));
}

const wonRule = (label: "판매가" | "원가"): IntegerRule => ({
  max: PRODUCT_LIMITS.wonMax,
  required: `${label}를 입력해 주세요`,
  invalid: `${label}는 숫자로 입력해 주세요`,
  negative: `${label}는 0원 이상이어야 합니다`,
  decimal: `${label}는 원 단위 정수로 입력해 주세요 (소수점은 입력할 수 없습니다)`,
  tooLarge: `${label}는 100억 원 미만으로 입력해 주세요`,
});

const stockRule = (label: "현재 재고" | "안전재고"): IntegerRule => ({
  max: PRODUCT_LIMITS.stockMax,
  required: `${label}를 입력해 주세요`,
  invalid: `${label}는 숫자로 입력해 주세요`,
  negative: `${label}는 0개 이상이어야 합니다`,
  decimal: `${label}는 소수점 없이 정수로 입력해 주세요`,
  tooLarge: `${label}는 2,147,483,647개 이하로 입력해 주세요`,
});

const categories: readonly string[] = PRODUCT_CATEGORIES;

/** 상품 등록·수정 공통 입력 스키마 */
export const productInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "상품명을 입력해 주세요")
    .max(PRODUCT_LIMITS.nameMax, `상품명은 ${PRODUCT_LIMITS.nameMax}자 이하로 입력해 주세요`)
    .refine((v) => !CONTROL_CHARS.test(v), "상품명에는 줄바꿈이나 탭을 넣을 수 없습니다"),

  sku: z
    .string()
    .trim()
    .toUpperCase()
    .min(1, "SKU를 입력해 주세요")
    .regex(SKU_PATTERN, "SKU는 영문, 숫자, -, _ 로 2~40자 입력해 주세요 (첫 글자는 영문 또는 숫자)"),

  category: z
    .string()
    .trim()
    .refine((v) => v === "" || categories.includes(v), "카테고리를 목록에서 선택해 주세요")
    .transform((v) => (v === "" ? null : (v as ProductCategory))),

  status: z.enum(PRODUCT_STATUSES, { error: "판매 상태를 선택해 주세요" }),

  price: requiredInteger(wonRule("판매가")),
  cost: optionalInteger(wonRule("원가")),
  stock_quantity: requiredInteger(stockRule("현재 재고")),
  safety_stock: requiredInteger(stockRule("안전재고")),

  description: z
    .string()
    .transform((v) => v.replace(/\r\n/g, "\n").trim())
    .pipe(
      z
        .string()
        .max(
          PRODUCT_LIMITS.descriptionMax,
          `상품 설명은 ${PRODUCT_LIMITS.descriptionMax.toLocaleString("ko-KR")}자 이하로 입력해 주세요`,
        ),
    )
    .transform((v) => (v === "" ? null : v)),

  image_path: z
    .string()
    .trim()
    .refine((v) => v === "" || IMAGE_PATH_PATTERN.test(v), "이미지 정보가 올바르지 않습니다")
    .transform((v) => (v === "" ? null : v)),
});

/** 상품 ID (Postgres uuid 형식). 형식이 틀리면 DB에 묻지 않고 바로 "없는 상품"으로 처리합니다. */
export const productIdSchema = z.guid({ error: "상품 ID 형식이 올바르지 않습니다" });

/** 상품 수정: 공통 입력 + 대상 ID + 불러온 시점의 updated_at (수정 충돌 검사용) */
export const productUpdateSchema = productInputSchema.extend({
  id: productIdSchema,
  updated_at: z.string().min(1, "수정 기준 시각이 없습니다. 페이지를 새로고침해 주세요"),
});

/** 폼이 다루는 값 (모두 문자열) */
export type ProductFormValues = z.input<typeof productInputSchema>;
/** 검증을 통과해 DB에 넣을 수 있는 값 */
export type ProductInput = z.output<typeof productInputSchema>;
export type ProductUpdateInput = z.output<typeof productUpdateSchema>;
export type ProductFormField = keyof ProductFormValues;

export const PRODUCT_FORM_FIELDS = [
  "name",
  "sku",
  "category",
  "status",
  "price",
  "cost",
  "stock_quantity",
  "safety_stock",
  "description",
  "image_path",
] as const satisfies ReadonlyArray<ProductFormField>;

/** FormData → 문자열 객체. 없는 값이나 파일은 빈 문자열로 바꿔 스키마가 한국어 오류를 내게 합니다. */
export function readFormFields<K extends string>(formData: FormData, keys: readonly K[]) {
  const values = {} as Record<K, string>;
  for (const key of keys) {
    const value = formData.get(key);
    values[key] = typeof value === "string" ? value : "";
  }
  return values;
}

// ─────────────────────────────────────────────────────────────
// 목록 URL 파라미터: 잘못된 값은 오류 대신 기본값으로 바꿉니다.
// ─────────────────────────────────────────────────────────────

const firstValue = (v: unknown) => (Array.isArray(v) ? v[0] : v);

export const productListParamsSchema = z.object({
  q: z.preprocess(firstValue, z.string().trim().max(PRODUCT_LIMITS.searchMax)).catch(""),
  category: z.preprocess(firstValue, z.enum(PRODUCT_CATEGORIES).nullable()).catch(null),
  stock: z.preprocess(firstValue, z.literal("low").nullable()).catch(null),
  sort: z.preprocess(firstValue, z.enum(PRODUCT_SORTS)).catch("latest"),
  page: z
    .preprocess(
      firstValue,
      z
        .string()
        .regex(/^\d{1,6}$/)
        .transform(Number)
        .pipe(z.number().int().min(1)),
    )
    .catch(1),
});

export type ProductListParams = z.output<typeof productListParamsSchema>;

export function parseProductListParams(
  searchParams: Record<string, string | string[] | undefined>,
): ProductListParams {
  return productListParamsSchema.parse({
    q: searchParams.q ?? "",
    category: searchParams.category ?? null,
    stock: searchParams.stock ?? null,
    sort: searchParams.sort ?? "latest",
    page: searchParams.page ?? "1",
  });
}

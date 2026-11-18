"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useRef, useState, useTransition, type FormEvent } from "react";
import { Alert } from "@/components/ui/alert";
import { Button, buttonClass } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input, InputWithSuffix, Select, Textarea } from "@/components/ui/form-controls";
import {
  toFieldErrors,
  type ActionFailureCode,
  type ActionResult,
  type FieldErrors,
} from "@/lib/action-result";
import { cn } from "@/lib/cn";
import { createProduct, updateProduct } from "../actions";
import {
  PRODUCT_CATEGORIES,
  PRODUCT_LIMITS,
  PRODUCT_STATUSES,
  PRODUCT_STATUS_LABELS,
} from "../constants";
import { formatCount, marginRate } from "../format";
import {
  PRODUCT_FORM_FIELDS,
  productInputSchema,
  type ProductFormField,
  type ProductFormValues,
} from "../schema";
import { ImageField } from "./image-field";

/**
 * 상품 등록·수정 공통 폼
 *
 * 검증 흐름
 * 1. 입력칸을 벗어날 때(blur)와 [저장]을 누를 때 브라우저에서 같은 zod 스키마로 검사 (편의용)
 * 2. 통과하면 Server Action 호출 → 서버가 같은 스키마로 다시 검사 (실제 방어선)
 * 3. 서버가 돌려준 항목별 오류는 각 입력칸 아래, 전체 오류는 폼 위쪽에 표시
 * 저장에 실패해도 입력한 내용은 그대로 남습니다.
 */

type Mode =
  | { mode: "create" }
  | { mode: "edit"; productId: string; updatedAt: string };

type Props = Mode & {
  initialValues: ProductFormValues;
  cancelHref: string;
};

/** 입력값 문제가 아닌 실패는 주의(노란색) 안내로, 그 외는 오류(빨간색) 안내로 보여줍니다. */
const FAILURE_TITLES: Partial<Record<ActionFailureCode, string>> = {
  DB_NOT_CONNECTED: "저장되지 않았습니다",
  FORBIDDEN: "지금은 저장할 수 없습니다",
  LIMIT_REACHED: "등록 한도에 도달했습니다",
  CONFLICT: "다른 곳에서 먼저 수정되었습니다",
  NOT_FOUND: "상품을 찾을 수 없습니다",
};

const fieldId = (field: ProductFormField) => `product-${field}`;

function validate(values: ProductFormValues): FieldErrors {
  const result = productInputSchema.safeParse(values);
  return result.success ? {} : toFieldErrors(result.error.issues);
}

type Result = ActionResult<{ id: string }> | null;

export function ProductForm(props: Props) {
  const { initialValues, cancelHref } = props;
  const action = props.mode === "create" ? createProduct : updateProduct;
  const router = useRouter();
  const [state, formAction, actionPending] = useActionState<Result, FormData>(action, null);
  const [transitionPending, startTransition] = useTransition();
  const pending = actionPending || transitionPending;

  const [values, setValues] = useState<ProductFormValues>(initialValues);
  const [touched, setTouched] = useState<Partial<Record<ProductFormField, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);
  const [serverErrors, setServerErrors] = useState<FieldErrors>({});
  const [seenState, setSeenState] = useState<Result>(null);
  const alertRef = useRef<HTMLDivElement>(null);

  // 서버 결과가 새로 오면 항목별 오류를 받아 둡니다. (렌더 중 상태 조정)
  if (state !== seenState) {
    setSeenState(state);
    setServerErrors(state && !state.ok ? (state.fieldErrors ?? {}) : {});
  }

  // 서버 결과 안내로 포커스를 옮겨 화면 읽기 프로그램과 키보드 사용자에게 알립니다.
  useEffect(() => {
    if (state && !state.ok) alertRef.current?.focus();
  }, [state]);

  const clientErrors = useMemo(() => validate(values), [values]);
  const errorFor = (field: ProductFormField) =>
    (submitted || touched[field] ? clientErrors[field] : undefined) ?? serverErrors[field];

  const dirty = useMemo(
    () => PRODUCT_FORM_FIELDS.some((f) => values[f] !== initialValues[f]),
    [values, initialValues],
  );

  // 저장하지 않은 내용이 있으면 새로고침·탭 닫기 전에 경고합니다.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const set = (field: ProductFormField) => (value: string) => {
    setValues((prev) => ({ ...prev, [field]: value }));
    if (serverErrors[field]) setServerErrors((prev) => ({ ...prev, [field]: undefined }));
  };
  const blur = (field: ProductFormField) => () => setTouched((prev) => ({ ...prev, [field]: true }));

  const bind = (field: ProductFormField) => ({
    name: field,
    value: values[field],
    onChange: (e: { target: { value: string } }) => set(field)(e.target.value),
    onBlur: blur(field),
    disabled: pending,
  });

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (pending) return; // 중복 제출 방지
    setSubmitted(true);

    const errors = validate(values);
    const first = PRODUCT_FORM_FIELDS.find((f) => errors[f]);
    if (first) {
      document.getElementById(fieldId(first))?.focus();
      return;
    }

    const formData = new FormData();
    for (const field of PRODUCT_FORM_FIELDS) formData.set(field, values[field]);
    if (props.mode === "edit") {
      formData.set("id", props.productId);
      formData.set("updated_at", props.updatedAt); // DB 문자열 그대로 (Date 변환 금지)
    }
    startTransition(() => formAction(formData));
  };

  const price = productInputSchema.shape.price.safeParse(values.price);
  const cost = productInputSchema.shape.cost.safeParse(values.cost);
  const margin = marginRate(price.success ? price.data : null, cost.success ? cost.data : null);

  const failure = state && !state.ok ? state : null;
  const submitLabel = props.mode === "create" ? "등록하기" : "수정 내용 저장";

  return (
    <form onSubmit={handleSubmit} noValidate aria-busy={pending}>
      {failure && (
        <div ref={alertRef} tabIndex={-1} className="mb-5 outline-none">
          <Alert
            tone={FAILURE_TITLES[failure.code] ? "warning" : "danger"}
            title={FAILURE_TITLES[failure.code] ?? "저장하지 못했습니다"}
            live="assertive"
          >
            {failure.message}
            {failure.code === "CONFLICT" && (
              <Button
                type="button"
                variant="secondary"
                className="mt-2.5"
                onClick={() => {
                  if (window.confirm("지금 입력한 내용은 사라지고 최신 내용으로 바뀝니다. 불러올까요?")) {
                    router.refresh(); // 수정 폼은 updated_at 이 바뀌면 최신 값으로 다시 그려집니다.
                  }
                }}
              >
                최신 내용 불러오기
              </Button>
            )}
            {failure.code === "NOT_FOUND" && (
              <Link href="/products" className={cn(buttonClass({ variant: "secondary" }), "mt-2.5")}>
                상품 목록으로
              </Link>
            )}
          </Alert>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="기본 정보" />
            <CardBody className="grid gap-5 sm:grid-cols-2">
              <Field
                id={fieldId("name")}
                label="상품명"
                required
                error={errorFor("name")}
                className="sm:col-span-2"
              >
                {(a) => (
                  <Input {...a} {...bind("name")} maxLength={PRODUCT_LIMITS.nameMax + 20} placeholder="예) 유기농 녹차 티백 50입" />
                )}
              </Field>

              <Field
                id={fieldId("sku")}
                label="SKU (상품 코드)"
                required
                hint="영문, 숫자, -, _ 로 2~40자. 저장할 때 대문자로 바뀝니다."
                error={errorFor("sku")}
              >
                {(a) => (
                  <Input
                    {...a}
                    {...bind("sku")}
                    maxLength={PRODUCT_LIMITS.skuMax + 10}
                    autoCapitalize="characters"
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="예) TEA-GRN-050"
                    className="font-mono uppercase placeholder:font-sans placeholder:normal-case"
                  />
                )}
              </Field>

              <Field id={fieldId("category")} label="카테고리" error={errorFor("category")}>
                {(a) => (
                  <Select {...a} {...bind("category")}>
                    <option value="">선택 안 함</option>
                    {PRODUCT_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>

              <Field
                id={fieldId("description")}
                label="상품 설명"
                hint={`${formatCount(values.description.length)} / ${formatCount(PRODUCT_LIMITS.descriptionMax)}자`}
                error={errorFor("description")}
                className="sm:col-span-2"
              >
                {(a) => <Textarea {...a} {...bind("description")} rows={4} placeholder="상품의 특징을 적어 주세요 (선택)" />}
              </Field>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="가격 · 재고" description="금액은 원 단위 정수, 재고는 개수(정수)로 입력합니다." />
            <CardBody className="grid gap-5 sm:grid-cols-2">
              <Field id={fieldId("price")} label="판매가" required error={errorFor("price")}>
                {(a) => (
                  <InputWithSuffix suffix="원">
                    <Input {...a} {...bind("price")} inputMode="numeric" placeholder="0" className="pr-9 text-right" />
                  </InputWithSuffix>
                )}
              </Field>

              <Field
                id={fieldId("cost")}
                label="원가"
                hint={margin === null ? "선택 입력" : `마진율 ${margin}% (참고용)`}
                error={errorFor("cost")}
              >
                {(a) => (
                  <InputWithSuffix suffix="원">
                    <Input {...a} {...bind("cost")} inputMode="numeric" placeholder="0" className="pr-9 text-right" />
                  </InputWithSuffix>
                )}
              </Field>

              <Field id={fieldId("stock_quantity")} label="현재 재고" required error={errorFor("stock_quantity")}>
                {(a) => (
                  <InputWithSuffix suffix="개">
                    <Input {...a} {...bind("stock_quantity")} inputMode="numeric" placeholder="0" className="pr-9 text-right" />
                  </InputWithSuffix>
                )}
              </Field>

              <Field
                id={fieldId("safety_stock")}
                label="안전재고"
                required
                hint="현재 재고가 이 수량 이하가 되면 ‘재고 부족’으로 표시됩니다."
                error={errorFor("safety_stock")}
              >
                {(a) => (
                  <InputWithSuffix suffix="개">
                    <Input {...a} {...bind("safety_stock")} inputMode="numeric" placeholder="0" className="pr-9 text-right" />
                  </InputWithSuffix>
                )}
              </Field>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="판매 상태" />
            <CardBody>
              <fieldset disabled={pending}>
                <legend className="sr-only">판매 상태</legend>
                <div className="grid grid-cols-2 gap-1 rounded-control bg-surface-sunken p-1">
                  {PRODUCT_STATUSES.map((s) => (
                    <label
                      key={s}
                      className={cn(
                        "flex h-9 cursor-pointer items-center justify-center rounded-[5px] text-sm transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent",
                        values.status === s
                          ? "bg-surface font-semibold text-ink shadow-card"
                          : "text-ink-secondary hover:text-ink",
                      )}
                    >
                      <input
                        type="radio"
                        name="status"
                        value={s}
                        checked={values.status === s}
                        onChange={() => set("status")(s)}
                        className="sr-only"
                      />
                      {PRODUCT_STATUS_LABELS[s]}
                    </label>
                  ))}
                </div>
                {errorFor("status") && <p className="mt-1.5 text-[13px] text-danger">{errorFor("status")}</p>}
              </fieldset>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="상품 이미지" />
            <CardBody>
              <ImageField />
            </CardBody>
          </Card>
        </div>
      </div>

      <div className="sticky bottom-0 z-10 -mx-4 mt-6 flex items-center justify-end gap-2 border-t border-line bg-canvas/95 px-4 py-4 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <Link
          href={cancelHref}
          onClick={(e) => {
            if (pending || (dirty && !window.confirm("저장하지 않은 내용이 있습니다. 이 페이지를 떠날까요?"))) {
              e.preventDefault();
            }
          }}
          aria-disabled={pending || undefined}
          className={buttonClass({ variant: "secondary" })}
        >
          취소
        </Link>
        <Button type="submit" loading={pending} loadingText="저장 중…">
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

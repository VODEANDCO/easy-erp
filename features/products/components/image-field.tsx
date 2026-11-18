"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ImageIcon, UploadIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { createClient } from "@/lib/supabase/client";
import { PRODUCT_IMAGE, PRODUCT_IMAGE_STORAGE } from "../constants";
import { validateImageFile } from "../image";
import { requestImageUpload, verifyImageUpload } from "../image-actions";
import { ProductImage } from "./product-image";

/**
 * 상품 이미지 칸 (끌어다 놓기 지원)
 *
 * 등록 화면 흐름 (docs/specs/storage.md)
 * 1. 브라우저 1차 검사(형식·크기·매직 바이트) + 미리보기
 * 2. 서버에 1회용 업로드 허가 요청 (requestImageUpload)
 * 3. 공개 키로 Storage 에 직접 업로드 (파일은 Next.js 서버를 거치지 않음)
 * 4. 서버가 실제 내용 확인 (verifyImageUpload) → 통과해야 폼에 image_path 를 넣음
 * 업로드·확인 중이거나 실패 상태로 남아 있으면 부모 폼이 [저장]을 막습니다. (onPendingChange)
 * 상품 저장 시 서버가 한 번 더 확인합니다.
 *
 * 수정 화면: 이번 단계(5-A)에서는 현재 이미지를 보기만 합니다. 교체·제거는 다음 단계(5-B)입니다.
 */

type Phase = "idle" | "checking" | "uploading" | "verifying" | "done" | "upload_failed" | "verify_failed";

const PENDING_PHASES: ReadonlySet<Phase> = new Set(["checking", "uploading", "verifying", "upload_failed", "verify_failed"]);

const STATUS_TEXT: Partial<Record<Phase, string>> = {
  checking: "파일을 확인하는 중…",
  uploading: "이미지를 올리는 중…",
  verifying: "올린 이미지를 확인하는 중…",
  done: "이미지 업로드 완료",
};

type Props = {
  mode: "create" | "edit";
  /** 수정 화면에서 보여줄 현재 이미지 경로 */
  existingImagePath?: string | null;
  productName?: string;
  disabled?: boolean;
  /** 상품 저장 시 서버가 돌려준 이미지 칸 오류 */
  serverError?: string;
  onChange: (imagePath: string) => void;
  onPendingChange: (pending: boolean) => void;
};

export function ImageField(props: Props) {
  if (props.mode === "edit") {
    return (
      <div className="space-y-3">
        <ProductImage name={props.productName ?? "상품"} imagePath={props.existingImagePath} size="lg" />
        <p className="text-[13px] leading-relaxed text-ink-muted">
          이미지 변경·제거는 다음 업데이트에서 지원합니다. 지금은 수정해도 기존 이미지가 그대로 유지됩니다.
        </p>
      </div>
    );
  }
  return <UploadImageField {...props} />;
}

function UploadImageField({ disabled, serverError, onChange, onPendingChange }: Props) {
  const inputId = useId();
  const hintId = useId();
  const errorId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const attemptRef = useRef(0); // 새 파일을 고르거나 제거하면 이전 요청의 결과는 무시합니다.
  const fileRef = useRef<File | null>(null);
  const pathRef = useRef<string | null>(null);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [dragOver, setDragOver] = useState(false);

  const pending = PENDING_PHASES.has(phase);
  const working = phase === "checking" || phase === "uploading" || phase === "verifying";

  useEffect(() => {
    onPendingChange(pending);
  }, [pending, onPendingChange]);

  // 미리보기용 임시 URL 은 바뀌거나 화면을 떠날 때 해제합니다.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const reset = () => {
    attemptRef.current += 1;
    fileRef.current = null;
    pathRef.current = null;
    setPreviewUrl(null);
    setFileName(null);
    setPhase("idle");
    onChange("");
    if (inputRef.current) inputRef.current.value = "";
  };

  const verify = async (path: string, attempt: number) => {
    setPhase("verifying");
    setError(null);
    try {
      const result = await verifyImageUpload(path);
      if (attempt !== attemptRef.current) return;
      if (result.ok) {
        onChange(result.data.path);
        setPhase("done");
        return;
      }
      if (result.code === "UNKNOWN") {
        // 확인 요청만 실패: 파일은 남아 있으므로 [다시 확인] 으로 이어갑니다.
        setError(result.message);
        setPhase("verify_failed");
        return;
      }
      // 내용이 틀린 파일(서버가 이미 삭제함) 또는 사용할 수 없는 상태 → 처음부터 다시
      const message = result.message;
      reset();
      setError(message);
    } catch {
      if (attempt !== attemptRef.current) return;
      setError("이미지 확인에 실패했습니다. 네트워크를 확인하고 다시 확인해 주세요.");
      setPhase("verify_failed");
    }
  };

  const upload = async (file: File, attempt: number) => {
    setPhase("uploading");
    setError(null);
    try {
      const ticket = await requestImageUpload({ type: file.type, size: file.size });
      if (attempt !== attemptRef.current) return;
      if (!ticket.ok) {
        setError(ticket.message);
        setPhase("upload_failed");
        return;
      }

      const { error: uploadError } = await createClient()
        .storage.from(PRODUCT_IMAGE_STORAGE.bucket)
        .uploadToSignedUrl(ticket.data.path, ticket.data.token, file, {
          contentType: file.type,
          cacheControl: PRODUCT_IMAGE_STORAGE.cacheControlSeconds,
        });
      if (attempt !== attemptRef.current) return;
      if (uploadError) {
        setError("이미지 업로드에 실패했습니다. 네트워크를 확인하고 다시 시도해 주세요.");
        setPhase("upload_failed");
        return;
      }

      pathRef.current = ticket.data.path;
      await verify(ticket.data.path, attempt);
    } catch {
      if (attempt !== attemptRef.current) return;
      setError("이미지 업로드에 실패했습니다. 네트워크를 확인하고 다시 시도해 주세요.");
      setPhase("upload_failed");
    }
  };

  const handleFile = async (file: File | undefined) => {
    if (!file || disabled) return;
    reset();
    const attempt = attemptRef.current;
    setError(null);
    setPhase("checking");

    const message = await validateImageFile(file);
    if (attempt !== attemptRef.current) return;
    if (message) {
      reset();
      setError(message);
      return;
    }

    fileRef.current = file;
    setPreviewUrl(URL.createObjectURL(file));
    setFileName(file.name);
    await upload(file, attempt);
  };

  const retry = () => {
    const attempt = attemptRef.current;
    if (phase === "verify_failed" && pathRef.current) void verify(pathRef.current, attempt);
    else if (phase === "upload_failed" && fileRef.current) void upload(fileRef.current, attempt);
  };

  const shownError = error ?? serverError;
  const statusText = STATUS_TEXT[phase];

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled && !working) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (!working) void handleFile(e.dataTransfer.files[0]);
        }}
        className={cn(
          "relative flex aspect-square w-full flex-col items-center justify-center overflow-hidden rounded-card border border-dashed text-center transition-colors",
          dragOver ? "border-accent bg-accent-soft" : "border-line-strong bg-surface-muted",
          shownError && "border-danger",
        )}
      >
        {previewUrl ? (
          // 브라우저 메모리의 미리보기(blob:)라 next/image 최적화 대상이 아닙니다.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt="선택한 이미지 미리보기"
            className={cn("size-full object-cover", working && "opacity-60")}
          />
        ) : (
          <div className="flex flex-col items-center gap-2 px-6 text-ink-muted">
            <ImageIcon size={32} />
            <p className="text-[13px]">
              이미지를 끌어다 놓거나
              <br />
              아래 버튼으로 선택하세요
            </p>
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={PRODUCT_IMAGE.accept}
        className="sr-only"
        disabled={disabled || working}
        aria-describedby={[shownError ? errorId : null, hintId].filter(Boolean).join(" ")}
        aria-invalid={shownError ? true : undefined}
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />
      <div className="flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          className="flex-1"
          loading={working}
          loadingText={statusText ?? "처리 중…"}
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
        >
          <UploadIcon size={14} />
          {previewUrl ? "다른 이미지 선택" : "이미지 선택"}
        </Button>
        {(phase === "upload_failed" || phase === "verify_failed") && (
          <Button variant="secondary" size="sm" disabled={disabled} onClick={retry}>
            {phase === "verify_failed" ? "다시 확인" : "다시 시도"}
          </Button>
        )}
        {previewUrl && !working && (
          <Button variant="ghost" size="sm" disabled={disabled} onClick={reset}>
            제거
          </Button>
        )}
      </div>
      <label htmlFor={inputId} className="sr-only">
        상품 이미지 파일
      </label>

      <p role="status" className="min-h-0 text-[13px] text-ink-secondary empty:hidden">
        {statusText ?? ""}
      </p>
      {fileName && <p className="truncate text-[13px] text-ink-secondary">{fileName}</p>}
      {shownError && (
        <p id={errorId} role="alert" className="text-[13px] text-danger">
          {shownError}
        </p>
      )}
      <p id={hintId} className="text-[13px] leading-relaxed text-ink-muted">
        JPEG, PNG, WebP · 5MB 이하 · 1장
        <br />
        <span className="text-warning">
          데모 이미지만 올려 주세요. 올린 이미지는 주소를 아는 누구나 볼 수 있고, 사진 속 위치 정보도 함께 공개될 수 있습니다.
        </span>
      </p>
    </div>
  );
}

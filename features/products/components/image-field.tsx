"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ImageIcon, UploadIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { PRODUCT_IMAGE } from "../constants";
import { validateImageFile } from "../image";

/**
 * 상품 이미지 선택 칸 (끌어다 놓기 지원)
 *
 * 지금 동작하는 것: 파일 형식·크기·매직 바이트 검사, 미리보기, 제거
 * 아직 안 되는 것: Storage 업로드 (Phase 5). 그래서 선택한 파일은 서버로 보내지 않습니다.
 */
export function ImageField() {
  const inputId = useId();
  const hintId = useId();
  const errorId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  // 미리보기용 임시 URL 은 바뀌거나 화면을 떠날 때 해제합니다.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const clear = () => {
    setPreviewUrl(null);
    setFileName(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setChecking(true);
    setError(null);
    const message = await validateImageFile(file);
    setChecking(false);
    if (message) {
      clear();
      setError(message);
      return;
    }
    setPreviewUrl(URL.createObjectURL(file));
    setFileName(file.name);
  };

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          void handleFile(e.dataTransfer.files[0]);
        }}
        className={cn(
          "relative flex aspect-square w-full flex-col items-center justify-center overflow-hidden rounded-card border border-dashed text-center transition-colors",
          dragOver ? "border-accent bg-accent-soft" : "border-line-strong bg-surface-muted",
          error && "border-danger",
        )}
      >
        {previewUrl ? (
          // 브라우저 메모리의 미리보기(blob:)라 next/image 최적화 대상이 아닙니다.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt="선택한 이미지 미리보기" className="size-full object-cover" />
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
        aria-describedby={[error ? errorId : null, hintId].filter(Boolean).join(" ")}
        aria-invalid={error ? true : undefined}
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />
      <div className="flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          className="flex-1"
          loading={checking}
          loadingText="확인 중…"
          onClick={() => inputRef.current?.click()}
        >
          <UploadIcon size={14} />
          {previewUrl ? "다른 이미지 선택" : "이미지 선택"}
        </Button>
        {previewUrl && (
          <Button variant="ghost" size="sm" onClick={clear}>
            제거
          </Button>
        )}
      </div>
      <label htmlFor={inputId} className="sr-only">
        상품 이미지 파일
      </label>

      {fileName && <p className="truncate text-[13px] text-ink-secondary">{fileName}</p>}
      {error && (
        <p id={errorId} role="alert" className="text-[13px] text-danger">
          {error}
        </p>
      )}
      <p id={hintId} className="text-[13px] leading-relaxed text-ink-muted">
        JPEG, PNG, WebP · 5MB 이하 · 1장
        <br />
        <span className="text-warning">Storage 연결 전이라 지금은 미리보기만 확인할 수 있고, 저장되지 않습니다.</span>
      </p>
    </div>
  );
}

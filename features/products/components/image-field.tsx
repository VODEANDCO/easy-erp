"use client";

import { useEffect, useId, useRef, useState, type RefObject } from "react";
import { Button } from "@/components/ui/button";
import { ImageIcon, UploadIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { createClient } from "@/lib/supabase/client";
import { PRODUCT_IMAGE, PRODUCT_IMAGE_STORAGE } from "../constants";
import { validateImageFile } from "../image";
import { discardImageUpload, requestImageUpload, verifyImageUpload } from "../image-actions";
import { ProductImage } from "./product-image";

/**
 * 상품 이미지 칸 (등록·수정 공용, 끌어다 놓기 지원)
 *
 * 업로드 흐름 (docs/specs/storage.md)
 * 1. 브라우저 1차 검사(형식·크기·매직 바이트) + 미리보기
 * 2. 서버에 1회용 업로드 허가 요청 (requestImageUpload) → 경로·업로드 토큰·폐기 서명(discardKey)
 * 3. 공개 키로 Storage 에 직접 업로드 (파일은 Next.js 서버를 거치지 않음)
 * 4. 서버가 실제 내용 확인 (verifyImageUpload) → 통과해야 폼에 image_path 를 넣음
 * 상품 저장 시 서버가 한 번 더 확인합니다.
 *
 * 미사용 업로드 폐기 (5-B · 정리 상태 표시)
 * - "이 화면에서 새로 올렸고 아직 저장되지 않은 파일"만 폐기합니다. 원래 저장된 이미지는 폐기 대상이 아닙니다.
 * - 다른 파일로 바꾸거나 [제거]·[되돌리기]를 누르면 화면은 바로 바뀌고, 버려진 업로드는 "정리 대기 목록"으로 옮겨
 *   서버 응답을 받을 때까지 상태를 표시합니다. (정리 중 → 완료 / 응답 지연 / 실패 / 거부)
 *   · 정리 중(응답 대기 20초 이내)에는 [저장]을 막습니다. Next.js 는 Server Action 을 한 번에 하나씩 보내므로,
 *     정리 중에 저장하면 저장이 정리 뒤에서 기다리게 되기 때문입니다.
 *   · 20초가 지나면 "응답 지연"으로 안내만 바꾸고 [저장]을 다시 허용합니다. 첫 요청은 버리지 않고 결과를 기다립니다.
 *   · 같은 파일의 요청이 끝나기 전에는 다시 보내지 않습니다. (자동 재시도는 실패 응답 뒤 1회, 수동은 [정리 다시 시도])
 *   · 정리에 실패해도 상품 저장은 막지 않습니다.
 * - 저장 요청 중이거나 저장이 끝난 뒤에는 "현재 선택된 업로드"를 폐기하지 않습니다. (discardBlockedRef · 부모 폼이 관리)
 *   정리 대기 목록의 파일은 저장 대상이 아니므로 저장 중에도 정리해도 안전합니다.
 * - 서버도 DB 에 연결된 파일은 삭제하지 않습니다. (이중 보호)
 * - 한계: 브라우저·탭을 닫으면 폐기 요청이 전송된다는 보장이 없어 파일이 남을 수 있습니다.
 *   정리 중·실패 항목이 있으면 새로고침·탭 닫기 전에 브라우저 경고를 띄웁니다.
 *
 * 수정 화면: 원래 이미지를 [제거]해도 이 화면에서는 아무 파일도 지우지 않습니다.
 *           저장이 성공한 뒤 서버가 이전 이미지를 정리합니다.
 */

type Phase = "idle" | "checking" | "uploading" | "verifying" | "done" | "upload_failed" | "verify_failed";

const PENDING_PHASES: ReadonlySet<Phase> = new Set(["checking", "uploading", "verifying", "upload_failed", "verify_failed"]);

const STATUS_TEXT: Partial<Record<Phase, string>> = {
  checking: "파일을 확인하는 중…",
  uploading: "이미지를 올리는 중…",
  verifying: "올린 이미지를 확인하는 중…",
  done: "이미지 업로드 완료",
};

type Upload = { path: string; discardKey: string };

type Props = {
  mode: "create" | "edit";
  /** 수정 화면: 현재 저장된 이미지 경로 */
  initialImagePath?: string | null;
  productName?: string;
  disabled?: boolean;
  /** true 인 동안(저장 요청 중·저장 성공 후)에는 미사용 업로드를 폐기하지 않습니다. */
  discardBlockedRef: RefObject<boolean>;
  /** 상품 저장 시 서버가 돌려준 이미지 칸 오류 */
  serverError?: string;
  onChange: (imagePath: string) => void;
  onPendingChange: (pending: boolean) => void;
};

/** 정리 대기 목록 항목의 상태 */
type DiscardStatus = "pending" | "delayed" | "failed" | "rejected";
type DiscardItem = { id: number; upload: Upload; status: DiscardStatus };
/** 서버 응답 3가지: 완료 / 다시 시도 가능한 실패 / 거부 (image-actions.ts discardImageUpload) */
type DiscardOutcome = "done" | "retryable" | "rejected";

/** 이 시간이 지나도 응답이 없으면 "응답 지연"으로 안내하고 [저장]을 다시 허용합니다. */
const DISCARD_SLOW_NOTICE_MS = 20_000;
/** 실패 응답 뒤 자동 재시도 전 대기 시간 (1회만) */
const DISCARD_AUTO_RETRY_DELAY_MS = 1_500;

/** 폐기 요청 1회. 브라우저 요청 자체가 실패해도(네트워크 끊김 등) "다시 시도 가능한 실패"로 돌려줍니다. */
async function sendDiscard(upload: Upload): Promise<DiscardOutcome> {
  try {
    const result = await discardImageUpload({ path: upload.path, discardKey: upload.discardKey });
    if (result.ok) return "done";
    return result.code === "UNKNOWN" ? "retryable" : "rejected";
  } catch {
    return "retryable";
  }
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function ImageField({
  mode,
  initialImagePath,
  productName,
  disabled,
  discardBlockedRef,
  serverError,
  onChange,
  onPendingChange,
}: Props) {
  const inputId = useId();
  const hintId = useId();
  const errorId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const attemptRef = useRef(0); // 새 파일을 고르거나 제거하면 이전 요청의 결과는 무시합니다.
  const fileRef = useRef<File | null>(null);
  /** 이 화면에서 올렸고 아직 저장되지 않은 파일 (폐기 대상) */
  const uploadRef = useRef<Upload | null>(null);
  /** 정리 대기 목록: 화면 표시용 상태 + 화면을 떠날 때 읽는 최신값(ref) */
  const [discards, setDiscards] = useState<DiscardItem[]>([]);
  const discardsRef = useRef<DiscardItem[]>([]);
  /** 서버 응답을 기다리는 항목 id. 같은 파일의 요청이 끝나기 전에는 다시 보내지 않습니다. */
  const inFlightRef = useRef<Set<number>>(new Set());
  const discardIdRef = useRef(0);
  const mountedRef = useRef(false);

  const original = mode === "edit" && initialImagePath ? initialImagePath : null;
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [dragOver, setDragOver] = useState(false);
  const [originalRemoved, setOriginalRemoved] = useState(false);

  const pending = PENDING_PHASES.has(phase);
  const working = phase === "checking" || phase === "uploading" || phase === "verifying";
  /** 정리 중(응답 대기 20초 이내)인 항목이 있으면 [저장]을 막습니다. 응답 지연·실패·거부는 막지 않습니다. */
  const discardPending = discards.some((d) => d.status === "pending");
  /** 아직 정리가 끝나지 않은 항목 (거부는 다시 시도할 수 없으므로 제외) → 새로고침·탭 닫기 경고 */
  const discardOutstanding = discards.some((d) => d.status !== "rejected");
  const discardFailed = discards.some((d) => d.status === "failed");

  useEffect(() => {
    onPendingChange(pending || discardPending);
  }, [pending, discardPending, onPendingChange]);

  useEffect(() => {
    discardsRef.current = discards;
  }, [discards]);

  // 정리 중·실패한 업로드가 있으면 새로고침·탭 닫기 전에 경고합니다. (닫으면 정리 요청이 전송된다는 보장이 없음)
  useEffect(() => {
    if (!discardOutstanding) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [discardOutstanding]);

  // 미리보기용 임시 URL 은 바뀌거나 화면을 떠날 때 해제합니다.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  // 저장하지 않고 화면을 떠나면 미사용 업로드를 폐기합니다. (현재 업로드는 저장 중·저장 성공 후에는 하지 않음)
  // 화면이 사라진 뒤에는 결과를 표시할 수 없으므로 요청만 1회 보냅니다.
  useEffect(() => {
    mountedRef.current = true;
    const inFlight = inFlightRef.current;
    return () => {
      mountedRef.current = false;
      // 화면을 떠나는 "그 순간"의 값(저장 중·저장 성공 여부, 정리 대기 목록)이 필요하므로 일부러 최신 ref 값을 읽습니다.
      const upload = uploadRef.current;
      // eslint-disable-next-line react-hooks/exhaustive-deps
      if (upload && !discardBlockedRef.current) void sendDiscard(upload);
      // 실패한 정리 항목만 마지막으로 1회 더 요청합니다. (응답을 기다리는 항목은 이미 요청 중이므로 다시 보내지 않음)
      for (const item of discardsRef.current) {
        if (item.status === "failed" && !inFlight.has(item.id)) void sendDiscard(item.upload);
      }
    };
  }, [discardBlockedRef]);

  const setDiscardStatus = (id: number, status: DiscardStatus, onlyIf?: DiscardStatus) =>
    setDiscards((list) =>
      list.map((d) => (d.id === id && (!onlyIf || d.status === onlyIf) ? { ...d, status } : d)),
    );

  /**
   * 정리 요청 실행. 같은 항목의 요청이 끝나기 전에는 다시 보내지 않습니다.
   * 실패 응답을 받으면 autoRetry 일 때만 1회 자동으로 다시 시도합니다. (같은 요청을 여러 번 보내도 서버에서 안전)
   */
  const runDiscard = async (id: number, upload: Upload, autoRetry: boolean) => {
    if (inFlightRef.current.has(id)) return;
    inFlightRef.current.add(id);
    setDiscardStatus(id, "pending");
    // 20초가 지나도 응답이 없으면 안내만 "응답 지연"으로 바꿉니다. 요청은 버리지 않고 결과를 계속 기다립니다.
    const slowTimer = setTimeout(() => {
      if (mountedRef.current) setDiscardStatus(id, "delayed", "pending");
    }, DISCARD_SLOW_NOTICE_MS);

    let outcome = await sendDiscard(upload);
    if (outcome === "retryable" && autoRetry) {
      await wait(DISCARD_AUTO_RETRY_DELAY_MS);
      outcome = await sendDiscard(upload);
    }
    clearTimeout(slowTimer);
    inFlightRef.current.delete(id);

    if (!mountedRef.current) return;
    if (outcome === "done") setDiscards((list) => list.filter((d) => d.id !== id));
    else setDiscardStatus(id, outcome === "rejected" ? "rejected" : "failed");
  };

  /** 버려진 업로드를 정리 대기 목록에 넣고 정리를 시작합니다. (화면이 이미 사라졌으면 요청만 1회) */
  const enqueueDiscard = (upload: Upload) => {
    if (!mountedRef.current) {
      void sendDiscard(upload);
      return;
    }
    discardIdRef.current += 1;
    const id = discardIdRef.current;
    setDiscards((list) => [...list, { id, upload, status: "pending" }]);
    void runDiscard(id, upload, true);
  };

  /** [정리 다시 시도]: 실패한 항목만, 요청 중이 아닌 것만 다시 보냅니다. */
  const retryFailedDiscards = () => {
    for (const item of discards) {
      if (item.status === "failed") void runDiscard(item.id, item.upload, false);
    }
  };

  /** 진행 중인 요청을 무시하고, 미사용 업로드를 정리 대기 목록으로 옮기고, 새 업로드 상태를 비웁니다. */
  const clearUpload = () => {
    attemptRef.current += 1;
    const upload = uploadRef.current;
    uploadRef.current = null;
    if (upload) enqueueDiscard(upload);
    fileRef.current = null;
    setPreviewUrl(null);
    setFileName(null);
    setPhase("idle");
    if (inputRef.current) inputRef.current.value = "";
  };

  /** 이미지 없음으로 (수정 화면: 원래 이미지도 저장 시 제거) */
  const removeImage = () => {
    clearUpload();
    setError(null);
    if (original) setOriginalRemoved(true);
    onChange("");
  };

  /** 수정 화면: 원래 이미지로 되돌리기 */
  const restoreOriginal = () => {
    clearUpload();
    setError(null);
    setOriginalRemoved(false);
    onChange(original ?? "");
  };

  /** 새 파일을 고르기 전 상태로 (원래 이미지가 있으면 그 값으로) */
  const resetToBase = () => {
    clearUpload();
    onChange(original && !originalRemoved ? original : "");
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
      // 내용이 틀린 파일(서버가 이미 삭제함) 또는 사용할 수 없는 상태 → 처음 상태로
      const message = result.message;
      resetToBase();
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
      if (attempt !== attemptRef.current) return; // 허가만 받고 업로드 전 → 파일 없음
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
      const uploaded: Upload = { path: ticket.data.path, discardKey: ticket.data.discardKey };
      if (attempt !== attemptRef.current) {
        // 업로드가 끝나기 전에 다른 파일로 바꿨거나 제거함 → 업로드가 끝난 지금 폐기 (먼저 폐기하면 그 뒤 생긴 파일이 남음)
        if (!uploadError) enqueueDiscard(uploaded);
        return;
      }
      if (uploadError) {
        setError("이미지 업로드에 실패했습니다. 네트워크를 확인하고 다시 시도해 주세요.");
        setPhase("upload_failed");
        return;
      }

      uploadRef.current = uploaded;
      await verify(uploaded.path, attempt);
    } catch {
      if (attempt !== attemptRef.current) return;
      setError("이미지 업로드에 실패했습니다. 네트워크를 확인하고 다시 시도해 주세요.");
      setPhase("upload_failed");
    }
  };

  const handleFile = async (file: File | undefined) => {
    if (!file || disabled) return;
    resetToBase();
    const attempt = attemptRef.current;
    setError(null);
    setPhase("checking");

    const message = await validateImageFile(file);
    if (attempt !== attemptRef.current) return;
    if (message) {
      resetToBase();
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
    const path = uploadRef.current?.path;
    if (phase === "verify_failed" && path) void verify(path, attempt);
    else if (phase === "upload_failed" && fileRef.current) void upload(fileRef.current, attempt);
  };

  const shownError = error ?? serverError;
  const statusText = STATUS_TEXT[phase];
  const showingOriginal = !previewUrl && original && !originalRemoved;
  const hasImage = Boolean(previewUrl) || Boolean(showingOriginal);

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
        ) : showingOriginal ? (
          <ProductImage name={productName ?? "상품"} imagePath={original} size="lg" className="border-0" />
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
      <div className="flex flex-wrap gap-2">
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
          {hasImage ? "다른 이미지로 교체" : "이미지 선택"}
        </Button>
        {(phase === "upload_failed" || phase === "verify_failed") && (
          <Button variant="secondary" size="sm" disabled={disabled} onClick={retry}>
            {phase === "verify_failed" ? "다시 확인" : "다시 시도"}
          </Button>
        )}
        {hasImage && !working && (
          <Button variant="ghost" size="sm" disabled={disabled} onClick={removeImage}>
            제거
          </Button>
        )}
        {original && (originalRemoved || previewUrl) && !working && (
          <Button variant="ghost" size="sm" disabled={disabled} onClick={restoreOriginal}>
            되돌리기
          </Button>
        )}
      </div>
      <label htmlFor={inputId} className="sr-only">
        상품 이미지 파일
      </label>

      <p role="status" className="min-h-0 text-[13px] text-ink-secondary empty:hidden">
        {statusText ?? ""}
      </p>
      {original && originalRemoved && !previewUrl && (
        <p className="text-[13px] text-warning">저장하면 기존 이미지가 삭제됩니다. 취소하려면 [되돌리기]를 누르세요.</p>
      )}
      {original && previewUrl && phase === "done" && (
        <p className="text-[13px] text-ink-secondary">저장하면 새 이미지로 바뀌고 기존 이미지는 삭제됩니다.</p>
      )}
      {fileName && <p className="truncate text-[13px] text-ink-secondary">{fileName}</p>}
      {discardPending && (
        <p role="status" className="text-[13px] text-ink-secondary">
          이전에 올린 이미지를 정리하는 중…
        </p>
      )}
      {discards.some((d) => d.status === "delayed") && (
        <p role="status" className="text-[13px] text-warning">
          이전 이미지 정리 응답이 늦어지고 있습니다. 결과를 기다리는 중이며, 지금 저장하면 저장이 늦어질 수 있습니다.
        </p>
      )}
      {discardFailed && (
        <div role="alert" className="space-y-2">
          <p className="text-[13px] text-danger">
            이전에 올린 이미지를 정리하지 못했습니다. 네트워크를 확인한 뒤 [정리 다시 시도]를 눌러 주세요. 상품 저장은
            그대로 할 수 있습니다.
          </p>
          <Button variant="secondary" size="sm" disabled={disabled} onClick={retryFailedDiscards}>
            정리 다시 시도
          </Button>
        </div>
      )}
      {discards.some((d) => d.status === "rejected") && (
        <p className="text-[13px] text-ink-secondary">
          이전에 올린 이미지 일부는 정리할 수 없습니다. 상품 저장에는 영향이 없습니다.
        </p>
      )}
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

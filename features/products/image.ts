import { z } from "zod";
import { PRODUCT_IMAGE, type ProductImageMime } from "./constants";

/**
 * 상품 이미지 파일 검증 (docs/specs/storage.md)
 * 브라우저의 1차 검사와, Phase 5 서버의 업로드 URL 발급·매직 바이트 검사가 함께 씁니다.
 */

/** 파일 형식(선언값)과 크기 */
export const imageFileSchema = z.object({
  type: z.enum(PRODUCT_IMAGE.mimeTypes, { error: "JPEG, PNG, WebP 파일만 올릴 수 있습니다" }),
  size: z
    .number()
    .int()
    .min(1, "빈 파일은 올릴 수 없습니다")
    .max(PRODUCT_IMAGE.maxBytes, "5MB 이하 파일만 올릴 수 있습니다"),
});

/** 파일 앞부분 바이트(매직 바이트)로 실제 형식을 판별합니다. 12바이트면 충분합니다. */
export function detectImageMime(bytes: Uint8Array): ProductImageMime | null {
  const startsWith = (sig: number[], offset = 0) => sig.every((b, i) => bytes[offset + i] === b);

  if (startsWith([0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (startsWith([0x52, 0x49, 0x46, 0x46]) && startsWith([0x57, 0x45, 0x42, 0x50], 8)) {
    return "image/webp";
  }
  return null;
}

export const IMAGE_CONTENT_MISMATCH_MESSAGE =
  "이미지 파일이 손상되었거나 지원하지 않는 형식입니다. 다른 파일을 선택해 주세요";

/**
 * 브라우저에서 파일을 검사합니다. 통과하면 null, 실패하면 오류 문구를 돌려줍니다.
 * (최종 판단은 서버가 다시 합니다)
 */
export async function validateImageFile(file: File): Promise<string | null> {
  const basic = imageFileSchema.safeParse({ type: file.type, size: file.size });
  if (!basic.success) return basic.error.issues[0]?.message ?? "이미지를 확인해 주세요";

  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  if (detectImageMime(head) !== file.type) return IMAGE_CONTENT_MISMATCH_MESSAGE;
  return null;
}

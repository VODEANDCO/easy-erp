# 상품 이미지 저장소 설계 (Supabase Storage)

## 결정 사항

| 항목 | 값 |
|---|---|
| 버킷 | `product-images` (public: 보기만 공개) |
| 허용 형식 | `image/jpeg`, `image/png`, `image/webp` |
| 최대 크기 | 5MB (`5242880` bytes) |
| 파일 경로 | `products/<랜덤 uuid>.<jpg|png|webp>` |
| DB 저장 값 | 경로만 저장 (`products.image_path`), URL은 화면에서 만든다 |
| 이미지 수 | 상품당 1장 (다중 이미지는 Phase 8) |

SQL 초안: [supabase/drafts/002_product_images_storage.sql](../../supabase/drafts/002_product_images_storage.sql)

## 왜 "signed upload URL" 방식인가

| 방식 | 문제 |
|---|---|
| 브라우저 → Server Action으로 파일 전송 | Vercel 함수는 요청 본문이 **4.5MB로 제한**되어 5MB 파일이 실패한다. Next.js Server Action의 기본 한도도 1MB이다. |
| 브라우저가 공개 키로 직접 업로드 | 누구나 무제한으로 업로드할 수 있도록 Storage 정책을 열어야 한다. |
| **서버가 1회용 업로드 URL 발급 → 브라우저가 Storage로 직접 업로드** ✅ | 서버가 형식, 크기, 횟수를 먼저 검사하고, 정해진 경로 하나에만 업로드할 수 있다. 파일이 Vercel을 거치지 않는다. |

## 업로드 흐름

```
[브라우저]                                [Next.js 서버]                 [Supabase Storage]
1. 파일 선택
2. 형식·크기 검사, 미리보기
3. ──── createImageUploadUrl({type, size}) ───▶
                                     4. 형식·크기 재검사, 요청 횟수 제한,
                                        버킷 사용량 800MB 미만인지 확인
                                     5. 경로 products/<uuid>.<ext> 생성
                                     6. secret 키로 createSignedUploadUrl(path)
   ◀──────────────── { path, token } ─────
7. uploadToSignedUrl(path, token, file) ──────────────────────────────────▶ 8. 버킷이 크기·형식 최종 검사
9. 폼의 숨김 필드 image_path = path
10. [등록하기] ─── createProduct(formData) ──▶
                                     11. zod 검증 (경로 형식)
                                     12. 파일이 실제로 있는지, 앞부분(매직 바이트)이
                                         JPEG/PNG/WebP 인지 확인 → 아니면 파일 삭제 후 거부
                                     13. products INSERT
```

- 이미지 업로드는 파일을 고르는 즉시 시작한다. 업로드 중에는 [등록하기] 버튼을 비활성화하고 진행 상태를 보여준다.
- 업로드에 실패하면 "이미지 업로드에 실패했습니다" 메시지와 [다시 시도] 버튼을 보여준다. 이미지 없이 저장할 수도 있다.
- 브라우저에서 확장자뿐 아니라 파일의 실제 형식도 확인한다(이미지로 읽히는지). 최종 검사는 버킷 설정이 한다.

## 표시

- `image_path`가 있으면 `{SUPABASE_URL}/storage/v1/object/public/product-images/{path}`를 `next/image`로 보여준다. `next.config.ts`의 `images.remotePatterns`에 Supabase 도메인을 등록한다.
- 경로가 없거나 이미지를 불러오지 못하면 회색 상자와 상자 아이콘으로 된 기본 플레이스홀더를 보여준다.

## 파일 정리 규칙

| 상황 | 처리 |
|---|---|
| 수정에서 이미지 교체 | 새 파일 업로드 → DB를 새 경로로 UPDATE **성공 후** 이전 파일 삭제 |
| 수정에서 이미지 제거 | DB `image_path = null` 성공 후 기존 파일 삭제 |
| 상품 삭제 | DB DELETE ... RETURNING image_path 성공 후 파일 삭제 |
| 파일 삭제 실패 | 상품 처리는 성공으로 유지하고 서버 로그에 경로를 기록한다(고아 파일) |
| 업로드 후 폼을 버리고 나감 | 고아 파일이 남는다 → Phase 8에서 "DB에 없는 파일 정리" 스크립트를 추가한다. 데모 규모에서는 허용한다 |

> 원칙: **DB가 먼저, 파일 삭제는 나중.** 순서가 반대면 DB 저장이 실패했을 때 상품이 깨진 이미지를 가리키게 된다.

## 보안

- 업로드 URL은 서버만 발급한다. 경로는 서버가 정하므로 사용자가 다른 파일을 덮어쓸 수 없다(`upsert: false`).
- `storage.objects`에는 공개 쓰기 정책이 없다. 공개 키로는 업로드하거나 삭제할 수 없다.
- 상품 등록 시 `image_path`를 그대로 믿지 않는다. 형식을 검사하고 실제로 파일이 있는지 확인한다. DB UNIQUE 제약으로 다른 상품의 이미지를 가로챌 수도 없다.
- 데모 이미지만 올리도록 화면에 안내한다. 개인정보가 담긴 이미지는 올리지 않는다.

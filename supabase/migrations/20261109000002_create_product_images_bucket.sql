-- ═══════════════════════════════════════════════════════════════
-- [v2] 상품 이미지 저장소
--
-- ⚠️ Supabase DB 적용은 아직 승인되지 않았습니다. (migrations 폴더 이동 ≠ 적용 승인)
--    사전 검증: PGlite 메모리 DB (storage 스키마는 흉내만 냄) — 결과는 docs/sql-verification.md
--
-- 설계 요약
--   - 버킷 이름: product-images
--   - public 버킷: 이미지 "보기"(공개 URL)만 누구나 가능. 데모 상품 이미지만 저장.
--   - 업로드: 서버가 발급한 1회용 signed upload URL 로만 가능 (경로는 서버가 결정, 덮어쓰기 금지)
--   - 삭제·목록 조회: 서버(secret 키)만 가능
--   - 파일당 5MB, JPEG/PNG/WebP 제한은 버킷 설정으로 Storage 서버가 강제
--     (단, 형식 검사는 업로드 요청의 Content-Type 기준 → 실제 내용은 서버가 매직 바이트로 재검사)
--
-- 적용 참고
--   - SQL Editor 에서 storage.buckets 에 INSERT 하는 방식은 Supabase 문서에서 안내하는 방식입니다.
--     권한 오류가 나면 대시보드 Storage > New bucket 에서 같은 값으로 만들어도 됩니다.
-- ═══════════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  5242880,                                        -- 5MB (5 * 1024 * 1024)
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public             = excluded.public,
    file_size_limit    = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- storage.objects 에는 의도적으로 어떤 정책도 추가하지 않습니다.
--   - Supabase 는 storage.objects 에 RLS 가 켜져 있어, 정책이 없으면
--     공개 키(anon)로는 업로드·덮어쓰기·삭제·목록 조회가 모두 불가능합니다.
--   - signed upload URL 은 service_role 이 발급한 토큰으로 "정해진 경로 1개"에만 업로드를 허용합니다.
--   - public 버킷의 공개 URL(/object/public/...) 조회는 정책 없이 동작합니다.


-- ═══════════════════════════════════════════════════════════════
-- 버킷 사용량 조회 (참고용 "소프트 한도")
--
-- ⚠️ 이 함수만으로는 800MB 를 "강제"할 수 없습니다.
--   - 서버가 업로드 URL 발급 직전에 사용량을 확인할 뿐이며,
--   - 발급 후 실제 업로드까지 시간 차가 있고(토큰 유효 2시간), 동시에 여러 URL 이 발급될 수 있습니다.
--   - 초과 가능 폭 ≈ (아직 업로드되지 않은 발급 URL 수) × 5MB
--   - 버킷 설정에는 "파일당" 크기 제한만 있고 "버킷 전체" 용량 제한 항목은 확인되지 않았습니다.
--     (Supabase 관리 스키마인 storage.objects 에 직접 트리거를 거는 방식은 사용하지 않습니다.)
-- ═══════════════════════════════════════════════════════════════
create or replace function public.product_images_usage_bytes()
returns bigint
language sql
stable
set search_path = ''
as $$
  select coalesce(sum((metadata ->> 'size')::bigint), 0)
  from storage.objects
  where bucket_id = 'product-images';
$$;

revoke execute on function public.product_images_usage_bytes() from public, anon, authenticated;
grant  execute on function public.product_images_usage_bytes() to service_role;

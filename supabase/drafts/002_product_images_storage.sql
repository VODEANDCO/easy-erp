-- ═══════════════════════════════════════════════════════════════
-- [초안] 002_product_images_storage.sql — 상품 이미지 저장소
--
-- ⚠️ 승인 전 적용 금지.
--
-- 설계 요약
--   - 버킷 이름: product-images
--   - public 버킷: 이미지 "보기"는 공개 URL로 누구나 가능 (데모 상품 이미지만 저장)
--   - 업로드/삭제: storage.objects 에 공개 정책을 만들지 않음
--       → 업로드는 서버가 발급한 1회용 signed upload URL 로만 가능
--       → 삭제는 서버(secret 키)만 가능
--   - 파일 크기·형식 제한을 버킷 자체에 걸어서, 브라우저 검사를 우회해도 저장소가 거부
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
-- (Supabase 는 storage.objects 에 RLS 가 기본으로 켜져 있어, 정책이 없으면 공개 키로는 업로드·삭제·목록조회 불가)


-- ═══════════════════════════════════════════════════════════════
-- 버킷 전체 사용량 확인 (무료 플랜 Storage 1GB 초과 방지)
--   서버가 업로드 URL 을 발급하기 전에 호출해, 한도(예: 800MB)를 넘으면 발급을 거부합니다.
--   상품 300개 × 5MB = 1.5GB 로 무료 한도를 넘을 수 있고, 버려진 업로드 파일도 있기 때문입니다.
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

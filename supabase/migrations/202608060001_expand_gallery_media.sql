alter table public.artworks
add column if not exists video_size_bytes bigint,
add column if not exists original_size_bytes bigint;

alter table public.artworks
drop constraint if exists artworks_slot_check,
drop constraint if exists artworks_video_size_check,
drop constraint if exists artworks_original_size_check;

alter table public.artworks
add constraint artworks_slot_check check (
  slot_id in (
    'corridor-left-01',
    'corridor-left-02',
    'corridor-right-01',
    'corridor-right-02',
    'front-01',
    'front-02',
    'front-03',
    'front-04',
    'left-wall-01',
    'right-wall-01',
    'interior-left-01',
    'interior-right-01',
    'lobby-feature-01'
  )
),
add constraint artworks_video_size_check check (
  video_size_bytes is null or video_size_bytes >= 0
),
add constraint artworks_original_size_check check (
  original_size_bytes is null or original_size_bytes >= 0
);

update storage.buckets
set
  file_size_limit = 47185920,
  allowed_mime_types = array['video/mp4']
where id = 'artwork-videos';

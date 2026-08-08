grant execute on function public.is_admin() to authenticated;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values
  (
    'artwork-videos',
    'artwork-videos',
    true,
    47185920,
    array['video/mp4']
  ),
  (
    'artwork-thumbnails',
    'artwork-thumbnails',
    true,
    5242880,
    array['image/webp', 'image/jpeg']
  )
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can read artwork media"
on storage.objects;

create policy "Public can read artwork media"
on storage.objects
for select
to anon, authenticated
using (
  bucket_id in ('artwork-videos', 'artwork-thumbnails')
);

drop policy if exists "Admin can upload artwork media"
on storage.objects;

create policy "Admin can upload artwork media"
on storage.objects
for insert
to authenticated
with check (
  bucket_id in ('artwork-videos', 'artwork-thumbnails')
  and (select public.is_admin())
);

drop policy if exists "Admin can update artwork media"
on storage.objects;

create policy "Admin can update artwork media"
on storage.objects
for update
to authenticated
using (
  bucket_id in ('artwork-videos', 'artwork-thumbnails')
  and (select public.is_admin())
)
with check (
  bucket_id in ('artwork-videos', 'artwork-thumbnails')
  and (select public.is_admin())
);

drop policy if exists "Admin can delete artwork media"
on storage.objects;

create policy "Admin can delete artwork media"
on storage.objects
for delete
to authenticated
using (
  bucket_id in ('artwork-videos', 'artwork-thumbnails')
  and (select public.is_admin())
);

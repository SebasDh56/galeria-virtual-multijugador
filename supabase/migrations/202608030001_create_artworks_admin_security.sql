create extension if not exists pgcrypto;

create schema if not exists private;

revoke all on schema private from public;
revoke all on schema private from anon, authenticated;

create table private.admin_users (
  singleton boolean primary key default true,
  user_id uuid not null unique references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint admin_users_singleton_check check (singleton = true)
);

comment on table private.admin_users is
  'Allowlist privada que admite un solo administrador.';

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from private.admin_users
    where user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_admin() from public;
revoke all on function public.is_admin() from anon;
grant execute on function public.is_admin() to authenticated;

create table public.artworks (
  id uuid primary key default gen_random_uuid(),
  title varchar(120) not null,
  author varchar(100) not null,
  description varchar(500),
  video_path text not null,
  video_url text not null,
  video_size_bytes bigint,
  original_size_bytes bigint,
  thumbnail_path text not null,
  thumbnail_url text not null,
  slot_id text not null,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint artworks_title_check check (
    char_length(btrim(title)) between 1 and 120
  ),
  constraint artworks_author_check check (
    char_length(btrim(author)) between 1 and 100
  ),
  constraint artworks_description_check check (
    description is null or char_length(description) <= 500
  ),
  constraint artworks_video_path_check check (
    char_length(btrim(video_path)) > 0
  ),
  constraint artworks_video_url_check check (
    char_length(btrim(video_url)) > 0
  ),
  constraint artworks_thumbnail_path_check check (
    char_length(btrim(thumbnail_path)) > 0
  ),
  constraint artworks_thumbnail_url_check check (
    char_length(btrim(thumbnail_url)) > 0
  ),
  constraint artworks_slot_check check (
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
  constraint artworks_video_size_check check (
    video_size_bytes is null or video_size_bytes >= 0
  ),
  constraint artworks_original_size_check check (
    original_size_bytes is null or original_size_bytes >= 0
  )
);

create unique index artworks_active_slot_unique
on public.artworks (slot_id)
where is_active;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger artworks_set_updated_at
before update on public.artworks
for each row
execute function private.set_updated_at();

alter table public.artworks enable row level security;

grant select on table public.artworks to anon, authenticated;
grant insert, update, delete on table public.artworks to authenticated;

create policy "Public can read active artworks"
on public.artworks
for select
to anon, authenticated
using (is_active);

create policy "Admin can read all artworks"
on public.artworks
for select
to authenticated
using ((select public.is_admin()));

create policy "Admin can insert artworks"
on public.artworks
for insert
to authenticated
with check ((select public.is_admin()));

create policy "Admin can update artworks"
on public.artworks
for update
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy "Admin can delete artworks"
on public.artworks
for delete
to authenticated
using ((select public.is_admin()));

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

create policy "Public can read artwork media"
on storage.objects
for select
to anon, authenticated
using (
  bucket_id in ('artwork-videos', 'artwork-thumbnails')
);

create policy "Admin can upload artwork media"
on storage.objects
for insert
to authenticated
with check (
  bucket_id in ('artwork-videos', 'artwork-thumbnails')
  and (select public.is_admin())
);

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

create policy "Admin can delete artwork media"
on storage.objects
for delete
to authenticated
using (
  bucket_id in ('artwork-videos', 'artwork-thumbnails')
  and (select public.is_admin())
);

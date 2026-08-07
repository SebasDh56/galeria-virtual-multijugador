alter table public.artworks
drop constraint if exists artworks_slot_check;

drop index if exists public.artworks_active_slot_unique;
drop index if exists public.artworks_slot_unique;

with ordered_artworks as (
  select
    id,
    row_number() over (order by created_at, id) as position_number
  from public.artworks
),
gallery_slots as (
  select array[
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
  ]::text[] as slot_ids
)
update public.artworks as artwork
set slot_id = gallery_slots.slot_ids[ordered_artworks.position_number::integer]
from ordered_artworks, gallery_slots
where artwork.id = ordered_artworks.id;

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
);

create unique index artworks_slot_unique
on public.artworks (slot_id);

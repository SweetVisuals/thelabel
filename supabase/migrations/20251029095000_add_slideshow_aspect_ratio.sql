-- Add aspect_ratio column to slideshows table
alter table public.slideshows 
add column aspect_ratio text default '9:16' not null;

-- Add comment to document the field
comment on column public.slideshows.aspect_ratio is 'Aspect ratio for slideshow display (e.g., "9:16", "1:1", "16:9")';
-- Add aspect_ratio column to images table
alter table public.images 
add column aspect_ratio text;

-- Add comment to document the field
comment on column public.images.aspect_ratio is 'Aspect ratio of the image (e.g., "9:16", "1:1", "16:9")';
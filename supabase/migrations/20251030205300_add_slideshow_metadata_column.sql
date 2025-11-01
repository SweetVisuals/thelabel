-- Add metadata column to slideshows table to store slideshow data
alter table public.slideshows
add column metadata jsonb;

-- Add comment to document the field
comment on column public.slideshows.metadata is 'JSON metadata containing slideshow data like hashtags, condensedSlides, textOverlays, transitionEffect, musicEnabled';
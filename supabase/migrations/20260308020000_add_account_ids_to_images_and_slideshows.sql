-- Add account_ids to images and slideshows tables
ALTER TABLE public.images ADD COLUMN IF NOT EXISTS account_ids TEXT[] DEFAULT '{}';
ALTER TABLE public.slideshows ADD COLUMN IF NOT EXISTS account_ids TEXT[] DEFAULT '{}';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS images_account_ids_idx ON public.images USING GIN (account_ids);
CREATE INDEX IF NOT EXISTS slideshows_account_ids_idx ON public.slideshows USING GIN (account_ids);
CREATE INDEX IF NOT EXISTS folders_account_ids_idx ON public.folders USING GIN (account_ids);

-- Add account_id (singular) to images and slideshows for organizational location
ALTER TABLE public.images ADD COLUMN IF NOT EXISTS account_id TEXT;
ALTER TABLE public.slideshows ADD COLUMN IF NOT EXISTS account_id TEXT;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS images_account_id_idx ON public.images (account_id);
CREATE INDEX IF NOT EXISTS slideshows_account_id_idx ON public.slideshows (account_id);
CREATE INDEX IF NOT EXISTS folders_account_id_idx ON public.folders (account_id);

ALTER TABLE public.folders ADD COLUMN IF NOT EXISTS account_ids TEXT[] DEFAULT '{}';

-- Migrate existing single account_id to the new array column
UPDATE public.folders 
SET account_ids = ARRAY[account_id] 
WHERE account_id IS NOT NULL;

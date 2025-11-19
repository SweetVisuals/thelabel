-- Setup Supabase Storage policies for image uploads
-- This migration creates the 'images' bucket and sets up RLS policies

-- Create the images bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'images',
  'images',
  true,
  52428800, -- 50MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on storage.objects (should already be enabled, but ensuring)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Policy: Allow authenticated users to upload images to their own user folder
CREATE POLICY "Users can upload images to their own folder" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'images'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Allow authenticated users to view images in their own folder
CREATE POLICY "Users can view images in their own folder" ON storage.objects
FOR SELECT USING (
  bucket_id = 'images'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Allow authenticated users to update images in their own folder
CREATE POLICY "Users can update images in their own folder" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'images'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Allow authenticated users to delete images in their own folder
CREATE POLICY "Users can delete images in their own folder" ON storage.objects
FOR DELETE USING (
  bucket_id = 'images'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
-- Function to delete old consolidated images (older than 14 days)
-- This function can be called manually or via a scheduled job
CREATE OR REPLACE FUNCTION delete_old_consolidated_images(days_old integer DEFAULT 14)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  cutoff_date timestamp with time zone;
  deleted_count integer := 0;
  file_record record;
BEGIN
  -- Calculate cutoff date
  cutoff_date := NOW() - (days_old || ' days')::interval;
  
  -- Delete files older than specified days in consolidated folders
  FOR file_record IN
    SELECT name
    FROM storage.objects
    WHERE bucket_id = 'images'
      AND name LIKE '%/consolidated/%'
      AND created_at < cutoff_date
  LOOP
    -- Delete the file
    DELETE FROM storage.objects
    WHERE bucket_id = 'images'
      AND name = file_record.name;
      
    deleted_count := deleted_count + 1;
    RAISE NOTICE 'Deleted old consolidated image: %', file_record.name;
  END LOOP;
  
  RAISE NOTICE 'Cleanup completed: deleted % consolidated images older than % days', deleted_count, days_old;
  RETURN deleted_count;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION delete_old_consolidated_images(integer) TO authenticated;

-- Example: To run cleanup manually, execute: SELECT delete_old_consolidated_images(14);
-- For automated cleanup, you can set up a cron job or use pg_cron if available

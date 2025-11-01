-- Create slideshow templates table
CREATE TABLE IF NOT EXISTS slideshow_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  title TEXT NOT NULL,
  post_title TEXT,
  caption TEXT NOT NULL,
  hashtags JSONB DEFAULT '[]'::jsonb,
  text_overlays JSONB DEFAULT '[]'::jsonb,
  aspect_ratio TEXT NOT NULL DEFAULT '9:16',
  transition_effect TEXT NOT NULL DEFAULT 'fade' CHECK (transition_effect IN ('fade', 'slide', 'zoom')),
  music_enabled BOOLEAN NOT NULL DEFAULT false,
  preview_image TEXT,
  slide_count INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT valid_slide_count CHECK (slide_count > 0)
);

-- Create index for user lookups
CREATE INDEX IF NOT EXISTS idx_slideshow_templates_user_id ON slideshow_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_slideshow_templates_updated_at ON slideshow_templates(updated_at DESC);

-- Enable RLS
ALTER TABLE slideshow_templates ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own templates" ON slideshow_templates
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own templates" ON slideshow_templates
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own templates" ON slideshow_templates
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own templates" ON slideshow_templates
  FOR DELETE USING (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_slideshow_templates_updated_at 
  BEFORE UPDATE ON slideshow_templates 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();
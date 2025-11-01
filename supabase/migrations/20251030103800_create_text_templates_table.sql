-- Create text templates table for storing reusable text overlays
CREATE TABLE IF NOT EXISTS public.text_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    text_content TEXT NOT NULL,
    slide_index INTEGER NOT NULL DEFAULT 0,
    
    -- Positioning
    x FLOAT NOT NULL DEFAULT 50,
    y FLOAT NOT NULL DEFAULT 50,
    width FLOAT NOT NULL DEFAULT 60,
    height FLOAT NOT NULL DEFAULT 15,
    
    -- Typography
    font_size INTEGER NOT NULL DEFAULT 24,
    color TEXT NOT NULL DEFAULT '#ffffff',
    font_family TEXT NOT NULL DEFAULT 'TikTok Sans',
    font_weight TEXT NOT NULL DEFAULT '400',
    
    -- Alignment
    alignment TEXT NOT NULL DEFAULT 'center' CHECK (alignment IN ('left', 'center', 'right')),
    
    -- Effects
    bold BOOLEAN NOT NULL DEFAULT false,
    italic BOOLEAN NOT NULL DEFAULT false,
    outline BOOLEAN NOT NULL DEFAULT false,
    outline_color TEXT NOT NULL DEFAULT '#000000',
    outline_width FLOAT NOT NULL DEFAULT 1.9,
    outline_position TEXT NOT NULL DEFAULT 'outer' CHECK (outline_position IN ('outer', 'middle', 'inner')),
    glow BOOLEAN NOT NULL DEFAULT false,
    glow_color TEXT NOT NULL DEFAULT '#ffffff',
    glow_intensity INTEGER NOT NULL DEFAULT 5,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure unique template names per user
    UNIQUE(user_id, name)
);

-- Enable RLS (Row Level Security)
ALTER TABLE public.text_templates ENABLE ROW LEVEL SECURITY;

-- Create policies for text templates
CREATE POLICY "Users can view their own text templates" ON public.text_templates
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own text templates" ON public.text_templates
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own text templates" ON public.text_templates
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own text templates" ON public.text_templates
    FOR DELETE USING (auth.uid() = user_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_text_templates_updated_at
    BEFORE UPDATE ON public.text_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE public.text_templates IS 'User-specific text overlay templates that can be reused across slides';
COMMENT ON COLUMN public.text_templates.name IS 'Human-readable name for the template';
COMMENT ON COLUMN public.text_templates.text_content IS 'The actual text content';
COMMENT ON COLUMN public.text_templates.slide_index IS 'Which slide this template was created for (0-based)';
COMMENT ON COLUMN public.text_templates.x IS 'Horizontal position as percentage (0-100)';
COMMENT ON COLUMN public.text_templates.y IS 'Vertical position as percentage (0-100)';
COMMENT ON COLUMN public.text_templates.font_size IS 'Font size in pixels';
COMMENT ON COLUMN public.text_templates.font_family IS 'Font family name';
COMMENT ON COLUMN public.text_templates.alignment IS 'Text alignment: left, center, or right';
COMMENT ON COLUMN public.text_templates.outline_position IS 'Where to draw outline: outer (text-shadow), middle (middle-stroke), inner (filled with transparent text)';

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS text_templates_user_id_idx ON public.text_templates(user_id);
CREATE INDEX IF NOT EXISTS text_templates_slide_index_idx ON public.text_templates(user_id, slide_index);
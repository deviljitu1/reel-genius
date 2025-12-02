-- Add audio_content column to videos table
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS audio_content TEXT;

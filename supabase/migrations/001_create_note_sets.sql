-- Create note_sets table
CREATE TABLE IF NOT EXISTS public.note_sets (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title          text NOT NULL,
  raw_notes      text NOT NULL,
  english_level  text NOT NULL CHECK (english_level IN ('beginner', 'intermediate', 'advanced')),
  generated_content jsonb,
  is_public      boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.note_sets ENABLE ROW LEVEL SECURITY;

-- Owners can do everything on their own rows
CREATE POLICY "owners_all" ON public.note_sets
  FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- Anyone can SELECT public rows
CREATE POLICY "public_read" ON public.note_sets
  FOR SELECT
  USING (is_public = true);

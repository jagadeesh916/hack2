-- Add fork tracking columns
ALTER TABLE public.note_sets
  ADD COLUMN IF NOT EXISTS forked_from uuid REFERENCES public.note_sets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS fork_count integer NOT NULL DEFAULT 0;

-- Function to increment fork_count on the original when a fork is inserted
CREATE OR REPLACE FUNCTION increment_fork_count()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.forked_from IS NOT NULL THEN
    UPDATE public.note_sets
    SET fork_count = fork_count + 1
    WHERE id = NEW.forked_from;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_fork_created ON public.note_sets;
CREATE TRIGGER on_fork_created
  AFTER INSERT ON public.note_sets
  FOR EACH ROW EXECUTE FUNCTION increment_fork_count();

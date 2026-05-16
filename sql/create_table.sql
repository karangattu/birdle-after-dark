CREATE TABLE IF NOT EXISTS public.after_dark_leaderboard (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  score INTEGER NOT NULL,
  game_mode TEXT NOT NULL DEFAULT 'regular',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

GRANT SELECT, INSERT ON TABLE public.after_dark_leaderboard TO anon;

ALTER TABLE public.after_dark_leaderboard ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public select" ON public.after_dark_leaderboard;
CREATE POLICY "Allow public select" ON public.after_dark_leaderboard
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public insert" ON public.after_dark_leaderboard;
CREATE POLICY "Allow public insert" ON public.after_dark_leaderboard
  FOR INSERT WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_after_dark_leaderboard_score ON public.after_dark_leaderboard (score DESC);
CREATE INDEX IF NOT EXISTS idx_after_dark_leaderboard_mode_score ON public.after_dark_leaderboard (game_mode, score DESC);

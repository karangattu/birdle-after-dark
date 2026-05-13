CREATE TABLE after_dark_leaderboard (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  score INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE after_dark_leaderboard ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public select" ON after_dark_leaderboard
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert" ON after_dark_leaderboard
  FOR INSERT WITH CHECK (true);

CREATE INDEX idx_after_dark_leaderboard_score ON after_dark_leaderboard (score DESC);

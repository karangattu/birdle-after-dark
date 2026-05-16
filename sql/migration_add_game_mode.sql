-- Migration: Add game_mode column to after_dark_leaderboard
-- Run this in Supabase SQL Editor to add mode separation

ALTER TABLE public.after_dark_leaderboard
  ADD COLUMN IF NOT EXISTS game_mode TEXT NOT NULL DEFAULT 'regular';

CREATE INDEX IF NOT EXISTS idx_after_dark_leaderboard_mode_score
  ON public.after_dark_leaderboard (game_mode, score DESC);

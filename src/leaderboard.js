import { getSupabaseClient } from './supabase.js';

const TABLE = 'after_dark_leaderboard';
const TOP_N = 5;

export async function fetchHighScore() {
  const supabase = getSupabaseClient();
  if (!supabase) return 0;

  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select('score')
      .order('score', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) return 0;
    return data.score;
  } catch {
    return 0;
  }
}

export async function fetchTopLeaderboard() {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select('name, score')
      .order('score', { ascending: false })
      .limit(TOP_N);

    if (error) return [];
    return data ?? [];
  } catch {
    return [];
  }
}

export async function saveScore(name, score) {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from(TABLE)
      .insert({ name, score })
      .select()
      .single();

    if (error) return null;
    return data;
  } catch {
    return null;
  }
}

export function isTopScore(score, leaderboard) {
  if (leaderboard.length < TOP_N) return true;
  const lowestTopScore = leaderboard[leaderboard.length - 1].score;
  return score >= lowestTopScore;
}

import { getSupabaseClient } from './supabase.js';

const TABLE = 'after_dark_leaderboard';
const TOP_N = 5;
const FETCH_LIMIT = 50;

function deduplicateByBestScore(entries) {
  const bestBy = new Map();

  for (const entry of entries) {
    const current = bestBy.get(entry.name);
    if (!current || entry.score > current.score) {
      bestBy.set(entry.name, entry.score);
    }
  }

  return Array.from(bestBy, ([name, score]) => ({ name, score }))
    .sort((a, b) => b.score - a.score);
}

export async function fetchHighScore(gameMode = 'regular') {
  const supabase = getSupabaseClient();
  if (!supabase) return 0;

  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select('name, score')
      .eq('game_mode', gameMode)
      .order('score', { ascending: false })
      .limit(FETCH_LIMIT);

    if (error) return 0;

    const deduped = deduplicateByBestScore(data ?? []);
    return deduped.length > 0 ? deduped[0].score : 0;
  } catch {
    return 0;
  }
}

export async function fetchTopLeaderboard(gameMode = 'regular') {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select('name, score')
      .eq('game_mode', gameMode)
      .order('score', { ascending: false })
      .limit(FETCH_LIMIT);

    if (error) return [];

    const deduped = deduplicateByBestScore(data ?? []);
    return deduped.slice(0, TOP_N);
  } catch {
    return [];
  }
}

export async function saveScore(name, score, gameMode = 'regular') {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from(TABLE)
      .insert({ name, score, game_mode: gameMode })
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

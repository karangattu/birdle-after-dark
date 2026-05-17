import { getSupabaseClient } from './supabase.js';

const TABLE = 'after_dark_leaderboard';
const TOP_N = 5;
const FETCH_LIMIT = 50;

let activeChannel = null;
let activeGameMode = null;

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

    if (error) {
      console.error('[leaderboard] fetchHighScore error:', error.message);
      return 0;
    }

    const deduped = deduplicateByBestScore(data ?? []);
    return deduped.length > 0 ? deduped[0].score : 0;
  } catch (err) {
    console.error('[leaderboard] fetchHighScore exception:', err);
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

    if (error) {
      console.error('[leaderboard] fetchTopLeaderboard error:', error.message);
      return [];
    }

    const deduped = deduplicateByBestScore(data ?? []);
    return deduped.slice(0, TOP_N);
  } catch (err) {
    console.error('[leaderboard] fetchTopLeaderboard exception:', err);
    return [];
  }
}

export async function saveScore(name, score, gameMode = 'regular') {
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.error('[leaderboard] saveScore: no Supabase client');
    return null;
  }

  try {
    const { data, error } = await supabase
      .from(TABLE)
      .insert({ name, score, game_mode: gameMode })
      .select()
      .single();

    if (error) {
      console.error('[leaderboard] saveScore error:', error.message, { name, score, gameMode });
      return null;
    }
    return data;
  } catch (err) {
    console.error('[leaderboard] saveScore exception:', err);
    return null;
  }
}

export function isTopScore(score, leaderboard) {
  if (leaderboard.length < TOP_N) return true;
  const lowestTopScore = leaderboard[leaderboard.length - 1].score;
  return score >= lowestTopScore;
}

export function subscribeToLeaderboard(gameMode, onUpdate) {
  unsubscribeFromLeaderboard();
  const supabase = getSupabaseClient();
  if (!supabase) return;

  activeGameMode = gameMode;

  activeChannel = supabase
    .channel('leaderboard-changes')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: TABLE, filter: `game_mode=eq.${gameMode}` },
      () => { onUpdate(gameMode); }
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('[leaderboard] realtime subscribed for', gameMode);
      }
      if (status === 'CHANNEL_ERROR') {
        console.error('[leaderboard] realtime subscription error');
      }
    });
}

export function unsubscribeFromLeaderboard() {
  if (activeChannel) {
    const supabase = getSupabaseClient();
    if (supabase) {
      supabase.removeChannel(activeChannel);
    }
    activeChannel = null;
    activeGameMode = null;
  }
}
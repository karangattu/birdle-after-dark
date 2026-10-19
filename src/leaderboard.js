import { getSupabaseClient } from './supabase.js';
import {
  countPendingScores,
  getDefaultStorage,
  mergeLeaderboardEntries,
  queuePendingScore,
  readCachedLeaderboard,
  readPendingScores,
  removePendingScore,
  writeCachedLeaderboard,
  writePendingScores,
} from './offlineScores.js';

const TABLE = 'after_dark_leaderboard';
const TOP_N = 5;
const FETCH_LIMIT = 50;

let activeChannel = null;

/**
 * The browser/WebView reports the device connection state. A truthy value does
 * not guarantee the server is reachable, so failed requests are queued too.
 */
export function isOnline() {
  if (typeof navigator === 'undefined') {
    return true;
  }

  return navigator.onLine !== false;
}

function getCachedHighScore(storage, gameMode) {
  const cached = readCachedLeaderboard(storage, gameMode);
  return cached.length > 0 ? cached[0].score : 0;
}

export async function fetchHighScore(gameMode = 'regular', { storage = getDefaultStorage() } = {}) {
  const supabase = getSupabaseClient();
  if (!supabase) return getCachedHighScore(storage, gameMode);

  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select('name, score')
      .eq('game_mode', gameMode)
      .order('score', { ascending: false })
      .limit(FETCH_LIMIT);

    if (error) {
      console.error('[leaderboard] fetchHighScore error:', error.message);
      return getCachedHighScore(storage, gameMode);
    }

    const deduped = mergeLeaderboardEntries(data ?? []);
    writeCachedLeaderboard(storage, gameMode, deduped);
    return deduped.length > 0 ? deduped[0].score : 0;
  } catch (err) {
    console.error('[leaderboard] fetchHighScore exception:', err);
    return getCachedHighScore(storage, gameMode);
  }
}

export async function fetchTopLeaderboard(gameMode = 'regular', { storage = getDefaultStorage() } = {}) {
  const supabase = getSupabaseClient();
  if (!supabase) return readCachedLeaderboard(storage, gameMode).slice(0, TOP_N);

  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select('name, score')
      .eq('game_mode', gameMode)
      .order('score', { ascending: false })
      .limit(FETCH_LIMIT);

    if (error) {
      console.error('[leaderboard] fetchTopLeaderboard error:', error.message);
      return readCachedLeaderboard(storage, gameMode).slice(0, TOP_N);
    }

    const deduped = mergeLeaderboardEntries(data ?? []);
    writeCachedLeaderboard(storage, gameMode, deduped);
    return deduped.slice(0, TOP_N);
  } catch (err) {
    console.error('[leaderboard] fetchTopLeaderboard exception:', err);
    return readCachedLeaderboard(storage, gameMode).slice(0, TOP_N);
  }
}

/**
 * Saves a score to the online leaderboard. When the device is offline (or the
 * request fails) the score is stored on the device instead and uploaded later.
 */
export async function saveScore(
  name,
  score,
  gameMode = 'regular',
  { storage = getDefaultStorage() } = {},
) {
  const entry = { name: String(name ?? '').trim(), score: Math.round(Number(score)) || 0, gameMode };

  if (!entry.name) {
    return { status: 'invalid' };
  }

  if (!isOnline()) {
    queuePendingScore(storage, entry);
    return { status: 'queued', reason: 'offline' };
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    queuePendingScore(storage, entry);
    return { status: 'queued', reason: 'no-client' };
  }

  try {
    const { data, error } = await supabase
      .from(TABLE)
      .insert({ name: entry.name, score: entry.score, game_mode: gameMode })
      .select()
      .single();

    if (error) {
      console.error('[leaderboard] saveScore error:', error.message, entry);
      queuePendingScore(storage, entry);
      return { status: 'queued', reason: 'error', error: error.message };
    }

    removePendingScore(storage, entry);
    return { status: 'saved', data };
  } catch (err) {
    console.error('[leaderboard] saveScore exception:', err);
    queuePendingScore(storage, entry);
    return { status: 'queued', reason: 'exception' };
  }
}

/**
 * Uploads scores that were saved while offline. Entries that still fail stay
 * queued for the next attempt.
 */
export async function flushPendingScores(gameMode = null, { storage = getDefaultStorage() } = {}) {
  const pending = readPendingScores(storage);

  if (pending.length === 0) {
    return { uploaded: 0, remaining: 0 };
  }

  if (!isOnline()) {
    return { uploaded: 0, remaining: pending.length };
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return { uploaded: 0, remaining: pending.length };
  }

  let uploaded = 0;
  const remaining = [];

  for (const entry of pending) {
    if (gameMode && entry.gameMode !== gameMode) {
      remaining.push(entry);
      continue;
    }

    try {
      const { error } = await supabase
        .from(TABLE)
        .insert({ name: entry.name, score: entry.score, game_mode: entry.gameMode });

      if (error) {
        console.error('[leaderboard] flushPendingScores error:', error.message, entry);
        remaining.push(entry);
        continue;
      }

      uploaded += 1;
    } catch (err) {
      console.error('[leaderboard] flushPendingScores exception:', err);
      remaining.push(entry);
    }
  }

  writePendingScores(storage, remaining);

  return { uploaded, remaining: remaining.length };
}

export function getPendingScoreCount(gameMode = null, { storage = getDefaultStorage() } = {}) {
  return countPendingScores(storage, gameMode);
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

  activeChannel = supabase
    .channel('leaderboard-changes')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: TABLE, filter: `game_mode=eq.${gameMode}` },
      () => { onUpdate(gameMode); },
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
  }
}

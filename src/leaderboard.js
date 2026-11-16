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
} from './offlineScores.js';

const TABLE = 'after_dark_leaderboard';
const TOP_N = 5;
const FETCH_LIMIT = 50;
const LEADERBOARD_TIMEOUT_MS = 5000;

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

export function getOfflineLeaderboard(gameMode, storage) {
  const pending = readPendingScores(storage).filter(entry => entry.gameMode === gameMode);
  const entries = pending.length ? mergeLeaderboardEntries(pending) : readCachedLeaderboard(storage, gameMode);
  return { entries: entries.slice(0, TOP_N), offline: true };
}

export async function fetchTopLeaderboard(gameMode = 'regular', { storage = getDefaultStorage() } = {}) {
  const supabase = isOnline() ? getSupabaseClient() : null;
  if (!supabase) return getOfflineLeaderboard(gameMode, storage);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LEADERBOARD_TIMEOUT_MS);
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select('name, score')
      .eq('game_mode', gameMode)
      .order('score', { ascending: false })
      .abortSignal(controller.signal)
      .limit(FETCH_LIMIT);

    if (error) {
      console.error('[leaderboard] fetchTopLeaderboard error:', error.message);
      return getOfflineLeaderboard(gameMode, storage);
    }

    const entries = mergeLeaderboardEntries(data ?? []);
    writeCachedLeaderboard(storage, gameMode, entries);
    return { entries: entries.slice(0, TOP_N), offline: false };
  } catch (err) {
    console.error('[leaderboard] fetchTopLeaderboard exception:', err);
    return getOfflineLeaderboard(gameMode, storage);
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchHighScore(gameMode = 'regular', { storage = getDefaultStorage() } = {}) {
  const { entries, offline } = await fetchTopLeaderboard(gameMode, { storage });
  const globalEntries = offline ? readCachedLeaderboard(storage, gameMode) : entries;
  return globalEntries[0]?.score ?? 0;
}

/**
 * Saves a score to the online leaderboard. When the device is offline (or the
 * request fails) the score is stored on the device instead and uploaded later.
 */
export async function saveScore(
  name,
  score,
  gameMode = 'regular',
  { storage = getDefaultStorage(), deferUpload = false } = {},
) {
  const entry = { name: String(name ?? '').trim(), score: Math.round(Number(score)) || 0, gameMode };

  if (!entry.name) {
    return { status: 'invalid' };
  }

  const saveLocally = () => ({ status: queuePendingScore(storage, entry) ? 'queued' : 'error' });

  const supabase = !deferUpload && isOnline() ? getSupabaseClient() : null;
  if (!supabase) {
    return saveLocally();
  }

  try {
    const { data, error } = await supabase
      .from(TABLE)
      .insert({ name: entry.name, score: entry.score, game_mode: gameMode })
      .select()
      .single();

    if (error) {
      console.error('[leaderboard] saveScore error:', error.message, entry);
      return saveLocally();
    }

    removePendingScore(storage, entry);
    return { status: 'saved', data };
  } catch (err) {
    console.error('[leaderboard] saveScore exception:', err);
    return saveLocally();
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
  for (const entry of pending) {
    if (gameMode && entry.gameMode !== gameMode) {
      continue;
    }

    try {
      const { error } = await supabase
        .from(TABLE)
        .insert({ name: entry.name, score: entry.score, game_mode: entry.gameMode });

      if (error) {
        console.error('[leaderboard] flushPendingScores error:', error.message, entry);
        continue;
      }

      removePendingScore(storage, entry);
      uploaded += 1;
    } catch (err) {
      console.error('[leaderboard] flushPendingScores exception:', err);
    }
  }

  return { uploaded, remaining: countPendingScores(storage) };
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

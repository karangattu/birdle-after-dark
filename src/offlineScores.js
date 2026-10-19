/**
 * Local storage helpers that keep the leaderboard usable without a connection.
 *
 * Two things are stored on the device:
 * - pending scores: entries the player submitted while offline, waiting to be
 *   uploaded once the phone is back online.
 * - leaderboard cache: the last leaderboard we managed to download, so the
 *   standings are still readable while offline.
 */

export const PENDING_SCORES_STORAGE_KEY = 'birdle-after-dark-pending-scores';
export const LEADERBOARD_CACHE_KEY_PREFIX = 'birdle-after-dark-leaderboard-cache';

const VALID_GAME_MODES = new Set(['regular', 'expert']);
const MAX_PENDING_SCORES = 50;

export function getDefaultStorage() {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

function normalizeName(name) {
  return typeof name === 'string' ? name.trim() : '';
}

function normalizeScore(score) {
  const numeric = Math.round(Number(score));
  return Number.isFinite(numeric) ? numeric : 0;
}

export function isValidGameMode(gameMode) {
  return VALID_GAME_MODES.has(gameMode);
}

/**
 * Keeps the best score per player and sorts by score, highest first.
 */
export function mergeLeaderboardEntries(entries) {
  const bestByName = new Map();

  for (const entry of entries ?? []) {
    const name = normalizeName(entry?.name);
    const score = normalizeScore(entry?.score);

    if (!name) {
      continue;
    }

    const current = bestByName.get(name);

    if (current === undefined || score > current) {
      bestByName.set(name, score);
    }
  }

  return Array.from(bestByName, ([name, score]) => ({ name, score }))
    .sort((a, b) => b.score - a.score);
}

export function isValidPendingScore(entry) {
  if (!entry || typeof entry !== 'object') {
    return false;
  }

  return Boolean(normalizeName(entry.name))
    && Number.isFinite(Number(entry.score))
    && isValidGameMode(entry.gameMode);
}

export function readPendingScores(storage = getDefaultStorage()) {
  if (!storage?.getItem) {
    return [];
  }

  try {
    const raw = storage.getItem(PENDING_SCORES_STORAGE_KEY);

    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isValidPendingScore).map((entry) => ({
      name: normalizeName(entry.name),
      score: normalizeScore(entry.score),
      gameMode: entry.gameMode,
      createdAt: Number(entry.createdAt) || Date.now(),
    }));
  } catch {
    return [];
  }
}

export function writePendingScores(storage = getDefaultStorage(), entries = []) {
  if (!storage?.setItem) {
    return [];
  }

  try {
    storage.setItem(PENDING_SCORES_STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Ignore storage failures so the game stays playable in restricted modes.
  }

  return entries;
}

/**
 * Stores a score for later upload. Only the best score per player and mode is
 * kept, so replaying a round cannot flood the queue.
 */
export function queuePendingScore(storage = getDefaultStorage(), entry = {}) {
  const pending = readPendingScores(storage);
  const name = normalizeName(entry.name);
  const score = normalizeScore(entry.score);
  const gameMode = entry.gameMode;

  if (!name || !isValidGameMode(gameMode)) {
    return pending;
  }

  const existingIndex = pending.findIndex(
    (queued) => queued.name === name && queued.gameMode === gameMode,
  );

  if (existingIndex >= 0) {
    if (pending[existingIndex].score >= score) {
      return pending;
    }

    pending[existingIndex] = {
      name,
      score,
      gameMode,
      createdAt: Number(entry.createdAt) || Date.now(),
    };
  } else {
    pending.push({
      name,
      score,
      gameMode,
      createdAt: Number(entry.createdAt) || Date.now(),
    });
  }

  const capped = pending.slice(-MAX_PENDING_SCORES);
  writePendingScores(storage, capped);

  return capped;
}

export function removePendingScore(storage = getDefaultStorage(), { name, gameMode } = {}) {
  const targetName = normalizeName(name);
  const remaining = readPendingScores(storage).filter(
    (queued) => !(queued.name === targetName && queued.gameMode === gameMode),
  );

  writePendingScores(storage, remaining);

  return remaining;
}

export function countPendingScores(storage = getDefaultStorage(), gameMode = null) {
  const pending = readPendingScores(storage);

  if (!gameMode) {
    return pending.length;
  }

  return pending.filter((queued) => queued.gameMode === gameMode).length;
}

export function getLeaderboardCacheKey(gameMode) {
  return `${LEADERBOARD_CACHE_KEY_PREFIX}-${gameMode}`;
}

export function readCachedLeaderboard(storage = getDefaultStorage(), gameMode = 'regular') {
  if (!storage?.getItem) {
    return [];
  }

  try {
    const raw = storage.getItem(getLeaderboardCacheKey(gameMode));

    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return mergeLeaderboardEntries(parsed);
  } catch {
    return [];
  }
}

export function writeCachedLeaderboard(storage = getDefaultStorage(), gameMode = 'regular', entries = []) {
  if (!storage?.setItem) {
    return [];
  }

  const merged = mergeLeaderboardEntries(entries);

  try {
    storage.setItem(getLeaderboardCacheKey(gameMode), JSON.stringify(merged));
  } catch {
    // Ignore storage failures so the game stays playable in restricted modes.
  }

  return merged;
}

import { describe, it, expect } from 'vitest';
import {
  LEADERBOARD_CACHE_KEY_PREFIX,
  PENDING_SCORES_STORAGE_KEY,
  countPendingScores,
  getLeaderboardCacheKey,
  mergeLeaderboardEntries,
  queuePendingScore,
  readCachedLeaderboard,
  readPendingScores,
  removePendingScore,
  writeCachedLeaderboard,
  writePendingScores,
} from '../src/offlineScores.js';

class MockStorage {
  constructor() {
    this.store = new Map();
  }

  getItem(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }

  setItem(key, value) {
    this.store.set(key, String(value));
  }

  removeItem(key) {
    this.store.delete(key);
  }
}

describe('offlineScores', () => {
  describe('mergeLeaderboardEntries', () => {
    it('should keep the best score per player and sort highest first', () => {
      const merged = mergeLeaderboardEntries([
        { name: 'Owl Fan', score: 120 },
        { name: 'Owl Fan', score: 300 },
        { name: 'Night Owl', score: 200 },
      ]);

      expect(merged).toEqual([
        { name: 'Owl Fan', score: 300 },
        { name: 'Night Owl', score: 200 },
      ]);
    });

    it('should drop entries without a name and treat a broken score as zero', () => {
      const merged = mergeLeaderboardEntries([
        { name: '   ', score: 100 },
        { name: 'Valid', score: 'not-a-number' },
        { name: 'Valid', score: 42 },
        null,
      ]);

      expect(merged).toEqual([{ name: 'Valid', score: 42 }]);
    });

    it('should return an empty list for missing input', () => {
      expect(mergeLeaderboardEntries(undefined)).toEqual([]);
      expect(mergeLeaderboardEntries([])).toEqual([]);
    });
  });

  describe('pending score queue', () => {
    it('should start empty when nothing was stored', () => {
      const storage = new MockStorage();

      expect(readPendingScores(storage)).toEqual([]);
      expect(countPendingScores(storage)).toBe(0);
    });

    it('should queue a score for later upload', () => {
      const storage = new MockStorage();

      queuePendingScore(storage, { name: '  Night Owl  ', score: 250, gameMode: 'regular' });

      expect(readPendingScores(storage)).toEqual([
        expect.objectContaining({ name: 'Night Owl', score: 250, gameMode: 'regular' }),
      ]);
    });

    it('should keep only the best queued score per player and mode', () => {
      const storage = new MockStorage();

      queuePendingScore(storage, { name: 'Night Owl', score: 250, gameMode: 'regular' });
      queuePendingScore(storage, { name: 'Night Owl', score: 400, gameMode: 'regular' });
      queuePendingScore(storage, { name: 'Night Owl', score: 100, gameMode: 'regular' });
      queuePendingScore(storage, { name: 'Night Owl', score: 900, gameMode: 'expert' });

      const pending = readPendingScores(storage);

      expect(pending).toHaveLength(2);
      expect(pending).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ score: 400, gameMode: 'regular' }),
          expect.objectContaining({ score: 900, gameMode: 'expert' }),
        ]),
      );
    });

    it('should count pending scores per game mode', () => {
      const storage = new MockStorage();

      queuePendingScore(storage, { name: 'A', score: 10, gameMode: 'regular' });
      queuePendingScore(storage, { name: 'B', score: 20, gameMode: 'expert' });

      expect(countPendingScores(storage)).toBe(2);
      expect(countPendingScores(storage, 'regular')).toBe(1);
      expect(countPendingScores(storage, 'expert')).toBe(1);
    });

    it('should remove a queued score once it is uploaded', () => {
      const storage = new MockStorage();

      queuePendingScore(storage, { name: 'A', score: 10, gameMode: 'regular' });
      queuePendingScore(storage, { name: 'B', score: 20, gameMode: 'regular' });

      removePendingScore(storage, { name: 'A', gameMode: 'regular' });

      expect(readPendingScores(storage)).toEqual([
        expect.objectContaining({ name: 'B' }),
      ]);
    });

    it('should ignore entries with an unknown game mode', () => {
      const storage = new MockStorage();

      queuePendingScore(storage, { name: 'A', score: 10, gameMode: 'nonsense' });

      expect(readPendingScores(storage)).toEqual([]);
    });

    it('should survive corrupted storage content', () => {
      const storage = new MockStorage();
      storage.setItem(PENDING_SCORES_STORAGE_KEY, '{not json');

      expect(readPendingScores(storage)).toEqual([]);

      storage.setItem(PENDING_SCORES_STORAGE_KEY, '{"name":"A"}');

      expect(readPendingScores(storage)).toEqual([]);
    });

    it('should not throw when storage is unavailable', () => {
      expect(() => queuePendingScore(null, { name: 'A', score: 10, gameMode: 'regular' })).not.toThrow();
      expect(readPendingScores(null)).toEqual([]);
      expect(writePendingScores(null, [])).toEqual([]);
    });
  });

  describe('leaderboard cache', () => {
    it('should store and read back the last known leaderboard', () => {
      const storage = new MockStorage();

      writeCachedLeaderboard(storage, 'regular', [
        { name: 'Owl Fan', score: 300 },
        { name: 'Night Owl', score: 200 },
      ]);

      expect(readCachedLeaderboard(storage, 'regular')).toEqual([
        { name: 'Owl Fan', score: 300 },
        { name: 'Night Owl', score: 200 },
      ]);
    });

    it('should keep a separate cache per game mode', () => {
      const storage = new MockStorage();

      writeCachedLeaderboard(storage, 'regular', [{ name: 'A', score: 10 }]);
      writeCachedLeaderboard(storage, 'expert', [{ name: 'B', score: 20 }]);

      expect(readCachedLeaderboard(storage, 'regular')).toEqual([{ name: 'A', score: 10 }]);
      expect(readCachedLeaderboard(storage, 'expert')).toEqual([{ name: 'B', score: 20 }]);
    });

    it('should use a mode specific cache key', () => {
      expect(getLeaderboardCacheKey('expert')).toBe(`${LEADERBOARD_CACHE_KEY_PREFIX}-expert`);
    });

    it('should return an empty list when nothing was cached', () => {
      expect(readCachedLeaderboard(new MockStorage(), 'regular')).toEqual([]);
    });
  });
});

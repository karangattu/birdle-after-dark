import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  fetchHighScore,
  fetchTopLeaderboard,
  flushPendingScores,
  isOnline,
  saveScore,
} from '../src/leaderboard.js';
import { readPendingScores } from '../src/offlineScores.js';

const mockSupabase = {
  from: vi.fn(),
};

vi.mock('../src/supabase.js', () => ({
  getSupabaseClient: () => mockSupabase,
}));

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

function createQueryChain(result) {
  const chain = {
    select: () => chain,
    eq: () => chain,
    order: () => chain,
    limit: () => Promise.resolve(result),
    single: () => Promise.resolve(result),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };

  return chain;
}

function setOnline(value) {
  Object.defineProperty(globalThis, 'navigator', {
    value: { onLine: value },
    configurable: true,
    writable: true,
  });
}

describe('leaderboard offline behaviour', () => {
  let storage;

  beforeEach(() => {
    storage = new MockStorage();
    setOnline(true);
    mockSupabase.from.mockReset();
  });

  afterEach(() => {
    setOnline(true);
  });

  describe('isOnline', () => {
    it('should report the connection state', () => {
      setOnline(false);
      expect(isOnline()).toBe(false);

      setOnline(true);
      expect(isOnline()).toBe(true);
    });
  });

  describe('saveScore', () => {
    it('should send the score to the server when online', async () => {
      const insert = vi.fn(() => createQueryChain({ data: { name: 'A', score: 10 }, error: null }));
      mockSupabase.from.mockReturnValue({ insert });

      const result = await saveScore('A', 10, 'regular', { storage });

      expect(result.status).toBe('saved');
      expect(insert).toHaveBeenCalledWith({ name: 'A', score: 10, game_mode: 'regular' });
      expect(readPendingScores(storage)).toEqual([]);
    });

    it('should keep the score on the device when offline', async () => {
      setOnline(false);
      const insert = vi.fn();
      mockSupabase.from.mockReturnValue({ insert });

      const result = await saveScore('A', 10, 'regular', { storage });

      expect(result.status).toBe('queued');
      expect(insert).not.toHaveBeenCalled();
      expect(readPendingScores(storage)).toEqual([
        expect.objectContaining({ name: 'A', score: 10, gameMode: 'regular' }),
      ]);
    });

    it('should keep the score on the device when the request fails', async () => {
      const insert = vi.fn(() => createQueryChain({ data: null, error: { message: 'offline' } }));
      mockSupabase.from.mockReturnValue({ insert });

      const result = await saveScore('A', 10, 'regular', { storage });

      expect(result.status).toBe('queued');
      expect(readPendingScores(storage)).toHaveLength(1);
    });

    it('should reject a score without a name', async () => {
      const result = await saveScore('   ', 10, 'regular', { storage });

      expect(result.status).toBe('invalid');
      expect(readPendingScores(storage)).toEqual([]);
    });
  });

  describe('flushPendingScores', () => {
    it('should upload the queued scores and clear the queue', async () => {
      setOnline(false);
      mockSupabase.from.mockReturnValue({ insert: vi.fn() });
      await saveScore('A', 10, 'regular', { storage });
      await saveScore('B', 20, 'expert', { storage });

      setOnline(true);
      const insert = vi.fn(() => createQueryChain({ data: null, error: null }));
      mockSupabase.from.mockReturnValue({ insert });

      const result = await flushPendingScores(null, { storage });

      expect(result).toEqual({ uploaded: 2, remaining: 0 });
      expect(insert).toHaveBeenCalledTimes(2);
      expect(insert).toHaveBeenCalledWith({ name: 'A', score: 10, game_mode: 'regular' });
      expect(insert).toHaveBeenCalledWith({ name: 'B', score: 20, game_mode: 'expert' });
      expect(readPendingScores(storage)).toEqual([]);
    });

    it('should only upload the scores of the given mode', async () => {
      setOnline(false);
      mockSupabase.from.mockReturnValue({ insert: vi.fn() });
      await saveScore('A', 10, 'regular', { storage });
      await saveScore('B', 20, 'expert', { storage });

      setOnline(true);
      const insert = vi.fn(() => createQueryChain({ data: null, error: null }));
      mockSupabase.from.mockReturnValue({ insert });

      const result = await flushPendingScores('regular', { storage });

      expect(result).toEqual({ uploaded: 1, remaining: 1 });
      expect(insert).toHaveBeenCalledTimes(1);
      expect(readPendingScores(storage)).toEqual([
        expect.objectContaining({ name: 'B', gameMode: 'expert' }),
      ]);
    });

    it('should keep the scores queued when the upload fails', async () => {
      setOnline(false);
      mockSupabase.from.mockReturnValue({ insert: vi.fn() });
      await saveScore('A', 10, 'regular', { storage });

      setOnline(true);
      const insert = vi.fn(() => createQueryChain({ data: null, error: { message: 'boom' } }));
      mockSupabase.from.mockReturnValue({ insert });

      const result = await flushPendingScores(null, { storage });

      expect(result).toEqual({ uploaded: 0, remaining: 1 });
      expect(readPendingScores(storage)).toHaveLength(1);
    });

    it('should do nothing while offline', async () => {
      setOnline(false);
      mockSupabase.from.mockReturnValue({ insert: vi.fn() });
      await saveScore('A', 10, 'regular', { storage });

      const result = await flushPendingScores(null, { storage });

      expect(result).toEqual({ uploaded: 0, remaining: 1 });
      expect(readPendingScores(storage)).toHaveLength(1);
    });
  });

  describe('leaderboard cache', () => {
    it('should cache the leaderboard after a successful fetch', async () => {
      mockSupabase.from.mockReturnValue({
        select: () => createQueryChain({
          data: [{ name: 'A', score: 10 }, { name: 'A', score: 30 }, { name: 'B', score: 20 }],
          error: null,
        }),
      });

      const top = await fetchTopLeaderboard('regular', { storage });

      expect(top).toEqual([
        { name: 'A', score: 30 },
        { name: 'B', score: 20 },
      ]);

      // The next fetch fails, so the cached standings are used instead.
      mockSupabase.from.mockReturnValue({
        select: () => createQueryChain({ data: null, error: { message: 'offline' } }),
      });

      const cached = await fetchTopLeaderboard('regular', { storage });

      expect(cached).toEqual([
        { name: 'A', score: 30 },
        { name: 'B', score: 20 },
      ]);
    });

    it('should fall back to the cached high score when the fetch fails', async () => {
      mockSupabase.from.mockReturnValue({
        select: () => createQueryChain({
          data: [{ name: 'A', score: 42 }],
          error: null,
        }),
      });

      expect(await fetchHighScore('regular', { storage })).toBe(42);

      mockSupabase.from.mockReturnValue({
        select: () => createQueryChain({ data: null, error: { message: 'offline' } }),
      });

      expect(await fetchHighScore('regular', { storage })).toBe(42);
    });
  });
});

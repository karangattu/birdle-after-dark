import { describe, it, expect } from 'vitest';
import {
  INSTALL_PROMPT_DISMISSED_STORAGE_KEY,
  isStandaloneDisplayMode,
  readInstallPromptDismissed,
  shouldShowInstallPrompt,
  writeInstallPromptDismissed,
} from '../src/installPrompt.js';

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

describe('installPrompt', () => {
  describe('isStandaloneDisplayMode', () => {
    it('should return true when the app runs as a standalone PWA', () => {
      const mockWindow = {
        matchMedia: query => ({ matches: query === '(display-mode: standalone)' }),
        navigator: {},
      };

      expect(isStandaloneDisplayMode(mockWindow)).toBe(true);
    });

    it('should return true when the app uses fullscreen display mode', () => {
      const mockWindow = {
        matchMedia: query => ({ matches: query === '(display-mode: fullscreen)' }),
        navigator: {},
      };

      expect(isStandaloneDisplayMode(mockWindow)).toBe(true);
    });

    it('should return true for iOS standalone apps', () => {
      const mockWindow = {
        matchMedia: () => ({ matches: false }),
        navigator: { standalone: true },
      };

      expect(isStandaloneDisplayMode(mockWindow)).toBe(true);
    });

    it('should return false when the app runs in a browser tab', () => {
      const mockWindow = {
        matchMedia: () => ({ matches: false }),
        navigator: {},
      };

      expect(isStandaloneDisplayMode(mockWindow)).toBe(false);
    });
  });

  describe('shouldShowInstallPrompt', () => {
    it('should require a deferred prompt and hide when dismissed or installed', () => {
      expect(
        shouldShowInstallPrompt({
          isStandalone: false,
          hasDeferredPrompt: true,
          dismissed: false,
        })
      ).toBe(true);

      expect(
        shouldShowInstallPrompt({
          isStandalone: true,
          hasDeferredPrompt: true,
          dismissed: false,
        })
      ).toBe(false);

      expect(
        shouldShowInstallPrompt({
          isStandalone: false,
          hasDeferredPrompt: false,
          dismissed: false,
        })
      ).toBe(false);

      expect(
        shouldShowInstallPrompt({
          isStandalone: false,
          hasDeferredPrompt: true,
          dismissed: true,
        })
      ).toBe(false);
    });
  });

  describe('dismissal persistence', () => {
    it('should read and write the dismissal flag in storage', () => {
      const storage = new MockStorage();

      expect(readInstallPromptDismissed(storage)).toBe(false);

      writeInstallPromptDismissed(storage, true);
      expect(storage.getItem(INSTALL_PROMPT_DISMISSED_STORAGE_KEY)).toBe('true');
      expect(readInstallPromptDismissed(storage)).toBe(true);

      writeInstallPromptDismissed(storage, false);
      expect(storage.getItem(INSTALL_PROMPT_DISMISSED_STORAGE_KEY)).toBeNull();
      expect(readInstallPromptDismissed(storage)).toBe(false);
    });
  });
});

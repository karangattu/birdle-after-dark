export const INSTALL_PROMPT_DISMISSED_STORAGE_KEY = 'birdle-after-dark-install-prompt-dismissed';

const fallbackWindow = typeof window !== 'undefined' ? window : undefined;

export function isStandaloneDisplayMode(targetWindow = fallbackWindow) {
  if (!targetWindow) {
    return false;
  }

  const displayModeMatches =
    targetWindow.matchMedia?.('(display-mode: standalone)')?.matches
    || targetWindow.matchMedia?.('(display-mode: fullscreen)')?.matches;

  return Boolean(displayModeMatches || targetWindow.navigator?.standalone);
}

export function shouldShowInstallPrompt({
  isStandalone = false,
  hasDeferredPrompt = false,
  dismissed = false,
} = {}) {
  return !isStandalone && hasDeferredPrompt && !dismissed;
}

export function readInstallPromptDismissed(storage) {
  if (!storage?.getItem) {
    return false;
  }

  try {
    return storage.getItem(INSTALL_PROMPT_DISMISSED_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function writeInstallPromptDismissed(storage, dismissed) {
  if (!storage?.setItem || !storage?.removeItem) {
    return;
  }

  try {
    if (dismissed) {
      storage.setItem(INSTALL_PROMPT_DISMISSED_STORAGE_KEY, 'true');
    } else {
      storage.removeItem(INSTALL_PROMPT_DISMISSED_STORAGE_KEY);
    }
  } catch {
    // Ignore storage failures so the game stays playable in restricted modes.
  }
}

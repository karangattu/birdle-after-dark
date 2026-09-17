import { describe, it, expect, vi } from 'vitest';
import { initializeFieldGuide } from '../src/fieldGuide.js';
import { JSDOM } from 'jsdom';
import html from '../index.html?raw';

function setupGuide() {
  const { window } = new JSDOM(html);
  const { document } = window;
  const onOpen = vi.fn();
  const onClose = vi.fn();
  const calls = [...document.querySelectorAll('#field-guide-modal audio')];
  calls.forEach(audio => {
    audio.pause = vi.fn();
    // jsdom never starts playback; simulate calls the user is listening to.
    const paused = { value: false };
    Object.defineProperty(audio, 'paused', { get: () => paused.value, set: v => { paused.value = v; } });
  });
  initializeFieldGuide(document, { onOpen, onClose });
  document.getElementById('field-guide-btn').click();
  return { window, document, calls, onOpen, onClose };
}

describe('interactive field guide', () => {
  it('opens the guide with focus inside and pauses the opening soundtrack', () => {
    const { document, onOpen } = setupGuide();
    expect(document.getElementById('field-guide-modal').classList.contains('hidden')).toBe(false);
    expect(document.activeElement.id).toBe('field-guide-close-btn');
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it.each(['button', 'backdrop', 'Escape'])('stops calls and restores focus when closed via %s', method => {
    const { window, document, calls, onClose } = setupGuide();
    calls.forEach(audio => { audio.currentTime = 5; });
    if (method === 'Escape') {
      document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape' }));
    } else {
      document.getElementById(method === 'button' ? 'field-guide-close-btn' : 'field-guide-modal').click();
    }
    expect(document.getElementById('field-guide-modal').classList.contains('hidden')).toBe(true);
    expect(document.activeElement.id).toBe('field-guide-btn');
    expect(onClose).toHaveBeenCalledOnce();
    expect(calls).toHaveLength(4);
    calls.forEach(audio => {
      expect(audio.pause).toHaveBeenCalled();
      expect(audio.currentTime).toBe(0);
    });
  });

  it('pauses other calls when a different bird starts playing', () => {
    const { window, calls } = setupGuide();
    expect(calls).toHaveLength(4);
    const playing = calls[1];
    playing.paused = true;
    playing.dispatchEvent(new window.Event('play'));
    expect(playing.pause).not.toHaveBeenCalled();
    [calls[0], calls[2], calls[3]].forEach(audio => {
      expect(audio.pause).toHaveBeenCalledOnce();
    });
  });

  it('offers a picture, identification tips, and a playable call for every game bird', () => {
    const { document } = new JSDOM(html).window;
    const cards = document.querySelectorAll('.field-guide-card');

    expect(cards).toHaveLength(4);
    for (const card of cards) {
      expect(card.querySelector('img').getAttribute('alt')).toBeTruthy();
      expect(card.querySelector('h3').textContent).toBeTruthy();
      expect(card.querySelector('p').textContent).toBeTruthy();
      expect(card.querySelector('audio[controls]').getAttribute('src')).toMatch(/\.mp3$/);
    }
  });
});

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
    audio.play = vi.fn().mockResolvedValue(undefined);
    audio.pause = vi.fn();
    // jsdom never starts playback; simulate calls the user is listening to.
    const paused = { value: true };
    Object.defineProperty(audio, 'paused', { get: () => paused.value, set: v => { paused.value = v; } });
  });
  initializeFieldGuide(document, {
    onOpen,
    onClose,
    callSources: {
      great_horned_owl: '/calls/great_horned_owl.mp3',
      western_screech_owl: '/calls/western_screech_owl.mp3',
      barn_owl: '/calls/barn_owl.mp3',
      common_poorwill: '/calls/common_poorwill.mp3',
    },
  });
  document.getElementById('field-guide-btn').click();
  return { window, document, calls, onOpen, onClose };
}

function hotspot(document, birdId) {
  return document.querySelector(`[data-bird-call="${birdId}"]`);
}

describe('interactive field guide', () => {
  it('shows one field guide image with a tap target for each owl', () => {
    const { document } = new JSDOM(html).window;
    const image = document.querySelector('#field-guide-modal img');
    expect(image.getAttribute('src')).toMatch(/field_guide\.png$/);
    expect(image.getAttribute('alt')).toBeTruthy();

    const targets = [...document.querySelectorAll('#field-guide-modal [data-bird-call]')];
    expect(targets).toHaveLength(4);
    for (const target of targets) {
      expect(target.getAttribute('aria-label')).toBeTruthy();
      expect(document.querySelector(`#field-guide-modal audio[data-bird="${target.dataset.birdCall}"]`)).not.toBeNull();
    }
  });

  it('wires each owl tap target to its call recording', () => {
    const { calls } = setupGuide();
    expect(calls).toHaveLength(4);
    for (const audio of calls) {
      expect(audio.getAttribute('src')).toBe(`/calls/${audio.dataset.bird}.mp3`);
    }
  });

  it('opens the guide with focus inside and pauses the opening soundtrack', () => {
    const { document, onOpen } = setupGuide();
    expect(document.getElementById('field-guide-modal').classList.contains('hidden')).toBe(false);
    expect(document.activeElement.id).toBe('field-guide-close-btn');
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it('plays the tapped owl call and announces it', () => {
    const { document, calls } = setupGuide();
    hotspot(document, 'barn_owl').click();

    const barnCall = calls.find(audio => audio.dataset.bird === 'barn_owl');
    expect(barnCall.play).toHaveBeenCalledOnce();
    expect(document.getElementById('field-guide-status').textContent).toMatch(/Barn Owl/);
    expect(hotspot(document, 'barn_owl').classList.contains('active')).toBe(true);
  });

  it('stops the previous call when another owl is tapped', () => {
    const { document, calls } = setupGuide();
    const greatHornedCall = calls.find(audio => audio.dataset.bird === 'great_horned_owl');
    greatHornedCall.paused = false;
    hotspot(document, 'great_horned_owl').classList.add('active');

    hotspot(document, 'western_screech_owl').click();

    const screechCall = calls.find(audio => audio.dataset.bird === 'western_screech_owl');
    expect(greatHornedCall.pause).toHaveBeenCalledOnce();
    expect(screechCall.play).toHaveBeenCalledOnce();
    expect(screechCall.pause).not.toHaveBeenCalled();
    expect(document.getElementById('field-guide-status').textContent).toMatch(/Western Screech Owl/);
    expect(hotspot(document, 'western_screech_owl').classList.contains('active')).toBe(true);
    expect(hotspot(document, 'great_horned_owl').classList.contains('active')).toBe(false);
  });

  it('pauses the call when its owl is tapped again', () => {
    const { document, calls } = setupGuide();
    const poorwillCall = calls.find(audio => audio.dataset.bird === 'common_poorwill');
    poorwillCall.paused = false;

    hotspot(document, 'common_poorwill').click();

    expect(poorwillCall.pause).toHaveBeenCalledOnce();
    expect(poorwillCall.play).not.toHaveBeenCalled();
    expect(document.getElementById('field-guide-status').textContent).toMatch(/Tap an owl/);
  });

  it.each(['button', 'backdrop', 'Escape'])('stops calls and restores focus when closed via %s', method => {
    const { window, document, calls, onClose } = setupGuide();
    calls.forEach(audio => { audio.paused = false; });
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
    });
  });
});

// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import * as cameo from '../src/batmanCameo.js';

describe('Batman cameo', () => {
  it('chooses an on-screen perch clear of birds and the HUD', () => {
    const position = cameo.chooseCameoPosition(800, 500,
      [{ x: 170, y: 230 }, { x: 400, y: 300 }],
      [{ left: 500, top: 0, right: 800, bottom: 220 }], 90);
    expect(position.x).toBeGreaterThanOrEqual(45);
    expect(position.x).toBeLessThanOrEqual(755);
    expect(position.y).toBeGreaterThanOrEqual(145);
    expect(position.y).toBeLessThanOrEqual(355);
    for (const bird of [{ x: 170, y: 230 }, { x: 400, y: 300 }]) {
      expect(Math.hypot(position.x - bird.x, position.y - bird.y)).toBeGreaterThan(130);
    }
    expect(position.x + 45 <= 500 || position.y - 45 >= 220).toBe(true);
  });

  it('keeps a landscape perch reachable by the raised touch flashlight', () => {
    const birds = Array.from({ length: 9 }, (_, index) => ({ x: 90 + index * 80, y: 100 }));
    const position = cameo.chooseCameoPosition(844, 390, birds, []);
    expect(position.y).toBeLessThanOrEqual(195);
  });

  it('plays all twelve supplied poses and restores the perched frame on reset', () => {
    const container = document.createElement('div');
    const animation = cameo.createBatmanCameo(container, 'sprite.jpg');
    const actor = container.querySelector('.batman-cameo');
    animation.reset({ x: 200, y: 220 });
    const perchedPosition = actor.style.backgroundPosition;
    const frames = new Set([perchedPosition]);
    expect(perchedPosition).toBe('0% 0%');
    for (let index = 0; index < 11; index++) {
      animation.update(0.15, 200, 220, 40);
      frames.add(actor.style.backgroundPosition);
    }
    expect(frames.size).toBe(12);
    expect(actor.hidden).toBe(false);
    animation.update(1, 500, 400, 40);
    expect(actor.hidden).toBe(true);
    animation.reset({ x: 300, y: 200 });
    expect(actor.style.backgroundPosition).toBe(perchedPosition);
  });

  it('waits for the beam, fires, swings away once, and resets for a new round', () => {
    const container = document.createElement('div');
    const batman = cameo.createBatmanCameo(container, 'sprite.png');
    const actor = container.querySelector('.batman-cameo');
    batman.reset({ x: 200, y: 220 });
    batman.update(0.1, 500, 400, 40);
    expect(actor.dataset.phase).toBe('perched');
    batman.update(0.1, 200, 220, 40);
    expect(actor.dataset.phase).toBe('firing');
    expect(container.querySelector('.batman-rope').hidden).toBe(true);
    batman.update(0.6, 500, 400, 40);
    expect(actor.dataset.phase).toBe('swinging');
    expect(actor.style.transform).not.toBe('');
    batman.update(2, 200, 220, 40);
    expect(actor.hidden).toBe(true);
    batman.update(1, 200, 220, 40);
    expect(actor.hidden).toBe(true);
    batman.reset({ x: 300, y: 250 });
    expect(actor.hidden).toBe(false);
    expect(actor.dataset.phase).toBe('perched');
    batman.hide();
    expect(actor.hidden).toBe(true);
    expect(container.querySelector('.batman-perch').hidden).toBe(true);
  });
});

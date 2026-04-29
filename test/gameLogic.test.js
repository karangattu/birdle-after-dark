import { describe, it, expect } from 'vitest';
import {
  checkBirdFound,
  getEndGamePresentation,
  isGameOver,
  isTapInteraction,
} from '../src/gameLogic';

describe('gameLogic', () => {
  describe('checkBirdFound', () => {
    const birds = [
      { id: 'bird1', x: 100, y: 100 },
      { id: 'bird2', x: 300, y: 400 },
    ];

    it('should return bird ID if flashlight is exactly on the bird', () => {
      expect(checkBirdFound(100, 100, birds, 50)).toBe('bird1');
    });

    it('should return bird ID if flashlight is within radius', () => {
      expect(checkBirdFound(130, 140, birds, 51)).toBe('bird1'); // Distance is 50
    });

    it('should return null if flashlight is outside radius', () => {
      expect(checkBirdFound(140, 140, birds, 50)).toBeNull(); // Distance is ~56.5
    });

    it('should find the correct bird when multiple exist', () => {
      expect(checkBirdFound(310, 410, birds, 50)).toBe('bird2');
    });
  });

  describe('isGameOver', () => {
    it('should return playing if time remains and not all birds found', () => {
      expect(isGameOver(30, 2, 4)).toBe('playing');
    });

    it('should return win if all birds found regardless of time', () => {
      expect(isGameOver(10, 4, 4)).toBe('win');
      expect(isGameOver(0, 4, 4)).toBe('win');
    });

    it('should return loss if time is out and not all birds found', () => {
      expect(isGameOver(0, 3, 4)).toBe('loss');
      expect(isGameOver(-1, 0, 4)).toBe('loss');
    });
  });

  describe('getEndGamePresentation', () => {
    it('should configure the win screen without a delay', () => {
      expect(getEndGamePresentation('win', 12)).toEqual({
        title: 'You Won!',
        titleColor: '#00ffcc',
        message: 'You found all the birds with 12 seconds left.',
        revealMissedBirds: false,
        endScreenDelayMs: 0,
      });
    });

    it('should configure the loss screen with a 3 second reveal delay', () => {
      expect(getEndGamePresentation('loss', 0)).toEqual({
        title: 'Game Over',
        titleColor: '#ff3333',
        message: 'You ran out of time.',
        revealMissedBirds: true,
        endScreenDelayMs: 3000,
      });
    });
  });

  describe('isTapInteraction', () => {
    it('should treat a stationary touch as a tap', () => {
      expect(isTapInteraction({ x: 100, y: 100 }, { x: 106, y: 104 })).toBe(true);
    });

    it('should treat a dragged touch as a drag instead of a tap', () => {
      expect(isTapInteraction({ x: 100, y: 100 }, { x: 130, y: 126 })).toBe(false);
    });
  });
});

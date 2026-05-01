import { describe, it, expect } from 'vitest';
import {
  calculateIdentificationScore,
  checkBirdFound,
  getDirectionalBirdCallMix,
  getEndGamePresentation,
  getBirdCandidateInBeam,
  getFlashlightPositions,
  getStreakFeedback,
  isGameOver,
  isTapInteraction,
  getRandomBirdPosition,
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

  describe('getBirdCandidateInBeam', () => {
    const birds = [
      { id: 'bird1', x: 100, y: 100 },
      { id: 'bird2', x: 300, y: 400 },
    ];

    it('should return an unfound bird inside the flashlight beam', () => {
      expect(getBirdCandidateInBeam(100, 100, birds, 50, new Set())).toBe('bird1');
    });

    it('should ignore birds that have already been found', () => {
      expect(getBirdCandidateInBeam(100, 100, birds, 50, new Set(['bird1']))).toBeNull();
    });

    it('should return null when no unfound bird is in the beam', () => {
      expect(getBirdCandidateInBeam(200, 200, birds, 50, new Set())).toBeNull();
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

  describe('calculateIdentificationScore', () => {
    it('should award more points when a bird is identified faster', () => {
      expect(calculateIdentificationScore(50, 1)).toBeGreaterThan(
        calculateIdentificationScore(20, 1)
      );
    });

    it('should add a bonus for an active correct streak', () => {
      expect(calculateIdentificationScore(40, 3)).toBe(
        calculateIdentificationScore(40, 1) + 100
      );
    });

    it('should not return negative points when time has run out', () => {
      expect(calculateIdentificationScore(-5, 1)).toBe(100);
    });
  });

  describe('getStreakFeedback', () => {
    it('should escalate feedback as the correct streak grows', () => {
      expect(getStreakFeedback(1)).toBe('Sharp eye');
      expect(getStreakFeedback(2)).toBe('Night expert');
      expect(getStreakFeedback(3)).toBe('Perfect streak');
      expect(getStreakFeedback(4)).toBe('Perfect streak');
    });

    it('should return null when there is no correct streak', () => {
      expect(getStreakFeedback(0)).toBeNull();
    });
  });

  describe('getDirectionalBirdCallMix', () => {
    const birds = [
      { id: 'left_bird', x: 80, y: 100 },
      { id: 'right_bird', x: 220, y: 100 },
      { id: 'far_bird', x: 600, y: 100 },
    ];

    it('should make nearby birds louder and clearer than distant birds', () => {
      const [nearBird, fartherBird] = getDirectionalBirdCallMix(
        100,
        100,
        birds.slice(0, 2),
        new Set(),
        { maxDistance: 160, maxVolume: 0.24 }
      );

      expect(nearBird.volume).toBeGreaterThan(fartherBird.volume);
      expect(nearBird.clarity).toBeGreaterThan(fartherBird.clarity);
    });

    it('should pan birds left or right relative to the flashlight beam', () => {
      const [leftBird, rightBird] = getDirectionalBirdCallMix(
        150,
        100,
        birds.slice(0, 2),
        new Set(),
        { maxDistance: 160, panDistance: 100, maxPan: 0.6 }
      );

      expect(leftBird.pan).toBeLessThan(0);
      expect(rightBird.pan).toBeGreaterThan(0);
    });

    it('should mute birds that are already found or outside the hint range', () => {
      const [foundBird, , farBird] = getDirectionalBirdCallMix(
        100,
        100,
        birds,
        new Set(['left_bird']),
        { maxDistance: 160, maxVolume: 0.24 }
      );

      expect(foundBird.volume).toBe(0);
      expect(foundBird.clarity).toBe(0);
      expect(farBird.volume).toBe(0);
      expect(farBird.clarity).toBe(0);
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

  describe('getFlashlightPositions', () => {
    it('should keep mouse spotlight control centered on the pointer', () => {
      expect(
        getFlashlightPositions(200, 300, 'mouse', { width: 300, height: 164 })
      ).toEqual({
        spotlightX: 200,
        spotlightY: 300,
        handX: 100,
        handY: 350,
      });
    });

    it('should keep touch control on the hand while offsetting the spotlight above it', () => {
      expect(
        getFlashlightPositions(200, 300, 'touch', { width: 300, height: 164 })
      ).toEqual({
        spotlightX: 169,
        spotlightY: 234,
        handX: 15,
        handY: 175,
      });
    });
  });

  describe('getRandomBirdPosition', () => {
    function positionsOverlap(firstPosition, secondPosition) {
      const horizontalDistance = Math.abs(firstPosition.left - secondPosition.left);
      const verticalDistance = Math.abs(firstPosition.top - secondPosition.top);

      return horizontalDistance < 24 && verticalDistance < 18;
    }

    it('should generate valid coordinates avoiding HUD zones', () => {
      for (let i = 0; i < 100; i++) {
        const pos = getRandomBirdPosition();
        
        expect(pos.top).toBeGreaterThanOrEqual(30);
        expect(pos.top).toBeLessThanOrEqual(72);
        expect(pos.left).toBeGreaterThanOrEqual(8);
        expect(pos.left).toBeLessThanOrEqual(84);

        const isInChecklistZone = pos.top < 52 && pos.left > 52;
        expect(isInChecklistZone).toBe(false);
      }
    });

    it('should avoid positions already assigned to other birds', () => {
      const positions = [];

      for (let i = 0; i < 4; i++) {
        const pos = getRandomBirdPosition(positions);

        expect(positions.some(existingPosition => positionsOverlap(pos, existingPosition))).toBe(false);
        positions.push(pos);
      }
    });
  });
});

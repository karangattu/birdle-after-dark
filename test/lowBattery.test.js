import { describe, it, expect } from 'vitest';
import { isLowBatteryTime, countdownBeepIndex, LOW_BATTERY_THRESHOLD } from '../src/lowBattery.js';

describe('lowBattery', () => {
  describe('LOW_BATTERY_THRESHOLD', () => {
    it('should be 5 seconds', () => {
      expect(LOW_BATTERY_THRESHOLD).toBe(5);
    });
  });

  describe('isLowBatteryTime', () => {
    it('should return true for seconds 1 through 5', () => {
      expect(isLowBatteryTime(5)).toBe(true);
      expect(isLowBatteryTime(4)).toBe(true);
      expect(isLowBatteryTime(3)).toBe(true);
      expect(isLowBatteryTime(2)).toBe(true);
      expect(isLowBatteryTime(1)).toBe(true);
    });

    it('should return false when seconds is above threshold', () => {
      expect(isLowBatteryTime(6)).toBe(false);
      expect(isLowBatteryTime(7)).toBe(false);
      expect(isLowBatteryTime(10)).toBe(false);
      expect(isLowBatteryTime(30)).toBe(false);
      expect(isLowBatteryTime(60)).toBe(false);
    });

    it('should return false when time has run out (0 seconds)', () => {
      expect(isLowBatteryTime(0)).toBe(false);
    });

    it('should return false for negative seconds (past game over)', () => {
      expect(isLowBatteryTime(-1)).toBe(false);
      expect(isLowBatteryTime(-5)).toBe(false);
    });

    it('should handle large positive values correctly', () => {
      expect(isLowBatteryTime(100)).toBe(false);
      expect(isLowBatteryTime(999)).toBe(false);
    });
  });

  describe('countdownBeepIndex', () => {
    it('should compute the correct beep index for each remaining second', () => {
      expect(countdownBeepIndex(5)).toBe(0);
      expect(countdownBeepIndex(4)).toBe(1);
      expect(countdownBeepIndex(3)).toBe(2);
      expect(countdownBeepIndex(2)).toBe(3);
      expect(countdownBeepIndex(1)).toBe(4);
    });

    it('should produce strictly increasing indices as time decreases', () => {
      const indices = [5, 4, 3, 2, 1].map(countdownBeepIndex);
      for (let i = 1; i < indices.length; i++) {
        expect(indices[i]).toBeGreaterThan(indices[i - 1]);
      }
    });

    it('should produce 0-based indices', () => {
      expect(countdownBeepIndex(5)).toBe(0);
      expect(countdownBeepIndex(LOW_BATTERY_THRESHOLD)).toBe(0);
    });

    it('should work correctly for values around the threshold', () => {
      expect(countdownBeepIndex(5)).toBe(0);
      expect(countdownBeepIndex(4)).toBe(1);
      expect(countdownBeepIndex(6)).toBe(-1);
      expect(countdownBeepIndex(0)).toBe(5);
    });

    it('should return values beyond the normal range for extreme inputs', () => {
      expect(countdownBeepIndex(10)).toBe(-5);
      expect(countdownBeepIndex(0)).toBe(5);
      expect(countdownBeepIndex(-1)).toBe(6);
    });
  });

  describe('integration: beep index progression', () => {
    it('should produce exactly 5 unique indices for the 5 seconds', () => {
      const generatedIndices = new Set();
      for (let s = 5; s >= 1; s--) {
        if (isLowBatteryTime(s)) {
          generatedIndices.add(countdownBeepIndex(s));
        }
      }
      expect(generatedIndices.size).toBe(5);
    });

    it('should not produce any indices when low battery is inactive', () => {
      const indices = [];
      for (let s = 10; s > 5; s--) {
        if (isLowBatteryTime(s)) {
          indices.push(countdownBeepIndex(s));
        }
      }
      expect(indices.length).toBe(0);
    });

    it('countdownBeepIndex should match LOW_BATTERY_THRESHOLD - seconds', () => {
      for (let s = 5; s >= 1; s--) {
        expect(countdownBeepIndex(s)).toBe(LOW_BATTERY_THRESHOLD - s);
      }
    });
  });
});

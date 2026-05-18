export const LOW_BATTERY_THRESHOLD = 5;

export function isLowBatteryTime(seconds) {
  return seconds <= LOW_BATTERY_THRESHOLD && seconds > 0;
}

export function countdownBeepIndex(seconds) {
  return LOW_BATTERY_THRESHOLD - seconds;
}

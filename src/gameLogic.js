/**
 * Checks if the flashlight is currently illuminating a bird.
 * @param {number} flashlightX - The x coordinate of the flashlight center.
 * @param {number} flashlightY - The y coordinate of the flashlight center.
 * @param {Array<{id: string, x: number, y: number}>} birdsInfo - Array of bird objects with their center coordinates.
 * @param {number} radius - The radius of the flashlight beam.
 * @returns {string|null} - The ID of the found bird, or null if none are in range.
 */
export function checkBirdFound(flashlightX, flashlightY, birdsInfo, radius) {
  // O(N) lookup as requested
  for (let i = 0; i < birdsInfo.length; i++) {
    const bird = birdsInfo[i];
    const dx = flashlightX - bird.x;
    const dy = flashlightY - bird.y;
    // Calculate distance squared to avoid Math.sqrt cost
    const distanceSquared = dx * dx + dy * dy;
    
    if (distanceSquared <= radius * radius) {
      return bird.id;
    }
  }
  return null;
}

/**
 * Determines the current state of the game.
 * @param {number} timeRemaining - Seconds left on the clock.
 * @param {number} foundBirdsCount - Number of birds found so far.
 * @param {number} totalBirds - Total number of birds to find.
 * @returns {'playing'|'win'|'loss'}
 */
export function isGameOver(timeRemaining, foundBirdsCount, totalBirds) {
  if (foundBirdsCount >= totalBirds) {
    return 'win';
  }
  if (timeRemaining <= 0) {
    return 'loss';
  }
  return 'playing';
}

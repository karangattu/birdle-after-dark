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
 * Finds the first unfound bird currently illuminated by the flashlight beam.
 * @param {number} flashlightX - The x coordinate of the flashlight center.
 * @param {number} flashlightY - The y coordinate of the flashlight center.
 * @param {Array<{id: string, x: number, y: number}>} birdsInfo - Array of bird objects with their center coordinates.
 * @param {number} radius - The radius of the flashlight beam.
 * @param {Set<string>|string[]} foundBirdIds - Bird IDs that have already been identified.
 * @returns {string|null} - The ID of the candidate bird, or null if none are in range.
 */
export function getBirdCandidateInBeam(
  flashlightX,
  flashlightY,
  birdsInfo,
  radius,
  foundBirdIds = new Set(),
) {
  const foundBirdSet = foundBirdIds instanceof Set
    ? foundBirdIds
    : new Set(foundBirdIds);

  for (const bird of birdsInfo) {
    if (foundBirdSet.has(bird.id)) {
      continue;
    }

    const deltaX = flashlightX - bird.x;
    const deltaY = flashlightY - bird.y;
    const distanceSquared = deltaX * deltaX + deltaY * deltaY;

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

/**
 * Calculates points for a correct identification.
 * @param {number} timeRemaining - Seconds left on the clock.
 * @param {number} streakCount - Number of correct identifications in a row.
 * @returns {number}
 */
export function calculateIdentificationScore(timeRemaining, streakCount) {
  const baseScore = 100;
  const timeBonus = Math.max(0, timeRemaining) * 5;
  const streakBonus = Math.max(0, streakCount - 1) * 50;

  return baseScore + timeBonus + streakBonus;
}

/**
 * Gets the encouragement label for a correct identification streak.
 * @param {number} streakCount - Number of correct identifications in a row.
 * @returns {string|null}
 */
export function getStreakFeedback(streakCount) {
  if (streakCount <= 0) {
    return null;
  }

  if (streakCount === 1) {
    return 'Sharp eye';
  }

  if (streakCount === 2) {
    return 'Night expert';
  }

  return 'Perfect streak';
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Calculates directional audio mix values for hidden bird calls.
 * @param {number} spotlightX - The x coordinate of the flashlight center.
 * @param {number} spotlightY - The y coordinate of the flashlight center.
 * @param {Array<{id: string, x: number, y: number}>} birdsInfo - Array of bird objects with their center coordinates.
 * @param {Set<string>|string[]} foundBirdIds - Bird IDs that have already been identified.
 * @param {{maxDistance?: number, maxVolume?: number, maxPan?: number, panDistance?: number}} options - Tuning values for the audio hint.
 * @returns {Array<{id: string, volume: number, pan: number, clarity: number}>}
 */
export function getDirectionalBirdCallMix(
  spotlightX,
  spotlightY,
  birdsInfo,
  foundBirdIds = new Set(),
  options = {},
) {
  const foundBirdSet = foundBirdIds instanceof Set
    ? foundBirdIds
    : new Set(foundBirdIds);
  const maxDistance = Math.max(1, options.maxDistance ?? 420);
  const maxVolume = Math.max(0, options.maxVolume ?? 0.22);
  const maxPan = clamp(options.maxPan ?? 0.58, 0, 1);
  const panDistance = Math.max(1, options.panDistance ?? maxDistance);

  return birdsInfo.map(bird => {
    if (foundBirdSet.has(bird.id)) {
      return {
        id: bird.id,
        volume: 0,
        pan: 0,
        clarity: 0,
      };
    }

    const deltaX = bird.x - spotlightX;
    const deltaY = bird.y - spotlightY;
    const distance = Math.hypot(deltaX, deltaY);
    const clarity = clamp(1 - distance / maxDistance, 0, 1);
    const volume = maxVolume * clarity * clarity;
    const pan = clamp(deltaX / panDistance, -1, 1) * maxPan;

    return {
      id: bird.id,
      volume,
      pan,
      clarity,
    };
  });
}

/**
 * Gets the content and timing for the end-game presentation.
 * @param {'win'|'loss'} result - Final game result.
 * @param {number} timeRemaining - Seconds left on the clock.
 * @returns {{title: string, titleColor: string, message: string, revealMissedBirds: boolean, endScreenDelayMs: number}}
 */
export function getEndGamePresentation(result, timeRemaining) {
  if (result === 'win') {
    return {
      title: 'You Won!',
      titleColor: '#00ffcc',
      message: `You found all the birds with ${timeRemaining} seconds left.`,
      revealMissedBirds: false,
      endScreenDelayMs: 0,
    };
  }

  return {
    title: 'Game Over',
    titleColor: '#ff3333',
    message: 'You ran out of time.',
    revealMissedBirds: true,
    endScreenDelayMs: 3000,
  };
}

/**
 * Determines whether a pointer interaction stayed within tap distance.
 * @param {{x: number, y: number} | null} startPosition - Pointer down position.
 * @param {{x: number, y: number} | null} endPosition - Pointer up position.
 * @param {number} maxDistance - Maximum distance that still counts as a tap.
 * @returns {boolean}
 */
export function isTapInteraction(startPosition, endPosition, maxDistance = 12) {
  if (!startPosition || !endPosition) {
    return false;
  }

  const dx = endPosition.x - startPosition.x;
  const dy = endPosition.y - startPosition.y;

  return dx * dx + dy * dy <= maxDistance * maxDistance;
}

/**
 * Calculates where to render the spotlight and flashlight hand.
 * Mouse keeps direct spotlight control. Touch keeps the finger on the hand and
 * offsets the spotlight upward so the highlighted area remains visible.
 * @param {number} controlX - The pointer x coordinate.
 * @param {number} controlY - The pointer y coordinate.
 * @param {'mouse'|'touch'} controlMode - The active control mode.
 * @param {{width: number, height: number}} handSize - Rendered hand image size.
 * @returns {{spotlightX: number, spotlightY: number, handX: number, handY: number}}
 */
export function getFlashlightPositions(
  controlX,
  controlY,
  controlMode,
  handSize,
) {
  const handWidth = handSize?.width ?? 300;
  const handHeight = handSize?.height ?? 164;

  if (controlMode === 'touch') {
    const handX = controlX - handWidth * (185 / 300);
    const handY = controlY - handHeight * (125 / 164);

    return {
      spotlightX: controlX - handWidth * (31 / 300),
      spotlightY: controlY - handHeight * (66 / 164),
      handX,
      handY,
    };
  }

  return {
    spotlightX: controlX,
    spotlightY: controlY,
    handX: controlX - handWidth * (100 / 300),
    handY: controlY + handHeight * (50 / 164),
  };
}

/**
 * Generates a random coordinate for a bird, avoiding the top-right checklist UI area.
 * @returns {{top: number, left: number}}
 */
export function getRandomBirdPosition() {
  let randomTop, randomLeft;
  let isValidPosition = false;

  while (!isValidPosition) {
    // Randomize between 10% and 85% for top and left to keep them on screen
    randomTop = Math.floor(Math.random() * 75) + 10;
    randomLeft = Math.floor(Math.random() * 75) + 10;

    // Avoid top-right corner where the "Birds Found" checklist is located
    const isInChecklistZone = randomTop < 45 && randomLeft > 55;
    
    if (!isInChecklistZone) {
      isValidPosition = true;
    }
  }

  return { top: randomTop, left: randomLeft };
}

import { registerSW } from 'virtual:pwa-register';
import {
  calculateIdentificationScore,
  getBirdCandidateInBeam,
  getDirectionalBirdCallMix,
  getEndGamePresentation,
  getFlashlightPositions,
  getStreakFeedback,
  isTapInteraction,
  isGameOver,
  getRandomBirdPosition,
} from './gameLogic.js';
import barnOwlAudioSrc from '../assets/barn_owl.mp3';
import commonPoorwillAudioSrc from '../assets/common_poorwill.mp3';
import gameStartAudioSrc from '../assets/game_start_audio.mp3';
import greatHornedOwlAudioSrc from '../assets/great_horned_owl.mp3';
import westernScreechOwlAudioSrc from '../assets/western_screech_owl.mp3';

// DOM Elements
const startScreen = document.getElementById('start-screen');
const gameScreen = document.getElementById('game-screen');
const endScreen = document.getElementById('end-screen');
const gameContainer = document.getElementById('game-container');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
const timerEl = document.getElementById('timer');
const scoreCountEl = document.getElementById('score-count');
const highScoreCountEl = document.getElementById('high-score-count');
const birdsFoundCountEl = document.getElementById('birds-found-count');
const darknessOverlay = document.getElementById('darkness-overlay');
const flashlightHand = document.getElementById('flashlight-hand');
const endTitle = document.getElementById('end-title');
const endMessage = document.getElementById('end-message');
const endScoreSummary = document.getElementById('end-score-summary');
const videoScreen = document.getElementById('video-screen');
const transitionVideo = document.getElementById('transition-video');
const tutorialModal = document.getElementById('tutorial-modal');
const tutorialStartBtn = document.getElementById('tutorial-start-btn');
const audioTip = document.getElementById('audio-tip');
const audioTipButton = document.getElementById('audio-tip-button');
const audioTipText = document.getElementById('audio-tip-text');

const guessModal = document.getElementById('guess-modal');
const guessBtns = document.querySelectorAll('.guess-btn');
const guessFeedback = document.getElementById('guess-feedback');
const hudBottom = document.getElementById('hud-bottom');
const hudStats = document.getElementById('hud-stats');
const checklist = document.getElementById('checklist');
const sightingPanel = document.getElementById('sighting-panel');
const identifyBtn = document.getElementById('identify-btn');
const streakFeedback = document.getElementById('streak-feedback');
const streakFeedbackLabel = document.getElementById('streak-feedback-label');
const streakFeedbackPoints = document.getElementById('streak-feedback-points');

const GAME_DURATION = 60;
const FLASHLIGHT_RADIUS = 40;
const TOTAL_BIRDS = 4;
const HIGH_SCORE_STORAGE_KEY = 'birdle-after-dark-high-score';
const UPDATE_CHECK_INTERVAL_MS = 30 * 60 * 1000;
const PORTABLE_FULLSCREEN_QUERY = '(pointer: coarse), (any-pointer: coarse)';
const BIRD_PLACEMENT_PADDING = 18;
const BIRD_PLACEMENT_ATTEMPTS = 180;
const BOTTOM_HUD_RESERVED_HEIGHT = 92;
const OPENING_AUDIO_VOLUME = 0.42;
const BIRD_CALL_MAX_VOLUME = 0.3;
const BIRD_AUDIO_ELEMENT_VOLUME = 1;
const LOW_MEDIA_VOLUME_THRESHOLD = 0.32;
const AUDIO_TIP_HIDE_DELAY_MS = 6500;
const AUDIO_TIP_REMINDER_MESSAGE = 'Turn up sound for the best bird-call clues.';
const AUDIO_TIP_BOOSTED_MESSAGE = 'Game audio is back up. Check your device volume too.';
const AUDIO_TIP_BLOCKED_MESSAGE = 'Tap the speaker to retry audio, then check device volume.';
const BIRD_DOM_FALLBACK_POSITIONS = [
  { top: 38, left: 0 },
  { top: 38, left: 30 },
  { top: 38, left: 54 },
  { top: 38, left: 82 },
  { top: 56, left: 10 },
  { top: 56, left: 42 },
  { top: 56, left: 72 },
];

let timeRemaining = GAME_DURATION;
let foundBirds = new Set();
let score = 0;
let highScore = readStoredHighScore();
let correctStreak = 0;
let gameInterval = null;
let currentMouseX = window.innerWidth / 2;
let currentMouseY = window.innerHeight / 2;
let isPlaying = false;
let isGuessing = false;
let currentBirdTarget = null;
let currentBirdCandidate = null;
let activePointerId = null;
let pointerStartPosition = null;
let endGameTimeout = null;
let streakFeedbackTimeout = null;
let currentControlMode = 'mouse';
let audioContext = null;
let openingAudio = null;
let audioTipTimeout = null;
let isAudioContextWatched = false;

// Initialize birds info
const birdIds = ['great_horned_owl', 'western_screech_owl', 'barn_owl', 'common_poorwill'];
const birdCallSources = {
  great_horned_owl: greatHornedOwlAudioSrc,
  western_screech_owl: westernScreechOwlAudioSrc,
  barn_owl: barnOwlAudioSrc,
  common_poorwill: commonPoorwillAudioSrc,
};
const birdCallNodes = new Map();

function registerAppServiceWorker() {
  if (!('serviceWorker' in navigator) || !import.meta.env.PROD) {
    return;
  }

  registerSW({
    immediate: true,
    onRegisteredSW(_swUrl, registration) {
      if (!registration) {
        return;
      }

      const update = () => {
        if (navigator.onLine) {
          registration.update();
        }
      };

      update();
      window.setInterval(update, UPDATE_CHECK_INTERVAL_MS);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          update();
        }
      });
    },
    onRegisterError(error) {
      console.log('Service worker registration failed:', error);
    },
  });
}

function clearPendingEndGame() {
  if (endGameTimeout) {
    window.clearTimeout(endGameTimeout);
    endGameTimeout = null;
  }
}

function isPortableDevice() {
  return navigator.maxTouchPoints > 0
    || window.matchMedia(PORTABLE_FULLSCREEN_QUERY).matches;
}

function getFullscreenElement() {
  return document.fullscreenElement || document.webkitFullscreenElement || null;
}

function requestPortableFullscreen() {
  if (!isPortableDevice() || getFullscreenElement()) {
    return;
  }

  const root = document.documentElement;

  try {
    const fullscreenPromise = root.requestFullscreen
      ? root.requestFullscreen({ navigationUI: 'hide' })
      : root.webkitRequestFullscreen?.();

    fullscreenPromise?.catch(err => {
      console.log('Fullscreen request failed:', err);
    });
  } catch (err) {
    console.log('Fullscreen request failed:', err);
  }
}

function readStoredHighScore() {
  try {
    const storedValue = window.localStorage.getItem(HIGH_SCORE_STORAGE_KEY);
    const parsedValue = Number.parseInt(storedValue, 10);

    return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : 0;
  } catch {
    return 0;
  }
}

function storeHighScore(value) {
  try {
    window.localStorage.setItem(HIGH_SCORE_STORAGE_KEY, String(value));
  } catch {
    // Ignore storage failures so private browsing modes remain playable.
  }
}

function formatScore(value) {
  return value.toLocaleString('en-US');
}

function updateScoreboard() {
  scoreCountEl.innerText = formatScore(score);
  highScoreCountEl.innerText = formatScore(highScore);
}

function clearStreakFeedback() {
  if (streakFeedbackTimeout) {
    window.clearTimeout(streakFeedbackTimeout);
    streakFeedbackTimeout = null;
  }

  streakFeedback.classList.add('hidden');
}

function showStreakFeedback(label, pointsEarned) {
  if (!label) {
    return;
  }

  clearStreakFeedback();
  streakFeedbackLabel.innerText = label;
  streakFeedbackPoints.innerText = `+${formatScore(pointsEarned)} points`;
  streakFeedback.classList.remove('hidden');

  streakFeedbackTimeout = window.setTimeout(() => {
    streakFeedbackTimeout = null;
    streakFeedback.classList.add('hidden');
  }, 1300);
}

function updateHighScore() {
  if (score <= highScore) {
    return false;
  }

  highScore = score;
  storeHighScore(highScore);
  updateScoreboard();

  return true;
}

function renderEndScoreSummary(isNewHighScore) {
  endScoreSummary.innerHTML = '';

  const rows = [
    ['Score', formatScore(score)],
    ['Best', formatScore(highScore)],
  ];

  rows.forEach(([label, value]) => {
    const scoreRow = document.createElement('div');
    scoreRow.className = 'end-score-row';

    const labelEl = document.createElement('span');
    labelEl.innerText = label;

    const valueEl = document.createElement('strong');
    valueEl.innerText = value;

    scoreRow.append(labelEl, valueEl);
    endScoreSummary.append(scoreRow);
  });

  if (isNewHighScore) {
    const newBestEl = document.createElement('div');
    newBestEl.className = 'new-best';
    newBestEl.innerText = 'New personal best';
    endScoreSummary.append(newBestEl);
  }
}

function getGameViewportCenter() {
  const rect = gameContainer.getBoundingClientRect();

  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
}

function getHandRenderSize() {
  const rect = flashlightHand.getBoundingClientRect();

  if (rect.width && rect.height) {
    return {
      width: rect.width,
      height: rect.height,
    };
  }

  const fallbackWidth = 300;
  const naturalWidth = flashlightHand.naturalWidth || 2816;
  const naturalHeight = flashlightHand.naturalHeight || 1536;

  return {
    width: fallbackWidth,
    height: fallbackWidth * (naturalHeight / naturalWidth),
  };
}

function getBirdsInfo() {
  return birdIds.map(id => {
    const el = document.getElementById(id);
    const rect = el.getBoundingClientRect();

    return {
      id,
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
  });
}

function getAudioContext() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;

  if (!AudioContextClass) {
    return null;
  }

  if (!audioContext) {
    audioContext = new AudioContextClass();
    watchAudioContextState(audioContext);
  }

  return audioContext;
}

function clearAudioTipTimeout() {
  if (audioTipTimeout) {
    window.clearTimeout(audioTipTimeout);
    audioTipTimeout = null;
  }
}

function setAudioTipMessage(message) {
  if (!audioTipButton || !audioTipText) {
    return;
  }

  audioTipText.innerText = message;
  audioTipButton.setAttribute('aria-label', message);
  audioTipButton.title = message;
}

function showAudioTip(message = AUDIO_TIP_REMINDER_MESSAGE, { persist = false } = {}) {
  if (!audioTip) {
    return;
  }

  clearAudioTipTimeout();
  setAudioTipMessage(message);
  audioTip.dataset.persist = persist ? 'true' : 'false';
  audioTip.classList.remove('hidden');
  audioTip.classList.add('is-open');

  audioTipTimeout = window.setTimeout(() => {
    audioTipTimeout = null;
    audioTip.classList.remove('is-open');

    if (!persist) {
      audioTip.classList.add('hidden');
    }
  }, AUDIO_TIP_HIDE_DELAY_MS);
}

function hideAudioTip() {
  if (!audioTip) {
    return;
  }

  clearAudioTipTimeout();
  audioTip.dataset.persist = 'false';
  audioTip.classList.remove('is-open');
  audioTip.classList.add('hidden');
}

function isAudioTipPersistent() {
  return audioTip?.dataset.persist === 'true';
}

function isAudioContextOffDuringPlay() {
  return isPlaying
    && audioContext
    && ['suspended', 'interrupted', 'closed'].includes(audioContext.state);
}

function hasLowOrMutedGameAudio() {
  const trackedAudio = [];

  if (openingAudio) {
    trackedAudio.push(openingAudio);
  }

  birdCallNodes.forEach(({ audio }) => {
    trackedAudio.push(audio);
  });

  return trackedAudio.some(audio => (
    audio.muted || audio.volume < LOW_MEDIA_VOLUME_THRESHOLD
  ));
}

function hasAudioOutputIssue() {
  return hasLowOrMutedGameAudio() || isAudioContextOffDuringPlay();
}

function reconcileAudioTip() {
  if (hasAudioOutputIssue()) {
    showAudioTip(AUDIO_TIP_BLOCKED_MESSAGE, { persist: true });
    return;
  }

  if (isAudioTipPersistent()) {
    hideAudioTip();
  }
}

function ensureMediaElementAudible(audio, recommendedVolume) {
  if (!audio) {
    return false;
  }

  const targetVolume = Math.min(
    1,
    Math.max(recommendedVolume, LOW_MEDIA_VOLUME_THRESHOLD),
  );
  let adjusted = false;

  if (audio.muted) {
    audio.muted = false;
    adjusted = true;
  }

  if (audio.volume < LOW_MEDIA_VOLUME_THRESHOLD) {
    audio.volume = targetVolume;
    adjusted = true;
  }

  return adjusted;
}

function ensureGameAudioLevels() {
  let adjusted = false;

  if (openingAudio) {
    adjusted = ensureMediaElementAudible(openingAudio, OPENING_AUDIO_VOLUME) || adjusted;
  }

  birdCallNodes.forEach(({ audio }) => {
    adjusted = ensureMediaElementAudible(audio, BIRD_AUDIO_ELEMENT_VOLUME) || adjusted;
  });

  if (adjusted) {
    showAudioTip(AUDIO_TIP_BOOSTED_MESSAGE);
  }

  return adjusted;
}

function handleTrackedAudioLevelChange(audio, recommendedVolume) {
  const adjusted = ensureMediaElementAudible(audio, recommendedVolume);

  if (adjusted) {
    showAudioTip(AUDIO_TIP_BOOSTED_MESSAGE);
  }

  reconcileAudioTip();
}

function trackGameAudioElement(audio, recommendedVolume) {
  audio.addEventListener('volumechange', () => {
    handleTrackedAudioLevelChange(audio, recommendedVolume);
  });
  audio.addEventListener('playing', reconcileAudioTip);
  audio.addEventListener('pause', reconcileAudioTip);
}

function watchAudioContextState(context) {
  if (!context || isAudioContextWatched || !context.addEventListener) {
    return;
  }

  isAudioContextWatched = true;
  context.addEventListener('statechange', reconcileAudioTip);
}

function getOpeningAudio() {
  if (!openingAudio) {
    openingAudio = new Audio(gameStartAudioSrc);
    openingAudio.loop = true;
    openingAudio.preload = 'auto';
    openingAudio.volume = OPENING_AUDIO_VOLUME;
    trackGameAudioElement(openingAudio, OPENING_AUDIO_VOLUME);
  }

  return openingAudio;
}

function playOpeningAudio() {
  const audio = getOpeningAudio();

  ensureGameAudioLevels();

  if (!audio.paused) {
    reconcileAudioTip();
    return;
  }

  const playPromise = audio.play();

  if (playPromise) {
    playPromise.then(reconcileAudioTip).catch(err => {
      if (err.name !== 'NotAllowedError') {
        console.log('Opening audio playback failed:', err);
      }

      showAudioTip(AUDIO_TIP_BLOCKED_MESSAGE, { persist: true });
    });
  }
}

function stopOpeningAudio() {
  if (!openingAudio) {
    return;
  }

  openingAudio.pause();

  try {
    openingAudio.currentTime = 0;
  } catch {
    // Some browsers defer seeking until metadata is available.
  }
}

function resumeOpeningAudioIfVisible() {
  if (startScreen.classList.contains('active') || videoScreen.classList.contains('active')) {
    playOpeningAudio();
  }
}

function getBirdCallHintDistance() {
  const rect = gameContainer.getBoundingClientRect();
  const largestAxis = Math.max(
    rect.width || window.innerWidth,
    rect.height || window.innerHeight,
  );

  return Math.max(260, Math.min(560, largestAxis * 0.44));
}

function initializeBirdCallAudio() {
  if (birdCallNodes.size > 0) {
    return getAudioContext();
  }

  const context = getAudioContext();

  if (!context) {
    return null;
  }

  birdIds.forEach(id => {
    const audio = new Audio(birdCallSources[id]);
    audio.loop = true;
    audio.preload = 'auto';
    trackGameAudioElement(audio, BIRD_AUDIO_ELEMENT_VOLUME);

    const source = context.createMediaElementSource(audio);
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    const panner = typeof context.createStereoPanner === 'function'
      ? context.createStereoPanner()
      : null;

    filter.type = 'lowpass';
    filter.frequency.value = 700;
    filter.Q.value = 0.5;
    gain.gain.value = 0;

    source.connect(filter);
    filter.connect(gain);

    if (panner) {
      panner.pan.value = 0;
      gain.connect(panner);
      panner.connect(context.destination);
    } else {
      gain.connect(context.destination);
    }

    birdCallNodes.set(id, {
      audio,
      filter,
      gain,
      panner,
    });
  });

  return context;
}

function updateBirdCallAudio() {
  if (!audioContext || birdCallNodes.size === 0) {
    return;
  }

  const hintDistance = getBirdCallHintDistance();
  const mixes = isPlaying && !isGuessing
    ? getDirectionalBirdCallMix(
      currentMouseX,
      currentMouseY,
      getBirdsInfo(),
      foundBirds,
      {
        maxDistance: hintDistance,
        maxVolume: BIRD_CALL_MAX_VOLUME,
        maxPan: 0.62,
        panDistance: hintDistance * 0.78,
      },
    )
    : birdIds.map(id => ({ id, volume: 0, pan: 0, clarity: 0 }));
  const mixById = new Map(mixes.map(mix => [mix.id, mix]));
  const now = audioContext.currentTime;

  birdCallNodes.forEach(({ filter, gain, panner }, id) => {
    const mix = mixById.get(id) ?? { volume: 0, pan: 0, clarity: 0 };
    const clarityFrequency = 700 + mix.clarity * 5600;

    gain.gain.cancelScheduledValues(now);
    gain.gain.setTargetAtTime(mix.volume, now, 0.16);
    filter.frequency.cancelScheduledValues(now);
    filter.frequency.setTargetAtTime(clarityFrequency, now, 0.18);

    if (panner) {
      panner.pan.cancelScheduledValues(now);
      panner.pan.setTargetAtTime(mix.pan, now, 0.16);
    }
  });
}

function startBirdCalls() {
  const context = initializeBirdCallAudio();

  if (!context) {
    return;
  }

  ensureGameAudioLevels();

  const resumePromise = context.resume?.();

  if (resumePromise) {
    resumePromise.then(reconcileAudioTip).catch(err => {
      console.log('Audio context resume failed:', err);
      showAudioTip(AUDIO_TIP_BLOCKED_MESSAGE, { persist: true });
    });
  }

  birdCallNodes.forEach(({ audio }) => {
    try {
      audio.currentTime = 0;
    } catch {
      // Some browsers defer seeking until metadata is available.
    }

    const playPromise = audio.play();

    if (playPromise) {
      playPromise.catch(err => {
        console.log('Bird call playback failed:', err);
        showAudioTip(AUDIO_TIP_BLOCKED_MESSAGE, { persist: true });
      });
    }
  });

  updateBirdCallAudio();
}

function pauseBirdCalls() {
  birdCallNodes.forEach(({ audio, gain }) => {
    gain.gain.value = 0;
    audio.pause();
  });
}

function setBirdCandidate(birdId) {
  currentBirdCandidate = birdId;

  birdIds.forEach(id => {
    document.getElementById(id).classList.toggle('sighted', id === birdId);
  });

  const hasCandidate = Boolean(birdId);
  hudBottom.classList.toggle('hidden', !hasCandidate);
  sightingPanel.classList.toggle('hidden', !hasCandidate);
  identifyBtn.disabled = !hasCandidate;
}

function refreshBirdCandidate() {
  if (!isPlaying || isGuessing) {
    return;
  }

  const birdId = getBirdCandidateInBeam(
    currentMouseX,
    currentMouseY,
    getBirdsInfo(),
    FLASHLIGHT_RADIUS,
    foundBirds,
  );

  setBirdCandidate(birdId);
}

function openGuessModal(birdId) {
  if (!birdId || foundBirds.has(birdId)) {
    return;
  }

  isGuessing = true;
  currentBirdTarget = birdId;
  setBirdCandidate(null);
  guessModal.classList.remove('hidden');
  guessFeedback.classList.add('hidden');
  updateBirdCallAudio();
}

function updateFlashlight(x, y, controlMode = currentControlMode) {
  if (!isPlaying) return;
  currentControlMode = controlMode;

  const positions = getFlashlightPositions(
    x,
    y,
    controlMode,
    getHandRenderSize(),
  );

  currentMouseX = positions.spotlightX;
  currentMouseY = positions.spotlightY;
  
  // Update mask
  darknessOverlay.style.background = `radial-gradient(circle at ${positions.spotlightX}px ${positions.spotlightY}px, transparent 40px, rgba(0,0,0,0.98) 60px)`;
  
  // Update hand position
  flashlightHand.style.left = `${positions.handX}px`;
  flashlightHand.style.top = `${positions.handY}px`;

  refreshBirdCandidate();
  updateBirdCallAudio();
}

function randomizeBirds() {
  const containerRect = gameContainer.getBoundingClientRect();
  const occupiedRects = getReservedBirdPlacementRects(containerRect);
  const placedPositions = [];

  birdIds.forEach(id => {
    const el = document.getElementById(id);
    const pos = getAvailableBirdPosition(el, containerRect, occupiedRects, placedPositions);
    const placementRect = getBirdPlacementRect(el, pos, containerRect);

    el.style.top = `${pos.top}%`;
    el.style.left = `${pos.left}%`;
    occupiedRects.push(placementRect);
    placedPositions.push(pos);
  });
}

function getReservedBirdPlacementRects(containerRect) {
  const hudStatsRect = hudStats.getBoundingClientRect();
  const checklistRect = checklist.getBoundingClientRect();
  const bottomReservedHeight = Math.min(
    BOTTOM_HUD_RESERVED_HEIGHT,
    containerRect.height * 0.22,
  );

  return [
    hudStatsRect,
    checklistRect,
    {
      left: containerRect.left,
      top: containerRect.bottom - bottomReservedHeight,
      right: containerRect.right,
      bottom: containerRect.bottom,
    },
  ];
}

function getAvailableBirdPosition(el, containerRect, occupiedRects, placedPositions) {
  for (let attempt = 0; attempt < BIRD_PLACEMENT_ATTEMPTS; attempt++) {
    const position = getRandomBirdPosition(placedPositions);
    const placementRect = getBirdPlacementRect(el, position, containerRect);

    if (isBirdPlacementClear(placementRect, containerRect, occupiedRects, BIRD_PLACEMENT_PADDING)) {
      return position;
    }
  }

  const fallbackPosition = BIRD_DOM_FALLBACK_POSITIONS.find(position => {
    const placementRect = getBirdPlacementRect(el, position, containerRect);

    return isBirdPlacementClear(placementRect, containerRect, occupiedRects, BIRD_PLACEMENT_PADDING);
  });

  if (fallbackPosition) {
    return fallbackPosition;
  }

  const scannedPosition = getScannedBirdPosition(
    el,
    containerRect,
    occupiedRects,
    BIRD_PLACEMENT_PADDING,
  );

  if (scannedPosition) {
    return scannedPosition;
  }

  const compactPosition = getScannedBirdPosition(el, containerRect, occupiedRects, 0);

  if (compactPosition) {
    return compactPosition;
  }

  return getRandomBirdPosition(placedPositions, {
    topMin: 38,
    topMax: 62,
    leftMin: 10,
    leftMax: 78,
  });
}

function getScannedBirdPosition(el, containerRect, occupiedRects, padding) {
  const birdSize = getBirdRenderSize(el);
  const maxLeft = Math.max(0, 100 - (birdSize.width / containerRect.width) * 100);
  const maxTop = Math.max(0, 100 - (birdSize.height / containerRect.height) * 100);
  const topLimit = Math.min(72, maxTop);
  const leftLimit = Math.min(88, maxLeft);

  for (let top = 32; top <= topLimit; top += 4) {
    for (let left = 0; left <= leftLimit; left += 3) {
      const position = { top, left };
      const placementRect = getBirdPlacementRect(el, position, containerRect);

      if (isBirdPlacementClear(placementRect, containerRect, occupiedRects, padding)) {
        return position;
      }
    }
  }

  return null;
}

function isBirdPlacementClear(placementRect, containerRect, occupiedRects, padding) {
  const paddedPlacementRect = expandRect(placementRect, padding);

  return isRectInsideContainer(placementRect, containerRect)
    && !occupiedRects.some(occupiedRect => (
      rectsOverlap(paddedPlacementRect, expandRect(occupiedRect, padding))
    ));
}

function isRectInsideContainer(rect, containerRect) {
  return rect.left >= containerRect.left
    && rect.top >= containerRect.top
    && rect.right <= containerRect.right
    && rect.bottom <= containerRect.bottom;
}

function getBirdPlacementRect(el, position, containerRect) {
  const birdSize = getBirdRenderSize(el);
  const left = containerRect.left + containerRect.width * (position.left / 100);
  const top = containerRect.top + containerRect.height * (position.top / 100);

  return {
    left,
    top,
    right: left + birdSize.width,
    bottom: top + birdSize.height,
  };
}

function getBirdRenderSize(el) {
  const rect = el.getBoundingClientRect();
  const width = rect.width || el.offsetWidth || 100;
  const height = rect.height || el.offsetHeight || width;

  return { width, height };
}

function expandRect(rect, padding) {
  return {
    left: rect.left - padding,
    top: rect.top - padding,
    right: rect.right + padding,
    bottom: rect.bottom + padding,
  };
}

function rectsOverlap(firstRect, secondRect) {
  return firstRect.left < secondRect.right
    && firstRect.right > secondRect.left
    && firstRect.top < secondRect.bottom
    && firstRect.bottom > secondRect.top;
}

function startGame() {
  requestPortableFullscreen();
  playOpeningAudio();
  showAudioTip(AUDIO_TIP_REMINDER_MESSAGE);

  startScreen.classList.remove('active');
  endScreen.classList.remove('active');
  videoScreen.classList.add('active');
  tutorialModal.classList.add('hidden');

  transitionVideo.currentTime = 0;
  transitionVideo.play().catch(err => {
    console.log('Video play failed, skipping to tutorial', err);
    showTutorial();
  });
  
  transitionVideo.onended = () => {
    showTutorial();
  };
}

function showTutorial() {
  stopOpeningAudio();
  videoScreen.classList.remove('active');
  tutorialModal.classList.remove('hidden');
  tutorialStartBtn.focus();
}

function startGameLogic() {
  requestPortableFullscreen();

  clearPendingEndGame();
  timeRemaining = GAME_DURATION;
  foundBirds.clear();
  score = 0;
  correctStreak = 0;
  isPlaying = true;
  isGuessing = false;
  currentBirdTarget = null;
  currentBirdCandidate = null;
  activePointerId = null;
  pointerStartPosition = null;
  currentControlMode = 'mouse';
  tutorialModal.classList.add('hidden');
  guessModal.classList.add('hidden');
  guessFeedback.classList.add('hidden');
  clearStreakFeedback();
  setBirdCandidate(null);
  
  // Reset UI
  timerEl.innerText = `1:00`;
  updateScoreboard();
  birdsFoundCountEl.innerText = '0';
  birdIds.forEach(id => {
    const el = document.getElementById(id);
    el.classList.remove('found');
    el.classList.remove('missed');
    el.classList.remove('sighted');
    document.getElementById(`check-${id}`).classList.remove('found');
  });

  // Switch screens
  startScreen.classList.remove('active');
  endScreen.classList.remove('active');
  videoScreen.classList.remove('active');
  gameScreen.classList.add('active');

  randomizeBirds();

  const centerPoint = getGameViewportCenter();
  updateFlashlight(centerPoint.x, centerPoint.y, 'mouse');

  // Start loop
  if (gameInterval) clearInterval(gameInterval);
  gameInterval = setInterval(gameLoop, 1000);

  startBirdCalls();
  showAudioTip(AUDIO_TIP_REMINDER_MESSAGE);
}

function showEndScreen(presentation) {
  gameScreen.classList.remove('active');
  endScreen.classList.add('active');

  endTitle.innerText = presentation.title;
  endTitle.style.color = presentation.titleColor;
  endMessage.innerText = presentation.message;
}

function revealMissedBirds() {
  darknessOverlay.style.background = 'transparent';

  birdIds.forEach(id => {
    if (!foundBirds.has(id)) {
      document.getElementById(id).classList.add('missed');
    }
  });
}

function endGame(result) {
  clearPendingEndGame();
  isPlaying = false;
  isGuessing = false;
  currentBirdTarget = null;
  currentBirdCandidate = null;
  correctStreak = 0;
  activePointerId = null;
  pointerStartPosition = null;
  clearInterval(gameInterval);
  gameInterval = null;
  setBirdCandidate(null);
  clearStreakFeedback();
  guessModal.classList.add('hidden');
  guessFeedback.classList.add('hidden');
  
  pauseBirdCalls();
  hideAudioTip();
  const isNewHighScore = updateHighScore();
  renderEndScoreSummary(isNewHighScore);
  const presentation = getEndGamePresentation(result, timeRemaining);

  if (result === 'win') {
    if (navigator.vibrate) navigator.vibrate([100, 100, 100, 100, 500]); // Victory pattern
    showEndScreen(presentation);
    return;
  }

  if (navigator.vibrate) navigator.vibrate([300]); // Long buzz for loss

  if (presentation.revealMissedBirds) {
    revealMissedBirds();
  }

  endGameTimeout = window.setTimeout(() => {
    endGameTimeout = null;
    showEndScreen(presentation);
  }, presentation.endScreenDelayMs);
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function gameLoop() {
  if (isGuessing) return; // Pause timer during guess
  
  timeRemaining--;
  timerEl.innerText = formatTime(timeRemaining);
  
  const status = isGameOver(timeRemaining, foundBirds.size, TOTAL_BIRDS);
  if (status !== 'playing') {
    endGame(status);
  }
}

function handleRegister() {
  if (!isPlaying || isGuessing) return;

  openGuessModal(currentBirdCandidate);
}

function releaseTrackedPointer(pointerId) {
  if (
    typeof pointerId === 'number' &&
    gameContainer.hasPointerCapture?.(pointerId)
  ) {
    gameContainer.releasePointerCapture(pointerId);
  }

  activePointerId = null;
  pointerStartPosition = null;
}

function handlePointerDown(event) {
  if (!isPlaying || isGuessing || event.button !== 0) {
    return;
  }

  const controlMode = event.pointerType === 'mouse' ? 'mouse' : 'touch';
  pointerStartPosition = { x: event.clientX, y: event.clientY };

  if (event.pointerType !== 'mouse') {
    event.preventDefault();
    activePointerId = event.pointerId;
    gameContainer.setPointerCapture?.(event.pointerId);
  }

  updateFlashlight(event.clientX, event.clientY, controlMode);
}

function handlePointerMove(event) {
  if (!isPlaying || isGuessing) {
    return;
  }

  if (event.pointerType !== 'mouse' && activePointerId !== event.pointerId) {
    return;
  }

  if (event.pointerType !== 'mouse') {
    event.preventDefault();
  }

  updateFlashlight(
    event.clientX,
    event.clientY,
    event.pointerType === 'mouse' ? 'mouse' : 'touch'
  );
}

function handlePointerUp(event) {
  if (event.pointerType !== 'mouse' && activePointerId !== event.pointerId) {
    return;
  }

  const isMouseClick = event.pointerType === 'mouse'
    && event.button === 0
    && isTapInteraction(
      pointerStartPosition,
      { x: event.clientX, y: event.clientY },
    );

  if (event.pointerType !== 'mouse') {
    event.preventDefault();
  }

  updateFlashlight(
    event.clientX,
    event.clientY,
    event.pointerType === 'mouse' ? 'mouse' : 'touch'
  );

  releaseTrackedPointer(event.pointerId);

  if (isMouseClick) {
    handleRegister();
  }
}

function handlePointerCancel(event) {
  releaseTrackedPointer(event.pointerId);
}

function playActiveBirdCalls() {
  if (birdCallNodes.size === 0) {
    startBirdCalls();
    return;
  }

  const resumePromise = audioContext?.resume?.();

  if (resumePromise) {
    resumePromise.then(reconcileAudioTip).catch(err => {
      console.log('Audio context resume failed:', err);
      showAudioTip(AUDIO_TIP_BLOCKED_MESSAGE, { persist: true });
    });
  }

  birdCallNodes.forEach(({ audio }) => {
    const playPromise = audio.play();

    if (playPromise) {
      playPromise.catch(err => {
        console.log('Bird call playback failed:', err);
        showAudioTip(AUDIO_TIP_BLOCKED_MESSAGE, { persist: true });
      });
    }
  });

  updateBirdCallAudio();
}

function handleAudioTipButtonClick() {
  const adjusted = ensureGameAudioLevels();

  if (isPlaying) {
    playActiveBirdCalls();
  } else if (startScreen.classList.contains('active') || videoScreen.classList.contains('active')) {
    playOpeningAudio();
  }

  showAudioTip(adjusted ? AUDIO_TIP_BOOSTED_MESSAGE : AUDIO_TIP_REMINDER_MESSAGE);
  reconcileAudioTip();
}

guessBtns.forEach(btn => {
  btn.addEventListener('click', (e) => {
    const guessedBird = e.target.getAttribute('data-bird');
    
    if (guessedBird === currentBirdTarget) {
      // Correct guess
      if (navigator.vibrate) navigator.vibrate(100); // Short buzz
      const foundBirdId = currentBirdTarget;
      isGuessing = false;
      currentBirdTarget = null;
      guessModal.classList.add('hidden');
      foundBirds.add(foundBirdId);
      correctStreak += 1;
      const pointsEarned = calculateIdentificationScore(timeRemaining, correctStreak);
      score += pointsEarned;
      updateScoreboard();
      showStreakFeedback(getStreakFeedback(correctStreak), pointsEarned);
      
      // Update UI
      document.getElementById(foundBirdId).classList.add('found');
      document.getElementById(`check-${foundBirdId}`).classList.add('found');
      birdsFoundCountEl.innerText = foundBirds.size;
      updateBirdCallAudio();
      
      // Check win condition immediately
      if (isGameOver(timeRemaining, foundBirds.size, TOTAL_BIRDS) === 'win') {
        endGame('win');
      } else {
        refreshBirdCandidate();
      }
    } else {
      // Incorrect guess
      if (navigator.vibrate) navigator.vibrate([100, 50, 100, 50, 100]); // Warning buzz
      guessFeedback.classList.remove('hidden');
      correctStreak = 0;
      timeRemaining -= 5;
      
      if (timeRemaining <= 0) {
        timeRemaining = 0;
        timerEl.innerText = formatTime(timeRemaining);
        guessModal.classList.add('hidden');
        endGame('loss');
      } else {
        timerEl.innerText = formatTime(timeRemaining);
      }
    }
  });
});

// Event Listeners
startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);
tutorialStartBtn.addEventListener('click', startGameLogic);
identifyBtn.addEventListener('click', handleRegister);
audioTipButton.addEventListener('click', handleAudioTipButtonClick);

gameContainer.addEventListener('pointerdown', handlePointerDown);
gameContainer.addEventListener('pointermove', handlePointerMove);
gameContainer.addEventListener('pointerup', handlePointerUp);
gameContainer.addEventListener('pointercancel', handlePointerCancel);
document.addEventListener('pointerdown', resumeOpeningAudioIfVisible, { capture: true });
document.addEventListener('keydown', resumeOpeningAudioIfVisible);

// Initial update
registerAppServiceWorker();
updateScoreboard();
updateFlashlight(window.innerWidth / 2, window.innerHeight / 2);
playOpeningAudio();

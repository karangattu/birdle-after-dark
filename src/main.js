import { registerSW } from 'virtual:pwa-register';
import {
  calculateIdentificationScore,
  getBirdCandidateInBeam,
  getDirectionalBirdCallMix,
  getEndGamePresentation,
  getFlashlightPositions,
  getNearestUnfoundBirdDistance,
  getProximityBand,
  getRoundCountdownSteps,
  getStreakFeedback,
  isBirdStartlable,
  isTapInteraction,
  isGameOver,
  getRandomBirdPosition,
  updateMovingBirdState,
  startleMovingBirdState,
} from './gameLogic.js';
import {
  isLowBatteryTime,
  countdownBeepIndex,
} from './lowBattery.js';
import {
  isStandaloneDisplayMode,
  readInstallPromptDismissed,
  shouldShowInstallPrompt,
  writeInstallPromptDismissed,
} from './installPrompt.js';
import { initializeFieldGuide } from './fieldGuide.js';
import {
  fetchHighScore,
  fetchTopLeaderboard,
  saveScore,
  isTopScore,
  subscribeToLeaderboard,
  unsubscribeFromLeaderboard,
} from './leaderboard.js';
import barnOwlAudioSrc from '../assets/barn_owl.mp3';
import commonPoorwillAudioSrc from '../assets/common_poorwill.mp3';
import gameStartAudioSrc from '../assets/game_start_audio.mp3';
import greatHornedOwlAudioSrc from '../assets/great_horned_owl.mp3';
import westernScreechOwlAudioSrc from '../assets/western_screech_owl.mp3';
import westernScreechOwlRestingSrc from '../assets/western_screech_owl.png';
import westernScreechOwlSpriteSheetSrc from '../assets/western_screech_owl_sprite_sheet.png';
import commonPoorwillRestingSrc from '../assets/common_poorwill.png';
import commonPoorwillSpriteSheetSrc from '../assets/common_poorwill_sprite_sheet.png';
import barnOwlRestingSrc from '../assets/barn_owl.png';
import barnOwlSpriteSheetSrc from '../assets/barn_owl_sprite_sheet.png';

// DOM Elements
const startScreen = document.getElementById('start-screen');
const installPrompt = document.getElementById('install-prompt');
const installPromptInstallBtn = document.getElementById('install-prompt-install-btn');
const installPromptDismissBtn = document.getElementById('install-prompt-dismiss-btn');
const gameScreen = document.getElementById('game-screen');
const endScreen = document.getElementById('end-screen');
const gameContainer = document.getElementById('game-container');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
const modeRegularBtn = document.getElementById('mode-regular-btn');
const modeExpertBtn = document.getElementById('mode-expert-btn');
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
const skipVideoBtn = document.getElementById('skip-video-btn');
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
const startHighScore = document.getElementById('start-high-score');
const leaderboard = document.getElementById('leaderboard');
const leaderboardList = document.getElementById('leaderboard-list');
const leaderboardNameForm = document.getElementById('leaderboard-name-form');
const leaderboardNameInput = document.getElementById('leaderboard-name-input');
const leaderboardSubmitBtn = document.getElementById('leaderboard-submit-btn');
const leaderboardNameFeedback = document.getElementById('leaderboard-name-feedback');
const homeBtn = document.getElementById('home-btn');
const countdownOverlay = document.getElementById('countdown-overlay');
const countdownNumber = document.getElementById('countdown-number');
const pauseOverlay = document.getElementById('pause-overlay');
const resumeBtn = document.getElementById('resume-btn');
const pauseBtn = document.getElementById('pause-btn');
const quitBtn = document.getElementById('quit-btn');
const pauseQuitBtn = document.getElementById('pause-quit-btn');
const sightingKicker = document.getElementById('sighting-kicker');
const sightingTitle = document.getElementById('sighting-title');
const checklistToggle = document.getElementById('checklist-toggle');

const GAME_DURATION_REGULAR = 60;
const GAME_DURATION_EXPERT = 40;
const FLASHLIGHT_RADIUS = 40;
const TOTAL_BIRDS = 4;
const HIGH_SCORE_REGULAR_KEY = 'birdle-after-dark-high-score-regular';
const HIGH_SCORE_EXPERT_KEY = 'birdle-after-dark-high-score-expert';
const GAME_MODE_STORAGE_KEY = 'birdle-after-dark-game-mode';
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
const MOVING_BIRD_SPEED = 0.12;
const TRANSPARENT_PIXEL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
const HORIZONTAL_ONLY_BIRDS = new Set(['barn_owl', 'western_screech_owl', 'common_poorwill']);
const ROUND_COUNTDOWN_STEP_MS = 900;
const ROUND_COUNTDOWN_GO_MS = 700;
const ROUND_COUNTDOWN_TONE_FREQUENCY = 660;
const ROUND_COUNTDOWN_GO_FREQUENCY = 990;
const TIMER_WARN_THRESHOLD = 15;
const TIMER_DANGER_THRESHOLD = 10;
const BEAM_SMOOTHING_RATE = 18;
const BEAM_AUDIO_UPDATE_INTERVAL = 0.15;
const CANDIDATE_REFRESH_MIN_MOVE_PX = 0.75;
const SCORE_COUNT_UP_MS = 500;
const WARM_TICK_FREQUENCY = 1200;

function getMovingBirdIds() {
  if (gameMode === 'expert') {
    return ['western_screech_owl', 'common_poorwill'];
  }
  return ['barn_owl'];
}
const BIRD_DOM_FALLBACK_POSITIONS = [
  { top: 38, left: 0 },
  { top: 38, left: 30 },
  { top: 38, left: 54 },
  { top: 38, left: 82 },
  { top: 56, left: 10 },
  { top: 56, left: 42 },
  { top: 56, left: 72 },
];

let timeRemaining = GAME_DURATION_REGULAR;
let foundBirds = new Set();
let score = 0;
let gameMode = 'regular';
let highScore = 0;
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
let deferredInstallPrompt = null;
let installPromptDismissed = readInstallPromptDismissed(getSafeStorage());
let leaderboardSubmitted = false;
let globalHighScore = 0;
let movingBirdsState = new Map();
let animationFrameId = null;
let lowBatteryActive = false;
let lastBeepIndexPlayed = -1;
let isCountingDown = false;
let countdownTimeouts = [];
let isPaused = false;
let targetSpotX = window.innerWidth / 2;
let targetSpotY = window.innerHeight / 2;
let renderedSpotX = targetSpotX;
let renderedSpotY = targetSpotY;
let targetHandX = 0;
let targetHandY = 0;
let renderedHandX = 0;
let renderedHandY = 0;
let lastCandidateSpotX = null;
let lastCandidateSpotY = null;
let beamAudioAccumulator = 0;
let displayedScore = 0;
let scoreAnimFrame = null;
let roundGuesses = 0;
let roundBestStreak = 0;
let isWarmHintShown = false;

// Initialize birds info
const birdIds = ['great_horned_owl', 'western_screech_owl', 'barn_owl', 'common_poorwill'];
const birdCallSources = {
  great_horned_owl: greatHornedOwlAudioSrc,
  western_screech_owl: westernScreechOwlAudioSrc,
  barn_owl: barnOwlAudioSrc,
  common_poorwill: commonPoorwillAudioSrc,
};
const birdSpriteSheets = {
  barn_owl: {
    src: barnOwlSpriteSheetSrc,
    restingSrc: barnOwlRestingSrc,
  },
  western_screech_owl: {
    src: westernScreechOwlSpriteSheetSrc,
    restingSrc: westernScreechOwlRestingSrc,
  },
  common_poorwill: {
    src: commonPoorwillSpriteSheetSrc,
    restingSrc: commonPoorwillRestingSrc,
  },
};
const birdCallNodes = new Map();

function getSafeStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

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

function updateInstallPromptVisibility() {
  if (!installPrompt) {
    return;
  }

  installPrompt.classList.toggle(
    'hidden',
    !shouldShowInstallPrompt({
      isStandalone: isStandaloneDisplayMode(window),
      hasDeferredPrompt: Boolean(deferredInstallPrompt),
      dismissed: installPromptDismissed,
    }),
  );
}

function handleBeforeInstallPrompt(event) {
  event.preventDefault();

  if (isStandaloneDisplayMode(window) || installPromptDismissed) {
    return;
  }

  deferredInstallPrompt = event;
  updateInstallPromptVisibility();
}

async function promptInstallApp() {
  if (!deferredInstallPrompt) {
    return;
  }

  const promptEvent = deferredInstallPrompt;
  deferredInstallPrompt = null;
  updateInstallPromptVisibility();

  promptEvent.prompt();

  const choiceResult = promptEvent.userChoice ? await promptEvent.userChoice : null;

  if (choiceResult?.outcome === 'accepted') {
    installPromptDismissed = false;
    writeInstallPromptDismissed(getSafeStorage(), false);
  }
}

function dismissInstallPrompt() {
  deferredInstallPrompt = null;
  installPromptDismissed = true;
  writeInstallPromptDismissed(getSafeStorage(), true);
  updateInstallPromptVisibility();
}

window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null;
  installPromptDismissed = false;
  writeInstallPromptDismissed(getSafeStorage(), false);
  updateInstallPromptVisibility();
});

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
  const key = gameMode === 'expert' ? HIGH_SCORE_EXPERT_KEY : HIGH_SCORE_REGULAR_KEY;
  try {
    const storedValue = window.localStorage.getItem(key);
    const parsedValue = Number.parseInt(storedValue, 10);

    return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : 0;
  } catch {
    return 0;
  }
}

function storeHighScore(value) {
  const key = gameMode === 'expert' ? HIGH_SCORE_EXPERT_KEY : HIGH_SCORE_REGULAR_KEY;
  try {
    window.localStorage.setItem(key, String(value));
  } catch {
    // Ignore storage failures so private browsing modes remain playable.
  }
}

function formatScore(value) {
  return value.toLocaleString('en-US');
}

function loadGameMode() {
  try {
    const stored = window.localStorage.getItem(GAME_MODE_STORAGE_KEY);
    if (stored === 'expert' || stored === 'regular') {
      return stored;
    }
  } catch {
    // Ignore
  }
  return 'regular';
}

function saveGameMode(mode) {
  try {
    window.localStorage.setItem(GAME_MODE_STORAGE_KEY, mode);
  } catch {
    // Ignore
  }
}

function updateModeButtons() {
  modeRegularBtn.classList.toggle('active', gameMode === 'regular');
  modeExpertBtn.classList.toggle('active', gameMode === 'expert');
}

function initializeMovingBirds() {
  movingBirdsState.clear();
  const containerRect = gameContainer.getBoundingClientRect();

  getMovingBirdIds().forEach(id => {
    const horizontalOnly = HORIZONTAL_ONLY_BIRDS.has(id);
    const horizontal = horizontalOnly ? true : Math.random() > 0.5;
    const direction = Math.random() > 0.5 ? 1 : -1;

    let startX, startY, velocityX, velocityY;

    if (horizontal) {
      startX = horizontalOnly
        ? containerRect.width * (0.1 + Math.random() * 0.8)
        : direction > 0 ? -5 : containerRect.width + 5;
      startY = containerRect.height * (0.25 + Math.random() * 0.45);
      velocityX = direction * MOVING_BIRD_SPEED * containerRect.width;
      velocityY = horizontalOnly ? 0 : (Math.random() - 0.5) * 0.03 * containerRect.height;
    } else {
      startX = containerRect.width * (0.2 + Math.random() * 0.6);
      startY = direction > 0 ? -5 : containerRect.height + 5;
      velocityX = (Math.random() - 0.5) * 0.04 * containerRect.width;
      velocityY = direction * MOVING_BIRD_SPEED * containerRect.height;
    }

    movingBirdsState.set(id, {
      xPercent: (startX / containerRect.width) * 100,
      yPercent: (startY / containerRect.height) * 100,
      velocityXPercent: (velocityX / containerRect.width) * 100,
      velocityYPercent: (velocityY / containerRect.height) * 100,
      isMoving: true,
      isFrozen: false,
      reactionState: null,
      reactionTimer: 0,
      startleCooldown: 0,
    });
  });
}

function updateMovingBirds(deltaTime) {
  if (getMovingBirdIds().length === 0) return;

  getMovingBirdIds().forEach(id => {
    let state = movingBirdsState.get(id);
    if (!state || foundBirds.has(id)) return;

    const nextState = updateMovingBirdState(state, deltaTime, {
      movingBirdSpeed: MOVING_BIRD_SPEED,
      horizontalOnly: HORIZONTAL_ONLY_BIRDS.has(id),
    });
    movingBirdsState.set(id, nextState);
    state = nextState;

    const el = document.getElementById(id);
    el.style.left = `${state.xPercent}%`;
    el.style.top = `${state.yPercent}%`;

    updateBirdFacing(id, state.velocityXPercent);

    if (birdSpriteSheets[id]) {
      setBirdFlyingImage(id, state.isMoving);
    }
  });
}

function startleMovingBird(id) {
  const state = movingBirdsState.get(id);
  if (state && isBirdStartlable(state)) {
    const nextState = startleMovingBirdState(state);
    movingBirdsState.set(id, nextState);
    if (birdSpriteSheets[id]) {
      setBirdFlyingImage(id, nextState.isMoving);
    }
  }
}

function checkMovingBirdDetection() {
  if (getMovingBirdIds().length === 0) return;

  const birdsInfo = getBirdsInfo();

  getMovingBirdIds().forEach(id => {
    if (foundBirds.has(id)) return;
    const state = movingBirdsState.get(id);
    if (!state || state.isFrozen) return;

    if (!isBirdStartlable(state)) return;

    const birdInfo = birdsInfo.find(b => b.id === id);
    if (!birdInfo) return;

    const dx = currentMouseX - birdInfo.x;
    const dy = currentMouseY - birdInfo.y;
    const distanceSquared = dx * dx + dy * dy;

    if (distanceSquared <= FLASHLIGHT_RADIUS * FLASHLIGHT_RADIUS) {
      startleMovingBird(id);
    }
  });
}

function startMovingBirdAnimation() {
  if (animationFrameId) return;
  let lastTime = performance.now();

  const animate = (currentTime) => {
    if (!isPlaying || isPaused) {
      animationFrameId = null;
      return;
    }

    const deltaTime = (currentTime - lastTime) / 1000;
    lastTime = currentTime;

    smoothBeamTowardsTarget(deltaTime);

    beamAudioAccumulator += deltaTime;
    if (beamAudioAccumulator >= BEAM_AUDIO_UPDATE_INTERVAL) {
      beamAudioAccumulator = 0;
      updateBirdCallAudio();
    }

    updateMovingBirds(deltaTime);
    checkMovingBirdDetection();

    animationFrameId = requestAnimationFrame(animate);
  };

  animationFrameId = requestAnimationFrame(animate);
}

function stopMovingBirdAnimation() {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
}

function flickerBeamRadius() {
  const r = Math.random();
  if (r < 0.25) return 5 + Math.random() * 8;
  if (r < 0.45) return 15 + Math.random() * 8;
  if (r < 0.55) return 28 + Math.random() * 8;
  return 40;
}

function renderBeam() {
  currentMouseX = renderedSpotX;
  currentMouseY = renderedSpotY;

  const beamRadius = lowBatteryActive ? flickerBeamRadius() : FLASHLIGHT_RADIUS;

  darknessOverlay.style.background = `radial-gradient(circle at ${renderedSpotX}px ${renderedSpotY}px, transparent ${beamRadius}px, rgba(0,0,0,0.98) ${beamRadius + 20}px)`;
  flashlightHand.style.left = `${renderedHandX}px`;
  flashlightHand.style.top = `${renderedHandY}px`;

  const movedX = lastCandidateSpotX === null ? Infinity : Math.abs(renderedSpotX - lastCandidateSpotX);
  const movedY = lastCandidateSpotY === null ? Infinity : Math.abs(renderedSpotY - lastCandidateSpotY);

  if (movedX > CANDIDATE_REFRESH_MIN_MOVE_PX || movedY > CANDIDATE_REFRESH_MIN_MOVE_PX) {
    lastCandidateSpotX = renderedSpotX;
    lastCandidateSpotY = renderedSpotY;
    refreshBirdCandidate();
  }
}

function smoothBeamTowardsTarget(deltaTime) {
  const blend = Math.min(1, deltaTime * BEAM_SMOOTHING_RATE);

  renderedSpotX += (targetSpotX - renderedSpotX) * blend;
  renderedSpotY += (targetSpotY - renderedSpotY) * blend;
  renderedHandX += (targetHandX - renderedHandX) * blend;
  renderedHandY += (targetHandY - renderedHandY) * blend;

  renderBeam();
}

function snapBeamToTarget() {
  renderedSpotX = targetSpotX;
  renderedSpotY = targetSpotY;
  renderedHandX = targetHandX;
  renderedHandY = targetHandY;
  lastCandidateSpotX = null;
  lastCandidateSpotY = null;
  beamAudioAccumulator = 0;
  renderBeam();
}

function setBirdFlyingImage(id, isFlying) {
  const sprite = birdSpriteSheets[id];

  if (!sprite) return;

  const el = document.getElementById(id);
  const spriteState = isFlying ? 'flying' : 'resting';

  if (el.dataset.spriteState === spriteState) {
    return;
  }

  el.dataset.spriteState = spriteState;
  el.classList.toggle('bird-sprite-flying', isFlying);
  el.style.backgroundImage = isFlying ? `url("${sprite.src}")` : '';
  el.src = isFlying ? TRANSPARENT_PIXEL : sprite.restingSrc;
}

function updateBirdFacing(id, velocityXPercent) {
  if (!birdSpriteSheets[id]) return;

  const el = document.getElementById(id);
  el.style.scale = velocityXPercent < 0 ? '-1 1' : '1 1';
}

function updateBirdImagesForMode() {
  getMovingBirdIds().forEach(id => {
    const state = movingBirdsState.get(id);
    if (state && state.isMoving && !state.isFrozen) {
      setBirdFlyingImage(id, true);
    } else {
      setBirdFlyingImage(id, false);
    }
  });
}

async function loadGlobalHighScore() {
  try {
    globalHighScore = await fetchHighScore(gameMode);
  } catch {
    globalHighScore = 0;
  }

  if (globalHighScore > 0) {
    const modeLabel = gameMode === 'expert' ? 'Expert High Score' : 'High Score';
    startHighScore.innerHTML = `<span>${modeLabel} <strong>${formatScore(globalHighScore)}</strong></span>`;
  } else {
    startHighScore.innerHTML = '';
  }
}

function renderLeaderboard(data) {
  leaderboardList.innerHTML = '';

  if (!data || data.length === 0) {
    leaderboardList.innerHTML = '<div class="leaderboard-empty">No scores yet. Be the first!</div>';
    return;
  }

  const list = document.createElement('ol');
  list.className = 'leaderboard-ol';

  data.forEach((entry) => {
    const item = document.createElement('li');
    item.className = 'leaderboard-li';
    item.innerHTML = `<span class="leaderboard-name">${escapeHtml(entry.name)}</span><span class="leaderboard-score">${formatScore(entry.score)}</span>`;
    list.append(item);
  });

  leaderboardList.append(list);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(text));
  return div.innerHTML;
}

async function handleScoreSubmission() {
  const name = leaderboardNameInput.value.trim();
  if (!name) {
    leaderboardNameFeedback.classList.remove('hidden');
    leaderboardNameFeedback.innerText = 'Please enter your name.';
    leaderboardNameInput.focus();
    return;
  }

  leaderboardSubmitBtn.disabled = true;
  leaderboardNameFeedback.classList.add('hidden');

  const result = await saveScore(name, score, gameMode);

  if (result) {
    leaderboardSubmitted = true;
    leaderboardNameForm.classList.add('hidden');
    const topData = await fetchTopLeaderboard(gameMode);
    renderLeaderboard(topData);
  } else {
    leaderboardNameFeedback.classList.remove('hidden');
    leaderboardNameFeedback.innerText = 'Failed to save. Try again.';
    leaderboardSubmitBtn.disabled = false;
  }
}

async function showEndLeaderboard() {
  leaderboard.classList.remove('hidden');
  leaderboardNameForm.classList.add('hidden');
  leaderboardNameFeedback.classList.add('hidden');

  const topData = await fetchTopLeaderboard(gameMode);
  renderLeaderboard(topData);

  if (!leaderboardSubmitted && isTopScore(score, topData)) {
    leaderboardNameForm.classList.remove('hidden');
    leaderboardNameInput.value = '';
    leaderboardSubmitBtn.disabled = false;
    leaderboardNameInput.focus();
  }
}

function resetLeaderboardState() {
  leaderboardSubmitted = false;
  leaderboard.classList.add('hidden');
  leaderboardNameForm.classList.add('hidden');
  leaderboardNameInput.value = '';
  leaderboardSubmitBtn.disabled = false;
}

async function handleLeaderboardRealtimeUpdate() {
  if (!leaderboard.classList.contains('hidden')) {
    const topData = await fetchTopLeaderboard(gameMode);
    renderLeaderboard(topData);
  }
  await loadGlobalHighScore();
}

function updateScoreboard(instant = false) {
  highScoreCountEl.innerText = formatScore(highScore);

  if (instant) {
    if (scoreAnimFrame) {
      cancelAnimationFrame(scoreAnimFrame);
      scoreAnimFrame = null;
    }

    displayedScore = score;
    scoreCountEl.innerText = formatScore(score);
    return;
  }

  const startValue = displayedScore;
  const delta = score - startValue;

  if (delta === 0) {
    scoreCountEl.innerText = formatScore(score);
    return;
  }

  if (scoreAnimFrame) {
    cancelAnimationFrame(scoreAnimFrame);
    scoreAnimFrame = null;
  }

  const startTime = performance.now();

  const tick = (now) => {
    const t = Math.min(1, (now - startTime) / SCORE_COUNT_UP_MS);
    const eased = 1 - Math.pow(1 - t, 3);

    displayedScore = Math.round(startValue + delta * eased);
    scoreCountEl.innerText = formatScore(displayedScore);

    if (t < 1) {
      scoreAnimFrame = requestAnimationFrame(tick);
    } else {
      scoreAnimFrame = null;
      displayedScore = score;
    }
  };

  scoreAnimFrame = requestAnimationFrame(tick);
}

function updateTimerStages() {
  timerEl.classList.toggle(
    'warn',
    timeRemaining <= TIMER_WARN_THRESHOLD && timeRemaining > TIMER_DANGER_THRESHOLD,
  );
  timerEl.classList.toggle('danger', timeRemaining <= TIMER_DANGER_THRESHOLD);
}

function setChecklistCollapsed(collapsed) {
  checklist.classList.toggle('collapsed', collapsed);
  checklistToggle.setAttribute('aria-expanded', String(!collapsed));
  checklistToggle.setAttribute(
    'aria-label',
    collapsed ? 'Expand checklist' : 'Collapse checklist',
  );
  checklistToggle.innerText = collapsed ? '+' : '–';
}

function spawnFloatPoints(points) {
  const floatEl = document.createElement('div');
  floatEl.className = 'float-points';
  floatEl.innerText = `+${formatScore(points)}`;
  floatEl.style.left = `${currentMouseX}px`;
  floatEl.style.top = `${currentMouseY}px`;
  gameScreen.append(floatEl);

  window.setTimeout(() => {
    floatEl.remove();
  }, 1100);
}

function clearFloatPoints() {
  gameScreen.querySelectorAll('.float-points').forEach(el => el.remove());
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
  updateScoreboard(true);

  return true;
}

function renderEndScoreSummary(isNewHighScore) {
  endScoreSummary.innerHTML = '';

  const modeLabel = gameMode === 'expert' ? 'Expert' : 'Regular';
  const gameDuration = gameMode === 'expert' ? GAME_DURATION_EXPERT : GAME_DURATION_REGULAR;
  const elapsed = Math.max(0, gameDuration - Math.max(0, timeRemaining));
  const correctCount = foundBirds.size;
  const accuracyLabel = roundGuesses > 0
    ? `${Math.round((correctCount / roundGuesses) * 100)}% (${correctCount}/${roundGuesses})`
    : '—';
  const avgPerBirdLabel = correctCount > 0
    ? `${(elapsed / correctCount).toFixed(1)}s`
    : '—';
  const rows = [
    ['Mode', modeLabel],
    ['Score', formatScore(score)],
    ['Best', formatScore(highScore)],
    ['Accuracy', accuracyLabel],
    ['Best streak', String(roundBestStreak)],
    ['Avg. per bird', avgPerBirdLabel],
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

function getMovingBirdsInfo() {
  if (movingBirdsState.size === 0) {
    return getBirdsInfo();
  }

  return birdIds.map(id => {
    const el = document.getElementById(id);
    const state = movingBirdsState.get(id);

    let x, y;
    if (state && state.isMoving) {
      const containerRect = gameContainer.getBoundingClientRect();
      x = containerRect.left + containerRect.width * (state.xPercent / 100);
      y = containerRect.top + containerRect.height * (state.yPercent / 100);
    } else {
      const rect = el.getBoundingClientRect();
      x = rect.left + rect.width / 2;
      y = rect.top + rect.height / 2;
    }

    return { id, x, y };
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
      getMovingBirdsInfo(),
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

function playWarmTick() {
  const ctx = getAudioContext();

  if (!ctx) {
    return;
  }

  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();
  const now = ctx.currentTime;

  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(WARM_TICK_FREQUENCY, now);

  gainNode.gain.setValueAtTime(0.05, now);
  gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);

  oscillator.start(now);
  oscillator.stop(now + 0.08);
}

function setWarmHint(show) {
  if (show === isWarmHintShown) {
    return;
  }

  isWarmHintShown = show;

  if (show) {
    hudBottom.classList.remove('hidden');
    sightingPanel.classList.remove('hidden');
    sightingPanel.classList.add('warm');
    sightingKicker.innerText = 'Signal rising';
    sightingTitle.innerText = 'Getting warmer…';
    identifyBtn.disabled = true;
    identifyBtn.classList.remove('pulse');
    playWarmTick();
    return;
  }

  sightingPanel.classList.remove('warm');
  sightingKicker.innerText = 'Bird in beam';
  sightingTitle.innerText = 'Ready to identify';

  if (!currentBirdCandidate) {
    hudBottom.classList.add('hidden');
    sightingPanel.classList.add('hidden');
  }
}

function setBirdCandidate(birdId) {
  currentBirdCandidate = birdId;

  birdIds.forEach(id => {
    document.getElementById(id).classList.toggle('sighted', id === birdId);
  });

  const hasCandidate = Boolean(birdId);

  if (hasCandidate && isWarmHintShown) {
    isWarmHintShown = false;
    sightingPanel.classList.remove('warm');
    sightingKicker.innerText = 'Bird in beam';
    sightingTitle.innerText = 'Ready to identify';
  }

  hudBottom.classList.toggle('hidden', !hasCandidate);
  sightingPanel.classList.toggle('hidden', !hasCandidate);
  identifyBtn.disabled = !hasCandidate;
  identifyBtn.classList.toggle('pulse', hasCandidate);
}

function refreshBirdCandidate() {
  if (!isPlaying || isGuessing || isPaused) {
    return;
  }

  const birdsInfo = getMovingBirdsInfo();
  const birdId = getBirdCandidateInBeam(
    currentMouseX,
    currentMouseY,
    birdsInfo,
    FLASHLIGHT_RADIUS,
    foundBirds,
  );

  if (birdId) {
    setWarmHint(false);
    setBirdCandidate(birdId);
    return;
  }

  setBirdCandidate(null);

  const nearest = getNearestUnfoundBirdDistance(
    currentMouseX,
    currentMouseY,
    birdsInfo,
    foundBirds,
  );

  setWarmHint(
    Boolean(nearest && getProximityBand(nearest.distance, FLASHLIGHT_RADIUS) === 'warm'),
  );
}

function openGuessModal(birdId) {
  if (!birdId || foundBirds.has(birdId)) {
    return;
  }

  isGuessing = true;
  currentBirdTarget = birdId;
  setBirdCandidate(null);
  setWarmHint(false);
  guessModal.classList.remove('hidden');
  guessFeedback.classList.add('hidden');
  updateBirdCallAudio();
}

function updateFlashlight(x, y, controlMode = currentControlMode) {
  if ((!isPlaying && !isCountingDown) || isPaused) return;
  currentControlMode = controlMode;

  const positions = getFlashlightPositions(
    x,
    y,
    controlMode,
    getHandRenderSize(),
  );

  targetSpotX = positions.spotlightX;
  targetSpotY = positions.spotlightY;
  targetHandX = positions.handX;
  targetHandY = positions.handY;

  if (!isPlaying) {
    snapBeamToTarget();
    return;
  }

  if (!animationFrameId) {
    smoothBeamTowardsTarget(1);
  }
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
  resetLeaderboardState();

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

function pauseGame() {
  if (isPaused || isCountingDown) {
    return;
  }

  if (!gameScreen.classList.contains('active') || !isPlaying) {
    return;
  }

  isPaused = true;
  snapBeamToTarget();
  clearInterval(gameInterval);
  gameInterval = null;
  stopMovingBirdAnimation();
  pauseBirdCalls();
  releaseTrackedPointer(activePointerId);
  pauseOverlay.classList.remove('hidden');
  resumeBtn.focus?.();
}

function resumeGame() {
  if (!isPaused) {
    return;
  }

  isPaused = false;
  pauseOverlay.classList.add('hidden');

  if (!gameScreen.classList.contains('active') || !isPlaying) {
    return;
  }

  if (gameInterval) clearInterval(gameInterval);
  gameInterval = setInterval(gameLoop, 1000);
  playActiveBirdCalls();
  startMovingBirdAnimation();
}

function quitToHome() {
  cancelRoundCountdown();
  clearPendingEndGame();
  isPaused = false;
  pauseOverlay.classList.add('hidden');
  isPlaying = false;
  isGuessing = false;
  currentBirdTarget = null;
  currentBirdCandidate = null;
  correctStreak = 0;
  activePointerId = null;
  pointerStartPosition = null;
  clearInterval(gameInterval);
  gameInterval = null;
  stopMovingBirdAnimation();
  setBirdCandidate(null);
  setWarmHint(false);
  clearStreakFeedback();
  clearFloatPoints();
  guessModal.classList.add('hidden');
  guessFeedback.classList.add('hidden');

  stopLowBattery();
  timerEl.classList.remove('warn', 'danger');
  lastBeepIndexPlayed = -1;

  pauseBirdCalls();
  hideAudioTip();
  resetLeaderboardState();
  gameScreen.classList.remove('active');
  endScreen.classList.remove('active');
  startScreen.classList.add('active');
  playOpeningAudio();
  loadGlobalHighScore();
}

function beginTimedPlay() {
  isPlaying = true;

  // Start loop
  if (gameInterval) clearInterval(gameInterval);
  gameInterval = setInterval(gameLoop, 1000);

  startBirdCalls();
  startMovingBirdAnimation();
  showAudioTip(AUDIO_TIP_REMINDER_MESSAGE);
}

function startGameLogic() {
  requestPortableFullscreen();

  clearPendingEndGame();
  cancelRoundCountdown();
  if (gameInterval) clearInterval(gameInterval);
  gameInterval = null;
  stopMovingBirdAnimation();
  timeRemaining = gameMode === 'expert' ? GAME_DURATION_EXPERT : GAME_DURATION_REGULAR;
  foundBirds.clear();
  score = 0;
  correctStreak = 0;
  roundGuesses = 0;
  roundBestStreak = 0;
  lastBeepIndexPlayed = -1;
  isPlaying = false;
  isCountingDown = true;
  isPaused = false;
  pauseOverlay.classList.add('hidden');
  isGuessing = false;
  currentBirdTarget = null;
  currentBirdCandidate = null;
  activePointerId = null;
  pointerStartPosition = null;
  currentControlMode = 'mouse';
  resetLeaderboardState();
  tutorialModal.classList.add('hidden');
  guessModal.classList.add('hidden');
  guessFeedback.classList.add('hidden');
  clearStreakFeedback();
  clearFloatPoints();
  setBirdCandidate(null);
  setWarmHint(false);

  // Reset UI
  timerEl.innerText = formatTime(timeRemaining);
  updateTimerStages();
  updateScoreboard(true);
  setChecklistCollapsed(window.innerWidth < 640);
  birdsFoundCountEl.innerText = '0';
  birdIds.forEach(id => {
    const el = document.getElementById(id);
    el.classList.remove('found');
    el.classList.remove('missed');
    el.classList.remove('sighted');
    document.getElementById(`check-${id}`).classList.remove('found');
    setBirdFlyingImage(id, false);
    updateBirdFacing(id, 1);
  });

  // Switch screens
  startScreen.classList.remove('active');
  endScreen.classList.remove('active');
  videoScreen.classList.remove('active');
  gameScreen.classList.add('active');

  randomizeBirds();

  if (getMovingBirdIds().length > 0) {
    initializeMovingBirds();
    updateBirdImagesForMode();
  }

  const centerPoint = getGameViewportCenter();
  updateFlashlight(centerPoint.x, centerPoint.y, 'mouse');

  runRoundCountdown(beginTimedPlay);
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
  cancelRoundCountdown();
  isPaused = false;
  pauseOverlay.classList.add('hidden');
  isPlaying = false;
  isGuessing = false;
  currentBirdTarget = null;
  currentBirdCandidate = null;
  correctStreak = 0;
  activePointerId = null;
  pointerStartPosition = null;
  clearInterval(gameInterval);
  gameInterval = null;
  stopMovingBirdAnimation();
  setBirdCandidate(null);
  setWarmHint(false);
  clearStreakFeedback();
  guessModal.classList.add('hidden');
  guessFeedback.classList.add('hidden');

  stopLowBattery();
  lastBeepIndexPlayed = -1;

  pauseBirdCalls();
  hideAudioTip();
  const isNewHighScore = updateHighScore();
  renderEndScoreSummary(isNewHighScore);
  const presentation = getEndGamePresentation(result, timeRemaining);

  if (result === 'win') {
    if (navigator.vibrate) navigator.vibrate([100, 100, 100, 100, 500]); // Victory pattern
    showEndScreen(presentation);
    showEndLeaderboard();
    return;
  }

  if (navigator.vibrate) navigator.vibrate([300]); // Long buzz for loss

  if (presentation.revealMissedBirds) {
    revealMissedBirds();
  }

  endGameTimeout = window.setTimeout(() => {
    endGameTimeout = null;
    showEndScreen(presentation);
    showEndLeaderboard();
  }, presentation.endScreenDelayMs);
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function startLowBattery() {
  if (lowBatteryActive) return;
  lowBatteryActive = true;
  gameContainer.classList.add('low-battery');
}

function stopLowBattery() {
  if (!lowBatteryActive) return;
  lowBatteryActive = false;
  gameContainer.classList.remove('low-battery');
}

function playCountdownBeep(index) {
  if (lastBeepIndexPlayed >= index) return;
  lastBeepIndexPlayed = index;

  const ctx = getAudioContext();
  if (!ctx) return;

  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();

  oscillator.type = 'square';
  oscillator.frequency.setValueAtTime(880, ctx.currentTime);

  gainNode.gain.setValueAtTime(0.12, ctx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);

  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);

  oscillator.start(ctx.currentTime);
  oscillator.stop(ctx.currentTime + 0.15);
}

function playRoundCountdownTone({ frequency, durationSeconds = 0.18, type = 'square', volume = 0.14 } = {}) {
  const ctx = getAudioContext();

  if (!ctx) {
    return;
  }

  const resumePromise = ctx.resume?.();

  if (resumePromise?.catch) {
    resumePromise.catch(err => {
      console.log('Countdown audio resume failed:', err);
    });
  }

  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();
  const now = ctx.currentTime;

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, now);

  gainNode.gain.setValueAtTime(volume, now);
  gainNode.gain.exponentialRampToValueAtTime(0.001, now + durationSeconds);

  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);

  oscillator.start(now);
  oscillator.stop(now + durationSeconds);
}

function cancelRoundCountdown() {
  countdownTimeouts.forEach(timeoutId => window.clearTimeout(timeoutId));
  countdownTimeouts = [];
  isCountingDown = false;
  countdownOverlay?.classList.add('hidden');
}

function runRoundCountdown(onComplete) {
  cancelRoundCountdown();
  isCountingDown = true;
  countdownOverlay?.classList.remove('hidden');

  getRoundCountdownSteps().forEach((step, index) => {
    const isGoStep = step === 'Go!';
    const delayMs = index * ROUND_COUNTDOWN_STEP_MS;

    const timeoutId = window.setTimeout(() => {
      if (countdownNumber) {
        countdownNumber.innerText = step;
        countdownNumber.classList.remove('pop');
        // Force reflow so the pop animation restarts on every step.
        void countdownNumber.offsetWidth;
        countdownNumber.classList.add('pop');
      }

      playRoundCountdownTone({
        frequency: isGoStep ? ROUND_COUNTDOWN_GO_FREQUENCY : ROUND_COUNTDOWN_TONE_FREQUENCY,
        durationSeconds: isGoStep ? 0.4 : 0.18,
      });

      if (isGoStep) {
        const hideTimeoutId = window.setTimeout(() => {
          cancelRoundCountdown();
          onComplete?.();
        }, ROUND_COUNTDOWN_GO_MS);
        countdownTimeouts.push(hideTimeoutId);
      }
    }, delayMs);

    countdownTimeouts.push(timeoutId);
  });
}

function gameLoop() {
  if (isGuessing || isCountingDown || isPaused) return;

  timeRemaining--;
  timerEl.innerText = formatTime(timeRemaining);
  updateTimerStages();

  if (isLowBatteryTime(timeRemaining)) {
    startLowBattery();
    playCountdownBeep(countdownBeepIndex(timeRemaining));
  } else if (lowBatteryActive) {
    stopLowBattery();
  }

  const status = isGameOver(timeRemaining, foundBirds.size, TOTAL_BIRDS);
  if (status !== 'playing') {
    endGame(status);
  }
}

function handleRegister() {
  if (!isPlaying || isGuessing || isCountingDown || isPaused) return;

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
  if (!isPlaying || isGuessing || isCountingDown || isPaused || event.button !== 0) {
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
  if (!isPlaying || isGuessing || isCountingDown || isPaused) {
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
  if (isCountingDown || isPaused || !isPlaying) {
    releaseTrackedPointer(event.pointerId);
    return;
  }

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

  if (isPlaying && !isPaused) {
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
    roundGuesses += 1;

    if (guessedBird === currentBirdTarget) {
      // Correct guess
      if (navigator.vibrate) navigator.vibrate(100); // Short buzz
      const foundBirdId = currentBirdTarget;
      isGuessing = false;
      currentBirdTarget = null;
      guessModal.classList.add('hidden');
      foundBirds.add(foundBirdId);
      correctStreak += 1;
      roundBestStreak = Math.max(roundBestStreak, correctStreak);
      const pointsEarned = calculateIdentificationScore(timeRemaining, correctStreak);
      score += pointsEarned;
      updateScoreboard();
      showStreakFeedback(getStreakFeedback(correctStreak), pointsEarned);
      spawnFloatPoints(pointsEarned);
      
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
        updateTimerStages();
        guessModal.classList.add('hidden');
        endGame('loss');
      } else {
        timerEl.innerText = formatTime(timeRemaining);
        updateTimerStages();
      }
    }
  });
});

// Event Listeners
modeRegularBtn.addEventListener('click', () => {
  gameMode = 'regular';
  saveGameMode(gameMode);
  updateModeButtons();
  highScore = readStoredHighScore();
  updateScoreboard(true);
  loadGlobalHighScore();
  subscribeToLeaderboard(gameMode, handleLeaderboardRealtimeUpdate);
});

modeExpertBtn.addEventListener('click', () => {
  gameMode = 'expert';
  saveGameMode(gameMode);
  updateModeButtons();
  highScore = readStoredHighScore();
  updateScoreboard(true);
  loadGlobalHighScore();
  subscribeToLeaderboard(gameMode, handleLeaderboardRealtimeUpdate);
});

gameMode = loadGameMode();
highScore = readStoredHighScore();
updateModeButtons();
displayedScore = score;
updateScoreboard(true);

startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);
skipVideoBtn.addEventListener('click', () => {
  transitionVideo.pause();
  showTutorial();
});
tutorialStartBtn.addEventListener('click', startGameLogic);
initializeFieldGuide(document, {
  onOpen: stopOpeningAudio,
  onClose: playOpeningAudio,
  callSources: birdCallSources,
});
identifyBtn.addEventListener('click', handleRegister);
audioTipButton.addEventListener('click', handleAudioTipButtonClick);
installPromptInstallBtn?.addEventListener('click', promptInstallApp);
installPromptDismissBtn?.addEventListener('click', dismissInstallPrompt);
leaderboardSubmitBtn.addEventListener('click', handleScoreSubmission);
homeBtn.addEventListener('click', quitToHome);
pauseBtn.addEventListener('click', pauseGame);
resumeBtn.addEventListener('click', resumeGame);
quitBtn.addEventListener('click', quitToHome);
pauseQuitBtn.addEventListener('click', quitToHome);
checklistToggle.addEventListener('click', () => {
  setChecklistCollapsed(!checklist.classList.contains('collapsed'));
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    pauseGame();
  }
});
leaderboardNameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') handleScoreSubmission();
});

document.querySelectorAll('#onscreen-keyboard .key').forEach(key => {
  key.addEventListener('click', (e) => {
    e.preventDefault();
    const currentName = leaderboardNameInput.value;
    const keyText = e.currentTarget.innerText;

    if (e.currentTarget.classList.contains('backspace-key')) {
      leaderboardNameInput.value = currentName.slice(0, -1);
    } else if (e.currentTarget.classList.contains('space-key')) {
      if (currentName.length < 20) {
        leaderboardNameInput.value = currentName + ' ';
      }
    } else {
      if (currentName.length < 20) {
        leaderboardNameInput.value = currentName + keyText;
      }
    }
  });
});


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
loadGlobalHighScore();
subscribeToLeaderboard(gameMode, handleLeaderboardRealtimeUpdate);
window.addEventListener('beforeunload', unsubscribeFromLeaderboard);

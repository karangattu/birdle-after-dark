import {
  checkBirdFound,
  getEndGamePresentation,
  getFlashlightPositions,
  isGameOver,
  isTapInteraction,
} from './gameLogic.js';
import bgAudioSrc from '../assets/great_horned_owl.mp3';

// DOM Elements
const startScreen = document.getElementById('start-screen');
const gameScreen = document.getElementById('game-screen');
const endScreen = document.getElementById('end-screen');
const gameContainer = document.getElementById('game-container');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
const timerEl = document.getElementById('timer');
const birdsFoundCountEl = document.getElementById('birds-found-count');
const darknessOverlay = document.getElementById('darkness-overlay');
const flashlightHand = document.getElementById('flashlight-hand');
const endTitle = document.getElementById('end-title');
const endMessage = document.getElementById('end-message');
const bgAudio = document.getElementById('bg-audio');
const videoScreen = document.getElementById('video-screen');
const transitionVideo = document.getElementById('transition-video');

const guessModal = document.getElementById('guess-modal');
const guessBtns = document.querySelectorAll('.guess-btn');
const guessFeedback = document.getElementById('guess-feedback');

bgAudio.src = bgAudioSrc;

const GAME_DURATION = 60;
const FLASHLIGHT_RADIUS = 40;
const TOTAL_BIRDS = 4;

let timeRemaining = GAME_DURATION;
let foundBirds = new Set();
let gameInterval = null;
let currentMouseX = window.innerWidth / 2;
let currentMouseY = window.innerHeight / 2;
let isPlaying = false;
let isGuessing = false;
let currentBirdTarget = null;
let activePointerId = null;
let pointerDownPosition = null;
let endGameTimeout = null;
let currentControlMode = 'mouse';

// Initialize birds info
const birdIds = ['great_horned_owl', 'western_screech_owl', 'barn_owl', 'common_poorwill'];

function clearPendingEndGame() {
  if (endGameTimeout) {
    window.clearTimeout(endGameTimeout);
    endGameTimeout = null;
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
}

function randomizeBirds() {
  birdIds.forEach(id => {
    const el = document.getElementById(id);
    // Randomize between 10% and 85% for top and left to keep them on screen
    const randomTop = Math.floor(Math.random() * 75) + 10;
    const randomLeft = Math.floor(Math.random() * 75) + 10;
    el.style.top = `${randomTop}%`;
    el.style.left = `${randomLeft}%`;
  });
}

function startGame() {
  startScreen.classList.remove('active');
  endScreen.classList.remove('active');
  videoScreen.classList.add('active');

  transitionVideo.currentTime = 0;
  transitionVideo.play().catch(err => {
    console.log('Video play failed, skipping to game', err);
    startGameLogic();
  });
  
  transitionVideo.onended = () => {
    videoScreen.classList.remove('active');
    startGameLogic();
  };
}

function startGameLogic() {
  clearPendingEndGame();
  timeRemaining = GAME_DURATION;
  foundBirds.clear();
  isPlaying = true;
  isGuessing = false;
  currentBirdTarget = null;
  activePointerId = null;
  pointerDownPosition = null;
  currentControlMode = 'mouse';
  guessModal.classList.add('hidden');
  guessFeedback.classList.add('hidden');
  
  // Reset UI
  timerEl.innerText = `1:00`;
  birdsFoundCountEl.innerText = '0';
  birdIds.forEach(id => {
    const el = document.getElementById(id);
    el.classList.remove('found');
    el.classList.remove('missed');
    document.getElementById(`check-${id}`).classList.remove('found');
  });

  randomizeBirds();

  // Switch screens
  startScreen.classList.remove('active');
  endScreen.classList.remove('active');
  videoScreen.classList.remove('active');
  gameScreen.classList.add('active');

  const centerPoint = getGameViewportCenter();
  updateFlashlight(centerPoint.x, centerPoint.y, 'mouse');

  // Start loop
  if (gameInterval) clearInterval(gameInterval);
  gameInterval = setInterval(gameLoop, 1000);

  // Start background audio
  bgAudio.currentTime = 0;
  bgAudio.play().catch(err => console.log('Audio playback failed:', err));
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
  activePointerId = null;
  pointerDownPosition = null;
  clearInterval(gameInterval);
  gameInterval = null;
  guessModal.classList.add('hidden');
  guessFeedback.classList.add('hidden');
  
  bgAudio.pause();
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
  if (!isPlaying) return;

  // Get current bird coordinates from DOM
  const birdsInfo = birdIds.map(id => {
    const el = document.getElementById(id);
    const rect = el.getBoundingClientRect();
    return {
      id,
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    };
  });

  const foundBirdId = checkBirdFound(currentMouseX, currentMouseY, birdsInfo, FLASHLIGHT_RADIUS);
  
  if (foundBirdId && !foundBirds.has(foundBirdId)) {
    isGuessing = true;
    currentBirdTarget = foundBirdId;
    guessModal.classList.remove('hidden');
    guessFeedback.classList.add('hidden');
  }
}

function shouldIgnoreRegisterTarget(target) {
  return target instanceof Element && Boolean(
    target.closest('#guess-modal') || target.closest('#hud-top')
  );
}

function releaseTrackedPointer(pointerId) {
  if (
    typeof pointerId === 'number' &&
    gameContainer.hasPointerCapture?.(pointerId)
  ) {
    gameContainer.releasePointerCapture(pointerId);
  }

  activePointerId = null;
  pointerDownPosition = null;
}

function handlePointerDown(event) {
  if (!isPlaying || isGuessing || event.button !== 0) {
    return;
  }

  const controlMode = event.pointerType === 'mouse' ? 'mouse' : 'touch';

  if (event.pointerType !== 'mouse') {
    event.preventDefault();
    activePointerId = event.pointerId;
    gameContainer.setPointerCapture?.(event.pointerId);
  }

  pointerDownPosition = {
    x: event.clientX,
    y: event.clientY,
  };

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

  if (event.pointerType !== 'mouse') {
    event.preventDefault();
  }

  updateFlashlight(
    event.clientX,
    event.clientY,
    event.pointerType === 'mouse' ? 'mouse' : 'touch'
  );

  const shouldRegister = isPlaying &&
    !isGuessing &&
    isTapInteraction(pointerDownPosition, {
      x: event.clientX,
      y: event.clientY,
    }) &&
    !shouldIgnoreRegisterTarget(event.target);

  releaseTrackedPointer(event.pointerId);

  if (shouldRegister) {
    handleRegister();
  }
}

function handlePointerCancel(event) {
  releaseTrackedPointer(event.pointerId);
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
      
      // Update UI
      document.getElementById(foundBirdId).classList.add('found');
      document.getElementById(`check-${foundBirdId}`).classList.add('found');
      birdsFoundCountEl.innerText = foundBirds.size;
      
      // Check win condition immediately
      if (isGameOver(timeRemaining, foundBirds.size, TOTAL_BIRDS) === 'win') {
        endGame('win');
      }
    } else {
      // Incorrect guess
      if (navigator.vibrate) navigator.vibrate([100, 50, 100, 50, 100]); // Warning buzz
      guessFeedback.classList.remove('hidden');
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

gameContainer.addEventListener('pointerdown', handlePointerDown);
gameContainer.addEventListener('pointermove', handlePointerMove);
gameContainer.addEventListener('pointerup', handlePointerUp);
gameContainer.addEventListener('pointercancel', handlePointerCancel);

// Initial update
updateFlashlight(window.innerWidth / 2, window.innerHeight / 2);

import { checkBirdFound, isGameOver } from './gameLogic.js';

// DOM Elements
const startScreen = document.getElementById('start-screen');
const gameScreen = document.getElementById('game-screen');
const endScreen = document.getElementById('end-screen');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
const timerEl = document.getElementById('timer');
const birdsFoundCountEl = document.getElementById('birds-found-count');
const darknessOverlay = document.getElementById('darkness-overlay');
const flashlightHand = document.getElementById('flashlight-hand');
const endTitle = document.getElementById('end-title');
const endMessage = document.getElementById('end-message');

const guessModal = document.getElementById('guess-modal');
const guessBtns = document.querySelectorAll('.guess-btn');
const guessFeedback = document.getElementById('guess-feedback');

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

// Initialize birds info
const birdIds = ['great_horned_owl', 'western_screech_owl', 'barn_owl', 'common_poorwill'];

function updateFlashlight(x, y) {
  if (!isPlaying) return;
  currentMouseX = x;
  currentMouseY = y;
  
  // Update mask
  darknessOverlay.style.background = `radial-gradient(circle at ${x}px ${y}px, transparent 40px, rgba(0,0,0,0.98) 60px)`;
  
  // Update hand position
  flashlightHand.style.left = `${x}px`;
  flashlightHand.style.top = `${y}px`;
}

function startGame() {
  timeRemaining = GAME_DURATION;
  foundBirds.clear();
  isPlaying = true;
  isGuessing = false;
  currentBirdTarget = null;
  guessModal.classList.add('hidden');
  guessFeedback.classList.add('hidden');
  
  // Reset UI
  timerEl.innerText = `1:00`;
  birdsFoundCountEl.innerText = '0';
  birdIds.forEach(id => {
    document.getElementById(id).classList.remove('found');
    document.getElementById(`check-${id}`).classList.remove('found');
  });

  // Switch screens
  startScreen.classList.remove('active');
  endScreen.classList.remove('active');
  gameScreen.classList.add('active');

  // Start loop
  if (gameInterval) clearInterval(gameInterval);
  gameInterval = setInterval(gameLoop, 1000);
}

function endGame(result) {
  isPlaying = false;
  clearInterval(gameInterval);
  
  gameScreen.classList.remove('active');
  endScreen.classList.add('active');
  
  if (result === 'win') {
    if (navigator.vibrate) navigator.vibrate([100, 100, 100, 100, 500]); // Victory pattern
    endTitle.innerText = "You Won!";
    endTitle.style.color = "#00ffcc";
    endMessage.innerText = `You found all the birds with ${timeRemaining} seconds left.`;
  } else {
    if (navigator.vibrate) navigator.vibrate([300]); // Long buzz for loss
    endTitle.innerText = "Game Over";
    endTitle.style.color = "#ff3333";
    endMessage.innerText = "You ran out of time. The birds remain hidden.";
  }
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

guessBtns.forEach(btn => {
  btn.addEventListener('click', (e) => {
    const guessedBird = e.target.getAttribute('data-bird');
    
    if (guessedBird === currentBirdTarget) {
      // Correct guess
      if (navigator.vibrate) navigator.vibrate(100); // Short buzz
      isGuessing = false;
      guessModal.classList.add('hidden');
      foundBirds.add(currentBirdTarget);
      
      // Update UI
      document.getElementById(currentBirdTarget).classList.add('found');
      document.getElementById(`check-${currentBirdTarget}`).classList.add('found');
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

gameScreen.addEventListener('click', (e) => {
  if (e.target.closest('#guess-modal') || e.target.closest('#hud-top')) return;
  handleRegister();
});

gameScreen.addEventListener('mousemove', (e) => {
  updateFlashlight(e.clientX, e.clientY);
});

// Initial update
updateFlashlight(window.innerWidth / 2, window.innerHeight / 2);

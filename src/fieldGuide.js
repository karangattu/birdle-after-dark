const IDLE_STATUS = 'Tap an owl to hear its call.';

export function initializeFieldGuide(document, { onOpen, onClose, callSources = {} } = {}) {
  const modal = document.getElementById('field-guide-modal');
  const openBtn = document.getElementById('field-guide-btn');
  const closeBtn = document.getElementById('field-guide-close-btn');
  const status = document.getElementById('field-guide-status');

  const calls = Array.from(modal.querySelectorAll('audio[data-bird]'));
  calls.forEach(audio => {
    if (callSources[audio.dataset.bird]) {
      audio.src = callSources[audio.dataset.bird];
    }
  });
  const audioByBird = new Map(calls.map(audio => [audio.dataset.bird, audio]));
  const hotspots = Array.from(modal.querySelectorAll('[data-bird-call]'));
  let currentBirdId = null;

  function resetCall(audio) {
    audio.pause();
    try {
      audio.currentTime = 0;
    } catch {
      // Some browsers defer seeking until metadata is available.
    }
  }

  function markActive(birdId) {
    hotspots.forEach(hotspot => {
      hotspot.classList.toggle('active', hotspot.dataset.birdCall === birdId);
    });
  }

  function showIdle() {
    currentBirdId = null;
    markActive(null);
    status.textContent = IDLE_STATUS;
  }

  function stopAllCalls(except) {
    calls.forEach(audio => {
      if (audio === except || audio.paused) {
        return;
      }
      resetCall(audio);
    });
    if (!except) {
      showIdle();
    }
  }

  function toggleCall(birdId) {
    const audio = audioByBird.get(birdId);
    if (!audio) {
      return;
    }

    if (!audio.paused) {
      resetCall(audio);
      showIdle();
      return;
    }

    stopAllCalls(audio);
    currentBirdId = birdId;
    markActive(birdId);
    status.textContent = `Playing: ${hotspotName(birdId)} call.`;

    try {
      const playPromise = audio.play();
      playPromise?.catch?.(() => {
        showIdle();
        status.textContent = 'That call could not be played.';
      });
    } catch {
      showIdle();
      status.textContent = 'That call could not be played.';
    }
  }

  function hotspotName(birdId) {
    return hotspots.find(hotspot => hotspot.dataset.birdCall === birdId)?.dataset.birdName ?? birdId;
  }

  calls.forEach(audio => {
    audio.addEventListener('play', () => stopAllCalls(audio));
    audio.addEventListener('ended', () => {
      if (currentBirdId === audio.dataset.bird) {
        showIdle();
      }
    });
  });
  hotspots.forEach(hotspot => {
    hotspot.addEventListener('click', () => toggleCall(hotspot.dataset.birdCall));
  });

  function open() {
    modal.classList.remove('hidden');
    closeBtn.focus();
    onOpen?.();
  }

  function close() {
    modal.classList.add('hidden');
    stopAllCalls(null);
    openBtn.focus();
    onClose?.();
  }

  openBtn.addEventListener('click', open);
  closeBtn.addEventListener('click', close);
  modal.addEventListener('click', event => {
    if (event.target === modal) {
      close();
    }
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !modal.classList.contains('hidden')) {
      close();
    }
  });
}

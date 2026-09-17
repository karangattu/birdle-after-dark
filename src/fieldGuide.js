export function initializeFieldGuide(document, { onOpen, onClose } = {}) {
  const modal = document.getElementById('field-guide-modal');
  const openBtn = document.getElementById('field-guide-btn');
  const closeBtn = document.getElementById('field-guide-close-btn');

  const calls = Array.from(modal.querySelectorAll('audio'));

  function stopAllCalls(except) {
    calls.forEach(audio => {
      if (audio === except || audio.paused) {
        return;
      }
      audio.pause();
      try {
        audio.currentTime = 0;
      } catch {
        // Some browsers defer seeking until metadata is available.
      }
    });
  }

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

  calls.forEach(audio => {
    audio.addEventListener('play', () => stopAllCalls(audio));
  });

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

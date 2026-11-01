import { BATMAN_FRAME_OUTLINES, BATMAN_FRAME_ORDER } from './batmanFrames.js';

const FRAME_CLIPS = BATMAN_FRAME_OUTLINES.map(outline => 'polygon(' + outline.split(' ').map(point => point.split(',').map(value => value + '%').join(' ')).join(',') + ')');
const GRAPPLE_HANDS = [[50, 50], [50, 50], [50, 50], [77, 20], [75, 25], [80, 28], [82, 19], [82, 17], [77, 30], [50, 50], [66, 29], [76, 12]];
const ACTOR_WIDTH = 180;
const ACTOR_HEIGHT = 224;

// Prefer the quietest available part of the trees; never cover the HUD.
export function chooseCameoPosition(width, height, birds, reserved, size = ACTOR_WIDTH) {
  let best = null;
  let bestDistance = -1;
  // Touch holds the hand roughly 195px below the beam.
  const maxPerchY = Math.min(height * 0.7, height - 200);
  for (let y = height * 0.3; y <= maxPerchY; y += 16) {
    for (let x = size / 2; x <= width - size / 2; x += 16) {
      const blocked = reserved.some(rect => x + size / 2 > rect.left
        && x - size / 2 < rect.right && y + size / 2 > rect.top
        && y - size / 2 < rect.bottom);
      if (blocked) continue;
      const distance = Math.min(...birds.map(bird => Math.hypot(x - bird.x, y - bird.y)));
      if (distance > bestDistance) {
        best = { x, y };
        bestDistance = distance;
      }
    }
  }
  return best;
}

export function createBatmanCameo(container, spriteUrl) {
  const actor = document.createElement('div');
  actor.className = 'batman-cameo';
  actor.style.width = `${ACTOR_WIDTH}px`;
  actor.style.height = `${ACTOR_HEIGHT}px`;
  actor.style.margin = `${-ACTOR_HEIGHT / 2}px 0 0 ${-ACTOR_WIDTH / 2}px`;
  actor.style.backgroundImage = `url("${spriteUrl}")`;
  const perch = document.createElement('div');
  perch.className = 'batman-perch';
  const rope = document.createElement('div');
  rope.className = 'batman-rope';
  for (const element of [perch, rope, actor]) {
    element.setAttribute('aria-hidden', 'true');
    container.append(element);
  }
  function showFrame(frame) {
    actor.style.backgroundPosition = ((frame % 4) / 3 * 100) + '% ' + (Math.floor(frame / 4) * 50) + '%';
    actor.style.clipPath = FRAME_CLIPS[frame];
  }
  let origin = null;
  let elapsed = 0;
  let phase = 'gone';

  function hide() {
    phase = 'gone';
    actor.dataset.phase = phase;
    actor.hidden = perch.hidden = rope.hidden = true;
  }
  hide();

  return {
    hide,
    reset(position) {
      hide();
      if (!position) return;
      origin = position;
      elapsed = 0;
      phase = 'perched';
      actor.dataset.phase = phase;
      actor.hidden = perch.hidden = false;
      actor.style.left = `${origin.x}px`;
      actor.style.top = `${origin.y}px`;
      actor.style.transform = '';
      showFrame(0);
      perch.style.left = `${origin.x}px`;
      perch.style.top = `${origin.y + ACTOR_HEIGHT * 0.21}px`;
    },
    update(delta, beamX, beamY, radius) {
      if (phase === 'gone') return;
      if (phase === 'perched') {
        if (Math.hypot(beamX - origin.x, beamY - origin.y) > radius) return;
        phase = 'firing';
        rope.hidden = true;
      }
      elapsed += delta;
      const frameIndex = Math.min(11, Math.floor((elapsed + 0.00001) / 0.15));
      const frame = BATMAN_FRAME_ORDER[frameIndex];
      showFrame(frame);
      const progress = Math.min(1, Math.max(0, (elapsed - 0.6) / 1.65));
      if (elapsed >= 0.6) phase = 'swinging';
      rope.hidden = elapsed < 0.45 || frameIndex === 11;
      actor.dataset.phase = phase;
      if (progress === 1) {
        actor.hidden = rope.hidden = true;
        phase = 'gone';
        actor.dataset.phase = phase;
        return;
      }
      const anchorX = origin.x + 180;
      const anchorY = -120;
      const length = Math.hypot(180, origin.y - anchorY);
      const startAngle = Math.atan2(-180, origin.y - anchorY);
      const angle = startAngle + (1.7 - startAngle) * progress * progress;
      const x = anchorX + Math.sin(angle) * length;
      const y = anchorY + Math.cos(angle) * length;
      actor.style.transform = `translate(${x - origin.x}px, ${y - origin.y}px)`;
      const handX = x + (GRAPPLE_HANDS[frame][0] / 100 - 0.5) * ACTOR_WIDTH;
      const handY = y + (GRAPPLE_HANDS[frame][1] / 100 - 0.5) * ACTOR_HEIGHT;
      rope.style.left = `${anchorX}px`;
      rope.style.top = `${anchorY}px`;
      rope.style.height = `${Math.hypot(handX - anchorX, handY - anchorY)}px`;
      rope.style.transform = `rotate(${Math.atan2(-(handX - anchorX), handY - anchorY)}rad) scaleY(${Math.min(1, Math.max(0, elapsed - 0.45) / 0.15)})`;
    },
  };
}

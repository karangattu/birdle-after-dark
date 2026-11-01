// Prefer the quietest available part of the trees; never cover the HUD.
export function chooseCameoPosition(width, height, birds, reserved, size = 90) {
  let best = null;
  let bestDistance = -1;
  // Touch holds the hand roughly 195px below the beam.
  const maxPerchY = Math.min(height * 0.7, height - 200);
  for (let y = height * 0.3; y <= maxPerchY; y += 16) {
    for (let x = size; x <= width - size; x += 16) {
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

export function createDuskCameo(container, spriteUrl) {
  const actor = document.createElement('div');
  actor.className = 'dusk-cameo';
  actor.style.backgroundImage = `url("${spriteUrl}")`;
  const perch = document.createElement('div');
  perch.className = 'dusk-perch';
  const rope = document.createElement('div');
  rope.className = 'dusk-rope';
  for (const element of [perch, rope, actor]) {
    element.setAttribute('aria-hidden', 'true');
    container.append(element);
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
      perch.style.left = `${origin.x}px`;
      perch.style.top = `${origin.y + 26}px`;
    },
    update(delta, beamX, beamY, radius) {
      if (phase === 'gone') return;
      if (phase === 'perched') {
        if (Math.hypot(beamX - origin.x, beamY - origin.y) > radius) return;
        phase = 'firing';
        rope.hidden = false;
      }
      elapsed += delta;
      const progress = Math.min(1, Math.max(0, (elapsed - 0.28) / 1.35));
      if (elapsed >= 0.28) phase = 'swinging';
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
      actor.style.transform = `translate(${x - origin.x}px, ${y - origin.y}px) rotate(${-progress * 35}deg)`;
      const handX = x + 22;
      const handY = y - 25;
      rope.style.left = `${anchorX}px`;
      rope.style.top = `${anchorY}px`;
      rope.style.height = `${Math.hypot(handX - anchorX, handY - anchorY)}px`;
      rope.style.transform = `rotate(${Math.atan2(-(handX - anchorX), handY - anchorY)}rad) scaleY(${Math.min(1, elapsed / 0.16)})`;
    },
  };
}

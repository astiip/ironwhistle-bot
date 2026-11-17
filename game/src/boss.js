// THE IRON MAW: a runaway furnace-locomotive, a third of the screen wide
// when it rolls in, with three phases of boiler pressure.
//
//   Phase 1 SMOKE    — slow, coughing grey smoke, feeling out the line.
//   Phase 2 EMBER    — faster, its mouth glowing orange, shedding imps.
//   Phase 3 MELTDOWN — fast, white-hot, the rails melting behind it.
//
// The Maw rides the main line from the east toward the Furnace. On-time
// deliveries wound it (every cargo is a coal-bomb), the Whistle wounds it,
// and a click on its boiler wounds it a little. If it reaches the Furnace
// it slams the heat down, then backs off east and comes again — angrier.
// Break it and run 7 is won.

import { FURNACE, MAIN_Y } from './config.js';

export const MAW_MAX_HP = 600;

/** Phase thresholds: above 2/3 is SMOKE, above 1/3 is EMBER, below is MELTDOWN. */
export function mawPhase(boss) {
  if (boss.hp > MAW_MAX_HP * (2 / 3)) return 1;
  if (boss.hp > MAW_MAX_HP * (1 / 3)) return 2;
  return 3;
}

export const MAW_PHASE = {
  1: { name: 'SMOKE', speed: 26, colour: '#8a8a8a', glow: '#c8c8c8' },
  2: { name: 'EMBER', speed: 38, colour: '#ff7a1a', glow: '#ffc21a' },
  3: { name: 'MELTDOWN', speed: 52, colour: '#ff3b30', glow: '#ffffff' },
};

export function makeBoss() {
  return {
    active: false,
    x: 1360,
    y: MAIN_Y,
    hp: MAW_MAX_HP,
    maxHp: MAW_MAX_HP,
    phase: 1,
    state: 'entering',
    wait: 0,
    retreat: 0,
    shake: 0,
    hits: 0,
  };
}

/** Wake the Maw at the east end of the line. */
export function spawnBoss(boss) {
  boss.active = true;
  boss.x = 1360;
  boss.y = MAIN_Y;
  boss.hp = MAW_MAX_HP;
  boss.phase = 1;
  boss.state = 'entering';
  boss.wait = 0;
  boss.retreat = 0;
}

/**
 * Advance the Maw one step. Returns 'hit' when it reaches the Furnace,
 * 'phase' when its phase changes, else null. `onPhase` is called with the
 * new phase number so the world can warn of the tremor.
 */
export function stepBoss(boss, dt, onPhase) {
  if (!boss.active) return null;
  if (boss.shake > 0) boss.shake -= dt;
  if (boss.state === 'waiting') {
    boss.wait -= dt;
    if (boss.wait <= 0) {
      boss.state = 'entering';
      boss.x = 1360;
    }
    return null;
  }
  if (boss.state === 'retreating') {
    boss.x += 90 * dt;
    if (boss.x >= 1360) {
      boss.state = 'waiting';
      boss.wait = 5;
    }
    return null;
  }
  const phase = MAW_PHASE[boss.phase];
  boss.x -= phase.speed * dt;
  boss.y = MAIN_Y + Math.sin(boss.x * 0.02) * 2;
  if (boss.x <= FURNACE.x + 90) {
    boss.state = 'retreating';
    boss.retreat += 1;
    return 'hit';
  }
  return null;
}

/** Wound the Maw. Returns the new phase when it changes, else 0. */
export function hurtBoss(boss, amount, onPhase) {
  if (!boss.active || boss.hp <= 0) return 0;
  boss.hp = Math.max(0, boss.hp - amount);
  boss.hits += 1;
  boss.shake = 0.25;
  const phase = mawPhase(boss);
  if (phase !== boss.phase) {
    boss.phase = phase;
    if (onPhase) onPhase(phase);
    return phase;
  }
  if (boss.hp <= 0) {
    boss.active = false;
    return -1;
  }
  return 0;
}

/** Boiler pressure, 0-100, for the boss bar: pressure climbs as the Maw breaks. */
export function boilerPressure(boss) {
  return Math.round(30 + (1 - boss.hp / boss.maxHp) * 68);
}

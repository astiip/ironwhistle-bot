// The rabble: named foes that walk in from the valley's edges and make for
// the Furnace. Each kind has one behaviour, shown as one line in the
// incoming queue, and one answer: click it to shoo it away before it arrives.
//
//   Cinder Imp   — swarms the furnace (drains its heat)
//   Rockfall     — blocks the track (becomes a rockfall on the main line)
//   Rail Rat     — gnaws your switches (flips one junction at random)
//   Ash Wraith   — drains the coal (steals coal from the tender)
//   Boiler Brat  — splits in two (shooing it makes two Cinder Imps)
//   Signal Thief — flips your switches back (flips every junction at random)
//
// Enemies walk straight at the furnace. Rockfalls are the exception: when
// one reaches the field it drops onto a main-line segment and sits there
// until it is clicked twice or washed away by the Water Tower.

import { FURNACE, JUNCTIONS, MAIN_Y } from './config.js';

export const ENEMY = {
  imp: { name: 'Cinder Imp', plural: 'Cinder Imp', line: 'swarms the furnace', hp: 1, speed: 46, radius: 13, colour: '#ff6a1a', eye: '#fff3d6', score: 5 },
  rock: { name: 'Rockfall', plural: 'Rockfall', line: 'blocks the track', hp: 2, speed: 30, radius: 15, colour: '#8a7a66', eye: '#3a2f26', score: 10 },
  rat: { name: 'Rail Rat', plural: 'Rail Rat', line: 'gnaws your switches', hp: 1, speed: 62, radius: 12, colour: '#7a5a3a', eye: '#ffd94d', score: 10 },
  wraith: { name: 'Ash Wraith', plural: 'Ash Wraith', line: 'drains the coal', hp: 1, speed: 38, radius: 14, colour: '#b8b0c8', eye: '#ff5a6e', score: 15 },
  brat: { name: 'Boiler Brat', plural: 'Boiler Brat', line: 'splits in two', hp: 1, speed: 52, radius: 14, colour: '#c21414', eye: '#ffd94d', score: 15 },
  thief: { name: 'Signal Thief', plural: 'Signal Thief', line: 'flips your switches back', hp: 1, speed: 56, radius: 13, colour: '#3a3a5e', eye: '#9be8ff', score: 20 },
};

/** The order foes are listed in the incoming queue. */
export const ENEMY_ORDER = ['imp', 'rock', 'rat', 'wraith', 'brat', 'thief'];

/** Where a foe walks in: a random point on the field's edge. */
export function spawnPoint(random) {
  const side = Math.floor(random() * 4);
  if (side === 0) return { x: 170 + random() * 940, y: 84 };
  if (side === 1) return { x: 170 + random() * 940, y: 676 };
  if (side === 2) return { x: 170, y: 100 + random() * 560 };
  return { x: 1110, y: 100 + random() * 560 };
}

export function makeEnemy(kind, x, y, random) {
  const def = ENEMY[kind];
  return { kind, name: def.name, x, y, hp: def.hp, speed: def.speed, radius: def.radius, wobble: (random ? random() : 0) * Math.PI * 2, hitFlash: 0 };
}

/**
 * Walk one foe a step toward the furnace. Returns 'arrived' when it reaches
 * the furnace, 'rockfall' when a Rockfall drops onto the track instead, else
 * null. Rockfalls stop halfway across the field and become track blockers.
 */
export function stepEnemy(enemy, dt, random, blockers) {
  if (enemy.hitFlash > 0) enemy.hitFlash -= dt;
  enemy.wobble += dt * 6;
  if (enemy.kind === 'rock' && enemy.dropped !== true) {
    // A rockfall tumbles toward the line, then drops onto a main segment.
    if (enemy.dropX === undefined) enemy.dropX = 380 + random() * 820;
    const target = { x: enemy.dropX, y: MAIN_Y };
    const dx = target.x - enemy.x;
    const dy = target.y - enemy.y;
    const d = Math.hypot(dx, dy) || 1;
    enemy.x += (dx / d) * enemy.speed * dt;
    enemy.y += (dy / d) * enemy.speed * dt;
    if (d < 24) {
      enemy.dropped = true;
      const x = enemy.dropX;
      const seg = x < 640 ? 'j1-j2' : x < 950 ? 'j2-j3' : 'j3-end';
      const segStart = seg === 'j1-j2' ? JUNCTIONS[0].x : seg === 'j2-j3' ? JUNCTIONS[1].x : JUNCTIONS[2].x;
      blockers.push({ seg, dist: Math.max(10, x - segStart), hp: 2, x, y: MAIN_Y });
      return 'rockfall';
    }
    return null;
  }
  const dx = FURNACE.x - enemy.x;
  const dy = FURNACE.y - enemy.y;
  const d = Math.hypot(dx, dy) || 1;
  const wob = Math.sin(enemy.wobble) * 8 * dt;
  enemy.x += (dx / d) * enemy.speed * dt - (dy / d) * wob;
  enemy.y += (dy / d) * enemy.speed * dt + (dx / d) * wob;
  if (d < FURNACE.radius + 6) return 'arrived';
  return null;
}

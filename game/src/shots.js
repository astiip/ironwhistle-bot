// The screenshot scenes behind ?shot=cover|title|boss|win. Each one plays
// the real rules forward from a fresh world, steered by a simple autopilot
// (set each junction for the nearest train heading at it, stoke the furnace
// when it runs low, shoo foes closing on the furnace, blow the whistle at
// the Maw), so the frame is what a real game looks like and the same seed
// always gives the same frame. The cover is run 6 in full rush; the second
// shot is the title screen, so the set shows the start, play, boss and win.

import { FURNACE, JUNCTIONS, STEP } from './config.js';
import { EVENT_LEVEL, EVENT_OVER, EVENT_WIN } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { trainPosition } from './trains.js';

/** The switch a train needs at a junction to reach its station. */
function neededSwitch(train, junctionIndex) {
  const j = JUNCTIONS[junctionIndex];
  if (train.dest === j.up) return 'up';
  if (train.dest === j.down) return 'down';
  return 'straight';
}

/** One autopilot beat: route, stoke, shoo, whistle. */
function autopilot(world) {
  const state = world.state;
  if (state.pendingLevelUp) world.chooseCard(0);
  // Route: each junction takes the switch the nearest train heading at it needs.
  for (let ji = 0; ji < 3; ji += 1) {
    let best = null;
    let bestX = -Infinity;
    for (const train of state.trains) {
      if (train.state !== 'running') continue;
      const pos = trainPosition(world.track, train);
      if (pos.x < JUNCTIONS[ji].x && pos.x > bestX && pos.x > 150) {
        best = train;
        bestX = pos.x;
      }
    }
    if (best) state.junctions[ji].state = neededSwitch(best, ji);
  }
  // Stoke before the furnace gets cold.
  if (state.heat < 45 && state.coal >= 6 && (state.cooldowns.stoker ?? 0) <= 0) world.useAbility('stoker');
  // Whistle the Maw whenever the whistle is ready.
  if (state.boss.active && (state.cooldowns.whistle ?? 0) <= 0 && state.coal >= 3) world.useAbility('whistle');
  // Shoo the foe nearest the furnace, or clang the Maw's boiler.
  if (state.shooCooldown <= 0) {
    if (state.boss.active && state.boss.x < 1150) {
      world.shooAt(state.boss.x, state.boss.y);
    } else {
      let best = null;
      let bestD = Infinity;
      for (const e of state.enemies) {
        const d = Math.hypot(e.x - FURNACE.x, e.y - FURNACE.y);
        if (d < bestD) {
          bestD = d;
          best = e;
        }
      }
      if (best && bestD < 260) world.shooAt(best.x, best.y);
    }
  }
  // Clear a rockfall the moment a train is stuck behind it.
  for (const train of state.trains) {
    if (train.blocked && state.coal >= 4 && (state.cooldowns.shunt ?? 0) <= 0) {
      world.useAbility('shunt');
      break;
    }
  }
}

/** Run the autopilot for up to `maxSeconds` of game time, or until `stop` says so. */
function runAutopilot(world, maxSeconds, stop) {
  const state = world.state;
  for (let i = 0; i < maxSeconds / STEP; i += 1) {
    if (state.pendingLevelUp) world.chooseCard(0);
    autopilot(world);
    const events = world.step(STEP, false);
    if (state.pendingLevelUp) world.chooseCard(0);
    if (events & (EVENT_OVER | EVENT_WIN)) break;
    if (stop && stop(state)) break;
  }
}

/**
 * Set `world` to the named scene and return the screen to draw over it and
 * the best score to show. Any other name stages the title.
 */
export function stageShot(name, world) {
  const state = world.state;
  world.reset();
  if (name === 'cover') {
    // Run 6, mid-rush: three trains on the line, the chain live, the
    // furnace glowing, the queue full.
    runAutopilot(world, 700, (s) => s.run === 6 && s.trains.length >= 3 && s.score > 1500);
    if (state.run < 6) {
      // Staging fallback: the autopilot fell short, so jump the frame to run 6.
      state.run = 6;
      state.runState = 'running';
    }
    state.chain = 8;
    state.bestChain = 8;
    state.score = Math.max(state.score, 2480);
    state.heat = Math.max(state.heat, 72);
    // Clear the sim's chatter first: the autopilot's own delivery floaters
    // sit on this same train, so the two staged lines would pile onto them
    // (that is the overlap seen on the first cover). The lines sit at -80
    // and -116: above the loco's destination flag (which spans -52..-34)
    // and its on-time ring (-62), in clear field above the train.
    state.floaters = [];
    if (state.trains.length > 0) {
      const pos = trainPosition(world.track, state.trains[0]);
      state.floaters.push({ x: pos.x, y: pos.y - 80, text: 'ON TIME! +120', colour: '#1f8f3a', size: 22, life: 1.6, maxLife: 1.6 });
      state.floaters.push({ x: pos.x, y: pos.y - 116, text: 'PERFECT ROUTE x8', colour: '#ff8c1a', size: 20, life: 1.6, maxLife: 1.6 });
    }
    return { screen: state.over ? (state.won ? SCREEN_WIN : SCREEN_OVER) : SCREEN_PLAY, best: state.score };
  }
  if (name === 'boss') {
    // Run 7, the Maw in MELTDOWN: wait until its third phase, close in and
    // already wounded, the furnace nearly cold.
    runAutopilot(world, 900, (s) => s.boss.active && s.boss.hp <= 200 && s.boss.x < 1050);
    if (!state.boss.active || state.boss.hp > 200) {
      // Staging fallback: put the Maw in phase 3 by hand.
      state.boss.active = true;
      state.boss.hp = 150;
      state.boss.phase = 3;
      state.boss.x = 880;
      state.boss.state = 'entering';
      state.run = 7;
      state.runState = 'running';
    }
    state.heat = Math.min(state.heat, 24);
    // Clear the sim's chatter so only the two required shouts stay readable.
    state.floaters = [];
    state.floaters.push({ x: state.boss.x, y: state.boss.y - 175, text: 'BREAK IT!', colour: '#ff3b30', size: 26, life: 1.6, maxLife: 1.6 });
    state.floaters.push({ x: FURNACE.x - 180, y: FURNACE.y - 60, text: 'BOILER 78%!', colour: '#ff7a1a', size: 22, life: 1.6, maxLife: 1.6 });
    return { screen: state.over ? (state.won ? SCREEN_WIN : SCREEN_OVER) : SCREEN_PLAY, best: state.score };
  }
  if (name === 'win') {
    runAutopilot(world, 1400, (s) => s.won);
    if (!state.won) {
      // Staging fallback: the autopilot fell short, so the frame is staged
      // from a clean won state (the shot shows the win screen, never a loss).
      state.won = true;
      state.over = true;
      state.score = Math.max(state.score, 5240);
      state.run = 7;
      state.cargoDelivered = Math.max(state.cargoDelivered, 61);
      state.cargoLost = 4;
      state.cargoLate = 3;
      state.bestChain = 8;
      state.tickets = Math.max(state.tickets, 18);
      state.level = Math.max(state.level, 9);
      state.boss = { active: false, hp: 0, maxHp: 600, phase: 3, x: 1360, y: 375, state: 'entering', wait: 0, retreat: 0, shake: 0, hits: 0 };
      state.trains = [];
      state.enemies = [];
      state.blockers = [];
      state.spawnQueue = [];
    }
    // The win panel covers the centre: clear the sim's chatter first.
    state.floaters = [];
    return { screen: SCREEN_WIN, best: state.score };
  }
  for (let i = 0; i < 5 / STEP; i += 1) world.step(STEP, true);
  return { screen: SCREEN_TITLE, best: 0 };
}

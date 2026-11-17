// The game's rules and state, with no drawing and no browser in it: the
// runs, the trains and their cargo, the furnace and its heat, the rabble,
// the Iron Maw, the chain, the coal and the tickets. step() advances one
// fixed step and returns what happened as bit flags, so the caller can react
// without the world knowing about screens or sound.

import {
  ABILITIES,
  CHAIN_MAX,
  COAL,
  FURNACE,
  JUNCTIONS,
  MAX_CARGO_LOST,
  RELICS,
  RUNS_TOTAL,
  RUN_PLAN,
  SCORE,
  STATIONS,
  TRAIN_WINDOW,
  xpForLevel,
} from './config.js';
import { buildTrack, junctionNext, makeTrain, stepTrain, trainPosition } from './trains.js';
import { ENEMY, ENEMY_ORDER, makeEnemy, spawnPoint, stepEnemy } from './enemies.js';
import { boilerPressure, hurtBoss, makeBoss, mawPhase, spawnBoss, stepBoss } from './boss.js';
import { applyChoice, rollChoices } from './upgrades.js';

export const EVENT_DELIVERY = 1;
export const EVENT_LOST = 2;
export const EVENT_LEVEL = 4;
export const EVENT_OVER = 8;
export const EVENT_WIN = 16;
export const EVENT_BOSS = 32;
export const EVENT_RUN = 64;
export const EVENT_HIT = 128;

const JUNCTION_CYCLE = ['straight', 'up', 'down'];

/** Pick a random station id with the seeded random. */
function randomDest(random) {
  return STATIONS[Math.floor(random() * STATIONS.length)].id;
}

export function createWorld(random) {
  const track = buildTrack();
  const state = {
    trackRef: track,
    score: 0,
    coal: 12,
    tickets: 0,
    heat: FURNACE.heatMax,
    heatMax: FURNACE.heatMax,
    chain: 0,
    bestChain: 0,
    run: 1,
    runState: 'running',
    betweenTimer: 0,
    spawnQueue: [],
    spawnTimer: 1,
    enemyQueue: [],
    enemyTimer: 6,
    trickleTimer: 5,
    trains: [],
    enemies: [],
    blockers: [],
    boss: makeBoss(),
    junctions: JUNCTIONS.map(() => ({ state: 'straight' })),
    floaters: [],
    sfx: [],
    level: 1,
    xp: 0,
    pendingLevelUp: false,
    choices: [],
    relics: {},
    engineLevel: 1,
    furnaceLevel: 1,
    abilityDiscount: {},
    cooldowns: {},
    brakeTimer: 0,
    signalTimer: 0,
    shooCooldown: 0,
    cargoDelivered: 0,
    cargoLost: 0,
    cargoLate: 0,
    deliveredTotal: 0,
    elapsed: 0,
    over: false,
    won: false,
    tremorTimer: 0,
    shake: 0,
    trainId: 0,
  };

  // Floating feedback text, kept readable: a new floater that would land on
  // top of a live one (same column, less than one line apart) is moved one
  // lane up (32px). Floaters all rise at the same speed, so a lane gap never
  // closes. Deterministic: depends only on the live floaters. Visual only;
  // game logic never reads floaters.
  function addFloater(x, y, text, colour, size) {
    const s = size ?? 20;
    let yy = y;
    for (let lane = 0; lane < 4; lane += 1) {
      const clash = state.floaters.some((f) => Math.abs(f.x - x) < 90 && Math.abs(f.y - yy) < 30);
      if (!clash) break;
      yy -= 32;
    }
    state.floaters.push({ x, y: yy, text, colour: colour ?? '#ffffff', size: s, life: 1.6, maxLife: 1.6 });
    if (state.floaters.length > 24) state.floaters.shift();
  }

  function addSfx(name) {
    state.sfx.push(name);
  }

  /** The heat drain right now, after relic and furnace discounts. */
  function heatDrainRate() {
    let rate = FURNACE.drainBase + FURNACE.drainPerRun * (state.run - 1);
    if (state.relics.coalheart) rate *= 0.8;
    rate *= 0.95 ** (state.furnaceLevel - 1);
    return rate;
  }

  /** Build the spawn queues for a run. */
  function startRun(n) {
    const plan = RUN_PLAN[n];
    state.run = n;
    state.runState = 'running';
    state.spawnQueue = [];
    for (let i = 0; i < plan.trains; i += 1) state.spawnQueue.push(randomDest(random));
    state.enemyQueue = [];
    for (const kind of Object.keys(plan.enemies)) {
      for (let i = 0; i < plan.enemies[kind]; i += 1) state.enemyQueue.push(kind);
    }
    // Shuffle the rabble so the queue is not sorted by kind.
    for (let i = state.enemyQueue.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      const tmp = state.enemyQueue[i];
      state.enemyQueue[i] = state.enemyQueue[j];
      state.enemyQueue[j] = tmp;
    }
    state.spawnTimer = 1.2;
    state.enemyTimer = 7;
    state.trickleTimer = 5;
    if (n === RUNS_TOTAL) {
      spawnBoss(state.boss);
      addFloater(980, 300, 'THE IRON MAW IS COMING!', '#ff3b30', 26);
      addSfx('boss');
    } else {
      addFloater(640, 300, `RUN ${n}/7 — ALL ABOARD!`, '#1d3a5f', 26);
    }
  }

  function reset() {
    state.score = 0;
    state.coal = 12;
    state.tickets = 0;
    state.heat = FURNACE.heatMax;
    state.heatMax = FURNACE.heatMax;
    state.chain = 0;
    state.bestChain = 0;
    state.trains = [];
    state.enemies = [];
    state.blockers = [];
    state.boss = makeBoss();
    state.junctions = JUNCTIONS.map(() => ({ state: 'straight' }));
    state.floaters = [];
    state.sfx = [];
    state.level = 1;
    state.xp = 0;
    state.pendingLevelUp = false;
    state.choices = [];
    state.relics = {};
    state.engineLevel = 1;
    state.furnaceLevel = 1;
    state.abilityDiscount = {};
    state.cooldowns = {};
    state.brakeTimer = 0;
    state.signalTimer = 0;
    state.shooCooldown = 0;
    state.cargoDelivered = 0;
    state.cargoLost = 0;
    state.cargoLate = 0;
    state.deliveredTotal = 0;
    state.elapsed = 0;
    state.over = false;
    state.won = false;
    state.tremorTimer = 0;
    state.shake = 0;
    state.trainId = 0;
    startRun(1);
  }

  /** Flip one junction to a random other state (rats and thieves do this). */
  function flipJunction(index, silent) {
    const j = state.junctions[index];
    const others = JUNCTION_CYCLE.filter((s) => s !== j.state);
    j.state = others[Math.floor(random() * others.length)];
    if (!silent) addFloater(JUNCTIONS[index].x, JUNCTIONS[index].y - 44, 'SWITCH FLIPPED!', '#ff5a6e', 18);
  }

  /** The switch a train needs at a junction to reach its station. */
  function neededSwitch(train, junctionIndex) {
    const j = JUNCTIONS[junctionIndex];
    if (train.dest === j.up) return 'up';
    if (train.dest === j.down) return 'down';
    return 'straight';
  }

  /** Set every junction to route the trains now approaching it. */
  function autoRoute() {
    for (let ji = 0; ji < 3; ji += 1) {
      let best = null;
      let bestX = -Infinity;
      for (const train of state.trains) {
        if (train.state !== 'running') continue;
        const pos = trainPosition(track, train);
        if (pos.x < JUNCTIONS[ji].x && pos.x > bestX && train.seg.indexOf(`j${ji + 1}`) === -1) {
          best = train;
          bestX = pos.x;
        }
      }
      if (best) state.junctions[ji].state = neededSwitch(best, ji);
    }
  }

  function grantXp(amount) {
    state.xp += amount;
    if (state.xp >= xpForLevel(state.level)) {
      state.xp -= xpForLevel(state.level);
      state.level += 1;
      state.pendingLevelUp = true;
      state.choices = rollChoices(random, state);
      addSfx('levelUp');
      return true;
    }
    return false;
  }

  function deliver(train, onTime) {
    const pos = trainPosition(track, train);
    state.deliveredTotal += 1;
    state.cargoDelivered += 1;
    if (onTime) {
      state.chain = Math.min(CHAIN_MAX, state.chain + 1);
      state.bestChain = Math.max(state.bestChain, state.chain);
      const gained = SCORE.delivery + SCORE.chainStep * (state.chain - 1) + 10 * (state.engineLevel - 1) + (state.relics.spike ? 10 : 0);
      state.score += gained;
      state.coal += COAL.delivery;
      addFloater(pos.x, pos.y - 30, `ON TIME! +${gained}`, '#1f8f3a', 22);
      if (state.chain >= 2) addFloater(pos.x, pos.y - 58, `PERFECT ROUTE x${state.chain}`, '#ff8c1a', 20);
      addFloater(pos.x, pos.y - 84, `COAL +${COAL.delivery}`, '#8a6a2f', 16);
      addSfx('deliver');
    } else {
      state.chain = 0;
      state.cargoLate += 1;
      state.score += SCORE.late;
      state.coal += COAL.late;
      addFloater(pos.x, pos.y - 30, `LATE +${SCORE.late}`, '#e8a400', 20);
      addSfx('late');
    }
    if (state.deliveredTotal % 3 === 0) {
      state.tickets += 1;
      addFloater(pos.x, pos.y - 108, 'TICKET +1', '#2f6fd6', 16);
    }
    // On run 7 every cargo is a coal-bomb for the Maw.
    if (state.run === RUNS_TOTAL && state.boss.active) {
      const phase = hurtBoss(state.boss, SCORE.bossHit, (p) => onBossPhase(p));
      addFloater(state.boss.x, state.boss.y - 90, `MAW −${SCORE.bossHit}`, '#ff3b30', 20);
      if (phase === -1) addFloater(640, 340, 'THE IRON MAW BREAKS!', '#ff3b30', 28);
    }
    return grantXp(1);
  }

  function loseCargo(train, why) {
    const pos = trainPosition(track, train);
    train.state = 'lost';
    state.cargoLost += 1;
    state.chain = 0;
    addFloater(pos.x, pos.y - 30, why === 'wrong' ? 'WRONG STATION!' : 'DERAILED!', '#d62020', 22);
    addFloater(pos.x, pos.y - 56, `CARGO LOST ${state.cargoLost}/${MAX_CARGO_LOST}`, '#d62020', 16);
    addSfx('lost');
  }

  /** The Maw changed phase: warn of the tremor, then shake the rails. */
  function onBossPhase(phase) {
    state.tremorTimer = 3;
    addFloater(640, 240, `TREMOR IN 3s: rails will crack — phase ${phase} of 3`, '#ff3b30', 20);
    addSfx('tremor');
  }

  function arriveAtStation(train) {
    // The train's segment ends at its node; judge by the node it reached.
    const seg = track.byId[train.seg];
    const node = seg.to;
    if (node === train.dest) {
      return deliver(train, train.age <= train.window);
    }
    // Wrong station: the Iron Horseshoe saves the cargo once per train.
    if (state.relics.horseshoe && !train.savedByHorseshoe) {
      train.savedByHorseshoe = true;
      const ji = STATIONS.findIndex((s) => s.id === node);
      const junctionIndex = ji % 3;
      train.seg = junctionIndex === 0 ? 'j1-j2' : junctionIndex === 1 ? 'j2-j3' : 'j3-end';
      train.dist = 0;
      train.state = 'running';
      const pos = trainPosition(track, train);
      addFloater(pos.x, pos.y - 30, 'HORSESHOE SAVED IT!', '#e8a400', 20);
      addSfx('save');
      return false;
    }
    loseCargo(train, 'wrong');
    return false;
  }

  function spawnTrain() {
    const dest = state.spawnQueue.shift();
    if (dest === undefined) return;
    const plan = RUN_PLAN[state.run];
    const windowSeconds = TRAIN_WINDOW + (state.relics.timetable ? 4 : 0);
    const speed = plan.speed * (1 + 0.08 * (state.engineLevel - 1)) * (state.relics.spike ? 1.1 : 1);
    const train = makeTrain(state.trainId + 1, dest, speed, windowSeconds);
    state.trainId += 1;
    state.trains.push(train);
    addSfx('spawn');
  }

  function spawnEnemy() {
    const kind = state.enemyQueue.shift();
    if (kind === undefined) return;
    const p = spawnPoint(random);
    state.enemies.push(makeEnemy(kind, p.x, p.y, random));
  }

  /** Click handling: junction, foe, rockfall or the Maw itself. */
  function shooAt(x, y) {
    if (state.shooCooldown > 0) return null;
    // The Maw first: a click on its boiler wounds it.
    if (state.boss.active && Math.abs(x - state.boss.x) < 150 && Math.abs(y - state.boss.y) < 70) {
      state.shooCooldown = 0.35;
      hurtBoss(state.boss, 8, (p) => onBossPhase(p));
      addFloater(state.boss.x, state.boss.y - 90, 'CLANG! −8', '#ff3b30', 18);
      addSfx('clang');
      return 'maw';
    }
    // A rockfall on the line: two clicks to clear it.
    for (let i = 0; i < state.blockers.length; i += 1) {
      const b = state.blockers[i];
      if (Math.abs(x - b.x) < 34 && Math.abs(y - b.y) < 30) {
        state.shooCooldown = 0.35;
        b.hp -= 1;
        if (b.hp <= 0) {
          state.blockers.splice(i, 1);
          addFloater(b.x, b.y - 30, 'CLEARED!', '#1f8f3a', 20);
          addSfx('clear');
        } else {
          addFloater(b.x, b.y - 30, 'CRACK!', '#8a6a2f', 18);
          addSfx('crack');
        }
        return 'blocker';
      }
    }
    // A foe on foot: shoo it away.
    for (let i = 0; i < state.enemies.length; i += 1) {
      const e = state.enemies[i];
      if (Math.hypot(x - e.x, y - e.y) < e.radius + 14) {
        state.shooCooldown = 0.35;
        state.enemies.splice(i, 1);
        state.score += ENEMY[e.kind].score;
        if (e.kind === 'imp') {
          state.coal += COAL.shooImp;
          addFloater(e.x, e.y - 24, `SHOO! COAL +${COAL.shooImp}`, '#8a6a2f', 16);
        } else {
          addFloater(e.x, e.y - 24, 'SHOO!', '#1f8f3a', 18);
        }
        if (e.kind === 'brat') {
          // A Boiler Brat splits in two.
          for (let k = 0; k < 2; k += 1) {
            state.enemies.push(makeEnemy('imp', e.x + (k === 0 ? -24 : 24), e.y + 10, random));
          }
          addFloater(e.x, e.y - 48, 'IT SPLIT IN TWO!', '#c21414', 18);
        }
        addSfx('shoo');
        return 'enemy';
      }
    }
    // A junction: flip its switch.
    for (let i = 0; i < JUNCTIONS.length; i += 1) {
      if (Math.hypot(x - JUNCTIONS[i].x, y - JUNCTIONS[i].y) < 36) {
        toggleJunction(i);
        return 'junction';
      }
    }
    return null;
  }

  function toggleJunction(index) {
    const j = state.junctions[index];
    const at = JUNCTION_CYCLE.indexOf(j.state);
    j.state = JUNCTION_CYCLE[(at + 1) % JUNCTION_CYCLE.length];
    addFloater(JUNCTIONS[index].x, JUNCTIONS[index].y - 44, 'SWITCHED!', '#2f6fd6', 20);
    addSfx('switch');
  }

  /** The coal cost of an ability after relics and discounts. */
  function abilityCost(ability) {
    let cost = ability.cost - (state.abilityDiscount[ability.id] ?? 0);
    if (ability.id === 'whistle' && state.relics.brass) cost -= 1;
    return Math.max(1, cost);
  }

  function useAbility(id) {
    const ability = ABILITIES.find((a) => a.id === id);
    if (!ability) return 'unknown ability';
    if ((state.cooldowns[id] ?? 0) > 0) return `${ability.name} is cooling down.`;
    const cost = abilityCost(ability);
    if (state.coal < cost) return `Need ${cost} coal for ${ability.name}.`;
    state.coal -= cost;
    state.cooldowns[id] = ability.cooldown;
    if (id === 'shunt') {
      state.blockers = [];
      let best = null;
      let bestX = Infinity;
      for (const train of state.trains) {
        if (train.state !== 'running') continue;
        const pos = trainPosition(track, train);
        if (pos.x < bestX) {
          best = train;
          bestX = pos.x;
        }
      }
      if (best) {
        for (let ji = 0; ji < 3; ji += 1) {
          const pos = trainPosition(track, best);
          if (pos.x < JUNCTIONS[ji].x) {
            state.junctions[ji].state = neededSwitch(best, ji);
            break;
          }
        }
      }
      addFloater(640, 420, 'SHUNT! Line clear.', '#2f6fd6', 20);
    } else if (id === 'stoker') {
      state.heat = Math.min(state.heatMax, state.heat + FURNACE.stokerHeat);
      addFloater(FURNACE.x, FURNACE.y - 70, `COAL +${FURNACE.stokerHeat} HEAT`, '#ff7a1a', 20);
      addFloater(FURNACE.x, FURNACE.y - 96, `BOILER ${Math.round((state.heat / state.heatMax) * 100)}%!`, '#ff7a1a', 18);
    } else if (id === 'brake') {
      state.brakeTimer = 3;
      addFloater(640, 420, 'BRAKE! All trains hold.', '#2f6fd6', 20);
    } else if (id === 'signal') {
      state.signalTimer = 6;
      autoRoute();
      addFloater(640, 420, 'SIGNAL! Junctions auto-route.', '#2f6fd6', 20);
    } else if (id === 'water') {
      state.heat = Math.min(state.heatMax, state.heat + 8);
      state.blockers = [];
      addFloater(FURNACE.x, FURNACE.y - 70, 'WATER TOWER! Steam clears the line.', '#4db2e8', 20);
    } else if (id === 'whistle') {
      state.enemies = state.enemies.filter((e) => e.kind !== 'imp' && e.kind !== 'wraith');
      if (state.boss.active) {
        hurtBoss(state.boss, 40, (p) => onBossPhase(p));
        addFloater(state.boss.x, state.boss.y - 90, 'WHISTLE! MAW −40', '#ff3b30', 20);
      }
      addFloater(640, 420, 'WHISTLE! Imps scatter!', '#e8a400', 20);
    }
    addSfx(id);
    return null;
  }

  function chooseCard(index) {
    const choice = state.choices[index];
    if (!choice) return false;
    applyChoice(state, choice);
    addSfx('pick');
    if (state.xp >= xpForLevel(state.level)) {
      state.xp -= xpForLevel(state.level);
      state.level += 1;
      state.pendingLevelUp = true;
      state.choices = rollChoices(random, state);
    }
    return true;
  }

  /** The next trains and the rabble still to come, for the side panels. */
  function incomingCounts() {
    const trains = state.spawnQueue.slice(0, 5).map((dest) => {
      const s = STATIONS.find((st) => st.id === dest);
      return { dest, name: s.name, colour: s.colour };
    });
    const foes = {};
    for (const kind of state.enemyQueue) foes[kind] = (foes[kind] ?? 0) + 1;
    const foeList = ENEMY_ORDER.filter((k) => foes[k]).map((k) => ({ kind: k, name: ENEMY[k].name, line: ENEMY[k].line, count: foes[k] }));
    return { trains, foes: foeList };
  }

  /**
   * One fixed step. With `harmless` set (the title screen's backdrop) the
   * trains run and the furnace never cools, but nothing scores and nothing
   * is lost — the valley just lives behind the title.
   */
  function step(dt, harmless) {
    let events = 0;
    if (state.over) return events;
    state.elapsed += dt;
    if (state.shooCooldown > 0) state.shooCooldown -= dt;
    for (const key of Object.keys(state.cooldowns)) {
      if (state.cooldowns[key] > 0) state.cooldowns[key] -= dt;
    }
    if (state.brakeTimer > 0) state.brakeTimer -= dt;
    if (state.signalTimer > 0) {
      state.signalTimer -= dt;
      autoRoute();
    }
    if (state.shake > 0) state.shake -= dt;
    // The tremor: three seconds of warning, then the rails crack.
    if (state.tremorTimer > 0) {
      state.tremorTimer -= dt;
      if (state.tremorTimer <= 0) {
        state.shake = 0.6;
        flipJunction(Math.floor(random() * 3), true);
        addFloater(640, 200, 'THE RAILS CRACK!', '#ff3b30', 24);
        addSfx('tremorHit');
      }
    }
    for (let i = state.floaters.length - 1; i >= 0; i -= 1) {
      const f = state.floaters[i];
      f.life -= dt;
      f.y -= 22 * dt;
      if (f.life <= 0) state.floaters.splice(i, 1);
    }

    if (!harmless) {
      state.heat -= heatDrainRate() * dt;
      if (state.heat <= 0) {
        state.heat = 0;
        state.over = true;
        addFloater(FURNACE.x, FURNACE.y - 70, 'THE FURNACE WENT COLD!', '#d62020', 24);
        return EVENT_OVER;
      }
      if (state.cargoLost >= MAX_CARGO_LOST) {
        state.over = true;
        return EVENT_OVER;
      }
    }

    // Between runs: a short breather with the next run teased.
    if (state.runState === 'between') {
      state.betweenTimer -= dt;
      if (state.betweenTimer <= 0) {
        startRun(state.run + 1);
        events |= EVENT_RUN;
      }
      // Trains already on the line keep rolling through the breather.
    }

    // Spawn the run's trains on their schedule.
    if (state.runState === 'running') {
      state.spawnTimer -= dt;
      if (state.spawnTimer <= 0 && state.spawnQueue.length > 0) {
        spawnTrain();
        state.spawnTimer += RUN_PLAN[state.run].gap;
      }
      state.enemyTimer -= dt;
      if (state.enemyTimer <= 0 && state.enemyQueue.length > 0) {
        spawnEnemy();
        state.enemyTimer += 5 + random() * 4;
      }
    } else if (harmless && state.spawnQueue.length === 0) {
      // The title backdrop never runs dry: keep sending trains.
      for (let i = 0; i < 4; i += 1) state.spawnQueue.push(randomDest(random));
      state.spawnTimer = 0.5;
    }
    if (harmless) {
      state.signalTimer = 0.2;
      autoRoute();
    }

    // The trains.
    let levelled = false;
    for (let i = state.trains.length - 1; i >= 0; i -= 1) {
      const train = state.trains[i];
      const result = stepTrain(track, train, dt, state.blockers, state.brakeTimer);
      if (result === 'station') {
        if (arriveAtStation(train)) levelled = true;
        if (train.state !== 'running') state.trains.splice(i, 1);
        if (train.state === 'arrived') events |= EVENT_DELIVERY;
        else if (train.state === 'lost') events |= EVENT_LOST;
      } else if (result === 'end') {
        loseCargo(train, 'end');
        state.trains.splice(i, 1);
        events |= EVENT_LOST;
      } else if (result && result.junction) {
        const ji = Number(result.junction[1]) - 1;
        train.seg = junctionNext(ji, state.junctions[ji].state);
        train.dist = result.over;
      }
    }
    if (levelled && !harmless) {
      events |= EVENT_LEVEL;
      return events;
    }
    if (harmless) state.pendingLevelUp = false;

    // The rabble walks in.
    for (let i = state.enemies.length - 1; i >= 0; i -= 1) {
      const enemy = state.enemies[i];
      const result = stepEnemy(enemy, dt, random, state.blockers);
      if (result === 'rockfall') {
        state.enemies.splice(i, 1);
        addFloater(enemy.x, enemy.y - 30, 'ROCKFALL BLOCKS THE LINE!', '#8a7a66', 18);
        addSfx('rock');
      } else if (result === 'arrived') {
        state.enemies.splice(i, 1);
        if (harmless) continue;
        events |= EVENT_HIT;
        if (enemy.kind === 'imp') {
          state.heat = Math.max(0, state.heat - FURNACE.impHit);
          addFloater(FURNACE.x, FURNACE.y - 70, `IMP AT THE FURNACE! −${FURNACE.impHit} HEAT`, '#ff6a1a', 18);
        } else if (enemy.kind === 'rat') {
          flipJunction(Math.floor(random() * 3), false);
          addFloater(FURNACE.x, FURNACE.y - 70, 'A RAT GNAWED A SWITCH!', '#7a5a3a', 18);
        } else if (enemy.kind === 'wraith') {
          state.coal = Math.max(0, state.coal - 6);
          addFloater(FURNACE.x, FURNACE.y - 70, 'WRAITH DRAINED 6 COAL!', '#b8b0c8', 18);
        } else if (enemy.kind === 'brat') {
          state.heat = Math.max(0, state.heat - 2);
          for (let k = 0; k < 2; k += 1) {
            state.enemies.push(makeEnemy('imp', FURNACE.x + (k === 0 ? -60 : 60), FURNACE.y + 40, random));
          }
          addFloater(FURNACE.x, FURNACE.y - 70, 'THE BRAT SPLIT IN TWO!', '#c21414', 18);
        } else if (enemy.kind === 'thief') {
          for (let ji = 0; ji < 3; ji += 1) flipJunction(ji, true);
          addFloater(FURNACE.x, FURNACE.y - 70, 'THE THIEF FLIPPED EVERY SWITCH!', '#3a3a5e', 18);
        }
        addSfx('furnaceHit');
      }
    }

    // The Iron Maw, on run 7.
    if (state.run === RUNS_TOTAL && state.boss.active && !harmless) {
      const result = stepBoss(state.boss, dt, (p) => onBossPhase(p));
      if (result === 'hit') {
        state.heat = Math.max(0, state.heat - FURNACE.mawHit);
        state.shake = 0.6;
        addFloater(FURNACE.x, FURNACE.y - 70, `THE MAW SLAMS THE FURNACE! −${FURNACE.mawHit} HEAT`, '#ff3b30', 22);
        addSfx('mawHit');
        events |= EVENT_HIT;
        if (state.heat <= 0) {
          state.over = true;
          return EVENT_OVER;
        }
      }
    }

    // The run ends when its trains are all resolved.
    if (!harmless && state.runState === 'running' && state.spawnQueue.length === 0 && state.trains.length === 0 && !state.pendingLevelUp) {
      if (state.run < RUNS_TOTAL) {
        state.runState = 'between';
        state.betweenTimer = 4;
        state.tickets += 2;
        addFloater(640, 300, `RUN ${state.run}/7 CLEAR! +2 TICKETS`, '#2f6fd6', 24);
        events |= EVENT_RUN;
      } else if (state.boss.hp <= 0 || !state.boss.active) {
        state.won = true;
        state.over = true;
        addSfx('win');
        return EVENT_WIN;
      } else {
        // The Maw still lives: keep sending cargo-bomb trains at it.
        state.trickleTimer -= dt;
        if (state.trickleTimer <= 0) {
          state.spawnQueue.push(randomDest(random));
          state.trickleTimer = 5;
        }
      }
    }
    return events;
  }

  reset();
  return {
    state,
    reset,
    step,
    toggleJunction,
    useAbility,
    shooAt,
    chooseCard,
    incomingCounts,
    abilityCost,
    boilerPressure: () => boilerPressure(state.boss),
    mawPhase: () => mawPhase(state.boss),
    track,
  };
}

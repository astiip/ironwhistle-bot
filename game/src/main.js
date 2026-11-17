// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps (several in a slow frame, none in a fast one), and the
// renderer paints what is there. The game moves between six screens: title,
// play, level-up, paused, game over and the win.
//
// ?seed=N fixes the valley. ?shot=cover|title|boss|win (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.

import { ABILITIES, BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createAudio } from './audio.js';
import { createWorld, EVENT_BOSS, EVENT_HIT, EVENT_LEVEL, EVENT_OVER, EVENT_RUN, EVENT_WIN } from './world.js';
import {
  ACTION_ABILITY_1,
  ACTION_ABILITY_2,
  ACTION_ABILITY_3,
  ACTION_ABILITY_4,
  ACTION_ABILITY_5,
  ACTION_ABILITY_6,
  ACTION_CONFIRM,
  ACTION_MUTE,
  ACTION_PAUSE,
  ACTION_RESTART,
  createInput,
} from './input.js';
import {
  SCREEN_LEVELUP,
  SCREEN_OVER,
  SCREEN_PAUSED,
  SCREEN_PLAY,
  SCREEN_TITLE,
  SCREEN_WIN,
  createRenderer,
} from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best then lasts one visit.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    world.state.incoming = world.incomingCounts();
    renderer.draw(world.state, scene.screen, scene.best, audio.muted, false, null);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();

  // Screen readers (and anyone watching the page's text) hear the changes.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    audio.unlock();
    audio.startMusic();
    announce('Playing. Switch the rails, feed the furnace, hold seven runs.');
  }

  function endGame(won) {
    screen = won ? SCREEN_WIN : SCREEN_OVER;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    announce(won ? `The line is complete. You win with ${world.state.score} points.` : `The line is lost. Score ${world.state.score}. Best ${best}.`);
    if (won) audio.win();
  }

  function playSounds() {
    const sfx = world.state.sfx;
    world.state.sfx = [];
    for (const name of sfx) {
      if (name === 'switch') audio.switch();
      else if (name === 'deliver') audio.deliver();
      else if (name === 'late') audio.late();
      else if (name === 'lost') audio.lost();
      else if (name === 'shoo') audio.shoo();
      else if (name === 'clang') audio.clang();
      else if (name === 'clear') audio.clear();
      else if (name === 'crack') audio.crack();
      else if (name === 'spawn') audio.spawn();
      else if (name === 'rock') audio.rock();
      else if (name === 'furnaceHit') audio.furnaceHit();
      else if (name === 'levelUp') audio.levelUp();
      else if (name === 'pick') audio.pick();
      else if (name === 'boss') audio.boss();
      else if (name === 'mawHit') audio.mawHit();
      else if (name === 'tremor') audio.tremor();
      else if (name === 'tremorHit') audio.tremorHit();
      else if (name === 'save') audio.save();
      else if (name === 'whistle') audio.whistle();
      else if (name === 'stoker') audio.stoker();
      else if (name === 'water') audio.water();
      else if (name === 'brake') audio.brake();
      else if (name === 'signal') audio.signal();
      else if (name === 'shunt') audio.shunt();
      else if (name === 'win') audio.win();
    }
  }

  function pickCard(index) {
    if (world.chooseCard(index)) {
      screen = SCREEN_PLAY;
      announce(`Level ${world.state.level}. Keep the line running.`);
    }
  }

  function useAbility(index) {
    const ability = ABILITIES[index];
    if (!ability) return;
    const reason = world.useAbility(ability.id);
    if (reason) announce(reason);
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Muted.' : 'Sound on.');
    }
    if (actions & ACTION_RESTART && (screen === SCREEN_OVER || screen === SCREEN_WIN)) {
      startGame();
      return;
    }
    if (screen === SCREEN_LEVELUP) {
      const picks = input.pickActions(actions);
      if (picks & 1024) pickCard(0);
      else if (picks & 2048) pickCard(1);
      else if (picks & 4096) pickCard(2);
      const pointer = input.takePointer();
      if (pointer) {
        const at = renderer.toLogical(pointer.x, pointer.y);
        const cards = renderer.cards;
        for (let i = 0; i < cards.length; i += 1) {
          const card = cards[i];
          if (at.x >= card.x && at.x <= card.x + card.w && at.y >= card.y && at.y <= card.y + card.h) {
            pickCard(i);
            break;
          }
        }
      }
      return;
    }
    if (screen === SCREEN_PLAY) {
      if (actions & ACTION_ABILITY_1) useAbility(0);
      else if (actions & ACTION_ABILITY_2) useAbility(1);
      else if (actions & ACTION_ABILITY_3) useAbility(2);
      else if (actions & ACTION_ABILITY_4) useAbility(3);
      else if (actions & ACTION_ABILITY_5) useAbility(4);
      else if (actions & ACTION_ABILITY_6) useAbility(5);
      const pointer = input.takePointer();
      if (pointer) {
        const at = renderer.toLogical(pointer.x, pointer.y);
        // Ability buttons first, then the field itself.
        let hitButton = false;
        for (const rect of renderer.abilityRects) {
          if (at.x >= rect.x && at.x <= rect.x + rect.w && at.y >= rect.y && at.y <= rect.y + rect.h) {
            const index = ABILITIES.findIndex((a) => a.id === rect.id);
            useAbility(index);
            hitButton = true;
            break;
          }
        }
        if (!hitButton) {
          const reason = world.shooAt(at.x, at.y);
          if (reason === 'junction') announce('Switch flipped.');
        }
      }
    }
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_WIN)) {
      audio.unlock();
      startGame();
    } else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, true);
      return;
    }
    if (screen !== SCREEN_PLAY) return;
    const events = world.step(STEP, false);
    playSounds();
    if (events & EVENT_WIN) endGame(true);
    else if (events & EVENT_OVER) endGame(false);
    else if (events & EVENT_LEVEL) {
      screen = SCREEN_LEVELUP;
      announce(`Level ${world.state.level}. Choose one.`);
    } else if (events & EVENT_HIT) {
      announce(`The furnace is struck. ${Math.ceil(world.state.heat)} heat left.`);
    } else if (events & EVENT_BOSS) {
      announce('The Iron Maw arrives.');
    } else if (events & EVENT_RUN) {
      announce(`Run ${world.state.run} of 7.`);
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    world.state.incoming = world.incomingCounts();
    renderer.draw(world.state, screen, best, audio.muted, audio.musicOn, null);
  }

  // Leaving the tab pauses a running game rather than letting trains run unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Ironwhistle. Press Enter to run the line.');
  // A handle for play-testing: the live world and its screen, read-only.
  window.__ironwhistle = { world, audio, screen: () => screen };
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();

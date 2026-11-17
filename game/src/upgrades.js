// Level-ups, relics and the engine shop.
//
// Deliveries earn experience. When the bar fills, the game pauses on three
// cards: an engine upgrade, a furnace upgrade, a relic, or a cheaper
// ability. Pick one and the line rolls on. Relics are kept in the right-hand
// panel; engine and furnace levels are shown there too.

import { ABILITIES, RELICS, xpForLevel } from './config.js';

export const CHOICE_ENGINE = 'engine';
export const CHOICE_FURNACE = 'furnace';
export const CHOICE_RELIC = 'relic';
export const CHOICE_ABILITY = 'ability';

/** Three cards for a level-up: always one engine, one furnace, one wild card. */
export function rollChoices(random, state) {
  const ownedRelics = Object.keys(state.relics);
  const unowned = Object.keys(RELICS).filter((id) => !ownedRelics.includes(id));
  const wild = [];
  if (unowned.length > 0) {
    const id = unowned[Math.floor(random() * unowned.length)];
    wild.push({ kind: CHOICE_RELIC, id, icon: '✦', name: RELICS[id].name, text: RELICS[id].text });
  }
  const ability = ABILITIES[Math.floor(random() * ABILITIES.length)];
  wild.push({ kind: CHOICE_ABILITY, id: ability.id, icon: '⚙', name: `${ability.name} −1 coal`, text: `${ability.name} gets cheaper to blow.` });
  const picks = [
    { kind: CHOICE_ENGINE, id: 'engine', icon: '🚂', name: 'Bigger Engine', text: `Engine level ${state.engineLevel + 1}: +8% train speed, +10 score per delivery.` },
    { kind: CHOICE_FURNACE, id: 'furnace', icon: '🔥', name: 'Brick the Furnace', text: `Furnace level ${state.furnaceLevel + 1}: +10 max heat, drains slower.` },
    wild[Math.floor(random() * wild.length)],
  ];
  // Shuffle the three cards so the engine is not always first.
  for (let i = picks.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const tmp = picks[i];
    picks[i] = picks[j];
    picks[j] = tmp;
  }
  return picks;
}

/** Apply a picked card to the state. */
export function applyChoice(state, choice) {
  if (choice.kind === CHOICE_ENGINE) {
    state.engineLevel += 1;
    for (const train of state.trains) train.speed = train.baseSpeed * (1 + 0.08 * (state.engineLevel - 1));
  } else if (choice.kind === CHOICE_FURNACE) {
    state.furnaceLevel += 1;
    state.heatMax = 100 + 10 * (state.furnaceLevel - 1);
    state.heat = Math.min(state.heatMax, state.heat + 20);
  } else if (choice.kind === CHOICE_RELIC) {
    state.relics[choice.id] = true;
  } else if (choice.kind === CHOICE_ABILITY) {
    state.abilityDiscount[choice.id] = (state.abilityDiscount[choice.id] ?? 0) + 1;
  }
  state.pendingLevelUp = false;
  state.choices = [];
}

/** Experience for the level the state is on now. */
export function xpNeeded(state) {
  return xpForLevel(state.level);
}

// Keyboard and pointer input. One-shot presses (start, restart, pause,
// abilities, level-up picks) are queued as bit flags and taken once by the
// loop, so a press between two frames is never lost and never counted
// twice. Pointer clicks are queued with their canvas position, so the loop
// can turn a click into a switch flip, a shoo, or a card pick.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_RESTART = 4;
export const ACTION_MUTE = 8;
export const ACTION_ABILITY_1 = 16;
export const ACTION_ABILITY_2 = 32;
export const ACTION_ABILITY_3 = 64;
export const ACTION_ABILITY_4 = 128;
export const ACTION_ABILITY_5 = 256;
export const ACTION_ABILITY_6 = 512;
export const ACTION_PICK_1 = 1024;
export const ACTION_PICK_2 = 2048;
export const ACTION_PICK_3 = 4096;

const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const RESTART = new Set(['KeyR']);
const MUTE = new Set(['KeyM']);
const ABILITY = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, Digit5: 4, Digit6: 5 };

export function createInput(target) {
  let actions = 0;
  let pointer = null;

  window.addEventListener('keydown', (event) => {
    if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (RESTART.has(event.code)) {
      if (!event.repeat) actions |= ACTION_RESTART;
    } else if (MUTE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_MUTE;
    } else if (event.code in ABILITY) {
      if (!event.repeat) actions |= [ACTION_ABILITY_1, ACTION_ABILITY_2, ACTION_ABILITY_3, ACTION_ABILITY_4, ACTION_ABILITY_5, ACTION_ABILITY_6][ABILITY[event.code]];
    } else return;
    event.preventDefault();
  });
  target.addEventListener('pointerdown', (event) => {
    pointer = { x: event.clientX, y: event.clientY };
  });

  return {
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** The pointer click since the last call, in client pixels, or null. */
    takePointer() {
      const taken = pointer;
      pointer = null;
      return taken;
    },
    /** Level-up picks share the 1-3 keys with abilities: map them by screen. */
    pickActions(actionsValue) {
      let picks = 0;
      if (actionsValue & ACTION_ABILITY_1) picks |= ACTION_PICK_1;
      if (actionsValue & ACTION_ABILITY_2) picks |= ACTION_PICK_2;
      if (actionsValue & ACTION_ABILITY_3) picks |= ACTION_PICK_3;
      return picks;
    },
  };
}

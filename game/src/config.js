// IRONWHISTLE: every tuning number, colour and layout constant in one place.
//
// A bright daytime railway valley. One main line runs left to right across
// a green valley; three junctions split up to the hill stations and down to
// the riverside stations. The Furnace stands at the valley's heart and must
// be kept fed with coal. Seven runs: each run sends a wave of trains, and
// on run 7 the Iron Maw itself rolls down the line.

export const FIELD = { width: 1280, height: 800 };

/** The simulation's fixed step, in seconds: 60 updates a second. */
export const STEP = 1 / 60;

/** Seven runs. A run ends when every train it sent has been resolved. */
export const RUNS_TOTAL = 7;

/** Lose the line when this many cargoes are lost. */
export const MAX_CARGO_LOST = 16;

/** The furnace: heat drains over time, Stoker feeds it, 0 means the line dies. */
export const FURNACE = {
  x: 790,
  y: 300,
  radius: 52,
  heatMax: 100,
  /** Heat lost per second on run 1. */
  drainBase: 0.65,
  /** Extra drain per run above the first. */
  drainPerRun: 0.09,
  /** Heat the Stoker ability restores. */
  stokerHeat: 22,
  /** Heat lost when the Iron Maw reaches the furnace. */
  mawHit: 22,
  /** Heat lost when a Cinder Imp reaches the furnace. */
  impHit: 4,
};

/** The main line and the two station rows. */
export const MAIN_Y = 375;
export const STATION_TOP_Y = 172;
export const STATION_BOT_Y = 582;
export const JUNCTION_X = [330, 640, 950];

/** The six stations: three on the hill, three by the river. */
export const STATIONS = [
  { id: 'barn', name: 'Red Barn', short: 'BARN', colour: '#e23b3b', dark: '#a11f1f', x: 330, y: STATION_TOP_Y, side: 'up' },
  { id: 'mill', name: 'Teal Mill', short: 'MILL', colour: '#0f9d8f', dark: '#076b62', x: 640, y: STATION_TOP_Y, side: 'up' },
  { id: 'market', name: 'Yellow Market', short: 'MARKET', colour: '#e8b400', dark: '#a67f00', x: 950, y: STATION_TOP_Y, side: 'up' },
  { id: 'farm', name: 'Green Farm', short: 'FARM', colour: '#3da33d', dark: '#256b25', x: 330, y: STATION_BOT_Y, side: 'down' },
  { id: 'depot', name: 'Blue Depot', short: 'DEPOT', colour: '#2f6fd6', dark: '#1d4a96', x: 640, y: STATION_BOT_Y, side: 'down' },
  { id: 'orchard', name: 'Purple Orchard', short: 'ORCHARD', colour: '#8a4fd0', dark: '#5d2f96', x: 950, y: STATION_BOT_Y, side: 'down' },
];

/** The three junctions: each one splits up to a hill station and down to a riverside one. */
export const JUNCTIONS = [
  { x: 330, y: MAIN_Y, up: 'barn', down: 'farm' },
  { x: 640, y: MAIN_Y, up: 'mill', down: 'depot' },
  { x: 950, y: MAIN_Y, up: 'market', down: 'orchard' },
];

/** What each run sends. Trains grow in number and pace; the rabble grows with them. */
export const RUN_PLAN = {
  1: { trains: 6, gap: 3.4, speed: 92, enemies: { imp: 2 } },
  2: { trains: 8, gap: 3.0, speed: 98, enemies: { imp: 3, rat: 1 } },
  3: { trains: 10, gap: 2.7, speed: 104, enemies: { imp: 4, rat: 2, rock: 1 } },
  4: { trains: 11, gap: 2.5, speed: 110, enemies: { imp: 5, rat: 2, rock: 2, wraith: 1 } },
  5: { trains: 12, gap: 2.3, speed: 116, enemies: { imp: 6, rat: 3, rock: 2, wraith: 2, brat: 1 } },
  6: { trains: 13, gap: 2.1, speed: 122, enemies: { imp: 7, rat: 3, rock: 3, wraith: 2, brat: 2, thief: 1 } },
  7: { trains: 12, gap: 2.0, speed: 128, enemies: { imp: 6, rat: 3, rock: 2, wraith: 2, brat: 2, thief: 1 } },
};

/** A train's on-time window, in seconds after it spawns. */
export const TRAIN_WINDOW = 26;

/** The chain: consecutive on-time deliveries, capped at x8. */
export const CHAIN_MAX = 8;

/** Score for a delivery: base plus a chain bonus; late pays half. */
export const SCORE = { delivery: 100, chainStep: 20, late: 50, bossHit: 60, shoo: 5 };

/** Coal earned per on-time delivery, and per late one. */
export const COAL = { delivery: 8, late: 3, shooImp: 2 };

/** The six abilities on the bottom bar, keyed 1-6. */
export const ABILITIES = [
  { id: 'shunt', key: '1', name: 'Shunt', cost: 4, cooldown: 6, text: 'Clear rockfalls, reroute the nearest train.' },
  { id: 'stoker', key: '2', name: 'Stoker', cost: 6, cooldown: 3, text: 'Feed the furnace: +22 heat.' },
  { id: 'brake', key: '3', name: 'Brake', cost: 3, cooldown: 10, text: 'Hold every train still for 3 s.' },
  { id: 'signal', key: '4', name: 'Signal', cost: 5, cooldown: 12, text: 'Auto-route every junction for 6 s.' },
  { id: 'water', key: '5', name: 'Water Tower', cost: 4, cooldown: 9, text: '+8 heat, wash away all rockfalls.' },
  { id: 'whistle', key: '6', name: 'Whistle', cost: 3, cooldown: 5, text: 'Scatter imps, wound the Maw 40.' },
];

/** Relics: passives the level-up can offer. */
export const RELICS = {
  brass: { name: 'Brass Whistle', text: 'Whistle costs 1 less coal.' },
  spike: { name: 'Golden Spike', text: '+10% train speed, +10 score per delivery.' },
  coalheart: { name: 'Coalheart', text: 'Furnace drains 20% slower.' },
  lantern: { name: 'Signal Lantern', text: 'Junctions glow: +2 s before a train arrives.' },
  horseshoe: { name: 'Iron Horseshoe', text: 'Trains survive one wrong station.' },
  timetable: { name: 'Timetable', text: '+4 s on every delivery window.' },
};

/** Experience needed for the next level. */
export function xpForLevel(level) {
  return 4 + level * 3;
}

/** A bright day palette. Every screen draws from these alone. */
export const PALETTE = {
  skyTop: '#3f9be8',
  skyBottom: '#aee3ff',
  sun: '#ffd94d',
  cloud: '#ffffff',
  hillFar: '#7ec850',
  hillNear: '#5cb53e',
  field: '#8fd45f',
  fieldAlt: '#7cc653',
  river: '#4db2e8',
  riverBank: '#d9c48a',
  dirt: '#c9a06a',
  dirtDark: '#a67c48',
  tie: '#7a5230',
  rail: '#d8dee6',
  railDark: '#9aa4b2',
  house: '#fff3d6',
  houseRoof: '#d64545',
  tree: '#2f8f3a',
  treeDark: '#1f6b28',
  furnace: '#4a3a32',
  furnaceBrick: '#8a4a2a',
  ember: '#ff7a1a',
  emberHot: '#ffc21a',
  smoke: '#e8e8e8',
  panel: '#fff8e6',
  panelEdge: '#8a6a2f',
  panelSoft: '#f2e3b8',
  ink: '#2a2118',
  inkSoft: '#6b5a44',
  inkDim: '#9a8a70',
  danger: '#d62020',
  ok: '#1f8f3a',
  gold: '#e8a400',
  chain: '#ff8c1a',
  boss: '#c21414',
  bossBar: '#ff3b30',
  hud: '#1d3a5f',
  hudSoft: '#2f5a8a',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'ironwhistle.best';

// Drawing only: the world's state and the current screen in, pixels out.
// The 1280x800 valley is scaled to fit the window and centred, the margin
// filled with sky blue. Bright day throughout: blue sky, green fields, a
// river, red roofs, and the furnace glowing orange at the valley's heart.

import { ABILITIES, CHAIN_MAX, FIELD, FONT, FURNACE, JUNCTIONS, MAIN_Y, MAX_CARGO_LOST, PALETTE, RELICS, RUNS_TOTAL, RUN_PLAN, STATIONS, STATION_BOT_Y, STATION_TOP_Y } from './config.js';
import { ENEMY } from './enemies.js';
import { MAW_PHASE, boilerPressure, mawPhase } from './boss.js';
import { trainPosition } from './trains.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_LEVELUP = 'levelup';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

const TOP_BAR = 64;
const BOTTOM_BAR = 100;
const LEFT_PANEL = 150;
const RIGHT_PANEL = 150;
const PLAY_TOP = TOP_BAR;
const PLAY_BOTTOM = FIELD.height - BOTTOM_BAR;

const CLOUDS = [
  { x: 200, y: 96, s: 1.0, v: 6 },
  { x: 520, y: 130, s: 0.7, v: 9 },
  { x: 880, y: 90, s: 1.2, v: 5 },
  { x: 1120, y: 150, s: 0.8, v: 8 },
];

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const fonts = new Map();
  const cards = [];
  const abilityRects = [];

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  function text(value, x, y, size, color, align, bold) {
    const key = `${size}${bold ? 'b' : ''}`;
    if (!fonts.has(key)) fonts.set(key, `${bold ? '700 ' : ''}${size}px ${FONT}`);
    context.font = fonts.get(key);
    context.fillStyle = color;
    context.textAlign = align ?? 'left';
    context.textBaseline = 'alphabetic';
    context.fillText(value, x, y);
  }

  function toLogical(px, py) {
    const rect = canvas.getBoundingClientRect();
    const cx = (px - rect.left) * (canvas.width / rect.width);
    const cy = (py - rect.top) * (canvas.height / rect.height);
    return { x: (cx - view.x) / view.scale, y: (cy - view.y) / view.scale };
  }

  // ---- the valley -------------------------------------------------------

  function drawSky(state) {
    const grad = context.createLinearGradient(0, 0, 0, PLAY_BOTTOM);
    grad.addColorStop(0, PALETTE.skyTop);
    grad.addColorStop(1, PALETTE.skyBottom);
    context.fillStyle = grad;
    context.fillRect(0, PLAY_TOP, FIELD.width, PLAY_BOTTOM - PLAY_TOP);
    // Sun, top left, with rays.
    context.fillStyle = PALETTE.sun;
    context.beginPath();
    context.arc(105, 118, 34, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = 'rgba(255,217,77,0.7)';
    context.lineWidth = 4;
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * Math.PI * 2 + state.elapsed * 0.05;
      context.beginPath();
      context.moveTo(105 + Math.cos(a) * 44, 118 + Math.sin(a) * 44);
      context.lineTo(105 + Math.cos(a) * 56, 118 + Math.sin(a) * 56);
      context.stroke();
    }
    // Drifting clouds.
    context.fillStyle = PALETTE.cloud;
    for (const c of CLOUDS) {
      const x = ((c.x + state.elapsed * c.v) % 1400) - 100;
      context.beginPath();
      context.arc(x, c.y, 22 * c.s, 0, Math.PI * 2);
      context.arc(x + 26 * c.s, c.y + 4, 17 * c.s, 0, Math.PI * 2);
      context.arc(x - 26 * c.s, c.y + 5, 15 * c.s, 0, Math.PI * 2);
      context.fill();
    }
    // Far hills.
    context.fillStyle = PALETTE.hillFar;
    context.beginPath();
    context.moveTo(0, 250);
    context.quadraticCurveTo(320, 180, 640, 240);
    context.quadraticCurveTo(960, 290, 1280, 210);
    context.lineTo(1280, 330);
    context.lineTo(0, 330);
    context.closePath();
    context.fill();
    // Fields, two greens in stripes.
    for (let i = 0; i < 8; i += 1) {
      context.fillStyle = i % 2 === 0 ? PALETTE.field : PALETTE.fieldAlt;
      context.fillRect(0, 330 + i * 46, FIELD.width, 46);
    }
    // The river along the bottom, with a sandy bank.
    context.fillStyle = PALETTE.riverBank;
    context.fillRect(0, 636, FIELD.width, 14);
    context.fillStyle = PALETTE.river;
    context.fillRect(0, 650, FIELD.width, 50);
    context.strokeStyle = 'rgba(255,255,255,0.55)';
    context.lineWidth = 3;
    for (let i = 0; i < 4; i += 1) {
      const y = 662 + i * 10;
      context.beginPath();
      for (let x = 0; x <= 1280; x += 40) {
        const yy = y + Math.sin((x + state.elapsed * 30 + i * 90) * 0.02) * 3;
        if (x === 0) context.moveTo(x, yy);
        else context.lineTo(x, yy);
      }
      context.stroke();
    }
    // A little village and trees, fixed dressing.
    const houses = [[210, 250], [1130, 250], [180, 560], [1160, 560]];
    for (const [hx, hy] of houses) drawHouse(hx, hy);
    const trees = [[250, 300], [1050, 300], [290, 520], [1010, 520], [560, 620], [760, 620]];
    for (const [tx, ty] of trees) drawTree(tx, ty);
  }

  function drawHouse(x, y) {
    context.fillStyle = PALETTE.house;
    context.fillRect(x - 22, y - 18, 44, 30);
    context.fillStyle = PALETTE.houseRoof;
    context.beginPath();
    context.moveTo(x - 28, y - 16);
    context.lineTo(x, y - 38);
    context.lineTo(x + 28, y - 16);
    context.closePath();
    context.fill();
    context.fillStyle = '#2a2118';
    context.fillRect(x - 6, y - 2, 12, 14);
    context.fillStyle = PALETTE.sun;
    context.fillRect(x - 17, y - 12, 8, 8);
    context.fillRect(x + 9, y - 12, 8, 8);
  }

  function drawTree(x, y) {
    context.fillStyle = '#6b4a2a';
    context.fillRect(x - 3, y - 6, 6, 18);
    context.fillStyle = PALETTE.tree;
    context.beginPath();
    context.arc(x, y - 18, 16, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = PALETTE.treeDark;
    context.beginPath();
    context.arc(x - 8, y - 10, 9, 0, Math.PI * 2);
    context.arc(x + 9, y - 12, 8, 0, Math.PI * 2);
    context.fill();
  }

  // ---- track ------------------------------------------------------------

  function drawSegment(seg) {
    const dx = seg.x2 - seg.x1;
    const dy = seg.y2 - seg.y1;
    const len = Math.hypot(dx, dy);
    const ux = dx / len;
    const uy = dy / len;
    const nx = -uy;
    const ny = ux;
    // Dirt bed.
    context.strokeStyle = PALETTE.dirt;
    context.lineWidth = 20;
    context.beginPath();
    context.moveTo(seg.x1, seg.y1);
    context.lineTo(seg.x2, seg.y2);
    context.stroke();
    // Ties.
    context.fillStyle = PALETTE.tie;
    const step = 26;
    for (let d = 6; d < len; d += step) {
      const cx = seg.x1 + ux * d;
      const cy = seg.y1 + uy * d;
      context.save();
      context.translate(cx, cy);
      context.rotate(Math.atan2(uy, ux));
      context.fillRect(-2, -9, 5, 18);
      context.restore();
    }
    // Two steel rails.
    context.strokeStyle = PALETTE.rail;
    context.lineWidth = 3;
    for (const off of [-6, 6]) {
      context.beginPath();
      context.moveTo(seg.x1 + nx * off, seg.y1 + ny * off);
      context.lineTo(seg.x2 + nx * off, seg.y2 + ny * off);
      context.stroke();
    }
  }

  function drawTrack(track) {
    for (const seg of track.segs) drawSegment(seg);
  }

  function drawStation(station) {
    const { x, y } = station;
    const up = station.side === 'up';
    const platY = up ? y + 34 : y - 34;
    // Platform.
    context.fillStyle = '#e8ddc0';
    context.fillRect(x - 62, platY - 8, 124, 16);
    // Building.
    context.fillStyle = '#fff3d6';
    context.fillRect(x - 52, y - 26, 104, 44);
    context.fillStyle = station.colour;
    context.beginPath();
    context.moveTo(x - 58, y - 24);
    context.lineTo(x, y - 52);
    context.lineTo(x + 58, y - 24);
    context.closePath();
    context.fill();
    context.fillStyle = station.dark;
    context.fillRect(x - 58, y - 26, 116, 5);
    // Door and windows.
    context.fillStyle = '#2a2118';
    context.fillRect(x - 8, y - 4, 16, 22);
    context.fillStyle = PALETTE.sun;
    context.fillRect(x - 42, y - 16, 12, 12);
    context.fillRect(x + 30, y - 16, 12, 12);
    // Sign with the station's short name.
    context.fillStyle = '#fff8e6';
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 2;
    roundRect(context, x - 48, y - 76, 96, 20, 4);
    context.fill();
    context.stroke();
    text(station.short, x, y - 61, 13, PALETTE.ink, 'center', true);
    // Flag.
    context.strokeStyle = '#6b5a44';
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(x + 52, y - 52);
    context.lineTo(x + 52, y - 78);
    context.stroke();
    context.fillStyle = station.colour;
    context.beginPath();
    context.moveTo(x + 52, y - 78);
    context.lineTo(x + 74, y - 72);
    context.lineTo(x + 52, y - 66);
    context.closePath();
    context.fill();
  }

  function drawFurnace(state) {
    const heatFrac = state.heat / state.heatMax;
    const glow = 0.45 + 0.55 * heatFrac;
    const { x, y } = FURNACE;
    // Glow behind the furnace.
    const grad = context.createRadialGradient(x, y, 10, x, y, 110);
    grad.addColorStop(0, `rgba(255,122,26,${0.55 * glow})`);
    grad.addColorStop(1, 'rgba(255,122,26,0)');
    context.fillStyle = grad;
    context.beginPath();
    context.arc(x, y, 110, 0, Math.PI * 2);
    context.fill();
    // Brick body.
    context.fillStyle = PALETTE.furnaceBrick;
    roundRect(context, x - 58, y - 34, 116, 62, 8);
    context.fill();
    context.strokeStyle = '#5e2f16';
    context.lineWidth = 2;
    for (let i = 0; i < 3; i += 1) {
      context.beginPath();
      context.moveTo(x - 58, y - 14 + i * 18);
      context.lineTo(x + 58, y - 14 + i * 18);
      context.stroke();
    }
    // The glowing mouth.
    context.fillStyle = heatFrac > 0.25 ? PALETTE.ember : '#5e2f16';
    roundRect(context, x - 30, y + 2, 60, 26, 6);
    context.fill();
    context.fillStyle = PALETTE.emberHot;
    const flick = 0.6 + 0.4 * Math.sin(state.elapsed * 9);
    context.globalAlpha = glow * flick;
    roundRect(context, x - 22, y + 8, 44, 14, 5);
    context.fill();
    context.globalAlpha = 1;
    // Chimney with smoke.
    context.fillStyle = PALETTE.furnace;
    context.fillRect(x + 34, y - 78, 20, 48);
    context.fillStyle = PALETTE.smoke;
    for (let i = 0; i < 3; i += 1) {
      const t = ((state.elapsed * 0.35 + i / 3) % 1);
      const sx = x + 44 + Math.sin(t * 9) * 8;
      const sy = y - 82 - t * 46;
      context.globalAlpha = 0.55 * (1 - t);
      context.beginPath();
      context.arc(sx, sy, 8 + t * 12, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
    // Coal pile.
    context.fillStyle = '#2a2118';
    context.beginPath();
    context.moveTo(x - 88, y + 28);
    context.lineTo(x - 58, y + 2);
    context.lineTo(x - 28, y + 28);
    context.closePath();
    context.fill();
    // Heat bar above the furnace.
    context.fillStyle = 'rgba(255,255,255,0.85)';
    roundRect(context, x - 52, y - 102, 104, 14, 7);
    context.fill();
    context.fillStyle = heatFrac > 0.25 ? PALETTE.ember : PALETTE.danger;
    roundRect(context, x - 50, y - 100, 100 * heatFrac, 10, 5);
    context.fill();
    text(`FURNACE ${Math.round(heatFrac * 100)}%`, x, y - 108, 13, PALETTE.ink, 'center', true);
  }

  function drawJunction(state, index) {
    const j = JUNCTIONS[index];
    const s = state.junctions[index].state;
    const pulse = 0.6 + 0.4 * Math.sin(state.elapsed * 4 + index);
    // Glowing base so the switch reads from across the valley.
    context.fillStyle = `rgba(47,111,214,${0.35 + 0.3 * pulse})`;
    context.beginPath();
    context.arc(j.x, j.y, 26, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#fff8e6';
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 2;
    context.beginPath();
    context.arc(j.x, j.y, 20, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    // Arrow: right for straight, up-right, down-right.
    context.fillStyle = '#1d3a5f';
    context.beginPath();
    if (s === 'straight') {
      context.moveTo(j.x - 10, j.y - 6);
      context.lineTo(j.x + 8, j.y - 6);
      context.lineTo(j.x + 8, j.y - 11);
      context.lineTo(j.x + 16, j.y);
      context.lineTo(j.x + 8, j.y + 11);
      context.lineTo(j.x + 8, j.y + 6);
      context.lineTo(j.x - 10, j.y + 6);
    } else if (s === 'up') {
      context.moveTo(j.x - 10, j.y + 8);
      context.lineTo(j.x + 2, j.y - 4);
      context.lineTo(j.x - 3, j.y - 4);
      context.lineTo(j.x + 6, j.y - 14);
      context.lineTo(j.x + 12, j.y - 4);
      context.lineTo(j.x + 6, j.y - 4);
      context.lineTo(j.x + 12, j.y + 2);
      context.lineTo(j.x + 2, j.y + 12);
    } else {
      context.moveTo(j.x - 10, j.y - 8);
      context.lineTo(j.x + 2, j.y + 4);
      context.lineTo(j.x - 3, j.y + 4);
      context.lineTo(j.x + 6, j.y + 14);
      context.lineTo(j.x + 12, j.y + 4);
      context.lineTo(j.x + 6, j.y + 4);
      context.lineTo(j.x + 12, j.y - 2);
      context.lineTo(j.x + 2, j.y - 12);
    }
    context.closePath();
    context.fill();
    text(`J${index + 1}`, j.x, j.y + 36, 12, PALETTE.ink, 'center', true);
  }

  // ---- trains, foes, boss -------------------------------------------------

  function drawTrain(track, train, state) {
    const pos = trainPosition(track, train);
    const angle = pos.angle;
    const blocked = train.blocked || state.brakeTimer > 0;
    context.save();
    context.translate(pos.x, pos.y);
    context.rotate(angle);
    // Two wagons behind the loco.
    for (let w = 0; w < 2; w += 1) {
      const wx = -44 - w * 34;
      context.fillStyle = train.dark;
      roundRect(context, wx - 15, -11, 30, 22, 4);
      context.fill();
      context.fillStyle = 'rgba(255,255,255,0.25)';
      context.fillRect(wx - 15, -11, 30, 6);
      context.fillStyle = '#2a2118';
      context.beginPath();
      context.arc(wx - 8, 12, 4, 0, Math.PI * 2);
      context.arc(wx + 8, 12, 4, 0, Math.PI * 2);
      context.fill();
    }
    // Loco.
    context.fillStyle = train.colour;
    roundRect(context, -22, -16, 46, 32, 6);
    context.fill();
    context.fillStyle = train.dark;
    roundRect(context, 8, -26, 16, 16, 4);
    context.fill();
    context.fillStyle = '#2a2118';
    context.fillRect(20, -30, 6, 10);
    context.fillStyle = PALETTE.sun;
    context.beginPath();
    context.arc(14, -8, 5, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#2a2118';
    context.beginPath();
    context.arc(-12, 17, 5, 0, Math.PI * 2);
    context.arc(12, 17, 5, 0, Math.PI * 2);
    context.fill();
    // Chimney smoke.
    context.fillStyle = 'rgba(232,232,232,0.85)';
    const t = (state.elapsed * 0.8 + train.id * 0.3) % 1;
    context.beginPath();
    context.arc(24, -34 - t * 16, 4 + t * 6, 0, Math.PI * 2);
    context.fill();
    context.restore();
    // Destination flag above the loco.
    const short = STATIONS.find((s) => s.id === train.dest).short;
    context.fillStyle = '#fff8e6';
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 1.5;
    roundRect(context, pos.x - 34, pos.y - 52, 68, 18, 4);
    context.fill();
    context.stroke();
    text(short, pos.x, pos.y - 39, 12, PALETTE.ink, 'center', true);
    // On-time window ring: it drains as the deadline nears.
    const frac = Math.max(0, 1 - train.age / train.window);
    context.strokeStyle = frac > 0.4 ? '#1f8f3a' : '#d62020';
    context.lineWidth = 3;
    context.beginPath();
    context.arc(pos.x, pos.y - 62, 7, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
    context.stroke();
    if (blocked) {
      text('!', pos.x, pos.y - 66, 22, '#d62020', 'center', true);
    }
  }

  function drawEnemy(e) {
    const def = ENEMY[e.kind];
    const flash = e.hitFlash > 0;
    context.save();
    context.translate(e.x, e.y);
    if (e.kind === 'imp') {
      context.fillStyle = flash ? '#ffffff' : def.colour;
      context.beginPath();
      context.arc(0, 0, e.radius, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#a11f1f';
      context.beginPath();
      context.moveTo(-9, -10);
      context.lineTo(-6, -20);
      context.lineTo(-2, -11);
      context.moveTo(9, -10);
      context.lineTo(6, -20);
      context.lineTo(2, -11);
      context.fill();
    } else if (e.kind === 'rock') {
      context.fillStyle = flash ? '#ffffff' : def.colour;
      context.beginPath();
      context.moveTo(-15, 8);
      context.lineTo(-8, -13);
      context.lineTo(6, -15);
      context.lineTo(15, 4);
      context.lineTo(8, 12);
      context.lineTo(-8, 12);
      context.closePath();
      context.fill();
    } else if (e.kind === 'rat') {
      context.fillStyle = flash ? '#ffffff' : def.colour;
      context.beginPath();
      context.ellipse(0, 0, 13, 9, 0, 0, Math.PI * 2);
      context.fill();
      context.beginPath();
      context.arc(-11, -6, 5, 0, Math.PI * 2);
      context.arc(11, -6, 5, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = '#d9a0a0';
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(13, 4);
      context.quadraticCurveTo(26, 10, 22, 20);
      context.stroke();
    } else if (e.kind === 'wraith') {
      context.fillStyle = flash ? '#ffffff' : def.colour;
      context.globalAlpha = 0.85;
      context.beginPath();
      context.arc(0, -4, 12, Math.PI, 0);
      context.lineTo(12, 10);
      context.lineTo(6, 5);
      context.lineTo(0, 11);
      context.lineTo(-6, 5);
      context.lineTo(-12, 10);
      context.closePath();
      context.fill();
      context.globalAlpha = 1;
    } else if (e.kind === 'brat') {
      context.fillStyle = flash ? '#ffffff' : def.colour;
      context.beginPath();
      context.arc(0, 0, e.radius, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#ffd94d';
      context.beginPath();
      context.moveTo(-10, -10);
      context.lineTo(-7, -22);
      context.lineTo(-3, -11);
      context.moveTo(10, -10);
      context.lineTo(7, -22);
      context.lineTo(3, -11);
      context.fill();
    } else {
      // Signal Thief: a masked figure in a dark cloak.
      context.fillStyle = flash ? '#ffffff' : def.colour;
      context.beginPath();
      context.moveTo(0, -16);
      context.lineTo(13, 12);
      context.lineTo(-13, 12);
      context.closePath();
      context.fill();
      context.fillStyle = '#9be8ff';
      context.fillRect(-8, -8, 16, 4);
    }
    // Eyes.
    context.fillStyle = def.eye;
    context.beginPath();
    context.arc(-4, -3, 2.5, 0, Math.PI * 2);
    context.arc(4, -3, 2.5, 0, Math.PI * 2);
    context.fill();
    context.restore();
    text(def.name, e.x, e.y - e.radius - 8, 11, PALETTE.ink, 'center', true);
  }

  function drawBlocker(b) {
    context.fillStyle = '#8a7a66';
    context.beginPath();
    context.arc(b.x - 12, b.y, 14, 0, Math.PI * 2);
    context.arc(b.x + 10, b.y - 4, 16, 0, Math.PI * 2);
    context.arc(b.x + 2, b.y + 8, 12, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#5e5245';
    context.beginPath();
    context.arc(b.x - 12, b.y - 4, 5, 0, Math.PI * 2);
    context.arc(b.x + 10, b.y - 8, 6, 0, Math.PI * 2);
    context.fill();
    text('!', b.x, b.y - 26, 22, '#d62020', 'center', true);
    text(`CLICK x${b.hp}`, b.x, b.y + 30, 11, PALETTE.ink, 'center', true);
  }

  function drawBoss(state) {
    const boss = state.boss;
    if (!boss.active) return;
    const phase = MAW_PHASE[boss.phase];
    const shakeX = state.shake > 0 ? Math.sin(state.elapsed * 90) * 5 : 0;
    const x = boss.x + shakeX;
    const y = boss.y;
    // A third of the screen wide: the Maw is a wall of iron.
    const w = 300;
    const h = 104;
    // Heat shimmer behind it.
    const grad = context.createRadialGradient(x, y, 20, x, y, 190);
    grad.addColorStop(0, phase.colour === '#8a8a8a' ? 'rgba(150,150,150,0.35)' : 'rgba(255,59,48,0.4)');
    grad.addColorStop(1, 'rgba(255,59,48,0)');
    context.fillStyle = grad;
    context.beginPath();
    context.arc(x, y, 190, 0, Math.PI * 2);
    context.fill();
    // Body.
    context.fillStyle = '#2a2118';
    roundRect(context, x - w / 2, y - h / 2, w, h, 14);
    context.fill();
    context.fillStyle = '#4a3a32';
    roundRect(context, x - w / 2 + 10, y - h / 2 + 10, w - 20, h - 20, 10);
    context.fill();
    // Rivets and plates.
    context.fillStyle = '#6b5a44';
    for (let i = 0; i < 6; i += 1) {
      context.beginPath();
      context.arc(x - w / 2 + 30 + i * 48, y - h / 2 + 16, 4, 0, Math.PI * 2);
      context.fill();
    }
    // The furnace mouth: a glowing maw.
    const flick = 0.7 + 0.3 * Math.sin(state.elapsed * 12);
    context.fillStyle = phase.colour;
    context.globalAlpha = flick;
    context.beginPath();
    context.arc(x - w / 2 + 52, y, 30, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = phase.glow;
    context.beginPath();
    context.arc(x - w / 2 + 52, y, 18, 0, Math.PI * 2);
    context.fill();
    context.globalAlpha = 1;
    // Teeth.
    context.fillStyle = '#fff8e6';
    for (let i = 0; i < 5; i += 1) {
      const tx = x - w / 2 + 30 + i * 12;
      context.beginPath();
      context.moveTo(tx, y - 26);
      context.lineTo(tx + 6, y - 12);
      context.lineTo(tx + 12, y - 26);
      context.closePath();
      context.fill();
    }
    // Chimney stack with heavy smoke.
    context.fillStyle = '#1d1512';
    context.fillRect(x + w / 2 - 66, y - h / 2 - 44, 26, 48);
    context.fillStyle = 'rgba(60,60,60,0.8)';
    for (let i = 0; i < 3; i += 1) {
      const t = ((state.elapsed * 0.5 + i / 3) % 1);
      context.beginPath();
      context.arc(x + w / 2 - 53 + Math.sin(t * 8) * 10, y - h / 2 - 48 - t * 60, 10 + t * 16, 0, Math.PI * 2);
      context.fill();
    }
    // Wheels.
    context.fillStyle = '#1d1512';
    for (let i = 0; i < 4; i += 1) {
      context.beginPath();
      context.arc(x - w / 2 + 40 + i * 72, y + h / 2 + 4, 16, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#8a7a66';
      context.beginPath();
      context.arc(x - w / 2 + 40 + i * 72, y + h / 2 + 4, 6, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#1d1512';
    }
    // Name and phase.
    text('THE IRON MAW', x, y - h / 2 - 52, 26, '#c21414', 'center', true);
    text(`phase ${boss.phase} of 3 · ${phase.name}`, x, y - h / 2 - 28, 16, PALETTE.ink, 'center', true);
    // Boss health bar.
    const bw = 260;
    context.fillStyle = 'rgba(255,255,255,0.85)';
    roundRect(context, x - bw / 2, y + h / 2 + 16, bw, 14, 7);
    context.fill();
    context.fillStyle = PALETTE.bossBar;
    roundRect(context, x - bw / 2 + 2, y + h / 2 + 18, (bw - 4) * (boss.hp / boss.maxHp), 10, 5);
    context.fill();
    text(`Boiler pressure ${boilerPressure(boss)}%`, x, y + h / 2 + 48, 14, '#c21414', 'center', true);
  }

  function drawFloaters(state) {
    for (const f of state.floaters) {
      context.globalAlpha = Math.max(0, f.life / f.maxLife);
      text(f.text, f.x, f.y, f.size, f.colour, 'center', true);
    }
    context.globalAlpha = 1;
  }

  // ---- HUD and panels -----------------------------------------------------

  function drawTopBar(state) {
    context.fillStyle = PALETTE.hud;
    context.fillRect(0, 0, FIELD.width, TOP_BAR);
    context.fillStyle = PALETTE.hudSoft;
    context.fillRect(0, TOP_BAR - 4, FIELD.width, 4);
    text(`RUN ${state.run}/7`, 18, 42, 30, '#ffffff', 'left', true);
    text('WIN finish 7 runs & break the Iron Maw  ·  LOSE furnace hits 0 or 16 cargo lost', 640, 26, 15, '#cfe3ff', 'center');
    text(`SCORE ${state.score}`, 640, 52, 20, '#ffd94d', 'center', true);
    const chainText = state.chain > 0 ? `CHAIN x${state.chain}` : 'CHAIN —';
    text(chainText, 1050, 30, 20, state.chain >= 6 ? '#ff8c1a' : '#ffffff', 'left', true);
    text(`◆ COAL ${state.coal}   🎟 TICKETS ${state.tickets}`, 1050, 54, 16, '#ffffff', 'left');
    // Boss bar under the top bar while the Maw lives.
    if (state.boss.active) {
      const boss = state.boss;
      const phase = MAW_PHASE[boss.phase];
      context.fillStyle = 'rgba(29,58,95,0.92)';
      context.fillRect(330, TOP_BAR + 2, 620, 30);
      text('THE IRON MAW', 344, TOP_BAR + 22, 15, '#ff8a80', 'left', true);
      context.fillStyle = '#3a2a2a';
      roundRect(context, 480, TOP_BAR + 10, 300, 14, 7);
      context.fill();
      context.fillStyle = PALETTE.bossBar;
      roundRect(context, 482, TOP_BAR + 12, 296 * (boss.hp / boss.maxHp), 10, 5);
      context.fill();
      text(`phase ${boss.phase} of 3 · ${phase.name} · Boiler pressure ${boilerPressure(boss)}%`, 790, TOP_BAR + 22, 13, '#ffffff', 'left');
    }
  }

  function drawLeftPanel(state, incoming) {
    context.fillStyle = PALETTE.panel;
    context.fillRect(0, PLAY_TOP, LEFT_PANEL, PLAY_BOTTOM - PLAY_TOP);
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(LEFT_PANEL, PLAY_TOP);
    context.lineTo(LEFT_PANEL, PLAY_BOTTOM);
    context.stroke();
    let y = PLAY_TOP + 24;
    text('INCOMING', 12, y, 15, PALETTE.ink, 'left', true);
    y += 22;
    if (incoming.trains.length === 0) {
      text('— line clear —', 12, y, 13, PALETTE.inkDim, 'left');
      y += 20;
    }
    for (const t of incoming.trains) {
      context.fillStyle = t.colour;
      context.beginPath();
      context.arc(20, y - 5, 7, 0, Math.PI * 2);
      context.fill();
      text(t.name, 32, y, 13, PALETTE.ink, 'left');
      y += 22;
    }
    y += 8;
    text('RABBLE', 12, y, 15, PALETTE.ink, 'left', true);
    y += 22;
    if (incoming.foes.length === 0) {
      text('— none yet —', 12, y, 13, PALETTE.inkDim, 'left');
      y += 20;
    }
    for (const f of incoming.foes) {
      text(`${f.name} x${f.count}`, 12, y, 13, PALETTE.ink, 'left', true);
      y += 16;
      text(f.line, 12, y, 11, PALETTE.inkSoft, 'left');
      y += 22;
    }
    y += 6;
    text('NEXT RUN', 12, y, 15, PALETTE.ink, 'left', true);
    y += 22;
    if (state.run < RUNS_TOTAL) {
      const plan = RUN_PLAN[state.run + 1];
      text(`RUN ${state.run + 1}/7`, 12, y, 13, PALETTE.ink, 'left', true);
      y += 18;
      text(`${plan.trains} trains, faster`, 12, y, 12, PALETTE.inkSoft, 'left');
      y += 18;
      text(state.run + 1 === RUNS_TOTAL ? 'THE IRON MAW!' : 'more rabble', 12, y, 12, state.run + 1 === RUNS_TOTAL ? '#c21414' : PALETTE.inkSoft, 'left', state.run + 1 === RUNS_TOTAL);
    } else {
      text('FINAL RUN', 12, y, 13, '#c21414', 'left', true);
      y += 18;
      text('BREAK THE MAW!', 12, y, 12, '#c21414', 'left', true);
    }
    if (state.runState === 'between') {
      y += 30;
      text(`NEXT IN ${Math.ceil(state.betweenTimer)}s`, 12, y, 14, '#1f8f3a', 'left', true);
    }
  }

  function drawRightPanel(state) {
    const x0 = FIELD.width - RIGHT_PANEL;
    context.fillStyle = PALETTE.panel;
    context.fillRect(x0, PLAY_TOP, RIGHT_PANEL, PLAY_BOTTOM - PLAY_TOP);
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(x0, PLAY_TOP);
    context.lineTo(x0, PLAY_BOTTOM);
    context.stroke();
    let y = PLAY_TOP + 24;
    text('RELICS', x0 + 12, y, 15, PALETTE.ink, 'left', true);
    y += 22;
    const owned = Object.keys(state.relics);
    if (owned.length === 0) {
      text('— none yet —', x0 + 12, y, 13, PALETTE.inkDim, 'left');
      y += 20;
    }
    for (const id of owned) {
      text(`✦ ${RELICS[id].name}`, x0 + 12, y, 12, PALETTE.ink, 'left');
      y += 20;
    }
    y += 8;
    text('UPGRADES', x0 + 12, y, 15, PALETTE.ink, 'left', true);
    y += 22;
    text(`🚂 Engine Lv ${state.engineLevel}`, x0 + 12, y, 13, PALETTE.ink, 'left');
    y += 20;
    text(`🔥 Furnace Lv ${state.furnaceLevel}`, x0 + 12, y, 13, PALETTE.ink, 'left');
    y += 28;
    text('CARGO', x0 + 12, y, 15, PALETTE.ink, 'left', true);
    y += 22;
    text(`✓ Delivered ${state.cargoDelivered}`, x0 + 12, y, 13, '#1f8f3a', 'left');
    y += 20;
    text(`✗ Lost ${state.cargoLost}/${MAX_CARGO_LOST}`, x0 + 12, y, 13, state.cargoLost > 10 ? '#d62020' : PALETTE.ink, 'left');
    y += 20;
    text(`◷ Late ${state.cargoLate}`, x0 + 12, y, 13, PALETTE.inkSoft, 'left');
    y += 28;
    text(`LEVEL ${state.level}`, x0 + 12, y, 15, PALETTE.ink, 'left', true);
    y += 10;
    const need = 4 + state.level * 3;
    context.fillStyle = '#d9c48a';
    roundRect(context, x0 + 12, y, RIGHT_PANEL - 24, 10, 5);
    context.fill();
    context.fillStyle = '#2f6fd6';
    roundRect(context, x0 + 14, y + 2, (RIGHT_PANEL - 28) * Math.min(1, state.xp / need), 6, 3);
    context.fill();
    y += 30;
    text(`Best chain x${state.bestChain}`, x0 + 12, y, 12, PALETTE.inkSoft, 'left');
  }

  function drawBottomBar(state) {
    const y0 = FIELD.height - BOTTOM_BAR;
    context.fillStyle = PALETTE.hud;
    context.fillRect(0, y0, FIELD.width, BOTTOM_BAR);
    context.fillStyle = PALETTE.hudSoft;
    context.fillRect(0, y0, FIELD.width, 4);
    abilityRects.length = 0;
    const bw = 118;
    const gap = 10;
    let x = 14;
    for (const ability of ABILITIES) {
      const cost = Math.max(1, ability.cost - (state.abilityDiscount[ability.id] ?? 0) - (ability.id === 'whistle' && state.relics.brass ? 1 : 0));
      const cd = state.cooldowns[ability.id] ?? 0;
      const afford = state.coal >= cost && cd <= 0;
      context.fillStyle = afford ? '#fff8e6' : '#c9c2b2';
      roundRect(context, x, y0 + 14, bw, 66, 8);
      context.fill();
      context.strokeStyle = PALETTE.panelEdge;
      context.lineWidth = 2;
      context.stroke();
      text(`[${ability.key}] ${ability.name}`, x + 8, y0 + 34, 13, PALETTE.ink, 'left', true);
      text(`◆ ${cost} coal`, x + 8, y0 + 54, 12, PALETTE.inkSoft, 'left');
      if (cd > 0) {
        context.fillStyle = 'rgba(29,58,95,0.55)';
        roundRect(context, x, y0 + 14, bw, 66, 8);
        context.fill();
        text(`${Math.ceil(cd)}s`, x + bw / 2, y0 + 54, 18, '#ffffff', 'center', true);
      }
      abilityRects.push({ x, y: y0 + 14, w: bw, h: 66, id: ability.id });
      x += bw + gap;
    }
    text('Click a junction to SWITCH it · Click a foe to SHOO it · 1-6 abilities · P pause · M mute', 14, y0 + 94, 13, '#cfe3ff', 'left');
    drawMinimap(state);
  }

  function drawMinimap(state) {
    const mx = 1052;
    const my = FIELD.height - BOTTOM_BAR + 12;
    const mw = 214;
    const mh = 74;
    context.fillStyle = '#eaf6ff';
    roundRect(context, mx, my, mw, mh, 6);
    context.fill();
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 1.5;
    context.stroke();
    const sx = (v) => mx + 8 + (v / 1280) * (mw - 16);
    const sy = (v) => my + 8 + ((v - 64) / 636) * (mh - 16);
    // Track schematic.
    context.strokeStyle = '#7a5230';
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(sx(150), sy(MAIN_Y));
    context.lineTo(sx(1130), sy(MAIN_Y));
    context.stroke();
    context.lineWidth = 2;
    for (const j of JUNCTIONS) {
      context.beginPath();
      context.moveTo(sx(j.x), sy(MAIN_Y));
      context.lineTo(sx(j.x), sy(STATION_TOP_Y));
      context.moveTo(sx(j.x), sy(MAIN_Y));
      context.lineTo(sx(j.x), sy(STATION_BOT_Y));
      context.stroke();
    }
    // Furnace dot.
    context.fillStyle = '#ff7a1a';
    context.beginPath();
    context.arc(sx(FURNACE.x), sy(FURNACE.y), 6, 0, Math.PI * 2);
    context.fill();
    // Trains.
    for (const train of state.trains) {
      const pos = trainPosition(state.trackRef, train);
      context.fillStyle = train.colour;
      context.strokeStyle = '#ffffff';
      context.lineWidth = 1.5;
      context.beginPath();
      context.arc(sx(pos.x), sy(pos.y), 5, 0, Math.PI * 2);
      context.fill();
      context.stroke();
    }
    // The Maw.
    if (state.boss.active) {
      context.fillStyle = '#c21414';
      context.beginPath();
      context.arc(sx(state.boss.x), sy(MAIN_Y), 6, 0, Math.PI * 2);
      context.fill();
    }
    text('MAP', mx + 6, my + 12, 10, PALETTE.inkDim, 'left', true);
  }

  // ---- screens ------------------------------------------------------------

  function drawPanel(title, lines, prompt, accent) {
    const width = 640;
    const height = 150 + lines.length * 32 + 70;
    const x = (FIELD.width - width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = 'rgba(29,58,95,0.55)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    context.fillStyle = PALETTE.panel;
    roundRect(context, x, y, width, height, 12);
    context.fill();
    context.strokeStyle = accent ?? PALETTE.panelEdge;
    context.lineWidth = 3;
    context.stroke();
    text(title, FIELD.width / 2, y + 66, 44, PALETTE.ink, 'center', true);
    for (let i = 0; i < lines.length; i += 1) {
      text(lines[i], FIELD.width / 2, y + 116 + i * 32, 20, PALETTE.inkSoft, 'center');
    }
    text(prompt, FIELD.width / 2, y + height - 30, 20, '#2f6fd6', 'center', true);
  }

  function drawTitle(state, best) {
    // A train rolls across the valley behind the title.
    drawSky(state);
    drawTrack(state.trackRef);
    for (const s of STATIONS) drawStation(s);
    drawFurnace(state);
    for (let i = 0; i < 3; i += 1) drawJunction(state, i);
    for (const train of state.trains) drawTrain(state.trackRef, train, state);
    // Title banner.
    const width = 780;
    const height = 330;
    const x = (FIELD.width - width) / 2;
    const y = 150;
    context.fillStyle = 'rgba(255,248,230,0.94)';
    roundRect(context, x, y, width, height, 16);
    context.fill();
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 4;
    context.stroke();
    text('🚂 IRONWHISTLE', 640, y + 78, 58, '#1d3a5f', 'center', true);
    text('Switch the rails, keep the furnace fed, outrun the Iron Maw.', 640, y + 122, 20, PALETTE.inkSoft, 'center');
    text('Click a junction to switch the rails. Send each train to its station.', 640, y + 168, 18, PALETTE.ink, 'center');
    text('Click foes to shoo them. Feed the furnace with coal. 7 runs. Break the Maw.', 640, y + 196, 18, PALETTE.ink, 'center');
    text(`WIN finish 7 runs & break the Iron Maw  ·  LOSE furnace hits 0 or 16 cargo lost`, 640, y + 228, 16, '#c21414', 'center', true);
    text(`Best score ${best}`, 640, y + 262, 18, PALETTE.gold, 'center', true);
    text('Press Enter to run the line', 640, y + 302, 22, '#2f6fd6', 'center', true);
  }

  function drawLevelUp(state) {
    cards.length = 0;
    context.fillStyle = 'rgba(29,58,95,0.55)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    text('LEVEL UP!', 640, 170, 48, '#ffffff', 'center', true);
    text(`Level ${state.level} — pick one`, 640, 208, 22, '#ffe9a8', 'center');
    const cw = 260;
    const ch = 220;
    const gap = 30;
    const total = cw * 3 + gap * 2;
    let x = (FIELD.width - total) / 2;
    const y = 250;
    for (let i = 0; i < state.choices.length; i += 1) {
      const c = state.choices[i];
      context.fillStyle = PALETTE.panel;
      roundRect(context, x, y, cw, ch, 12);
      context.fill();
      context.strokeStyle = PALETTE.gold;
      context.lineWidth = 3;
      context.stroke();
      text(`[${i + 1}]`, x + cw / 2, y + 34, 16, PALETTE.inkDim, 'center', true);
      text(c.icon, x + cw / 2, y + 96, 44, PALETTE.ink, 'center');
      text(c.name, x + cw / 2, y + 140, 20, PALETTE.ink, 'center', true);
      // Wrap the card text to two lines.
      const words = c.text.split(' ');
      let line = '';
      const lines = [];
      for (const w of words) {
        if ((line + ' ' + w).trim().length > 26) {
          lines.push(line.trim());
          line = w;
        } else line += ' ' + w;
      }
      lines.push(line.trim());
      for (let li = 0; li < lines.length; li += 1) {
        text(lines[li], x + cw / 2, y + 172 + li * 22, 15, PALETTE.inkSoft, 'center');
      }
      cards.push({ x, y, w: cw, h: ch });
      x += cw + gap;
    }
    text('Click a card or press 1-3', 640, y + ch + 44, 20, '#ffffff', 'center', true);
  }

  function drawOver(state, best) {
    const reason = state.heat <= 0 ? 'The furnace went cold.' : 'Sixteen cargoes were lost.';
    drawPanel('THE LINE IS LOST', [reason, `Score ${state.score}  ·  Best ${best}`, `Runs held ${state.run - 1}/7  ·  Cargo delivered ${state.cargoDelivered}`], 'Press Enter or R to run the line again', '#c21414');
  }

  function drawWin(state, best) {
    const lines = [
      'ALL ABOARD — THE LINE IS COMPLETE',
      `7/7 runs  ·  Score ${state.score}  ·  Best ${best}`,
      `Cargo delivered ${state.cargoDelivered}  ·  Lost ${state.cargoLost}  ·  Late ${state.cargoLate}`,
      `Best chain x${state.bestChain}  ·  Tickets ${state.tickets}  ·  Level ${state.level}`,
      'The Iron Maw is scrap. The valley sings again.',
    ];
    const width = 760;
    const height = 150 + lines.length * 32 + 80;
    const x = (FIELD.width - width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = 'rgba(29,58,95,0.55)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    context.fillStyle = PALETTE.panel;
    roundRect(context, x, y, width, height, 16);
    context.fill();
    context.strokeStyle = PALETTE.gold;
    context.lineWidth = 4;
    context.stroke();
    text('🏆 ' + lines[0], FIELD.width / 2, y + 66, 30, '#1d3a5f', 'center', true);
    for (let i = 1; i < lines.length; i += 1) {
      text(lines[i], FIELD.width / 2, y + 116 + (i - 1) * 32, 20, PALETTE.inkSoft, 'center');
    }
    text('Press R to run the line again', FIELD.width / 2, y + height - 30, 22, '#2f6fd6', 'center', true);
  }

  /** Paint one frame: the valley, then the HUD, panels and the screen overlay. */
  function draw(state, screen, best, muted, musicOn, selectedAbility) {
    void muted;
    void musicOn;
    void selectedAbility;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.skyBottom;
    context.fillRect(0, 0, canvas.width, canvas.height);
    const shakeX = state.shake > 0 ? Math.sin(state.elapsed * 90) * 6 : 0;
    const shakeY = state.shake > 0 ? Math.cos(state.elapsed * 77) * 4 : 0;
    context.setTransform(view.scale, 0, 0, view.scale, view.x + shakeX * view.scale, view.y + shakeY * view.scale);
    state.trackRef = state.trackRef ?? null;
    if (screen === SCREEN_TITLE) {
      drawTitle(state, best);
      return;
    }
    drawSky(state);
    drawTrack(state.trackRef);
    for (const s of STATIONS) drawStation(s);
    drawFurnace(state);
    for (const b of state.blockers) drawBlocker(b);
    for (let i = 0; i < 3; i += 1) drawJunction(state, i);
    for (const e of state.enemies) drawEnemy(e);
    for (const train of state.trains) drawTrain(state.trackRef, train, state);
    drawBoss(state);
    drawFloaters(state);
    drawTopBar(state);
    drawLeftPanel(state, state.incoming);
    drawRightPanel(state);
    drawBottomBar(state);
    if (screen === SCREEN_LEVELUP) drawLevelUp(state);
    else if (screen === SCREEN_PAUSED) drawPanel('Paused', ['The trains will wait for you.'], 'Press P to resume');
    else if (screen === SCREEN_OVER) drawOver(state, best);
    else if (screen === SCREEN_WIN) drawWin(state, best);
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, toLogical, cards, abilityRects };
}

// The track graph and the trains that run on it.
//
// The valley's rails are a fixed graph of straight segments. A train rides
// one segment at a time; when it reaches a segment's end it asks the node
// what comes next. At a junction the answer is the junction's switch:
// straight stays on the main line, up climbs to the hill station, down
// drops to the riverside station. At a station the cargo is judged; at the
// far end of the line it is lost. Nothing here knows about score or coal —
// it reports what happened and the world scores it.

import { JUNCTIONS, MAIN_Y, STATIONS, STATION_BOT_Y, STATION_TOP_Y } from './config.js';

/** Node ids: spawn, one junction per x, one station per id, and the far end. */
export const NODE_SPAWN = 'spawn';
export const NODE_END = 'end';

/** A segment: a straight run of rail from one node to the next. */
function segment(id, from, to, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return { id, from, to, x1, y1, x2, y2, len: Math.hypot(dx, dy), ux: dx / Math.hypot(dx, dy), uy: dy / Math.hypot(dx, dy) };
}

/** The whole network, built once. Main line west to east, six branches. */
export function buildTrack() {
  const segs = [];
  const byId = {};
  function add(seg) {
    segs.push(seg);
    byId[seg.id] = seg;
  }
  add(segment('spawn-j1', NODE_SPAWN, 'j1', -80, MAIN_Y, JUNCTIONS[0].x, MAIN_Y));
  add(segment('j1-j2', 'j1', 'j2', JUNCTIONS[0].x, MAIN_Y, JUNCTIONS[1].x, MAIN_Y));
  add(segment('j2-j3', 'j2', 'j3', JUNCTIONS[1].x, MAIN_Y, JUNCTIONS[2].x, MAIN_Y));
  add(segment('j3-end', 'j3', NODE_END, JUNCTIONS[2].x, MAIN_Y, 1360, MAIN_Y));
  for (let i = 0; i < 3; i += 1) {
    const j = JUNCTIONS[i];
    const up = STATIONS[i];
    const down = STATIONS[i + 3];
    add(segment(`j${i + 1}-up`, `j${i + 1}`, up.id, j.x, MAIN_Y, up.x, STATION_TOP_Y + 46));
    add(segment(`j${i + 1}-down`, `j${i + 1}`, down.id, j.x, MAIN_Y, down.x, STATION_BOT_Y - 46));
  }
  return { segs, byId };
}

/** Where a node sits, for drawing and for routing. */
export function nodePosition(node) {
  if (node === NODE_SPAWN) return { x: -80, y: MAIN_Y };
  if (node === NODE_END) return { x: 1360, y: MAIN_Y };
  if (node === 'j1' || node === 'j2' || node === 'j3') {
    const i = Number(node[1]) - 1;
    return { x: JUNCTIONS[i].x, y: MAIN_Y };
  }
  const station = STATIONS.find((s) => s.id === node);
  if (station) return { x: station.x, y: station.y + (station.side === 'up' ? 46 : -46) };
  return { x: 640, y: MAIN_Y };
}

/**
 * The next segment out of a junction node, from the switch state:
 * 'straight' stays on the main line, 'up'/'down' take the branch.
 */
export function junctionNext(junctionIndex, state) {
  if (state === 'up') return `j${junctionIndex + 1}-up`;
  if (state === 'down') return `j${junctionIndex + 1}-down`;
  if (junctionIndex === 0) return 'j1-j2';
  if (junctionIndex === 1) return 'j2-j3';
  return 'j3-end';
}

/** A train: a loco and two wagons riding one segment, heading for one station. */
export function makeTrain(id, dest, speed, windowSeconds) {
  const station = STATIONS.find((s) => s.id === dest);
  return {
    id,
    dest,
    colour: station.colour,
    dark: station.dark,
    name: station.name,
    seg: 'spawn-j1',
    dist: 0,
    speed,
    baseSpeed: speed,
    age: 0,
    window: windowSeconds,
    state: 'running',
    held: 0,
    blocked: false,
    savedByHorseshoe: false,
  };
}

/** Position and heading of a train on its segment. */
export function trainPosition(track, train) {
  const seg = track.byId[train.seg];
  return {
    x: seg.x1 + seg.ux * train.dist,
    y: seg.y1 + seg.uy * train.dist,
    angle: Math.atan2(seg.uy, seg.ux),
  };
}

/**
 * Advance one train a step. Returns 'station' when it arrives at its
 * segment's end node (the caller judges the cargo), 'end' when it rolls off
 * the far end, or null while it is still riding. A rockfall ahead holds it.
 */
export function stepTrain(track, train, dt, blockers, brake) {
  if (train.state !== 'running') return null;
  train.age += dt;
  if (brake > 0) {
    train.held = Math.max(train.held, brake);
    return null;
  }
  if (train.held > 0) {
    train.held -= dt;
    return null;
  }
  const seg = track.byId[train.seg];
  // A rockfall on this segment, just ahead, stops the train in its tracks.
  train.blocked = false;
  for (const block of blockers) {
    if (block.seg === train.seg && block.dist > train.dist && block.dist - train.dist < 46) {
      train.blocked = true;
      return null;
    }
  }
  train.dist += train.speed * dt;
  if (train.dist < seg.len) return null;
  const over = train.dist - seg.len;
  const node = seg.to;
  if (node === NODE_END) {
    train.state = 'lost';
    return 'end';
  }
  const station = STATIONS.find((s) => s.id === node);
  if (station) {
    train.state = 'arrived';
    return 'station';
  }
  // A junction node is never a terminus: the switch decides the next rail.
  return { junction: node, over };
}

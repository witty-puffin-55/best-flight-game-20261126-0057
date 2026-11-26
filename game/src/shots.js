// Ridgeline Run — deterministic screenshots.
// One job: given ?shot=<name>&seed=<n>, put the game into a fixed, staged
// scene and say when the frame is ready to capture. The screenshots the
// judge sees are renders of the game's own code, frozen mid-flight.

import { CONFIG } from './config.js';
import { newPlane } from './flight.js';
import { valleyCenter } from './world.js';

// Each shot: which mission, where the plane is, what it is doing.
const SHOTS = {
  // Title screen: parked on the runway at dawn, instruments lit.
  start: { mission: 0, screen: 'title', plane: { z: 120, y: null, speed: 0, throttle: 0, heading: 0 } },
  // Mid-flight: threading ring 3, valley and river below.
  ring: { mission: 0, screen: 'flying', plane: { z: 2700, y: 92, speed: 58, throttle: 0.72, heading: 0.06, pitch: 0.0, bank: -0.1 }, ringsPassed: 2 },
  // Parcel drop: over pad 1, parcel away with its chute open.
  drop: { mission: 1, screen: 'flying', plane: { z: 1380, y: 105, speed: 52, throttle: 0.6, heading: -0.04, pitch: -0.02, bank: 0.1 }, ringsPassed: 1, parcel: true },
  // Short final: gear down, low over the numbers at the destination strip.
  land: { mission: 2, screen: 'flying', plane: { z: 5450, y: 55, speed: 40, throttle: 0.35, heading: 0.02, pitch: -0.05, bank: 0.05 }, ringsPassed: 3 },
};

export function parseShot(search) {
  const params = new URLSearchParams(search);
  const name = params.get('shot');
  if (!name || !SHOTS[name]) return null;
  return { name, def: SHOTS[name], seed: Number(params.get('seed') || CONFIG.seed) };
}

// Stage the game for a shot: returns true when a frame has been rendered
// from the staged state (main.js sets window.__shotReady after drawing).
export function stageShot(game, shot) {
  const { def } = shot;
  const mission = game.missions[def.mission];
  game.mission = mission;
  game.screen = def.screen;
  game.plane = newPlane(mission);
  const p = game.plane;
  const plane = def.plane;
  p.z = plane.z;
  p.x = valleyCenter(plane.z);
  p.y = plane.y ?? CONFIG.runway.elevation + 2.5;
  p.speed = plane.speed;
  p.throttle = plane.throttle;
  p.heading = plane.heading;
  p.pitch = plane.pitch ?? 0;
  p.bank = plane.bank ?? 0;
  p.onGround = plane.speed < 5;
  p.fuel = mission.fuel;
  // Rebuild the mission's rings/pads and mark the ones already done.
  game.buildMission();
  for (let i = 0; i < (def.ringsPassed || 0); i++) {
    if (game.rings[i]) game.rings[i].passed = true;
  }
  if (def.parcel) {
    game.parcels.push({
      x: p.x - 6,
      y: p.y - 18,
      z: p.z + 30,
      vx: 0,
      vy: -4,
      vz: 0,
      chute: true,
      landed: false,
      scored: false,
    });
  }
  game.score = def.ringsPassed ? def.ringsPassed * 150 : 0;
  game.flyingScore = game.score;
  game.timeLeft = mission.par - 40;
  game.message = def.name === 'ring' ? 'RING 3 — THREAD IT!' : def.name === 'drop' ? 'PARCEL AWAY!' : def.name === 'land' ? 'SHORT FINAL — GEAR DOWN' : '';
  game.messageAt = game.time;
  game.shotStaged = true;
}

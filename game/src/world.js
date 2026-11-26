// Ridgeline Run — the valley itself.
// One job: answer "what is the world at (x, z)?" — ground height, where the
// river runs, where the rings hang, where the pads sit, where the trees grow.
// The flight model and the renderer both ask this module, never each other.

import { CONFIG } from './config.js';
import { fbm, hash2 } from './random.js';

const { seed } = CONFIG;

// The valley winds: its centreline wanders east and west as z grows.
export function valleyCenter(z) {
  return 180 * Math.sin(z * 0.0006) + 90 * Math.sin(z * 0.0017 + 1.3);
}

// Ground height in metres. Valley floor near the centreline, mountains
// rising steeply either side, plus rolling detail everywhere.
export function groundHeight(x, z) {
  const cx = valleyCenter(z);
  const d = Math.abs(x - cx);

  // Rolling detail, ~0..1.
  const detail = fbm(x * 0.004, z * 0.004, seed);

  // Valley floor: gentle, 20-30 m, with the river carving the middle.
  const floor = 22 + detail * 9;
  const riverDip = 3.5 * Math.exp(-((d / 26) ** 2));

  // Mountains: flat until the valley wall, then climbing fast.
  const wall = smoothstep(130, 950, d);
  const mountain = wall * (240 + fbm(x * 0.0016 + 40, z * 0.0016, seed + 5) * 210);

  let h = floor - riverDip + mountain;

  // Flatten both landing strips so a landing is actually possible.
  for (const strip of [CONFIG.runway, CONFIG.destination]) {
    const r = strip;
    if (z > r.z0 - 90 && z < r.z1 + 90) {
      const dx = Math.abs(x - valleyCenter(z));
      const dz = Math.max(0, Math.max(r.z0 - z, z - r.z1));
      const blend = smoothstep(0, 110, dx + dz * 0.9);
      h = r.elevation * (1 - blend) + h * blend;
    }
  }
  return h;
}

function smoothstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

export function isWater(x, z) {
  const d = Math.abs(x - valleyCenter(z));
  return d < 15 && groundHeight(x, z) < 24.5;
}

// Rings hang over the valley, one per leg of the course.
export function ringPositions(count) {
  const rings = [];
  for (let i = 0; i < count; i++) {
    const z = 750 + i * ((CONFIG.valleyLength - 1500) / Math.max(1, count - 1 || 1));
    const x = valleyCenter(z);
    const y = 105 + 55 * Math.sin(i * 1.7 + 0.6);
    rings.push({ x, y, z, radius: 26, passed: false });
  }
  return rings;
}

// Parcel pads: flat clearings with a painted target circle.
export function padPositions(count) {
  const pads = [];
  for (let i = 0; i < count; i++) {
    const z = 1400 + i * 1700;
    const x = valleyCenter(z) + (i % 2 === 0 ? 60 : -60);
    pads.push({ x, y: groundHeight(x, z), z, radius: 30, done: false });
  }
  return pads;
}

// Trees: deterministic per grid cell, only where the ground is low enough.
export function treesNear(x0, z0, x1, z1) {
  const trees = [];
  const cell = 34;
  const ix0 = Math.floor(x0 / cell);
  const ix1 = Math.floor(x1 / cell);
  const iz0 = Math.floor(z0 / cell);
  const iz1 = Math.floor(z1 / cell);
  for (let ix = ix0; ix <= ix1; ix++) {
    for (let iz = iz0; iz <= iz1; iz++) {
      const r = hash2(ix, iz, seed + 77);
      if (r > 0.42) continue; // about 42% of cells hold a tree
      const x = ix * cell + hash2(ix, iz, seed + 78) * cell;
      const z = iz * cell + hash2(ix, iz, seed + 79) * cell;
      const h = groundHeight(x, z);
      if (h > 95) continue; // trees stay on the valley floor and low slopes
      if (isWater(x, z)) continue;
      const s = 7 + hash2(ix, iz, seed + 80) * 9;
      trees.push({ x, y: h, z, size: s });
    }
  }
  return trees;
}

// Clouds: a fixed flock, drifting slowly with the wind.
export function cloudPositions(time) {
  const clouds = [];
  for (let i = 0; i < 26; i++) {
    const baseX = (hash2(i, 3, seed + 91) - 0.5) * 5200;
    const z = hash2(i, 7, seed + 92) * CONFIG.valleyLength;
    const y = 330 + hash2(i, 11, seed + 93) * 160;
    const s = 90 + hash2(i, 13, seed + 94) * 170;
    clouds.push({ x: baseX + time * 2.2, y, z, size: s });
  }
  return clouds;
}

// A parcel falling with a little parachute, for the drop mission.
export function makeParcel(x, y, z, vx, vz) {
  return { x, y, z, vx, vy: 0, vz, chute: false, landed: false, scored: false };
}

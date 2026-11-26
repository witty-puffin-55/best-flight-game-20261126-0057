// Ridgeline Run — deterministic randomness.
// One job: every random choice in the game comes from a seeded generator, so
// the same seed always builds the same valley, the same rings and the same
// screenshots. Nothing here ever calls Math.random.

// mulberry32: small, fast, good enough for terrain.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Hash two integer grid coordinates to a stable 0..1 value.
export function hash2(ix, iz, seed) {
  let h = (ix * 374761393 + iz * 668265263 + seed * 974634211) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 4294967296;
}

function smooth(t) {
  return t * t * (3 - 2 * t);
}

// 2D value noise: smooth interpolation of hashed grid corners.
export function valueNoise(x, z, seed) {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const a = hash2(ix, iz, seed);
  const b = hash2(ix + 1, iz, seed);
  const c = hash2(ix, iz + 1, seed);
  const d = hash2(ix + 1, iz + 1, seed);
  const u = smooth(fx);
  const v = smooth(fz);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

// Fractal noise: three octaves of value noise, roughly 0..1.
export function fbm(x, z, seed) {
  return (
    valueNoise(x, z, seed) * 0.55 +
    valueNoise(x * 2.13 + 7.7, z * 2.13 + 3.1, seed + 11) * 0.3 +
    valueNoise(x * 4.31 + 13.7, z * 4.31 + 9.4, seed + 23) * 0.15
  );
}

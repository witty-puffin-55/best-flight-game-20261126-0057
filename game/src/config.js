// Ridgeline Run — tuning constants, mission definitions and palette.
// One job: every number the game balances on lives here, so tuning never
// means hunting through the renderer or the flight model.

export const CONFIG = {
  // World
  seed: 1337,
  valleyLength: 6400, // metres of flyable valley, z = 0 .. valleyLength
  valleyHalfWidth: 520, // terrain drawn this far either side of the camera
  cellSize: 24, // terrain grid cell, metres
  viewDistance: 760, // how far ahead terrain is drawn, metres
  gravity: 9.81,

  // Aircraft (a bush plane: forgiving, but it still stalls)
  cruiseSpeed: 62, // m/s, the speed the throttle naturally holds
  maxSpeed: 88,
  minFlySpeed: 26, // below this the wing stops flying and she sinks
  stallSpeed: 30,
  maxThrottle: 1,
  throttleRate: 0.55, // per second
  pitchRate: 0.85, // rad/s at full stick
  bankRate: 1.5, // rad/s at full stick
  turnRate: 0.55, // rad/s of heading per rad of bank, scaled by speed
  climbFactor: 0.9,
  fuelCapacity: 100,
  fuelBurn: 1.35, // per second at full throttle (about 75 s of full power)
  damagePerScrape: 34,
  crashVerticalSpeed: 9, // m/s down onto terrain = crash, gentler = hard landing

  // Runway (flat strip near the valley mouth)
  runway: { z0: 60, z1: 460, halfWidth: 15, elevation: 24 },
  // Destination strip at the far end of the valley: every sortie ends here.
  destination: { z0: 5950, z1: 6350, halfWidth: 15, elevation: 24 },

  // Scoring
  ringScore: 150,
  padScore: 200,
  landingBonus: 400,
  timeParSeconds: 150,
};

// Missions: three sorties with different goals, so flying rewards different
// discipline each time. Rings and pads are placed along the valley by world.js.
export const MISSIONS = [
  {
    id: 'rings',
    name: 'Ring Run',
    short: 'RINGS',
    briefing: 'Thread all 8 rings down the valley, then put her down on the strip.',
    rings: 8,
    pads: 0,
    fuel: 100,
    wind: 0,
    par: 150,
  },
  {
    id: 'parcels',
    name: 'Parcel Drop',
    short: 'PARCELS',
    briefing: 'Drop a parcel on each of the 3 pads (B when overhead, below 90 m), then land.',
    rings: 3,
    pads: 3,
    fuel: 100,
    wind: 2,
    par: 210,
  },
  {
    id: 'storm',
    name: 'Storm Landing',
    short: 'STORM',
    briefing: 'Low fuel, gusting crosswind. One shot at the strip — make it count.',
    rings: 4,
    pads: 0,
    fuel: 42,
    wind: 9,
    par: 120,
  },
];

// One visual style for the whole game: dusk gold over a green valley.
export const PALETTE = {
  skyTop: '#1d3a5f',
  skyMid: '#7fa8c9',
  skyLow: '#f2b879',
  sun: '#ffd9a0',
  sunCore: '#fff3d6',
  grassLow: '#4d7a3a',
  grassHigh: '#6d9a4a',
  rock: '#7a6a58',
  rockDark: '#5d5044',
  snow: '#eef2f5',
  water: '#3f7fae',
  waterDeep: '#2c5f86',
  runway: '#3c3f45',
  runwayLine: '#e8e4d8',
  ring: '#ffb02e',
  ringGlow: 'rgba(255,176,46,0.35)',
  planeBody: '#e8542f',
  planeTrim: '#f6ead8',
  planeDark: '#7c2d12',
  hudAmber: '#ffb02e',
  hudGreen: '#7ee787',
  hudRed: '#ff6b5e',
  panel: 'rgba(10,14,20,0.82)',
  panelEdge: '#2c3644',
};

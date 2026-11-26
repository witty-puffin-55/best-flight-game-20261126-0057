// Ridgeline Run — the game itself: loop, screens, missions and scoring.
// One job: own the state machine (title → flying → paused → complete /
// crashed), run the flight model each frame, score rings, drops and
// landings, and hand the renderer and HUD one frame at a time.

import { CONFIG, MISSIONS } from './config.js';
import { newPlane, stepFlight, ringPass, isOnRunway } from './flight.js';
import { ringPositions, padPositions, groundHeight, makeParcel } from './world.js';
import { render } from './render.js';
import { drawHUD, drawOverlay } from './hud.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { parseShot, stageShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

export function createGame() {
  const game = {
    missions: MISSIONS,
    mission: MISSIONS[0],
    plane: newPlane(MISSIONS[0]),
    rings: [],
    pads: [],
    parcels: [],
    screen: 'title',
    score: 0,
    flyingScore: 0,
    landingBonus: 0,
    time: 0,
    timeLeft: MISSIONS[0].par,
    message: '',
    messageAt: -10,
    shotStaged: false,
    muted: false,
    dropsLeft: 0,
    input: createInput(canvas),
    audio: createAudio(),
  };

  game.buildMission = function buildMission() {
    const m = game.mission;
    game.rings = ringPositions(m.rings);
    game.pads = padPositions(m.pads);
    game.parcels = [];
    game.dropsLeft = m.pads;
    game.score = 0;
    game.flyingScore = 0;
    game.landingBonus = 0;
    game.timeLeft = m.par;
  };

  game.startMission = function startMission(index) {
    game.mission = game.missions[index] || game.missions[0];
    game.plane = newPlane(game.mission);
    game.buildMission();
    game.screen = 'flying';
    game.setMessage(`${game.mission.name} — ${game.mission.briefing}`);
    game.audio.unlock();
    game.audio.click();
  };

  game.setMessage = function setMessage(text) {
    game.message = text;
    game.messageAt = game.time;
  };

  game.restart = function restart() {
    game.plane = newPlane(game.mission);
    game.buildMission();
    game.screen = 'flying';
    game.setMessage('Again — same valley, cleaner lines.');
  };

  // Score a ring pass, a parcel drop, and the landing itself.
  game.checkObjectives = function checkObjectives(dt) {
    const p = game.plane;
    for (const ring of game.rings) {
      if (!ring.passed && ringPass(p, ring)) {
        ring.passed = true;
        game.score += CONFIG.ringScore;
        game.flyingScore += CONFIG.ringScore;
        game.audio.chime();
        const left = game.rings.filter((r) => !r.passed).length;
        game.setMessage(left > 0 ? `RING! ${left} to go` : 'ALL RINGS — NOW LAND HER!');
      }
    }
    // Parcels fall, open their chutes below 90 m, and score on the pad.
    for (const parcel of game.parcels) {
      if (parcel.landed) continue;
      parcel.vy -= 9.8 * dt;
      if (parcel.y < 90 && !parcel.chute) parcel.chute = true;
      if (parcel.chute) parcel.vy = Math.max(parcel.vy, -6);
      parcel.y += parcel.vy * dt;
      parcel.x += parcel.vx * dt;
      parcel.z += parcel.vz * dt;
      const ground = groundHeight(parcel.x, parcel.z);
      if (parcel.y <= ground + 0.5) {
        parcel.y = ground + 0.5;
        parcel.landed = true;
        let hitPad = false;
        for (const pad of game.pads) {
          if (pad.done) continue;
          const dx = parcel.x - pad.x;
          const dz = parcel.z - pad.z;
          if (Math.hypot(dx, dz) < pad.radius) {
            pad.done = true;
            hitPad = true;
            parcel.scored = true;
            game.score += CONFIG.padScore;
            game.flyingScore += CONFIG.padScore;
            game.audio.chime();
            game.setMessage('PARCEL ON THE PAD! +200');
          }
        }
        if (!hitPad) game.setMessage('Parcel down — off the mark. The pad is circled H.');
      }
    }
    // Landing completes the sortie once the plane has rolled to a stop.
    if (p.landed && game.screen === 'flying') {
      const ringsDone = game.rings.every((r) => r.passed);
      const padsDone = game.pads.every((r) => r.done);
      if (ringsDone && padsDone) {
        game.landingBonus = CONFIG.landingBonus + Math.round(p.fuel * 2) + Math.max(0, Math.round(game.timeLeft));
        game.score += game.landingBonus;
        game.screen = 'complete';
        game.audio.chime();
      } else {
        p.landed = false;
        p.crashed = true;
        p.crashReason = 'Landed early — the sortie is not done until every ring is flown and every parcel is down.';
        game.screen = 'crashed';
        game.audio.thud();
      }
    }
    if (p.crashed && game.screen === 'flying') {
      game.screen = 'crashed';
      game.audio.thud();
    }
    if (p.fuel <= 0 && !p.onGround && game.screen === 'flying') {
      game.setMessage('FUEL EMPTY — GLIDING. Find the strip!');
    }
  };

  game.dropParcel = function dropParcel() {
    if (game.screen !== 'flying' || game.dropsLeft <= 0) return;
    const p = game.plane;
    if (p.onGround) return;
    game.dropsLeft -= 1;
    game.parcels.push(makeParcel(p.x, p.y - 4, p.z + 4, 0, p.speed));
    game.audio.drop();
    game.setMessage(`Parcel away! ${game.dropsLeft} left.`);
  };

  return game;
}

const game = createGame();
game.buildMission();

// A staged screenshot (?shot=...) freezes the game in one posed frame.
const shot = parseShot(window.location.search);
if (shot) {
  stageShot(game, shot);
  // Keep the sim still: render the staged frame a few times, then signal.
  let frames = 0;
  const renderShot = () => {
    resize();
    render(ctx, canvas.width, canvas.height, game, 12.5);
    drawHUD(ctx, canvas.width, canvas.height, game);
    if (game.screen === 'title') drawOverlay(ctx, canvas.width, canvas.height, game);
    frames += 1;
    if (frames < 3) requestAnimationFrame(renderShot);
    else window.__shotReady = true;
  };
  requestAnimationFrame(renderShot);
}

function resize() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = window.innerWidth;
  const h = window.innerHeight;
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { w, h };
}

// Exposed for the smoke test and the screenshot runner: state, not a cheat.
window.__game = {
  screen: () => game.screen,
  state: () => ({
    score: game.score,
    fuel: Math.round(game.plane.fuel),
    speed: Math.round(game.plane.speed),
    altitude: Math.round(game.plane.y),
    heading: Math.round(((game.plane.heading * 180) / Math.PI % 360 + 360) % 360),
    ringsPassed: game.rings.filter((r) => r.passed).length,
    ringsTotal: game.rings.length,
    crashed: game.plane.crashed,
    landed: game.plane.landed,
  }),
};

let last = performance.now();

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  game.time += dt;
  const { w, h } = resize();

  // Edge-triggered actions.
  const input = game.input;
  if (input.consume('muteQueued')) game.muted = game.audio.toggleMute();
  if (input.consume('restartQueued') && game.screen !== 'title') game.restart();
  if (input.consume('pauseQueued') && (game.screen === 'flying' || game.screen === 'paused')) {
    game.screen = game.screen === 'flying' ? 'paused' : 'flying';
    game.audio.click();
  }
  const missionPick = input.consume('missionQueued');
  if (missionPick >= 0) {
    if (game.screen === 'title') game.startMission(missionPick);
    else if (game.screen === 'complete' || game.screen === 'crashed') game.startMission(missionPick);
  }
  if (input.consume('dropQueued')) game.dropParcel();
  if (input.anyKey) game.audio.unlock();

  if (game.screen === 'flying') {
    const stick = input.read();
    stepFlight(game.plane, stick, dt, game.mission.wind, game.time);
    game.timeLeft = Math.max(0, game.timeLeft - dt);
    game.checkObjectives(dt);
    game.audio.update(game.plane, true);
  } else {
    game.audio.update(game.plane, false);
  }

  render(ctx, w, h, game, game.time);
  drawHUD(ctx, w, h, game);
  if (game.screen !== 'flying') drawOverlay(ctx, w, h, game);
  requestAnimationFrame(frame);
}

if (!shot) requestAnimationFrame(frame);

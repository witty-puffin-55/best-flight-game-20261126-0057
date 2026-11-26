// Ridgeline Run — how the bush plane flies.
// One job: the flight model. Throttle, pitch, bank, speed, lift, stall, fuel,
// wind and damage live here; the renderer only draws what this module says.

import { CONFIG } from './config.js';
import { groundHeight, valleyCenter } from './world.js';

export function newPlane(mission) {
  return {
    // Start parked on the runway, facing up the valley.
    x: valleyCenter(120),
    y: CONFIG.runway.elevation + 2.5,
    z: 120,
    heading: 0, // 0 = up the valley (+z)
    pitch: 0, // rad, + = nose up
    bank: 0, // rad, + = right wing down
    speed: 0, // m/s
    throttle: 0,
    fuel: mission.fuel,
    damage: 0,
    gearDown: true,
    verticalSpeed: 0,
    onGround: true,
    crashed: false,
    crashReason: '',
    landed: false,
    windGust: 0,
  };
}

// One physics step. dt seconds, input {pitch, bank, throttle} each -1..1,
// wind in m/s pushing sideways, time for gust variation.
export function stepFlight(plane, input, dt, wind, time) {
  if (plane.crashed || plane.landed) return;

  // Gusts: slow sine wander so the storm mission never feels the same twice.
  plane.windGust = wind * Math.sin(time * 0.7) + wind * 0.5 * Math.sin(time * 1.9 + 2);

  // Throttle moves toward the stick at a fixed spool rate.
  plane.throttle = Math.max(0, Math.min(1, plane.throttle + input.throttle * dt * CONFIG.throttleRate));

  // Fuel burns with throttle; empty tanks mean a glider.
  const burn = plane.throttle * CONFIG.fuelBurn * dt;
  plane.fuel = Math.max(0, plane.fuel - burn);
  const engineOut = plane.fuel <= 0;

  // Speed chases the throttle's target; drag grows with the square of speed.
  const targetSpeed = engineOut ? 0 : plane.throttle * CONFIG.maxSpeed;
  const accel = engineOut ? -6 : 14;
  plane.speed += Math.max(-22 * dt, Math.min(accel * dt, targetSpeed - plane.speed));
  plane.speed = Math.max(0, plane.speed);

  // Stick: pitch and bank ease toward the input, faster when flying.
  const authority = plane.onGround ? 0.25 : 1;
  plane.pitch += (input.pitch * 0.55 - plane.pitch) * Math.min(1, dt * 3.2 * authority);
  plane.bank += (input.bank * 0.9 - plane.bank) * Math.min(1, dt * 3.6 * authority);
  plane.pitch = Math.max(-0.5, Math.min(0.5, plane.pitch));
  plane.bank = Math.max(-1.1, Math.min(1.1, plane.bank));

  // Heading follows the bank; a banked wing turns the nose.
  const turnAuthority = Math.min(1, plane.speed / CONFIG.cruiseSpeed);
  plane.heading += plane.bank * CONFIG.turnRate * turnAuthority * dt;
  // Wind pushes the whole aircraft sideways.
  const windX = Math.cos(plane.heading) * plane.windGust;

  // Lift: climbing needs speed; below stall speed the wing gives up.
  const stalling = plane.speed < CONFIG.stallSpeed && !plane.onGround;
  let climbRate = Math.sin(plane.pitch) * plane.speed * CONFIG.climbFactor;
  if (stalling) climbRate -= (CONFIG.stallSpeed - plane.speed) * 0.55;
  if (plane.onGround && plane.speed < CONFIG.minFlySpeed) climbRate = 0;
  plane.verticalSpeed = climbRate;

  // Move.
  const fx = Math.sin(plane.heading);
  const fz = Math.cos(plane.heading);
  plane.x += (fx * plane.speed + windX) * dt;
  plane.z += fz * plane.speed * dt;
  plane.y += climbRate * dt;

  // Takeoff: fast enough and pitched up and she leaves the ground.
  if (plane.onGround && plane.speed > CONFIG.minFlySpeed && plane.pitch > 0.06) {
    plane.onGround = false;
  }

  // Ground contact.
  const ground = groundHeight(plane.x, plane.z);
  const clearance = plane.y - ground;
  if (clearance <= 0) {
    plane.y = ground;
    const onRunway = isOnRunway(plane.x, plane.z);
    const gentle = Math.abs(plane.verticalSpeed) < CONFIG.crashVerticalSpeed && plane.speed < 70;
    if (onRunway && gentle && plane.gearDown) {
      // A landing: roll out, bleed speed, stop.
      plane.onGround = true;
      plane.pitch = 0;
      plane.bank *= 0.9;
      plane.speed = Math.max(0, plane.speed - 26 * dt);
      plane.verticalSpeed = 0;
      if (plane.speed < 2) plane.landed = true;
    } else if (gentle && plane.speed < 25 && !onRunway) {
      // A rough-field touchdown: survivable, but it costs the airframe.
      plane.onGround = true;
      plane.damage = Math.min(100, plane.damage + 25);
      plane.speed = Math.max(0, plane.speed - 30 * dt);
      plane.verticalSpeed = 0;
      if (plane.speed < 2) {
        plane.crashed = true;
        plane.crashReason = 'Ditched in rough ground — the airframe is bent, the mail is late.';
      }
    } else {
      plane.crashed = true;
      plane.crashReason =
        plane.speed > 70
          ? 'Flew into the mountainside at speed. The valley wins this one.'
          : 'Stalled into the terrain. Keep the speed up and the nose honest.';
      plane.damage = 100;
    }
  }

  // Out of the valley or into the sky's ceiling: turn back, gently.
  if (plane.z > CONFIG.valleyLength + 200) {
    plane.heading += Math.PI * dt * 0.5;
  }
  if (plane.y > 620) {
    plane.y = 620;
    plane.pitch = Math.min(plane.pitch, 0);
  }
}

export function isOnRunway(x, z) {
  for (const strip of [CONFIG.runway, CONFIG.destination]) {
    if (z > strip.z0 && z < strip.z1 && Math.abs(x - valleyCenter(z)) < strip.halfWidth) return true;
  }
  return false;
}

export function runwayCenterX(z = 260) {
  return valleyCenter(z);
}

// Distance from the plane to a ring's centre, and whether it just flew it.
export function ringPass(plane, ring) {
  if (ring.passed) return false;
  const dx = plane.x - ring.x;
  const dy = plane.y - ring.y;
  const dz = plane.z - ring.z;
  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
  // Must cross the ring's plane closely and near its centre.
  if (Math.abs(dz) < 14 && Math.sqrt(dx * dx + dy * dy) < ring.radius) return true;
  return dist < ring.radius * 0.55;
}

// Ridgeline Run — everything the eye sees.
// One job: draw one frame. Sky, sun and far ridges, the terrain grid in
// perspective, river, runway, rings, trees and clouds, the bush plane in
// chase view, then the HUD and the lit instrument panel. No game logic here:
// main.js owns state, flight.js owns physics, this module only draws them.

import { CONFIG, PALETTE } from './config.js';
import { groundHeight, isWater, valleyCenter, treesNear, cloudPositions } from './world.js';
import { fbm } from './random.js';

const TAU = Math.PI * 2;

// Camera basis from heading and a slight downward look.
function cameraBasis(plane) {
  const heading = plane.heading;
  const fx = Math.sin(heading);
  const fz = Math.cos(heading);
  // Camera sits behind and above the plane, looking along the heading.
  const camX = plane.x - fx * 16;
  const camY = plane.y + 4.6;
  const camZ = plane.z - fz * 16;
  const lookX = plane.x + fx * 70;
  const lookY = plane.y - 2.5;
  const lookZ = plane.z + fz * 70;
  let fwdX = lookX - camX;
  let fwdY = lookY - camY;
  let fwdZ = lookZ - camZ;
  const fl = Math.hypot(fwdX, fwdY, fwdZ);
  fwdX /= fl;
  fwdY /= fl;
  fwdZ /= fl;
  // Right = forward x world-up, up = forward x right (right-handed basis).
  let rx = fwdZ;
  let ry = 0;
  let rz = -fwdX;
  const rl = Math.hypot(rx, ry, rz) || 1;
  rx /= rl;
  rz /= rl;
  const ux = fwdY * rz - fwdZ * ry;
  const uy = fwdZ * rx - fwdX * rz;
  const uz = fwdX * ry - fwdY * rx;
  return { x: camX, y: camY, z: camZ, fx: fwdX, fy: fwdY, fz: fwdZ, rx, ry, rz, ux, uy, uz };
}

function makeProjector(cam, w, h) {
  const focal = (h / 2) / Math.tan((68 * Math.PI) / 360);
  const cx = w / 2;
  const cy = h * 0.52;
  return function project(x, y, z) {
    const dx = x - cam.x;
    const dy = y - cam.y;
    const dz = z - cam.z;
    const cz = dx * cam.fx + dy * cam.fy + dz * cam.fz;
    if (cz < 6) return null;
    const px = dx * cam.rx + dy * cam.ry + dz * cam.rz;
    const py = dx * cam.ux + dy * cam.uy + dz * cam.uz;
    return { x: cx + (px / cz) * focal, y: cy - (py / cz) * focal, s: focal / cz };
  };
}

// Terrain colour by height, with slope shading from a height sample.
function terrainColor(x, z, h, groundFn) {
  const slope = Math.abs(groundFn(x + 14, z) - h) + Math.abs(groundFn(x, z + 14) - h);
  const shade = Math.max(0.72, 1 - slope * 0.028);
  let r;
  let g;
  let b;
  if (h < 24.5 && isWater(x, z)) {
    [r, g, b] = h < 22.5 ? [44, 95, 134] : [63, 127, 174];
  } else if (h > 175) {
    [r, g, b] = [238, 242, 245];
  } else if (h > 120) {
    [r, g, b] = [122, 106, 88];
  } else if (h > 70) {
    const t = (h - 70) / 50;
    [r, g, b] = [122 - 40 * t, 106 - 10 * t, 88 + 10 * t];
  } else {
    const t = (h - 20) / 50;
    const n = fbm(x * 0.02, z * 0.02, 4242) * 0.5 + 0.5;
    [r, g, b] = [77 - 18 * t + n * 14, 122 - 22 * t + n * 12, 58 - 8 * t];
  }
  return `rgb(${Math.round(r * shade)},${Math.round(g * shade)},${Math.round(b * shade)})`;
}

function drawSky(ctx, w, h, heading, time) {
  const grad = ctx.createLinearGradient(0, 0, 0, h * 0.62);
  grad.addColorStop(0, PALETTE.skyTop);
  grad.addColorStop(0.55, PALETTE.skyMid);
  grad.addColorStop(1, PALETTE.skyLow);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h * 0.62);
  ctx.fillStyle = PALETTE.skyLow;
  ctx.fillRect(0, h * 0.6, w, h * 0.4);

  // Low sun, west of the valley: a glow the pilot flies toward at dusk.
  const sunAngle = -0.9 - heading; // sun sits off the left shoulder
  const sunX = w * 0.5 + Math.sin(sunAngle) * w * 0.42;
  const sunY = h * 0.34 + Math.sin(time * 0.05) * 2;
  const glow = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, 190);
  glow.addColorStop(0, PALETTE.sunCore);
  glow.addColorStop(0.25, PALETTE.sun);
  glow.addColorStop(1, 'rgba(255,217,160,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(sunX - 200, sunY - 200, 400, 400);
  ctx.fillStyle = PALETTE.sunCore;
  ctx.beginPath();
  ctx.arc(sunX, sunY, 26, 0, TAU);
  ctx.fill();

  // Far ridges: two jagged silhouettes whose shape turns with the heading.
  for (let layer = 0; layer < 2; layer++) {
    const base = h * (0.42 + layer * 0.06);
    const amp = 46 - layer * 16;
    ctx.fillStyle = layer === 0 ? 'rgba(58,74,96,0.85)' : 'rgba(84,102,120,0.9)';
    ctx.beginPath();
    ctx.moveTo(0, h * 0.62);
    for (let x = 0; x <= w; x += 14) {
      const a = heading + (x / w - 0.5) * 1.9 + layer * 2.4;
      const ridge = fbm(a * 3.1, layer * 9.7, 777) * amp;
      ctx.lineTo(x, base - ridge);
    }
    ctx.lineTo(w, h * 0.62);
    ctx.closePath();
    ctx.fill();
  }
}

function drawClouds(ctx, project, time) {
  const clouds = cloudPositions(time);
  ctx.save();
  for (const c of clouds) {
    const p = project(c.x, c.y, c.z);
    if (!p) continue;
    const s = c.size * p.s;
    if (s < 6 || s > 420) continue;
    ctx.fillStyle = 'rgba(255,246,235,0.5)';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, s, s * 0.34, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,246,235,0.35)';
    ctx.beginPath();
    ctx.ellipse(p.x - s * 0.45, p.y + s * 0.08, s * 0.55, s * 0.26, 0, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

function drawTerrain(ctx, project, cam, plane, groundFn) {
  const step = CONFIG.cellSize;
  const depth0 = 30;
  const depth1 = CONFIG.viewDistance;
  const half = CONFIG.valleyHalfWidth;
  const rows = Math.floor((depth1 - depth0) / step);
  const cols = Math.floor((half * 2) / step);
  // Precompute grid vertices in camera space, then paint far rows first.
  const verts = [];
  for (let ri = 0; ri <= rows; ri++) {
    const d = depth0 + ri * step;
    const row = [];
    for (let ci = 0; ci <= cols; ci++) {
      const l = -half + ci * step;
      const wx = cam.x + cam.fx * d + cam.rx * l;
      const wz = cam.z + cam.fz * d + cam.rz * l;
      const wy = groundFn(wx, wz);
      row.push({ p: project(wx, wy, wz), x: wx, z: wz, h: wy });
    }
    verts.push(row);
  }
  for (let ri = rows - 1; ri >= 0; ri--) {
    const rowFar = verts[ri + 1];
    const rowNear = verts[ri];
    for (let ci = 0; ci < cols; ci++) {
      const a = rowFar[ci];
      const b = rowFar[ci + 1];
      const c = rowNear[ci + 1];
      const d = rowNear[ci];
      if (!a.p || !b.p || !c.p || !d.p) continue;
      const hMid = (a.h + b.h + c.h + d.h) / 4;
      const xMid = (a.x + b.x + c.x + d.x) / 4;
      const zMid = (a.z + b.z + c.z + d.z) / 4;
      ctx.fillStyle = terrainColor(xMid, zMid, hMid, groundFn);
      ctx.beginPath();
      ctx.moveTo(a.p.x, a.p.y);
      ctx.lineTo(b.p.x, b.p.y);
      ctx.lineTo(c.p.x, c.p.y);
      ctx.lineTo(d.p.x, d.p.y);
      ctx.closePath();
      ctx.fill();
      // Stroke with the same colour so neighbouring quads never show a seam.
      ctx.strokeStyle = ctx.fillStyle;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }
}

function drawRunway(ctx, project) {
  for (const r of [CONFIG.runway, CONFIG.destination]) {
    drawStrip(ctx, project, r);
  }
}

function drawStrip(ctx, project, r) {
  ctx.fillStyle = PALETTE.runway;
  ctx.beginPath();
  let first = true;
  for (let z = r.z0; z <= r.z1; z += 20) {
    const cx = valleyCenter(z);
    const p = project(cx - r.halfWidth, r.elevation + 0.4, z);
    if (!p) continue;
    if (first) {
      ctx.moveTo(p.x, p.y);
      first = false;
    } else ctx.lineTo(p.x, p.y);
  }
  for (let z = r.z1; z >= r.z0; z -= 20) {
    const cx = valleyCenter(z);
    const p = project(cx + r.halfWidth, r.elevation + 0.4, z);
    if (p) ctx.lineTo(p.x, p.y);
  }
  ctx.closePath();
  ctx.fill();
  // Centreline dashes.
  ctx.strokeStyle = PALETTE.runwayLine;
  ctx.lineWidth = 2;
  for (let z = r.z0 + 10; z < r.z1; z += 40) {
    const cx = valleyCenter(z);
    const p0 = project(cx, r.elevation + 0.6, z);
    const p1 = project(cx, r.elevation + 0.6, z + 20);
    if (!p0 || !p1) continue;
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.stroke();
  }
  // Threshold bars at both ends.
  ctx.fillStyle = PALETTE.runwayLine;
  for (const z of [r.z0 + 8, r.z1 - 8]) {
    const cx = valleyCenter(z);
    const pL = project(cx - 11, r.elevation + 0.6, z);
    const pR = project(cx + 11, r.elevation + 0.6, z);
    if (!pL || !pR) continue;
    ctx.fillRect(Math.min(pL.x, pR.x), Math.min(pL.y, pR.y), Math.abs(pR.x - pL.x), 3);
  }
}

function drawRings(ctx, project, rings, time) {
  for (const ring of rings) {
    if (ring.passed) continue;
    const pulse = 1 + 0.06 * Math.sin(time * 3 + ring.z);
    ctx.save();
    ctx.strokeStyle = PALETTE.ring;
    ctx.shadowColor = PALETTE.ringGlow;
    ctx.shadowBlur = 18;
    ctx.lineWidth = 5;
    ctx.beginPath();
    let started = false;
    for (let i = 0; i <= 28; i++) {
      const a = (i / 28) * TAU;
      // Ring plane faces down the valley (normal ~ +z with the centreline's slope).
      const px = ring.x + Math.cos(a) * ring.radius * pulse;
      const py = ring.y + Math.sin(a) * ring.radius * pulse;
      const p = project(px, py, ring.z);
      if (!p) continue;
      if (!started) {
        ctx.moveTo(p.x, p.y);
        started = true;
      } else ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
    // Beacon light on top of the ring.
    const top = project(ring.x, ring.y + ring.radius * pulse, ring.z);
    if (top) {
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(top.x, top.y, 3, 0, TAU);
      ctx.fill();
    }
  }
}

function drawPads(ctx, project, pads) {
  for (const pad of pads) {
    if (pad.done) continue;
    const p = project(pad.x, pad.y + 1, pad.z);
    if (!p) continue;
    const s = pad.radius * p.s;
    if (s < 4) continue;
    ctx.save();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(p.x, p.y, s, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = `bold ${Math.max(11, Math.round(s * 0.5))}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('H', p.x, p.y);
    ctx.restore();
  }
}

function drawTrees(ctx, project, cam) {
  const trees = treesNear(cam.x - 420, cam.z - 60, cam.x + 420, cam.z + 640);
  for (const t of trees) {
    const p = project(t.x, t.y, t.z);
    if (!p) continue;
    const s = t.size * p.s;
    if (s < 2.5 || s > 170) continue;
    const top = project(t.x, t.y + t.size * 2.1, t.z);
    if (!top) continue;
    ctx.fillStyle = '#2c4a22';
    ctx.beginPath();
    ctx.moveTo(top.x, top.y);
    ctx.lineTo(p.x - s * 0.55, p.y);
    ctx.lineTo(p.x + s * 0.55, p.y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#3d6630';
    ctx.beginPath();
    ctx.moveTo(top.x, top.y + (p.y - top.y) * 0.28);
    ctx.lineTo(p.x - s * 0.4, p.y - (p.y - top.y) * 0.2);
    ctx.lineTo(p.x + s * 0.4, p.y - (p.y - top.y) * 0.2);
    ctx.closePath();
    ctx.fill();
  }
}

function drawParcels(ctx, project, parcels) {
  for (const parcel of parcels) {
    const p = project(parcel.x, parcel.y, parcel.z);
    if (!p) continue;
    const s = Math.max(2, 3.2 * p.s);
    ctx.fillStyle = '#c98a2e';
    ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
    ctx.strokeStyle = '#7a4d12';
    ctx.lineWidth = 1;
    ctx.strokeRect(p.x - s / 2, p.y - s / 2, s, s);
    if (parcel.chute) {
      const top = project(parcel.x, parcel.y + 9, parcel.z);
      if (top) {
        ctx.fillStyle = 'rgba(246,234,216,0.9)';
        ctx.beginPath();
        ctx.arc(p.x, top.y, s * 1.6, Math.PI, 0);
        ctx.fill();
      }
    }
  }
}

// The bush plane, drawn in screen space: chase view, banked and pitched
// with the flight state, propeller spinning, nav lights lit.
function drawPlane(ctx, w, h, plane, time) {
  const cx = w / 2;
  const cy = h * 0.52;
  const scale = Math.min(w, h) / 620;
  ctx.save();
  ctx.translate(cx, cy + plane.pitch * 60);
  ctx.rotate(-plane.bank * 0.85);
  ctx.scale(scale, scale);
  const prop = Math.sin(time * 42) * 0.5 + 0.5;

  // Propeller disc.
  ctx.fillStyle = `rgba(200,205,210,${0.10 + prop * 0.12})`;
  ctx.beginPath();
  ctx.ellipse(0, -6, 26, 66, 0, 0, TAU);
  ctx.fill();
  // Tailplane.
  ctx.fillStyle = PALETTE.planeDark;
  ctx.beginPath();
  ctx.moveTo(-58, 26);
  ctx.lineTo(58, 26);
  ctx.lineTo(40, 40);
  ctx.lineTo(-40, 40);
  ctx.closePath();
  ctx.fill();
  // Main wings.
  ctx.fillStyle = PALETTE.planeBody;
  ctx.beginPath();
  ctx.moveTo(-118, 6);
  ctx.lineTo(118, 6);
  ctx.lineTo(96, 26);
  ctx.lineTo(-96, 26);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = PALETTE.planeTrim;
  ctx.fillRect(-118, 12, 236, 4);
  // Fuselage, seen from behind and slightly above.
  ctx.fillStyle = PALETTE.planeBody;
  ctx.beginPath();
  ctx.moveTo(-26, -34);
  ctx.lineTo(26, -34);
  ctx.lineTo(20, 44);
  ctx.lineTo(-20, 44);
  ctx.closePath();
  ctx.fill();
  // Lit cockpit windows.
  ctx.fillStyle = '#ffd98a';
  ctx.beginPath();
  ctx.moveTo(-16, -28);
  ctx.lineTo(16, -28);
  ctx.lineTo(12, -8);
  ctx.lineTo(-12, -8);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(20,26,34,0.85)';
  ctx.fillRect(-14, -24, 28, 3);
  // Tail fin with the registration.
  ctx.fillStyle = PALETTE.planeTrim;
  ctx.beginPath();
  ctx.moveTo(-4, -34);
  ctx.lineTo(4, -34);
  ctx.lineTo(10, -58);
  ctx.lineTo(-10, -58);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = PALETTE.planeDark;
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('RR-7', 0, -40);
  // Nav lights: red left, green right, blinking white tail.
  ctx.fillStyle = '#ff4d4d';
  ctx.beginPath();
  ctx.arc(-116, 14, 4, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#4dff88';
  ctx.beginPath();
  ctx.arc(116, 14, 4, 0, TAU);
  ctx.fill();
  if (Math.sin(time * 4) > 0) {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 42, 3, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

// The plane's soft shadow on the ground below it.
function drawPlaneShadow(ctx, project, plane) {
  const ground = groundHeight(plane.x, plane.z);
  const p = project(plane.x, ground + 0.6, plane.z);
  if (!p) return;
  const s = Math.max(3, 26 * p.s * (1 - Math.min(0.8, (plane.y - ground) / 260)));
  ctx.fillStyle = 'rgba(10,16,10,0.28)';
  ctx.beginPath();
  ctx.ellipse(p.x, p.y, s, s * 0.32, 0, 0, TAU);
  ctx.fill();
}

export function render(ctx, w, h, game, time) {
  const { plane } = game;
  const cam = cameraBasis(plane);
  const project = makeProjector(cam, w, h);
  drawSky(ctx, w, h, plane.heading, time);
  drawClouds(ctx, project, time);
  drawTerrain(ctx, project, cam, plane, groundHeight);
  drawRunway(ctx, project);
  drawRings(ctx, project, game.rings, time);
  drawPads(ctx, project, game.pads);
  drawTrees(ctx, project, cam);
  drawParcels(ctx, project, game.parcels);
  drawPlaneShadow(ctx, project, plane);
  drawPlane(ctx, w, h, plane, time);
}

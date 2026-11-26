// Ridgeline Run — the HUD and the lit instrument panel.
// One job: every number and dial the pilot reads. Altitude, speed and
// heading on the HUD; the artificial horizon, fuel, throttle and damage on
// the panel; mission banners and end screens as overlays. Drawing only.

import { PALETTE } from './config.js';

const TAU = Math.PI * 2;

function fmt(n, digits = 0) {
  return n.toLocaleString('en-US', { maximumFractionDigits: digits });
}

function panelBox(ctx, x, y, w, h) {
  ctx.fillStyle = PALETTE.panel;
  ctx.strokeStyle = PALETTE.panelEdge;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.fill();
  ctx.stroke();
}

function label(ctx, text, x, y, color = '#9fb0c3') {
  ctx.fillStyle = color;
  ctx.font = '600 10px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(text, x, y);
}

// Artificial horizon: sky and ground split by the real pitch and bank.
function drawHorizon(ctx, cx, cy, r, pitch, bank) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, TAU);
  ctx.clip();
  ctx.translate(cx, cy);
  ctx.rotate(-bank);
  const offset = pitch * r * 1.6;
  ctx.fillStyle = '#5d94c4';
  ctx.fillRect(-r, -r + offset - r, r * 2, r * 2);
  ctx.fillStyle = '#7a5230';
  ctx.fillRect(-r, offset, r * 2, r * 2);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-r, offset);
  ctx.lineTo(r, offset);
  ctx.stroke();
  // Pitch ladder ticks.
  ctx.lineWidth = 1;
  for (const d of [-0.3, -0.15, 0.15, 0.3]) {
    const y = offset + d * r * 1.6;
    ctx.beginPath();
    ctx.moveTo(-14, y);
    ctx.lineTo(14, y);
    ctx.stroke();
  }
  ctx.restore();
  // Fixed wings marker.
  ctx.strokeStyle = PALETTE.hudAmber;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - r - 2, cy);
  ctx.lineTo(cx - r + 12, cy);
  ctx.moveTo(cx + r - 12, cy);
  ctx.lineTo(cx + r + 2, cy);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, TAU);
  ctx.strokeStyle = '#5b6b7d';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function drawGaugeBar(ctx, x, y, w, h, frac, color, bg = 'rgba(255,255,255,0.12)') {
  ctx.fillStyle = bg;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w * Math.max(0, Math.min(1, frac)), h);
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}

function compassStrip(ctx, cx, y, w, headingDeg) {
  const dirs = [
    [0, 'N'],
    [45, 'NE'],
    [90, 'E'],
    [135, 'SE'],
    [180, 'S'],
    [225, 'SW'],
    [270, 'W'],
    [315, 'NW'],
  ];
  ctx.save();
  ctx.beginPath();
  ctx.rect(cx - w / 2, y - 14, w, 30);
  ctx.clip();
  for (const [deg, name] of dirs) {
    let rel = ((deg - headingDeg + 540) % 360) - 180;
    const x = cx + (rel / 60) * (w / 2);
    if (Math.abs(rel) > 62) continue;
    ctx.fillStyle = deg % 90 === 0 ? '#ffffff' : '#9fb0c3';
    ctx.font = deg % 90 === 0 ? '700 13px sans-serif' : '600 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(name, x, y + 4);
    ctx.fillRect(x - 0.5, y + 8, 1, 5);
  }
  ctx.restore();
  // Centre lubber line.
  ctx.strokeStyle = PALETTE.hudAmber;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx, y - 14);
  ctx.lineTo(cx, y - 4);
  ctx.stroke();
}

export function drawHUD(ctx, w, h, game) {
  const { plane, mission, score, timeLeft, message, messageAt, time } = game;
  const ringsLeft = game.rings.filter((r) => !r.passed).length;
  const padsLeft = game.pads.filter((p) => !p.done).length;
  const headingDeg = ((plane.heading * 180) / Math.PI % 360 + 360) % 360;
  const altFt = Math.max(0, (plane.y - 22) * 3.28084);
  const speedKt = plane.speed * 1.94384;

  // Top bar: objective left, score right.
  ctx.fillStyle = 'rgba(8,12,18,0.55)';
  ctx.fillRect(0, 0, w, 44);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 15px sans-serif';
  ctx.fillText(`${mission.name}`, 14, 17);
  ctx.fillStyle = '#c8d4e2';
  ctx.font = '500 12px sans-serif';
  const objective =
    game.screen === 'title'
      ? mission.briefing
      : ringsLeft > 0
        ? `${ringsLeft} ring${ringsLeft === 1 ? '' : 's'} to go — then land on the strip`
        : padsLeft > 0
          ? `${padsLeft} parcel${padsLeft === 1 ? '' : 's'} to drop — then land on the strip`
          : 'All objectives done — land on the runway!';
  ctx.fillText(objective, 14, 34);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 15px sans-serif';
  ctx.fillText(`SCORE ${fmt(score)}`, w - 14, 17);
  ctx.fillStyle = '#c8d4e2';
  ctx.font = '500 12px sans-serif';
  ctx.fillText(`TIME ${fmt(Math.max(0, timeLeft))}s   FUEL ${Math.round(plane.fuel)}%`, w - 14, 34);

  // Centre message toast (fades after a few seconds).
  if (message && time - messageAt < 3.2) {
    const alpha = Math.min(1, (3.2 - (time - messageAt)) / 0.6);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = '700 20px sans-serif';
    ctx.textAlign = 'center';
    const tw = ctx.measureText(message).width;
    ctx.fillStyle = 'rgba(8,12,18,0.72)';
    ctx.beginPath();
    ctx.roundRect(w / 2 - tw / 2 - 16, 66, tw + 32, 36, 8);
    ctx.fill();
    ctx.fillStyle = PALETTE.hudAmber;
    ctx.fillText(message, w / 2, 85);
    ctx.restore();
  }

  // Compass strip under the top bar.
  compassStrip(ctx, w / 2, 62, Math.min(420, w * 0.5), headingDeg);

  // Bottom instrument panel.
  const panelH = 108;
  const panelY = h - panelH;
  panelBox(ctx, 0, panelY, w, panelH);

  const cy = panelY + 54;
  // Artificial horizon.
  drawHorizon(ctx, 64, cy, 34, plane.pitch, plane.bank);
  label(ctx, 'ATTITUDE', 64, panelY + 98);

  // Altimeter.
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 22px sans-serif';
  ctx.fillText(fmt(altFt), 150, cy - 2);
  label(ctx, 'ALT FT', 150, cy + 18);
  ctx.fillStyle = plane.y < 60 ? PALETTE.hudRed : PALETTE.hudGreen;
  ctx.font = '600 11px sans-serif';
  ctx.fillText(plane.y < 60 ? 'LOW' : '▲ SAFE', 150, cy + 34);

  // Airspeed.
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 22px sans-serif';
  ctx.fillText(fmt(speedKt), 232, cy - 2);
  label(ctx, 'SPEED KT', 232, cy + 18);
  ctx.fillStyle = plane.speed < 30 && !plane.onGround ? PALETTE.hudRed : PALETTE.hudGreen;
  ctx.font = '600 11px sans-serif';
  ctx.fillText(plane.speed < 30 && !plane.onGround ? 'STALL!' : 'FLYING', 232, cy + 34);

  // Heading readout.
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 22px sans-serif';
  ctx.fillText(`${String(Math.round(headingDeg)).padStart(3, '0')}°`, 314, cy - 2);
  label(ctx, 'HEADING', 314, cy + 18);
  ctx.fillStyle = '#c8d4e2';
  ctx.font = '600 11px sans-serif';
  ctx.fillText(plane.onGround ? 'ON GROUND' : 'AIRBORNE', 314, cy + 34);

  // Fuel + throttle gauges (right side).
  const gx = w - 270;
  ctx.textAlign = 'left';
  label(ctx, 'FUEL', gx, panelY + 22, '#c8d4e2');
  drawGaugeBar(ctx, gx + 48, panelY + 14, 120, 12, plane.fuel / 100, plane.fuel < 20 ? PALETTE.hudRed : PALETTE.hudGreen);
  ctx.fillStyle = '#ffffff';
  ctx.font = '600 11px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`${Math.round(plane.fuel)}%`, gx + 176, panelY + 24);
  label(ctx, 'THROTTLE', gx, panelY + 46, '#c8d4e2');
  drawGaugeBar(ctx, gx + 48, panelY + 38, 120, 12, plane.throttle, PALETTE.hudAmber);
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.fillText(`${Math.round(plane.throttle * 100)}%`, gx + 176, panelY + 48);
  label(ctx, 'DAMAGE', gx, panelY + 70, '#c8d4e2');
  drawGaugeBar(ctx, gx + 48, panelY + 62, 120, 12, plane.damage / 100, PALETTE.hudRed);
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.fillText(`${Math.round(plane.damage)}%`, gx + 176, panelY + 72);
  // Gear + wind lights.
  ctx.fillStyle = plane.gearDown ? PALETTE.hudGreen : '#5b6b7d';
  ctx.beginPath();
  ctx.arc(gx + 6, panelY + 90, 5, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#c8d4e2';
  ctx.font = '600 11px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('GEAR', gx + 16, panelY + 94);
  ctx.fillStyle = Math.abs(plane.windGust) > 4 ? PALETTE.hudAmber : '#5b6b7d';
  ctx.beginPath();
  ctx.arc(gx + 76, panelY + 90, 5, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#c8d4e2';
  ctx.textAlign = 'left';
  ctx.fillText(`WIND ${Math.abs(plane.windGust).toFixed(0)} kt`, gx + 86, panelY + 94);
}

// Full-screen overlay: title, pause, crash and mission-complete screens.
export function drawOverlay(ctx, w, h, game) {
  const { screen, mission, score, missions } = game;
  ctx.fillStyle = 'rgba(6,10,16,0.45)';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';

  if (screen === 'title') {
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 54px sans-serif';
    ctx.fillText('RIDGELINE RUN', w / 2, h * 0.17);
    ctx.fillStyle = PALETTE.hudAmber;
    ctx.font = '600 19px sans-serif';
    ctx.fillText('A bush-plane courier game — fly the valley, mind the fuel, mind the rocks.', w / 2, h * 0.17 + 34);
    ctx.fillStyle = '#e8eef5';
    ctx.font = '600 16px sans-serif';
    ctx.fillText('Pick a sortie — press 1, 2 or 3, or click one:', w / 2, h * 0.60);
    missions.forEach((m, i) => {
      const y = h * 0.64 + i * 52;
      const selected = mission.id === m.id;
      ctx.fillStyle = selected ? 'rgba(255,176,46,0.22)' : 'rgba(10,14,20,0.6)';
      ctx.strokeStyle = selected ? PALETTE.hudAmber : '#3a4656';
      ctx.lineWidth = selected ? 2 : 1;
      ctx.beginPath();
      ctx.roundRect(w / 2 - 330, y - 22, 660, 44, 8);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 17px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`${i + 1}. ${m.name}`, w / 2 - 314, y - 3);
      ctx.fillStyle = '#c8d4e2';
      ctx.font = '500 13px sans-serif';
      ctx.fillText(m.briefing, w / 2 - 314, y + 15);
    });
    ctx.fillStyle = '#9fb0c3';
    ctx.font = '500 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Shift throttle up · arrows or mouse to fly · B drops a parcel · land on the lit strip', w / 2, h * 0.64 + 3 * 52 + 22);
    return;
  }

  if (screen === 'paused') {
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 44px sans-serif';
    ctx.fillText('PAUSED', w / 2, h * 0.42);
    ctx.fillStyle = '#c8d4e2';
    ctx.font = '500 16px sans-serif';
    ctx.fillText('P to resume · R to restart the sortie', w / 2, h * 0.42 + 34);
    return;
  }

  if (screen === 'crashed') {
    ctx.fillStyle = PALETTE.hudRed;
    ctx.font = '800 44px sans-serif';
    ctx.fillText('DOWN IN THE VALLEY', w / 2, h * 0.36);
    ctx.fillStyle = '#ffffff';
    ctx.font = '500 17px sans-serif';
    ctx.fillText(game.plane.crashReason || 'The flight is over.', w / 2, h * 0.36 + 34);
    ctx.fillStyle = '#c8d4e2';
    ctx.font = '600 16px sans-serif';
    ctx.fillText(`Score ${fmt(score)} · R to fly again`, w / 2, h * 0.36 + 66);
    return;
  }

  if (screen === 'complete') {
    ctx.fillStyle = PALETTE.hudGreen;
    ctx.font = '800 44px sans-serif';
    ctx.fillText('SORTIE COMPLETE', w / 2, h * 0.32);
    ctx.fillStyle = '#ffffff';
    ctx.font = '500 17px sans-serif';
    ctx.fillText(`Landed on the strip with ${Math.round(game.plane.fuel)}% fuel left.`, w / 2, h * 0.32 + 34);
    const bonus = game.landingBonus || 0;
    ctx.fillStyle = '#c8d4e2';
    ctx.font = '600 16px sans-serif';
    ctx.fillText(`Flying ${fmt(game.flyingScore)} + landing bonus ${fmt(bonus)} = ${fmt(score)}`, w / 2, h * 0.32 + 66);
    ctx.fillText('R to fly another sortie · 1/2/3 to pick a mission', w / 2, h * 0.32 + 94);
  }
}

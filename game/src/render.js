// render.js - everything the pilot sees: the dusk sky, the canyon drawn
// as perspective strips, the mesas, storm clouds and rings in the world,
// the aircraft in chase view, and the HUD with its compass strip, its
// airspeed and altitude readouts and its artificial horizon.

import {
  VIEW_DISTANCE,
  canyonCenterAt,
  canyonHalfWidthAt,
  canyonRimHeightAt,
  riverOffsetAt,
  seededRandom,
} from './world.js';
import { FEET, KNOTS } from './flight.js';

/** The camera's focal length in pixels: the one number the projection shares. */
const FOCAL = 560;

/** Screen names the game states use. */
export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_OVER = 'over';

/** Mix two [r, g, b] colours into one [r, g, b]; amount 0 keeps the first. */
function mixRgb(a, b, amount) {
  const t = Math.min(1, Math.max(0, amount));
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/** Mix two [r, g, b] colours; amount 0 keeps the first, 1 the second. */
function mixColour(a, b, amount) {
  const mixed = mixRgb(a, b, amount);
  return `rgb(${Math.round(mixed[0])},${Math.round(mixed[1])},${Math.round(mixed[2])})`;
}

const FOG = [233, 164, 110];
const WALL = [182, 90, 46];
const FLOOR = [178, 118, 66];
const PLATEAU = [172, 96, 52];
const RIVER = [64, 116, 152];

/** A point in the world projected to the screen, or null when behind the camera. */
function project(view, x, altitude, z) {
  const d = z - view.flight.z;
  if (d < 4) return null;
  return {
    x: view.width / 2 + ((x - view.flight.x) * FOCAL) / d,
    y: view.horizonY + ((view.flight.altitude + 7 - altitude) * FOCAL) / d,
    scale: FOCAL / d,
    distance: d,
  };
}

/** Fill a polygon from a list of points, skipping any that failed to project. */
function polygon(ctx, points, fill) {
  if (points.some((p) => p === null)) return;
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i].x, points[i].y);
  ctx.closePath();
  ctx.fill();
}

/** The dusk sky: a gradient, a low sun, first stars and far mesa silhouettes. */
function drawSky(ctx, view) {
  const { width, height, horizonY } = view;
  const gradient = ctx.createLinearGradient(0, 0, 0, horizonY * 1.25);
  gradient.addColorStop(0, '#1d2a52');
  gradient.addColorStop(0.45, '#5a4a7d');
  gradient.addColorStop(0.78, '#c96f4a');
  gradient.addColorStop(1, '#eda96e');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, horizonY + 2);

  const random = seededRandom(20261126);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  for (let i = 0; i < 46; i += 1) {
    const y = random() * horizonY * 0.42;
    ctx.globalAlpha = 0.14 + random() * 0.4 * (1 - y / (horizonY * 0.5));
    ctx.fillRect(random() * width, y, 2, 2);
  }
  ctx.globalAlpha = 1;

  const sunX = width * 0.76;
  const sunY = horizonY - 66;
  const glow = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, 120);
  glow.addColorStop(0, 'rgba(255,214,140,0.85)');
  glow.addColorStop(0.25, 'rgba(255,178,102,0.35)');
  glow.addColorStop(1, 'rgba(255,178,102,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(sunX - 130, sunY - 130, 260, 260);
  ctx.fillStyle = '#ffd98f';
  ctx.beginPath();
  ctx.arc(sunX, sunY, 21, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#4a3358';
  for (let i = 0; i < 6; i += 1) {
    const baseX = ((i * 293 + 80 - (view.flight.z * 0.06) % 293) + width) % (width + 240) - 120;
    const top = horizonY - 26 - ((i * 37) % 30);
    const half = 90 + ((i * 53) % 70);
    ctx.beginPath();
    ctx.moveTo(baseX - half, horizonY + 2);
    ctx.lineTo(baseX - half + 18, top);
    ctx.lineTo(baseX + half - 18, top);
    ctx.lineTo(baseX + half, horizonY + 2);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(240,180,120,0.25)';
  ctx.fillRect(0, horizonY - 2, width, 3);
}

/** Scale an [r, g, b] colour by a brightness factor, as a CSS colour. */
function shadeColour(rgb, factor) {
  return `rgb(${Math.min(255, Math.round(rgb[0] * factor))},${Math.min(255, Math.round(rgb[1] * factor))},${Math.min(255, Math.round(rgb[2] * factor))})`;
}

/** The canyon itself: floor, river, walls and plateaus, far strips first. */
function drawCanyon(ctx, view) {
  const slices = 144;
  const near = 6;
  const bands = [];
  for (let i = 0; i <= slices; i += 1) {
    bands.push(near * Math.pow(VIEW_DISTANCE / near, i / slices));
  }
  for (let i = slices - 1; i >= 0; i -= 1) {
    drawCanyonBand(ctx, view, bands[i], bands[i + 1]);
  }
  // One smooth wash of dusk air over the whole canyon, so the fog fades
  // with the eye instead of stepping from band to band.
  const wash = ctx.createLinearGradient(0, view.horizonY - 6, 0, view.height);
  wash.addColorStop(0, 'rgba(233,164,110,0.42)');
  wash.addColorStop(0.35, 'rgba(233,164,110,0.13)');
  wash.addColorStop(1, 'rgba(233,164,110,0)');
  ctx.fillStyle = wash;
  ctx.fillRect(0, view.horizonY - 6, view.width, view.height - view.horizonY + 6);
}

/** One depth band of the canyon between two distances ahead of the camera. */
function drawCanyonBand(ctx, view, dFar, dNear) {
  const zFar = view.flight.z + dFar;
  const zNear = view.flight.z + dNear;
  const fogMid = Math.pow((dFar + dNear) / 2 / VIEW_DISTANCE, 1.3) * 0.85;

  const far = bandPoints(view, zFar);
  const near = bandPoints(view, zNear);
  if (!far || !near) return;

  const plateau = mixColour(PLATEAU, FOG, fogMid);
  const floor = mixColour(FLOOR, FOG, fogMid);
  const river = mixColour(RIVER, FOG, fogMid);

  polygon(ctx, [far.plateauL, far.rimL, near.rimL, near.plateauL], plateau);
  polygon(ctx, [far.rimR, far.plateauR, near.plateauR, near.rimR], plateau);
  drawWallSide(ctx, view, far, near, fogMid, 'L');
  drawWallSide(ctx, view, far, near, fogMid, 'R');
  polygon(ctx, [far.floorL, far.floorR, near.floorR, near.floorL], floor);
  polygon(ctx, [far.riverL, far.riverR, near.riverR, near.riverL], river);
}

/**
 * One side of the canyon wall for one depth band, drawn as three level
 * rock layers: strata are bands of height, the way real canyon walls
 * layer, each with its own shade, all fogged by the band's distance.
 */
function drawWallSide(ctx, view, far, near, fog, side) {
  const layers = [
    { from: 0, to: 0.36, shade: 0.78 },
    { from: 0.36, to: 0.7, shade: 0.97 },
    { from: 0.7, to: 1, shade: 1.13 },
  ];
  for (const layer of layers) {
    const colour = shadeColour(mixRgb(WALL, FOG, fog), layer.shade);
    const farLow = wallPointAt(view, far, side, layer.from);
    const farHigh = wallPointAt(view, far, side, layer.to);
    const nearLow = wallPointAt(view, near, side, layer.from);
    const nearHigh = wallPointAt(view, near, side, layer.to);
    polygon(ctx, [farLow, farHigh, nearHigh, nearLow], colour);
  }
}

/** A point on a wall at a fraction of the rim height, from a band's corners. */
function wallPointAt(view, band, side, fraction) {
  const floor = side === 'L' ? band.floorL : band.floorR;
  const rim = side === 'L' ? band.rimL : band.rimR;
  return {
    x: floor.x + (rim.x - floor.x) * fraction,
    y: floor.y + (rim.y - floor.y) * fraction,
  };
}

/** The projected corners of the canyon at one distance: floor, rim, plateau, river. */
function bandPoints(view, z) {
  const centre = canyonCenterAt(z);
  const half = canyonHalfWidthAt(z);
  const rim = canyonRimHeightAt(z);
  const riverCentre = centre + riverOffsetAt(z);
  const points = {
    floorL: project(view, centre - half, 0, z),
    floorR: project(view, centre + half, 0, z),
    rimL: project(view, centre - half, rim, z),
    rimR: project(view, centre + half, rim, z),
    plateauL: project(view, centre - half - 950, rim, z),
    plateauR: project(view, centre + half + 950, rim, z),
    riverL: project(view, riverCentre - 5.5, 0.4, z),
    riverR: project(view, riverCentre + 5.5, 0.4, z),
  };
  return Object.values(points).some((p) => p === null) ? null : points;
}

/** The mesas standing on the floor, far ones first so near ones overpaint. */
function drawMesas(ctx, view) {
  const visible = view.course.mesas
    .filter((m) => m.z + m.depth / 2 > view.flight.z + 4 && m.z - view.flight.z < VIEW_DISTANCE)
    .sort((a, b) => b.z - a.z);
  for (const mesa of visible) {
    const front = mesa.z + mesa.depth / 2;
    const back = mesa.z - mesa.depth / 2;
    const fog = Math.pow((front - view.flight.z) / VIEW_DISTANCE, 1.3) * 0.85;
    const base = { x: mesa.x, z: front };
    const bl = project(view, base.x - mesa.width / 2, 0, front);
    const br = project(view, base.x + mesa.width / 2, 0, front);
    const tl = project(view, base.x - mesa.width / 2, mesa.height, front);
    const tr = project(view, base.x + mesa.width / 2, mesa.height, front);
    const tlb = project(view, base.x - mesa.width / 2, mesa.height, back);
    const trb = project(view, base.x + mesa.width / 2, mesa.height, back);
    polygon(ctx, [tl, tr, trb, tlb], mixColour([206, 128, 74], FOG, fog));
    polygon(ctx, [bl, br, tr, tl], mixColour([168, 84, 44], FOG, fog));
    if (bl && br && tl) {
      ctx.strokeStyle = 'rgba(90,40,20,0.35)';
      ctx.lineWidth = Math.max(1, 2.2 * tl.scale / 10);
      for (const fraction of [0.34, 0.62]) {
        const y = bl.y + (tl.y - bl.y) * fraction;
        ctx.beginPath();
        ctx.moveTo(bl.x, y);
        ctx.lineTo(br.x, y);
        ctx.stroke();
      }
    }
  }
}

/** The storm clouds: dark seeded puffs hanging where the pilot must not go. */
function drawClouds(ctx, view) {
  const visible = view.course.clouds
    .filter((c) => c.z > view.flight.z + 4 && c.z - view.flight.z < VIEW_DISTANCE)
    .sort((a, b) => b.z - a.z);
  for (const cloud of visible) {
    const centre = project(view, cloud.x, cloud.altitude, cloud.z);
    if (!centre) continue;
    const radiusPx = cloud.radius * centre.scale;
    if (radiusPx < 3) continue;
    const random = seededRandom(cloud.seed);
    const fog = Math.pow(centre.distance / VIEW_DISTANCE, 1.3) * 0.7;
    for (let i = 0; i < 9; i += 1) {
      const ox = (random() * 2 - 1) * radiusPx * 0.62;
      const oy = (random() * 2 - 1) * radiusPx * 0.3;
      const r = radiusPx * (0.42 + random() * 0.4);
      const shade = mixColour([52, 54, 72], FOG, fog);
      ctx.fillStyle = shade;
      ctx.globalAlpha = 0.92;
      ctx.beginPath();
      ctx.arc(centre.x + ox, centre.y + oy, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = mixColour([140, 140, 165], FOG, fog);
    ctx.beginPath();
    ctx.ellipse(centre.x, centre.y - radiusPx * 0.34, radiusPx * 0.8, radiusPx * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    // Rain slanting out of the cell: the tell that this cloud is a storm.
    ctx.strokeStyle = 'rgba(170,200,235,0.28)';
    ctx.lineWidth = Math.max(1, radiusPx * 0.03);
    ctx.beginPath();
    for (let i = 0; i < 11; i += 1) {
      const rx = centre.x + (random() * 2 - 1) * radiusPx * 0.85;
      const ry = centre.y + radiusPx * (0.25 + random() * 0.3);
      const len = radiusPx * (0.5 + random() * 0.5);
      ctx.moveTo(rx, ry);
      ctx.lineTo(rx - len * 0.18, ry + len);
    }
    ctx.stroke();
  }
}

/** The golden target rings, with a glow as they near and a verdict once passed. */
function drawRings(ctx, view) {
  const rings = [...view.course.rings].sort((a, b) => b.z - a.z);
  for (const ring of rings) {
    const d = ring.z - view.flight.z;
    if (d < 5 || d > VIEW_DISTANCE) continue;
    const centre = project(view, ring.x, ring.altitude, ring.z);
    if (!centre) continue;
    const radiusPx = ring.radius * centre.scale;
    if (radiusPx < 2.5) continue;
    let colour = '#ffc93c';
    if (ring.passed) colour = ring.hit ? '#59d977' : 'rgba(200,90,80,0.75)';
    ctx.save();
    if (!ring.passed && d < 520) {
      ctx.shadowColor = 'rgba(255,190,60,0.9)';
      ctx.shadowBlur = 18;
    }
    ctx.strokeStyle = colour;
    ctx.lineWidth = Math.max(2, radiusPx * 0.13);
    ctx.beginPath();
    ctx.arc(centre.x, centre.y, radiusPx, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = Math.max(1, radiusPx * 0.045);
    ctx.beginPath();
    ctx.arc(centre.x, centre.y, radiusPx * 0.82, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

/** The aircraft's soft shadow on the canyon floor, shrinking as it climbs. */
function drawAircraftShadow(ctx, view) {
  const { width, height, flight } = view;
  const closeness = Math.max(0, 1 - flight.altitude / 130);
  ctx.fillStyle = `rgba(40,16,8,${0.1 + closeness * 0.22})`;
  ctx.beginPath();
  ctx.ellipse(width / 2, height * 0.965, 40 + closeness * 42, 7 + closeness * 6, 0, 0, Math.PI * 2);
  ctx.fill();
}

/** The aircraft in chase view: a built little prop plane, banking with the stick. */
function drawAircraft(ctx, view) {
  const { width, height, flight, time } = view;
  const ax = width / 2;
  const ay = height * 0.755 + Math.sin(time * 2.2) * 2.2 + flight.pitch * 9;
  ctx.save();
  ctx.translate(ax, ay);
  ctx.rotate(flight.bank * 0.55);
  ctx.scale(1.18, 1.18);

  const body = ctx.createLinearGradient(0, -52, 0, 34);
  body.addColorStop(0, '#dfe6ee');
  body.addColorStop(0.55, '#9fb2c6');
  body.addColorStop(1, '#67798d');

  // Main wing, with a red lamp on the left tip and a green one on the right.
  ctx.fillStyle = '#8496ab';
  ctx.beginPath();
  ctx.moveTo(-82, 4);
  ctx.lineTo(-12, -6);
  ctx.lineTo(12, -6);
  ctx.lineTo(82, 4);
  ctx.lineTo(74, 15);
  ctx.lineTo(-74, 15);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#3c4c5e';
  ctx.fillRect(-82, 3, 10, 5);
  ctx.fillRect(72, 3, 10, 5);
  const blink = Math.floor(time * 1.6) % 2 === 0;
  ctx.fillStyle = blink ? '#ff5147' : '#7a1f1a';
  ctx.beginPath();
  ctx.arc(-79, 6, 3.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = blink ? '#7a1f1a' : '#3dff7a';
  ctx.beginPath();
  ctx.arc(79, 6, 3.4, 0, Math.PI * 2);
  ctx.fill();

  // Tailplane and fin.
  ctx.fillStyle = '#93a7bb';
  ctx.beginPath();
  ctx.moveTo(-26, -46);
  ctx.lineTo(26, -46);
  ctx.lineTo(21, -38);
  ctx.lineTo(-21, -38);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#7e93a9';
  ctx.beginPath();
  ctx.moveTo(0, -68);
  ctx.lineTo(6, -44);
  ctx.lineTo(-6, -44);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#c8452c';
  ctx.fillRect(-2.5, -66, 5, 12);

  // Fuselage and canopy.
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(-8, -48);
  ctx.bezierCurveTo(-13, -18, -12, 8, -7, 30);
  ctx.quadraticCurveTo(0, 37, 7, 30);
  ctx.bezierCurveTo(12, 8, 13, -18, 8, -48);
  ctx.quadraticCurveTo(0, -53, -8, -48);
  ctx.closePath();
  ctx.fill();
  const glass = ctx.createLinearGradient(0, -26, 0, 2);
  glass.addColorStop(0, '#bfe3ff');
  glass.addColorStop(1, '#274b66');
  ctx.fillStyle = glass;
  ctx.beginPath();
  ctx.ellipse(0, -12, 8.5, 15, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.beginPath();
  ctx.ellipse(-3, -19, 3, 6.5, -0.3, 0, Math.PI * 2);
  ctx.fill();

  // Spinner, exhausts and gear.
  ctx.fillStyle = '#37424e';
  ctx.beginPath();
  ctx.ellipse(0, 33, 5.5, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#22282e';
  ctx.fillRect(-11, 22, 3.4, 8);
  ctx.fillRect(7.6, 22, 3.4, 8);
  ctx.beginPath();
  ctx.arc(-16, 34, 4.6, 0, Math.PI * 2);
  ctx.arc(16, 34, 4.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** A framed readout box, the HUD's building block. */
function readoutBox(ctx, x, y, w, h, label, value, accent) {
  ctx.fillStyle = 'rgba(8,12,20,0.62)';
  ctx.strokeStyle = 'rgba(160,200,235,0.5)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 7);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(170,205,240,0.85)';
  ctx.font = '600 10px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(label, x + 10, y + 15);
  ctx.fillStyle = accent || '#f2f7ff';
  ctx.font = '700 24px ui-monospace, Menlo, Consolas, monospace';
  ctx.fillText(value, x + 10, y + 41);
}

/** The compass strip at the top centre: ticks, cardinals and the heading. */
function drawCompass(ctx, view) {
  const { width, flight } = view;
  const cx = width / 2;
  const y = 14;
  const w = 360;
  ctx.fillStyle = 'rgba(8,12,20,0.62)';
  ctx.strokeStyle = 'rgba(160,200,235,0.5)';
  ctx.beginPath();
  ctx.roundRect(cx - w / 2, y, w, 40, 7);
  ctx.fill();
  ctx.stroke();
  ctx.save();
  ctx.beginPath();
  ctx.rect(cx - w / 2 + 4, y + 2, w - 8, 36);
  ctx.clip();
  const pxPerDegree = 4.4;
  const names = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' };
  ctx.textAlign = 'center';
  const firstTick = Math.ceil((flight.heading - 42) / 5) * 5;
  for (let raw = firstTick; raw <= flight.heading + 42; raw += 5) {
    const deg = ((raw % 360) + 360) % 360;
    const x = cx + (raw - flight.heading) * pxPerDegree;
    ctx.fillStyle = 'rgba(200,225,250,0.75)';
    ctx.fillRect(x - 0.5, y + 26, 1, 7);
    ctx.font = names[deg] ? '700 13px system-ui, sans-serif' : '10px ui-monospace, monospace';
    ctx.fillStyle = names[deg] ? '#ffd98f' : 'rgba(200,225,250,0.8)';
    ctx.fillText(names[deg] || String(deg).padStart(3, '0'), x, y + 20);
  }
  ctx.restore();
  ctx.fillStyle = '#ffc93c';
  ctx.beginPath();
  ctx.moveTo(cx - 6, y + 42);
  ctx.lineTo(cx + 6, y + 42);
  ctx.lineTo(cx, y + 50);
  ctx.closePath();
  ctx.fill();
}

/** The artificial horizon at the bottom right: sky, ground, ladder and bug. */
function drawArtificialHorizon(ctx, view) {
  const { width, height, flight } = view;
  const cx = width - 92;
  const cy = height - 92;
  const r = 56;
  ctx.save();
  ctx.fillStyle = 'rgba(8,12,20,0.62)';
  ctx.beginPath();
  ctx.arc(cx, cy, r + 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(160,200,235,0.55)';
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.translate(cx, cy);
  ctx.rotate(-flight.bank * 0.55);
  ctx.translate(0, flight.pitch * 20);
  ctx.fillStyle = '#3d6f9e';
  ctx.fillRect(-r * 1.5, -r * 1.5, r * 3, r * 1.5);
  ctx.fillStyle = '#8a5a2b';
  ctx.fillRect(-r * 1.5, 0, r * 3, r * 1.5);
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-r * 1.5, 0);
  ctx.lineTo(r * 1.5, 0);
  ctx.stroke();
  ctx.lineWidth = 1.4;
  for (const degrees of [-20, -10, 10, 20]) {
    const y = degrees * 1.15;
    const half = degrees % 20 === 0 ? 15 : 10;
    ctx.beginPath();
    ctx.moveTo(-half, y);
    ctx.lineTo(half, y);
    ctx.stroke();
  }
  ctx.restore();
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = '#ffc93c';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-22, 0);
  ctx.lineTo(-7, 0);
  ctx.lineTo(0, 6);
  ctx.lineTo(7, 0);
  ctx.lineTo(22, 0);
  ctx.stroke();
  ctx.fillStyle = '#ffc93c';
  ctx.beginPath();
  ctx.moveTo(0, -r - 1);
  ctx.lineTo(-5, -r + 9);
  ctx.lineTo(5, -r + 9);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = 'rgba(170,205,240,0.85)';
  ctx.font = '600 10px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('ATTITUDE', cx, cy + r + 22);
}

/** The whole HUD: score and rings, compass, altitude, airspeed, horizon. */
function drawHud(ctx, view) {
  const { width, height, flight, course } = view;
  const knots = Math.round(flight.speed * KNOTS);
  const altitudeFeet = Math.round(flight.altitude * FEET);
  const vsi = Math.round(flight.verticalSpeed * FEET * 60 / 100) * 100 || 0;

  readoutBox(ctx, 18, 14, 168, 52, 'SCORE', String(flight.score).padStart(5, '0'));
  readoutBox(ctx, 18, 74, 168, 52, 'RINGS', `${flight.ringsHit} / ${course.rings.length}`, '#ffd98f');
  readoutBox(ctx, width - 186, 14, 168, 52, 'ALTITUDE FT', altitudeFeet.toLocaleString('en-US'));
  readoutBox(ctx, width - 186, 74, 168, 52, 'VERT SPEED', `${vsi > 0 ? '+' : ''}${vsi.toLocaleString('en-US')}`);
  readoutBox(ctx, 18, height - 66, 168, 52, view.boosting ? 'AIRSPEED KT · BOOST' : 'AIRSPEED KT', String(knots), view.boosting ? '#ffc93c' : '#f2f7ff');
  drawCompass(ctx, view);
  drawArtificialHorizon(ctx, view);

  // Flight-path marker: where the nose is taking the aircraft.
  const mx = width / 2 - flight.bank * 46;
  const my = view.horizonY + 66 - flight.pitch * 26;
  ctx.strokeStyle = 'rgba(120,255,170,0.9)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(mx, my, 9, 0, Math.PI * 2);
  ctx.moveTo(mx - 20, my);
  ctx.lineTo(mx - 10, my);
  ctx.moveTo(mx + 10, my);
  ctx.lineTo(mx + 20, my);
  ctx.moveTo(mx, my + 10);
  ctx.lineTo(mx, my + 16);
  ctx.stroke();

  if (flight.flash) {
    const alpha = Math.max(0, 1 - flight.flash.age / 1.4);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = flight.flash.text.includes('+') ? '#7be495' : '#ff9a8a';
    ctx.font = '800 30px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(flight.flash.text, width / 2, 128);
    ctx.globalAlpha = 1;
  }
}

/** A centred panel of lines, shared by the title and end screens. */
function drawPanel(ctx, view, title, titleColour, lines, footer) {
  const { width, height } = view;
  ctx.fillStyle = 'rgba(5,8,16,0.55)';
  ctx.fillRect(0, 0, width, height);
  const panelW = 560;
  const panelH = 118 + lines.length * 27 + (footer ? 52 : 20);
  const px = (width - panelW) / 2;
  const py = (height - panelH) / 2 - 16;
  ctx.fillStyle = 'rgba(10,16,28,0.88)';
  ctx.strokeStyle = 'rgba(255,201,60,0.65)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(px, py, panelW, panelH, 12);
  ctx.fill();
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.fillStyle = titleColour;
  ctx.font = '800 44px system-ui, sans-serif';
  ctx.fillText(title, width / 2, py + 58);
  ctx.font = '500 16.5px system-ui, sans-serif';
  let y = py + 96;
  for (const line of lines) {
    ctx.fillStyle = line.colour || 'rgba(226,238,252,0.92)';
    if (line.stat) {
      // A statistic: the label right-aligned and the value left-aligned
      // about the centre, so the rows form two clean columns.
      ctx.font = line.font || '500 16.5px system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(line.label, width / 2 - 14, y);
      ctx.textAlign = 'left';
      ctx.fillText(line.value, width / 2 + 14, y);
      ctx.textAlign = 'center';
      ctx.font = '500 16.5px system-ui, sans-serif';
    } else {
      if (line.font) ctx.font = line.font;
      ctx.fillText(line.text, width / 2, y);
      if (line.font) ctx.font = '500 16.5px system-ui, sans-serif';
    }
    y += 27;
  }
  if (footer) {
    ctx.fillStyle = '#ffc93c';
    ctx.font = '700 18px system-ui, sans-serif';
    if (Math.floor(view.time * 1.4) % 2 === 0 || view.frozen) {
      ctx.fillText(footer, width / 2, py + panelH - 20);
    }
  }
}

/** The title screen: the game's name, its brief and its controls. */
function drawTitleScreen(ctx, view) {
  drawPanel(ctx, view, 'CANYON RUN', '#ffd98f', [
    { text: 'Thread the golden rings. Mind the walls, the mesas and the storms.', colour: '#ffd98f' },
    { text: '' },
    { text: 'STEER    Arrow keys or WASD' },
    { text: 'BOOST    Hold SHIFT' },
    { text: 'PAUSE    P        RESTART    R' },
    { text: '' },
    { text: 'Climb and dive with ↑ and ↓. Bank with ← and →.', colour: 'rgba(170,205,240,0.85)' },
    { text: 'Every ring is 100 points. Finish the canyon for 250 more.', colour: 'rgba(170,205,240,0.85)' },
  ], 'PRESS ENTER TO FLY');
}

/** The end screen: what happened, and what the flight earned. */
function drawEndScreen(ctx, view) {
  const { flight, course } = view;
  const finished = flight.ended === 'finished';
  const topSpeed = Math.round(flight.speed * KNOTS);
  const statFont = '600 15.5px ui-monospace, Menlo, Consolas, monospace';
  drawPanel(ctx, view, finished ? 'COURSE COMPLETE' : 'FLIGHT OVER', finished ? '#7be495' : '#ff9a8a', [
    { text: flight.endReason, colour: '#ffd98f' },
    { text: '' },
    { stat: true, label: 'SCORE', value: String(flight.score), font: statFont },
    { stat: true, label: 'RINGS', value: `${flight.ringsHit} hit · ${flight.ringsMissed} missed · ${course.rings.length} total`, font: statFont },
    { stat: true, label: 'DISTANCE', value: `${Math.min(Math.round(flight.z), course.length).toLocaleString('en-US')} m of ${course.length.toLocaleString('en-US')} m`, font: statFont },
    { stat: true, label: 'FINAL SPEED', value: `${topSpeed} kt`, font: statFont },
  ], 'PRESS R TO FLY AGAIN');
}

/**
 * Draw one whole frame. view carries the flight, the course, the screen
 * ('title', 'play' or 'over'), the canvas size, a time in seconds for the
 * small animations, and whether the frame is a frozen screenshot scene.
 */
export function renderFrame(ctx, view) {
  view.horizonY = view.height * 0.42 - view.flight.pitch * 24;
  drawSky(ctx, view);
  drawCanyon(ctx, view);
  drawMesas(ctx, view);
  drawClouds(ctx, view);
  drawRings(ctx, view);
  drawAircraftShadow(ctx, view);
  drawAircraft(ctx, view);
  drawHud(ctx, view);
  if (view.screen === SCREEN_TITLE) drawTitleScreen(ctx, view);
  if (view.screen === SCREEN_OVER) drawEndScreen(ctx, view);
  if (view.paused) {
    ctx.fillStyle = 'rgba(5,8,16,0.5)';
    ctx.fillRect(0, 0, view.width, view.height);
    ctx.fillStyle = '#f2f7ff';
    ctx.font = '800 40px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PAUSED', view.width / 2, view.height / 2);
    ctx.font = '500 17px system-ui, sans-serif';
    ctx.fillText('Press P to resume', view.width / 2, view.height / 2 + 34);
  }
}

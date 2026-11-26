// flight.js - the aircraft: its state, the way the controls move it, and
// the checks that end a flight (a wall, a mesa, a storm cell, the ground,
// or the finish line at the end of the canyon).

import {
  COURSE_LENGTH,
  canyonCenterAt,
  canyonHalfWidthAt,
  canyonRimHeightAt,
} from './world.js';

/** Metres per second in one knot, for the HUD's airspeed readout. */
export const KNOTS = 1.94384;

/** Feet in one metre, for the HUD's altitude readout. */
export const FEET = 3.28084;

/** What ended the flight, when it has ended. */
export const END_FINISHED = 'finished';
export const END_WALL = 'wall';
export const END_MESA = 'mesa';
export const END_STORM = 'storm';
export const END_GROUND = 'ground';

/** A fresh aircraft at the canyon mouth, slow and level. */
export function createFlight() {
  return {
    x: canyonCenterAt(0),
    altitude: 46,
    z: 0,
    speed: 54,
    bank: 0,
    pitch: 0,
    heading: 90,
    verticalSpeed: 0,
    score: 0,
    ringsHit: 0,
    ringsMissed: 0,
    distanceBonusGiven: false,
    ended: null,
    endReason: '',
    flash: null,
  };
}

/**
 * Advance the aircraft by dt seconds under the pilot's input
 * ({left, right, up, down, boost} booleans). Speed builds the longer the
 * flight runs; climbing bleeds it, diving feeds it, and the boost trades
 * the pilot's margin for pace. Banking swings the nose and slides the
 * aircraft across the canyon; the heading the compass shows follows the
 * bank and settles back to east when the wings come level.
 */
export function stepFlight(flight, course, input, dt) {
  if (flight.ended) return;

  const bankTarget = (input.left ? -1 : 0) + (input.right ? 1 : 0);
  const pitchTarget = (input.up ? 1 : 0) + (input.down ? -1 : 0);
  flight.bank += (bankTarget - flight.bank) * Math.min(1, dt * 5.2);
  flight.pitch += (pitchTarget - flight.pitch) * Math.min(1, dt * 4.2);

  const cruise = 54 + Math.min(38, flight.z / 160);
  const targetSpeed = cruise * (input.boost ? 1.38 : 1) - flight.pitch * 9;
  flight.speed += (targetSpeed - flight.speed) * Math.min(1, dt * 0.55);
  flight.speed = Math.max(34, flight.speed);

  flight.verticalSpeed = flight.pitch * 15 - (flight.speed - 60) * 0.012;
  flight.altitude += flight.verticalSpeed * dt;
  flight.x += flight.bank * flight.speed * 0.52 * dt;
  flight.z += flight.speed * dt;
  flight.heading = 90 + flight.bank * 34;

  if (flight.flash) {
    flight.flash.age += dt;
    if (flight.flash.age > 1.4) flight.flash = null;
  }

  checkRings(flight, course);
  checkCollisions(flight, course);
}

/** Score the rings the aircraft crosses this step: through one, or past it. */
function checkRings(flight, course) {
  for (const ring of course.rings) {
    if (ring.passed || ring.z > flight.z) continue;
    ring.passed = true;
    const dx = flight.x - ring.x;
    const dy = flight.altitude - ring.altitude;
    if (dx * dx + dy * dy <= ring.radius * ring.radius) {
      ring.hit = true;
      flight.ringsHit += 1;
      flight.score += 100;
      flight.flash = { text: 'RING +100', age: 0 };
    } else {
      flight.ringsMissed += 1;
      flight.flash = { text: 'RING MISSED', age: 0 };
    }
  }
}

/** End the flight if the aircraft has met the canyon, a mesa, a storm or the floor. */
function checkCollisions(flight, course) {
  const centre = canyonCenterAt(flight.z);
  const halfWidth = canyonHalfWidthAt(flight.z);
  const rim = canyonRimHeightAt(flight.z);

  if (flight.altitude <= 2.5) {
    endFlight(flight, END_GROUND, 'You flew into the canyon floor.');
    return;
  }
  if (Math.abs(flight.x - centre) > halfWidth - 7 && flight.altitude < rim) {
    endFlight(flight, END_WALL, 'You clipped the canyon wall.');
    return;
  }
  for (const mesa of course.mesas) {
    if (Math.abs(flight.z - mesa.z) < mesa.depth / 2 + 2
      && Math.abs(flight.x - mesa.x) < mesa.width / 2 + 3
      && flight.altitude < mesa.height) {
      endFlight(flight, END_MESA, 'You flew into a mesa.');
      return;
    }
  }
  for (const cloud of course.clouds) {
    const dx = flight.x - cloud.x;
    const dy = flight.altitude - cloud.altitude;
    const dz = flight.z - cloud.z;
    if (dx * dx + dy * dy + dz * dz < cloud.radius * cloud.radius * 0.72) {
      endFlight(flight, END_STORM, 'You flew into the storm cell.');
      return;
    }
  }
  if (flight.z >= COURSE_LENGTH) {
    if (!flight.distanceBonusGiven) {
      flight.distanceBonusGiven = true;
      flight.score += 250;
    }
    endFlight(flight, END_FINISHED, 'You ran the whole canyon.');
  }
}

/** Mark the flight over, keeping the score it earned. */
function endFlight(flight, kind, reason) {
  flight.ended = kind;
  flight.endReason = reason;
}

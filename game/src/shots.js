// shots.js - the frozen showcase scenes behind ?shot=title|flight|rings|end.
//
// Each scene plays the real rules forward from a fresh course with a
// simple autopilot at a fixed step, so the frame is what a short flight
// really looks like and the same scene always gives the same frame. The
// scenes exist so the game's screenshots can be captured headlessly;
// normal play never uses them.

import { canyonCenterAt, canyonHalfWidthAt, nextRing } from './world.js';
import { createFlight, stepFlight } from './flight.js';

const STEP = 1 / 60;

/**
 * A steady-handed pilot for the scenes: it steers for the canyon centre
 * or, when a ring is near, for the ring, and holds a safe altitude.
 */
function autopilotInput(flight, course) {
  const ring = nextRing(course, flight.z);
  let targetX = canyonCenterAt(flight.z + 130);
  let targetAltitude = 46;
  if (ring && ring.z - flight.z < 420) {
    targetX = ring.x;
    targetAltitude = ring.altitude;
  }
  const input = { left: false, right: false, up: false, down: false, boost: false };
  if (flight.x < targetX - 5) input.right = true;
  if (flight.x > targetX + 5) input.left = true;
  if (flight.altitude < targetAltitude - 2.5) input.up = true;
  if (flight.altitude > targetAltitude + 2.5) input.down = true;
  return input;
}

/** Run the autopilot for a fixed number of steps, stopping at the flight's end. */
function flyAutopilot(flight, course, steps) {
  for (let i = 0; i < steps; i += 1) {
    if (flight.ended) break;
    stepFlight(flight, course, autopilotInput(flight, course), STEP);
  }
}

/**
 * Stage the named scene on a fresh flight and course and say which screen
 * the frame belongs to ('title', 'play' or 'over'). Unknown names stage
 * the title scene.
 */
export function stageShot(name, flight, course) {
  if (name === 'flight') {
    flyAutopilot(flight, course, Math.round(19 / STEP));
    flight.flash = null;
    return 'play';
  }
  if (name === 'rings') {
    flyAutopilot(flight, course, Math.round(4.2 / STEP));
    const ring = nextRing(course, flight.z);
    if (ring) {
      // Park the aircraft a breath before the ring, lined up on it, so the
      // frame catches the approach a player sees a dozen times a run.
      flight.z = ring.z - 120;
      flight.x = ring.x - 3;
      flight.altitude = ring.altitude + 1.5;
      flight.bank = 0.18;
      flight.pitch = 0;
      flight.verticalSpeed = 0;
      flight.heading = 90 + flight.bank * 34;
      flight.flash = null;
    }
    return 'play';
  }
  if (name === 'end') {
    flyAutopilot(flight, course, Math.round(6 / STEP));
    // A pilot who stops steering meets the wall: hold a hard bank until
    // the flight ends, the way the crash screen is earned in real play.
    const intoWall = { left: false, right: true, up: false, down: false, boost: true };
    for (let i = 0; i < Math.round(20 / STEP) && !flight.ended; i += 1) {
      stepFlight(flight, course, intoWall, STEP);
    }
    return 'over';
  }
  // title: drift a little way into the canyon so the cover frame has the
  // river, the walls and a ring in it, with the aircraft posed level.
  flyAutopilot(flight, course, Math.round(3.4 / STEP));
  flight.bank = -0.12;
  return 'title';
}

/** A flight posed for the title screen without any staging. */
export function titleFlight(course) {
  const flight = createFlight();
  flight.z = 60;
  flight.x = canyonCenterAt(60);
  return flight;
}

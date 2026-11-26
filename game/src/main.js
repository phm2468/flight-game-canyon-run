// main.js - the game's boot and loop: it owns the canvas, the keyboard,
// the state machine (title, flying, paused, over) and the clock, and it
// hands each frame to render.js. With ?shot=<scene> in the address it
// instead stages one frozen scene from shots.js and draws a single frame,
// which is how the game's screenshots are taken; play never needs it.

import { buildCourse } from './world.js';
import { END_FINISHED, createFlight, stepFlight } from './flight.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, renderFrame } from './render.js';
import { playEndSound, playRingChime, setEngineSpeed, startEngine } from './audio.js';
import { stageShot } from './shots.js';

const COURSE_SEED = 20261126;
const FIXED_STEP = 1 / 120;

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const keys = new Set();
let screen = SCREEN_TITLE;
let paused = false;
let course = buildCourse(COURSE_SEED);
let flight = createFlight();
let best = 0;
let lastRingsHit = 0;
let startStamp = null;

/** The pilot's input as flight.js wants it, from the keys currently held. */
function readInput() {
  return {
    left: keys.has('arrowleft') || keys.has('a'),
    right: keys.has('arrowright') || keys.has('d'),
    up: keys.has('arrowup') || keys.has('w'),
    down: keys.has('arrowdown') || keys.has('s'),
    boost: keys.has('shift'),
  };
}

/** Start a fresh flight on a fresh course. */
function startFlight() {
  course = buildCourse(COURSE_SEED);
  flight = createFlight();
  lastRingsHit = 0;
  screen = SCREEN_PLAY;
  paused = false;
}

/** Watch for the flight ending and for rings scored, to fire their sounds. */
function watchFlightEvents() {
  if (flight.ringsHit > lastRingsHit) {
    lastRingsHit = flight.ringsHit;
    playRingChime();
  }
  if (flight.ended && screen === SCREEN_PLAY) {
    screen = SCREEN_OVER;
    best = Math.max(best, flight.score);
    playEndSound(flight.ended !== END_FINISHED);
  }
}

window.addEventListener('keydown', (event) => {
  const key = event.key.toLowerCase();
  if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', ' '].includes(key)) event.preventDefault();
  startEngine();
  if (key === 'enter' && screen === SCREEN_TITLE) {
    startFlight();
    return;
  }
  if (key === 'r' && (screen === SCREEN_OVER || screen === SCREEN_PLAY)) {
    startFlight();
    return;
  }
  if (key === 'p' && screen === SCREEN_PLAY) {
    paused = !paused;
    return;
  }
  keys.add(key);
});
window.addEventListener('keyup', (event) => {
  keys.delete(event.key.toLowerCase());
});
window.addEventListener('blur', () => keys.clear());
canvas.addEventListener('pointerdown', () => {
  startEngine();
  if (screen === SCREEN_TITLE) startFlight();
});

/** One frame of the live game: step the world, then draw it. */
function frame(stamp) {
  if (startStamp === null) startStamp = stamp;
  const time = (stamp - startStamp) / 1000;
  if (screen === SCREEN_PLAY && !paused) {
    let remaining = Math.min(0.06, frame.lastDelta || 0.016);
    while (remaining > 0) {
      const dt = Math.min(FIXED_STEP, remaining);
      stepFlight(flight, course, readInput(), dt);
      remaining -= dt;
    }
    watchFlightEvents();
    setEngineSpeed(flight.speed, readInput().boost);
  }
  frame.lastDelta = Math.min(0.06, (stamp - (frame.lastStamp || stamp)) / 1000);
  frame.lastStamp = stamp;
  renderFrame(ctx, {
    flight,
    course,
    screen,
    paused,
    width: canvas.width,
    height: canvas.height,
    time,
    boosting: screen === SCREEN_PLAY && readInput().boost,
    frozen: false,
  });
  requestAnimationFrame(frame);
}

// A ?shot= address stages a frozen scene instead of starting the loop:
// the title screen over a drifting canyon, a flight in progress, a ring
// approach, or the crash screen, each drawn once at a fixed time.
const shotName = new URLSearchParams(window.location.search).get('shot');
if (shotName) {
  screen = stageShot(shotName, flight, course);
  renderFrame(ctx, {
    flight,
    course,
    screen,
    paused: false,
    width: canvas.width,
    height: canvas.height,
    time: 1.25,
    boosting: shotName === 'end',
    frozen: true,
  });
  document.title = `Canyon Run - shot: ${shotName}`;
  window.__shotReady = shotName;
} else {
  requestAnimationFrame(frame);
}

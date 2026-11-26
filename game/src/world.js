// world.js - the canyon course: seeded generation of the terrain profile,
// the mesas, the storm clouds and the golden target rings.
//
// Everything in the course comes from one seeded random stream, so a given
// seed always builds the same canyon: the screenshot scenes and every
// player's first run see exactly the same world.

/** A small deterministic random generator (mulberry32). */
export function seededRandom(seed) {
  let state = seed >>> 0;
  return function nextRandom() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Total flyable length of the course, in metres. */
export const COURSE_LENGTH = 9200;

/** How far ahead of the aircraft the renderer draws, in metres. */
export const VIEW_DISTANCE = 2300;

/**
 * The canyon centre line's sideways offset at distance z. A sum of slow
 * sines: smooth enough to steer through, never a straight line for long.
 */
export function canyonCenterAt(z) {
  return 62 * Math.sin(z * 0.00105) + 34 * Math.sin(z * 0.00263 + 1.7) + 12 * Math.sin(z * 0.0061 + 0.4);
}

/** The canyon's half width at distance z, in metres. */
export function canyonHalfWidthAt(z) {
  const width = 80 + 17 * Math.sin(z * 0.00157 + 0.5) + 8 * Math.sin(z * 0.0043 + 2.9);
  return Math.min(102, Math.max(58, width));
}

/** The height of the canyon rim above the floor at distance z, in metres. */
export function canyonRimHeightAt(z) {
  return 57 + 12 * Math.sin(z * 0.00131 + 2.1) + 6 * Math.sin(z * 0.0053 + 0.9);
}

/** The river's sideways offset from the canyon centre at distance z. */
export function riverOffsetAt(z) {
  return 20 * Math.sin(z * 0.0021 + 3.4);
}

/**
 * Build the whole course for a seed: the target rings, the mesas that
 * stand on the canyon floor and the storm clouds that hang in the air.
 * Rings sit inside the canyon where a pilot can reach them; mesas keep
 * clear of the first stretch so a new pilot gets one clean run-up.
 */
export function buildCourse(seed) {
  const random = seededRandom(seed);
  const rings = [];
  const mesas = [];
  const clouds = [];

  for (let z = 620; z < COURSE_LENGTH - 260; z += 430 + random() * 90) {
    const halfWidth = canyonHalfWidthAt(z);
    const rim = canyonRimHeightAt(z);
    rings.push({
      z,
      x: canyonCenterAt(z) + (random() * 2 - 1) * (halfWidth - 30),
      altitude: 24 + random() * (rim - 38),
      radius: 11,
      passed: false,
      hit: false,
    });
  }

  for (let i = 0; i < 16; i += 1) {
    const z = 1250 + random() * (COURSE_LENGTH - 1900);
    const side = random() < 0.5 ? -1 : 1;
    mesas.push({
      z,
      x: canyonCenterAt(z) + side * (26 + random() * 30),
      width: 26 + random() * 26,
      depth: 30 + random() * 30,
      height: 26 + random() * 30,
    });
  }
  mesas.sort((a, b) => a.z - b.z);

  for (let i = 0; i < 11; i += 1) {
    const z = 1500 + random() * (COURSE_LENGTH - 2200);
    clouds.push({
      z,
      x: canyonCenterAt(z) + (random() * 2 - 1) * 44,
      altitude: 30 + random() * 62,
      radius: 17 + random() * 13,
      storm: true,
      seed: Math.floor(random() * 1e9),
    });
  }
  clouds.sort((a, b) => a.z - b.z);

  return { rings, mesas, clouds, length: COURSE_LENGTH };
}

/** The first ring the aircraft has not reached yet, or null past the last. */
export function nextRing(course, z) {
  for (const ring of course.rings) {
    if (!ring.passed && ring.z > z - 1) return ring;
  }
  return null;
}

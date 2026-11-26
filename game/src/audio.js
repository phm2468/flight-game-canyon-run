// audio.js - a tiny WebAudio synth: an engine hum that follows the
// airspeed, a chime for a ring flown through, a thud for the end of a
// flight. No sound files; every note is an oscillator started on the
// pilot's first key press, as browsers require a gesture before sound.

let context = null;
let engineNodes = null;

/** Start the engine hum. Safe to call again; it starts only once. */
export function startEngine() {
  if (context) {
    if (context.state === 'suspended') context.resume();
    return;
  }
  try {
    context = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = context.createOscillator();
    oscillator.type = 'sawtooth';
    oscillator.frequency.value = 62;
    const sub = context.createOscillator();
    sub.type = 'triangle';
    sub.frequency.value = 31;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;
    const gain = context.createGain();
    gain.gain.value = 0.045;
    oscillator.connect(filter);
    sub.connect(filter);
    filter.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    sub.start();
    engineNodes = { oscillator, sub, filter };
  } catch {
    context = null;
    engineNodes = null;
  }
}

/** Bend the engine note with the airspeed, once a frame at most. */
export function setEngineSpeed(speedMetresPerSecond, boosting) {
  if (!context || !engineNodes) return;
  const pitch = 46 + speedMetresPerSecond * 0.55 + (boosting ? 9 : 0);
  const now = context.currentTime;
  engineNodes.oscillator.frequency.setTargetAtTime(pitch, now, 0.08);
  engineNodes.sub.frequency.setTargetAtTime(pitch / 2, now, 0.08);
  engineNodes.filter.frequency.setTargetAtTime(240 + speedMetresPerSecond * 3.4, now, 0.1);
}

/** Two bright notes for a ring flown through. */
export function playRingChime() {
  if (!context) return;
  try {
    const now = context.currentTime;
    for (const [offset, frequency] of [[0, 880], [0.09, 1318]]) {
      const note = context.createOscillator();
      note.type = 'sine';
      note.frequency.value = frequency;
      const gain = context.createGain();
      gain.gain.setValueAtTime(0.12, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.28);
      note.connect(gain);
      gain.connect(context.destination);
      note.start(now + offset);
      note.stop(now + offset + 0.3);
    }
  } catch {
    // Sound is decoration; a failed note never stops the flight.
  }
}

/** A low noise burst for a crash, a softer one for a clean finish. */
export function playEndSound(crashed) {
  if (!context) return;
  try {
    const now = context.currentTime;
    const duration = crashed ? 0.5 : 0.25;
    const buffer = context.createBuffer(1, context.sampleRate * duration, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    }
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = crashed ? 500 : 1200;
    const gain = context.createGain();
    gain.gain.value = crashed ? 0.3 : 0.12;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(context.destination);
    source.start(now);
  } catch {
    // As above: silence is acceptable, a stopped game is not.
  }
}

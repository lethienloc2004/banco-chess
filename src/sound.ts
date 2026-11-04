/** Tiny synthesized sound effects (Web Audio, no asset files). */
export type SoundName = 'move' | 'capture' | 'check' | 'reveal' | 'end' | 'lowtime';

let ctx: AudioContext | null = null;
let noise: AudioBuffer | null = null;

function audio(): AudioContext | null {
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    noise = ctx.createBuffer(1, ctx.sampleRate * 0.25, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

/** Call from a user gesture so browsers allow audio later (e.g. for bot moves). */
export function unlockAudio() {
  audio();
}

function knock(a: AudioContext, t: number, freq: number, gain: number, dur: number) {
  // Wooden "tock": filtered noise burst + a quickly decaying low sine.
  const src = a.createBufferSource();
  src.buffer = noise;
  const bp = a.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = freq * 4;
  bp.Q.value = 1.2;
  const ng = a.createGain();
  ng.gain.setValueAtTime(gain, t);
  ng.gain.exponentialRampToValueAtTime(0.001, t + dur * 0.6);
  src.connect(bp).connect(ng).connect(a.destination);
  src.start(t);
  src.stop(t + dur);

  const osc = a.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, t);
  osc.frequency.exponentialRampToValueAtTime(freq * 0.6, t + dur);
  const og = a.createGain();
  og.gain.setValueAtTime(gain * 0.8, t);
  og.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(og).connect(a.destination);
  osc.start(t);
  osc.stop(t + dur);
}

function tone(a: AudioContext, t: number, freq: number, gain: number, dur: number, type: OscillatorType = 'triangle') {
  const osc = a.createOscillator();
  osc.type = type;
  osc.frequency.value = freq;
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(a.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

export function playSound(name: SoundName) {
  const a = audio();
  if (!a || !noise) return;
  const t = a.currentTime + 0.005;
  switch (name) {
    case 'move':
      knock(a, t, 320, 0.5, 0.09);
      break;
    case 'capture':
      knock(a, t, 240, 0.7, 0.12);
      knock(a, t + 0.06, 380, 0.45, 0.1);
      break;
    case 'reveal': {
      // Soft "flip": a rising filtered noise sweep before the knock.
      const src = a.createBufferSource();
      src.buffer = noise;
      const f = a.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.setValueAtTime(600, t);
      f.frequency.exponentialRampToValueAtTime(3000, t + 0.08);
      const g = a.createGain();
      g.gain.setValueAtTime(0.25, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
      src.connect(f).connect(g).connect(a.destination);
      src.start(t);
      src.stop(t + 0.12);
      knock(a, t + 0.07, 340, 0.5, 0.09);
      break;
    }
    case 'check':
      knock(a, t, 300, 0.5, 0.09);
      tone(a, t + 0.05, 880, 0.12, 0.12);
      tone(a, t + 0.15, 660, 0.12, 0.16);
      break;
    case 'lowtime':
      tone(a, t, 1046, 0.1, 0.09, 'square');
      tone(a, t + 0.16, 1046, 0.1, 0.09, 'square');
      break;
    case 'end':
      [523, 659, 784, 1047].forEach((f, i) => tone(a, t + i * 0.11, f, 0.12, 0.3));
      break;
  }
}

/** Tiny synthesized sound effects (Web Audio, no asset files). */
export type SoundName = 'move' | 'capture' | 'check' | 'reveal' | 'end' | 'lowtime' | 'wrong' | 'solved';

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
    case 'wrong':
      tone(a, t, 220, 0.12, 0.16, 'sawtooth');
      tone(a, t + 0.12, 165, 0.12, 0.22, 'sawtooth');
      break;
    case 'solved':
      [659, 784, 988, 1319].forEach((f, i) => tone(a, t + i * 0.09, f, 0.12, 0.35));
      break;
    case 'end':
      [523, 659, 784, 1047].forEach((f, i) => tone(a, t + i * 0.11, f, 0.12, 0.3));
      break;
  }
}

// ---------------------------------------------------------------------------
// Per-piece move sounds

/** Sound "voices" shared by both games (soldier = pawn, chariot = rook, …). */
export type Voice = 'pawn' | 'knight' | 'bishop' | 'rook' | 'queen' | 'king' | 'advisor' | 'elephant' | 'cannon';

const CHESS_VOICE: Voice[] = ['pawn', 'pawn', 'knight', 'bishop', 'rook', 'queen', 'king'];
const XQ_VOICE: Voice[] = ['pawn', 'king', 'advisor', 'elephant', 'knight', 'rook', 'cannon', 'pawn'];

export function voiceOf(game: 'chess' | 'xq', type: number): Voice {
  return (game === 'chess' ? CHESS_VOICE : XQ_VOICE)[type] ?? 'pawn';
}

function noiseBurst(a: AudioContext, t: number, from: number, to: number, gain: number, dur: number, type: BiquadFilterType = 'bandpass') {
  const src = a.createBufferSource();
  src.buffer = noise;
  const f = a.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(from, t);
  f.frequency.exponentialRampToValueAtTime(to, t + dur);
  const g = a.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f).connect(g).connect(a.destination);
  src.start(t);
  src.stop(t + dur + 0.02);
}

function glide(a: AudioContext, t: number, from: number, to: number, gain: number, dur: number, type: OscillatorType = 'sine') {
  const osc = a.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(from, t);
  osc.frequency.exponentialRampToValueAtTime(to, t + dur);
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(a.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

/**
 * Horse whinny: a bright sawtooth whose pitch jumps up then falls, with the
 * fast trembling (~25 Hz) typical of a neigh, shaped by two formants.
 */
function neigh(a: AudioContext, t: number, gain = 0.16) {
  const dur = 0.55;
  const osc = a.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(700, t);
  osc.frequency.exponentialRampToValueAtTime(1150, t + 0.09);
  osc.frequency.exponentialRampToValueAtTime(820, t + 0.3);
  osc.frequency.exponentialRampToValueAtTime(430, t + dur);
  const lfo = a.createOscillator();
  lfo.frequency.setValueAtTime(26, t);
  lfo.frequency.linearRampToValueAtTime(18, t + dur);
  const depth = a.createGain();
  depth.gain.setValueAtTime(60, t);
  depth.gain.linearRampToValueAtTime(140, t + dur);
  lfo.connect(depth).connect(osc.frequency);
  const f1 = a.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = 1300; f1.Q.value = 1.4;
  const f2 = a.createBiquadFilter(); f2.type = 'peaking'; f2.frequency.value = 2600; f2.gain.value = 8;
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.04);
  g.gain.setValueAtTime(gain, t + 0.32);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(f1).connect(f2).connect(g).connect(a.destination);
  osc.start(t); lfo.start(t);
  osc.stop(t + dur + 0.02); lfo.stop(t + dur + 0.02);
  noiseBurst(a, t + 0.3, 3000, 1200, 0.05, 0.25); // breathy tail
}

/**
 * Elephant trumpet: a brassy, slightly distorted sawtooth that blares upward
 * and wavers, through a nasal formant.
 */
function trumpet(a: AudioContext, t: number, gain = 0.15) {
  const dur = 0.6;
  const osc = a.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(320, t);
  osc.frequency.exponentialRampToValueAtTime(620, t + 0.12);
  osc.frequency.linearRampToValueAtTime(580, t + 0.45);
  osc.frequency.exponentialRampToValueAtTime(380, t + dur);
  const vib = a.createOscillator();
  vib.frequency.value = 7;
  const vd = a.createGain();
  vd.gain.value = 18;
  vib.connect(vd).connect(osc.frequency);
  const shaper = a.createWaveShaper();
  const curve = new Float32Array(256);
  for (let i = 0; i < 256; i++) { const x = i / 128 - 1; curve[i] = Math.tanh(3 * x); }
  shaper.curve = curve;
  const f1 = a.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = 1150; f1.Q.value = 2.2;
  const f2 = a.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.value = 3500;
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.06);
  g.gain.setValueAtTime(gain * 0.9, t + 0.42);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(shaper).connect(f1).connect(f2).connect(g).connect(a.destination);
  osc.start(t); vib.start(t);
  osc.stop(t + dur + 0.02); vib.stop(t + dur + 0.02);
  noiseBurst(a, t, 1800, 900, 0.06, 0.4); // breath
}

/** The piece's own sound when it lands on a square. */
function voice(a: AudioContext, t: number, v: Voice, capture: boolean) {
  switch (v) {
    case 'pawn': // light, high "tick"
      knock(a, t, 560, 0.38, 0.06);
      break;
    case 'knight': // two quick hoof-beats, then a whinny
      knock(a, t, 400, 0.45, 0.07);
      knock(a, t + 0.075, 320, 0.5, 0.08);
      neigh(a, t + 0.12);
      break;
    case 'bishop': // chess bishop is "Tượng" (elephant) in Vietnamese: knock + trumpet
      knock(a, t, 430, 0.45, 0.08);
      trumpet(a, t + 0.06);
      break;
    case 'rook': // heavy, low thud
      knock(a, t, 170, 0.85, 0.15);
      glide(a, t, 110, 70, 0.25, 0.18);
      break;
    case 'queen': // knock + bright chime
      knock(a, t, 330, 0.5, 0.09);
      tone(a, t + 0.03, 1319, 0.07, 0.28);
      tone(a, t + 0.08, 1760, 0.05, 0.32);
      break;
    case 'king': // deep knock + soft bell
      knock(a, t, 150, 0.7, 0.14);
      tone(a, t + 0.04, 659, 0.08, 0.6, 'sine');
      tone(a, t + 0.04, 988, 0.03, 0.5, 'sine');
      break;
    case 'advisor': // two soft taps
      knock(a, t, 600, 0.3, 0.05);
      knock(a, t + 0.06, 720, 0.28, 0.05);
      break;
    case 'elephant': // heavy step, then a trumpet
      knock(a, t, 230, 0.6, 0.12);
      trumpet(a, t + 0.08);
      break;
    case 'cannon': // a "pop" on a move, a "boom" when it fires (captures)
      if (capture) {
        noiseBurst(a, t, 900, 120, 0.6, 0.35, 'lowpass');
        glide(a, t, 140, 45, 0.55, 0.4);
      } else {
        noiseBurst(a, t, 2500, 600, 0.3, 0.06);
        knock(a, t + 0.02, 280, 0.45, 0.08);
      }
      break;
  }
}

export interface MoveSound {
  game: 'chess' | 'xq';
  /** Type of the piece after the move (revealed / promoted type). */
  type: number;
  capture: boolean;
  reveal?: boolean;
  check?: boolean;
  end?: boolean;
}

let style: 'piece' | 'simple' = 'piece';
export function setSoundStyle(s: 'piece' | 'simple') {
  style = s;
}

/** Sound for a move: the piece's voice, a crack on captures, then check / game-end cues. */
export function playMove(m: MoveSound) {
  if (style === 'simple') {
    playSound(m.end ? 'end' : m.check ? 'check' : m.capture ? 'capture' : m.reveal ? 'reveal' : 'move');
    return;
  }
  const a = audio();
  if (!a || !noise) return;
  let t = a.currentTime + 0.005;
  if (m.reveal) { noiseBurst(a, t, 600, 3000, 0.25, 0.09); t += 0.07; }
  const v = voiceOf(m.game, m.type);
  voice(a, t, v, m.capture);
  if (m.capture && v !== 'cannon') {
    noiseBurst(a, t + 0.015, 2600, 1800, 0.3, 0.05); // "crack" of the taken piece
    knock(a, t + 0.05, 260, 0.45, 0.09);
  }
  if (m.end) [523, 659, 784, 1047].forEach((f, i) => tone(a, t + 0.25 + i * 0.11, f, 0.12, 0.3));
  else if (m.check) { tone(a, t + 0.12, 880, 0.12, 0.12); tone(a, t + 0.22, 660, 0.12, 0.16); }
}

/** Play every voice of a game, one after another (settings preview). */
export function previewVoices(game: 'chess' | 'xq') {
  const types = game === 'chess' ? [1, 2, 3, 4, 5, 6] : [7, 2, 3, 4, 5, 6, 1];
  types.forEach((type, i) => setTimeout(() => playMove({ game, type, capture: false }), i * 420));
  setTimeout(() => playMove({ game, type: game === 'chess' ? 2 : 6, capture: true }), types.length * 420);
}

// ---------- Holiday skin sounds (layered on top of the normal move sound) ----------

export type Theme = 'halloween' | 'christmas' | 'tet' | 'midautumn';

/** A sine/triangle note with vibrato, for the ghostly "hoo". */
function wobble(a: AudioContext, t: number, from: number, to: number, gain: number, dur: number, rate = 6, depth = 9) {
  const osc = a.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(from, t);
  osc.frequency.exponentialRampToValueAtTime(to, t + dur);
  const lfo = a.createOscillator();
  lfo.frequency.value = rate;
  const lg = a.createGain();
  lg.gain.value = depth;
  lfo.connect(lg).connect(osc.frequency);
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.12);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(a.destination);
  osc.start(t); lfo.start(t);
  osc.stop(t + dur + 0.05); lfo.stop(t + dur + 0.05);
}

/** Small metallic bell: a few inharmonic partials with a long ring. */
function bell(a: AudioContext, t: number, base: number, gain: number, dur = 0.5) {
  for (const [ratio, g] of [[1, 1], [2.76, 0.5], [5.4, 0.25], [8.93, 0.12]] as const) tone(a, t, base * ratio, gain * g, dur * (1.2 - ratio / 12), 'sine');
}

/** Short sharp crack of a firecracker. */
function crack(a: AudioContext, t: number, gain: number) {
  noiseBurst(a, t, 5200, 1800, gain, 0.035, 'highpass');
  noiseBurst(a, t, 900, 300, gain * 0.6, 0.06);
}

/** Themed sound for a move or a capture by a piece wearing a holiday skin. */
export function playThemed(theme: Theme, capture: boolean) {
  const a = audio();
  if (!a || !noise) return;
  const t = a.currentTime + 0.02;
  switch (theme) {
    case 'halloween':
      if (capture) {
        wobble(a, t + 0.05, 330, 196, 0.12, 0.9);
        wobble(a, t + 0.12, 247, 147, 0.07, 0.8, 5, 6);
        for (let i = 0; i < 5; i++) noiseBurst(a, t + 0.05 + i * 0.07, 3000, 1500, 0.05, 0.04); // bat wings
      } else noiseBurst(a, t, 500, 180, 0.05, 0.35, 'lowpass'); // misty whoosh
      break;
    case 'christmas':
      if (capture) [0, 0.09, 0.18, 0.3].forEach((d, i) => bell(a, t + d, i % 2 ? 1568 : 1760, 0.07, 0.6));
      else bell(a, t + 0.04, 2093, 0.035, 0.35);
      break;
    case 'tet':
      if (capture) {
        knock(a, t, 90, 0.5, 0.25); // the big "đùng"
        let d = 0.08;
        for (let i = 0; i < 12; i++) { crack(a, t + d, 0.22 + Math.random() * 0.12); d += 0.035 + Math.random() * 0.05; }
      } else { crack(a, t + 0.03, 0.07); crack(a, t + 0.09, 0.05); }
      break;
    case 'midautumn': {
      const notes = [1568, 1760, 2093, 2349, 2637];
      if (capture) notes.forEach((f, i) => tone(a, t + i * 0.09 + Math.random() * 0.04, f, 0.05, 1.3, 'sine'));
      else tone(a, t + 0.04, notes[Math.floor(Math.random() * notes.length)], 0.03, 0.9, 'sine');
      break;
    }
  }
}

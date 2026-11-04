/** Small deterministic 32-bit PRNG (xorshift32). Returns a generator of signed ints. */
export function rng32(seed: number): () => number {
  let x = seed | 0 || 1;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return x | 0;
  };
}

/** Uniform float in [0, 1) from a seeded generator. */
export function rngFloat(seed: number): () => number {
  const next = rng32(seed);
  return () => (next() >>> 0) / 4294967296;
}

export function shuffle<T>(arr: T[], random: () => number = Math.random): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

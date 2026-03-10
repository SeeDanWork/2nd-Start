/**
 * Deterministic pseudo-random sampling driven by seed + key.
 * Uses a simple string hash for reproducibility without external deps.
 */
export class DeterministicEventSampler {
  /**
   * Returns a deterministic float in [0, 1) for the given seed+key combo.
   */
  sampleProbability(input: { seed: string; key: string }): number {
    const hash = this.hashString(`${input.seed}:${input.key}`);
    // Normalize to [0, 1)
    return (hash >>> 0) / 4294967296;
  }

  /**
   * Returns true if the sampled probability is below the threshold.
   */
  sampleBoolean(input: { seed: string; key: string; threshold: number }): boolean {
    return this.sampleProbability({ seed: input.seed, key: input.key }) < input.threshold;
  }

  /**
   * Pick one item deterministically from an array.
   */
  sampleItem<T>(items: T[], seed: string, key: string): T {
    const prob = this.sampleProbability({ seed, key });
    const idx = Math.floor(prob * items.length);
    return items[Math.min(idx, items.length - 1)];
  }

  /**
   * Deterministic string hash with avalanche mixing.
   * Uses a simple accumulator followed by murmur-style finalization
   * to ensure good distribution even when inputs differ minimally.
   */
  private hashString(str: string): number {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = Math.imul(31, h) + str.charCodeAt(i) | 0;
    }
    // Murmur3 finalizer — ensures avalanche effect
    h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
    h ^= h >>> 16;
    return h;
  }
}

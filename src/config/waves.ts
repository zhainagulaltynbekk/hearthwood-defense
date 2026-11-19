import type { EnemyType } from './balance';

export interface SpawnGroup {
  enemy: EnemyType;
  count: number;
  /** Seconds between spawns inside the group. */
  interval: number;
  /** Seconds after the wave starts before this group begins. */
  delay: number;
}

export interface WaveDef {
  groups: readonly SpawnGroup[];
  /** Enemy max HP multiplier for this wave. */
  hpScale: number;
  /** Extra gold-per-kill multiplier (keeps economy pace with HP growth). */
  goldScale: number;
}

const g = (enemy: EnemyType, count: number, interval: number, delay = 0): SpawnGroup => ({ enemy, count, interval, delay });

/**
 * 20 waves. Bosses on every 5th wave. Difficulty grows through HP scaling,
 * denser spawn intervals and mixing enemy types that counter single towers
 * (armored vs. archers, flyers vs. cannons, fast vs. slow-firing towers).
 */
export const WAVES: readonly WaveDef[] = [
  /* 1 */ { hpScale: 1.05, goldScale: 1, groups: [g('basic', 10, 1.1)] },
  /* 2 */ { hpScale: 1.13, goldScale: 1, groups: [g('basic', 14, 0.9)] },
  /* 3 */ { hpScale: 1.2, goldScale: 1, groups: [g('basic', 10, 0.9), g('fast', 6, 0.7, 5)] },
  /* 4 */ { hpScale: 1.28, goldScale: 1, groups: [g('fast', 12, 0.6), g('basic', 10, 0.8, 4)] },
  /* 5 */ { hpScale: 1.37, goldScale: 1, groups: [g('basic', 12, 0.8), g('boss', 1, 1, 7)] },
  /* 6 */ { hpScale: 1.46, goldScale: 1, groups: [g('armored', 8, 1.4), g('basic', 12, 0.7, 3)] },
  /* 7 */ { hpScale: 1.56, goldScale: 1, groups: [g('flying', 10, 1.0), g('basic', 14, 0.7, 4)] },
  /* 8 */ { hpScale: 1.69, goldScale: 1, groups: [g('fast', 14, 0.5), g('armored', 6, 1.4, 6)] },
  /* 9 */ { hpScale: 1.84, goldScale: 1, groups: [g('flying', 12, 0.8), g('armored', 8, 1.2, 3), g('basic', 12, 0.6, 8)] },
  /* 10 */ { hpScale: 2.02, goldScale: 1, groups: [g('armored', 10, 1.0), g('fast', 10, 0.5, 4), g('boss', 1, 1, 10)] },
  /* 11 */ { hpScale: 2.26, goldScale: 0.95, groups: [g('basic', 22, 0.45), g('flying', 12, 0.7, 6)] },
  /* 12 */ { hpScale: 2.52, goldScale: 0.9, groups: [g('armored', 14, 0.9), g('fast', 18, 0.4, 5)] },
  /* 13 */ { hpScale: 2.79, goldScale: 0.9, groups: [g('flying', 20, 0.55), g('armored', 10, 0.9, 6)] },
  /* 14 */ { hpScale: 3.1, goldScale: 0.85, groups: [g('basic', 32, 0.33), g('fast', 22, 0.33, 4)] },
  /* 15 */ { hpScale: 3.46, goldScale: 0.85, groups: [g('armored', 12, 0.8), g('flying', 12, 0.6, 4), g('boss', 2, 5, 9)] },
  /* 16 */ { hpScale: 3.86, goldScale: 0.8, groups: [g('armored', 24, 0.6), g('fast', 22, 0.32, 6)] },
  /* 17 */ { hpScale: 4.28, goldScale: 0.8, groups: [g('flying', 26, 0.45), g('basic', 22, 0.4, 3), g('armored', 10, 0.8, 10)] },
  /* 18 */ { hpScale: 4.77, goldScale: 0.75, groups: [g('fast', 44, 0.24), g('armored', 18, 0.6, 6)] },
  /* 19 */ { hpScale: 5.28, goldScale: 0.75, groups: [g('flying', 30, 0.38), g('armored', 24, 0.5, 4), g('basic', 30, 0.3, 9)] },
  /* 20 */ { hpScale: 5.65, goldScale: 0.75, groups: [g('armored', 20, 0.5), g('flying', 22, 0.4, 3), g('fast', 30, 0.25, 8), g('boss', 3, 4, 12)] },
];

export const BOSS_WAVE_INTERVAL = 5;

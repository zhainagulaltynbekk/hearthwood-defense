/**
 * All gameplay numbers live here. Times are in seconds, distances in world
 * pixels (one tile = 56 px), speeds in pixels per second.
 */

export type TowerType = 'archer' | 'cannon' | 'frost' | 'mage';
export type EnemyType = 'basic' | 'fast' | 'armored' | 'flying' | 'boss';
export type DamageType = 'physical' | 'magic';
export type TargetMode = 'first' | 'strongest' | 'closest';
export type ProjectileKind = 'arrow' | 'cannonball' | 'frostbolt';

export const TARGET_MODES: readonly TargetMode[] = ['first', 'strongest', 'closest'];
export const TARGET_MODE_LABEL: Record<TargetMode, string> = {
  first: 'First',
  strongest: 'Strongest',
  closest: 'Closest',
};

export interface TowerLevelStats {
  /** Gold to build (level 1) or to upgrade into this level (levels 2 and 3). */
  cost: number;
  damage: number;
  /** Seconds between shots. */
  fireInterval: number;
  range: number;
  /** Cannon explosion / frost burst radius. 0 = single target. */
  splashRadius: number;
  /** Speed multiplier applied to slowed enemies (0.6 = 40% slow). 1 = no slow. */
  slowFactor: number;
  slowDuration: number;
  /** Mage: number of extra jumps after the first target. */
  chainCount: number;
  chainRange: number;
  /** Mage: damage multiplier per jump. */
  chainFalloff: number;
  projectileSpeed: number;
}

export interface TowerDef {
  type: TowerType;
  name: string;
  blurb: string;
  damageType: DamageType;
  hitsAir: boolean;
  /** null = instant hit (chain lightning). */
  projectile: ProjectileKind | null;
  /** Turret turn speed (radians per second, eased). */
  turnSpeed: number;
  levels: readonly [TowerLevelStats, TowerLevelStats, TowerLevelStats];
}

const base = {
  splashRadius: 0,
  slowFactor: 1,
  slowDuration: 0,
  chainCount: 0,
  chainRange: 0,
  chainFalloff: 1,
  projectileSpeed: 0,
};

export const TOWERS: Record<TowerType, TowerDef> = {
  archer: {
    type: 'archer',
    name: 'Archer',
    blurb: 'Fast single-target shots. Hits flyers.',
    damageType: 'physical',
    hitsAir: true,
    projectile: 'arrow',
    turnSpeed: 14,
    levels: [
      { ...base, cost: 70, damage: 12, fireInterval: 0.6, range: 150, projectileSpeed: 720 },
      { ...base, cost: 65, damage: 17, fireInterval: 0.52, range: 162, projectileSpeed: 760 },
      { ...base, cost: 120, damage: 27, fireInterval: 0.42, range: 178, projectileSpeed: 820 },
    ],
  },
  cannon: {
    type: 'cannon',
    name: 'Cannon',
    blurb: 'Slow, heavy splash damage. Ground only.',
    damageType: 'physical',
    hitsAir: false,
    projectile: 'cannonball',
    turnSpeed: 5,
    levels: [
      { ...base, cost: 120, damage: 30, fireInterval: 1.7, range: 140, splashRadius: 58, projectileSpeed: 420 },
      { ...base, cost: 105, damage: 48, fireInterval: 1.55, range: 150, splashRadius: 68, projectileSpeed: 440 },
      { ...base, cost: 180, damage: 78, fireInterval: 1.4, range: 162, splashRadius: 82, projectileSpeed: 460 },
    ],
  },
  frost: {
    type: 'frost',
    name: 'Frost',
    blurb: 'Chilling bolts slow enemies in a small burst.',
    damageType: 'magic',
    hitsAir: true,
    projectile: 'frostbolt',
    turnSpeed: 9,
    levels: [
      { ...base, cost: 90, damage: 5, fireInterval: 1.0, range: 130, splashRadius: 36, slowFactor: 0.6, slowDuration: 1.8, projectileSpeed: 520 },
      { ...base, cost: 80, damage: 8, fireInterval: 0.9, range: 140, splashRadius: 44, slowFactor: 0.5, slowDuration: 2.2, projectileSpeed: 560 },
      { ...base, cost: 140, damage: 13, fireInterval: 0.8, range: 152, splashRadius: 54, slowFactor: 0.4, slowDuration: 2.6, projectileSpeed: 600 },
    ],
  },
  mage: {
    type: 'mage',
    name: 'Mage',
    blurb: 'Chain lightning jumps between enemies.',
    damageType: 'magic',
    hitsAir: true,
    projectile: null,
    turnSpeed: 10,
    levels: [
      { ...base, cost: 150, damage: 24, fireInterval: 1.35, range: 145, chainCount: 2, chainRange: 95, chainFalloff: 0.8 },
      { ...base, cost: 130, damage: 36, fireInterval: 1.2, range: 155, chainCount: 3, chainRange: 105, chainFalloff: 0.82 },
      { ...base, cost: 210, damage: 54, fireInterval: 1.05, range: 168, chainCount: 5, chainRange: 115, chainFalloff: 0.85 },
    ],
  },
};

export const TOWER_ORDER: readonly TowerType[] = ['archer', 'cannon', 'frost', 'mage'];

export interface EnemyDef {
  type: EnemyType;
  name: string;
  hp: number;
  /** Pixels per second along the path. */
  speed: number;
  gold: number;
  /** Lives lost when it reaches the exit. */
  livesCost: number;
  /** Fraction of physical damage ignored (0..1). */
  armor: number;
  /** Fraction of magic damage ignored (0..1). */
  magicResist: number;
  flying: boolean;
  /** Hit radius for splash / chain checks. */
  radius: number;
  /** How resistant to slows: final slow = 1 - (1 - slowFactor) * (1 - slowResist). */
  slowResist: number;
}

export const ENEMIES: Record<EnemyType, EnemyDef> = {
  basic: { type: 'basic', name: 'Goblin', hp: 60, speed: 52, gold: 7, livesCost: 1, armor: 0, magicResist: 0, flying: false, radius: 14, slowResist: 0 },
  fast: { type: 'fast', name: 'Fox Scout', hp: 40, speed: 100, gold: 7, livesCost: 1, armor: 0, magicResist: 0.1, flying: false, radius: 12, slowResist: 0 },
  armored: { type: 'armored', name: 'Shell Knight', hp: 150, speed: 38, gold: 14, livesCost: 2, armor: 0.5, magicResist: 0, flying: false, radius: 16, slowResist: 0.2 },
  flying: { type: 'flying', name: 'Bat Wisp', hp: 64, speed: 72, gold: 10, livesCost: 1, armor: 0, magicResist: 0.15, flying: true, radius: 14, slowResist: 0 },
  boss: { type: 'boss', name: 'Ogre Chief', hp: 1300, speed: 30, gold: 120, livesCost: 8, armor: 0.3, magicResist: 0.2, flying: false, radius: 26, slowResist: 0.5 },
};

export const ECONOMY = {
  startGold: 250,
  startLives: 20,
  /** Fraction of total gold invested returned when selling. */
  sellRatio: 0.7,
  /** Seconds between the end of a wave's spawning and the next wave. */
  waveBreak: 14,
  /** Gold per second remaining on the timer when calling the next wave early. */
  earlyCallGoldPerSecond: 2,
  /** Gold awarded when a wave starts (from wave 2): base + perWave * waveNumber. */
  waveStartBonus: 20,
  waveStartBonusPerWave: 4,
} as const;

export const GAME_SPEEDS: readonly number[] = [1, 2];

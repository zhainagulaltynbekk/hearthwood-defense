import { ECONOMY, type EnemyType } from '../config/balance';
import { WAVES, type WaveDef } from '../config/waves';

export type SpawnFn = (type: EnemyType, hpScale: number, goldScale: number) => void;

interface GroupCursor {
  wave: WaveDef;
  groupIndex: number;
  remaining: number;
  nextAt: number;
}

/**
 * Schedules enemy spawns. Waves can overlap when the player calls the next
 * wave early. A break countdown starts once the newest wave has finished
 * spawning; when it runs out the next wave starts automatically.
 */
export class WaveManager {
  /** Number of waves started so far (0 before the first wave). */
  private started = 0;
  private elapsed = 0;
  private readonly cursors: GroupCursor[] = [];
  private breakLeft: number | null = null;

  constructor(private readonly spawn: SpawnFn) {}

  get totalWaves(): number {
    return WAVES.length;
  }

  get currentWave(): number {
    return this.started;
  }

  /** Seconds until the next wave auto-starts, or null if no countdown is running. */
  get timeToNextWave(): number | null {
    return this.breakLeft;
  }

  get allWavesSpawned(): boolean {
    return this.started >= WAVES.length && this.cursors.length === 0;
  }

  canCallNextWave(): boolean {
    if (this.started >= WAVES.length) return false;
    return this.started === 0 || this.breakLeft !== null;
  }

  /** Early-call gold bonus for calling the next wave right now. */
  earlyBonus(): number {
    if (this.breakLeft === null || this.started === 0) return 0;
    return Math.round(this.breakLeft * ECONOMY.earlyCallGoldPerSecond);
  }

  /** Starts the next wave. Returns the early-call bonus (0 if none) or -1 if not possible. */
  callNextWave(): number {
    if (!this.canCallNextWave()) return -1;
    const bonus = this.earlyBonus();
    this.startWave();
    return bonus;
  }

  update(dt: number): boolean {
    this.elapsed += dt;
    let waveAutoStarted = false;

    if (this.breakLeft !== null) {
      this.breakLeft -= dt;
      if (this.breakLeft <= 0) {
        this.startWave();
        waveAutoStarted = true;
      }
    }

    for (let i = this.cursors.length - 1; i >= 0; i--) {
      const c = this.cursors[i];
      const group = c.wave.groups[c.groupIndex];
      while (c.remaining > 0 && this.elapsed >= c.nextAt) {
        this.spawn(group.enemy, c.wave.hpScale, c.wave.goldScale);
        c.remaining--;
        c.nextAt += group.interval;
      }
      if (c.remaining <= 0) this.cursors.splice(i, 1);
    }

    if (this.cursors.length === 0 && this.breakLeft === null && this.started > 0 && this.started < WAVES.length) {
      this.breakLeft = ECONOMY.waveBreak;
    }
    return waveAutoStarted;
  }

  private startWave(): void {
    const wave = WAVES[this.started];
    this.started++;
    this.breakLeft = null;
    wave.groups.forEach((group, groupIndex) => {
      this.cursors.push({ wave, groupIndex, remaining: group.count, nextAt: this.elapsed + group.delay });
    });
  }
}

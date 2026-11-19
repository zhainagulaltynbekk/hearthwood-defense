import type { TargetMode } from '../config/balance';
import type { Enemy } from '../entities/Enemy';

/**
 * Stateless target selection over the live enemy list. Allocation-free:
 * plain loops, squared distances, no closures or temporary arrays.
 */
export class TargetingSystem {
  constructor(private readonly enemies: readonly Enemy[]) {}

  find(x: number, y: number, range: number, hitsAir: boolean, mode: TargetMode): Enemy | null {
    const list = this.enemies;
    const r2 = range * range;
    let best: Enemy | null = null;
    let bestScore = -Infinity;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (!e.alive || e.dist < 0) continue;
      if (e.flying && !hitsAir) continue;
      const dx = e.x - x;
      const dy = e.groundY - y;
      const d2 = dx * dx + dy * dy;
      if (d2 > r2) continue;
      let score: number;
      if (mode === 'first') score = e.dist;
      else if (mode === 'strongest') score = e.hp * 100000 + e.dist;
      else score = -d2;
      if (score > bestScore) {
        bestScore = score;
        best = e;
      }
    }
    return best;
  }

  inRange(e: Enemy, x: number, y: number, range: number): boolean {
    const dx = e.x - x;
    const dy = e.groundY - y;
    return dx * dx + dy * dy <= range * range;
  }

  /** Nearest living enemy to (x, y) within `range` whose uid is not in `exclude[0..excludeCount)`. */
  nearestExcluding(x: number, y: number, range: number, hitsAir: boolean, exclude: Int32Array, excludeCount: number): Enemy | null {
    const list = this.enemies;
    let best: Enemy | null = null;
    let bestD2 = range * range;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (!e.alive || (e.flying && !hitsAir)) continue;
      let skip = false;
      for (let k = 0; k < excludeCount; k++) {
        if (exclude[k] === e.uid) {
          skip = true;
          break;
        }
      }
      if (skip) continue;
      const dx = e.x - x;
      const dy = e.y - y;
      const d2 = dx * dx + dy * dy;
      if (d2 <= bestD2) {
        bestD2 = d2;
        best = e;
      }
    }
    return best;
  }
}

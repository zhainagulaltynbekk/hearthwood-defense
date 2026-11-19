import Phaser from 'phaser';
import { TOWERS, TARGET_MODES, type TargetMode, type TowerDef, type TowerLevelStats, type TowerType } from '../config/balance';
import { DEPTH } from '../config/layout';
import { PALETTE } from '../config/palette';
import { artScale } from '../art/TextureFactory';
import type { Enemy } from './Enemy';
import type { TargetingSystem } from '../systems/TargetingSystem';
import type { Vec2 } from '../systems/PathSystem';

export interface TowerHost {
  readonly targeting: TargetingSystem;
  fireProjectile(tower: Tower, target: Enemy): void;
  fireLightning(tower: Tower, target: Enemy): void;
}

const TURRET_LIFT = 7;
const RETARGET_INTERVAL = 0.1;
const MAX_LEVEL = 3;

export class Tower {
  readonly def: TowerDef;
  readonly col: number;
  readonly row: number;
  readonly x: number;
  readonly y: number;
  level = 1;
  invested: number;
  targetMode: TargetMode = 'first';
  readonly base: Phaser.GameObjects.Image;
  readonly turret: Phaser.GameObjects.Image;
  readonly shadow: Phaser.GameObjects.Image;
  private target: Enemy | null = null;
  private targetUid = 0;
  private cooldown = 0;
  private retarget = 0;
  private aim = 0;
  private recoil = 0;
  private idleTime = Math.random() * 10;
  /** Total kills, shown in the info panel. */
  kills = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    type: TowerType,
    col: number,
    row: number,
    x: number,
    y: number,
  ) {
    this.def = TOWERS[type];
    this.col = col;
    this.row = row;
    this.x = x;
    this.y = y;
    this.invested = this.def.levels[0].cost;
    this.aim = -Math.PI / 2 + (Math.random() - 0.5);

    this.shadow = scene.add.image(x, y + 16, 'shadow').setScale(0.55).setAlpha(0.9).setDepth(DEPTH.groundFx);
    this.base = scene.add.image(x, y, this.baseKey()).setDepth(DEPTH.worldBase + y);
    this.turret = scene.add.image(x, y - TURRET_LIFT, this.turretKey()).setDepth(DEPTH.worldBase + y + 0.5);
    this.applyScale();
    this.turret.rotation = this.aim;
    this.updateGlow();
  }

  private glow: Phaser.Filters.Glow | null = null;

  /** Max-level towers gain a glow (gold, or their magic colour). Limited to level 3 to keep filter passes cheap. */
  private updateGlow(): void {
    const magic = this.def.type === 'mage' || this.def.type === 'frost';
    if (this.level < 3) return;
    if (!this.glow) {
      this.turret.enableFilters();
      this.glow = this.turret.filters!.internal.addGlow(PALETTE.gold, 2, 0, 1, false, 0.1, 10);
    }
    const color = this.def.type === 'mage' ? PALETTE.arcane : this.def.type === 'frost' ? PALETTE.ice : PALETTE.gold;
    this.glow.color = this.level >= 3 && !magic ? PALETTE.gold : color;
    this.glow.outerStrength = 1.2 + this.level * 0.8;
  }

  get type(): TowerType {
    return this.def.type;
  }

  get stats(): TowerLevelStats {
    return this.def.levels[this.level - 1];
  }

  get canUpgrade(): boolean {
    return this.level < MAX_LEVEL;
  }

  get upgradeCost(): number {
    return this.canUpgrade ? this.def.levels[this.level].cost : 0;
  }

  get aimAngle(): number {
    return this.aim;
  }

  private baseKey(): string {
    return `tower_${this.def.type}_base_${this.level}`;
  }

  private turretKey(): string {
    return `tower_${this.def.type}_turret_${this.level}`;
  }

  private applyScale(): void {
    this.base.setScale(artScale(this.scene, this.base.texture.key));
    this.turret.setScale(artScale(this.scene, this.turret.texture.key));
  }

  /** Muzzle position in world space. */
  muzzle(out: Vec2): Vec2 {
    const len = this.def.type === 'cannon' ? 24 : this.def.type === 'archer' ? 20 : 16;
    out.x = this.x + Math.cos(this.aim) * len;
    out.y = this.y - TURRET_LIFT + Math.sin(this.aim) * len;
    return out;
  }

  upgrade(): void {
    if (!this.canUpgrade) return;
    this.invested += this.upgradeCost;
    this.level++;
    this.base.setTexture(this.baseKey());
    this.turret.setTexture(this.turretKey());
    this.applyScale();
    this.updateGlow();
  }

  cycleTargetMode(): TargetMode {
    const i = TARGET_MODES.indexOf(this.targetMode);
    this.targetMode = TARGET_MODES[(i + 1) % TARGET_MODES.length];
    this.retarget = 0;
    return this.targetMode;
  }

  update(dt: number, host: TowerHost): void {
    const s = this.stats;
    this.cooldown -= dt;
    this.retarget -= dt;

    const t = this.target;
    const valid = t !== null && t.alive && t.uid === this.targetUid && host.targeting.inRange(t, this.x, this.y, s.range);
    if (!valid || this.retarget <= 0) {
      this.retarget = RETARGET_INTERVAL;
      const found = host.targeting.find(this.x, this.y, s.range, this.def.hitsAir, this.targetMode);
      this.target = found;
      this.targetUid = found ? found.uid : 0;
    }

    let desired: number;
    const target = this.target;
    if (target) {
      desired = Math.atan2(target.y - (this.y - TURRET_LIFT), target.x - this.x);
    } else {
      this.idleTime += dt;
      desired = this.aim + Math.sin(this.idleTime * 0.7) * 0.004;
    }

    // eased rotation toward the desired angle (shortest path)
    const diff = Phaser.Math.Angle.Wrap(desired - this.aim);
    const ease = 1 - Math.exp(-this.def.turnSpeed * dt);
    this.aim = Phaser.Math.Angle.Wrap(this.aim + diff * ease);

    if (target && this.cooldown <= 0 && Math.abs(diff) < 0.28) {
      this.cooldown = s.fireInterval;
      this.recoil = this.def.type === 'cannon' ? 7 : this.def.type === 'archer' ? 4 : 3;
      if (this.def.projectile) host.fireProjectile(this, target);
      else host.fireLightning(this, target);
    }

    this.recoil = Math.max(0, this.recoil - dt * (this.def.type === 'cannon' ? 26 : 40));
    this.turret.rotation = this.aim;
    this.turret.x = this.x - Math.cos(this.aim) * this.recoil;
    this.turret.y = this.y - TURRET_LIFT - Math.sin(this.aim) * this.recoil;
  }

  destroy(): void {
    this.base.destroy();
    this.turret.destroy();
    this.shadow.destroy();
  }
}

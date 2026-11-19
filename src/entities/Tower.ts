import Phaser from 'phaser';
import { TOWERS, TARGET_MODES, type TargetMode, type TowerDef, type TowerLevelStats, type TowerType } from '../config/balance';
import { DEPTH } from '../config/layout';
import { PALETTE } from '../config/palette';
import { artScale } from '../art/TextureFactory';
import { BASE_DECK_Y, BASE_H } from '../art/world';
import { HERO_FEET_Y, HERO_H, WEAPON_PIVOT_X } from '../art/heroes';
import type { Enemy } from './Enemy';
import type { TargetingSystem } from '../systems/TargetingSystem';
import type { Vec2 } from '../systems/PathSystem';

export interface TowerHost {
  readonly targeting: TargetingSystem;
  fireProjectile(tower: Tower, target: Enemy): void;
  fireLightning(tower: Tower, target: Enemy): void;
}

/** Where the hero stands relative to the tile centre, and how big heroes are drawn. */
const BASE_OFFSET_Y = 6;
const DECK_Y = BASE_OFFSET_Y - (BASE_H / 2 - BASE_DECK_Y); // hero feet
const HERO_SCALE = 0.85;
const CHEST = 17 * HERO_SCALE; // weapon pivot above the feet
const TURRET_LIFT = -DECK_Y + CHEST;
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
  readonly hero: Phaser.GameObjects.Image;
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

    this.base = scene.add.image(x, y + BASE_OFFSET_Y, this.baseKey()).setDepth(DEPTH.worldBase + y);
    this.hero = scene.add.image(x, y + DECK_Y, this.heroKey()).setOrigin(0.5, HERO_FEET_Y / HERO_H).setDepth(DEPTH.worldBase + y + 0.4);
    this.turret = scene.add.image(x, y - TURRET_LIFT, this.turretKey()).setOrigin(WEAPON_PIVOT_X, 0.5).setDepth(DEPTH.worldBase + y + 0.5);
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

  private heroKey(): string {
    return `hero_${this.def.type}_${this.level}`;
  }

  private turretKey(): string {
    return `tower_${this.def.type}_turret_${this.level}`;
  }

  private applyScale(): void {
    this.base.setScale(artScale(this.scene, this.base.texture.key));
    this.hero.setScale(artScale(this.scene, this.hero.texture.key) * HERO_SCALE);
    this.turret.setScale(artScale(this.scene, this.turret.texture.key) * HERO_SCALE);
  }

  /** Muzzle position in world space. */
  muzzle(out: Vec2): Vec2 {
    const len = (this.def.type === 'cannon' ? 46 : this.def.type === 'archer' ? 48 : 38) * HERO_SCALE;
    out.x = this.x + Math.cos(this.aim) * len;
    out.y = this.y - TURRET_LIFT + Math.sin(this.aim) * len;
    return out;
  }

  upgrade(): void {
    if (!this.canUpgrade) return;
    this.invested += this.upgradeCost;
    this.level++;
    this.base.setTexture(this.baseKey());
    this.hero.setTexture(this.heroKey());
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
    // weapon goes behind the hero when aiming upward
    this.turret.setDepth(DEPTH.worldBase + this.y + (Math.sin(this.aim) < -0.35 ? 0.3 : 0.5));

    // hero faces the target, breathes while idle and squashes when firing
    this.idleTime += dt;
    const face = Math.cos(this.aim) < -0.15 ? true : Math.cos(this.aim) > 0.15 ? false : this.hero.flipX;
    this.hero.setFlipX(face);
    const hs = artScale(this.scene, this.hero.texture.key) * HERO_SCALE;
    const breathe = Math.sin(this.idleTime * 2.4) * 0.025;
    const punch = this.recoil * 0.018;
    this.hero.setScale(hs * (1 + punch), hs * (1 + breathe - punch));
  }

  destroy(): void {
    this.base.destroy();
    this.turret.destroy();
    this.hero.destroy();
  }
}

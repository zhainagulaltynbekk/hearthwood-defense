import Phaser from 'phaser';
import type { DamageType, ProjectileKind } from '../config/balance';
import { DEPTH } from '../config/layout';
import { artScale } from '../art/TextureFactory';
import type { Enemy } from './Enemy';
import type { Tower } from './Tower';

/** Pooled projectile. Arrows and frost bolts home in; cannonballs fly a ballistic arc to a predicted point. */
export class Projectile extends Phaser.GameObjects.Sprite {
  kind: ProjectileKind = 'arrow';
  source: Tower | null = null;
  damage = 0;
  damageType: DamageType = 'physical';
  splashRadius = 0;
  slowFactor = 1;
  slowDuration = 0;
  hitsAir = true;
  target: Enemy | null = null;
  private targetUid = 0;
  tx = 0;
  ty = 0;
  private speed = 0;
  private sx = 0;
  private sy = 0;
  private flightTime = 0;
  private t = 0;
  private arcHeight = 0;
  private baseScale = 0.5;
  private spin = 0;
  /** Ground position (for the cannonball arc). */
  gx = 0;
  gy = 0;

  constructor(scene: Phaser.Scene, x = 0, y = 0) {
    super(scene, x, y, 'proj_arrow');
  }

  launch(kind: ProjectileKind, source: Tower, x: number, y: number, target: Enemy, aimX: number, aimY: number, speed: number): this {
    const s = source.stats;
    this.kind = kind;
    this.source = source;
    this.damage = s.damage;
    this.damageType = source.def.damageType;
    this.splashRadius = s.splashRadius;
    this.slowFactor = s.slowFactor;
    this.slowDuration = s.slowDuration;
    this.hitsAir = source.def.hitsAir;
    this.target = target;
    this.targetUid = target.uid;
    this.speed = speed;
    this.sx = x;
    this.sy = y;
    this.tx = aimX;
    this.ty = aimY;
    this.t = 0;
    this.spin = 0;
    const key = kind === 'arrow' ? 'proj_arrow' : kind === 'cannonball' ? 'proj_cannonball' : 'proj_frostbolt';
    this.setTexture(key);
    this.baseScale = artScale(this.scene, key);
    this.setScale(this.baseScale).setAlpha(1).setPosition(x, y).setActive(true).setVisible(true);
    this.setDepth(DEPTH.projectile);
    if (kind === 'cannonball') {
      const d = Math.hypot(aimX - x, aimY - y);
      this.flightTime = Math.max(0.35, d / speed);
      this.arcHeight = 26 + d * 0.22;
    }
    this.rotation = Math.atan2(aimY - y, aimX - x);
    return this;
  }

  /** Advances the projectile; returns true when it reached its destination. */
  step(dt: number): boolean {
    if (this.kind === 'cannonball') {
      this.t += dt / this.flightTime;
      const t = Math.min(1, this.t);
      this.gx = this.sx + (this.tx - this.sx) * t;
      this.gy = this.sy + (this.ty - this.sy) * t;
      const h = Math.sin(Math.PI * t) * this.arcHeight;
      this.x = this.gx;
      this.y = this.gy - h;
      this.setScale(this.baseScale * (1 + h / this.arcHeight * 0.45));
      this.spin += dt * 9;
      this.rotation = this.spin;
      return t >= 1;
    }

    const tg = this.target;
    if (tg && tg.alive && tg.uid === this.targetUid) {
      this.tx = tg.x;
      this.ty = tg.y;
    } else {
      this.target = null;
    }
    const dx = this.tx - this.x;
    const dy = this.ty - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const move = this.speed * dt;
    this.rotation = Math.atan2(dy, dx);
    if (dist <= move + 4) {
      this.x = this.tx;
      this.y = this.ty;
      return true;
    }
    this.x += (dx / dist) * move;
    this.y += (dy / dist) * move;
    return false;
  }

  /** Target still valid (same pooled instance, alive)? */
  get hasLiveTarget(): boolean {
    return this.target !== null && this.target.alive && this.target.uid === this.targetUid;
  }

  recycle(): void {
    this.target = null;
    this.source = null;
    this.setActive(false).setVisible(false);
  }
}

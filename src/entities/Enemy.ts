import Phaser from 'phaser';
import { ENEMIES, type EnemyDef, type EnemyType } from '../config/balance';
import { DEPTH } from '../config/layout';
import { PALETTE } from '../config/palette';
import { artScale } from '../art/TextureFactory';
import type { PathSystem, Vec2 } from '../systems/PathSystem';

const FLASH_TIME = 0.07;
const FLY_HEIGHT = 26;
let nextUid = 1;

/**
 * Pooled enemy. Lives in a Phaser Group; `spawn` re-initialises a recycled
 * instance. The sprite's x/y is the visual position (including bob / hover);
 * `groundX/groundY` is the point on the path.
 */
export class Enemy extends Phaser.GameObjects.Sprite {
  def: EnemyDef = ENEMIES.basic;
  uid = 0;
  maxHp = 1;
  hp = 1;
  gold = 0;
  /** Distance travelled along the path. */
  dist = 0;
  groundX = 0;
  groundY = 0;
  alive = false;
  slowFactor = 1;
  slowTimer = 0;
  private flashTimer = 0;
  private bobPhase = 0;
  private baseScale = 0.5;
  private frameTimer = 0;
  private frame1 = false;
  private iceFxTimer = 0;
  readonly shadow: Phaser.GameObjects.Image;
  private readonly barBg: Phaser.GameObjects.Image;
  private readonly barFill: Phaser.GameObjects.Image;
  private readonly chill: Phaser.GameObjects.Image;
  private static readonly tmp: Vec2 = { x: 0, y: 0 };

  constructor(scene: Phaser.Scene, x = 0, y = 0) {
    super(scene, x, y, 'enemy_basic');
    this.shadow = scene.add.image(0, 0, 'shadow').setVisible(false).setDepth(DEPTH.groundFx);
    // Health bar as two batched quads (much cheaper than redrawing a Graphics every frame).
    this.barBg = scene.add.image(0, 0, 'p_bar').setOrigin(0, 0.5).setTint(PALETTE.ink).setAlpha(0.85).setVisible(false).setDepth(DEPTH.healthBars);
    this.barFill = scene.add.image(0, 0, 'p_bar').setOrigin(0, 0.5).setVisible(false).setDepth(DEPTH.healthBars + 1);
    this.chill = scene.add.image(0, 0, 'p_bar').setTint(PALETTE.ice).setVisible(false).setDepth(DEPTH.healthBars + 1);
    this.setOrigin(0.5, 0.62);
  }

  get flying(): boolean {
    return this.def.flying;
  }

  get isBoss(): boolean {
    return this.def.type === 'boss';
  }

  /** 0..1 progress along the path (used by "First" targeting). */
  get hpRatio(): number {
    return this.hp / this.maxHp;
  }

  spawn(type: EnemyType, hpScale: number, goldScale: number, path: PathSystem): this {
    const def = ENEMIES[type];
    this.def = def;
    this.uid = nextUid++;
    this.maxHp = Math.round(def.hp * hpScale);
    this.hp = this.maxHp;
    this.gold = Math.max(1, Math.round(def.gold * goldScale));
    this.dist = -Math.random() * 6;
    this.alive = true;
    this.slowFactor = 1;
    this.slowTimer = 0;
    this.flashTimer = 0;
    this.iceFxTimer = 0;
    this.bobPhase = Math.random() * Math.PI * 2;
    const key = type === 'flying' ? 'enemy_flying_0' : `enemy_${type}`;
    this.setTexture(key);
    this.baseScale = artScale(this.scene, key);
    this.setScale(this.baseScale).setAlpha(1).setAngle(0).setFlipX(false);
    this.setTintMode(Phaser.TintModes.MULTIPLY).clearTint();
    this.setActive(true).setVisible(true);
    const shadowScale = (type === 'boss' ? 1.15 : type === 'armored' ? 0.7 : 0.55) * 0.5;
    this.shadow.setScale(shadowScale).setAlpha(def.flying ? 0.5 : 1).setVisible(true);
    this.updatePosition(path, 0);
    return this;
  }

  applySlow(factor: number, duration: number): void {
    const effective = 1 - (1 - factor) * (1 - this.def.slowResist);
    if (effective < this.slowFactor || this.slowTimer <= 0) this.slowFactor = Math.min(this.slowFactor, effective);
    this.slowTimer = Math.max(this.slowTimer, duration);
    if (this.flashTimer <= 0) this.setTint(PALETTE.ice);
  }

  flash(): void {
    this.flashTimer = FLASH_TIME;
    this.setTintMode(Phaser.TintModes.FILL).setTint(PALETTE.cream);
  }

  /** Returns true when the frozen-particle effect should emit this frame. */
  step(dt: number, path: PathSystem): boolean {
    let emitIce = false;
    if (this.slowTimer > 0) {
      this.slowTimer -= dt;
      this.iceFxTimer -= dt;
      if (this.iceFxTimer <= 0) {
        this.iceFxTimer = 0.18;
        emitIce = true;
      }
      if (this.slowTimer <= 0) {
        this.slowFactor = 1;
        if (this.flashTimer <= 0) this.clearTint();
      }
    }
    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      if (this.flashTimer <= 0) {
        this.setTintMode(Phaser.TintModes.MULTIPLY);
        if (this.slowTimer > 0) this.setTint(PALETTE.ice);
        else this.clearTint();
      }
    }

    const speed = this.def.speed * this.slowFactor;
    this.dist += speed * dt;
    this.bobPhase += dt * (this.def.flying ? 7 : 4 + speed * 0.09);

    if (this.def.flying) {
      this.frameTimer -= dt;
      if (this.frameTimer <= 0) {
        this.frameTimer = 0.14;
        this.frame1 = !this.frame1;
        this.setTexture(this.frame1 ? 'enemy_flying_1' : 'enemy_flying_0');
      }
    }
    this.updatePosition(path, dt);
    this.updateBar();
    if (this.dist < 40) this.alpha = Math.max(0, Math.min(1, (this.dist + 6) / 40));
    else if (this.alpha < 1) this.alpha = 1;
    return emitIce;
  }

  private updatePosition(path: PathSystem, _dt: number): void {
    const p = Enemy.tmp;
    const seg = path.pointAt(this.dist, p);
    this.groundX = p.x;
    this.groundY = p.y;
    const dx = path.segmentDirX(seg);
    if (dx < -0.1) this.setFlipX(true);
    else if (dx > 0.1) this.setFlipX(false);

    const bob = Math.sin(this.bobPhase);
    if (this.def.flying) {
      this.x = p.x;
      this.y = p.y - FLY_HEIGHT + bob * 4;
      this.setDepth(DEPTH.flying + p.y);
      this.shadow.setPosition(p.x, p.y + 6);
    } else {
      const hop = Math.abs(bob);
      this.x = p.x;
      this.y = p.y - hop * (this.isBoss ? 3 : 4);
      this.angle = Math.cos(this.bobPhase) * (this.isBoss ? 2 : 5);
      this.scaleY = this.baseScale * (1 - (1 - hop) * 0.06);
      this.scaleX = this.baseScale * (1 + (1 - hop) * 0.04);
      this.setDepth(DEPTH.worldBase + p.y);
      this.shadow.setPosition(p.x, p.y + (this.isBoss ? 14 : 8));
    }
  }

  /** Positions the health bar; hidden while at full health (bosses always show it). */
  updateBar(): void {
    const show = this.alive && (this.hp < this.maxHp || this.isBoss);
    if (!show) {
      if (this.barBg.visible) {
        this.barBg.setVisible(false);
        this.barFill.setVisible(false);
        this.chill.setVisible(false);
      }
      return;
    }
    const w = this.isBoss ? 60 : 28;
    const x = this.x - w / 2;
    const y = this.y - this.barOffset - 4;
    const ratio = Math.max(0, this.hp / this.maxHp);
    this.barBg.setPosition(x - 1.5, y).setDisplaySize(w + 3, 7).setVisible(true);
    this.barFill
      .setPosition(x, y)
      .setDisplaySize(Math.max(1, w * ratio), 4)
      .setTint(ratio > 0.55 ? PALETTE.grass : ratio > 0.25 ? PALETTE.gold : PALETTE.berry)
      .setVisible(ratio > 0);
    this.chill.setVisible(this.slowTimer > 0);
    if (this.slowTimer > 0) this.chill.setPosition(x - 6, y).setDisplaySize(4, 4);
  }

  /** Visual height used to place the health bar. */
  get barOffset(): number {
    return this.isBoss ? 46 : this.def.flying ? 20 : this.def.type === 'armored' ? 22 : 20;
  }

  /** Called by the pool when the death animation finishes or the enemy leaks. */
  despawn(): void {
    this.alive = false;
    this.setActive(false).setVisible(false);
    this.shadow.setVisible(false);
    this.updateBar();
  }
}

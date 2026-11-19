import Phaser from 'phaser';
import { DEPTH, RENDER_SCALE, TOP_PAD } from '../config/layout';
import { FONT_FAMILY, PALETTE as P, css } from '../config/palette';
import type { TowerType } from '../config/balance';
import { NUMBER_FONT } from '../art/TextureFactory';

type Emitter = Phaser.GameObjects.Particles.ParticleEmitter;

const MAX_ARCS = 48;
const ARC_LIFE = 0.22;
const NUMBER_POOL = 80;
const WORD_POOL = 8;
const RING_POOL = 16;
const COIN_POOL = 24;
/** The HUD gold counter's position (UIScene draws it in the same 1280x720 space). */
const GOLD_COUNTER = { x: 38, y: 34 + TOP_PAD };

const MUZZLE_TINT: Record<TowerType, number> = {
  archer: P.gold,
  cannon: P.gold,
  frost: P.ice,
  mage: P.arcane,
};

interface FloatText {
  text: Phaser.GameObjects.Text | Phaser.GameObjects.BitmapText;
  bitmap: boolean;
  life: number;
  maxLife: number;
  vy: number;
}

const NUMERIC = /^[+\-0-9]+$/;

/**
 * All transient visuals: particle bursts, chain-lightning arcs, shockwave
 * rings and floating numbers. Emitters and text objects are created once and
 * reused; per-shot parameters are read through onEmit callbacks so no config
 * objects are allocated during play.
 */
export class EffectsManager {
  private readonly emitters: Emitter[] = [];
  private readonly sparks: Emitter;
  private readonly muzzleFx: Emitter;
  private readonly smoke: Emitter;
  private readonly debris: Emitter;
  private readonly debrisWood: Emitter;
  private readonly ice: Emitter;
  private readonly burst: Emitter;
  private readonly stars: Emitter;
  private readonly coins: Emitter;
  private readonly trail: Emitter;
  private readonly dust: Emitter;
  private readonly leaves: Emitter;

  private fxAngle = 0;
  private fxTint: number = P.cream;
  private trailTint: number = P.cream;

  private readonly arcs = new Float32Array(MAX_ARCS * 5);
  private arcCount = 0;
  private readonly boltOffsets = new Float32Array(32);
  private readonly lightning: Phaser.GameObjects.Graphics;

  private readonly numbers: FloatText[] = [];
  private readonly words: FloatText[] = [];
  private readonly rings: Phaser.GameObjects.Image[] = [];
  private readonly flyingCoins: Phaser.GameObjects.Image[] = [];
  private coinIndex = 0;
  private ringIndex = 0;
  private timeScale = 1;

  constructor(private readonly scene: Phaser.Scene) {
    const add = (key: string, cfg: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig, depth: number = DEPTH.fx): Emitter => {
      const e = scene.add.particles(0, 0, key, { emitting: false, ...cfg });
      e.setDepth(depth);
      this.emitters.push(e);
      return e;
    };
    const tintFx = { onEmit: () => this.fxTint };
    const angleFx = { onEmit: () => this.fxAngle + Phaser.Math.FloatBetween(-22, 22) };

    this.sparks = add('p_soft', { lifespan: { min: 160, max: 320 }, speed: { min: 70, max: 230 }, scale: { start: 0.42, end: 0 }, tint: tintFx, blendMode: 'ADD' });
    this.muzzleFx = add('p_soft', { lifespan: { min: 90, max: 170 }, speed: { min: 60, max: 170 }, angle: angleFx, scale: { start: 0.7, end: 0 }, tint: tintFx, blendMode: 'ADD' });
    this.smoke = add('p_smoke', { lifespan: { min: 500, max: 900 }, speed: { min: 8, max: 46 }, scale: { start: 0.35, end: 0.9 }, alpha: { start: 0.55, end: 0 }, tint: [P.stone, P.cream], rotate: { min: 0, max: 360 } });
    this.debris = add('p_chunk', { lifespan: { min: 500, max: 800 }, speed: { min: 110, max: 260 }, angle: { min: 200, max: 340 }, gravityY: 620, scale: { start: 0.6, end: 0.35 }, rotate: { start: 0, end: 540 } });
    this.debrisWood = add('p_chunk_wood', { lifespan: { min: 500, max: 800 }, speed: { min: 100, max: 220 }, angle: { min: 200, max: 340 }, gravityY: 620, scale: { start: 0.6, end: 0.35 }, rotate: { start: 0, end: -540 } });
    this.ice = add('p_ice', { lifespan: { min: 450, max: 800 }, speed: { min: 6, max: 34 }, scale: { start: 0.55, end: 0.15 }, alpha: { start: 1, end: 0 }, tint: [P.ice, P.cream], gravityY: -14, rotate: { min: 0, max: 360 } });
    this.burst = add('p_soft', { lifespan: { min: 280, max: 520 }, speed: { min: 50, max: 210 }, scale: { start: 0.75, end: 0 }, alpha: { start: 1, end: 0.2 }, tint: tintFx });
    this.stars = add('p_star', { lifespan: { min: 400, max: 750 }, speed: { min: 20, max: 90 }, scale: { start: 0.6, end: 0 }, tint: [P.gold, P.cream], blendMode: 'ADD', gravityY: -40, rotate: { min: 0, max: 90 } });
    this.coins = add('p_coin', { lifespan: { min: 450, max: 650 }, speed: { min: 70, max: 140 }, angle: { min: 235, max: 305 }, gravityY: 520, scale: { start: 0.9, end: 0.6 } });
    this.trail = add('p_soft', { lifespan: { min: 140, max: 240 }, speed: 0, scale: { start: 0.42, end: 0 }, alpha: { start: 0.8, end: 0 }, tint: { onEmit: () => this.trailTint }, blendMode: 'ADD' }, DEPTH.projectile - 1);
    this.dust = add('p_smoke', { lifespan: { min: 380, max: 620 }, speed: { min: 30, max: 90 }, angle: { min: 0, max: 360 }, scale: { start: 0.25, end: 0.6 }, alpha: { start: 0.65, end: 0 }, tint: [P.stone, P.cream] }, DEPTH.groundFx + 1);
    this.leaves = add('p_leaf', { lifespan: { min: 900, max: 1500 }, speed: { min: 10, max: 40 }, angle: { min: 20, max: 160 }, gravityY: 30, scale: { start: 0.7, end: 0.4 }, alpha: { start: 1, end: 0 }, rotate: { start: 0, end: 360 }, tint: [P.leaf, P.grass] });

    this.lightning = scene.add.graphics().setDepth(DEPTH.fx + 1).setBlendMode(Phaser.BlendModes.ADD);

    // numbers use a generated bitmap font (cheap to update); words use a few Text objects
    for (let i = 0; i < NUMBER_POOL; i++) {
      const text = scene.add.bitmapText(0, 0, NUMBER_FONT, '0', 16).setOrigin(0.5).setDepth(DEPTH.floatingText).setVisible(false).setActive(false);
      this.numbers.push({ text, bitmap: true, life: 0, maxLife: 1, vy: 0 });
    }
    for (let i = 0; i < WORD_POOL; i++) {
      const text = scene.add
        .text(0, 0, '', {
          fontFamily: FONT_FAMILY,
          fontSize: '16px',
          fontStyle: 'bold',
          color: css(P.cream),
          stroke: css(P.ink),
          strokeThickness: 4,
          resolution: RENDER_SCALE,
        })
        .setOrigin(0.5)
        .setDepth(DEPTH.floatingText)
        .setVisible(false)
        .setActive(false);
      this.words.push({ text, bitmap: false, life: 0, maxLife: 1, vy: 0 });
    }
    for (let i = 0; i < COIN_POOL; i++) {
      this.flyingCoins.push(scene.add.image(0, 0, 'icon_gold').setVisible(false).setDepth(DEPTH.floatingText + 1));
    }
    for (let i = 0; i < RING_POOL; i++) {
      this.rings.push(scene.add.image(0, 0, 'p_ring').setVisible(false).setDepth(DEPTH.groundFx + 2).setBlendMode(Phaser.BlendModes.ADD));
    }
  }

  /** Drifting pollen / firefly motes over the map. */
  startAmbient(x: number, y: number, w: number, h: number): void {
    const motes = this.scene.add.particles(0, 0, 'p_soft', {
      x: { min: x, max: x + w },
      y: { min: y, max: y + h },
      lifespan: { min: 3500, max: 6000 },
      speedX: { min: -10, max: 10 },
      speedY: { min: -14, max: -3 },
      scale: { start: 0.05, end: 0.3, ease: 'Sine.easeInOut' },
      alpha: { start: 0.9, end: 0 },
      tint: [P.gold, P.leaf, P.cream],
      frequency: 260,
      blendMode: 'ADD',
    });
    motes.setDepth(DEPTH.fx - 1);
    motes.fastForward(5000);
    this.emitters.push(motes);
    // cherry blossom petals drifting across the hollow
    const petals = this.scene.add.particles(0, 0, 'p_petal', {
      x: { min: x - 40, max: x + w },
      y: y - 20,
      lifespan: { min: 9000, max: 14000 },
      speedX: { min: 10, max: 34 },
      speedY: { min: 40, max: 70 },
      rotate: { start: 0, end: 540 },
      scale: { min: 0.35, max: 0.6 },
      alpha: { start: 0.95, end: 0.4 },
      frequency: 650,
    });
    petals.setDepth(DEPTH.fx - 1);
    petals.fastForward(12000);
    this.emitters.push(petals);
  }

  setTimeScale(scale: number): void {
    this.timeScale = scale;
    for (const e of this.emitters) e.timeScale = scale;
  }

  muzzle(type: TowerType, x: number, y: number, angleRad: number): void {
    this.fxAngle = Phaser.Math.RadToDeg(angleRad);
    this.fxTint = MUZZLE_TINT[type];
    this.muzzleFx.explode(type === 'cannon' ? 10 : 5, x, y);
    if (type === 'cannon') this.smoke.explode(3, x, y);
  }

  trailAt(kind: 'arrow' | 'cannonball' | 'frostbolt', x: number, y: number): void {
    this.trailTint = kind === 'frostbolt' ? P.ice : kind === 'cannonball' ? P.stone : P.cream;
    this.trail.emitParticleAt(x, y, 1);
  }

  impact(x: number, y: number, color: number, count = 5): void {
    this.fxTint = color;
    this.sparks.explode(count, x, y);
  }

  explosion(x: number, y: number, radius: number): void {
    this.fxTint = P.gold;
    this.sparks.explode(14, x, y);
    this.fxTint = P.berry;
    this.sparks.explode(6, x, y);
    this.smoke.explode(7, x, y);
    this.debris.explode(6, x, y);
    this.debrisWood.explode(3, x, y);
    this.ring(x, y, radius, P.gold, 0.9);
  }

  frostBurst(x: number, y: number, radius: number): void {
    this.ice.explode(8, x, y);
    this.fxTint = P.ice;
    this.sparks.explode(8, x, y);
    this.ring(x, y, radius, P.ice, 0.8);
  }

  frozenTick(x: number, y: number): void {
    this.ice.emitParticleAt(x + Phaser.Math.FloatBetween(-8, 8), y + Phaser.Math.FloatBetween(-8, 6), 1);
  }

  death(x: number, y: number, color: number, big: boolean): void {
    this.fxTint = color;
    this.burst.explode(big ? 40 : 14, x, y);
    this.fxTint = P.cream;
    this.burst.explode(big ? 16 : 6, x, y);
    this.smoke.explode(big ? 8 : 2, x, y);
    if (big) {
      this.stars.explode(20, x, y);
      this.ring(x, y, 90, P.cream, 1);
    }
  }

  /** Coins that arc from a kill to the gold counter in the HUD. */
  coinFly(x: number, y: number, count: number): void {
    for (let i = 0; i < count; i++) {
      const coin = this.flyingCoins[this.coinIndex];
      this.coinIndex = (this.coinIndex + 1) % this.flyingCoins.length;
      this.scene.tweens.killTweensOf(coin);
      const s = 0.4;
      coin.setPosition(x + Phaser.Math.Between(-10, 10), y - 10).setScale(s).setAlpha(1).setVisible(true);
      const delay = i * 70;
      this.scene.tweens.add({ targets: coin, y: coin.y - 30, duration: 180, delay, ease: 'Quad.easeOut' });
      this.scene.tweens.add({
        targets: coin,
        x: GOLD_COUNTER.x,
        y: GOLD_COUNTER.y,
        scale: 0.3,
        duration: 520,
        delay: delay + 180,
        ease: 'Cubic.easeIn',
        onComplete: () => coin.setVisible(false),
      });
    }
  }

  goldBurst(x: number, y: number, amount: number): void {
    this.coins.explode(Math.min(6, 1 + Math.floor(amount / 5)), x, y);
  }

  placeDust(x: number, y: number): void {
    this.dust.explode(12, x, y + 12);
    this.ring(x, y + 6, 34, P.cream, 0.6);
  }

  upgradeSparkle(x: number, y: number): void {
    this.stars.explode(18, x, y - 8);
    this.ring(x, y, 40, P.gold, 0.9);
  }

  sellPuff(x: number, y: number): void {
    this.dust.explode(14, x, y + 8);
    this.coins.explode(6, x, y);
  }

  leafRustle(x: number, y: number): void {
    this.leaves.explode(3, x, y);
  }

  private ring(x: number, y: number, radius: number, color: number, alpha: number): void {
    const img = this.rings[this.ringIndex];
    this.ringIndex = (this.ringIndex + 1) % this.rings.length;
    this.scene.tweens.killTweensOf(img);
    const target = (radius * 2) / 128; // ring texture is 64 logical px wide at 2x
    img.setPosition(x, y).setTint(color).setAlpha(alpha).setScale(target * 0.25).setVisible(true);
    this.scene.tweens.add({
      targets: img,
      scale: target,
      alpha: 0,
      duration: 360,
      ease: 'Cubic.easeOut',
      onComplete: () => img.setVisible(false),
    });
  }

  /** Adds a lightning arc between two points. */
  arc(x0: number, y0: number, x1: number, y1: number): void {
    if (this.arcCount >= MAX_ARCS) return;
    const o = this.arcCount * 5;
    this.arcs[o] = x0;
    this.arcs[o + 1] = y0;
    this.arcs[o + 2] = x1;
    this.arcs[o + 3] = y1;
    this.arcs[o + 4] = ARC_LIFE;
    this.arcCount++;
    this.fxTint = P.arcane;
    this.sparks.explode(4, x1, y1);
  }

  floatText(x: number, y: number, value: string, color: number, size = 16, life = 0.8): void {
    const pool = NUMERIC.test(value) ? this.numbers : this.words;
    let slot: FloatText | null = null;
    let oldest: FloatText | null = null;
    for (const t of pool) {
      if (!t.text.active) {
        slot = t;
        break;
      }
      if (!oldest || t.life < oldest.life) oldest = t;
    }
    if (!slot) slot = oldest;
    if (!slot) return;
    slot.life = life;
    slot.maxLife = life;
    slot.vy = -46;
    if (slot.bitmap) {
      (slot.text as Phaser.GameObjects.BitmapText).setTint(color);
    } else {
      (slot.text as Phaser.GameObjects.Text).setColor(css(color));
    }
    slot.text
      .setText(value)
      .setFontSize(size)
      .setPosition(x + Phaser.Math.FloatBetween(-6, 6), y)
      .setAlpha(1)
      .setScale(0.6)
      .setActive(true)
      .setVisible(true);
  }

  update(dt: number): void {
    this.updateTexts(this.numbers, dt);
    this.updateTexts(this.words, dt);

    // lightning arcs (re-jittered every frame for a crackling look)
    this.updateArcs(dt);
  }

  private updateTexts(pool: FloatText[], dt: number): void {
    for (const t of pool) {
      if (!t.text.active) continue;
      t.life -= dt;
      if (t.life <= 0) {
        t.text.setActive(false).setVisible(false);
        continue;
      }
      const k = 1 - t.life / t.maxLife;
      t.text.y += t.vy * dt;
      t.vy *= 1 - Math.min(1, dt * 2.5);
      t.text.setScale(k < 0.15 ? 0.6 + (k / 0.15) * 0.5 : 1.1 - Math.min(0.1, (k - 0.15) * 0.4));
      t.text.setAlpha(k > 0.65 ? 1 - (k - 0.65) / 0.35 : 1);
    }
  }

  private updateArcs(dt: number): void {
    const g = this.lightning;
    g.clear();
    let w = 0;
    for (let i = 0; i < this.arcCount; i++) {
      const o = i * 5;
      const life = this.arcs[o + 4] - dt;
      if (life <= 0) continue;
      const wo = w * 5;
      for (let k = 0; k < 4; k++) this.arcs[wo + k] = this.arcs[o + k];
      this.arcs[wo + 4] = life;
      w++;
      const a = life / ARC_LIFE;
      this.drawBolt(g, this.arcs[wo], this.arcs[wo + 1], this.arcs[wo + 2], this.arcs[wo + 3], a);
    }
    this.arcCount = w;
  }

  private drawBolt(g: Phaser.GameObjects.Graphics, x0: number, y0: number, x1: number, y1: number, alpha: number): void {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const segs = Math.min(this.boltOffsets.length, Math.max(4, Math.floor(len / 14)));
    for (let s = 1; s < segs; s++) this.boltOffsets[s] = (Math.random() - 0.5) * 16 * Math.sin((Math.PI * s) / segs);
    for (let pass = 0; pass < 2; pass++) {
      if (pass === 0) g.lineStyle(7, P.arcane, 0.4 * alpha);
      else g.lineStyle(2.4, P.cream, alpha);
      g.beginPath();
      g.moveTo(x0, y0);
      for (let s = 1; s < segs; s++) {
        const t = s / segs;
        const off = this.boltOffsets[s];
        g.lineTo(x0 + dx * t + nx * off, y0 + dy * t + ny * off);
      }
      g.lineTo(x1, y1);
      g.strokePath();
    }
  }

  get scale(): number {
    return this.timeScale;
  }
}

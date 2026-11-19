import Phaser from 'phaser';
import { PALETTE as P } from '../config/palette';
import { artScale } from '../art/TextureFactory';
import { makeText } from '../scenes/sceneUtils';
import { IS_TOUCH, TEX_RES } from '../config/layout';
import { bakeCanvas, drawButtonFace } from './bake';

const PAD = 4;

export interface ButtonOpts {
  width: number;
  height: number;
  label?: string;
  icon?: string;
  iconScale?: number;
  fontSize?: number;
  /** Fill color of the face. */
  color?: number;
  /** Small text in the bottom-right corner (e.g. a hotkey). */
  hint?: string;
  radius?: number;
  onClick: () => void;
  onHover?: (over: boolean) => void;
}

type State = 'normal' | 'hover' | 'pressed' | 'disabled';

/**
 * Rounded button with hover / pressed / disabled / toggled states, drawn in
 * code and baked to a cached texture per (size, colour, state). The container
 * is centered on (x, y).
 */
export class Button extends Phaser.GameObjects.Container {
  private readonly bg: Phaser.GameObjects.Image;
  readonly label: Phaser.GameObjects.Text | null = null;
  readonly icon: Phaser.GameObjects.Image | null = null;
  private readonly hintText: Phaser.GameObjects.Text | null = null;
  private state_: State = 'normal';
  private enabled = true;
  private toggled = false;
  private armed = false;
  private iconY = 0;
  private readonly opts: ButtonOpts;
  private readonly baseIconScale: number = 1;

  constructor(scene: Phaser.Scene, x: number, y: number, opts: ButtonOpts) {
    super(scene, x, y);
    this.opts = opts;
    this.bg = scene.add.image(0, 0, '__DEFAULT').setScale(1 / TEX_RES);
    this.add(this.bg);

    const hasLabel = opts.label !== undefined && opts.label !== '';
    if (opts.icon) {
      this.baseIconScale = artScale(scene, opts.icon) * (opts.iconScale ?? 1);
      const ix = hasLabel ? -opts.width / 2 + 10 + 12 * (opts.iconScale ?? 1) : 0;
      this.icon = scene.add.image(ix, 0, opts.icon).setScale(this.baseIconScale);
      this.add(this.icon);
    }
    if (hasLabel) {
      const lx = opts.icon ? 8 + 6 * (opts.iconScale ?? 1) : 0;
      this.label = makeText(scene, lx, 0, opts.label!, { size: opts.fontSize ?? 16, color: P.cream, stroke: P.ink, strokeThickness: 4 }).setOrigin(0.5);
      this.add(this.label);
    }
    if (opts.hint && !IS_TOUCH) {
      this.hintText = makeText(scene, opts.width / 2 - 6, opts.height / 2 - 4, opts.hint, { size: 10, color: P.stone }).setOrigin(1, 1);
      this.add(this.hintText);
    }

    this.setSize(opts.width, opts.height);
    this.setInteractive({ useHandCursor: true });
    this.on('pointerover', () => {
      if (!this.enabled) return;
      if (!this.armed) this.setButtonState('hover');
      opts.onHover?.(true);
    });
    this.on('pointerout', () => {
      this.armed = false;
      if (this.enabled) this.setButtonState('normal');
      opts.onHover?.(false);
    });
    this.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
      ev.stopPropagation();
      if (!this.enabled) return;
      this.armed = true;
      this.setButtonState('pressed');
    });
    this.on('pointerup', () => {
      // `armed` (not the visual state) decides the click: hover events can arrive between down and up.
      if (!this.enabled || !this.armed) return;
      this.armed = false;
      this.setButtonState('hover');
      opts.onClick();
    });
    scene.add.existing(this);
    this.redraw();
  }

  setEnabled(enabled: boolean): this {
    if (this.enabled === enabled) return this;
    this.enabled = enabled;
    this.setButtonState(enabled ? 'normal' : 'disabled');
    if (this.input) this.input.cursor = enabled ? 'pointer' : 'default';
    return this;
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  setToggled(on: boolean): this {
    if (this.toggled !== on) {
      this.toggled = on;
      this.redraw();
    }
    return this;
  }

  setLabel(text: string): this {
    this.label?.setText(text);
    return this;
  }

  /** Vertical offset of the icon inside the button. */
  setIconY(y: number): this {
    this.iconY = y;
    this.icon?.setY(y);
    return this;
  }

  setIcon(key: string): this {
    this.icon?.setTexture(key);
    return this;
  }

  private setButtonState(s: State): void {
    if (this.state_ === s) return;
    this.state_ = s;
    this.redraw();
  }

  private redraw(): void {
    const { width: w, height: h } = this.opts;
    const r = this.opts.radius ?? Math.min(14, h / 2);
    const face = this.opts.color ?? P.arcane;
    const s = this.state_;
    const toggled = this.toggled;
    const key = `btnc_${w}x${h}_${r}_${face.toString(16)}_${s}_${toggled ? 1 : 0}`;
    const tw = w + PAD * 2;
    const th = h + PAD * 2 + 4;
    bakeCanvas(this.scene, key, tw, th, (c) => drawButtonFace(c, w, h, PAD, r, face, s, toggled));
    this.bg.setTexture(key).setOrigin((PAD + w / 2) / tw, (PAD + h / 2) / th);
    const lift = s === 'pressed' ? 2 : 0;
    const alpha = s === 'disabled' ? 0.45 : 1;
    this.label?.setAlpha(alpha).setY(lift);
    this.icon?.setAlpha(alpha).setY(this.iconY + lift).setScale(this.baseIconScale * (s === 'hover' ? 1.06 : 1));
    this.hintText?.setAlpha(alpha * 0.9);
  }
}

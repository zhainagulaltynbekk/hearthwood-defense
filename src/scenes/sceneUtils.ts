import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, IS_TOUCH, RENDER_SCALE } from '../config/layout';
import { FONT_FAMILY, PALETTE as P, css } from '../config/palette';
import type { AudioManager } from '../systems/AudioManager';
import { bakeImage } from '../ui/bake';

/** Zooms the main camera so world coordinates are always 1280x720 regardless of render resolution. */
export function fitCamera(scene: Phaser.Scene): Phaser.Cameras.Scene2D.Camera {
  const cam = scene.cameras.main;
  cam.setZoom(RENDER_SCALE);
  cam.centerOn(GAME_WIDTH / 2, GAME_HEIGHT / 2);
  return cam;
}

export function getAudio(scene: Phaser.Scene): AudioManager {
  return scene.registry.get('audio') as AudioManager;
}

/** Unlocks Web Audio on the first gesture in this scene. */
export function unlockAudioOnGesture(scene: Phaser.Scene): void {
  const audio = getAudio(scene);
  const unlock = () => audio.unlock();
  scene.input.on('pointerdown', unlock);
  // touchstart is not a "user activation" on Android Chrome; touchend (pointerup) is
  scene.input.on('pointerup', unlock);
  scene.input.keyboard?.on('keydown', unlock);
}

export interface TextOpts {
  size?: number;
  color?: number;
  bold?: boolean;
  stroke?: number;
  strokeThickness?: number;
  align?: 'left' | 'center' | 'right';
  wrap?: number;
}

export function makeText(scene: Phaser.Scene, x: number, y: number, value: string, opts: TextOpts = {}): Phaser.GameObjects.Text {
  const style: Phaser.Types.GameObjects.Text.TextStyle = {
    fontFamily: FONT_FAMILY,
    fontSize: `${opts.size ?? 16}px`,
    fontStyle: opts.bold === false ? '500' : 'bold',
    color: css(opts.color ?? P.cream),
    align: opts.align ?? 'left',
    resolution: RENDER_SCALE,
  };
  if (opts.stroke !== undefined) {
    style.stroke = css(opts.stroke);
    style.strokeThickness = opts.strokeThickness ?? 4;
  }
  if (opts.wrap) style.wordWrap = { width: opts.wrap, useAdvancedWrap: true };
  return scene.add.text(x, y, value, style);
}

/** Rounded, semi-transparent dark panel with a gilded double rim and corner studs. */
export function drawPanel(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, radius = 14, alpha = 0.78): void {
  g.fillStyle(P.ink, 0.35).fillRoundedRect(x + 2, y + 4, w, h, radius);
  g.fillStyle(P.ink, alpha).fillRoundedRect(x, y, w, h, radius);
  // soft top sheen
  g.fillStyle(P.cream, 0.05).fillRoundedRect(x + 4, y + 4, w - 8, Math.min(22, h / 3), Math.min(radius - 3, 9));
  g.fillStyle(P.arcane, 0.06).fillRoundedRect(x + 4, y + h * 0.55, w - 8, h * 0.45 - 4, Math.min(radius - 3, 9));
  // gilded rims
  g.lineStyle(2, P.gold, 0.75).strokeRoundedRect(x + 1, y + 1, w - 2, h - 2, radius - 1);
  g.lineStyle(1, P.gold, 0.25).strokeRoundedRect(x + 5, y + 5, w - 10, h - 10, Math.max(2, radius - 5));
  // corner studs
  const stud = (cx: number, cy: number) => {
    g.fillStyle(P.ink, 1).fillCircle(cx, cy, 4.2);
    g.fillStyle(P.gold, 1).fillCircle(cx, cy, 3);
    g.fillStyle(P.cream, 0.8).fillCircle(cx - 0.8, cy - 0.8, 1.1);
  };
  const i = Math.min(radius * 0.45, 7);
  stud(x + i, y + i);
  stud(x + w - i, y + i);
  stud(x + i, y + h - i);
  stud(x + w - i, y + h - i);
}

/** A drawPanel baked into a cached texture and placed as an Image. */
export function panelImage(scene: Phaser.Scene, key: string, x: number, y: number, w: number, h: number, radius = 14, alpha = 0.78): Phaser.GameObjects.Image {
  return bakeImage(scene, key, x - 2, y - 2, w + 8, h + 10, (g) => drawPanel(g, x, y, w, h, radius, alpha));
}

/** Toggles fullscreen and, on phones, asks the browser to lock landscape. Call from a pointer-up handler. */
export function toggleFullscreen(scene: Phaser.Scene): void {
  const scale = scene.scale;
  if (scale.isFullscreen) {
    scale.stopFullscreen();
    return;
  }
  if (!scene.sys.game.device.fullscreen.available) return;
  scale.once(Phaser.Scale.Events.ENTER_FULLSCREEN, () => {
    const orientation = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
    if (IS_TOUCH && orientation?.lock) orientation.lock('landscape').catch(() => undefined);
  });
  scale.startFullscreen();
}

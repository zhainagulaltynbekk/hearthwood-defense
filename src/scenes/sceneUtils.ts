import Phaser from 'phaser';
import { BASE_HEIGHT, GAME_HEIGHT, GAME_WIDTH, IS_TOUCH, RENDER_SCALE } from '../config/layout';
import { FONT_FAMILY, PALETTE as P, css } from '../config/palette';
import type { AudioManager } from '../systems/AudioManager';
import { bakeCanvasImage, drawPanelCanvas } from '../ui/bake';

/**
 * Centres a 720 x 1280 design on screens that are taller (menu / game over):
 * returns the y offset to add to anything that should span the full height.
 */
export function centerDesign(scene: Phaser.Scene): number {
  const oy = (GAME_HEIGHT - BASE_HEIGHT) / 2;
  scene.cameras.main.centerOn(GAME_WIDTH / 2, BASE_HEIGHT / 2);
  return oy;
}

/** Zooms the main camera so world coordinates are always 720 wide regardless of render resolution. */
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

/** A premium jewel-toned panel baked into a cached texture and placed as an Image. */
export function panelImage(scene: Phaser.Scene, key: string, x: number, y: number, w: number, h: number, radius = 18, alpha = 0.9): Phaser.GameObjects.Image {
  return bakeCanvasImage(scene, key, x - 4, y - 4, w + 12, h + 14, (c) => drawPanelCanvas(c, 4, 4, w, h, radius, alpha));
}

/** Toggles fullscreen and, on phones, asks the browser to lock portrait. Call from a pointer-up handler. */
export function toggleFullscreen(scene: Phaser.Scene): void {
  const scale = scene.scale;
  if (scale.isFullscreen) {
    scale.stopFullscreen();
    return;
  }
  if (!scene.sys.game.device.fullscreen.available) return;
  scale.once(Phaser.Scale.Events.ENTER_FULLSCREEN, () => {
    const orientation = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
    if (IS_TOUCH && orientation?.lock) orientation.lock('portrait').catch(() => undefined);
  });
  scale.startFullscreen();
}

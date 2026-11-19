import Phaser from 'phaser';
import { TEX_RES } from '../config/layout';

/**
 * Static vector UI (panels, button faces) is drawn once with Graphics and
 * baked into a cached texture. A WebGL Graphics object re-tessellates every
 * frame, so keeping dozens of them alive costs far more than an Image.
 */
export function bakeTexture(scene: Phaser.Scene, key: string, w: number, h: number, draw: (g: Phaser.GameObjects.Graphics) => void, offsetX = 0, offsetY = 0): string {
  if (!scene.textures.exists(key)) {
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    g.scaleCanvas(TEX_RES, TEX_RES);
    g.translateCanvas(-offsetX, -offsetY);
    draw(g);
    g.generateTexture(key, Math.ceil(w * TEX_RES), Math.ceil(h * TEX_RES));
    g.destroy();
  }
  return key;
}

/** Bakes a drawing made in world coordinates over the region (x, y, w, h) and places it as an Image. */
export function bakeImage(scene: Phaser.Scene, key: string, x: number, y: number, w: number, h: number, draw: (g: Phaser.GameObjects.Graphics) => void): Phaser.GameObjects.Image {
  bakeTexture(scene, key, w, h, draw, x, y);
  return scene.add.image(x, y, key).setOrigin(0).setScale(1 / TEX_RES);
}

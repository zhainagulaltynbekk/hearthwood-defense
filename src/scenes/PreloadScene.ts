import Phaser from 'phaser';
import { SPRITE_PACK, USE_SPRITE_PACK } from '../config/assets';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/layout';
import { FONT_FAMILY, PALETTE as P } from '../config/palette';
import { TextureFactory } from '../art/TextureFactory';
import { fitCamera, makeText } from './sceneUtils';

/**
 * Loads the optional sprite pack (see config/assets.ts) and then generates
 * every remaining texture procedurally.
 */
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('PreloadScene');
  }

  preload(): void {
    fitCamera(this);
    const bar = this.add.graphics();
    const label = makeText(this, GAME_WIDTH / 2, GAME_HEIGHT / 2 - 30, 'Gathering acorns...', { size: 18, color: P.cream }).setOrigin(0.5);
    const draw = (p: number) => {
      bar.clear();
      bar.fillStyle(P.cream, 0.12).fillRoundedRect(GAME_WIDTH / 2 - 160, GAME_HEIGHT / 2, 320, 14, 7);
      bar.fillStyle(P.gold, 1).fillRoundedRect(GAME_WIDTH / 2 - 158, GAME_HEIGHT / 2 + 2, Math.max(10, 316 * p), 10, 5);
    };
    draw(0);
    this.load.on('progress', draw);
    this.load.once('complete', () => label.setText('Painting the hollow...'));
    if (USE_SPRITE_PACK) {
      for (const entry of SPRITE_PACK) this.load.image(entry.key, entry.file);
    }
  }

  create(): void {
    // Text and the bitmap number font are rasterised from the bundled web font, so wait for it (max 3 s).
    const fonts = Promise.all([document.fonts.load(`700 20px ${FONT_FAMILY}`), document.fonts.load(`500 20px ${FONT_FAMILY}`)]).catch(() => undefined);
    const timeout = new Promise((resolve) => setTimeout(resolve, 3000));
    void Promise.race([fonts, timeout]).then(() => this.generate());
  }

  private generate(): void {
    if (USE_SPRITE_PACK) {
      for (const entry of SPRITE_PACK) {
        if (this.textures.exists(entry.key)) (this.textures.get(entry.key).customData as { artScale?: number }).artScale = entry.scale;
      }
    }
    const factory = new TextureFactory(this);
    factory.generateAll();
    factory.destroy();
    this.scene.start('MenuScene');
  }
}

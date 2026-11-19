import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/layout';
import { PALETTE as P } from '../config/palette';
import { WAVES } from '../config/waves';
import { artScale } from '../art/TextureFactory';
import { Button } from '../ui/Button';
import { centerDesign, fitCamera, getAudio, makeText, panelImage, unlockAudioOnGesture } from './sceneUtils';

interface GameOverData {
  victory: boolean;
  wave: number;
  best: number;
  record: boolean;
}

/** Victory: the four heroes celebrate. Defeat: the Ogre King gloats. Both offer a restart. */
export class GameOverScene extends Phaser.Scene {
  private leaving = false;

  constructor() {
    super('GameOverScene');
  }

  create(data: GameOverData): void {
    this.leaving = false;
    const cam = fitCamera(this);
    const oy = centerDesign(this);
    unlockAudioOnGesture(this);
    const victory = data.victory;
    const cx = GAME_WIDTH / 2;

    if (this.textures.exists('terrain')) this.add.image(0, -oy, 'terrain').setOrigin(0).setScale(artScale(this, 'terrain'));
    this.add.rectangle(0, -oy, GAME_WIDTH, GAME_HEIGHT, P.ink, 0.55).setOrigin(0);
    cam.filters.internal.addVignette(0.5, 0.5, 0.85, 0.5, P.ink);

    this.add.particles(0, 0, victory ? 'p_star' : 'p_petal', {
      x: { min: 0, max: GAME_WIDTH },
      y: -20 - oy,
      lifespan: { min: 4000, max: 7000 },
      speedY: { min: 60, max: 150 },
      speedX: { min: -30, max: 30 },
      rotate: { start: 0, end: 360 },
      scale: { start: victory ? 0.8 : 0.6, end: 0.2 },
      alpha: { start: 1, end: 0.2 },
      tint: victory ? [P.gold, P.cream, P.berry, P.leaf, P.ice] : [P.cream],
      frequency: victory ? 50 : 160,
      blendMode: victory ? 'ADD' : 'NORMAL',
    });

    panelImage(this, 'ui_gameover_p', cx - 300, 300, 600, 640, 32, 0.93);

    // characters on top of the panel
    if (victory) {
      const heroes = ['hero_archer_3', 'hero_cannon_3', 'hero_frost_3', 'hero_mage_3'];
      heroes.forEach((key, i) => {
        const x = cx - 210 + i * 140;
        const h = this.add.image(x, 330, key).setOrigin(0.5, 0.95).setScale(artScale(this, key) * 1.7).setFlipX(i >= 2);
        this.tweens.add({ targets: h, y: 300, duration: 380 + i * 40, yoyo: true, repeat: -1, ease: 'Quad.easeOut', delay: i * 120 });
      });
    } else {
      const boss = this.add.image(cx, 330, 'enemy_boss').setOrigin(0.5, 0.92).setScale(artScale(this, 'enemy_boss') * 2.2);
      this.tweens.add({ targets: boss, scaleY: boss.scaleY * 1.06, angle: { from: -3, to: 3 }, duration: 260, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }

    const title = makeText(this, cx, 420, victory ? 'Victory!' : 'Defeat', { size: 84, color: victory ? P.gold : P.berry, stroke: P.ink, strokeThickness: 12 }).setOrigin(0.5);
    if (victory) Phaser.Actions.AddEffectShine(title, { duration: 2000, repeatDelay: 1200, colorFactor: [1.6, 1.4, 1.1, 1] } as Phaser.Types.Actions.AddEffectShineConfig);
    makeText(this, cx, 522, victory ? 'Blossom Hollow is safe!\nThe heroes cheer as the ogres flee.' : 'The ogres took the hollow...\nRegroup your heroes and try again!', {
      size: 24,
      color: P.cream,
      bold: false,
      align: 'center',
    })
      .setOrigin(0.5)
      .setLineSpacing(6);
    makeText(this, cx, 590, `Wave reached: ${data.wave} / ${WAVES.length}`, { size: 30, color: P.cream, stroke: P.ink, strokeThickness: 5 }).setOrigin(0.5);
    const best = makeText(this, cx, 640, data.record ? `New best: wave ${data.best}!` : `Best: wave ${data.best}`, {
      size: 24,
      color: data.record ? P.gold : P.stone,
    }).setOrigin(0.5);
    if (data.record) this.tweens.add({ targets: best, scale: 1.12, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    new Button(this, cx, 750, { width: 400, height: 76, label: 'Play again', icon: 'icon_play', fontSize: 30, color: P.pine, radius: 24, onClick: () => this.go('GameScene') });
    new Button(this, cx, 850, { width: 400, height: 66, label: 'Main menu', fontSize: 26, color: P.arcane, radius: 22, onClick: () => this.go('MenuScene') });

    this.input.keyboard?.once('keydown-ENTER', () => this.go('GameScene'));
    this.input.keyboard?.once('keydown-ESC', () => this.go('MenuScene'));
    cam.fadeIn(500, 30, 22, 51);
  }

  private go(scene: string): void {
    if (this.leaving) return;
    this.leaving = true;
    getAudio(this).play('click');
    this.cameras.main.fadeOut(280, 30, 22, 51);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start(scene));
  }
}

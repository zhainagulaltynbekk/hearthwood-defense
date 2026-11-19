import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/layout';
import { PALETTE as P } from '../config/palette';
import { WAVES } from '../config/waves';
import { artScale } from '../art/TextureFactory';
import { Button } from '../ui/Button';
import { panelImage, fitCamera, getAudio, makeText, unlockAudioOnGesture } from './sceneUtils';

interface GameOverData {
  victory: boolean;
  wave: number;
  best: number;
  record: boolean;
}

export class GameOverScene extends Phaser.Scene {
  private leaving = false;

  constructor() {
    super('GameOverScene');
  }

  create(data: GameOverData): void {
    this.leaving = false;
    const cam = fitCamera(this);
    unlockAudioOnGesture(this);
    const victory = data.victory;

    if (this.textures.exists('terrain')) this.add.image(0, 0, 'terrain').setOrigin(0).setScale(artScale(this, 'terrain'));
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, P.ink, 0.62).setOrigin(0);

    this.add.particles(0, 0, victory ? 'p_star' : 'p_soft', {
      x: { min: 0, max: GAME_WIDTH },
      y: victory ? -10 : { min: 0, max: GAME_HEIGHT },
      lifespan: { min: 2600, max: 4200 },
      speedY: victory ? { min: 40, max: 110 } : { min: -18, max: -6 },
      speedX: { min: -20, max: 20 },
      rotate: { min: 0, max: 360 },
      scale: { start: victory ? 0.7 : 0.35, end: 0.1 },
      alpha: { start: 1, end: 0 },
      tint: victory ? [P.gold, P.cream, P.berry, P.leaf, P.ice] : [P.arcane, P.ice],
      frequency: victory ? 60 : 140,
      blendMode: 'ADD',
    });

    panelImage(this, 'ui_gameover', GAME_WIDTH / 2 - 250, 150, 500, 390, 24, 0.9);

    const iconKey = victory ? 'icon_crown' : 'icon_heart';
    const icon = this.add.image(GAME_WIDTH / 2, 205, iconKey).setScale(artScale(this, iconKey) * 2.6);
    this.tweens.add({ targets: icon, angle: { from: -6, to: 6 }, duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    makeText(this, GAME_WIDTH / 2, 272, victory ? 'Victory!' : 'Defeat', { size: 54, color: victory ? P.gold : P.berry, stroke: P.ink, strokeThickness: 8 }).setOrigin(0.5);
    makeText(this, GAME_WIDTH / 2, 326, victory ? 'Mossy Hollow is safe. The ogres are gone.' : 'The hollow has fallen... but the hearth still glows.', {
      size: 16,
      color: P.cream,
      bold: false,
    }).setOrigin(0.5);
    makeText(this, GAME_WIDTH / 2, 370, `Wave reached: ${data.wave} / ${WAVES.length}`, { size: 20, color: P.cream }).setOrigin(0.5);
    const best = makeText(this, GAME_WIDTH / 2, 402, data.record ? `New best: wave ${data.best}!` : `Best: wave ${data.best}`, {
      size: 16,
      color: data.record ? P.gold : P.stone,
    }).setOrigin(0.5);
    if (data.record) this.tweens.add({ targets: best, scale: 1.12, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    new Button(this, GAME_WIDTH / 2 - 105, 480, { width: 190, height: 50, label: 'Play again', icon: 'icon_play', fontSize: 18, color: P.pine, onClick: () => this.go('GameScene') });
    new Button(this, GAME_WIDTH / 2 + 105, 480, { width: 190, height: 50, label: 'Main menu', fontSize: 18, color: P.arcane, onClick: () => this.go('MenuScene') });

    this.input.keyboard?.once('keydown-ENTER', () => this.go('GameScene'));
    this.input.keyboard?.once('keydown-ESC', () => this.go('MenuScene'));
    cam.fadeIn(500, 42, 34, 56);
  }

  private go(scene: string): void {
    if (this.leaving) return;
    this.leaving = true;
    getAudio(this).play('click');
    this.cameras.main.fadeOut(280, 42, 34, 56);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start(scene));
  }
}

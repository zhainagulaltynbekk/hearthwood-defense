import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, IS_TOUCH } from '../config/layout';
import { PALETTE as P } from '../config/palette';
import { WAVES } from '../config/waves';
import { MAP1 } from '../maps/map1';
import { TextureFactory, artScale } from '../art/TextureFactory';
import { PathSystem, type Vec2 } from '../systems/PathSystem';
import { SaveData } from '../systems/SaveData';
import { Button } from '../ui/Button';
import { fitCamera, getAudio, makeText, panelImage, toggleFullscreen, unlockAudioOnGesture } from './sceneUtils';

interface Walker {
  sprite: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Image;
  dist: number;
  speed: number;
  phase: number;
  scale: number;
  flying: boolean;
}

/**
 * Title screen: a living diorama of the map (enemies marching along the path,
 * towers on watch, fireflies) under a gilded panel with a crest and a shining title.
 */
export class MenuScene extends Phaser.Scene {
  private starting = false;
  private path!: PathSystem;
  private walkers: Walker[] = [];
  private readonly tmp: Vec2 = { x: 0, y: 0 };

  constructor() {
    super('MenuScene');
  }

  create(): void {
    this.starting = false;
    const cam = fitCamera(this);
    unlockAudioOnGesture(this);
    const audio = getAudio(this);

    this.path = new PathSystem(MAP1);
    const factory = new TextureFactory(this);
    factory.bakeTerrain(this.path, MAP1.seed);
    factory.destroy();
    this.add.image(0, 0, 'terrain').setOrigin(0).setScale(artScale(this, 'terrain'));

    // towers on watch
    const deco: [string, number, number][] = [
      ['icon_tower_archer', 252, 300],
      ['icon_tower_mage', 532, 412],
      ['icon_tower_frost', 812, 244],
      ['icon_tower_cannon', 1036, 524],
      ['icon_tower_archer', 980, 132],
    ];
    for (const [key, x, y] of deco) {
      this.add.image(x, y + 16, 'shadow').setScale(0.55);
      this.add.image(x, y, key).setScale(artScale(this, key)).setDepth(y);
    }

    // marching enemies
    this.walkers = [];
    const types = ['enemy_basic', 'enemy_fast', 'enemy_basic', 'enemy_armored', 'enemy_flying_0', 'enemy_basic', 'enemy_boss', 'enemy_fast'];
    types.forEach((key, i) => {
      const scale = artScale(this, key);
      this.walkers.push({
        sprite: this.add.image(0, 0, key).setScale(scale).setOrigin(0.5, 0.62),
        shadow: this.add.image(0, 0, 'shadow').setScale(key === 'enemy_boss' ? 0.55 : 0.28),
        dist: (i / types.length) * this.path.totalLength,
        speed: key === 'enemy_fast' ? 70 : key === 'enemy_boss' ? 24 : 40,
        phase: i,
        scale,
        flying: key.startsWith('enemy_flying'),
      });
    });

    // soft dusk wash so the panel pops
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, P.ink, 0.2).setOrigin(0).setDepth(900);
    cam.filters.internal.addVignette(0.5, 0.5, 0.9, 0.4, P.ink);

    this.add
      .particles(0, 0, 'p_soft', {
        x: { min: 0, max: GAME_WIDTH },
        y: { min: 0, max: GAME_HEIGHT },
        lifespan: { min: 2500, max: 4500 },
        speedX: { min: -12, max: 12 },
        speedY: { min: -22, max: -4 },
        scale: { start: 0.35, end: 0 },
        alpha: { start: 0.9, end: 0 },
        tint: [P.gold, P.leaf, P.cream],
        frequency: 90,
        blendMode: 'ADD',
      })
      .setDepth(950);

    const ui = this.add.container(0, 0).setDepth(1000);
    const panel = panelImage(this, 'ui_menu2', GAME_WIDTH / 2 - 270, 150, 540, 470, 26, 0.86);
    const crest = this.add.image(GAME_WIDTH / 2, 132, 'crest').setScale(artScale(this, 'crest') * 0.95);
    const title = makeText(this, GAME_WIDTH / 2, 262, 'Hearthwood', { size: 72, color: P.gold, stroke: P.ink, strokeThickness: 12 }).setOrigin(0.5);
    const sub = makeText(this, GAME_WIDTH / 2, 318, 'D E F E N S E', { size: 24, color: P.cream }).setOrigin(0.5);
    const best = SaveData.getBestWave();
    const bestText = makeText(this, GAME_WIDTH / 2, 356, best > 0 ? `Best: wave ${best} of ${WAVES.length}` : `Hold the hollow for ${WAVES.length} waves`, { size: 18, color: P.stone }).setOrigin(0.5);
    ui.add([panel, crest, title, sub, bestText]);

    // light glancing across the title
    Phaser.Actions.AddEffectShine(title, { duration: 2400, repeatDelay: 1800, colorFactor: [1.6, 1.4, 1.1, 1] } as Phaser.Types.Actions.AddEffectShineConfig);
    this.tweens.add({ targets: crest, y: 126, duration: 2400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    const play = new Button(this, GAME_WIDTH / 2, 430, {
      width: 290,
      height: 68,
      label: 'Play',
      icon: 'icon_play',
      fontSize: 30,
      color: P.pine,
      onClick: () => this.startGame(),
    });
    this.tweens.add({ targets: play, scale: 1.04, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    const mute = new Button(this, GAME_WIDTH / 2 - 80, 516, {
      width: 148,
      height: 46,
      label: audio.muted ? 'Sound off' : 'Sound on',
      icon: audio.muted ? 'icon_mute' : 'icon_sound',
      fontSize: 17,
      color: P.water,
      onClick: () => {
        const m = audio.toggleMute();
        mute.setLabel(m ? 'Sound off' : 'Sound on').setIcon(m ? 'icon_mute' : 'icon_sound');
        if (!m) audio.play('click');
      },
    });
    const fs = new Button(this, GAME_WIDTH / 2 + 80, 516, {
      width: 148,
      height: 46,
      label: 'Full screen',
      icon: 'icon_fullscreen',
      fontSize: 17,
      color: P.arcane,
      onClick: () => toggleFullscreen(this),
    });
    if (!this.sys.game.device.fullscreen.available) {
      fs.setVisible(false);
      mute.setX(GAME_WIDTH / 2);
    }
    const help = makeText(this, GAME_WIDTH / 2, 584, IS_TOUCH ? 'Tap a tower card, tap a tile twice to build.' : 'Mouse to build  -  1-4 towers  -  Space next wave  -  F speed  -  P pause', {
      size: 15,
      color: P.stone,
      bold: false,
      align: 'center',
    }).setOrigin(0.5);
    ui.add([play, mute, fs, help]);

    this.input.keyboard?.once('keydown-ENTER', () => this.startGame());
    cam.fadeIn(500, 42, 34, 56);
  }

  override update(_t: number, deltaMs: number): void {
    const dt = Math.min(deltaMs, 50) / 1000;
    const p = this.tmp;
    for (const w of this.walkers) {
      w.dist += w.speed * dt;
      if (w.dist > this.path.totalLength) w.dist = 0;
      w.phase += dt * (w.flying ? 8 : 6);
      const seg = this.path.pointAt(w.dist, p);
      const bob = Math.abs(Math.sin(w.phase));
      w.sprite.setFlipX(this.path.segmentDirX(seg) < -0.1);
      w.sprite.setPosition(p.x, p.y - (w.flying ? 26 + Math.sin(w.phase) * 4 : bob * 4)).setDepth(p.y + (w.flying ? 500 : 0));
      if (w.flying) w.sprite.setTexture(Math.sin(w.phase * 1.5) > 0 ? 'enemy_flying_0' : 'enemy_flying_1');
      w.shadow.setPosition(p.x, p.y + 8).setDepth(1);
    }
  }

  private startGame(): void {
    if (this.starting) return;
    this.starting = true;
    const audio = getAudio(this);
    audio.unlock();
    audio.play('click');
    // On phones, going fullscreen + landscape makes the game fill the screen.
    if (IS_TOUCH && !this.scale.isFullscreen) toggleFullscreen(this);
    this.cameras.main.fadeOut(350, 42, 34, 56);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('GameScene'));
  }
}

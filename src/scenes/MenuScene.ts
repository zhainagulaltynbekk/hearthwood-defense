import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, IS_TOUCH, MAP_Y, TILE } from '../config/layout';
import { TOWERS, type TowerType } from '../config/balance';
import { heroName } from './UIScene';
import { PALETTE as P } from '../config/palette';
import { WAVES } from '../config/waves';
import { MAP1 } from '../maps/map1';
import { TextureFactory, artScale } from '../art/TextureFactory';
import { PathSystem, type Vec2 } from '../systems/PathSystem';
import { SaveData } from '../systems/SaveData';
import { Button } from '../ui/Button';
import { centerDesign, fitCamera, getAudio, makeText, panelImage, toggleFullscreen, unlockAudioOnGesture } from './sceneUtils';

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
  private oy = 0;
  private path!: PathSystem;
  private walkers: Walker[] = [];
  private readonly tmp: Vec2 = { x: 0, y: 0 };

  constructor() {
    super('MenuScene');
  }

  create(): void {
    this.starting = false;
    const cam = fitCamera(this);
    const oy = centerDesign(this);
    this.oy = oy;
    unlockAudioOnGesture(this);
    const audio = getAudio(this);

    this.path = new PathSystem(MAP1);
    const factory = new TextureFactory(this);
    factory.bakeTerrain(this.path, MAP1.seed);
    factory.destroy();
    this.add.image(0, -oy, 'terrain').setOrigin(0).setScale(artScale(this, 'terrain'));

    // towers on watch
    const deco: [TowerType, number, number][] = [
      ['archer', 5, 3],
      ['frost', 1, 9],
      ['mage', 6, 9],
      ['cannon', 9, 6],
    ];
    for (const [type, col, row] of deco) {
      const x = (col + 0.5) * TILE;
      const y = MAP_Y + (row + 0.5) * TILE - oy;
      this.add.image(x, y + 6, `tower_${type}_base_2`).setScale(artScale(this, `tower_${type}_base_2`)).setDepth(y);
      const hero = this.add.image(x, y - 6, `hero_${type}_2`).setOrigin(0.5, 0.95).setScale(artScale(this, `hero_${type}_2`) * 0.85).setDepth(y + 0.5);
      this.tweens.add({ targets: hero, scaleY: hero.scaleY * 1.04, duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
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
    this.add.rectangle(0, -oy, GAME_WIDTH, GAME_HEIGHT, P.ink, 0.2).setOrigin(0).setDepth(900);
    cam.filters.internal.addVignette(0.5, 0.5, 0.9, 0.4, P.ink);

    this.add
      .particles(0, 0, 'p_soft', {
        x: { min: 0, max: GAME_WIDTH },
        y: { min: -oy, max: GAME_HEIGHT - oy },
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

    const cx = GAME_WIDTH / 2;
    const ui = this.add.container(0, 0).setDepth(1000);
    const panel = panelImage(this, 'ui_menu_p', cx - 320, 330, 640, 860, 36, 0.88);
    const crest = this.add.image(cx, 240, 'crest').setScale(artScale(this, 'crest') * 1.15);
    const title = makeText(this, cx, 420, 'Hearthwood', { size: 96, color: P.gold, stroke: P.ink, strokeThickness: 14 }).setOrigin(0.5);
    const sub = makeText(this, cx, 492, 'D E F E N S E', { size: 34, color: P.cream, stroke: P.ink, strokeThickness: 6 }).setOrigin(0.5);
    ui.add([panel, crest, title, sub]);

    // light glancing across the title
    Phaser.Actions.AddEffectShine(title, { duration: 2400, repeatDelay: 1800, colorFactor: [1.6, 1.4, 1.1, 1] } as Phaser.Types.Actions.AddEffectShineConfig);
    this.tweens.add({ targets: crest, y: 232, duration: 2400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // hero line-up
    const heroes: TowerType[] = ['archer', 'cannon', 'frost', 'mage'];
    heroes.forEach((type, i) => {
      const x = cx - 225 + i * 150;
      const glowRing = this.add.image(x, 712, 'p_ring').setScale(0.9, 0.3).setTint(P.gold).setAlpha(0.6).setBlendMode(Phaser.BlendModes.ADD);
      const h = this.add.image(x, 712, `hero_${type}_3`).setOrigin(0.5, 0.95).setScale(artScale(this, `hero_${type}_3`) * 1.55).setFlipX(i >= 2);
      this.tweens.add({ targets: h, y: 700, duration: 900 + i * 90, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: i * 140 });
      const name = makeText(this, x, 740, heroName(type), { size: 24, color: P.cream, stroke: P.ink, strokeThickness: 5 }).setOrigin(0.5);
      const role = makeText(this, x, 766, TOWERS[type].name, { size: 16, color: P.gold }).setOrigin(0.5);
      ui.add([glowRing, h, name, role]);
    });

    const play = new Button(this, cx, 870, {
      width: 440,
      height: 96,
      label: 'Play',
      icon: 'icon_play',
      iconScale: 1.4,
      fontSize: 44,
      color: P.pine,
      radius: 30,
      onClick: () => this.startGame(),
    });
    this.tweens.add({ targets: play, scale: 1.04, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    const mute = new Button(this, cx - 112, 990, {
      width: 210,
      height: 64,
      label: audio.muted ? 'Sound off' : 'Sound on',
      icon: audio.muted ? 'icon_mute' : 'icon_sound',
      fontSize: 22,
      color: P.water,
      radius: 20,
      onClick: () => {
        const m = audio.toggleMute();
        mute.setLabel(m ? 'Sound off' : 'Sound on').setIcon(m ? 'icon_mute' : 'icon_sound');
        if (!m) audio.play('click');
      },
    });
    const fs = new Button(this, cx + 112, 990, {
      width: 210,
      height: 64,
      label: 'Full screen',
      icon: 'icon_fullscreen',
      fontSize: 22,
      color: P.arcane,
      radius: 20,
      onClick: () => toggleFullscreen(this),
    });
    if (!this.sys.game.device.fullscreen.available) {
      fs.setVisible(false);
      mute.setX(cx);
    }
    const best = SaveData.getBestWave();
    const bestText = makeText(this, cx, 1070, best > 0 ? `Best: wave ${best} of ${WAVES.length}` : `Defend Blossom Hollow for ${WAVES.length} waves`, { size: 24, color: P.gold }).setOrigin(0.5);
    const help = makeText(this, cx, 1120, IS_TOUCH ? 'Tap a hero card, then tap a tile twice to build.' : 'Click a hero card, then a tile.  1-4 heroes  -  Space wave  -  F speed  -  P pause', {
      size: 18,
      color: P.stone,
      bold: false,
      align: 'center',
      wrap: 560,
    }).setOrigin(0.5);
    ui.add([play, mute, fs, bestText, help]);

    this.input.keyboard?.once('keydown-ENTER', () => this.startGame());
    cam.fadeIn(500, 30, 22, 51);
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
      w.sprite.setPosition(p.x, p.y - this.oy - (w.flying ? 26 + Math.sin(w.phase) * 4 : bob * 4)).setDepth(Math.min(850, p.y * 0.5 + (w.flying ? 300 : 0)));
      if (w.flying) w.sprite.setTexture(Math.sin(w.phase * 1.5) > 0 ? 'enemy_flying_0' : 'enemy_flying_1');
      w.shadow.setPosition(p.x, p.y + 8 - this.oy).setDepth(1);
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

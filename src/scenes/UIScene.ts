import Phaser from 'phaser';
import { ECONOMY, TARGET_MODE_LABEL, TOWER_ORDER, TOWERS, type TowerLevelStats, type TowerType } from '../config/balance';
import { DOCK_Y, GAME_HEIGHT, GAME_WIDTH, IS_TOUCH, MAP_Y, TILE, TOP_BAR_HEIGHT, TOP_PAD, EXTRA_HEIGHT } from '../config/layout';
import { PALETTE as P, css } from '../config/palette';
import { BOSS_WAVE_INTERVAL } from '../config/waves';
import { artScale } from '../art/TextureFactory';
import type { Tower } from '../entities/Tower';
import type { AudioManager } from '../systems/AudioManager';
import { GameEvents } from '../systems/GameEvents';
import { Button } from '../ui/Button';
import { bakeCanvasImage, drawDock, drawTopBar } from '../ui/bake';
import type { GameScene } from './GameScene';
import { fitCamera, getAudio, makeText, panelImage, toggleFullscreen } from './sceneUtils';

type Text = Phaser.GameObjects.Text;

interface ShopSlot {
  type: TowerType;
  button: Button;
  cost: Text;
}

const CARD_Y = DOCK_Y + 74;
const WAVE_BTN_Y = DOCK_Y + 176 + Math.round((EXTRA_HEIGHT - TOP_PAD) * 0.4);
const STAT_Y = DOCK_Y + 82;

const HINT_BUILD_TOUCH = 'Tap a tile to preview - tap it again to build';
const HINT_BUILD_KEYS = 'Click a tile to build - Shift keeps building - Esc cancels';

/**
 * HUD overlay on top of GameScene (portrait): a top bar with resources and
 * controls, and a bottom dock with the hero cards / selected tower panel
 * and a big wave button. Neither ever covers the map grid.
 */
export class UIScene extends Phaser.Scene {
  private game_!: GameScene;
  private audio!: AudioManager;

  private goldText!: Text;
  private goldIcon!: Phaser.GameObjects.Image;
  private shownGold = 0;
  private livesText!: Text;
  private heartIcon!: Phaser.GameObjects.Image;
  private waveText!: Text;
  private timerText!: Text;
  private hintText!: Text;
  private callButton!: Button;
  private speedButton!: Button;
  private pauseButton!: Button;
  private muteButton!: Button;

  private shop: ShopSlot[] = [];
  private shopLayer!: Phaser.GameObjects.Container;
  private infoLayer!: Phaser.GameObjects.Container;
  private infoTitle!: Text;
  private infoLevel!: Text;
  private infoIcon!: Phaser.GameObjects.Image;
  private infoCells: [Text, Text, Text][] = [];
  private targetButton!: Button;
  private upgradeButton!: Button;
  private sellButton!: Button;

  private toast!: Text;
  private banner!: Phaser.GameObjects.Container;
  private bannerText!: Text;
  private bannerRibbon!: Phaser.GameObjects.Image;
  private pauseLayer!: Phaser.GameObjects.Container;
  private hoverShop: TowerType | null = null;

  private readonly listeners: [string, (...args: never[]) => void][] = [];

  constructor() {
    super('UIScene');
  }

  create(): void {
    fitCamera(this);
    this.game_ = this.scene.get('GameScene') as GameScene;
    this.audio = getAudio(this);
    this.shop = [];
    this.infoCells = [];
    this.hoverShop = null;
    this.listeners.length = 0;

    this.buildTopBar();
    this.buildDock();
    this.buildOverlays();
    this.bindEvents();
    this.bindKeys();

    this.shownGold = this.game_.gold;
    this.goldText.setText(String(this.shownGold));
    this.livesText.setText(String(this.game_.lives));
    this.updateWave(this.game_.waveNumber, this.game_.totalWaves);
    this.updateTimer(null, this.game_.canCallNextWave());
    this.refreshShop();
    this.showSelection(null);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.unbindEvents());
  }

  // ------------------------------------------------------------ building --
  private buildTopBar(): void {
    bakeCanvasImage(this, 'ui_topbar_p', 0, 0, GAME_WIDTH, TOP_BAR_HEIGHT + 8, (c) => drawTopBar(c, GAME_WIDTH, TOP_BAR_HEIGHT, TOP_PAD));

    this.goldIcon = this.add.image(38, 34 + TOP_PAD, 'icon_gold').setScale(artScale(this, 'icon_gold') * 1.3);
    this.goldText = makeText(this, 60, 34 + TOP_PAD, '0', { size: 28, color: P.gold, stroke: P.ink, strokeThickness: 5 }).setOrigin(0, 0.5);
    this.heartIcon = this.add.image(198, 34 + TOP_PAD, 'icon_heart').setScale(artScale(this, 'icon_heart') * 1.25);
    this.livesText = makeText(this, 220, 34 + TOP_PAD, '20', { size: 28, color: P.cream, stroke: P.ink, strokeThickness: 5 }).setOrigin(0, 0.5);
    this.add.image(318, 34 + TOP_PAD, 'icon_wave').setScale(artScale(this, 'icon_wave') * 1.2);
    this.waveText = makeText(this, 340, 34 + TOP_PAD, '0/20', { size: 26, color: P.cream, stroke: P.ink, strokeThickness: 5 }).setOrigin(0, 0.5);

    const small = { width: 48, height: 48, color: P.water, radius: 14 };
    this.speedButton = new Button(this, 500, 34 + TOP_PAD, { ...small, icon: 'icon_speed', hint: 'F', onClick: () => this.game_.toggleSpeed() });
    this.pauseButton = new Button(this, 556, 34 + TOP_PAD, { ...small, icon: 'icon_pause', hint: 'P', onClick: () => this.togglePause() });
    this.muteButton = new Button(this, 612, 34 + TOP_PAD, { ...small, icon: this.audio.muted ? 'icon_mute' : 'icon_sound', hint: 'M', onClick: () => this.toggleMute() });
    const fs = new Button(this, 668, 34 + TOP_PAD, { ...small, color: P.arcane, icon: 'icon_fullscreen', onClick: () => toggleFullscreen(this) });
    if (!this.sys.game.device.fullscreen.available) fs.setVisible(false);

    this.timerText = makeText(this, 20, 82 + TOP_PAD, '', { size: 18, color: P.stone }).setOrigin(0, 0.5);
    this.hintText = makeText(this, GAME_WIDTH - 20, 82 + TOP_PAD, '', { size: 16, color: P.gold, bold: false }).setOrigin(1, 0.5);
  }

  private buildDock(): void {
    bakeCanvasImage(this, 'ui_dock_p', 0, DOCK_Y - 8, GAME_WIDTH, GAME_HEIGHT - DOCK_Y + 8, (c) => drawDock(c, GAME_WIDTH, GAME_HEIGHT - DOCK_Y + 8));

    // ---- hero cards
    this.shopLayer = this.add.container(0, 0);
    TOWER_ORDER.forEach((type, i) => {
      const x = 92 + i * 179;
      const def = TOWERS[type];
      const button = new Button(this, x, CARD_Y, {
        width: 164,
        height: 128,
        icon: `icon_tower_${type}`,
        iconScale: 0.95,
        color: P.wood,
        hint: String(i + 1),
        radius: 18,
        onClick: () => this.game_.setBuildType(type),
        onHover: (over) => {
          if (IS_TOUCH) return;
          this.hoverShop = over ? type : this.hoverShop === type ? null : this.hoverShop;
          this.refreshHint();
        },
      });
      button.setIconY(-14);
      const name = makeText(this, 0, 30, def.name, { size: 19, color: P.cream, stroke: P.ink, strokeThickness: 4 }).setOrigin(0.5);
      const costIcon = this.add.image(-18, 51, 'icon_gold').setScale(artScale(this, 'icon_gold') * 0.75);
      const cost = makeText(this, -5, 51, String(def.levels[0].cost), { size: 20, color: P.gold, stroke: P.ink, strokeThickness: 4 }).setOrigin(0, 0.5);
      button.add([name, costIcon, cost]);
      this.shop.push({ type, button, cost });
      this.shopLayer.add(button);
    });

    // ---- selected tower panel
    this.infoLayer = this.add.container(0, 0);
    this.infoIcon = this.add.image(62, DOCK_Y + 74, 'icon_tower_archer').setScale(0.4);
    this.infoTitle = makeText(this, 122, DOCK_Y + 34, 'Archer', { size: 26, color: P.cream, stroke: P.ink, strokeThickness: 5 }).setOrigin(0, 0.5);
    this.infoLevel = makeText(this, 122, DOCK_Y + 60, 'Level 1', { size: 17, color: P.gold }).setOrigin(0, 0.5);
    const cells: Phaser.GameObjects.GameObject[] = [];
    for (let i = 0; i < 6; i++) {
      const col = Math.floor(i / 3);
      const row = i % 3;
      const x = 122 + col * 150;
      const y = STAT_Y + 4 + row * 24;
      const cell: [Text, Text, Text] = [
        makeText(this, x, y, '', { size: 15, color: P.stone, bold: false }).setOrigin(0, 0.5),
        makeText(this, x + 66, y, '', { size: 16, color: P.cream }).setOrigin(0, 0.5),
        makeText(this, x + 108, y, '', { size: 15, color: P.leaf }).setOrigin(0, 0.5),
      ];
      this.infoCells.push(cell);
      cells.push(...cell);
    }
    this.upgradeButton = new Button(this, 548, DOCK_Y + 40, { width: 236, height: 54, label: 'Upgrade', icon: 'icon_upgrade', fontSize: 21, color: P.pine, hint: 'U', radius: 16, onClick: () => this.game_.upgradeSelected() });
    this.targetButton = new Button(this, 486, DOCK_Y + 104, { width: 112, height: 50, label: 'First', fontSize: 17, color: P.water, hint: 'T', radius: 14, onClick: () => this.game_.cycleTargetMode() });
    this.sellButton = new Button(this, 610, DOCK_Y + 104, { width: 112, height: 50, label: 'Sell', fontSize: 17, color: P.berry, hint: 'Del', radius: 14, onClick: () => this.game_.sellSelected() });
    const close = new Button(this, 692, DOCK_Y + 40, { width: 44, height: 44, icon: 'icon_close', iconScale: 0.8, color: P.ink, radius: 14, onClick: () => this.game_.deselect() });
    this.infoLayer.add([this.infoIcon, this.infoTitle, this.infoLevel, ...cells, this.upgradeButton, this.targetButton, this.sellButton, close]);

    // ---- big wave button
    this.callButton = new Button(this, GAME_WIDTH / 2, WAVE_BTN_Y, {
      width: 680,
      height: 60,
      label: 'Start wave',
      icon: 'icon_next',
      fontSize: 24,
      color: P.pine,
      hint: 'Space',
      radius: 20,
      onClick: () => this.game_.callNextWave(),
    });
  }

  private buildOverlays(): void {
    this.toast = makeText(this, GAME_WIDTH / 2, MAP_Y + 40, '', { size: 22, color: P.gold, stroke: P.ink, strokeThickness: 6, align: 'center' })
      .setOrigin(0.5)
      .setAlpha(0);

    // wave banner: ribbon + text, at the top of the map
    this.bannerRibbon = this.add.image(0, 2, 'ui_ribbon').setScale(artScale(this, 'ui_ribbon'));
    this.bannerText = makeText(this, 0, 0, '', { size: 28, color: P.cream, stroke: P.ink, strokeThickness: 6 }).setOrigin(0.5);
    this.banner = this.add.container(GAME_WIDTH / 2, MAP_Y + 96, [this.bannerRibbon, this.bannerText]).setAlpha(0);

    // pause overlay
    this.pauseLayer = this.add.container(0, 0).setVisible(false).setDepth(100);
    const dim = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, P.ink, 0.62).setOrigin(0).setInteractive();
    const pw = 460;
    const ph = 400;
    const px = GAME_WIDTH / 2 - pw / 2;
    const py = GAME_HEIGHT / 2 - ph / 2;
    const pg = panelImage(this, 'ui_pause_p', px, py, pw, ph, 28, 0.95);
    const title = makeText(this, GAME_WIDTH / 2, py + 64, 'Paused', { size: 48, color: P.gold, stroke: P.ink, strokeThickness: 8 }).setOrigin(0.5);
    const btn = { width: 320, height: 66, fontSize: 26, radius: 20 };
    const resume = new Button(this, GAME_WIDTH / 2, py + 160, { ...btn, label: 'Resume', icon: 'icon_play', color: P.pine, onClick: () => this.togglePause() });
    const restart = new Button(this, GAME_WIDTH / 2, py + 246, { ...btn, label: 'Restart', color: P.wood, onClick: () => this.restart() });
    const menu = new Button(this, GAME_WIDTH / 2, py + 332, { ...btn, label: 'Main menu', color: P.arcane, onClick: () => this.toMenu() });
    this.pauseLayer.add([dim, pg, title, resume, restart, menu]);
  }

  // -------------------------------------------------------------- events --
  private on(event: string, fn: (...args: never[]) => void): void {
    this.game_.events.on(event, fn, this);
    this.listeners.push([event, fn]);
  }

  private unbindEvents(): void {
    for (const [event, fn] of this.listeners) this.game_.events.off(event, fn, this);
    this.listeners.length = 0;
  }

  private bindEvents(): void {
    this.on(GameEvents.GoldChanged, (gold: number, delta: number) => this.onGold(gold, delta));
    this.on(GameEvents.LivesChanged, (lives: number, delta: number) => this.onLives(lives, delta));
    this.on(GameEvents.WaveChanged, (n: number, total: number) => this.onWave(n, total));
    this.on(GameEvents.WaveTimer, (left: number | null, canCall: boolean) => this.updateTimer(left, canCall));
    this.on(GameEvents.SelectionChanged, (t: Tower | null) => this.showSelection(t));
    this.on(GameEvents.TowerChanged, (t: Tower) => this.showSelection(t));
    this.on(GameEvents.BuildModeChanged, () => this.refreshShop());
    this.on(GameEvents.SpeedChanged, (s: number) => this.speedButton.setToggled(s > 1));
    this.on(GameEvents.PausedChanged, (p: boolean) => this.onPaused(p));
    this.on(GameEvents.Toast, (msg: string) => this.showToast(msg));
    this.on(GameEvents.GameEnded, (victory: boolean) => this.onEnded(victory));
  }

  private bindKeys(): void {
    this.input.on('pointerdown', () => this.audio.unlock());
    this.input.on('pointerup', () => this.audio.unlock());
    const kb = this.input.keyboard;
    if (!kb) return;
    kb.on('keydown', (ev: KeyboardEvent) => {
      this.audio.unlock();
      const paused = this.game_.isPaused;
      switch (ev.code) {
        case 'Digit1':
        case 'Digit2':
        case 'Digit3':
        case 'Digit4':
        case 'Numpad1':
        case 'Numpad2':
        case 'Numpad3':
        case 'Numpad4': {
          if (paused) return;
          const i = Number(ev.code.slice(-1)) - 1;
          this.game_.setBuildType(TOWER_ORDER[i]);
          break;
        }
        case 'Space':
          ev.preventDefault();
          if (!paused) this.game_.callNextWave();
          break;
        case 'KeyF':
          this.game_.toggleSpeed();
          break;
        case 'KeyP':
          this.togglePause();
          break;
        case 'KeyM':
          this.toggleMute();
          break;
        case 'KeyU':
          this.game_.upgradeSelected();
          break;
        case 'KeyT':
          this.game_.cycleTargetMode();
          break;
        case 'Delete':
        case 'Backspace':
          this.game_.sellSelected();
          break;
        case 'Escape':
          if (paused) this.togglePause();
          else this.game_.deselect();
          break;
      }
    });
  }

  // ------------------------------------------------------------ handlers --
  private onGold(gold: number, delta: number): void {
    this.tweens.killTweensOf(this);
    this.tweens.add({
      targets: this,
      shownGold: gold,
      duration: 420,
      ease: 'Cubic.easeOut',
      onUpdate: () => this.goldText.setText(String(Math.round(this.shownGold))),
    });
    this.tweens.killTweensOf(this.goldIcon);
    const s = artScale(this, 'icon_gold') * 1.3;
    this.goldIcon.setScale(s);
    this.tweens.add({ targets: this.goldIcon, scale: s * (delta > 0 ? 1.3 : 0.85), duration: 90, yoyo: true, ease: 'Quad.easeOut' });
    this.goldText.setColor(delta > 0 ? css(P.cream) : css(P.berry));
    this.time.delayedCall(240, () => this.goldText.setColor(css(P.gold)));
    this.refreshShop();
    this.refreshInfoButtons();
  }

  private onLives(lives: number, delta: number): void {
    this.livesText.setText(String(lives));
    if (delta < 0) {
      const s = artScale(this, 'icon_heart') * 1.25;
      this.tweens.killTweensOf(this.heartIcon);
      this.heartIcon.setScale(s);
      this.tweens.add({ targets: this.heartIcon, scale: s * 1.45, duration: 110, yoyo: true, repeat: 1, ease: 'Quad.easeOut' });
      this.livesText.setColor(css(P.berry));
      this.time.delayedCall(400, () => this.livesText.setColor(css(P.cream)));
    }
  }

  private onWave(n: number, total: number): void {
    this.updateWave(n, total);
    const boss = n % BOSS_WAVE_INTERVAL === 0;
    this.showBanner(boss ? `Wave ${n}: the Ogre King!` : n === total ? 'Final wave!' : `Wave ${n}`, boss ? P.gold : P.cream);
  }

  private updateWave(n: number, total: number): void {
    this.waveText.setText(`${Math.max(n, 0)}/${total}`);
  }

  private updateTimer(left: number | null, canCall: boolean): void {
    const n = this.game_.waveNumber;
    const total = this.game_.totalWaves;
    if (n === 0) {
      this.timerText.setText('Build heroes, then start!');
      this.timerText.setColor(css(P.cream));
      this.callButton.setLabel('Start wave 1');
    } else if (left !== null) {
      this.timerText.setText(`Next wave in ${Math.ceil(left)}s`);
      this.timerText.setColor(css(P.stone));
      const bonus = Math.round(left * ECONOMY.earlyCallGoldPerSecond);
      this.callButton.setLabel(bonus > 0 ? `Call wave ${n + 1} early  +${bonus}` : `Wave ${n + 1}`);
    } else if (n >= total) {
      this.timerText.setText('Hold the line!');
      this.timerText.setColor(css(P.gold));
      this.callButton.setLabel('Final wave');
    } else {
      this.timerText.setText(`Wave ${n} in progress`);
      this.timerText.setColor(css(P.stone));
      this.callButton.setLabel(`Wave ${n + 1}`);
    }
    this.callButton.setEnabled(canCall);
  }

  private onPaused(paused: boolean): void {
    this.pauseLayer.setVisible(paused);
    this.pauseButton.setIcon(paused ? 'icon_play' : 'icon_pause').setToggled(paused);
  }

  private onEnded(victory: boolean): void {
    this.showBanner(victory ? 'Victory!' : 'The hollow has fallen...', victory ? P.gold : P.cream);
    for (const s of this.shop) s.button.setEnabled(false);
    this.callButton.setEnabled(false);
    this.pauseButton.setEnabled(false);
    this.showSelection(null);
  }

  private togglePause(): void {
    this.game_.setPaused(!this.game_.isPaused);
    this.audio.play('click');
  }

  private toggleMute(): void {
    const muted = this.audio.toggleMute();
    this.muteButton.setIcon(muted ? 'icon_mute' : 'icon_sound');
    if (!muted) this.audio.play('click');
  }

  private restart(): void {
    this.audio.play('click');
    this.scene.stop('GameScene');
    this.scene.start('GameScene');
  }

  private toMenu(): void {
    this.audio.play('click');
    this.scene.stop('GameScene');
    this.scene.start('MenuScene');
  }

  // ----------------------------------------------------------- shop/info --
  private refreshShop(): void {
    const gold = this.game_.gold;
    const active = this.game_.currentBuildType;
    for (const s of this.shop) {
      const cost = TOWERS[s.type].levels[0].cost;
      // the active card stays tappable so touch players can cancel by tapping it again
      s.button.setEnabled(gold >= cost || active === s.type);
      s.button.setToggled(active === s.type);
      s.cost.setColor(gold >= cost ? css(P.gold) : css(P.berry));
    }
    this.refreshHint();
  }

  private refreshHint(): void {
    const building = this.game_.currentBuildType;
    if (building) {
      this.hintText.setText(IS_TOUCH ? HINT_BUILD_TOUCH : HINT_BUILD_KEYS);
      this.hintText.setColor(css(P.gold));
    } else if (this.hoverShop) {
      this.hintText.setText(TOWERS[this.hoverShop].blurb);
      this.hintText.setColor(css(P.cream));
    } else {
      this.hintText.setText(this.game_.waveNumber === 0 ? (IS_TOUCH ? 'Tap a hero card below' : 'Pick a hero card below') : '');
      this.hintText.setColor(css(P.stone));
    }
  }

  private statRows(type: TowerType, s: TowerLevelStats): [string, string][] {
    const d = TOWERS[type];
    const rows: [string, string][] = [
      ['Damage', String(s.damage)],
      ['Rate', `${(1 / s.fireInterval).toFixed(1)}/s`],
      ['Range', (s.range / TILE).toFixed(1)],
    ];
    if (type === 'cannon') rows.push(['Splash', (s.splashRadius / TILE).toFixed(1)]);
    else if (type === 'frost') rows.push(['Slow', `${Math.round((1 - s.slowFactor) * 100)}%`]);
    else if (type === 'mage') rows.push(['Chains', String(s.chainCount)]);
    else rows.push(['Type', d.damageType]);
    return rows;
  }

  private showSelection(t: Tower | null): void {
    const has = t !== null;
    this.infoLayer.setVisible(has);
    this.shopLayer.setVisible(!has);
    if (!t) {
      this.refreshHint();
      return;
    }
    const d = t.def;
    this.infoIcon.setTexture(`icon_tower_${d.type}`).setScale(artScale(this, `icon_tower_${d.type}`) * 1.05);
    this.infoTitle.setText(heroName(d.type));
    this.infoLevel.setText(`${d.name} - Level ${t.level}${t.canUpgrade ? '' : ' (max)'}`);
    const rows = this.statRows(d.type, t.stats);
    rows.push(['Air', d.hitsAir ? 'yes' : 'no']);
    rows.push(['Kills', String(t.kills)]);
    const next = t.canUpgrade ? this.statRows(d.type, d.levels[t.level]) : null;
    this.infoCells.forEach(([label, value, up], i) => {
      const r = rows[i];
      label.setText(r ? r[0] : '');
      value.setText(r ? r[1] : '');
      up.setText(r && next && next[i] && next[i][1] !== r[1] ? `> ${next[i][1]}` : '');
    });
    this.targetButton.setLabel(TARGET_MODE_LABEL[t.targetMode]);
    this.refreshInfoButtons();
  }

  private refreshInfoButtons(): void {
    const t = this.game_.selectedTower;
    if (!t) return;
    if (t.canUpgrade) {
      this.upgradeButton.setLabel(`Upgrade  ${t.upgradeCost}`);
      this.upgradeButton.setEnabled(this.game_.gold >= t.upgradeCost);
    } else {
      this.upgradeButton.setLabel('Max level');
      this.upgradeButton.setEnabled(false);
    }
    this.sellButton.setLabel(`Sell +${this.game_.economy.sellValue(t.invested)}`);
  }

  // -------------------------------------------------------------- toasts --
  private showToast(msg: string): void {
    this.tweens.killTweensOf(this.toast);
    this.toast.setText(msg).setAlpha(0).setY(MAP_Y + 54);
    this.tweens.add({ targets: this.toast, alpha: 1, y: MAP_Y + 40, duration: 160, ease: 'Quad.easeOut', hold: 1200, yoyo: true });
  }

  private showBanner(msg: string, color: number): void {
    this.tweens.killTweensOf(this.banner);
    this.bannerText.setText(msg).setColor(css(color));
    const base = artScale(this, 'ui_ribbon');
    this.bannerRibbon.setScale(Math.max(base * 0.8, (this.bannerText.width + 130) / this.bannerRibbon.width), base * 1.15);
    this.banner.setAlpha(0).setScale(0.6);
    this.tweens.add({ targets: this.banner, alpha: 1, scale: 1, duration: 340, ease: 'Back.easeOut', hold: 1600, yoyo: true });
  }
}

export function heroName(type: TowerType): string {
  return type === 'archer' ? 'Lyra' : type === 'cannon' ? 'Brann' : type === 'frost' ? 'Yuki' : 'Zephyr';
}

import Phaser from 'phaser';
import { ECONOMY, TARGET_MODE_LABEL, TOWER_ORDER, TOWERS, type TowerLevelStats, type TowerType } from '../config/balance';
import { GAME_HEIGHT, GAME_WIDTH, IS_TOUCH, MAP_Y, SIDEBAR_WIDTH, SIDEBAR_X, TILE, TOP_BAR_HEIGHT } from '../config/layout';
import { PALETTE as P, css } from '../config/palette';
import { BOSS_WAVE_INTERVAL } from '../config/waves';
import { artScale } from '../art/TextureFactory';
import type { Tower } from '../entities/Tower';
import type { AudioManager } from '../systems/AudioManager';
import { GameEvents } from '../systems/GameEvents';
import { Button } from '../ui/Button';
import { bakeImage } from '../ui/bake';
import type { GameScene } from './GameScene';
import { fitCamera, getAudio, makeText, panelImage, toggleFullscreen } from './sceneUtils';

type Text = Phaser.GameObjects.Text;

interface ShopSlot {
  type: TowerType;
  button: Button;
  cost: Text;
}

const INFO_Y = 316;
const ROW_H = 20;
const MAX_ROWS = 8;
const NL = '\n';
const COL_X = SIDEBAR_X + 16;

const HINT_IDLE_TOUCH = 'Tap a tower above, then tap a green tile to preview it. Tap the same tile again to build.\n\nTap a built tower to upgrade, sell or change its target.';
const HINT_IDLE_KEYS = 'Pick a tower above and click a green tile to build. Click a tower on the map to upgrade it.\n\n1-4 towers   Space wave\nF speed   P pause\nU upgrade   T target\nDel sell   Esc cancel';
const HINT_BUILD_TOUCH = 'Tap a tile to preview,\ntap it again to build.\nTap the tower card again to cancel.';
const HINT_BUILD_KEYS = 'Click a green tile to build.\nShift+click keeps building.\nRight-click or Esc cancels.';

/** HUD overlay that runs on top of GameScene. Never covers the map grid (top bar + right sidebar only). */
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
  private callButton!: Button;
  private speedButton!: Button;
  private pauseButton!: Button;
  private muteButton!: Button;

  private shop: ShopSlot[] = [];
  private infoContainer!: Phaser.GameObjects.Container;
  private infoTitle!: Text;
  private infoLevel!: Text;
  private infoRows: [Text, Text, Text][] = [];
  private infoIcon!: Phaser.GameObjects.Image;
  private targetButton!: Button;
  private upgradeButton!: Button;
  private sellButton!: Button;
  private hintContainer!: Phaser.GameObjects.Container;
  private hintTitle!: Text;
  private hintText!: Text;

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
    this.hoverShop = null;
    this.listeners.length = 0;

    this.buildTopBar();
    this.buildSidebar();
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

  /** World position of the gold counter (coins fly here). */
  static readonly GOLD_ANCHOR = { x: 32, y: 24 };

  // ------------------------------------------------------------ building --
  private buildTopBar(): void {
    bakeImage(this, 'ui_topbar', 0, 0, GAME_WIDTH, TOP_BAR_HEIGHT + 4, (g) => {
      g.fillStyle(P.ink, 0.86).fillRect(0, 0, GAME_WIDTH, TOP_BAR_HEIGHT);
      g.fillStyle(P.arcane, 0.08).fillRect(0, TOP_BAR_HEIGHT / 2, GAME_WIDTH, TOP_BAR_HEIGHT / 2);
      g.fillStyle(P.ink, 0.45).fillRect(0, TOP_BAR_HEIGHT, GAME_WIDTH, 4);
      g.lineStyle(2, P.gold, 0.7).lineBetween(0, TOP_BAR_HEIGHT - 1, GAME_WIDTH, TOP_BAR_HEIGHT - 1);
      const chip = (x: number, w: number) => {
        g.fillStyle(P.ink, 0.6).fillRoundedRect(x, 7, w, 34, 17);
        g.fillStyle(P.cream, 0.06).fillRoundedRect(x + 2, 9, w - 4, 14, 7);
        g.lineStyle(1.5, P.gold, 0.55).strokeRoundedRect(x, 7, w, 34, 17);
      };
      chip(10, 132);
      chip(150, 98);
      chip(256, 156);
    });

    this.goldIcon = this.add.image(UIScene.GOLD_ANCHOR.x, UIScene.GOLD_ANCHOR.y, 'icon_gold').setScale(artScale(this, 'icon_gold') * 1.15);
    this.goldText = makeText(this, 50, 24, '0', { size: 22, color: P.gold }).setOrigin(0, 0.5);
    this.heartIcon = this.add.image(171, 24, 'icon_heart').setScale(artScale(this, 'icon_heart') * 1.1);
    this.livesText = makeText(this, 190, 24, '20', { size: 22, color: P.cream }).setOrigin(0, 0.5);
    this.add.image(277, 24, 'icon_wave').setScale(artScale(this, 'icon_wave') * 1.05);
    this.waveText = makeText(this, 296, 24, 'Wave 0/20', { size: 20, color: P.cream }).setOrigin(0, 0.5);

    this.timerText = makeText(this, 426, 24, '', { size: 16, color: P.stone }).setOrigin(0, 0.5);
    this.callButton = new Button(this, 760, 24, {
      width: 210,
      height: 38,
      label: 'Start wave',
      icon: 'icon_next',
      fontSize: 17,
      color: P.pine,
      hint: 'Space',
      onClick: () => this.game_.callNextWave(),
    });

    const small = { width: 54, height: 38, color: P.water };
    this.speedButton = new Button(this, 1000, 24, { ...small, icon: 'icon_speed', hint: 'F', onClick: () => this.game_.toggleSpeed() });
    this.pauseButton = new Button(this, 1062, 24, { ...small, icon: 'icon_pause', hint: 'P', onClick: () => this.togglePause() });
    this.muteButton = new Button(this, 1124, 24, { ...small, icon: this.audio.muted ? 'icon_mute' : 'icon_sound', hint: 'M', onClick: () => this.toggleMute() });
    const fs = new Button(this, 1186, 24, { ...small, icon: 'icon_fullscreen', onClick: () => toggleFullscreen(this) });
    if (!this.sys.game.device.fullscreen.available) fs.setVisible(false);
  }

  private buildSidebar(): void {
    panelImage(this, 'ui_sidebar', SIDEBAR_X + 5, MAP_Y + 6, SIDEBAR_WIDTH - 10, GAME_HEIGHT - MAP_Y - 12, 14, 0.84);
    makeText(this, SIDEBAR_X + SIDEBAR_WIDTH / 2, MAP_Y + 26, 'TOWERS', { size: 15, color: P.gold }).setOrigin(0.5);

    TOWER_ORDER.forEach((type, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = SIDEBAR_X + 44 + col * 72;
      const y = MAP_Y + 92 + row * 108;
      const def = TOWERS[type];
      const button = new Button(this, x, y, {
        width: 68,
        height: 100,
        icon: `icon_tower_${type}`,
        iconScale: 0.78,
        color: P.wood,
        hint: String(i + 1),
        radius: 12,
        onClick: () => this.game_.setBuildType(type),
        onHover: (over) => {
          if (IS_TOUCH) return;
          this.hoverShop = over ? type : this.hoverShop === type ? null : this.hoverShop;
          this.refreshHint();
        },
      });
      button.setIconY(-18);
      const name = makeText(this, 0, 19, def.name, { size: 14, color: P.cream }).setOrigin(0.5);
      const costIcon = this.add.image(-14, 37, 'icon_gold').setScale(artScale(this, 'icon_gold') * 0.65);
      const cost = makeText(this, -4, 37, String(def.levels[0].cost), { size: 15, color: P.gold }).setOrigin(0, 0.5);
      button.add([name, costIcon, cost]);
      this.shop.push({ type, button, cost });
    });

    // info panel (selected tower)
    this.infoContainer = this.add.container(0, 0);
    const ig = bakeImage(this, 'ui_infobg', SIDEBAR_X + 12, INFO_Y - 8, SIDEBAR_WIDTH - 24, 386, (g) => {
      g.fillStyle(P.cream, 0.05).fillRoundedRect(SIDEBAR_X + 12, INFO_Y - 8, SIDEBAR_WIDTH - 24, 386, 12);
      g.lineStyle(1, P.gold, 0.3).lineBetween(SIDEBAR_X + 22, INFO_Y + 46, SIDEBAR_X + SIDEBAR_WIDTH - 22, INFO_Y + 46);
    });
    this.infoIcon = this.add.image(COL_X + 18, INFO_Y + 20, 'icon_tower_archer').setScale(0.4);
    this.infoTitle = makeText(this, COL_X + 42, INFO_Y + 10, 'Archer', { size: 19, color: P.cream }).setOrigin(0, 0.5);
    this.infoLevel = makeText(this, COL_X + 42, INFO_Y + 31, 'Level 1', { size: 14, color: P.gold }).setOrigin(0, 0.5);
    // one Text per cell on a fixed row grid, so columns can never drift apart
    this.infoRows = [];
    const rowObjs: Text[] = [];
    for (let i = 0; i < MAX_ROWS; i++) {
      const y = INFO_Y + 64 + i * ROW_H;
      const row: [Text, Text, Text] = [
        makeText(this, COL_X, y, '', { size: 14, color: P.stone, bold: false }).setOrigin(0, 0.5),
        makeText(this, COL_X + 58, y, '', { size: 14, color: P.cream }).setOrigin(0, 0.5),
        makeText(this, COL_X + 98, y, '', { size: 14, color: P.leaf }).setOrigin(0, 0.5),
      ];
      this.infoRows.push(row);
      rowObjs.push(...row);
    }
    const bx = SIDEBAR_X + SIDEBAR_WIDTH / 2;
    this.targetButton = new Button(this, bx, INFO_Y + 254, { width: 136, height: 40, label: 'First', icon: 'icon_target', iconScale: 0.85, fontSize: 16, color: P.water, hint: 'T', onClick: () => this.game_.cycleTargetMode() });
    this.upgradeButton = new Button(this, bx, INFO_Y + 302, { width: 136, height: 44, label: 'Upgrade', icon: 'icon_upgrade', fontSize: 16, color: P.pine, hint: 'U', onClick: () => this.game_.upgradeSelected() });
    this.sellButton = new Button(this, bx, INFO_Y + 350, { width: 136, height: 42, label: 'Sell', icon: 'icon_sell', fontSize: 16, color: P.berry, hint: 'Del', onClick: () => this.game_.sellSelected() });
    const targetLabel = makeText(this, COL_X, INFO_Y + 214, 'Targeting', { size: 13, color: P.stone });
    this.infoContainer.add([ig, this.infoIcon, this.infoTitle, this.infoLevel, ...rowObjs, targetLabel, this.targetButton, this.upgradeButton, this.sellButton]);

    // hint panel (nothing selected / choosing a tower to build)
    this.hintContainer = this.add.container(0, 0);
    this.hintTitle = makeText(this, COL_X, INFO_Y, '', { size: 18, color: P.gold });
    this.hintText = makeText(this, COL_X, INFO_Y + 28, '', { size: 14, color: P.stone, bold: false, wrap: SIDEBAR_WIDTH - 34 }).setLineSpacing(3);
    this.hintContainer.add([this.hintTitle, this.hintText]);
  }

  private buildOverlays(): void {
    this.toast = makeText(this, SIDEBAR_X + SIDEBAR_WIDTH / 2, GAME_HEIGHT - 30, '', { size: 14, color: P.gold, stroke: P.ink, strokeThickness: 4, align: 'center', wrap: SIDEBAR_WIDTH - 24 })
      .setOrigin(0.5)
      .setAlpha(0);

    // wave banner: ribbon + text, shown in the top map row (no path there)
    this.bannerRibbon = this.add.image(0, 2, 'ui_ribbon').setScale(artScale(this, 'ui_ribbon'));
    this.bannerText = makeText(this, 0, 0, '', { size: 24, color: P.cream, stroke: P.ink, strokeThickness: 5 }).setOrigin(0.5);
    this.banner = this.add.container(SIDEBAR_X / 2 - 40, MAP_Y + 30, [this.bannerRibbon, this.bannerText]).setAlpha(0);

    // pause overlay
    this.pauseLayer = this.add.container(0, 0).setVisible(false).setDepth(100);
    const dim = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, P.ink, 0.6).setOrigin(0).setInteractive();
    const pw = 340;
    const ph = 290;
    const px = GAME_WIDTH / 2 - pw / 2;
    const py = GAME_HEIGHT / 2 - ph / 2;
    const pg = panelImage(this, 'ui_pause', px, py, pw, ph, 18, 0.94);
    const title = makeText(this, GAME_WIDTH / 2, py + 44, 'Paused', { size: 36, color: P.gold, stroke: P.ink, strokeThickness: 6 }).setOrigin(0.5);
    const btn = { width: 240, height: 50, fontSize: 20 };
    const resume = new Button(this, GAME_WIDTH / 2, py + 112, { ...btn, label: 'Resume', icon: 'icon_play', color: P.pine, onClick: () => this.togglePause() });
    const restart = new Button(this, GAME_WIDTH / 2, py + 172, { ...btn, label: 'Restart', color: P.wood, onClick: () => this.restart() });
    const menu = new Button(this, GAME_WIDTH / 2, py + 232, { ...btn, label: 'Main menu', color: P.arcane, onClick: () => this.toMenu() });
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
    const s = artScale(this, 'icon_gold') * 1.15;
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
      const s = artScale(this, 'icon_heart') * 1.1;
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
    this.showBanner(boss ? `Wave ${n}: the Ogre Chief!` : n === total ? 'Final wave!' : `Wave ${n}`, boss ? P.gold : P.cream);
  }

  private updateWave(n: number, total: number): void {
    this.waveText.setText(`Wave ${Math.max(n, 0)}/${total}`);
  }

  private updateTimer(left: number | null, canCall: boolean): void {
    const n = this.game_.waveNumber;
    const total = this.game_.totalWaves;
    if (n === 0) {
      this.timerText.setText(IS_TOUCH ? 'Build, then start!' : 'Build towers, then start!');
      this.timerText.setColor(css(P.cream));
      this.callButton.setLabel('Start wave');
    } else if (left !== null) {
      this.timerText.setText(`Next wave in ${Math.ceil(left)}s`);
      this.timerText.setColor(css(P.stone));
      const bonus = Math.round(left * ECONOMY.earlyCallGoldPerSecond);
      this.callButton.setLabel(bonus > 0 ? `Call early +${bonus}` : 'Next wave');
    } else if (n >= total) {
      this.timerText.setText('Hold the line!');
      this.timerText.setColor(css(P.gold));
      this.callButton.setLabel('Last wave');
    } else {
      this.timerText.setText('Wave in progress');
      this.timerText.setColor(css(P.stone));
      this.callButton.setLabel('Next wave');
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
    const type = this.hoverShop ?? this.game_.currentBuildType;
    if (type) {
      const d = TOWERS[type];
      const s = d.levels[0];
      this.hintTitle.setText(d.name);
      const building = this.game_.currentBuildType !== null;
      this.hintText.setText(
        [d.blurb, '', ...this.statRows(type, s).map(([l, v]) => `${l}  ${v}`), '', building ? (IS_TOUCH ? HINT_BUILD_TOUCH : HINT_BUILD_KEYS) : 'Click or press its number to build.'].join(NL),
      );
      this.hintText.setColor(css(P.cream));
    } else {
      this.hintTitle.setText('How to play');
      this.hintText.setText(IS_TOUCH ? HINT_IDLE_TOUCH : HINT_IDLE_KEYS);
      this.hintText.setColor(css(P.stone));
    }
  }

  private statRows(type: TowerType, s: TowerLevelStats): [string, string][] {
    const d = TOWERS[type];
    const rows: [string, string][] = [
      ['Damage', String(s.damage)],
      ['Rate/s', (1 / s.fireInterval).toFixed(2)],
      ['Range', (s.range / TILE).toFixed(1)],
    ];
    if (type === 'cannon') rows.push(['Splash', (s.splashRadius / TILE).toFixed(1)]);
    if (type === 'frost') {
      rows.push(['Slow', `${Math.round((1 - s.slowFactor) * 100)}%`]);
      rows.push(['Chill', `${s.slowDuration}s`]);
    }
    if (type === 'mage') rows.push(['Chains', String(s.chainCount)]);
    rows.push(['Hits', d.hitsAir ? 'air+gnd' : 'ground']);
    return rows;
  }

  private showSelection(t: Tower | null): void {
    const has = t !== null;
    this.infoContainer.setVisible(has);
    this.hintContainer.setVisible(!has);
    if (!t) {
      this.refreshHint();
      return;
    }
    const d = t.def;
    this.infoIcon.setTexture(`icon_tower_${d.type}`).setScale(artScale(this, `icon_tower_${d.type}`) * 0.7);
    this.infoTitle.setText(d.name);
    this.infoLevel.setText(t.canUpgrade ? `Level ${t.level}` : `Level ${t.level} (max)`);
    const rows = this.statRows(d.type, t.stats);
    rows.push(['Kills', String(t.kills)]);
    const next = t.canUpgrade ? this.statRows(d.type, d.levels[t.level]) : null;
    this.infoRows.forEach(([label, value, up], i) => {
      const r = rows[i];
      label.setText(r ? r[0] : '');
      value.setText(r ? r[1] : '');
      // only show next-level values that change
      up.setText(r && next && next[i] && next[i][1] !== r[1] ? `>${next[i][1]}` : '');
    });
    this.targetButton.setLabel(TARGET_MODE_LABEL[t.targetMode]);
    this.refreshInfoButtons();
  }

  private refreshInfoButtons(): void {
    const t = this.game_.selectedTower;
    if (!t) return;
    if (t.canUpgrade) {
      this.upgradeButton.setLabel(`Up ${t.upgradeCost}`);
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
    this.toast.setText(msg).setAlpha(0).setY(GAME_HEIGHT - 22);
    this.tweens.add({ targets: this.toast, alpha: 1, y: GAME_HEIGHT - 30, duration: 160, ease: 'Quad.easeOut', hold: 1200, yoyo: true });
  }

  private showBanner(msg: string, color: number): void {
    this.tweens.killTweensOf(this.banner);
    this.bannerText.setText(msg).setColor(css(color));
    const base = artScale(this, 'ui_ribbon');
    this.bannerRibbon.setScale(Math.max(base * 0.8, (this.bannerText.width + 110) / this.bannerRibbon.width), base);
    this.banner.setAlpha(0).setScale(0.6);
    this.tweens.add({ targets: this.banner, alpha: 1, scale: 1, duration: 340, ease: 'Back.easeOut', hold: 1600, yoyo: true });
  }
}

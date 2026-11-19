import Phaser from 'phaser';
import { ECONOMY, TOWERS, type DamageType, type EnemyType, type TowerType } from '../config/balance';
import { DEPTH, GRID_COLS, GRID_ROWS, MAP_HEIGHT, MAP_WIDTH, MAP_X, MAP_Y, TILE } from '../config/layout';
import { PALETTE as P } from '../config/palette';
import { BOSS_WAVE_INTERVAL } from '../config/waves';
import { MAP1 } from '../maps/map1';
import { TextureFactory, artScale } from '../art/TextureFactory';
import { Rng } from '../art/rng';
import { Enemy } from '../entities/Enemy';
import { Projectile } from '../entities/Projectile';
import { Tower, type TowerHost } from '../entities/Tower';
import type { AudioManager, SoundName } from '../systems/AudioManager';
import { EconomySystem } from '../systems/EconomySystem';
import { EffectsManager } from '../systems/EffectsManager';
import { GameEvents } from '../systems/GameEvents';
import { PathSystem, TileKind, type Vec2 } from '../systems/PathSystem';
import { SaveData } from '../systems/SaveData';
import { TargetingSystem } from '../systems/TargetingSystem';
import { WaveManager } from '../systems/WaveManager';
import { fitCamera, getAudio } from './sceneUtils';

const MAX_DT = 1 / 20;
const ENEMY_DEATH_COLOR: Record<EnemyType, number> = {
  basic: P.leaf,
  fast: P.gold,
  armored: P.stone,
  flying: P.arcane,
  boss: P.berry,
};
const SHOOT_SOUND: Record<TowerType, SoundName> = {
  archer: 'shoot_archer',
  cannon: 'shoot_cannon',
  frost: 'shoot_frost',
  mage: 'shoot_mage',
};

/**
 * The world: map, towers, enemies, projectiles and effects. Owns all game
 * state; UIScene reads it through getters and calls the public commands.
 */
export class GameScene extends Phaser.Scene implements TowerHost {
  path!: PathSystem;
  economy!: EconomySystem;
  waves!: WaveManager;
  effects!: EffectsManager;
  targeting!: TargetingSystem;
  private audio!: AudioManager;

  private enemies: Enemy[] = [];
  private enemyPool!: Phaser.GameObjects.Group;
  private projectiles: Projectile[] = [];
  private projectilePool!: Phaser.GameObjects.Group;
  towers: Tower[] = [];

  private selected: Tower | null = null;
  private hovered: Tower | null = null;
  private buildType: TowerType | null = null;
  private speed = 1;
  private ended = false;
  private frame = 0;
  private lastTimerSecond = -1;

  private rangeG!: Phaser.GameObjects.Graphics;
  private placeG!: Phaser.GameObjects.Graphics;
  private preview!: Phaser.GameObjects.Image;
  private previewPos: Vec2 = { x: 0, y: 0 };
  private previewTarget: Vec2 = { x: 0, y: 0 };
  private hoverTile: Vec2 = { x: -1, y: -1 };
  private pointerInMap = false;
  private readonly pendingTile: Vec2 = { x: -1, y: -1 };
  private clouds: Phaser.GameObjects.Image[] = [];
  private rangePulse = 0;

  private grade: Phaser.Filters.ColorMatrix | null = null;
  private vignette: Phaser.Filters.Vignette | null = null;
  private bloom: Phaser.Filters.ParallelFilters | null = null;
  private perfTimer = 0;
  private lowFpsStrikes = 0;
  private gradeT = 0;
  private gradeTarget = 0;

  private readonly tmp: Vec2 = { x: 0, y: 0 };
  private readonly tmp2: Vec2 = { x: 0, y: 0 };
  private readonly chainHits = new Int32Array(16);

  constructor() {
    super('GameScene');
  }

  // ------------------------------------------------------------- getters --
  get gold(): number {
    return this.economy.gold;
  }
  get lives(): number {
    return this.economy.lives;
  }
  get waveNumber(): number {
    return this.waves.currentWave;
  }
  get totalWaves(): number {
    return this.waves.totalWaves;
  }
  get gameSpeed(): number {
    return this.speed;
  }
  get selectedTower(): Tower | null {
    return this.selected;
  }
  get currentBuildType(): TowerType | null {
    return this.buildType;
  }
  get enemyCount(): number {
    return this.enemies.length;
  }

  // -------------------------------------------------------------- create --
  create(): void {
    // Reset per-run state (scene instances are reused across restarts).
    this.enemies = [];
    this.projectiles = [];
    this.towers = [];
    this.selected = null;
    this.hovered = null;
    this.buildType = null;
    this.speed = 1;
    this.ended = false;
    this.frame = 0;
    this.lastTimerSecond = -2;
    this.gradeT = 0;
    this.gradeTarget = 0;
    this.perfTimer = 0;
    this.lowFpsStrikes = 0;
    this.pointerInMap = false;
    this.tweens.timeScale = 1;
    this.time.timeScale = 1;

    const cam = fitCamera(this);
    this.audio = getAudio(this);
    this.path = new PathSystem(MAP1);

    const factory = new TextureFactory(this);
    factory.bakeTerrain(this.path, MAP1.seed);
    factory.destroy();
    this.add.image(0, 0, 'terrain').setOrigin(0).setScale(artScale(this, 'terrain')).setDepth(DEPTH.terrain);
    this.buildProps();

    this.economy = new EconomySystem(this.events);
    this.targeting = new TargetingSystem(this.enemies);
    this.effects = new EffectsManager(this);
    this.waves = new WaveManager((type, hp, goldScale) => this.spawnEnemy(type, hp, goldScale));

    this.enemyPool = this.add.group({ classType: Enemy, maxSize: 600, runChildUpdate: false });
    this.projectilePool = this.add.group({ classType: Projectile, maxSize: 600, runChildUpdate: false });

    this.rangeG = this.add.graphics().setDepth(DEPTH.rangeCircle);
    this.placeG = this.add.graphics().setDepth(DEPTH.placement);
    this.preview = this.add.image(0, 0, 'icon_tower_archer').setVisible(false).setAlpha(0.75).setDepth(DEPTH.flying - 1);

    this.setupInput();
    this.setupCameraFx(cam);
    this.effects.startAmbient(MAP_X, MAP_Y, MAP_WIDTH, MAP_HEIGHT);
    this.pendingTile.x = -1;
    // slow cloud shadows drifting across the meadow
    this.clouds = [];
    for (let i = 0; i < 3; i++) {
      const c = this.add
        .image(-200 + i * 520 + Math.random() * 120, MAP_Y + 120 + ((i * 230) % 480), 'cloud')
        .setScale(artScale(this, 'cloud') * (2.2 + Math.random()))
        .setAlpha(0.11)
        .setDepth(DEPTH.fx - 2);
      this.clouds.push(c);
    }

    this.scene.launch('UIScene');
    this.scene.bringToTop('UIScene');

    if (import.meta.env.DEV) {
      (window as unknown as { __td?: unknown }).__td = this;
      if (new URLSearchParams(window.location.search).has('stress')) this.stressTest();
    }
  }

  private buildProps(): void {
    const rng = new Rng(MAP1.seed + 7);
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const kind = this.path.tileAt(c, r);
        const p = this.path.tileCenter(c, r, this.tmp);
        if (kind === TileKind.Tree) {
          const roll = rng.next();
          const key = roll < 0.4 ? 'tree_0' : roll < 0.7 ? 'tree_2' : 'tree_1';
          const x = p.x + rng.range(-5, 5);
          const y = p.y + TILE * 0.4;
          const tree = this.add.image(x, y, key).setOrigin(0.5, 0.94).setScale(artScale(this, key) * rng.range(0.95, 1.12)).setDepth(DEPTH.worldBase + y);
          this.tweens.add({
            targets: tree,
            angle: { from: -1.6, to: 1.6 },
            duration: rng.range(1900, 2800),
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
            delay: rng.range(0, 1500),
          });
        } else if (kind === TileKind.Mushroom) {
          const y = p.y + 14;
          const m = this.add.image(p.x, y, 'mush').setOrigin(0.5, 0.88).setScale(artScale(this, 'mush')).setDepth(DEPTH.worldBase + y);
          this.tweens.add({ targets: m, scaleY: m.scaleY * 1.05, duration: rng.range(900, 1400), yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: rng.range(0, 800) });
        } else if (kind === TileKind.Rock) {
          const y = p.y + 14;
          this.add.image(p.x, y, 'rock').setOrigin(0.5, 0.75).setScale(artScale(this, 'rock')).setDepth(DEPTH.worldBase + y);
        } else if (kind === TileKind.Flower) {
          const y = p.y + 14;
          const bush = this.add.image(p.x, y, 'bush').setOrigin(0.5, 0.85).setScale(artScale(this, 'bush')).setDepth(DEPTH.worldBase + y);
          this.tweens.add({ targets: bush, scaleY: bush.scaleY * 1.04, duration: rng.range(1400, 2000), yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: rng.range(0, 1000) });
        } else if (kind === TileKind.Water) {
          if (rng.chance(0.55)) {
            const s = this.add
              .image(p.x + rng.range(-14, 14), p.y + rng.range(-14, 14), 'shimmer')
              .setScale(artScale(this, 'shimmer') * rng.range(0.7, 1.2))
              .setAlpha(0)
              .setDepth(DEPTH.water)
              .setBlendMode(Phaser.BlendModes.ADD);
            this.tweens.add({ targets: s, alpha: { from: 0, to: 0.85 }, x: s.x + rng.range(6, 14), duration: rng.range(1200, 2000), yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: rng.range(0, 2400) });
          }
          if (rng.chance(0.16)) {
            const lily = this.add.image(p.x + rng.range(-10, 10), p.y + rng.range(-10, 10), 'lily').setScale(artScale(this, 'lily')).setDepth(DEPTH.water + 0.5).setAngle(rng.range(0, 360));
            this.tweens.add({ targets: lily, angle: lily.angle + rng.range(8, 16), y: lily.y + 1.5, duration: rng.range(2600, 3600), yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
          }
        }
      }
    }
  }

  private setupCameraFx(cam: Phaser.Cameras.Scene2D.Camera): void {
    // Soft bloom: only the brightest pixels (sparks, muzzle flashes, magic) bleed light.
    const bloom = Phaser.Actions.AddEffectBloom(cam, { threshold: 0.8, blurRadius: 2, blurSteps: 2, blurQuality: 0, blendAmount: 0.6 });
    this.bloom = bloom[0]?.parallelFilters ?? null;
    this.grade = cam.filters.internal.addColorMatrix();
    this.vignette = cam.filters.internal.addVignette(0.5, 0.5, 0.9, 0.35, P.ink);
    this.applyGrade(0);
  }

  /** Day (t = 0) to dusk (t = 1): warmer, dimmer light and a heavier vignette. */
  private applyGrade(t: number): void {
    if (!this.grade) return;
    const k = t;
    // row-major 4x5 colour matrix, lerped from identity toward golden-hour dusk
    this.grade.colorMatrix.set([
      1 - 0.02 * k, 0.05 * k, 0, 0, 0,
      0.05 * k, 1 - 0.14 * k, 0, 0, 0,
      0.04 * k, 0.04 * k, 1 - 0.2 * k, 0, 0,
      0, 0, 0, 1, 0,
    ]);
    if (this.vignette) {
      this.vignette.strength = 0.35 + 0.15 * k;
      this.vignette.radius = 0.9 - 0.05 * k;
    }
  }

  // --------------------------------------------------------------- input --
  private setupInput(): void {
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.onPointerMove(p));
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onPointerDown(p));
    this.input.on('gameout', () => {
      this.pointerInMap = false;
    });
  }

  private inMap(x: number, y: number): boolean {
    return x >= MAP_X && x < MAP_X + MAP_WIDTH && y >= MAP_Y && y < MAP_Y + MAP_HEIGHT;
  }

  private onPointerMove(p: Phaser.Input.Pointer): void {
    const x = p.worldX;
    const y = p.worldY;
    this.pointerInMap = this.inMap(x, y);
    const tile = this.path.worldToTile(x, y, this.tmp);
    const changed = tile.x !== this.hoverTile.x || tile.y !== this.hoverTile.y;
    this.hoverTile.x = tile.x;
    this.hoverTile.y = tile.y;
    this.hovered = this.pointerInMap ? this.towerAt(tile.x, tile.y) : null;
    if (changed && this.buildType && this.pointerInMap) {
      this.path.tileCenter(tile.x, tile.y, this.previewTarget);
      this.preview.setScale(artScale(this, this.preview.texture.key) * 1.12);
    }
  }

  private onPointerDown(p: Phaser.Input.Pointer): void {
    if (this.ended) return;
    const x = p.worldX;
    const y = p.worldY;
    if (p.rightButtonDown()) {
      if (this.buildType) this.setBuildType(null);
      else this.select(null);
      return;
    }
    if (!this.inMap(x, y)) return;
    const tile = this.path.worldToTile(x, y, this.tmp);
    if (this.buildType) {
      // Touch has no hover: the first tap previews the tile, a second tap on it builds.
      if (p.wasTouch && (tile.x !== this.pendingTile.x || tile.y !== this.pendingTile.y)) {
        const wasVisible = this.preview.visible;
        this.pendingTile.x = tile.x;
        this.pendingTile.y = tile.y;
        this.onPointerMove(p);
        this.path.tileCenter(tile.x, tile.y, this.previewTarget);
        if (!wasVisible) {
          this.previewPos.x = this.previewTarget.x;
          this.previewPos.y = this.previewTarget.y;
        }
        this.audio.play('click');
        return;
      }
      this.pendingTile.x = -1;
      const placed = this.tryPlace(this.buildType, tile.x, tile.y);
      const shift = (p.event as MouseEvent | undefined)?.shiftKey ?? false;
      if (placed && !shift) this.setBuildType(null);
      return;
    }
    this.select(this.towerAt(tile.x, tile.y));
  }

  private towerAt(c: number, r: number): Tower | null {
    for (const t of this.towers) if (t.col === c && t.row === r) return t;
    return null;
  }

  // ------------------------------------------------------------ commands --
  setBuildType(type: TowerType | null): void {
    if (this.ended) return;
    this.pendingTile.x = -1;
    if (type && type !== this.buildType && !this.economy.canAfford(TOWERS[type].levels[0].cost)) {
      this.audio.play('error');
      this.events.emit(GameEvents.Toast, 'Not enough gold');
      return;
    }
    this.buildType = this.buildType === type ? null : type;
    if (this.buildType) {
      this.select(null);
      const key = `icon_tower_${this.buildType}`;
      this.preview.setTexture(key).setScale(artScale(this, key));
      if (this.pointerInMap) {
        this.path.tileCenter(this.hoverTile.x, this.hoverTile.y, this.previewTarget);
        this.previewPos.x = this.previewTarget.x;
        this.previewPos.y = this.previewTarget.y;
      }
    }
    this.audio.play('click');
    this.events.emit(GameEvents.BuildModeChanged, this.buildType);
  }

  select(tower: Tower | null): void {
    if (this.selected === tower) return;
    this.selected = tower;
    if (tower) {
      this.audio.play('click');
      this.tweens.add({ targets: tower.base, scaleX: tower.base.scaleX * 1.08, scaleY: tower.base.scaleY * 0.94, duration: 90, yoyo: true, ease: 'Quad.easeOut' });
    }
    this.events.emit(GameEvents.SelectionChanged, tower);
  }

  deselect(): void {
    if (this.buildType) this.setBuildType(null);
    this.select(null);
  }

  private tryPlace(type: TowerType, c: number, r: number): boolean {
    const cost = TOWERS[type].levels[0].cost;
    if (!this.path.isBuildable(c, r)) {
      this.audio.play('error');
      this.cameras.main.shake(60, 0.0015);
      return false;
    }
    if (!this.economy.spend(cost)) {
      this.audio.play('error');
      this.events.emit(GameEvents.Toast, 'Not enough gold');
      return false;
    }
    const p = this.path.tileCenter(c, r, this.tmp);
    const tower = new Tower(this, type, c, r, p.x, p.y);
    this.towers.push(tower);
    this.path.setOccupied(c, r, true);
    // pop-in
    tower.hero.setAlpha(0);
    this.tweens.add({ targets: tower.hero, alpha: 1, duration: 260, delay: 120 });
    for (const img of [tower.base, tower.turret]) {
      const s = img.scale;
      img.setScale(s * 0.2);
      this.tweens.add({ targets: img, scale: s, duration: 320, ease: 'Back.easeOut' });
    }
    tower.base.y -= 14;
    this.tweens.add({ targets: tower.base, y: p.y, duration: 260, ease: 'Bounce.easeOut' });
    this.effects.placeDust(p.x, p.y);
    this.audio.play('place');
    return true;
  }

  upgradeSelected(): void {
    const t = this.selected;
    if (!t || !t.canUpgrade || this.ended) return;
    if (!this.economy.spend(t.upgradeCost)) {
      this.audio.play('error');
      this.events.emit(GameEvents.Toast, 'Not enough gold');
      return;
    }
    t.upgrade();
    for (const img of [t.base, t.turret]) {
      const s = img.scale;
      this.tweens.add({ targets: img, scale: { from: s * 1.25, to: s }, duration: 360, ease: 'Back.easeOut' });
    }
    this.effects.upgradeSparkle(t.x, t.y);
    this.audio.play('upgrade');
    this.events.emit(GameEvents.TowerChanged, t);
  }

  sellSelected(): void {
    const t = this.selected;
    if (!t || this.ended) return;
    const value = this.economy.sellValue(t.invested);
    this.economy.earn(value);
    this.effects.floatText(t.x, t.y - 20, `+${value}`, P.gold, 18);
    this.effects.sellPuff(t.x, t.y);
    this.path.setOccupied(t.col, t.row, false);
    this.towers.splice(this.towers.indexOf(t), 1);
    this.select(null);
    this.hovered = null;
    this.tweens.add({
      targets: [t.base, t.turret, t.hero],
      scale: 0,
      alpha: 0,
      duration: 200,
      ease: 'Back.easeIn',
      onComplete: () => t.destroy(),
    });
    this.audio.play('sell');
  }

  cycleTargetMode(): void {
    const t = this.selected;
    if (!t) return;
    t.cycleTargetMode();
    this.audio.play('click');
    this.events.emit(GameEvents.TowerChanged, t);
  }

  callNextWave(): void {
    if (this.ended) return;
    const bonus = this.waves.callNextWave();
    if (bonus < 0) return;
    if (bonus > 0) {
      this.economy.earn(bonus);
      this.events.emit(GameEvents.Toast, `Early call bonus +${bonus} gold`);
    }
    this.onWaveStarted();
  }

  setSpeed(speed: number): void {
    this.speed = speed;
    this.tweens.timeScale = speed;
    this.time.timeScale = speed;
    this.effects.setTimeScale(speed);
    this.events.emit(GameEvents.SpeedChanged, speed);
  }

  toggleSpeed(): void {
    this.setSpeed(this.speed === 1 ? 2 : 1);
    this.audio.play('click');
  }

  setPaused(paused: boolean): void {
    if (this.ended) return;
    if (paused && !this.scene.isPaused()) this.scene.pause();
    else if (!paused && this.scene.isPaused()) this.scene.resume();
    this.events.emit(GameEvents.PausedChanged, paused);
  }

  get isPaused(): boolean {
    return this.scene.isPaused();
  }

  canCallNextWave(): boolean {
    return !this.ended && this.waves.canCallNextWave();
  }

  // ---------------------------------------------------------- simulation --
  private onWaveStarted(): void {
    const n = this.waves.currentWave;
    const boss = n % BOSS_WAVE_INTERVAL === 0;
    this.audio.play(boss ? 'boss_wave' : 'wave_start');
    if (n >= 2) {
      const bonus = ECONOMY.waveStartBonus + ECONOMY.waveStartBonusPerWave * n;
      this.economy.earn(bonus);
      this.effects.floatText(MAP_X + MAP_WIDTH / 2, MAP_Y + 64, `Wave bonus +${bonus}`, P.gold, 22, 1.4);
    }
    this.gradeTarget = Math.min(1, (n - 1) / (this.waves.totalWaves - 1));
    this.events.emit(GameEvents.WaveChanged, n, this.waves.totalWaves);
    this.lastTimerSecond = -2; // force a timer refresh on the next frame
    if (boss) this.cameras.main.shake(400, 0.003);
  }

  private spawnEnemy(type: EnemyType, hpScale: number, goldScale: number): void {
    const e = this.enemyPool.get(0, 0) as Enemy | null;
    if (!e) return;
    e.spawn(type, hpScale, goldScale, this.path);
    this.enemies.push(e);
  }

  override update(_time: number, deltaMs: number): void {
    if (this.ended) {
      this.effects.update(Math.min(deltaMs / 1000, MAX_DT));
      return;
    }
    const dt = Math.min(deltaMs / 1000, MAX_DT) * this.speed;
    this.frame++;

    if (this.waves.update(dt)) this.onWaveStarted();

    // enemies
    const end = this.path.totalLength;
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.step(dt, this.path)) this.effects.frozenTick(e.x, e.y);
      if (e.dist >= end) this.leak(e, i);
    }

    // towers
    for (let i = 0; i < this.towers.length; i++) this.towers[i].update(dt, this);

    // projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i];
      if (pr.step(dt)) {
        this.resolveProjectile(pr);
        pr.recycle();
        const last = this.projectiles.length - 1;
        this.projectiles[i] = this.projectiles[last];
        this.projectiles.pop();
      } else if (pr.kind !== 'arrow' || (this.frame & 1) === 0) {
        this.effects.trailAt(pr.kind, pr.x, pr.y);
      }
    }

    this.effects.update(dt);
    for (const c of this.clouds) {
      c.x += 9 * dt;
      if (c.x - c.displayWidth / 2 > MAP_X + MAP_WIDTH) c.x = MAP_X - c.displayWidth / 2;
    }
    this.drawPlacementAndRange(deltaMs / 1000);
    this.updateGrade(dt);
    this.watchPerformance(deltaMs / 1000);

    const left = this.waves.timeToNextWave;
    const sec = left === null ? -1 : Math.ceil(left);
    if (sec !== this.lastTimerSecond) {
      this.lastTimerSecond = sec;
      this.events.emit(GameEvents.WaveTimer, left, this.waves.canCallNextWave());
    }

    if (this.waves.allWavesSpawned && this.enemies.length === 0) this.endGame(true);
  }

  /** Quality guard: on slow GPUs, drop the bloom pass if the frame rate stays low. */
  private watchPerformance(realDt: number): void {
    if (!this.bloom || !this.bloom.active) return;
    this.perfTimer += realDt;
    if (this.perfTimer < 3) return;
    this.perfTimer = 0;
    this.lowFpsStrikes = this.game.loop.actualFps < 48 ? this.lowFpsStrikes + 1 : 0;
    if (this.lowFpsStrikes >= 2) this.bloom.active = false;
  }

  private updateGrade(dt: number): void {
    if (Math.abs(this.gradeT - this.gradeTarget) < 0.0005) return;
    this.gradeT += (this.gradeTarget - this.gradeT) * Math.min(1, dt * 0.8);
    this.applyGrade(this.gradeT);
  }

  // -------------------------------------------------------------- combat --
  fireProjectile(tower: Tower, target: Enemy): void {
    const kind = tower.def.projectile;
    if (!kind) return;
    const pr = this.projectilePool.get(0, 0) as Projectile | null;
    if (!pr) return;
    const m = tower.muzzle(this.tmp);
    let ax = target.x;
    let ay = target.y;
    const s = tower.stats;
    if (kind === 'cannonball') {
      // lead the target: predict where it will be when the ball lands
      const d = Math.hypot(target.groundX - m.x, target.groundY - m.y);
      const flight = Math.max(0.35, d / s.projectileSpeed);
      this.path.pointAt(target.dist + target.def.speed * target.slowFactor * flight, this.tmp2);
      ax = this.tmp2.x;
      ay = this.tmp2.y;
    }
    pr.launch(kind, tower, m.x, m.y, target, ax, ay, s.projectileSpeed);
    this.projectiles.push(pr);
    this.effects.muzzle(tower.type, m.x, m.y, tower.aimAngle);
    this.audio.play(SHOOT_SOUND[tower.type]);
  }

  fireLightning(tower: Tower, target: Enemy): void {
    const s = tower.stats;
    const m = tower.muzzle(this.tmp);
    let fromX = m.x;
    let fromY = m.y;
    let current: Enemy | null = target;
    let damage = s.damage;
    let count = 0;
    this.effects.muzzle('mage', m.x, m.y, tower.aimAngle);
    for (let jump = 0; jump <= s.chainCount && current; jump++) {
      const cx: number = current.x;
      const cy: number = current.y;
      this.effects.arc(fromX, fromY, cx, cy);
      this.chainHits[count++] = current.uid;
      this.damageEnemy(current, damage, 'magic', tower, P.arcane);
      fromX = cx;
      fromY = cy;
      damage *= s.chainFalloff;
      current = count < this.chainHits.length ? this.targeting.nearestExcluding(cx, cy, s.chainRange, true, this.chainHits, count) : null;
    }
    this.audio.play('shoot_mage');
  }

  private resolveProjectile(pr: Projectile): void {
    const src = pr.source;
    if (pr.kind === 'arrow') {
      if (pr.hasLiveTarget && pr.target) {
        this.damageEnemy(pr.target, pr.damage, pr.damageType, src, P.cream);
        this.effects.impact(pr.x, pr.y, P.cream, 4);
        this.audio.play('hit');
      }
      return;
    }
    if (pr.kind === 'frostbolt') {
      const x = pr.x;
      const y = pr.y;
      this.effects.frostBurst(x, y, pr.splashRadius);
      this.splash(x, y, pr.splashRadius, pr.damage, 'magic', true, src, pr.slowFactor, pr.slowDuration, 0);
      // make sure the direct target is always affected even if it moved out of the burst
      if (pr.hasLiveTarget && pr.target && Math.hypot(pr.target.x - x, pr.target.y - y) > pr.splashRadius) {
        pr.target.applySlow(pr.slowFactor, pr.slowDuration);
        this.damageEnemy(pr.target, pr.damage, 'magic', src, P.ice);
      }
      this.audio.play('hit');
      return;
    }
    // cannonball
    const x = pr.gx;
    const y = pr.gy;
    this.effects.explosion(x, y, pr.splashRadius);
    this.splash(x, y, pr.splashRadius, pr.damage, pr.damageType, false, src, 1, 0, 0.5);
    this.audio.play('explode');
    if (src && src.level >= 3) this.cameras.main.shake(110, 0.0025);
    else this.cameras.main.shake(70, 0.0012);
  }

  /** Area damage. `falloff` = damage fraction lost at the edge of the radius. */
  private splash(x: number, y: number, radius: number, damage: number, type: DamageType, hitsAir: boolean, src: Tower | null, slow: number, slowDur: number, falloff: number): void {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (!e.alive || (e.flying && !hitsAir)) continue;
      const dx = e.groundX - x;
      const dy = (e.flying ? e.y : e.groundY) - y;
      const reach = radius + e.def.radius;
      const d2 = dx * dx + dy * dy;
      if (d2 > reach * reach) continue;
      const k = 1 - falloff * Math.min(1, Math.sqrt(d2) / reach);
      if (slow < 1) e.applySlow(slow, slowDur);
      this.damageEnemy(e, damage * k, type, src, slow < 1 ? P.ice : P.gold);
    }
  }

  private damageEnemy(e: Enemy, amount: number, type: DamageType, src: Tower | null, color: number): void {
    if (!e.alive) return;
    const resist = type === 'physical' ? e.def.armor : e.def.magicResist;
    const dmg = amount * (1 - resist);
    e.hp -= dmg;
    e.flash();
    e.updateBar();
    const shown = Math.max(1, Math.round(dmg));
    this.effects.floatText(e.x, e.y - e.barOffset - 4, String(shown), resist >= 0.5 ? P.stone : color, resist >= 0.5 ? 13 : 15, 0.6);
    if (e.hp <= 0) this.killEnemy(e, src);
  }

  private killEnemy(e: Enemy, src: Tower | null): void {
    const idx = this.enemies.indexOf(e);
    if (idx >= 0) {
      this.enemies[idx] = this.enemies[this.enemies.length - 1];
      this.enemies.pop();
    }
    e.alive = false;
    e.updateBar();
    if (src) src.kills++;
    this.economy.earn(e.gold);
    this.effects.floatText(e.x, e.y - 18, `+${e.gold}`, P.gold, e.isBoss ? 24 : 16, 1.0);
    this.effects.goldBurst(e.x, e.y, e.gold);
    this.effects.coinFly(e.x, e.y, e.isBoss ? 5 : 1);
    this.effects.death(e.x, e.y, ENEMY_DEATH_COLOR[e.def.type], e.isBoss);
    this.audio.play(e.isBoss ? 'boss_death' : 'death');
    if (e.isBoss) this.cameras.main.shake(380, 0.006);
    e.shadow.setVisible(false);
    e.setTintMode(Phaser.TintModes.FILL).setTint(P.cream);
    this.tweens.add({
      targets: e,
      scale: e.scale * 0.3,
      alpha: 0,
      angle: e.angle + (e.flipX ? -40 : 40),
      duration: e.isBoss ? 420 : 220,
      ease: 'Quad.easeIn',
      onComplete: () => e.despawn(),
    });
  }

  private leak(e: Enemy, index: number): void {
    this.enemies[index] = this.enemies[this.enemies.length - 1];
    this.enemies.pop();
    e.despawn();
    this.economy.loseLives(e.def.livesCost);
    this.audio.play('life_lost');
    this.cameras.main.shake(e.isBoss ? 500 : 160, e.isBoss ? 0.008 : 0.003);
    this.cameras.main.flash(180, 216, 87, 107, false);
    if (this.economy.lives <= 0) this.endGame(false);
  }

  private endGame(victory: boolean): void {
    if (this.ended) return;
    this.ended = true;
    this.select(null);
    this.buildType = null;
    const reached = victory ? this.waves.totalWaves : Math.max(0, this.waves.currentWave);
    const record = SaveData.submitWave(reached);
    this.audio.play(victory ? 'victory' : 'defeat');
    this.events.emit(GameEvents.GameEnded, victory, reached);
    if (victory) {
      for (let i = 0; i < 6; i++) {
        this.time.delayedCall(i * 220, () => this.effects.death(Phaser.Math.Between(MAP_X + 120, MAP_X + MAP_WIDTH - 120), Phaser.Math.Between(MAP_Y + 150, MAP_Y + MAP_HEIGHT - 150), P.gold, true));
      }
    } else {
      this.cameras.main.shake(600, 0.006);
    }
    this.time.delayedCall(1800, () => {
      this.cameras.main.fadeOut(500, 42, 34, 56);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        this.scene.stop('UIScene');
        this.scene.start('GameOverScene', { victory, wave: reached, best: SaveData.getBestWave(), record });
      });
    });
  }

  // ------------------------------------------------------------- drawing --
  private drawPlacementAndRange(realDt: number): void {
    const rg = this.rangeG;
    const pg = this.placeG;
    rg.clear();
    pg.clear();
    this.rangePulse += realDt;

    if (this.buildType && this.pointerInMap) {
      const c = this.hoverTile.x;
      const r = this.hoverTile.y;
      const ok = this.path.isBuildable(c, r) && this.economy.canAfford(TOWERS[this.buildType].levels[0].cost);
      // snap animation: ease the ghost toward the tile center
      const k = 1 - Math.exp(-realDt * 22);
      this.previewPos.x += (this.previewTarget.x - this.previewPos.x) * k;
      this.previewPos.y += (this.previewTarget.y - this.previewPos.y) * k;
      const base = artScale(this, this.preview.texture.key);
      this.preview.setScale(this.preview.scale + (base - this.preview.scale) * k);
      this.preview.setPosition(this.previewPos.x, this.previewPos.y - 2).setVisible(true);
      this.preview.setTintMode(Phaser.TintModes.MULTIPLY).setTint(ok ? 0xffffff : P.berry);
      const color = ok ? P.leaf : P.berry;
      const x = MAP_X + c * TILE;
      const y = MAP_Y + r * TILE;
      const pulse = 0.5 + Math.sin(this.rangePulse * 6) * 0.15;
      pg.fillStyle(color, 0.28 * pulse + 0.1).fillRoundedRect(x + 2, y + 2, TILE - 4, TILE - 4, 10);
      pg.lineStyle(2.5, color, 0.95).strokeRoundedRect(x + 2, y + 2, TILE - 4, TILE - 4, 10);
      this.drawRange(rg, this.previewPos.x, this.previewPos.y, TOWERS[this.buildType].levels[0].range, ok ? P.cream : P.berry);
    } else {
      this.preview.setVisible(false);
    }

    const sel = this.selected;
    if (sel) {
      this.drawRange(rg, sel.x, sel.y, sel.stats.range, P.gold);
      const x = MAP_X + sel.col * TILE;
      const y = MAP_Y + sel.row * TILE;
      pg.lineStyle(2.5, P.gold, 0.9).strokeRoundedRect(x + 2, y + 2, TILE - 4, TILE - 4, 10);
    }
    const hov = this.hovered;
    if (hov && hov !== sel && !this.buildType) this.drawRange(rg, hov.x, hov.y, hov.stats.range, P.cream);
  }

  private drawRange(g: Phaser.GameObjects.Graphics, x: number, y: number, range: number, color: number): void {
    g.fillStyle(color, 0.08).fillCircle(x, y, range);
    g.lineStyle(2, color, 0.55).strokeCircle(x, y, range);
    // rotating dashes for a bit of life
    const dashes = 24;
    const rot = this.rangePulse * 0.35;
    g.lineStyle(3, color, 0.9);
    for (let i = 0; i < dashes; i++) {
      const a0 = rot + (i / dashes) * Math.PI * 2;
      g.beginPath();
      g.arc(x, y, range, a0, a0 + 0.08, false);
      g.strokePath();
    }
  }

  // ---------------------------------------------------------------- debug --
  /** Dev only (?stress): floods the map to measure performance. */
  private stressTest(): void {
    this.economy.earn(5000);
    let n = 0;
    this.time.addEvent({
      delay: 40,
      repeat: 199,
      callback: () => {
        const types: EnemyType[] = ['basic', 'fast', 'armored', 'flying'];
        this.spawnEnemy(types[n++ % 4], 60, 1);
      },
    });
  }
}

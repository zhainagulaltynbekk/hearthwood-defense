import Phaser from 'phaser';
import { FONT_FAMILY, PALETTE as P, css } from '../config/palette';
import { GAME_HEIGHT, GAME_WIDTH, GRID_COLS, GRID_ROWS, MAP_X, MAP_Y, TEX_RES, TILE } from '../config/layout';
import type { TowerType } from '../config/balance';
import { TileKind, type PathSystem } from '../systems/PathSystem';
import { Rng } from './rng';
import {
  ball,
  blobPath,
  canvasTexture,
  dark,
  ellipsePath,
  fillOutline,
  glow,
  light,
  line,
  mix,
  polyPath,
  rgba,
  roundRectPath,
  shade,
  star,
  vshade,
  type ArtData,
  type Ctx,
} from './paint';
import { HERO_H, HERO_W, WEAPON_H, WEAPON_W, drawHero, drawWeapon } from './heroes';
import { drawBat, drawFox, drawOgreKing, drawSlime, drawTurtleKnight } from './monsters';
import {
  BASE_DECK_Y,
  BASE_H,
  BASE_W,
  drawBush,
  drawCloud,
  drawLily,
  drawMushrooms,
  drawOak,
  drawPine,
  drawRock,
  drawSakura,
  drawShadow,
  drawTowerBase,
} from './world';

type BitmapFontData = Phaser.Types.GameObjects.BitmapText.BitmapFontData;

/** Cache key of the generated bitmap font used for floating numbers. */
export const NUMBER_FONT = 'num';

/** Display scale for a texture: generated textures are 2x, sprite-pack images carry their own scale. */
export function artScale(scene: Phaser.Scene, key: string): number {
  const tex = scene.textures.get(key);
  const data = tex.customData as ArtData;
  return data.artScale ?? 1 / TEX_RES;
}

const TOWERS: TowerType[] = ['archer', 'cannon', 'frost', 'mage'];

/**
 * Generates every texture at boot with Canvas 2D (gradients, glows, bezier
 * shapes) so the project ships no image files. Drawing code lives in
 * heroes.ts, monsters.ts and world.ts; this class wires keys to painters.
 */
export class TextureFactory {
  constructor(private readonly scene: Phaser.Scene) {}

  destroy(): void {
    // nothing pooled: kept for API symmetry with callers
  }

  private tex(key: string, w: number, h: number, draw: (ctx: Ctx) => void): void {
    canvasTexture(this.scene, key, w, h, draw);
  }

  generateAll(): void {
    this.tex('shadow', 64, 24, drawShadow);
    this.tex('tree_0', 80, 100, drawOak);
    this.tex('tree_1', 64, 104, drawPine);
    this.tex('tree_2', 84, 100, drawSakura);
    this.tex('rock', 64, 48, drawRock);
    this.tex('bush', 64, 52, drawBush);
    this.tex('mush', 56, 48, drawMushrooms);
    this.tex('lily', 32, 24, drawLily);
    this.tex('cloud', 220, 120, drawCloud);
    this.tex('shimmer', 30, 8, (c) => {
      ellipsePath(c, 15, 4, 15, 3.5);
      c.fillStyle = rgba(P.ice, 0.35);
      c.fill();
      ellipsePath(c, 15, 4, 9, 1.4);
      c.fillStyle = rgba(P.cream, 0.95);
      c.fill();
    });

    this.tex('enemy_basic', 52, 48, drawSlime);
    this.tex('enemy_fast', 62, 50, drawFox);
    this.tex('enemy_armored', 62, 56, drawTurtleKnight);
    this.tex('enemy_flying_0', 64, 48, (c) => drawBat(c, true));
    this.tex('enemy_flying_1', 64, 48, (c) => drawBat(c, false));
    this.tex('enemy_boss', 104, 104, drawOgreKing);

    for (const type of TOWERS) {
      for (let lvl = 1; lvl <= 3; lvl++) {
        this.tex(`tower_${type}_base_${lvl}`, BASE_W, BASE_H, (c) => drawTowerBase(c, type, lvl));
        this.tex(`hero_${type}_${lvl}`, HERO_W, HERO_H, (c) => drawHero(c, type, lvl));
        this.tex(`tower_${type}_turret_${lvl}`, WEAPON_W, WEAPON_H, (c) => drawWeapon(c, type, lvl));
      }
      // shop card portrait: base + hero
      this.tex(`icon_tower_${type}`, 80, 112, (c) => {
        c.save();
        c.translate(0, 20);
        drawTowerBase(c, type, 1);
        c.restore();
        c.save();
        c.translate(40 - HERO_W / 2, 20 + BASE_DECK_Y - 76);
        drawHero(c, type, 1);
        c.restore();
      });
    }

    this.projectiles();
    this.particles();
    this.icons();
    this.uiPieces();
    this.numberFont();
  }

  // ---------------------------------------------------------- projectiles --
  private projectiles(): void {
    this.tex('proj_arrow', 34, 12, (c) => {
      glow(c, 26, 6, 8, P.leaf, 0.6);
      line(c, 4, 6, 26, 6, 2, P.wood, 1.2);
      polyPath(c, [33, 6, 24, 1.5, 26, 6, 24, 10.5]);
      fillOutline(c, P.cream, 1.2);
      polyPath(c, [1, 1.5, 8, 4.5, 8, 7.5, 1, 10.5, 3.5, 6]);
      fillOutline(c, P.berry, 1);
    });
    this.tex('proj_cannonball', 22, 22, (c) => {
      ball(c, 11, 11, 7.5, mix(P.stone, P.ink, 0.55), 1.6);
      c.beginPath();
      c.arc(11, 11, 7.5, Math.PI * 0.15, Math.PI * 0.85);
      c.lineWidth = 2;
      c.strokeStyle = rgba(P.gold);
      c.stroke();
    });
    this.tex('proj_frostbolt', 30, 20, (c) => {
      glow(c, 15, 10, 10, P.ice, 0.9);
      polyPath(c, [28, 10, 15, 4, 4, 10, 15, 16]);
      vshade(c, P.cream, P.water, 4, 16, 1.4);
    });
  }

  // ------------------------------------------------------------ particles --
  private particles(): void {
    this.tex('p_soft', 16, 16, (c) => glow(c, 8, 8, 8, P.cream, 1));
    this.tex('p_spark', 18, 6, (c) => {
      ellipsePath(c, 9, 3, 9, 3);
      c.fillStyle = rgba(P.cream, 0.4);
      c.fill();
      ellipsePath(c, 10, 3, 5.5, 1.3);
      c.fillStyle = rgba(P.cream);
      c.fill();
    });
    this.tex('p_smoke', 32, 32, (c) => {
      for (const [x, y, r] of [[16, 16, 12], [11, 18, 9], [21, 18, 9], [16, 12, 9]]) glow(c, x, y, r, P.cream, 0.55);
    });
    this.tex('p_chunk', 10, 10, (c) => {
      blobPath(c, [2, 4, 5, 1.5, 8.5, 3, 8, 8, 3, 8.5]);
      shade(c, P.stone, 5, 5, 4, 1);
    });
    this.tex('p_chunk_wood', 12, 8, (c) => {
      roundRectPath(c, 1.5, 2, 9, 4, 1.5);
      vshade(c, P.wood, dark(P.wood, 0.4), 2, 6, 1);
    });
    this.tex('p_ice', 14, 14, (c) => {
      c.strokeStyle = rgba(P.cream);
      c.lineWidth = 1.6;
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI;
        c.beginPath();
        c.moveTo(7 - Math.cos(a) * 6, 7 - Math.sin(a) * 6);
        c.lineTo(7 + Math.cos(a) * 6, 7 + Math.sin(a) * 6);
        c.stroke();
      }
      glow(c, 7, 7, 4, P.cream, 0.9);
    });
    this.tex('p_star', 18, 18, (c) => {
      glow(c, 9, 9, 8, P.cream, 0.6);
      star(c, 9, 9, 8.5, 2, 4);
      c.fillStyle = rgba(P.cream);
      c.fill();
    });
    this.tex('p_ring', 64, 64, (c) => {
      c.beginPath();
      c.arc(32, 32, 28, 0, Math.PI * 2);
      c.lineWidth = 6;
      c.strokeStyle = rgba(P.cream, 0.3);
      c.stroke();
      c.lineWidth = 2.5;
      c.strokeStyle = rgba(P.cream);
      c.stroke();
    });
    this.tex('p_leaf', 10, 7, (c) => {
      ellipsePath(c, 5, 3.5, 4.5, 2.4, 0.3);
      c.fillStyle = rgba(P.cream);
      c.fill();
    });
    this.tex('p_petal', 12, 10, (c) => {
      c.beginPath();
      c.moveTo(1, 5);
      c.quadraticCurveTo(6, -1, 11, 4);
      c.quadraticCurveTo(7, 3, 9, 7);
      c.quadraticCurveTo(5, 10, 1, 5);
      c.closePath();
      const g = c.createLinearGradient(0, 0, 12, 10);
      g.addColorStop(0, rgba(P.cream));
      g.addColorStop(1, rgba(mix(P.berry, P.cream, 0.45)));
      c.fillStyle = g;
      c.fill();
    });
    this.tex('p_coin', 12, 12, (c) => ball(c, 6, 6, 4.2, P.gold, 1));
    this.tex('p_bar', 4, 4, (c) => {
      c.fillStyle = rgba(P.cream);
      c.fillRect(0, 0, 4, 4);
    });
  }

  // ---------------------------------------------------------------- icons --
  private icons(): void {
    const coin = (c: Ctx, x: number, y: number, r: number) => {
      ellipsePath(c, x, y, r, r);
      shade(c, P.gold, x, y, r, 2, 0.55, 0.35);
      c.beginPath();
      c.arc(x, y, r * 0.62, 0, Math.PI * 2);
      c.lineWidth = 1.4;
      c.strokeStyle = rgba(dark(P.gold, 0.35));
      c.stroke();
      star(c, x, y, r * 0.42, r * 0.18, 5);
      c.fillStyle = rgba(light(P.gold, 0.45));
      c.fill();
    };
    this.tex('icon_gold', 28, 28, (c) => coin(c, 14, 14, 11));
    this.tex('icon_heart', 28, 28, (c) => {
      c.beginPath();
      c.moveTo(14, 25);
      c.bezierCurveTo(1, 16, 2, 4, 9, 4);
      c.bezierCurveTo(12, 4, 14, 7, 14, 9);
      c.bezierCurveTo(14, 7, 16, 4, 19, 4);
      c.bezierCurveTo(26, 4, 27, 16, 14, 25);
      c.closePath();
      shade(c, P.berry, 12, 12, 12, 2, 0.5, 0.35);
      ellipsePath(c, 9, 9, 3, 1.8, -0.6);
      c.fillStyle = rgba(P.cream, 0.85);
      c.fill();
    });
    this.tex('icon_wave', 28, 28, (c) => {
      line(c, 7, 4, 7, 25, 2.2, P.wood, 1.2);
      polyPath(c, [8, 5, 24, 7, 19, 11.5, 24, 16, 8, 16]);
      vshade(c, light(P.berry, 0.2), dark(P.berry, 0.3), 5, 16, 1.6);
      ball(c, 7, 4, 2.2, P.gold, 1);
    });
    const glyph = (key: string, draw: (c: Ctx) => void) =>
      this.tex(key, 28, 28, (c) => {
        c.save();
        c.shadowColor = rgba(P.ink, 0.6);
        c.shadowOffsetY = 1.5;
        c.shadowBlur = 0;
        draw(c);
        c.restore();
      });
    glyph('icon_play', (c) => {
      polyPath(c, [9, 5, 23, 14, 9, 23]);
      c.fillStyle = rgba(P.cream);
      c.fill();
    });
    glyph('icon_pause', (c) => {
      c.fillStyle = rgba(P.cream);
      roundRectPath(c, 7, 6, 5, 16, 2);
      c.fill();
      roundRectPath(c, 16, 6, 5, 16, 2);
      c.fill();
    });
    glyph('icon_speed', (c) => {
      c.fillStyle = rgba(P.cream);
      polyPath(c, [3, 6, 14, 14, 3, 22]);
      c.fill();
      polyPath(c, [14, 6, 25, 14, 14, 22]);
      c.fill();
    });
    const speaker = (c: Ctx) => {
      c.fillStyle = rgba(P.cream);
      polyPath(c, [4, 11, 9, 11, 15, 5, 15, 23, 9, 17, 4, 17]);
      c.fill();
    };
    glyph('icon_sound', (c) => {
      speaker(c);
      c.strokeStyle = rgba(P.cream);
      c.lineWidth = 2.2;
      c.beginPath();
      c.arc(15, 14, 5, -0.9, 0.9);
      c.stroke();
      c.beginPath();
      c.arc(15, 14, 9.5, -0.9, 0.9);
      c.stroke();
    });
    glyph('icon_mute', (c) => {
      speaker(c);
      c.strokeStyle = rgba(P.berry);
      c.lineWidth = 2.6;
      c.beginPath();
      c.moveTo(18, 10);
      c.lineTo(25, 18);
      c.moveTo(25, 10);
      c.lineTo(18, 18);
      c.stroke();
    });
    glyph('icon_fullscreen', (c) => {
      c.strokeStyle = rgba(P.cream);
      c.lineWidth = 2.8;
      for (const [cx, cy, sx, sy] of [[5, 5, 1, 1], [23, 5, -1, 1], [5, 23, 1, -1], [23, 23, -1, -1]]) {
        c.beginPath();
        c.moveTo(cx, cy + sy * 7);
        c.lineTo(cx, cy);
        c.lineTo(cx + sx * 7, cy);
        c.stroke();
      }
    });
    glyph('icon_close', (c) => {
      c.strokeStyle = rgba(P.cream);
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(7, 7);
      c.lineTo(21, 21);
      c.moveTo(21, 7);
      c.lineTo(7, 21);
      c.stroke();
    });
    this.tex('icon_upgrade', 28, 28, (c) => {
      polyPath(c, [14, 2, 25, 14, 18, 14, 18, 25, 10, 25, 10, 14, 3, 14]);
      vshade(c, light(P.gold, 0.4), dark(P.gold, 0.25), 2, 25, 1.8);
    });
    this.tex('icon_sell', 28, 28, (c) => {
      coin(c, 12, 12, 9);
      polyPath(c, [19, 13, 26, 13, 26, 19, 23, 19, 23, 25, 20, 25, 20, 19, 17, 19]);
      vshade(c, P.berry, dark(P.berry, 0.3), 13, 25, 1.4);
    });
    this.tex('icon_target', 28, 28, (c) => {
      c.strokeStyle = rgba(P.cream);
      c.lineWidth = 2.2;
      c.beginPath();
      c.arc(14, 14, 8, 0, Math.PI * 2);
      c.stroke();
      c.beginPath();
      c.moveTo(14, 2);
      c.lineTo(14, 8);
      c.moveTo(14, 20);
      c.lineTo(14, 26);
      c.moveTo(2, 14);
      c.lineTo(8, 14);
      c.moveTo(20, 14);
      c.lineTo(26, 14);
      c.stroke();
      ball(c, 14, 14, 2.6, P.berry, 1);
    });
    this.tex('icon_next', 28, 28, (c) => {
      polyPath(c, [3, 6, 12, 14, 3, 22]);
      vshade(c, light(P.gold, 0.4), dark(P.gold, 0.2), 6, 22, 1.4);
      polyPath(c, [14, 6, 23, 14, 14, 22]);
      vshade(c, light(P.gold, 0.4), dark(P.gold, 0.2), 6, 22, 1.4);
    });
    this.tex('icon_crown', 28, 28, (c) => {
      polyPath(c, [3, 21, 4, 8, 9, 13, 14, 4, 19, 13, 24, 8, 25, 21]);
      vshade(c, light(P.gold, 0.4), dark(P.gold, 0.3), 4, 21, 1.8);
      ball(c, 14, 16, 2.4, P.berry, 1);
    });
    this.tex('icon_wing', 28, 28, (c) => {
      polyPath(c, [3, 19, 10, 6, 25, 3, 21, 10, 25, 13, 19, 17, 21, 21, 11, 22]);
      vshade(c, P.cream, P.ice, 3, 22, 1.6);
    });
  }

  // ------------------------------------------------------------ UI pieces --
  private uiPieces(): void {
    // Ribbon banner behind wave announcements.
    this.tex('ui_ribbon', 420, 64, (c) => {
      for (const dir of [-1, 1]) {
        const x0 = dir < 0 ? 40 : 380;
        polyPath(c, [x0, 18, x0 + dir * 36, 18, x0 + dir * 24, 34, x0 + dir * 36, 50, x0, 50]);
        vshade(c, dark(P.berry, 0.15), dark(P.berry, 0.45), 18, 50, 2.2);
      }
      roundRectPath(c, 28, 8, 364, 44, 10);
      vshade(c, light(P.berry, 0.15), dark(P.berry, 0.3), 8, 52, 2.4);
      roundRectPath(c, 34, 13, 352, 34, 7);
      c.lineWidth = 1.8;
      c.strokeStyle = rgba(P.gold, 0.95);
      c.stroke();
      ellipsePath(c, 210, 16, 160, 3);
      c.fillStyle = rgba(P.cream, 0.3);
      c.fill();
      for (const x of [44, 376]) ball(c, x, 30, 3.4, P.gold, 1.2);
    });

    // Heraldic crest for the title screen.
    this.tex('crest', 160, 180, (c) => {
      glow(c, 80, 84, 80, P.gold, 0.35);
      const shield = [80, 8, 148, 30, 142, 102, 80, 172, 18, 102, 12, 30];
      polyPath(c, shield);
      vshade(c, light(P.pine, 0.15), dark(P.pine, 0.4), 8, 172, 3.4);
      c.save();
      polyPath(c, shield);
      c.clip();
      const g = c.createLinearGradient(0, 0, 160, 180);
      g.addColorStop(0, rgba(P.cream, 0.25));
      g.addColorStop(0.5, rgba(P.cream, 0));
      c.fillStyle = g;
      c.fillRect(0, 0, 160, 180);
      c.restore();
      polyPath(c, [80, 16, 140, 35, 135, 99, 80, 162, 25, 99, 20, 35]);
      c.lineWidth = 3;
      c.strokeStyle = rgba(P.gold);
      c.stroke();
      // cherry tree emblem
      drawSakuraEmblem(c);
      polyPath(c, [52, 34, 56, 14, 67, 26, 80, 8, 93, 26, 104, 14, 108, 34]);
      vshade(c, light(P.gold, 0.4), dark(P.gold, 0.3), 8, 34, 2.4);
      ball(c, 80, 24, 3.6, P.berry, 1.2);
    });
  }

  // -------------------------------------------------------------- numbers --
  /**
   * Bitmap font for floating damage / gold numbers. BitmapText only swaps
   * glyph quads on setText, so hundreds of hits per second never re-render a
   * canvas or upload a texture (unlike Text objects).
   */
  private numberFont(): void {
    if (this.scene.cache.bitmapFont.exists(NUMBER_FONT)) return;
    const chars = '0123456789+-';
    const size = 18 * TEX_RES;
    const pad = 4 * TEX_RES;
    const cellW = size + pad;
    const cellH = size + pad * 2;
    const tex = this.scene.textures.createCanvas('font_num', cellW * chars.length, cellH);
    if (!tex) return;
    const ctx = tex.getContext();
    ctx.font = `700 ${size}px ${FONT_FAMILY}`;
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 4.5 * TEX_RES;
    ctx.strokeStyle = css(P.ink);
    ctx.fillStyle = '#ffffff';
    const data: BitmapFontData = { retroFont: false, font: NUMBER_FONT, size: cellH, lineHeight: cellH, chars: {} };
    for (let i = 0; i < chars.length; i++) {
      const ch = chars[i];
      const w = Math.ceil(ctx.measureText(ch).width);
      const x = i * cellW + (cellW - w) / 2;
      ctx.strokeText(ch, x, cellH / 2);
      ctx.fillText(ch, x, cellH / 2);
      const gx = i * cellW;
      // xAdvance is read at runtime but missing from the published typings
      data.chars[ch.charCodeAt(0)] = <Phaser.Types.GameObjects.BitmapText.BitmapFontCharacterData>{
        x: gx,
        y: 0,
        width: cellW,
        height: cellH,
        centerX: cellW / 2,
        centerY: cellH / 2,
        xOffset: -(cellW - w) / 2 + ctx.lineWidth / 2,
        yOffset: 0,
        xAdvance: w + ctx.lineWidth * 0.5,
        data: {},
        kerning: {},
        u0: gx / tex.width,
        v0: 1,
        u1: (gx + cellW) / tex.width,
        v1: 1 - cellH / tex.height,
      };
    }
    tex.refresh();
    this.scene.cache.bitmapFont.add(NUMBER_FONT, { data, texture: 'font_num', frame: null });
  }

  // -------------------------------------------------------------- terrain --
  /**
   * Bakes the ground for the whole 720 x 1280 screen (lush grass, a winding
   * cobbled path with soft edges, ponds with sandy banks and foam, small
   * flowers and grass blades) into one 'terrain' texture.
   */
  bakeTerrain(path: PathSystem, seed: number): void {
    if (this.scene.textures.exists('terrain')) this.scene.textures.remove('terrain');
    const rng = new Rng(seed);
    canvasTexture(this.scene, 'terrain', GAME_WIDTH, GAME_HEIGHT, (c) => {
      // base grass gradient
      const base = c.createLinearGradient(0, 0, 0, GAME_HEIGHT);
      base.addColorStop(0, rgba(mix(P.grass, P.leaf, 0.25)));
      base.addColorStop(0.5, rgba(P.grass));
      base.addColorStop(1, rgba(mix(P.grass, P.pine, 0.35)));
      c.fillStyle = base;
      c.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
      // painterly tonal blobs
      for (let i = 0; i < 260; i++) {
        const x = rng.range(-30, GAME_WIDTH + 30);
        const y = rng.range(-30, GAME_HEIGHT + 30);
        const r = rng.range(20, 70);
        const lightBlob = rng.chance(0.5);
        glow(c, x, y, r, lightBlob ? P.leaf : P.pine, lightBlob ? 0.16 : 0.14);
      }

      const inGrid = (col: number, row: number) => path.inGrid(col, row);
      const kindAt = (col: number, row: number) => (inGrid(col, row) ? path.tileAt(col, row) : TileKind.Grass);

      // subtle buildable-tile insets
      for (let r = 0; r < GRID_ROWS; r++) {
        for (let col = 0; col < GRID_COLS; col++) {
          if (path.tileAt(col, r) !== TileKind.Grass) continue;
          const x = MAP_X + col * TILE;
          const y = MAP_Y + r * TILE;
          roundRectPath(c, x + 4, y + 4, TILE - 8, TILE - 8, 14);
          c.fillStyle = rgba(P.leaf, 0.07);
          c.fill();
          c.lineWidth = 1.2;
          c.strokeStyle = rgba(P.pine, 0.12);
          c.stroke();
        }
      }

      // ---- water: one union path per pass, so tiles merge seamlessly
      const isWater = (col: number, row: number) => (row >= GRID_ROWS ? inGrid(col, GRID_ROWS - 1) && path.tileAt(col, GRID_ROWS - 1) === TileKind.Water : inGrid(col, row) && path.tileAt(col, row) === TileKind.Water);
      const waterPath = (expand: number, rad: number) => {
        c.beginPath();
        for (let r = 0; r < GRID_ROWS; r++) {
          for (let col = 0; col < GRID_COLS; col++) {
            if (!isWater(col, r)) continue;
            const wl = isWater(col - 1, r);
            const wr = isWater(col + 1, r);
            const wt = isWater(col, r - 1);
            const wb = isWater(col, r + 1);
            const x0 = MAP_X + col * TILE - (wl ? 0 : expand) - (col === 0 ? 40 : 0);
            const y0 = MAP_Y + r * TILE - (wt ? 0 : expand);
            const x1 = MAP_X + (col + 1) * TILE + (wr ? 0 : expand);
            const y1 = MAP_Y + (r + 1) * TILE + (wb ? 0 : expand);
            const rr = (a: boolean, b: boolean) => (!a && !b ? rad : 0);
            const tl = rr(wl || col === 0, wt);
            const tr = rr(wr, wt);
            const br = rr(wr, wb);
            const bl = rr(wl || col === 0, wb);
            c.moveTo(x0 + tl, y0);
            c.lineTo(x1 - tr, y0);
            if (tr) c.quadraticCurveTo(x1, y0, x1, y0 + tr);
            c.lineTo(x1, y1 - br);
            if (br) c.quadraticCurveTo(x1, y1, x1 - br, y1);
            c.lineTo(x0 + bl, y1);
            if (bl) c.quadraticCurveTo(x0, y1, x0, y1 - bl);
            c.lineTo(x0, y0 + tl);
            if (tl) c.quadraticCurveTo(x0, y0, x0 + tl, y0);
            c.closePath();
          }
        }
      };
      waterPath(10, 26);
      c.fillStyle = rgba(mix(P.stone, P.gold, 0.15));
      c.fill();
      waterPath(6, 22);
      c.fillStyle = rgba(mix(P.stone, P.wood, 0.35));
      c.fill();
      // foam rim: a cream fill that the water body then covers, leaving only the edge
      waterPath(3, 20);
      c.fillStyle = rgba(mix(P.cream, P.ice, 0.4));
      c.fill();
      waterPath(-1, 18);
      const wg = c.createLinearGradient(0, MAP_Y, 0, GAME_HEIGHT);
      wg.addColorStop(0, rgba(light(P.water, 0.2)));
      wg.addColorStop(1, rgba(dark(P.water, 0.25)));
      c.fillStyle = wg;
      c.fill();
      c.save();
      waterPath(-1, 18);
      c.clip();
      waterPath(-12, 16);
      c.fillStyle = rgba(dark(P.water, 0.3), 0.55);
      c.fill();
      // caustic sparkles
      for (let r = 0; r < GRID_ROWS; r++) {
        for (let col = 0; col < GRID_COLS; col++) {
          if (!isWater(col, r)) continue;
          for (let k = 0; k < 4; k++) {
            ellipsePath(c, MAP_X + col * TILE + rng.range(8, TILE - 8), MAP_Y + r * TILE + rng.range(8, TILE - 8), rng.range(6, 14), 1.6);
            c.fillStyle = rgba(P.ice, 0.45);
            c.fill();
          }
        }
      }
      c.restore();

      // ---- path: rounded strokes along the polyline, then cobbles
      const pts = path.points;
      const strokePath = (w: number, color: string, oy = 0) => {
        c.beginPath();
        c.moveTo(pts[0].x, pts[0].y + oy);
        for (let i = 1; i < pts.length; i++) c.lineTo(pts[i].x, pts[i].y + oy);
        c.lineWidth = w;
        c.strokeStyle = color;
        c.lineJoin = 'round';
        c.lineCap = 'round';
        c.stroke();
      };
      strokePath(66, rgba(P.ink, 0.18), 5);
      strokePath(64, rgba(mix(P.wood, P.ink, 0.25)));
      strokePath(58, rgba(mix(P.wood, P.stone, 0.45)));
      strokePath(50, rgba(P.stone));
      strokePath(26, rgba(light(P.stone, 0.25), 0.6));
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i];
        const b = pts[i + 1];
        const len = Math.hypot(b.x - a.x, b.y - a.y);
        const dx = (b.x - a.x) / len;
        const dy = (b.y - a.y) / len;
        for (let d = 0; d < len; d += 10) {
          for (let k = 0; k < 3; k++) {
            const off = rng.range(-21, 21);
            const along = d + rng.range(-4, 4);
            const x = a.x + dx * along - dy * off;
            const y = a.y + dy * along + dx * off;
            const w = rng.range(5, 9);
            const h = rng.range(4, 6.5);
            ellipsePath(c, x + 0.6, y + 1.2, w + 0.8, h + 0.8);
            c.fillStyle = rgba(P.ink, 0.12);
            c.fill();
            ellipsePath(c, x, y, w, h);
            const cg = c.createLinearGradient(0, y - h, 0, y + h);
            cg.addColorStop(0, rgba(light(P.stone, 0.35)));
            cg.addColorStop(1, rgba(dark(P.stone, 0.12)));
            c.fillStyle = cg;
            c.fill();
          }
        }
      }

      // ---- grass blades, flowers, pebbles on non-path tiles
      const cols = Math.ceil(GAME_WIDTH / TILE) + 1;
      const rows = Math.ceil(GAME_HEIGHT / TILE) + 1;
      for (let r = -2; r < rows; r++) {
        for (let col = -1; col < cols; col++) {
          const kind = kindAt(col, r);
          if (kind === TileKind.Path || kind === TileKind.Water) continue;
          const x = MAP_X + col * TILE;
          const y = MAP_Y + r * TILE;
          const tufts = rng.int(2, 4);
          for (let i = 0; i < tufts; i++) {
            const tx = x + rng.range(6, TILE - 6);
            const ty = y + rng.range(10, TILE - 4);
            c.lineWidth = 1.8;
            c.strokeStyle = rgba(P.pine, 0.65);
            for (const [bx, by] of [[-4, -7], [0, -10], [4, -7]]) {
              c.beginPath();
              c.moveTo(tx, ty);
              c.quadraticCurveTo(tx + bx * 0.3, ty + by * 0.6, tx + bx, ty + by);
              c.stroke();
            }
            c.lineWidth = 1.2;
            c.strokeStyle = rgba(P.leaf, 0.7);
            c.beginPath();
            c.moveTo(tx + 0.6, ty - 1);
            c.lineTo(tx + 1, ty - 7);
            c.stroke();
          }
          if (rng.chance(0.3)) {
            const fx = x + rng.range(10, TILE - 10);
            const fy = y + rng.range(10, TILE - 10);
            const col2 = rng.pick([P.cream, P.gold, P.berry, P.arcane, mix(P.berry, P.cream, 0.5)]);
            for (let i = 0; i < 5; i++) {
              const a = (i / 5) * Math.PI * 2 + 0.4;
              ellipsePath(c, fx + Math.cos(a) * 2.4, fy + Math.sin(a) * 2.4, 2, 2);
              c.fillStyle = rgba(col2);
              c.fill();
            }
            ellipsePath(c, fx, fy, 1.4, 1.4);
            c.fillStyle = rgba(P.gold);
            c.fill();
          }
          if (rng.chance(0.06)) {
            // fallen petals
            for (let i = 0; i < 4; i++) {
              ellipsePath(c, x + rng.range(6, TILE - 6), y + rng.range(6, TILE - 6), 2.4, 1.4, rng.range(0, 3));
              c.fillStyle = rgba(mix(P.berry, P.cream, 0.55), 0.9);
              c.fill();
            }
          }
        }
      }
    });
  }
}

function drawSakuraEmblem(c: Ctx): void {
  c.beginPath();
  c.moveTo(74, 132);
  c.quadraticCurveTo(78, 108, 70, 92);
  c.lineTo(78, 92);
  c.quadraticCurveTo(82, 102, 88, 92);
  c.lineTo(94, 94);
  c.quadraticCurveTo(86, 110, 88, 132);
  c.closePath();
  vshade(c, P.wood, dark(P.wood, 0.4), 92, 132, 2.2);
  const pink = mix(P.berry, P.cream, 0.5);
  for (const [x, y, r] of [[58, 88, 15], [104, 88, 15], [80, 76, 22], [66, 66, 13], [96, 66, 13]]) {
    ellipsePath(c, x, y, r, r * 0.9);
    shade(c, pink, x, y, r, 2.2, 0.45, 0.3);
  }
  for (const [x, y] of [[70, 62], [90, 58], [60, 84], [100, 84], [80, 74]]) {
    star(c, x, y, 3.4, 1.5, 5);
    c.fillStyle = rgba(P.cream);
    c.fill();
  }
}

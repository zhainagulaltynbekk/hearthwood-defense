import Phaser from 'phaser';
import { FONT_FAMILY, PALETTE as P, css } from '../config/palette';
import { GAME_HEIGHT, GAME_WIDTH, GRID_COLS, GRID_ROWS, MAP_X, MAP_Y, TEX_RES, TILE } from '../config/layout';
import type { TowerType } from '../config/balance';
import { TileKind, type PathSystem } from '../systems/PathSystem';
import { Rng } from './rng';

type G = Phaser.GameObjects.Graphics;
type BitmapFontData = Phaser.Types.GameObjects.BitmapText.BitmapFontData;

/** Cache key of the generated bitmap font used for floating numbers. */
export const NUMBER_FONT = 'num';

interface ArtData {
  artScale?: number;
}

/** Display scale for a texture: generated textures are 2x, sprite-pack images carry their own scale. */
export function artScale(scene: Phaser.Scene, key: string): number {
  const tex = scene.textures.get(key);
  const data = tex.customData as ArtData;
  return data.artScale ?? 1 / TEX_RES;
}

const OL = 2; // outline thickness (logical px)

/** Blend two palette colors (equivalent to painting `b` over `a` at alpha `t`). */
function mix(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  return (Math.round(ar + (br - ar) * t) << 16) | (Math.round(ag + (bg - ag) * t) << 8) | Math.round(ab + (bb - ab) * t);
}
const v = (x: number, y: number): Phaser.Math.Vector2 => new Phaser.Math.Vector2(x, y);

// ---------------------------------------------------------------------------
// Shape helpers. All shading uses palette colors layered with alpha.
// ---------------------------------------------------------------------------

function ball(g: G, x: number, y: number, r: number, color: number, ol = OL, shade = 0.22, hi = 0.3): void {
  if (ol > 0) g.fillStyle(P.ink, 1).fillCircle(x, y, r + ol);
  g.fillStyle(color, 1).fillCircle(x, y, r);
  if (shade > 0) {
    g.fillStyle(P.ink, shade).fillCircle(x, y, r);
    g.fillStyle(color, 1).fillCircle(x - r * 0.13, y - r * 0.15, r * 0.8);
  }
  if (hi > 0) {
    g.fillStyle(P.cream, hi).fillEllipse(x - r * 0.3, y - r * 0.38, r * 0.95, r * 0.55);
    g.fillStyle(P.cream, Math.min(1, hi * 2.4)).fillCircle(x - r * 0.42, y - r * 0.45, Math.max(0.8, r * 0.13));
  }
}

function oval(g: G, x: number, y: number, w: number, h: number, color: number, ol = OL, shade = 0.22, hi = 0.28): void {
  if (ol > 0) g.fillStyle(P.ink, 1).fillEllipse(x, y, w + ol * 2, h + ol * 2);
  g.fillStyle(color, 1).fillEllipse(x, y, w, h);
  if (shade > 0) {
    g.fillStyle(P.ink, shade).fillEllipse(x, y, w, h);
    g.fillStyle(color, 1).fillEllipse(x - w * 0.06, y - h * 0.08, w * 0.86, h * 0.8);
  }
  if (hi > 0) {
    g.fillStyle(P.cream, hi).fillEllipse(x - w * 0.15, y - h * 0.22, w * 0.5, h * 0.28);
  }
}

function rrect(g: G, x: number, y: number, w: number, h: number, rad: number, color: number, ol = OL, shade = 0.22, hi = 0.25): void {
  const r = Math.min(rad, w / 2, h / 2);
  if (ol > 0) g.fillStyle(P.ink, 1).fillRoundedRect(x - ol, y - ol, w + ol * 2, h + ol * 2, r + ol);
  g.fillStyle(color, 1).fillRoundedRect(x, y, w, h, r);
  if (shade > 0) {
    g.fillStyle(P.ink, shade).fillRoundedRect(x, y, w, h, r);
    const h2 = h * 0.72;
    g.fillStyle(color, 1).fillRoundedRect(x, y, w, h2, Math.min(r, h2 / 2));
  }
  if (hi > 0 && h > 6) {
    const hh = Math.max(2, h * 0.18);
    g.fillStyle(P.cream, hi).fillRoundedRect(x + w * 0.12, y + h * 0.1, w * 0.76, hh, Math.min(hh / 2, r));
  }
}

function poly(g: G, pts: number[], color: number, ol = OL, alpha = 1): void {
  const points: Phaser.Math.Vector2[] = [];
  for (let i = 0; i < pts.length; i += 2) points.push(new Phaser.Math.Vector2(pts[i], pts[i + 1]));
  if (ol > 0) {
    g.lineStyle(ol * 2, P.ink, 1);
    g.strokePoints(points, true, true);
  }
  g.fillStyle(color, alpha);
  g.fillPoints(points, true, true);
}

function arcStroke(g: G, x: number, y: number, r: number, a0: number, a1: number, width: number, color: number, ol = OL): void {
  if (ol > 0) {
    g.lineStyle(width + ol * 2, P.ink, 1);
    g.beginPath();
    g.arc(x, y, r, a0, a1, false);
    g.strokePath();
  }
  g.lineStyle(width, color, 1);
  g.beginPath();
  g.arc(x, y, r, a0, a1, false);
  g.strokePath();
}

function line(g: G, x0: number, y0: number, x1: number, y1: number, width: number, color: number, ol = OL): void {
  if (ol > 0) g.lineStyle(width + ol * 2, P.ink, 1).lineBetween(x0, y0, x1, y1);
  g.lineStyle(width, color, 1).lineBetween(x0, y0, x1, y1);
}

/** Soft radial blob made of stacked translucent circles. */
function softCircle(g: G, x: number, y: number, r: number, color: number, maxAlpha: number, steps = 7): void {
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    g.fillStyle(color, maxAlpha / steps * 1.6);
    g.fillCircle(x, y, r * (1 - t * 0.85));
  }
}

function diamond(g: G, cx: number, cy: number, front: number, back: number, half: number, color: number, ol = OL): void {
  poly(g, [cx + front, cy, cx, cy - half, cx - back, cy, cx, cy + half], color, ol);
  // lower facet shade + upper highlight
  g.fillStyle(P.water, 0.45);
  g.fillTriangle(cx + front, cy, cx - back, cy, cx, cy + half);
  g.fillStyle(P.cream, 0.55);
  g.fillTriangle(cx + front * 0.6, cy - 1, cx, cy - half * 0.8, cx - back * 0.4, cy - 1);
}

// ---------------------------------------------------------------------------

export class TextureFactory {
  private readonly g: G;

  constructor(private readonly scene: Phaser.Scene) {
    this.g = scene.make.graphics({ x: 0, y: 0 }, false);
  }

  destroy(): void {
    this.g.destroy();
  }

  /** Draws into a new texture at TEX_RES. Skips keys that already exist (e.g. from a sprite pack). */
  private tex(key: string, w: number, h: number, draw: (g: G) => void): void {
    if (this.scene.textures.exists(key)) return;
    const g = this.g;
    g.clear();
    g.scaleCanvas(TEX_RES, TEX_RES);
    draw(g);
    g.generateTexture(key, Math.ceil(w * TEX_RES), Math.ceil(h * TEX_RES));
    const t = this.scene.textures.get(key);
    (t.customData as ArtData).artScale = 1 / TEX_RES;
  }

  generateAll(): void {
    this.props();
    this.enemies();
    for (const type of ['archer', 'cannon', 'frost', 'mage'] as TowerType[]) {
      for (let lvl = 1; lvl <= 3; lvl++) {
        this.tex(`tower_${type}_base_${lvl}`, 64, 64, (g) => this.drawBase(g, type, lvl));
        this.tex(`tower_${type}_turret_${lvl}`, 56, 56, (g) => this.drawTurret(g, type, lvl));
      }
      this.tex(`icon_tower_${type}`, 64, 64, (g) => {
        this.drawBase(g, type, 1);
        g.translateCanvas(4, -4);
        this.drawTurret(g, type, 1);
      });
    }
    this.projectiles();
    this.particles();
    this.icons();
    this.numberFont();
  }

  /**
   * Bitmap font for floating damage / gold numbers. BitmapText only swaps
   * glyph quads on setText, so hundreds of hits per second never re-render a
   * canvas or upload a texture (unlike Text objects).
   */
  private numberFont(): void {
    if (this.scene.cache.bitmapFont.exists(NUMBER_FONT)) return;
    const chars = '0123456789+-';
    const size = 16 * TEX_RES; // glyph em size in texture pixels
    const pad = 4 * TEX_RES;
    const cellW = size + pad;
    const cellH = size + pad * 2;
    const tex = this.scene.textures.createCanvas('font_num', cellW * chars.length, cellH);
    if (!tex) return;
    const ctx = tex.getContext();
    ctx.font = `700 ${size}px ${FONT_FAMILY}`;
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 4 * TEX_RES;
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
      const tw = tex.width;
      const th = tex.height;
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
        u0: gx / tw,
        v0: 1,
        u1: (gx + cellW) / tw,
        v1: 1 - cellH / th,
      };
    }
    tex.refresh();
    this.scene.cache.bitmapFont.add(NUMBER_FONT, { data, texture: 'font_num', frame: null });
  }

  // ---------------------------------------------------------------- props --
  private props(): void {
    this.tex('shadow', 64, 24, (g) => {
      for (let i = 0; i < 8; i++) {
        const t = i / 7;
        g.fillStyle(P.ink, 0.07);
        g.fillEllipse(32, 12, 62 * (1 - t * 0.6), 22 * (1 - t * 0.6));
      }
    });

    // Round oak
    this.tex('tree_0', 64, 84, (g) => {
      oval(g, 24, 78, 10, 5, P.wood, OL, 0, 0);
      oval(g, 40, 78, 10, 5, P.wood, OL, 0, 0);
      rrect(g, 27, 48, 10, 30, 4, P.wood, OL, 0.25, 0.15);
      g.fillStyle(P.ink, 0.25).fillRect(30, 56, 1.5, 14);
      ball(g, 32, 40, 21, P.pine, 2.5, 0.25, 0);
      ball(g, 16, 47, 13, P.pine, 2.5, 0.25, 0);
      ball(g, 48, 47, 13, P.pine, 2.5, 0.25, 0);
      g.fillStyle(P.pine, 1).fillCircle(32, 46, 18);
      ball(g, 32, 31, 17, P.grass, 0, 0.18, 0.18);
      ball(g, 20, 41, 11, P.grass, 0, 0.18, 0.1);
      ball(g, 44, 40, 12, P.grass, 0, 0.18, 0.1);
      ball(g, 27, 25, 8, P.leaf, 0, 0, 0.25);
      ball(g, 40, 30, 6, P.leaf, 0, 0, 0.2);
      ball(g, 17, 37, 4.5, P.leaf, 0, 0, 0.2);
      for (const [bx, by] of [[22, 48], [42, 50], [35, 22], [48, 38]]) ball(g, bx, by, 2.4, P.berry, 1, 0, 0.5);
    });

    // Fir tree
    this.tex('tree_1', 56, 88, (g) => {
      rrect(g, 23, 66, 10, 16, 3, P.wood, OL, 0.25, 0.1);
      const tier = (cy: number, hw: number, h: number) => {
        poly(g, [28, cy - h, 28 + hw, cy, 28 + hw * 0.6, cy + 6, 28 - hw * 0.6, cy + 6, 28 - hw, cy], P.pine, 2.5);
        g.fillStyle(P.grass, 0.9);
        g.fillTriangle(28, cy - h + 4, 28 - hw + 6, cy - 1, 28, cy + 2);
        g.fillStyle(P.leaf, 0.35);
        g.fillTriangle(28, cy - h + 6, 28 - hw * 0.5, cy - h * 0.35, 28 - 2, cy - h * 0.3);
      };
      tier(66, 26, 24);
      tier(48, 21, 22);
      tier(30, 15, 22);
      g.fillStyle(P.cream, 0.8).fillCircle(26, 11, 1.5);
    });

    this.tex('rock', 48, 36, (g) => {
      oval(g, 20, 20, 34, 26, P.stone, OL, 0.3, 0.3);
      oval(g, 37, 26, 16, 12, P.stone, OL, 0.3, 0.25);
      g.fillStyle(P.ink, 0.2).fillEllipse(16, 25, 10, 3);
      g.fillStyle(P.grass, 0.85).fillEllipse(16, 10, 14, 5);
      g.fillStyle(P.leaf, 0.7).fillEllipse(14, 9, 7, 2.5);
    });

    this.tex('bush', 48, 40, (g) => {
      ball(g, 14, 24, 11, P.pine, 2.5, 0.2, 0);
      ball(g, 34, 24, 11, P.pine, 2.5, 0.2, 0);
      ball(g, 24, 18, 13, P.pine, 2.5, 0.2, 0);
      g.fillStyle(P.pine, 1).fillRect(12, 22, 24, 12);
      ball(g, 24, 16, 10, P.grass, 0, 0.15, 0.2);
      ball(g, 14, 23, 7, P.grass, 0, 0.15, 0.1);
      ball(g, 34, 22, 7, P.grass, 0, 0.15, 0.1);
      const flower = (x: number, y: number, c: number) => {
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2;
          g.fillStyle(c, 1).fillCircle(x + Math.cos(a) * 2.2, y + Math.sin(a) * 2.2, 1.8);
        }
        g.fillStyle(P.gold, 1).fillCircle(x, y, 1.3);
      };
      flower(17, 15, P.cream);
      flower(30, 12, P.berry);
      flower(36, 25, P.cream);
      flower(11, 27, P.berry);
      flower(25, 26, P.arcane);
    });

    this.tex('shimmer', 26, 6, (g) => {
      g.fillStyle(P.ice, 0.35).fillEllipse(13, 3, 26, 5);
      g.fillStyle(P.cream, 0.9).fillEllipse(13, 3, 16, 2.2);
    });

    this.tex('lily', 24, 18, (g) => {
      poly(g, [12, 9, 22, 6, 21, 13, 12, 17, 3, 13, 2, 6, 10, 2], P.grass, 1.5);
      g.fillStyle(P.leaf, 0.6).fillEllipse(9, 7, 8, 4);
      g.lineStyle(1, P.pine, 0.8).lineBetween(12, 9, 18, 13);
      ball(g, 15, 7, 2.6, P.berry, 1, 0, 0.5);
    });
  }

  // -------------------------------------------------------------- enemies --
  private enemies(): void {
    // Goblin grunt
    this.tex('enemy_basic', 44, 44, (g) => {
      oval(g, 16, 37, 9, 6, P.wood, OL, 0, 0.2);
      oval(g, 28, 37, 9, 6, P.wood, OL, 0, 0.2);
      poly(g, [12, 20, 1, 12, 12, 14], P.leaf);
      poly(g, [32, 20, 43, 12, 32, 14], P.leaf);
      ball(g, 22, 24, 13, P.leaf, OL, 0.24, 0.32);
      g.fillStyle(P.wood, 1).fillRoundedRect(10, 28, 24, 6, 3);
      g.fillStyle(P.ink, 0.3).fillRoundedRect(10, 31, 24, 3, 1.5);
      g.fillStyle(P.gold, 1).fillRoundedRect(19, 28.5, 5, 5, 1.5);
      g.fillStyle(P.cream, 1).fillEllipse(24, 20, 6.5, 7.5).fillEllipse(30.5, 20, 5.5, 6.5);
      g.fillStyle(P.ink, 1).fillCircle(25.5, 20.5, 1.9).fillCircle(31.5, 20.5, 1.7);
      g.fillStyle(P.cream, 1).fillCircle(26, 19.6, 0.7).fillCircle(32, 19.6, 0.6);
      g.fillStyle(P.ink, 0.85).fillEllipse(28, 26, 5, 2);
      poly(g, [21, 11, 24, 4, 29, 9], P.pine, 1.2);
    });

    // Fox scout
    this.tex('enemy_fast', 50, 40, (g) => {
      for (const lx of [15, 21, 29, 35]) rrect(g, lx, 27, 4, 8, 2, P.wood, 1.5, 0.3, 0);
      oval(g, 10, 19, 18, 11, P.wood, OL, 0.2, 0.2);
      ball(g, 4, 16, 4.5, P.cream, 1.5, 0.1, 0.2);
      oval(g, 25, 23, 28, 16, P.wood, OL, 0.25, 0.3);
      g.fillStyle(P.cream, 0.95).fillEllipse(27, 27, 16, 6);
      poly(g, [33, 12, 34, 2, 39, 10], P.wood, 1.5);
      g.fillStyle(P.ink, 0.6).fillTriangle(34.5, 10, 35, 5, 37.5, 10);
      ball(g, 38, 17, 9, P.wood, OL, 0.22, 0.3);
      poly(g, [42, 14, 50, 19, 42, 23], P.cream, 1.5);
      g.fillStyle(P.ink, 1).fillCircle(49, 19, 1.6);
      g.fillStyle(P.ink, 1).fillEllipse(40, 15, 3, 3.6);
      g.fillStyle(P.cream, 1).fillCircle(40.6, 14.3, 0.7);
      g.fillStyle(P.gold, 0.9).fillRoundedRect(20, 15, 10, 3, 1.5);
    });

    // Shell knight (armored)
    this.tex('enemy_armored', 48, 44, (g) => {
      for (const lx of [12, 20, 28]) oval(g, lx, 36, 6, 6, P.ink, 0, 0, 0.2);
      ball(g, 38, 26, 8, P.water, OL, 0.25, 0.3);
      g.fillStyle(P.ink, 1).fillRoundedRect(38, 24, 7, 2.5, 1.2);
      g.fillStyle(P.ice, 1).fillCircle(42, 25.2, 0.9);
      poly(g, [36, 18, 38, 10, 41, 18], P.berry, 1.2);
      oval(g, 21, 26, 36, 26, P.stone, OL, 0.3, 0.35);
      g.lineStyle(1.5, P.ink, 0.45);
      g.beginPath();
      g.arc(21, 34, 13, Math.PI * 1.15, Math.PI * 1.85, false);
      g.strokePath();
      g.lineBetween(21, 13, 21, 22);
      g.lineBetween(12, 17, 14, 25);
      g.lineBetween(30, 17, 28, 25);
      g.lineStyle(2.2, P.gold, 1);
      g.strokeEllipse(21, 27, 34, 24);
      for (const [sx, sy] of [[14, 14], [21, 11], [28, 14]]) poly(g, [sx - 2.5, sy + 2, sx, sy - 4, sx + 2.5, sy + 2], P.cream, 1);
    });

    // Bat wisp (flying), 2 frames
    const bat = (g: G, up: boolean) => {
      const wing = (dir: number) => {
        const cx = 24;
        const pts = up
          ? [cx, 18, cx + dir * 8, 6, cx + dir * 18, 2, cx + dir * 23, 10, cx + dir * 19, 14, cx + dir * 16, 20, cx + dir * 11, 18, cx + dir * 6, 23]
          : [cx, 16, cx + dir * 9, 18, cx + dir * 19, 22, cx + dir * 23, 30, cx + dir * 17, 30, cx + dir * 13, 34, cx + dir * 9, 29, cx + dir * 4, 26];
        poly(g, pts, P.arcane, OL);
        g.fillStyle(P.ink, 0.28);
        g.fillPoints(
          [
            v(cx, pts[1]),
            v(pts[4], pts[5]),
            v(pts[8], pts[9]),
            v(pts[12], pts[13]),
          ],
          true,
          true,
        );
      };
      wing(-1);
      wing(1);
      poly(g, [18, 12, 19, 5, 23, 11], P.arcane, 1.5);
      poly(g, [30, 12, 29, 5, 25, 11], P.arcane, 1.5);
      ball(g, 24, 19, 9, P.arcane, OL, 0.22, 0.35);
      g.fillStyle(P.cream, 1).fillEllipse(21, 18, 4.5, 5).fillEllipse(27.5, 18, 4.5, 5);
      g.fillStyle(P.ink, 1).fillCircle(22, 18.5, 1.4).fillCircle(28.4, 18.5, 1.4);
      g.fillStyle(P.cream, 1).fillTriangle(22, 23, 23, 26, 24, 23).fillTriangle(25, 23, 26, 26, 27, 23);
    };
    this.tex('enemy_flying_0', 48, 38, (g) => bat(g, true));
    this.tex('enemy_flying_1', 48, 38, (g) => bat(g, false));

    // Ogre chief (boss)
    this.tex('enemy_boss', 84, 84, (g) => {
      poly(g, [22, 34, 60, 34, 66, 70, 16, 70], P.berry, OL);
      g.fillStyle(P.ink, 0.25).fillTriangle(40, 40, 66, 70, 40, 70);
      rrect(g, 28, 62, 10, 16, 4, P.stone, OL, 0.3, 0.1);
      rrect(g, 46, 62, 10, 16, 4, P.stone, OL, 0.3, 0.1);
      ball(g, 41, 48, 22, P.stone, OL + 0.5, 0.26, 0.3);
      g.fillStyle(P.cream, 0.35).fillEllipse(43, 54, 22, 16);
      g.fillStyle(P.wood, 1).fillRoundedRect(22, 58, 38, 7, 3);
      g.fillStyle(P.gold, 1).fillRoundedRect(38, 57.5, 8, 8, 2);
      ball(g, 20, 50, 7, P.stone, OL, 0.25, 0.2);
      // club
      poly(g, [62, 56, 66, 22, 76, 18, 78, 30, 70, 58], P.wood, OL);
      g.fillStyle(P.ink, 0.25).fillTriangle(70, 58, 78, 30, 72, 30);
      for (const [sx, sy] of [[66, 24], [74, 19], [77, 28]]) poly(g, [sx - 2, sy, sx, sy - 5, sx + 2, sy], P.cream, 1);
      ball(g, 64, 52, 7, P.stone, OL, 0.25, 0.2);
      ball(g, 43, 24, 14, P.stone, OL, 0.25, 0.3);
      g.fillStyle(P.ink, 1).fillEllipse(39, 22, 3.5, 4).fillEllipse(49, 22, 3.5, 4);
      g.fillStyle(P.berry, 1).fillCircle(39.5, 22.5, 1).fillCircle(49.5, 22.5, 1);
      g.lineStyle(2, P.ink, 0.8).lineBetween(36, 17, 42, 19).lineBetween(46, 19, 52, 17);
      poly(g, [38, 30, 40, 26, 41, 31], P.cream, 1);
      poly(g, [47, 31, 48, 26, 50, 30], P.cream, 1);
      poly(g, [31, 14, 33, 3, 38, 9, 43, 1, 48, 9, 53, 3, 55, 14], P.gold, OL);
      g.fillStyle(P.cream, 0.45).fillRect(33, 9, 20, 2);
      ball(g, 43, 9, 2.4, P.berry, 1, 0, 0.6);
    });
  }

  // --------------------------------------------------------------- towers --
  private drawBase(g: G, type: TowerType, lvl: number): void {
    // foundation: front side + top face
    g.fillStyle(P.ink, 1).fillRoundedRect(4, 11, 56, 50, 20);
    g.fillStyle(P.stone, 1).fillRoundedRect(6, 13, 52, 46, 18);
    g.fillStyle(P.ink, 0.32).fillRoundedRect(6, 13, 52, 46, 18);
    g.fillStyle(P.stone, 1).fillRoundedRect(6, 13, 52, 38, 18);
    g.fillStyle(P.cream, 0.22).fillRoundedRect(12, 15, 40, 5, 2.5);
    g.lineStyle(1.2, P.ink, 0.3);
    for (const bx of [16, 26, 38, 48]) g.lineBetween(bx, 51, bx, 57);
    g.lineBetween(9, 54, 55, 54);

    const top = { x: 32, y: 31, w: 40, h: 28 };
    if (type === 'archer') {
      oval(g, top.x, top.y, top.w, top.h, P.wood, 1.5, 0.18, 0.18);
      g.lineStyle(1.2, P.ink, 0.35);
      for (let i = -2; i <= 2; i++) g.lineBetween(top.x + i * 7, top.y - 12, top.x + i * 7, top.y + 12);
    } else if (type === 'cannon') {
      oval(g, top.x, top.y, top.w, top.h, P.stone, 1.5, 0.25, 0.1);
      g.fillStyle(P.ink, 0.38).fillEllipse(top.x, top.y, top.w - 2, top.h - 2);
      g.lineStyle(1.2, P.ink, 0.4);
      g.strokeEllipse(top.x, top.y, top.w - 12, top.h - 9);
    } else if (type === 'frost') {
      oval(g, top.x, top.y, top.w, top.h, P.water, 1.5, 0.2, 0.25);
      g.fillStyle(P.ice, 0.55).fillEllipse(top.x - 4, top.y - 3, 22, 10);
      for (const [sx, sy, sr] of [[12, 22, 5], [52, 24, 4.5], [18, 40, 4], [46, 41, 4.5]]) ball(g, sx, sy, sr, P.cream, 1.2, 0.1, 0);
    } else {
      oval(g, top.x, top.y, top.w, top.h, P.arcane, 1.5, 0.25, 0.2);
      g.lineStyle(1.2, P.gold, 0.85).strokeEllipse(top.x, top.y, top.w - 10, top.h - 8);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        g.fillStyle(P.gold, 1).fillCircle(top.x + Math.cos(a) * 15, top.y + Math.sin(a) * 10, 1.4);
      }
    }

    if (lvl >= 2) {
      if (type === 'archer') {
        for (const [px, py] of [[9, 26], [55, 26], [14, 41], [50, 41]]) rrect(g, px - 3, py - 8, 6, 12, 2, P.wood, 1.5, 0.25, 0.2);
        g.lineStyle(1.5, P.gold, 1).strokeEllipse(top.x, top.y, top.w + 2, top.h + 2);
      } else if (type === 'cannon') {
        for (const [px, py] of [[8, 27], [56, 27], [12, 42], [52, 42], [32, 46]]) rrect(g, px - 4, py - 4, 8, 8, 2, P.stone, 1.5, 0.3, 0.3);
      } else if (type === 'frost') {
        for (const [px, py, s] of [[9, 30, 1], [55, 30, 1], [32, 47, 0.9]]) {
          poly(g, [px, py - 12 * s, px + 4 * s, py, px, py + 3, px - 4 * s, py], P.ice, 1.5);
          g.fillStyle(P.cream, 0.7).fillTriangle(px, py - 11 * s, px - 3 * s, py, px, py);
        }
      } else {
        for (const [px, py] of [[10, 26], [54, 26], [16, 42], [48, 42]]) {
          rrect(g, px - 3, py - 9, 6, 13, 2, P.stone, 1.5, 0.3, 0.2);
          ball(g, px, py - 10, 2.6, P.arcane, 1, 0, 0.6);
        }
      }
    }

    if (lvl >= 3) {
      g.lineStyle(2.5, P.ink, 1).strokeEllipse(top.x, top.y, top.w + 6, top.h + 6);
      g.lineStyle(1.6, P.gold, 1).strokeEllipse(top.x, top.y, top.w + 6, top.h + 6);
      const flagColor = type === 'frost' ? P.ice : type === 'mage' ? P.arcane : P.berry;
      for (const side of [-1, 1]) {
        const px = 32 + side * 27;
        line(g, px, 6, px, 30, 1.6, P.wood, 1);
        poly(g, [px, 6, px + side * 11, 9.5, px, 13], flagColor, 1);
        ball(g, px, 5, 1.8, P.gold, 1, 0, 0.5);
      }
    }

    // level pips on the front face
    for (let i = 0; i < lvl; i++) {
      const px = 32 + (i - (lvl - 1) / 2) * 9;
      poly(g, [px, 51, px + 3.2, 54.5, px, 58, px - 3.2, 54.5], P.gold, 1);
    }
  }

  private drawTurret(g: G, type: TowerType, lvl: number): void {
    const cx = 28;
    const cy = 28;
    if (type === 'archer') {
      const r = 13 + lvl * 2;
      if (lvl >= 3) {
        arcStroke(g, cx - 3, cy, r - 5, -1.15, 1.15, 2.5, P.wood);
      }
      // arrow
      line(g, cx - 10, cy, cx + r + 4, cy, 2, P.wood, 1.2);
      poly(g, [cx + r + 10, cy, cx + r + 3, cy - 3.5, cx + r + 3, cy + 3.5], lvl >= 2 ? P.gold : P.stone, 1.2);
      poly(g, [cx - 12, cy - 4, cx - 6, cy - 1, cx - 6, cy + 1, cx - 12, cy + 4], P.berry, 1);
      // bow
      arcStroke(g, cx, cy, r, -1.2, 1.2, 3.5, P.wood);
      const ex = cx + Math.cos(1.2) * r;
      const ey = Math.sin(1.2) * r;
      g.lineStyle(1, P.cream, 1).lineBetween(ex, cy - ey, cx - 6, cy).lineBetween(cx - 6, cy, ex, cy + ey);
      if (lvl >= 2) {
        ball(g, ex, cy - ey, 2.4, P.gold, 1, 0, 0.5);
        ball(g, ex, cy + ey, 2.4, P.gold, 1, 0, 0.5);
      }
      // hooded archer
      ball(g, cx - 8, cy, 8 + lvl * 0.5, P.pine, OL, 0.25, 0.25);
      g.fillStyle(P.leaf, 0.5).fillEllipse(cx - 10, cy - 3, 7, 4);
      if (lvl >= 3) {
        rrect(g, cx - 19, cy - 9, 6, 18, 2, P.wood, 1.2, 0.2, 0.2);
        for (const oy of [-5, 0, 5]) g.fillStyle(P.berry, 1).fillRect(cx - 21, cy + oy - 1, 4, 2);
      }
    } else if (type === 'cannon') {
      rrect(g, cx - 16, cy - 13, 22, 26, 6, P.wood, OL, 0.25, 0.2);
      const barrel = (oy: number, h: number, len: number) => {
        rrect(g, cx - 6, cy + oy - h / 2, len, h, h * 0.35, P.stone, OL, 0, 0);
        g.fillStyle(P.ink, 0.55).fillRoundedRect(cx - 6, cy + oy - h / 2, len, h, h * 0.35);
        g.fillStyle(P.cream, 0.28).fillRoundedRect(cx - 4, cy + oy - h / 2 + 2, len - 6, h * 0.22, 1);
        rrect(g, cx - 6 + len - 5, cy + oy - h / 2 - 2, 7, h + 4, 2.5, P.stone, 1.5, 0.45, 0.2);
        g.fillStyle(P.ink, 1).fillEllipse(cx - 6 + len + 1.5, cy + oy, 2.5, h * 0.55);
        if (lvl >= 2) g.fillStyle(P.gold, 1).fillRect(cx - 6 + len * 0.45, cy + oy - h / 2, 3, h);
      };
      if (lvl >= 3) {
        barrel(-6, 10, 30);
        barrel(6, 10, 30);
      } else {
        barrel(0, 12 + lvl, 24 + lvl * 4);
      }
      ball(g, cx - 10, cy, 8, P.stone, OL, 0.5, 0.25);
      g.fillStyle(P.ink, 0.35).fillCircle(cx - 10, cy, 8);
      g.fillStyle(lvl >= 2 ? P.gold : P.stone, 1).fillCircle(cx - 10, cy, 3);
    } else if (type === 'frost') {
      const s = 1 + (lvl - 1) * 0.15;
      if (lvl >= 2) {
        diamond(g, cx - 4, cy - 10 * s, 12 * s, 4, 4 * s, P.ice, 1.5);
        diamond(g, cx - 4, cy + 10 * s, 12 * s, 4, 4 * s, P.ice, 1.5);
      }
      if (lvl >= 3) {
        diamond(g, cx - 12, cy - 15, 7, 3, 3, P.ice, 1.2);
        diamond(g, cx - 12, cy + 15, 7, 3, 3, P.ice, 1.2);
      }
      ball(g, cx - 6, cy, 9 * s, P.water, OL, 0.25, 0.3);
      diamond(g, cx - 2, cy, 20 * s, 8, 7 * s, P.ice, OL);
      g.fillStyle(P.cream, 0.9).fillCircle(cx + 2, cy - 1, 1.6 * s);
    } else {
      const s = 1 + (lvl - 1) * 0.15;
      // staff prongs (gold claw pointing right)
      for (const side of [-1, 1]) {
        poly(g, [cx - 8, cy + side * 4, cx + 2, cy + side * 13 * s, cx + 16 * s, cy + side * 7 * s, cx + 4, cy + side * 7], P.gold, 1.5);
      }
      g.lineStyle(2.5, P.ink, 1).strokeCircle(cx - 4, cy, 10 * s);
      g.lineStyle(1.5, P.gold, 1).strokeCircle(cx - 4, cy, 10 * s);
      ball(g, cx + 2, cy, (6.5 + lvl) * 1, P.arcane, OL, 0.25, 0.35);
      g.fillStyle(P.cream, 0.85).fillCircle(cx + 2, cy, 2 + lvl * 0.5);
      if (lvl >= 2) {
        for (const a of [Math.PI * 0.75, Math.PI * 1.25]) ball(g, cx - 4 + Math.cos(a) * 14 * s, cy + Math.sin(a) * 14 * s, 2.6, P.berry, 1, 0, 0.5);
      }
      if (lvl >= 3) {
        g.lineStyle(1.2, P.cream, 0.7).strokeCircle(cx + 2, cy, 13);
        ball(g, cx - 18, cy, 3, P.gold, 1, 0, 0.5);
      }
    }
  }

  // ---------------------------------------------------------- projectiles --
  private projectiles(): void {
    this.tex('proj_arrow', 26, 10, (g) => {
      line(g, 3, 5, 20, 5, 1.8, P.wood, 1);
      poly(g, [26, 5, 19, 1.5, 19, 8.5], P.stone, 1);
      poly(g, [1, 1.5, 7, 4, 7, 6, 1, 8.5], P.berry, 1);
    });
    this.tex('proj_cannonball', 18, 18, (g) => {
      ball(g, 9, 9, 6.5, P.stone, 1.5, 0.6, 0.4);
      g.fillStyle(P.ink, 0.35).fillCircle(9, 9, 6.5);
      g.fillStyle(P.cream, 0.5).fillCircle(7, 7, 1.6);
    });
    this.tex('proj_frostbolt', 24, 16, (g) => {
      softCircle(g, 12, 8, 8, P.ice, 0.55);
      diamond(g, 12, 8, 10, 6, 4.5, P.ice, 1.2);
    });
  }

  // ------------------------------------------------------------ particles --
  private particles(): void {
    this.tex('p_soft', 16, 16, (g) => softCircle(g, 8, 8, 8, P.cream, 1));
    this.tex('p_spark', 18, 6, (g) => {
      g.fillStyle(P.cream, 0.4).fillEllipse(9, 3, 18, 6);
      g.fillStyle(P.cream, 1).fillEllipse(10, 3, 11, 2.4);
    });
    this.tex('p_smoke', 32, 32, (g) => {
      for (const [x, y, r] of [[16, 16, 11], [11, 18, 8], [21, 18, 8], [16, 12, 8]]) softCircle(g, x, y, r, P.cream, 0.55, 5);
    });
    this.tex('p_chunk', 10, 10, (g) => rrect(g, 2, 2, 6, 6, 2, P.stone, 1, 0.3, 0.3));
    this.tex('p_chunk_wood', 12, 8, (g) => rrect(g, 2, 2, 8, 4, 1.5, P.wood, 1, 0.3, 0.2));
    this.tex('p_ice', 12, 12, (g) => {
      g.lineStyle(1.6, P.cream, 1);
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI;
        g.lineBetween(6 - Math.cos(a) * 5, 6 - Math.sin(a) * 5, 6 + Math.cos(a) * 5, 6 + Math.sin(a) * 5);
      }
      g.fillStyle(P.cream, 1).fillCircle(6, 6, 1.6);
    });
    this.tex('p_star', 16, 16, (g) => {
      softCircle(g, 8, 8, 6, P.cream, 0.6, 4);
      g.fillStyle(P.cream, 1);
      g.fillPoints([v(8, 0), v(9.4, 6.6), v(16, 8), v(9.4, 9.4), v(8, 16), v(6.6, 9.4), v(0, 8), v(6.6, 6.6)], true, true);
    });
    this.tex('p_ring', 64, 64, (g) => {
      g.lineStyle(5, P.cream, 0.35).strokeCircle(32, 32, 28);
      g.lineStyle(2.5, P.cream, 1).strokeCircle(32, 32, 28);
    });
    this.tex('p_leaf', 10, 7, (g) => poly(g, [1, 3.5, 5, 0.5, 9, 3.5, 5, 6.5], P.leaf, 0));
    this.tex('p_bar', 4, 4, (g) => g.fillStyle(P.cream, 1).fillRect(0, 0, 4, 4));
    this.tex('p_coin', 10, 10, (g) => ball(g, 5, 5, 3.5, P.gold, 1, 0.2, 0.5));
  }

  // ---------------------------------------------------------------- icons --
  private icons(): void {
    this.tex('icon_gold', 24, 24, (g) => {
      ball(g, 12, 12, 9, P.gold, OL, 0.25, 0.35);
      g.lineStyle(1.4, P.wood, 0.8).strokeCircle(12, 12, 5.5);
      g.fillStyle(P.wood, 0.8).fillRect(11, 8.5, 2, 7);
    });
    this.tex('icon_heart', 24, 24, (g) => {
      g.fillStyle(P.ink, 1).fillCircle(8, 9, 6.5).fillCircle(16, 9, 6.5).fillTriangle(2.2, 11, 21.8, 11, 12, 22);
      g.fillStyle(P.berry, 1).fillCircle(8, 9, 4.6).fillCircle(16, 9, 4.6).fillTriangle(4, 10.5, 20, 10.5, 12, 19.5);
      g.fillStyle(P.cream, 0.6).fillEllipse(7, 7.5, 4, 2.6);
    });
    this.tex('icon_wave', 24, 24, (g) => {
      line(g, 6, 3, 6, 22, 2, P.wood, 1.2);
      poly(g, [7, 4, 21, 6, 16, 10, 21, 14, 7, 14], P.berry, 1.4);
      g.fillStyle(P.cream, 0.4).fillRect(8, 6, 8, 2);
    });
    this.tex('icon_play', 24, 24, (g) => poly(g, [7, 4, 20, 12, 7, 20], P.cream, 0));
    this.tex('icon_pause', 24, 24, (g) => {
      g.fillStyle(P.cream, 1).fillRoundedRect(5, 4, 5, 16, 1.5).fillRoundedRect(14, 4, 5, 16, 1.5);
    });
    this.tex('icon_speed', 24, 24, (g) => {
      poly(g, [2, 5, 12, 12, 2, 19], P.cream, 0);
      poly(g, [12, 5, 22, 12, 12, 19], P.cream, 0);
    });
    const speaker = (g: G) => {
      g.fillStyle(P.cream, 1).fillRect(3, 9, 5, 6);
      g.fillTriangle(6, 12, 13, 4, 13, 20);
      g.fillRect(8, 8, 5, 8);
    };
    this.tex('icon_sound', 24, 24, (g) => {
      speaker(g);
      g.lineStyle(2, P.cream, 1);
      g.beginPath();
      g.arc(13, 12, 5, -0.9, 0.9, false);
      g.strokePath();
      g.beginPath();
      g.arc(13, 12, 9, -0.9, 0.9, false);
      g.strokePath();
    });
    this.tex('icon_mute', 24, 24, (g) => {
      speaker(g);
      g.lineStyle(2.2, P.berry, 1).lineBetween(15, 8, 22, 16).lineBetween(22, 8, 15, 16);
    });
    this.tex('icon_upgrade', 24, 24, (g) => poly(g, [12, 2, 21, 12, 15, 12, 15, 21, 9, 21, 9, 12, 3, 12], P.gold, 1.5));
    this.tex('icon_sell', 24, 24, (g) => {
      ball(g, 10, 10, 7, P.gold, 1.5, 0.25, 0.35);
      poly(g, [17, 11, 23, 11, 23, 17, 20, 17, 20, 22, 17, 22, 17, 17, 14, 17], P.berry, 1.2);
    });
    this.tex('icon_target', 24, 24, (g) => {
      g.lineStyle(2, P.cream, 1).strokeCircle(12, 12, 7);
      g.lineBetween(12, 1, 12, 7).lineBetween(12, 17, 12, 23).lineBetween(1, 12, 7, 12).lineBetween(17, 12, 23, 12);
      g.fillStyle(P.berry, 1).fillCircle(12, 12, 2);
    });
    this.tex('icon_next', 24, 24, (g) => {
      poly(g, [3, 5, 11, 12, 3, 19], P.gold, 1.2);
      poly(g, [12, 5, 20, 12, 12, 19], P.gold, 1.2);
    });
    this.tex('icon_crown', 24, 24, (g) => {
      poly(g, [3, 18, 4, 7, 9, 12, 12, 4, 15, 12, 20, 7, 21, 18], P.gold, 1.5);
      ball(g, 12, 14, 2, P.berry, 1, 0, 0.5);
    });
    this.tex('icon_wing', 24, 24, (g) => {
      poly(g, [3, 16, 9, 5, 21, 3, 18, 9, 21, 11, 16, 15, 18, 18, 10, 19], P.ice, 1.4);
    });
    this.tex('icon_fullscreen', 24, 24, (g) => {
      g.lineStyle(2.6, P.cream, 1);
      for (const [cx, cy, sx, sy] of [[4, 4, 1, 1], [20, 4, -1, 1], [4, 20, 1, -1], [20, 20, -1, -1]]) {
        g.beginPath();
        g.moveTo(cx, cy + sy * 6);
        g.lineTo(cx, cy);
        g.lineTo(cx + sx * 6, cy);
        g.strokePath();
      }
    });
    this.tex('icon_close', 24, 24, (g) => {
      g.lineStyle(3, P.cream, 1).lineBetween(6, 6, 18, 18).lineBetween(18, 6, 6, 18);
    });

    // Ribbon banner behind wave announcements (centre stretches, so keep it symmetrical).
    this.tex('ui_ribbon', 420, 64, (g) => {
      const tail = (dir: number) => {
        const x0 = dir < 0 ? 40 : 380;
        poly(g, [x0, 18, x0 + dir * 36, 18, x0 + dir * 24, 34, x0 + dir * 36, 50, x0, 50], P.berry, OL);
        g.fillStyle(P.ink, 0.35).fillTriangle(x0, 50, x0, 56, x0 - dir * 12, 50);
      };
      tail(-1);
      tail(1);
      rrect(g, 28, 8, 364, 44, 8, P.berry, OL, 0.25, 0.18);
      g.lineStyle(1.5, P.gold, 0.9).strokeRoundedRect(34, 13, 352, 34, 6);
      for (const x of [44, 376]) ball(g, x, 30, 3, P.gold, 1, 0, 0.6);
    });

    // Heraldic crest for the title screen.
    this.tex('crest', 150, 170, (g) => {
      poly(g, [75, 6, 140, 26, 136, 96, 75, 164, 14, 96, 10, 26], P.ink, 3);
      poly(g, [75, 14, 131, 31, 128, 93, 75, 152, 22, 93, 19, 31], P.pine, 0);
      g.fillStyle(P.grass, 0.6).fillTriangle(75, 14, 19, 31, 75, 152);
      g.lineStyle(3, P.gold, 1);
      g.strokePoints([v(75, 14), v(131, 31), v(128, 93), v(75, 152), v(22, 93), v(19, 31)], true, true);
      // tree emblem
      rrect(g, 69, 84, 12, 40, 4, P.wood, OL, 0.25, 0.1);
      ball(g, 75, 70, 26, P.leaf, OL, 0.25, 0.35);
      ball(g, 56, 82, 14, P.leaf, OL, 0.25, 0.2);
      ball(g, 94, 82, 14, P.leaf, OL, 0.25, 0.2);
      for (const [bx, by] of [[66, 64], [86, 74], [74, 52], [58, 84]]) ball(g, bx, by, 3, P.gold, 1, 0, 0.6);
      poly(g, [52, 30, 56, 14, 66, 24, 75, 8, 84, 24, 94, 14, 98, 30], P.gold, OL);
      ball(g, 75, 22, 3, P.berry, 1, 0, 0.6);
    });

    // Large soft cloud shadow drifting over the map.
    this.tex('cloud', 220, 120, (g) => {
      for (const [x, y, r] of [[70, 64, 46], [118, 52, 54], [160, 70, 40], [110, 82, 44]]) softCircle(g, x, y, r, P.ink, 0.5, 8);
    });
  }

  // -------------------------------------------------------------- terrain --
  /**
   * Bakes the full 1280x720 ground (grass variants, water, winding stone path,
   * small decoration) into a single 'terrain' texture.
   */
  bakeTerrain(path: PathSystem, seed: number): void {
    if (this.scene.textures.exists('terrain')) this.scene.textures.remove('terrain');
    const rng = new Rng(seed);
    const g = this.g;
    g.clear();
    g.scaleCanvas(TEX_RES, TEX_RES);

    g.fillStyle(P.grass, 1).fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    const colsAll = Math.ceil(GAME_WIDTH / TILE) + 1;
    const rowsAll = Math.ceil(GAME_HEIGHT / TILE) + 1;
    // organic tonal variation
    for (let r = -1; r < rowsAll; r++) {
      for (let c = -1; c < colsAll; c++) {
        const x = MAP_X + c * TILE;
        const y = MAP_Y + r * TILE;
        for (let i = 0; i < 3; i++) {
          const dark = rng.chance(0.45);
          g.fillStyle(dark ? P.pine : P.leaf, dark ? 0.1 : 0.14);
          g.fillEllipse(x + rng.range(0, TILE), y + rng.range(0, TILE), rng.range(24, 54), rng.range(16, 34));
        }
      }
    }

    // subtle build-tile insets
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        if (path.tileAt(c, r) !== TileKind.Grass) continue;
        const x = MAP_X + c * TILE;
        const y = MAP_Y + r * TILE;
        g.fillStyle(P.pine, 0.07).fillRoundedRect(x + 3, y + 3, TILE - 6, TILE - 6, 10);
        g.fillStyle(P.leaf, 0.07).fillRoundedRect(x + 5, y + 4, TILE - 10, 6, 3);
      }
    }

    // water
    const isWater = (c: number, r: number) => path.inGrid(c, r) && path.tileAt(c, r) === TileKind.Water;
    const isWaterOrEdge = (c: number, r: number) => isWater(c, r) || (r >= GRID_ROWS && isWater(c, GRID_ROWS - 1));
    // Each water tile grows (or shrinks) only on the sides that face land, and only
    // corners between two land sides are rounded, so neighbouring tiles join seamlessly.
    const waterPass = (expand: number, color: number, alpha: number, rad: number) => {
      g.fillStyle(color, alpha);
      for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
          if (!isWater(c, r)) continue;
          const wl = isWater(c - 1, r) || c === 0;
          const wr = isWater(c + 1, r);
          const wt = isWater(c, r - 1);
          const wb = isWaterOrEdge(c, r + 1);
          const x0 = MAP_X + c * TILE - (wl ? 0 : expand);
          const y0 = MAP_Y + r * TILE - (wt ? 0 : expand);
          const x1 = MAP_X + (c + 1) * TILE + (wr ? 0 : expand);
          const y1 = MAP_Y + (r + 1) * TILE + (wb ? 0 : expand);
          g.fillRoundedRect(x0, y0, x1 - x0, y1 - y0, {
            tl: !wl && !wt ? rad : 0,
            tr: !wr && !wt ? rad : 0,
            bl: !wl && !wb ? rad : 0,
            br: !wr && !wb ? rad : 0,
          });
        }
      }
    };
    // opaque passes (pre-mixed palette shades) so overlapping tiles never show seams
    waterPass(7, P.stone, 1, 18);
    waterPass(5, mix(P.stone, P.ink, 0.3), 1, 16);
    waterPass(3, P.water, 1, 14);
    waterPass(-6, mix(P.water, P.ink, 0.12), 1, 12);
    waterPass(-14, mix(P.water, P.ink, 0.2), 1, 10);
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        if (!isWater(c, r)) continue;
        const x = MAP_X + c * TILE;
        const y = MAP_Y + r * TILE;
        g.fillStyle(P.ice, 0.35).fillEllipse(x + rng.range(14, 42), y + rng.range(12, 44), rng.range(10, 20), 2.5);
        if (!isWater(c, r - 1)) g.fillStyle(P.ice, 0.4).fillRoundedRect(x + 2, y - 1, TILE - 4, 3, 1.5);
      }
    }

    // stone path along the polyline
    const pts = path.points;
    const band = (hw: number, color: number, alpha: number, oy = 0) => {
      g.fillStyle(color, alpha);
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i];
        const b = pts[i + 1];
        const x0 = Math.min(a.x, b.x) - hw;
        const y0 = Math.min(a.y, b.y) - hw + oy;
        g.fillRect(x0, y0, Math.abs(b.x - a.x) + hw * 2, Math.abs(b.y - a.y) + hw * 2);
      }
    };
    band(28, P.ink, 0.16, 4);
    band(26, P.wood, 1);
    band(26, P.ink, 0.3);
    band(22, P.stone, 1);
    // cobbles
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      const dx = (b.x - a.x) / len;
      const dy = (b.y - a.y) / len;
      for (let d = 0; d < len; d += 8) {
        for (let k = 0; k < 3; k++) {
          const off = rng.range(-17, 17);
          const along = d + rng.range(-3, 3);
          const x = a.x + dx * along - dy * off;
          const y = a.y + dy * along + dx * off;
          const w = rng.range(6, 10);
          const h = rng.range(4.5, 7);
          g.fillStyle(P.ink, 0.16).fillEllipse(x + 0.6, y + 1, w + 1.5, h + 1.5);
          g.fillStyle(P.stone, 1).fillEllipse(x, y, w, h);
          g.fillStyle(P.cream, rng.range(0.12, 0.3)).fillEllipse(x - 0.8, y - 1, w * 0.6, h * 0.4);
        }
      }
    }
    // worn center line + edge highlight
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      g.lineStyle(10, P.wood, 0.07).lineBetween(a.x, a.y, b.x, b.y);
    }

    // grass tufts, tiny flowers
    for (let r = -1; r < rowsAll; r++) {
      for (let c = -1; c < colsAll; c++) {
        const inG = path.inGrid(c, r);
        const kind = inG ? path.tileAt(c, r) : TileKind.Grass;
        if (kind === TileKind.Path || kind === TileKind.Water) continue;
        const x = MAP_X + c * TILE;
        const y = MAP_Y + r * TILE;
        const tufts = rng.int(1, 3);
        for (let i = 0; i < tufts; i++) {
          const tx = x + rng.range(6, TILE - 6);
          const ty = y + rng.range(8, TILE - 4);
          g.lineStyle(1.6, P.pine, 0.55);
          g.lineBetween(tx, ty, tx - 3, ty - 6);
          g.lineBetween(tx, ty, tx, ty - 8);
          g.lineBetween(tx, ty, tx + 3, ty - 6);
          g.lineStyle(1.2, P.leaf, 0.6).lineBetween(tx + 0.6, ty - 1, tx + 0.6, ty - 6);
        }
        if (rng.chance(0.22)) {
          const fx = x + rng.range(8, TILE - 8);
          const fy = y + rng.range(8, TILE - 8);
          const col = rng.pick([P.cream, P.gold, P.berry, P.arcane]);
          for (let i = 0; i < 4; i++) {
            const a = (i / 4) * Math.PI * 2 + 0.4;
            g.fillStyle(col, 0.95).fillCircle(fx + Math.cos(a) * 1.8, fy + Math.sin(a) * 1.8, 1.5);
          }
          g.fillStyle(P.gold, 1).fillCircle(fx, fy, 1);
        }
        if (rng.chance(0.08)) {
          const px = x + rng.range(10, TILE - 10);
          const py = y + rng.range(10, TILE - 10);
          g.fillStyle(P.ink, 0.15).fillEllipse(px + 1, py + 1.5, 8, 4);
          g.fillStyle(P.stone, 1).fillEllipse(px, py, 7, 4.5);
          g.fillStyle(P.cream, 0.3).fillEllipse(px - 1, py - 1, 3.5, 1.6);
        }
      }
    }

    g.generateTexture('terrain', GAME_WIDTH * TEX_RES, GAME_HEIGHT * TEX_RES);
    (this.scene.textures.get('terrain').customData as ArtData).artScale = 1 / TEX_RES;
    g.clear();
  }
}

import type { TowerType } from '../config/balance';
import { PALETTE as P } from '../config/palette';
import {
  ball,
  blobPath,
  dark,
  dropShadow,
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
  type Ctx,
} from './paint';

// ------------------------------------------------------------ tower bases --
/** Tower base canvas 80 x 92; the hero stands on the deck centre (40, 34). */
export const BASE_W = 80;
export const BASE_H = 92;
export const BASE_DECK_Y = 34;

const TOP_RX = 30;
const TOP_RY = 13;
const BODY_TOP = 34;
const BODY_BOT = 76;

function cylinder(ctx: Ctx, base: number, edge: number): void {
  ctx.beginPath();
  ctx.moveTo(40 - TOP_RX, BODY_TOP);
  ctx.lineTo(40 - TOP_RX + 2, BODY_BOT);
  ctx.ellipse(40, BODY_BOT, TOP_RX - 2, TOP_RY, 0, Math.PI, 0, true);
  ctx.lineTo(40 + TOP_RX, BODY_TOP);
  ctx.closePath();
  const g = ctx.createLinearGradient(10, 0, 70, 0);
  g.addColorStop(0, rgba(dark(base, 0.5)));
  g.addColorStop(0.3, rgba(light(base, 0.25)));
  g.addColorStop(0.55, rgba(base));
  g.addColorStop(1, rgba(dark(edge, 0.55)));
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = 2.4;
  ctx.strokeStyle = rgba(P.ink);
  ctx.stroke();
}

function deck(ctx: Ctx, top: number, rim: number): void {
  ellipsePath(ctx, 40, BODY_TOP, TOP_RX + 2, TOP_RY + 1.5);
  vshade(ctx, light(rim, 0.15), dark(rim, 0.3), BODY_TOP - TOP_RY, BODY_TOP + TOP_RY, 2.4);
  ellipsePath(ctx, 40, BODY_TOP - 1, TOP_RX - 3, TOP_RY - 2.5);
  const g = ctx.createRadialGradient(34, BODY_TOP - 6, 2, 40, BODY_TOP, TOP_RX);
  g.addColorStop(0, rgba(light(top, 0.35)));
  g.addColorStop(1, rgba(dark(top, 0.2)));
  ctx.fillStyle = g;
  ctx.fill();
}

function clipBody(ctx: Ctx, draw: () => void): void {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(40 - TOP_RX, BODY_TOP);
  ctx.lineTo(40 - TOP_RX + 2, BODY_BOT);
  ctx.ellipse(40, BODY_BOT, TOP_RX - 2, TOP_RY, 0, Math.PI, 0, true);
  ctx.lineTo(40 + TOP_RX, BODY_TOP);
  ctx.closePath();
  ctx.clip();
  draw();
  ctx.restore();
}

function banner(ctx: Ctx, x: number, color: number, tall: boolean): void {
  const top = tall ? 0 : 8;
  line(ctx, x, top, x, BODY_TOP + 4, 2.2, P.wood, 1.4);
  ball(ctx, x, top, 2.6, P.gold, 1.2);
  const dir = x < 40 ? -1 : 1;
  polyPath(ctx, [x, top + 3, x + dir * 15, top + 6, x + dir * 11, top + 11, x + dir * 15, top + 16, x, top + 18]);
  vshade(ctx, light(color, 0.2), dark(color, 0.3), top + 3, top + 18, 1.6);
}

export function drawTowerBase(ctx: Ctx, type: TowerType, lvl: number): void {
  dropShadow(ctx, 40, 80, 36, 12, 0.45);
  if (type === 'archer') {
    const wood = lvl >= 3 ? mix(P.wood, P.gold, 0.15) : P.wood;
    cylinder(ctx, wood, P.wood);
    clipBody(ctx, () => {
      ctx.strokeStyle = rgba(dark(P.wood, 0.5), 0.55);
      ctx.lineWidth = 1.4;
      for (let i = 0; i < 7; i++) {
        const x = 14 + i * 9;
        ctx.beginPath();
        ctx.moveTo(x, BODY_TOP);
        ctx.lineTo(x, BODY_BOT + 14);
        ctx.stroke();
      }
      // cross brace
      line(ctx, 14, 50, 66, 66, 3, light(P.wood, 0.1), 1.2);
      // ivy
      for (const [vx, vy] of [[16, 44], [20, 54], [15, 64], [62, 48], [66, 58]]) {
        ctx.save();
        ctx.translate(vx, vy);
        ctx.rotate(vx > 40 ? 0.5 : -0.5);
        ellipsePath(ctx, 0, 0, 4, 2.3);
        shade(ctx, P.leaf, 0, 0, 4, 1.2);
        ctx.restore();
      }
    });
    deck(ctx, light(P.wood, 0.2), lvl >= 2 ? P.gold : dark(P.wood, 0.1));
    ctx.strokeStyle = rgba(dark(P.wood, 0.4), 0.5);
    ctx.lineWidth = 1;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(40 + i * 9, BODY_TOP - 9);
      ctx.lineTo(40 + i * 9, BODY_TOP + 9);
      ctx.stroke();
    }
  } else if (type === 'cannon') {
    const stone = mix(P.stone, P.ink, 0.12);
    cylinder(ctx, stone, P.stone);
    clipBody(ctx, () => {
      ctx.strokeStyle = rgba(P.ink, 0.35);
      ctx.lineWidth = 1.2;
      for (let row = 0; row < 5; row++) {
        const y = BODY_TOP + 6 + row * 9;
        ctx.beginPath();
        ctx.moveTo(8, y);
        ctx.lineTo(72, y);
        ctx.stroke();
        for (let i = 0; i < 5; i++) {
          const x = 14 + i * 13 + (row % 2) * 6;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x, y + 9);
          ctx.stroke();
        }
      }
      // arrow slit
      roundRectPath(ctx, 37, 50, 6, 14, 3);
      ctx.fillStyle = rgba(P.ink, 0.85);
      ctx.fill();
    });
    deck(ctx, mix(P.stone, P.ink, 0.25), lvl >= 2 ? P.gold : P.stone);
    // crenellations along the front rim
    for (let i = 0; i < 5; i++) {
      const a = Math.PI * (0.12 + i * 0.19);
      const x = 40 + Math.cos(a) * (TOP_RX - 1);
      const y = BODY_TOP + Math.sin(a) * (TOP_RY - 1);
      roundRectPath(ctx, x - 5, y - 8, 10, 10, 2);
      vshade(ctx, light(P.stone, 0.15), dark(P.stone, 0.35), y - 8, y + 2, 1.8);
    }
  } else if (type === 'frost') {
    cylinder(ctx, mix(P.ice, P.water, 0.35), P.water);
    clipBody(ctx, () => {
      // crystal facets
      ctx.fillStyle = rgba(P.cream, 0.35);
      for (const [x0, x1] of [[16, 26], [34, 42], [52, 60]]) {
        polyPath(ctx, [x0, BODY_TOP, x1, BODY_TOP, (x0 + x1) / 2 + 4, BODY_BOT + 10]);
        ctx.fill();
      }
      glow(ctx, 40, 60, 26, P.cream, 0.35);
    });
    deck(ctx, P.cream, lvl >= 2 ? P.gold : P.ice);
    // icicles + snow caps
    for (let i = 0; i < 6; i++) {
      const x = 14 + i * 10.5;
      polyPath(ctx, [x - 3, BODY_TOP + 9, x, BODY_TOP + 19 + (i % 2) * 5, x + 3, BODY_TOP + 9]);
      fillOutline(ctx, light(P.ice, 0.3), 1.2);
    }
    for (const [sx, sy] of [[12, 32], [68, 32], [30, 42], [52, 43]]) {
      polyPath(ctx, [sx, sy, sx + 3, sy - 12, sx + 6, sy]);
      vshade(ctx, P.cream, P.ice, sy - 12, sy, 1.4);
    }
  } else {
    const stone = mix(P.arcane, P.ink, 0.45);
    cylinder(ctx, stone, P.arcane);
    clipBody(ctx, () => {
      // glowing runes
      for (const [rx, ry] of [[22, 52], [40, 58], [58, 52], [31, 68], [49, 68]]) {
        glow(ctx, rx, ry, 7, lvl >= 3 ? P.gold : P.arcane, 0.9);
        star(ctx, rx, ry, 3, 1.2, 4);
        ctx.fillStyle = rgba(P.cream, 0.9);
        ctx.fill();
      }
    });
    deck(ctx, mix(P.arcane, P.ink, 0.3), lvl >= 2 ? P.gold : P.arcane);
    // magic circle on the deck
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(40, BODY_TOP - 1, 20, 8, 0, 0, Math.PI * 2);
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = rgba(P.gold, 0.9);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(40, BODY_TOP - 1, 13, 5, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  if (lvl >= 2) {
    // gold band below the rim
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(40, BODY_TOP + 7, TOP_RX - 0.5, TOP_RY, 0, 0.05, Math.PI - 0.05);
    ctx.lineWidth = 4.5;
    ctx.strokeStyle = rgba(P.ink);
    ctx.stroke();
    ctx.lineWidth = 2.6;
    ctx.strokeStyle = rgba(P.gold);
    ctx.stroke();
    ctx.restore();
    const flag = type === 'frost' ? P.water : type === 'mage' ? P.arcane : type === 'cannon' ? P.berry : P.pine;
    banner(ctx, 9, flag, lvl >= 3);
    banner(ctx, 71, flag, lvl >= 3);
  }
  if (lvl >= 3) {
    // gem set into the front
    glow(ctx, 40, BODY_TOP + 20, 12, type === 'frost' ? P.ice : type === 'mage' ? P.arcane : P.gold, 0.8);
    star(ctx, 40, BODY_TOP + 20, 6, 3, 4);
    vshade(ctx, P.cream, type === 'frost' ? P.ice : type === 'mage' ? P.arcane : P.berry, BODY_TOP + 14, BODY_TOP + 26, 1.6);
  }
  // level pips
  for (let i = 0; i < lvl; i++) {
    const px = 40 + (i - (lvl - 1) / 2) * 11;
    star(ctx, px, BODY_BOT + 6, 4.2, 2, 4);
    vshade(ctx, light(P.gold, 0.3), dark(P.gold, 0.25), BODY_BOT + 2, BODY_BOT + 10, 1.2);
  }
}

// ------------------------------------------------------------------ props --
export function drawShadow(ctx: Ctx): void {
  dropShadow(ctx, 32, 12, 31, 11, 0.55);
}

export function drawOak(ctx: Ctx): void {
  // 80 x 100, trunk base at (40, 94)
  dropShadow(ctx, 40, 94, 30, 8, 0.35);
  blobPath(ctx, [33, 94, 35, 60, 45, 60, 48, 94, 40, 97]);
  vshade(ctx, light(P.wood, 0.1), dark(P.wood, 0.4), 60, 97, 2.2);
  const clump = (x: number, y: number, r: number, c: number) => {
    ellipsePath(ctx, x, y, r, r * 0.92);
    shade(ctx, c, x, y, r, 2.4, 0.4, 0.45);
  };
  clump(22, 56, 17, P.pine);
  clump(58, 56, 17, P.pine);
  clump(40, 44, 24, P.grass);
  clump(26, 36, 15, P.grass);
  clump(54, 34, 16, P.grass);
  clump(40, 24, 15, mix(P.grass, P.leaf, 0.35));
  for (const [hx, hy, hr] of [[34, 20, 6], [22, 32, 5], [50, 28, 5]]) {
    ellipsePath(ctx, hx, hy, hr, hr * 0.6);
    ctx.fillStyle = rgba(P.leaf, 0.7);
    ctx.fill();
  }
  for (const [fx, fy] of [[28, 46], [52, 50], [44, 34], [20, 58], [60, 40]]) ball(ctx, fx, fy, 2.8, P.berry, 1.2);
}

export function drawPine(ctx: Ctx): void {
  // 64 x 104, trunk base at (32, 98)
  dropShadow(ctx, 32, 98, 24, 7, 0.35);
  roundRectPath(ctx, 27, 80, 10, 18, 3);
  vshade(ctx, P.wood, dark(P.wood, 0.4), 80, 98, 2);
  const tier = (cy: number, hw: number, h: number) => {
    ctx.beginPath();
    ctx.moveTo(32, cy - h);
    ctx.quadraticCurveTo(32 + hw * 0.5, cy - h * 0.4, 32 + hw, cy);
    ctx.quadraticCurveTo(32, cy + 7, 32 - hw, cy);
    ctx.quadraticCurveTo(32 - hw * 0.5, cy - h * 0.4, 32, cy - h);
    ctx.closePath();
    const g = ctx.createLinearGradient(32 - hw, 0, 32 + hw, 0);
    g.addColorStop(0, rgba(mix(P.grass, P.leaf, 0.2)));
    g.addColorStop(0.5, rgba(P.pine));
    g.addColorStop(1, rgba(dark(P.pine, 0.35)));
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = rgba(P.ink);
    ctx.stroke();
  };
  tier(84, 28, 30);
  tier(62, 23, 28);
  tier(40, 17, 26);
  star(ctx, 32, 12, 3.2, 1.3, 4);
  ctx.fillStyle = rgba(P.cream, 0.9);
  ctx.fill();
}

export function drawSakura(ctx: Ctx): void {
  // 84 x 100 cherry blossom tree, trunk base at (42, 94)
  dropShadow(ctx, 42, 94, 30, 8, 0.35);
  ctx.beginPath();
  ctx.moveTo(36, 95);
  ctx.quadraticCurveTo(38, 70, 30, 54);
  ctx.lineTo(36, 52);
  ctx.quadraticCurveTo(42, 64, 46, 52);
  ctx.lineTo(52, 54);
  ctx.quadraticCurveTo(46, 72, 48, 95);
  ctx.closePath();
  vshade(ctx, mix(P.wood, P.ink, 0.15), dark(P.wood, 0.5), 52, 95, 2.2);
  const pink = mix(P.berry, P.cream, 0.55);
  const clump = (x: number, y: number, r: number, c: number) => {
    ellipsePath(ctx, x, y, r, r * 0.9);
    shade(ctx, c, x, y, r, 2.4, 0.45, 0.35);
  };
  clump(22, 50, 16, mix(pink, P.berry, 0.25));
  clump(62, 50, 16, mix(pink, P.berry, 0.25));
  clump(42, 40, 24, pink);
  clump(28, 30, 15, pink);
  clump(56, 30, 15, pink);
  clump(42, 20, 13, light(pink, 0.3));
  for (const [hx, hy] of [[30, 22], [48, 16], [20, 40], [60, 42], [40, 34], [52, 48], [32, 50]]) {
    star(ctx, hx, hy, 3.2, 1.5, 5);
    ctx.fillStyle = rgba(P.cream, 0.95);
    ctx.fill();
  }
}

export function drawRock(ctx: Ctx): void {
  // 64 x 48
  dropShadow(ctx, 32, 40, 28, 7, 0.3);
  blobPath(ctx, [8, 38, 10, 20, 24, 8, 42, 10, 52, 22, 50, 38, 30, 42]);
  shade(ctx, mix(P.stone, P.ink, 0.1), 28, 24, 24, 2.4, 0.5, 0.5);
  blobPath(ctx, [42, 40, 44, 28, 54, 24, 60, 32, 58, 40]);
  shade(ctx, mix(P.stone, P.ink, 0.15), 50, 32, 10, 2.2, 0.5, 0.5);
  // moss
  blobPath(ctx, [14, 18, 22, 10, 36, 9, 40, 14, 30, 18, 20, 22]);
  shade(ctx, P.grass, 26, 14, 12, 1.8, 0.4, 0.3);
  // cracks
  ctx.strokeStyle = rgba(P.ink, 0.35);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(30, 26);
  ctx.lineTo(34, 33);
  ctx.lineTo(31, 38);
  ctx.stroke();
}

export function drawBush(ctx: Ctx): void {
  // 64 x 52
  dropShadow(ctx, 32, 46, 28, 7, 0.3);
  const clump = (x: number, y: number, r: number, c: number) => {
    ellipsePath(ctx, x, y, r, r * 0.9);
    shade(ctx, c, x, y, r, 2.4, 0.4, 0.45);
  };
  clump(18, 34, 14, P.pine);
  clump(46, 34, 14, P.pine);
  clump(32, 26, 17, P.grass);
  clump(20, 28, 9, mix(P.grass, P.leaf, 0.3));
  const flower = (x: number, y: number, c: number) => {
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      ellipsePath(ctx, x + Math.cos(a) * 2.8, y + Math.sin(a) * 2.8, 2.4, 2.4);
      ctx.fillStyle = rgba(c);
      ctx.fill();
    }
    ball(ctx, x, y, 1.7, P.gold, 0.8);
  };
  flower(22, 22, P.cream);
  flower(38, 16, P.berry);
  flower(48, 32, P.cream);
  flower(14, 36, P.berry);
  flower(32, 34, P.arcane);
}

export function drawMushrooms(ctx: Ctx): void {
  // 56 x 48
  dropShadow(ctx, 28, 42, 22, 6, 0.3);
  const shroom = (x: number, y: number, s: number) => {
    roundRectPath(ctx, x - 3 * s, y - 2, 6 * s, 12 * s, 3 * s);
    vshade(ctx, P.cream, mix(P.cream, P.stone, 0.6), y, y + 12 * s, 1.8);
    ctx.beginPath();
    ctx.moveTo(x - 11 * s, y + 1);
    ctx.quadraticCurveTo(x - 10 * s, y - 13 * s, x, y - 13 * s);
    ctx.quadraticCurveTo(x + 10 * s, y - 13 * s, x + 11 * s, y + 1);
    ctx.quadraticCurveTo(x, y + 4 * s, x - 11 * s, y + 1);
    ctx.closePath();
    shade(ctx, P.berry, x, y - 6 * s, 11 * s, 2, 0.4, 0.35);
    for (const [dx, dy, r] of [[-5, -6, 2], [3, -9, 1.6], [5, -3, 1.4]]) {
      ellipsePath(ctx, x + dx * s, y + dy * s, r * s, r * s * 0.8);
      ctx.fillStyle = rgba(P.cream);
      ctx.fill();
    }
  };
  shroom(36, 30, 0.75);
  shroom(20, 32, 1);
}

export function drawLily(ctx: Ctx): void {
  // 32 x 24
  blobPath(ctx, [16, 12, 30, 8, 28, 18, 16, 22, 4, 18, 2, 8, 13, 3]);
  shade(ctx, P.grass, 16, 12, 14, 1.8);
  ctx.strokeStyle = rgba(P.pine, 0.8);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(16, 12);
  ctx.lineTo(24, 18);
  ctx.stroke();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    ellipsePath(ctx, 20 + Math.cos(a) * 3, 9 + Math.sin(a) * 3, 2.6, 2.6);
    ctx.fillStyle = rgba(mix(P.berry, P.cream, 0.5));
    ctx.fill();
  }
  ball(ctx, 20, 9, 1.8, P.gold, 0.8);
}

export function drawCloud(ctx: Ctx): void {
  for (const [x, y, r] of [[70, 64, 46], [118, 52, 54], [160, 70, 40], [110, 82, 44]]) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rgba(P.ink, 0.5));
    g.addColorStop(1, rgba(P.ink, 0));
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
}

export { fillOutline };

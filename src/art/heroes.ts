import type { TowerType } from '../config/balance';
import { PALETTE as P } from '../config/palette';
import {
  SKIN,
  SKIN_SHADE,
  animeEye,
  ball,
  blobPath,
  blush,
  dark,
  ellipsePath,
  fillOutline,
  gloss,
  glow,
  light,
  line,
  mix,
  oval,
  polyPath,
  rgba,
  roundRectPath,
  shade,
  star,
  vshade,
  type Ctx,
} from './paint';

/**
 * Original chibi heroes who stand on the towers (anime-inspired style, no
 * existing characters):
 *   Archer - Lyra, an elf ranger in a leaf hood
 *   Cannon - Brann, a young goggled engineer
 *   Frost  - Yuki, an ice maiden with twin tails
 *   Mage   - Zephyr, a storm wizard in a starry hat
 * Hero canvas: 64 x 80, facing right, feet at (32, 76).
 */
export const HERO_W = 64;
export const HERO_H = 80;
export const HERO_FEET_Y = 76;

const HX = 32; // head centre
const HY = 34;
const HR = 19;

interface ChibiSpec {
  outfit: number;
  outfitDark?: number;
  boots: number;
  eye: number;
  back?: (ctx: Ctx) => void; // behind everything (capes, quivers, long hair)
  hairBack?: (ctx: Ctx) => void; // behind the head
  hairFront: (ctx: Ctx) => void; // bangs over the forehead
  top?: (ctx: Ctx) => void; // hats, crowns, halos
  torsoDetail?: (ctx: Ctx) => void;
  mouth?: 'smile' | 'grin' | 'open' | 'cat';
}

function chibi(ctx: Ctx, s: ChibiSpec): void {
  s.back?.(ctx);
  // legs / boots
  oval(ctx, 26, 73, 5.5, 4, s.boots, 2);
  oval(ctx, 38, 73, 5.5, 4, s.boots, 2);
  // torso (rounded trapezoid)
  ctx.beginPath();
  ctx.moveTo(21, 70);
  ctx.quadraticCurveTo(19, 52, 26, 49);
  ctx.lineTo(38, 49);
  ctx.quadraticCurveTo(45, 52, 43, 70);
  ctx.quadraticCurveTo(32, 74, 21, 70);
  ctx.closePath();
  vshade(ctx, light(s.outfit, 0.2), s.outfitDark ?? dark(s.outfit, 0.35), 48, 72, 2.2);
  s.torsoDetail?.(ctx);
  // arms (little rounded stubs)
  oval(ctx, 20, 59, 4.2, 6.5, s.outfit, 2);
  oval(ctx, 44, 59, 4.2, 6.5, s.outfit, 2);
  ball(ctx, 20, 65, 3.4, SKIN, 1.8);
  ball(ctx, 44, 65, 3.4, SKIN, 1.8);
  // hair behind head
  s.hairBack?.(ctx);
  // head
  ellipsePath(ctx, HX, HY, HR, HR * 0.94);
  const g = ctx.createRadialGradient(HX - 6, HY - 8, 2, HX, HY + 2, HR * 1.15);
  g.addColorStop(0, rgba(light(SKIN, 0.4)));
  g.addColorStop(0.6, rgba(SKIN));
  g.addColorStop(1, rgba(SKIN_SHADE));
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = 2.2;
  ctx.strokeStyle = rgba(P.ink);
  ctx.stroke();
  // eyes (3/4 view, looking right)
  animeEye(ctx, 26.5, 37, 4.4, 6, s.eye, 0.3);
  animeEye(ctx, 38.5, 37, 4.2, 5.8, s.eye, 0.3);
  blush(ctx, 23, 44, 4);
  blush(ctx, 42, 44, 4);
  // mouth
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = rgba(P.ink);
  ctx.beginPath();
  if (s.mouth === 'open' || s.mouth === 'grin') {
    ctx.moveTo(30.5, 45.5);
    ctx.quadraticCurveTo(33, 49.5, 35.5, 45.5);
    ctx.closePath();
    ctx.fillStyle = rgba(mix(P.berry, P.ink, 0.35));
    ctx.fill();
    ctx.stroke();
  } else if (s.mouth === 'cat') {
    ctx.moveTo(30, 45.5);
    ctx.quadraticCurveTo(31.5, 47.5, 33, 45.5);
    ctx.quadraticCurveTo(34.5, 47.5, 36, 45.5);
    ctx.stroke();
  } else {
    ctx.moveTo(30.5, 45.5);
    ctx.quadraticCurveTo(33, 48, 35.5, 45.5);
    ctx.stroke();
  }
  s.hairFront(ctx);
  s.top?.(ctx);
}

// ------------------------------------------------------------------ Lyra --
function lyra(ctx: Ctx, lvl: number): void {
  const hood = P.pine;
  chibi(ctx, {
    outfit: P.grass,
    outfitDark: P.pine,
    boots: P.wood,
    eye: P.grass,
    back: (c) => {
      // cape
      blobPath(c, [14, 50, 32, 46, 50, 50, 52, 74, 32, 77, 12, 74]);
      vshade(c, hood, dark(hood, 0.4), 46, 77, 2.2);
      if (lvl >= 3) {
        c.beginPath();
        c.moveTo(13, 72);
        c.quadraticCurveTo(32, 79, 51, 72);
        c.lineWidth = 2.5;
        c.strokeStyle = rgba(P.gold);
        c.stroke();
      }
      // quiver
      c.save();
      c.translate(14, 48);
      c.rotate(-0.35);
      roundRectPath(c, -4, -14, 9, 22, 3);
      vshade(c, light(P.wood, 0.15), dark(P.wood, 0.3), -14, 8, 2);
      for (const [fx, col] of [[-2, P.berry], [1.5, P.cream], [4, P.berry]] as const) {
        polyPath(c, [fx - 2, -14, fx, -21, fx + 2, -14]);
        fillOutline(c, col, 1.2);
      }
      c.restore();
    },
    hairBack: (c) => {
      // long blonde hair flowing out of the hood
      blobPath(c, [13, 34, 16, 20, 32, 14, 48, 20, 51, 36, 48, 54, 40, 50, 24, 50, 15, 54]);
      shade(c, P.gold, 32, 34, 22, 2.2, 0.35, 0.3);
      // hood back
      blobPath(c, [10, 36, 13, 16, 32, 8, 51, 16, 54, 36, 50, 46, 14, 46]);
      shade(c, hood, 32, 26, 24, 2.2, 0.3, 0.35);
    },
    hairFront: (c) => {
      // bangs
      blobPath(c, [14, 33, 17, 20, 30, 15, 46, 19, 50, 31, 43, 26, 38, 31, 33, 24, 27, 31, 22, 26]);
      shade(c, P.gold, 30, 22, 16, 2, 0.45, 0.25);
      // elf ear
      polyPath(c, [49, 36, 60, 28, 51, 42]);
      fillOutline(c, SKIN, 1.8);
      // hood rim
      c.beginPath();
      c.ellipse(32, 30, 21, 20, 0, Math.PI * 1.05, Math.PI * 1.95);
      c.lineWidth = 4.5;
      c.strokeStyle = rgba(dark(hood, 0.15));
      c.stroke();
      c.lineWidth = 1.5;
      c.strokeStyle = rgba(P.leaf, 0.8);
      c.stroke();
    },
    top: (c) => {
      // leaf pin
      c.save();
      c.translate(17, 22);
      c.rotate(-0.6);
      ellipsePath(c, 0, 0, 5, 2.6);
      fillOutline(c, P.leaf, 1.2);
      c.restore();
      if (lvl >= 2) {
        // gold circlet with gem
        c.beginPath();
        c.ellipse(32, 27, 17, 6, 0, Math.PI * 1.05, Math.PI * 1.95);
        c.lineWidth = 2.6;
        c.strokeStyle = rgba(P.gold);
        c.stroke();
        ball(c, 32, 21.5, 2.6, P.grass, 1.2);
      }
      if (lvl >= 3) {
        // laurel crown
        for (let i = 0; i < 5; i++) {
          const a = Math.PI * (1.15 + i * 0.17);
          c.save();
          c.translate(32 + Math.cos(a) * 19, 30 + Math.sin(a) * 18);
          c.rotate(a + Math.PI / 2);
          ellipsePath(c, 0, -3, 2.4, 5);
          fillOutline(c, P.gold, 1.2);
          c.restore();
        }
      }
    },
    torsoDetail: (c) => {
      roundRectPath(c, 21, 60, 22, 3.5, 1.5);
      fillOutline(c, P.wood, 1.2);
      ball(c, 32, 61.7, 2.4, P.gold, 1);
      if (lvl >= 2) {
        // pauldron
        ellipsePath(c, 44, 53, 6, 4.5);
        shade(c, P.gold, 44, 53, 6, 1.6);
      }
    },
    mouth: 'smile',
  });
}

// ----------------------------------------------------------------- Brann --
function brann(ctx: Ctx, lvl: number): void {
  const hair = mix(P.wood, P.gold, 0.35);
  chibi(ctx, {
    outfit: P.water,
    boots: dark(P.wood, 0.2),
    eye: mix(P.gold, P.wood, 0.4),
    back: (c) => {
      // big wrench on the back
      c.save();
      c.translate(46, 50);
      c.rotate(0.6);
      roundRectPath(c, -2.5, -18, 5, 26, 2);
      vshade(c, light(P.stone, 0.2), dark(P.stone, 0.45), -18, 8, 1.8);
      c.beginPath();
      c.arc(0, -20, 6, 0.4, Math.PI * 2 - 0.4 + Math.PI);
      c.lineWidth = 5;
      c.strokeStyle = rgba(P.ink);
      c.stroke();
      c.lineWidth = 3;
      c.strokeStyle = rgba(light(P.stone, 0.1));
      c.stroke();
      c.restore();
      if (lvl >= 2) {
        // scarf tail
        blobPath(c, [24, 50, 12, 55, 8, 62, 14, 60, 22, 56]);
        shade(c, P.berry, 16, 56, 9, 1.8);
      }
    },
    hairBack: (c) => {
      blobPath(c, [13, 38, 15, 22, 32, 14, 49, 22, 51, 38, 46, 46, 18, 46]);
      shade(c, hair, 32, 30, 22, 2.2, 0.35, 0.3);
    },
    hairFront: (c) => {
      // spiky messy bangs
      polyPath(c, [13, 34, 15, 22, 20, 28, 22, 17, 28, 25, 31, 15, 36, 24, 41, 16, 43, 26, 49, 21, 51, 34, 45, 27, 39, 31, 33, 26, 26, 31, 20, 27]);
      shade(c, hair, 32, 24, 18, 2, 0.45, 0.25);
      // freckles
      c.fillStyle = rgba(mix(P.wood, SKIN, 0.4));
      for (const [fx, fy] of [[22, 42], [24.5, 43.5], [41, 42], [43.5, 43.5]]) {
        c.beginPath();
        c.arc(fx, fy, 0.8, 0, Math.PI * 2);
        c.fill();
      }
    },
    top: (c) => {
      if (lvl >= 3) {
        // gold helmet with plume
        blobPath(c, [12, 26, 18, 12, 32, 7, 46, 12, 52, 26, 32, 22]);
        shade(c, P.gold, 32, 16, 22, 2.2, 0.5, 0.35);
        blobPath(c, [30, 8, 34, -1, 44, -4, 40, 5, 36, 9]);
        shade(c, P.berry, 37, 2, 8, 1.6);
      } else {
        // leather aviator cap
        blobPath(c, [12, 27, 16, 13, 32, 8, 48, 13, 52, 27, 32, 22]);
        shade(c, P.wood, 32, 17, 22, 2.2, 0.35, 0.35);
      }
      // goggles on the forehead
      line(c, 13, 25, 51, 25, 3, dark(P.wood, 0.3), 1.2);
      for (const gx of [25, 39]) {
        ellipsePath(c, gx, 24, 6.2, 5.2);
        shade(c, P.gold, gx, 24, 6, 1.8);
        ellipsePath(c, gx, 24, 4.2, 3.4);
        const g = c.createLinearGradient(0, 20, 0, 28);
        g.addColorStop(0, rgba(P.ice));
        g.addColorStop(1, rgba(P.water));
        c.fillStyle = g;
        c.fill();
        ellipsePath(c, gx - 1.5, 22.5, 1.6, 1);
        c.fillStyle = rgba(P.cream);
        c.fill();
      }
    },
    torsoDetail: (c) => {
      // overall straps + bib
      roundRectPath(c, 26, 56, 12, 12, 2);
      fillOutline(c, dark(P.water, 0.15), 1.3);
      line(c, 26, 50, 27, 57, 2, P.gold, 0);
      line(c, 38, 50, 37, 57, 2, P.gold, 0);
      if (lvl >= 2) {
        // gear badge
        star(c, 32, 61, 4.2, 3, 8);
        fillOutline(c, P.gold, 1.2);
        ellipsePath(c, 32, 61, 1.4, 1.4);
        c.fillStyle = rgba(P.ink);
        c.fill();
      }
    },
    mouth: 'grin',
  });
}

// ------------------------------------------------------------------ Yuki --
function yuki(ctx: Ctx, lvl: number): void {
  const hair = mix(P.ice, P.cream, 0.45);
  chibi(ctx, {
    outfit: mix(P.cream, P.ice, 0.45),
    outfitDark: mix(P.ice, P.water, 0.5),
    boots: P.water,
    eye: P.water,
    back: (c) => {
      // twin tails
      for (const side of [-1, 1]) {
        const x = 32 + side * 20;
        blobPath(c, [x - side * 2, 26, x + side * 8, 34, x + side * 10, 52, x + side * 5, 64, x - side * 2, 50]);
        shade(c, hair, x + side * 4, 44, 16, 2.2, 0.3, 0.35);
      }
      if (lvl >= 3) {
        // crystal halo
        glow(c, 32, 16, 26, P.ice, 0.5);
        c.beginPath();
        c.ellipse(32, 10, 18, 5, 0, 0, Math.PI * 2);
        c.lineWidth = 3;
        c.strokeStyle = rgba(P.ice, 0.95);
        c.stroke();
      }
    },
    hairBack: (c) => {
      blobPath(c, [12, 40, 14, 20, 32, 12, 50, 20, 52, 40, 46, 52, 18, 52]);
      shade(c, hair, 32, 30, 22, 2.2, 0.3, 0.35);
    },
    hairFront: (c) => {
      // straight-cut bangs with side locks
      blobPath(c, [13, 36, 15, 20, 32, 13, 49, 20, 51, 36, 46, 27, 40, 30, 35, 26, 29, 30, 23, 27, 18, 31]);
      shade(c, hair, 30, 22, 17, 2, 0.4, 0.25);
      // snowflake hairpin
      c.save();
      c.translate(45, 21);
      for (let i = 0; i < 3; i++) {
        c.rotate(Math.PI / 3);
        line(c, -4.5, 0, 4.5, 0, 1.6, P.water, 1);
      }
      c.restore();
      ball(c, 45, 21, 1.6, P.cream, 0.8);
    },
    top: (c) => {
      if (lvl >= 2) {
        // ice tiara
        polyPath(c, [21, 20, 24, 12, 27, 18, 32, 7, 37, 18, 40, 12, 43, 20]);
        const g = c.createLinearGradient(0, 7, 0, 20);
        g.addColorStop(0, rgba(P.cream));
        g.addColorStop(1, rgba(P.ice));
        c.fillStyle = g;
        c.fill();
        c.lineWidth = 1.6;
        c.strokeStyle = rgba(P.ink);
        c.stroke();
        glow(c, 32, 12, 8, P.ice, 0.6);
      }
    },
    torsoDetail: (c) => {
      // fur collar
      for (let i = 0; i < 5; i++) ball(c, 23 + i * 4.5, 50.5, 3.2, P.cream, 1.2);
      if (lvl >= 2) {
        star(c, 32, 61, 3.6, 1.6, 6);
        fillOutline(c, P.ice, 1);
      }
    },
    mouth: 'cat',
  });
}

// ---------------------------------------------------------------- Zephyr --
function zephyr(ctx: Ctx, lvl: number): void {
  const hair = mix(P.arcane, P.ink, 0.15);
  const robe = P.arcane;
  chibi(ctx, {
    outfit: robe,
    boots: dark(P.arcane, 0.45),
    eye: P.gold,
    back: (c) => {
      // scarf tail
      blobPath(c, [24, 50, 10, 54, 6, 64, 12, 62, 22, 56]);
      shade(c, P.gold, 14, 57, 9, 1.8);
      if (lvl >= 3) {
        for (const [ox, oy] of [[8, 30], [56, 40], [52, 14]]) {
          glow(c, ox, oy, 10, P.ice, 0.8);
          ball(c, ox, oy, 4, P.ice, 1.4);
        }
      }
    },
    hairBack: (c) => {
      blobPath(c, [13, 38, 15, 24, 32, 18, 49, 24, 51, 38, 46, 48, 18, 48]);
      shade(c, hair, 32, 32, 20, 2.2, 0.35, 0.3);
    },
    hairFront: (c) => {
      polyPath(c, [14, 36, 16, 26, 22, 30, 25, 22, 30, 29, 35, 22, 39, 29, 44, 23, 48, 28, 50, 36, 44, 30, 38, 33, 32, 29, 26, 33, 20, 30]);
      shade(c, hair, 32, 28, 16, 2, 0.45, 0.25);
    },
    top: (c) => {
      // big pointed wizard hat
      blobPath(c, [6, 28, 32, 20, 58, 28, 32, 34]);
      shade(c, dark(robe, 0.15), 32, 27, 26, 2.2, 0.3, 0.4);
      c.beginPath();
      c.moveTo(14, 26);
      c.quadraticCurveTo(20, 4, 36, -4);
      c.quadraticCurveTo(46, -8, 54, -2);
      c.quadraticCurveTo(42, 0, 44, 10);
      c.quadraticCurveTo(48, 20, 50, 26);
      c.quadraticCurveTo(32, 22, 14, 26);
      c.closePath();
      shade(c, robe, 30, 12, 22, 2.2, 0.35, 0.4);
      // stars on the hat
      for (const [sx, sy, sr] of [[24, 14, 2.6], [36, 6, 2], [40, 18, 1.8]]) {
        star(c, sx, sy, sr, sr * 0.45);
        c.fillStyle = rgba(P.gold);
        c.fill();
      }
      if (lvl >= 2) {
        c.beginPath();
        c.moveTo(15, 24.5);
        c.quadraticCurveTo(32, 20, 49.5, 24.5);
        c.lineWidth = 3.4;
        c.strokeStyle = rgba(P.ink);
        c.stroke();
        c.lineWidth = 2.2;
        c.strokeStyle = rgba(P.gold);
        c.stroke();
        ball(c, 32, 22.6, 2.6, P.berry, 1.2);
      }
    },
    torsoDetail: (c) => {
      // robe front trim
      line(c, 32, 50, 32, 70, 2, P.gold, 0);
      roundRectPath(c, 21, 60, 22, 3, 1.5);
      fillOutline(c, P.gold, 1);
    },
    mouth: 'smile',
  });
  if (lvl >= 3) {
    // glowing eyes
    glow(ctx, 26.5, 37, 6, P.gold, 0.5);
    glow(ctx, 38.5, 37, 6, P.gold, 0.5);
  }
}

export function drawHero(ctx: Ctx, type: TowerType, lvl: number): void {
  if (lvl >= 3) glow(ctx, 32, 46, 34, type === 'frost' ? P.ice : type === 'mage' ? P.arcane : P.gold, 0.25);
  if (type === 'archer') lyra(ctx, lvl);
  else if (type === 'cannon') brann(ctx, lvl);
  else if (type === 'frost') yuki(ctx, lvl);
  else zephyr(ctx, lvl);
}

// --------------------------------------------------------------- weapons --
/** Weapon canvas: 72 x 40, pointing right, pivot (grip) at (16, 20). */
export const WEAPON_W = 72;
export const WEAPON_H = 40;
export const WEAPON_PIVOT_X = 16 / WEAPON_W;

export function drawWeapon(ctx: Ctx, type: TowerType, lvl: number): void {
  const cy = 20;
  if (type === 'archer') {
    const bowColor = lvl >= 3 ? P.gold : lvl >= 2 ? mix(P.wood, P.gold, 0.35) : P.wood;
    if (lvl >= 3) glow(ctx, 40, cy, 22, P.leaf, 0.35);
    // arrow
    line(ctx, 10, cy, 58, cy, 2, P.wood, 1.2);
    ctx.beginPath();
    ctx.moveTo(66, cy);
    ctx.lineTo(56, cy - 4.5);
    ctx.lineTo(58, cy);
    ctx.lineTo(56, cy + 4.5);
    ctx.closePath();
    fillOutline(ctx, lvl >= 2 ? P.gold : P.stone, 1.4);
    glow(ctx, 62, cy, 6, P.leaf, 0.6);
    polyPath(ctx, [6, cy - 5, 14, cy - 1.5, 14, cy + 1.5, 6, cy + 5, 9, cy]);
    fillOutline(ctx, P.berry, 1.2);
    // bow
    ctx.beginPath();
    ctx.moveTo(30, 2);
    ctx.quadraticCurveTo(46, cy, 30, 38);
    ctx.lineWidth = 7;
    ctx.strokeStyle = rgba(P.ink);
    ctx.stroke();
    ctx.lineWidth = 4;
    ctx.strokeStyle = rgba(bowColor);
    ctx.stroke();
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = rgba(light(bowColor, 0.5));
    ctx.beginPath();
    ctx.moveTo(31, 5);
    ctx.quadraticCurveTo(43, cy, 33, 30);
    ctx.stroke();
    // string pulled back
    ctx.beginPath();
    ctx.moveTo(30, 2);
    ctx.lineTo(14, cy);
    ctx.lineTo(30, 38);
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = rgba(P.cream);
    ctx.stroke();
    if (lvl >= 2) {
      ball(ctx, 30, 3, 2.6, P.gold, 1.2);
      ball(ctx, 30, 37, 2.6, P.gold, 1.2);
    }
  } else if (type === 'cannon') {
    const barrel = (oy: number, h: number, len: number) => {
      roundRectPath(ctx, 14, cy + oy - h / 2, len, h, h * 0.35);
      vshade(ctx, light(P.stone, 0.05), dark(P.stone, 0.62), cy + oy - h / 2, cy + oy + h / 2, 2);
      roundRectPath(ctx, 14 + len - 6, cy + oy - h / 2 - 2.5, 8, h + 5, 3);
      vshade(ctx, P.gold, dark(P.gold, 0.4), cy + oy - h / 2 - 2.5, cy + oy + h / 2 + 2.5, 1.8);
      ellipsePath(ctx, 14 + len + 2, cy + oy, 1.8, h * 0.32);
      ctx.fillStyle = rgba(P.ink);
      ctx.fill();
      for (const bx of [0.35, 0.6]) {
        ctx.fillStyle = rgba(lvl >= 2 ? P.gold : dark(P.stone, 0.3));
        ctx.fillRect(14 + len * bx, cy + oy - h / 2, 2.6, h);
      }
      ellipsePath(ctx, 14 + len * 0.45, cy + oy - h * 0.22, len * 0.35, h * 0.1);
      ctx.fillStyle = rgba(P.cream, 0.45);
      ctx.fill();
    };
    // wooden stock
    blobPath(ctx, [2, cy - 6, 18, cy - 7, 22, cy + 6, 6, cy + 9]);
    shade(ctx, P.wood, 12, cy, 10, 2);
    if (lvl >= 3) {
      barrel(-6, 10, 46);
      barrel(6, 10, 46);
    } else {
      barrel(0, 12 + lvl * 1.5, 38 + lvl * 4);
    }
    // fuse spark
    glow(ctx, 18, cy - 11, 6, P.gold, 0.9);
    star(ctx, 18, cy - 11, 3.4, 1.2, 4);
    ctx.fillStyle = rgba(P.cream);
    ctx.fill();
  } else if (type === 'frost') {
    // staff
    line(ctx, 4, cy, 46, cy, 3.2, P.wood, 1.6);
    if (lvl >= 2) {
      line(ctx, 18, cy, 22, cy, 3.6, P.gold, 1.2);
    }
    // crystal head
    const s = 1 + (lvl - 1) * 0.18;
    glow(ctx, 56, cy, 16 * s, P.ice, 0.7);
    const crystal = (x: number, y: number, len: number, half: number) => {
      polyPath(ctx, [x + len, y, x + len * 0.35, y - half, x - len * 0.15, y, x + len * 0.35, y + half]);
      const g = ctx.createLinearGradient(x, y - half, x, y + half);
      g.addColorStop(0, rgba(P.cream));
      g.addColorStop(0.5, rgba(P.ice));
      g.addColorStop(1, rgba(P.water));
      ctx.fillStyle = g;
      ctx.fill();
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = rgba(P.ink);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + len * 0.8, y - 0.5);
      ctx.lineTo(x + len * 0.3, y - half * 0.7);
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = rgba(P.cream, 0.9);
      ctx.stroke();
    };
    if (lvl >= 3) {
      crystal(46, cy - 8, 12, 4);
      crystal(46, cy + 8, 12, 4);
    }
    crystal(44, cy, 24 * s, 7 * s);
  } else {
    // storm staff
    line(ctx, 4, cy, 44, cy, 3.2, dark(P.wood, 0.15), 1.6);
    // crescent
    ctx.beginPath();
    ctx.arc(52, cy, 11, -1.9, 1.9);
    ctx.lineWidth = 5;
    ctx.strokeStyle = rgba(P.ink);
    ctx.stroke();
    ctx.lineWidth = 3;
    ctx.strokeStyle = rgba(P.gold);
    ctx.stroke();
    const r = 6 + lvl;
    glow(ctx, 54, cy, r * 2.6, P.arcane, 0.8);
    ball(ctx, 54, cy, r, P.arcane, 1.8);
    glow(ctx, 54, cy, r * 0.9, P.cream, 0.7);
    // little lightning glyph inside the orb
    polyPath(ctx, [53, cy - 4, 56, cy - 4, 54.5, cy, 57, cy, 52, cy + 5, 53.5, cy + 1, 51.5, cy + 1]);
    ctx.fillStyle = rgba(P.cream);
    ctx.fill();
    if (lvl >= 2) {
      ball(ctx, 40, cy, 2.6, P.berry, 1.2);
    }
  }
}

/** Gloss helper re-export for callers that decorate weapons. */
export { gloss };

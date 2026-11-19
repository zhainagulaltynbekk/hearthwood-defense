import { PALETTE as P } from '../config/palette';
import {
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
 * Cute anime-style monsters, all facing right:
 *   basic   - Jellybun, a berry slime with a leaf sprout          (52 x 48)
 *   fast    - Kit, a mischievous fox spirit                      (60 x 50)
 *   armored - Sir Shellby, a turtle knight in a steel helmet     (60 x 56)
 *   flying  - Pip, a round bat (2 wing frames)                   (64 x 48)
 *   boss    - Grumbold, the ogre king                            (104 x 104)
 */

function mouthSmile(ctx: Ctx, x: number, y: number, w: number, open = false): void {
  ctx.beginPath();
  ctx.moveTo(x - w, y);
  ctx.quadraticCurveTo(x, y + w * (open ? 1.3 : 0.9), x + w, y);
  if (open) {
    ctx.closePath();
    ctx.fillStyle = rgba(mix(P.berry, P.ink, 0.4));
    ctx.fill();
  }
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = rgba(P.ink);
  ctx.stroke();
}

export function drawSlime(ctx: Ctx): void {
  const c = P.berry;
  // jelly body
  ctx.beginPath();
  ctx.moveTo(6, 42);
  ctx.quadraticCurveTo(4, 14, 26, 10);
  ctx.quadraticCurveTo(48, 12, 47, 42);
  ctx.quadraticCurveTo(26, 47, 6, 42);
  ctx.closePath();
  const g = ctx.createRadialGradient(18, 18, 2, 26, 30, 26);
  g.addColorStop(0, rgba(light(c, 0.55)));
  g.addColorStop(0.5, rgba(c));
  g.addColorStop(1, rgba(dark(c, 0.35)));
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = 2.4;
  ctx.strokeStyle = rgba(P.ink);
  ctx.stroke();
  // inner jelly glow + bubbles
  ellipsePath(ctx, 28, 34, 14, 7);
  ctx.fillStyle = rgba(light(c, 0.3), 0.45);
  ctx.fill();
  for (const [bx, by, br] of [[38, 34, 2], [41, 28, 1.3], [14, 36, 1.5]]) {
    ellipsePath(ctx, bx, by, br, br);
    ctx.fillStyle = rgba(P.cream, 0.6);
    ctx.fill();
  }
  // gloss
  ellipsePath(ctx, 15, 19, 6, 3.4, -0.6);
  ctx.fillStyle = rgba(P.cream, 0.85);
  ctx.fill();
  ellipsePath(ctx, 22, 14.5, 1.6, 1.3);
  ctx.fill();
  // leaf sprout
  line(ctx, 26, 10, 27, 4, 1.6, P.pine, 1);
  ctx.save();
  ctx.translate(31, 3);
  ctx.rotate(-0.4);
  ellipsePath(ctx, 0, 0, 5, 2.6);
  shade(ctx, P.leaf, 0, 0, 5, 1.4);
  ctx.restore();
  // face
  animeEye(ctx, 26, 27, 4.6, 6.2, P.ink, 0.25, false);
  animeEye(ctx, 37, 27, 4.4, 6, P.ink, 0.25, false);
  blush(ctx, 20, 34, 3.6);
  blush(ctx, 43, 34, 3.6);
  mouthSmile(ctx, 31.5, 34, 2.6, true);
}

export function drawFox(ctx: Ctx): void {
  const fur = mix(P.wood, P.gold, 0.45);
  // tail
  blobPath(ctx, [18, 30, 6, 22, 2, 10, 10, 6, 18, 16, 24, 26]);
  shade(ctx, fur, 10, 16, 14, 2.2);
  blobPath(ctx, [2, 10, 6, 4, 12, 6, 9, 12]);
  fillOutline(ctx, P.cream, 1.6);
  // legs
  for (const lx of [20, 27, 37, 44]) {
    roundRectPath(ctx, lx - 2.5, 36, 5, 11, 2.5);
    vshade(ctx, fur, dark(fur, 0.4), 36, 47, 1.8);
  }
  // body
  oval(ctx, 32, 33, 15, 9.5, fur, 2.2);
  ellipsePath(ctx, 34, 37, 9, 4);
  ctx.fillStyle = rgba(P.cream, 0.95);
  ctx.fill();
  // head
  ellipsePath(ctx, 46, 22, 12, 11);
  shade(ctx, fur, 46, 22, 12, 2.2);
  // ears
  for (const [ex, ey, d] of [[39, 12, -1], [50, 10, 1]]) {
    polyPath(ctx, [ex - 4, ey + 4, ex + d * 1, ey - 8, ex + 5, ey + 3]);
    fillOutline(ctx, fur, 1.8);
    polyPath(ctx, [ex - 1.5, ey + 2.5, ex + d * 0.8, ey - 3.5, ex + 2.8, ey + 2]);
    ctx.fillStyle = rgba(P.berry, 0.8);
    ctx.fill();
  }
  // cheek fluff + snout
  blobPath(ctx, [46, 26, 58, 22, 60, 27, 54, 31, 45, 31]);
  fillOutline(ctx, P.cream, 1.6);
  ball(ctx, 59.5, 24.5, 1.8, P.ink, 0);
  // eye (big, sly)
  animeEye(ctx, 47, 20, 3.8, 5, P.gold, 0.35);
  blush(ctx, 43, 27, 3);
  // scarf
  roundRectPath(ctx, 34, 28, 10, 4, 2);
  fillOutline(ctx, P.arcane, 1.3);
  polyPath(ctx, [35, 30, 30, 36, 34, 37]);
  fillOutline(ctx, P.arcane, 1.3);
}

export function drawTurtleKnight(ctx: Ctx): void {
  const skin = mix(P.grass, P.leaf, 0.3);
  // feet
  for (const fx of [16, 28, 40]) oval(ctx, fx, 50, 5, 4, skin, 1.8);
  // head
  ellipsePath(ctx, 48, 34, 10, 9.5);
  shade(ctx, skin, 48, 34, 10, 2.2);
  animeEye(ctx, 50, 33, 3.6, 4.8, P.ink, 0.3, false);
  mouthSmile(ctx, 53, 38.5, 1.8);
  // helmet with visor plume
  blobPath(ctx, [37, 32, 39, 22, 48, 18, 58, 22, 59, 30, 50, 28]);
  shade(ctx, mix(P.stone, P.ice, 0.35), 48, 24, 11, 2.2, 0.55, 0.45);
  blobPath(ctx, [44, 19, 46, 9, 54, 6, 52, 13, 49, 18]);
  shade(ctx, P.berry, 49, 13, 7, 1.6);
  // shell (metal armour)
  ctx.beginPath();
  ctx.moveTo(4, 46);
  ctx.quadraticCurveTo(4, 16, 26, 14);
  ctx.quadraticCurveTo(46, 16, 46, 46);
  ctx.closePath();
  const metal = mix(P.stone, P.ice, 0.3);
  const g = ctx.createRadialGradient(16, 20, 2, 25, 34, 28);
  g.addColorStop(0, rgba(P.cream));
  g.addColorStop(0.35, rgba(metal));
  g.addColorStop(1, rgba(dark(metal, 0.55)));
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = 2.4;
  ctx.strokeStyle = rgba(P.ink);
  ctx.stroke();
  // plates
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = rgba(P.ink, 0.45);
  ctx.beginPath();
  ctx.moveTo(25, 15);
  ctx.lineTo(25, 45);
  ctx.moveTo(8, 32);
  ctx.quadraticCurveTo(25, 26, 43, 32);
  ctx.stroke();
  // gold rim + rivets
  ctx.beginPath();
  ctx.moveTo(4, 46);
  ctx.lineTo(46, 46);
  ctx.lineWidth = 4;
  ctx.strokeStyle = rgba(P.gold);
  ctx.stroke();
  for (const [rx, ry] of [[14, 24], [36, 24], [12, 40], [38, 40]]) ball(ctx, rx, ry, 1.8, P.gold, 1);
  // crest
  star(ctx, 25, 30, 5, 2.4);
  fillOutline(ctx, P.gold, 1.4);
  // shine
  ellipsePath(ctx, 14, 22, 6, 2.6, -0.7);
  ctx.fillStyle = rgba(P.cream, 0.8);
  ctx.fill();
}

export function drawBat(ctx: Ctx, up: boolean): void {
  const body = P.arcane;
  const membrane = mix(P.arcane, P.ink, 0.25);
  const cx = 32;
  const wing = (dir: number) => {
    const pts = up
      ? [cx + dir * 8, 22, cx + dir * 18, 6, cx + dir * 30, 4, cx + dir * 28, 14, cx + dir * 31, 20, cx + dir * 23, 22, cx + dir * 22, 28, cx + dir * 12, 26]
      : [cx + dir * 8, 22, cx + dir * 20, 26, cx + dir * 30, 32, cx + dir * 25, 36, cx + dir * 27, 42, cx + dir * 18, 38, cx + dir * 14, 42, cx + dir * 10, 30];
    polyPath(ctx, pts);
    const g = ctx.createLinearGradient(cx, 0, cx + dir * 30, 0);
    g.addColorStop(0, rgba(light(membrane, 0.1)));
    g.addColorStop(1, rgba(dark(membrane, 0.3)));
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = rgba(P.ink);
    ctx.stroke();
    // bones
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = rgba(light(membrane, 0.35), 0.8);
    ctx.beginPath();
    ctx.moveTo(cx + dir * 9, 23);
    ctx.lineTo(pts[4], pts[5]);
    ctx.moveTo(cx + dir * 9, 23);
    ctx.lineTo(pts[10], pts[11]);
    ctx.stroke();
  };
  wing(-1);
  wing(1);
  // ears
  polyPath(ctx, [24, 16, 24, 4, 30, 13]);
  fillOutline(ctx, body, 1.8);
  polyPath(ctx, [40, 16, 40, 4, 34, 13]);
  fillOutline(ctx, body, 1.8);
  // body
  ellipsePath(ctx, cx, 24, 12, 11.5);
  shade(ctx, body, cx, 24, 12, 2.2);
  ellipsePath(ctx, cx, 30, 7, 4.5);
  ctx.fillStyle = rgba(light(body, 0.45), 0.8);
  ctx.fill();
  animeEye(ctx, 27.5, 22, 3.8, 4.8, P.berry, 0.2, false);
  animeEye(ctx, 37, 22, 3.8, 4.8, P.berry, 0.2, false);
  polyPath(ctx, [29, 28, 30.5, 31.5, 32, 28]);
  fillOutline(ctx, P.cream, 0.8);
  polyPath(ctx, [32.5, 28, 34, 31.5, 35.5, 28]);
  fillOutline(ctx, P.cream, 0.8);
  blush(ctx, 24, 27, 2.6);
  blush(ctx, 40, 27, 2.6);
}

export function drawOgreKing(ctx: Ctx): void {
  const skin = mix(P.grass, P.stone, 0.35);
  // royal cape
  blobPath(ctx, [24, 40, 52, 34, 82, 40, 88, 90, 52, 96, 16, 90]);
  vshade(ctx, P.berry, dark(P.berry, 0.45), 34, 96, 2.6);
  ctx.beginPath();
  ctx.moveTo(17, 88);
  ctx.quadraticCurveTo(52, 99, 87, 88);
  ctx.lineWidth = 5;
  ctx.strokeStyle = rgba(P.cream);
  ctx.stroke();
  for (let i = 0; i < 7; i++) {
    ellipsePath(ctx, 22 + i * 10.5, 91 + Math.sin(i) * 1.5, 1.4, 1.8);
    ctx.fillStyle = rgba(P.ink);
    ctx.fill();
  }
  // legs
  for (const lx of [40, 62]) {
    roundRectPath(ctx, lx - 7, 80, 14, 18, 6);
    vshade(ctx, skin, dark(skin, 0.4), 80, 98, 2.2);
  }
  // belly / body
  ellipsePath(ctx, 52, 64, 28, 24);
  shade(ctx, skin, 52, 64, 28, 2.6);
  ellipsePath(ctx, 54, 70, 17, 13);
  ctx.fillStyle = rgba(light(skin, 0.4), 0.7);
  ctx.fill();
  // belt
  roundRectPath(ctx, 26, 76, 52, 8, 4);
  vshade(ctx, P.wood, dark(P.wood, 0.4), 76, 84, 2);
  roundRectPath(ctx, 46, 74, 12, 12, 3);
  vshade(ctx, P.gold, dark(P.gold, 0.35), 74, 86, 2);
  // club
  ctx.save();
  ctx.translate(86, 62);
  ctx.rotate(0.35);
  blobPath(ctx, [-4, 20, -6, -20, 0, -34, 8, -22, 6, 20]);
  vshade(ctx, light(P.wood, 0.15), dark(P.wood, 0.4), -34, 20, 2.4);
  for (const [sx, sy] of [[-6, -20], [7, -14], [-5, -6], [6, -26]]) {
    polyPath(ctx, [sx - 2.5, sy, sx + (sx < 0 ? -5 : 5), sy - 2, sx, sy + 2.5]);
    fillOutline(ctx, P.cream, 1.2);
  }
  ctx.restore();
  // arms
  ball(ctx, 24, 66, 9, skin, 2.4);
  ball(ctx, 82, 70, 9, skin, 2.4);
  // head
  ellipsePath(ctx, 54, 34, 21, 19);
  shade(ctx, skin, 54, 34, 21, 2.6);
  // ears
  for (const ex of [32, 76]) {
    ellipsePath(ctx, ex, 34, 5, 7);
    shade(ctx, skin, ex, 34, 6, 2);
  }
  // brows + eyes
  animeEye(ctx, 46, 34, 5.2, 6, P.berry, 0.3);
  animeEye(ctx, 62, 34, 5, 5.8, P.berry, 0.3);
  ctx.lineWidth = 3.2;
  ctx.strokeStyle = rgba(P.ink);
  ctx.beginPath();
  ctx.moveTo(39, 24);
  ctx.lineTo(51, 28);
  ctx.moveTo(57, 28);
  ctx.lineTo(69, 24);
  ctx.stroke();
  // grumpy mouth with tusks
  ctx.beginPath();
  ctx.moveTo(45, 46);
  ctx.quadraticCurveTo(55, 41, 65, 46);
  ctx.lineWidth = 2.2;
  ctx.stroke();
  polyPath(ctx, [46, 46, 48, 39, 50, 45]);
  fillOutline(ctx, P.cream, 1.4);
  polyPath(ctx, [60, 45, 62, 39, 64, 46]);
  fillOutline(ctx, P.cream, 1.4);
  blush(ctx, 40, 42, 4);
  blush(ctx, 68, 42, 4);
  // crown
  polyPath(ctx, [36, 20, 38, 2, 46, 12, 54, -2, 62, 12, 70, 2, 72, 20]);
  vshade(ctx, light(P.gold, 0.3), dark(P.gold, 0.3), -2, 20, 2.4);
  for (const [gx, gy, col] of [[54, 12, P.berry], [44, 15, P.ice], [64, 15, P.ice]] as const) ball(ctx, gx, gy, 2.6, col, 1.2);
  glow(ctx, 54, 4, 10, P.gold, 0.5);
}

export { ball, gloss, star };

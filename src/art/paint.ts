import Phaser from 'phaser';
import { PALETTE as P } from '../config/palette';
import { TEX_RES } from '../config/layout';

/**
 * Canvas 2D painting helpers for the procedural art. Real gradients, bezier
 * curves and soft glows give a painted, premium look; every colour is a
 * palette colour or a blend of two palette colours.
 */
export type Ctx = CanvasRenderingContext2D;

export interface ArtData {
  artScale?: number;
}

/** Blend two palette colours (t = 0 -> a, t = 1 -> b). */
export function mix(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  return (Math.round(ar + (br - ar) * t) << 16) | (Math.round(ag + (bg - ag) * t) << 8) | Math.round(ab + (bb - ab) * t);
}

/** CSS rgba() for a colour. */
export function rgba(c: number, a = 1): string {
  return `rgba(${(c >> 16) & 255},${(c >> 8) & 255},${c & 255},${a})`;
}

export const light = (c: number, t = 0.35): number => mix(c, P.cream, t);
export const dark = (c: number, t = 0.35): number => mix(c, P.ink, t);

/** Skin tone used by all characters (cream warmed with a touch of berry and gold). */
export const SKIN = mix(mix(P.cream, P.berry, 0.16), P.gold, 0.12);
export const SKIN_SHADE = mix(SKIN, P.berry, 0.28);

/**
 * Creates a canvas texture drawn at TEX_RES and tags its display scale.
 * Skips keys that already exist (e.g. replaced by a sprite pack).
 */
export function canvasTexture(scene: Phaser.Scene, key: string, w: number, h: number, draw: (ctx: Ctx) => void): void {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, Math.ceil(w * TEX_RES), Math.ceil(h * TEX_RES));
  if (!tex) return;
  const ctx = tex.getContext();
  ctx.save();
  ctx.scale(TEX_RES, TEX_RES);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  draw(ctx);
  ctx.restore();
  tex.refresh();
  (tex.customData as ArtData).artScale = 1 / TEX_RES;
}

// --------------------------------------------------------------- shapes --

export function ellipsePath(ctx: Ctx, x: number, y: number, rx: number, ry: number, rot = 0): void {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, Math.PI * 2);
}

export function roundRectPath(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export function polyPath(ctx: Ctx, pts: number[]): void {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.closePath();
}

/** Smooth closed blob through points (quadratic midpoints). */
export function blobPath(ctx: Ctx, pts: number[]): void {
  const n = pts.length / 2;
  ctx.beginPath();
  const mx = (i: number) => (pts[(i % n) * 2] + pts[((i + 1) % n) * 2]) / 2;
  const my = (i: number) => (pts[(i % n) * 2 + 1] + pts[((i + 1) % n) * 2 + 1]) / 2;
  ctx.moveTo(mx(n - 1), my(n - 1));
  for (let i = 0; i < n; i++) ctx.quadraticCurveTo(pts[i * 2], pts[i * 2 + 1], mx(i), my(i));
  ctx.closePath();
}

/** Fills the current path with a top-left lit radial gradient, then outlines it. */
export function shade(ctx: Ctx, base: number, cx: number, cy: number, r: number, outline = 2.2, hi = 0.45, lo = 0.4): void {
  const g = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.45, r * 0.05, cx, cy, r * 1.15);
  g.addColorStop(0, rgba(light(base, hi)));
  g.addColorStop(0.45, rgba(base));
  g.addColorStop(1, rgba(dark(base, lo)));
  ctx.fillStyle = g;
  ctx.fill();
  if (outline > 0) {
    ctx.lineWidth = outline;
    ctx.strokeStyle = rgba(P.ink);
    ctx.stroke();
  }
}

/** Vertical gradient fill + outline for the current path. */
export function vshade(ctx: Ctx, top: number, bottom: number, y0: number, y1: number, outline = 2.2): void {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, rgba(top));
  g.addColorStop(1, rgba(bottom));
  ctx.fillStyle = g;
  ctx.fill();
  if (outline > 0) {
    ctx.lineWidth = outline;
    ctx.strokeStyle = rgba(P.ink);
    ctx.stroke();
  }
}

/** Glossy ball: shaded sphere with a specular highlight. */
export function ball(ctx: Ctx, x: number, y: number, r: number, color: number, outline = 2.2): void {
  ellipsePath(ctx, x, y, r, r);
  shade(ctx, color, x, y, r, outline);
  gloss(ctx, x, y, r);
}

export function oval(ctx: Ctx, x: number, y: number, rx: number, ry: number, color: number, outline = 2.2): void {
  ellipsePath(ctx, x, y, rx, ry);
  shade(ctx, color, x, y, Math.max(rx, ry), outline);
}

/** Soft white specular streak (top-left). */
export function gloss(ctx: Ctx, x: number, y: number, r: number, a = 0.75): void {
  ellipsePath(ctx, x - r * 0.38, y - r * 0.42, r * 0.36, r * 0.2, -0.6);
  ctx.fillStyle = rgba(P.cream, a);
  ctx.fill();
  ellipsePath(ctx, x - r * 0.08, y - r * 0.62, r * 0.09, r * 0.07);
  ctx.fillStyle = rgba(P.cream, a * 0.9);
  ctx.fill();
}

/** Rim light along the lower-right edge of a circle-ish shape. */
export function rim(ctx: Ctx, x: number, y: number, r: number, color: number = P.cream, a = 0.35): void {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r * 0.86, 0.1, 1.5);
  ctx.lineWidth = r * 0.12;
  ctx.strokeStyle = rgba(color, a);
  ctx.stroke();
  ctx.restore();
}

/** Soft radial glow (additive-looking halo). */
export function glow(ctx: Ctx, x: number, y: number, r: number, color: number, a = 0.7): void {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(color, a));
  g.addColorStop(0.4, rgba(color, a * 0.45));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

/** Soft elliptical drop shadow. */
export function dropShadow(ctx: Ctx, x: number, y: number, rx: number, ry: number, a = 0.35): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, ry / rx);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, rgba(P.ink, a));
  g.addColorStop(0.6, rgba(P.ink, a * 0.6));
  g.addColorStop(1, rgba(P.ink, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, rx, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function star(ctx: Ctx, x: number, y: number, r: number, inner: number, points = 5, rot = -Math.PI / 2): void {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const rr = i % 2 === 0 ? r : inner;
    const a = rot + (i * Math.PI) / points;
    if (i === 0) ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    else ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
}

export function fillOutline(ctx: Ctx, color: number, outline = 2.2, alpha = 1): void {
  ctx.fillStyle = rgba(color, alpha);
  ctx.fill();
  if (outline > 0) {
    ctx.lineWidth = outline;
    ctx.strokeStyle = rgba(P.ink);
    ctx.stroke();
  }
}

export function line(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, w: number, color: number, outline = 2): void {
  if (outline > 0) {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.lineWidth = w + outline * 2;
    ctx.strokeStyle = rgba(P.ink);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.lineWidth = w;
  ctx.strokeStyle = rgba(color);
  ctx.stroke();
}

/**
 * Big glossy anime eye. `look` shifts the iris toward the facing direction.
 * The iris uses a vertical gradient from the iris colour to a dark shade with
 * two sparkle highlights.
 */
export function animeEye(ctx: Ctx, x: number, y: number, w: number, h: number, iris: number, look = 0.25, lashes = true): void {
  // white
  ellipsePath(ctx, x, y, w, h);
  ctx.fillStyle = rgba(P.cream);
  ctx.fill();
  // iris
  const ix = x + w * look;
  const iy = y + h * 0.08;
  ellipsePath(ctx, ix, iy, w * 0.72, h * 0.86);
  const g = ctx.createLinearGradient(0, iy - h, 0, iy + h);
  g.addColorStop(0, rgba(dark(iris, 0.55)));
  g.addColorStop(0.55, rgba(iris));
  g.addColorStop(1, rgba(light(iris, 0.45)));
  ctx.fillStyle = g;
  ctx.fill();
  // pupil
  ellipsePath(ctx, ix, iy + h * 0.05, w * 0.34, h * 0.42);
  ctx.fillStyle = rgba(P.ink);
  ctx.fill();
  // sparkles
  ellipsePath(ctx, ix - w * 0.28, iy - h * 0.38, w * 0.26, h * 0.22);
  ctx.fillStyle = rgba(P.cream);
  ctx.fill();
  ellipsePath(ctx, ix + w * 0.26, iy + h * 0.36, w * 0.12, h * 0.1);
  ctx.fill();
  // outline + upper lash line
  ellipsePath(ctx, x, y, w, h);
  ctx.lineWidth = 1.3;
  ctx.strokeStyle = rgba(P.ink);
  ctx.stroke();
  if (lashes) {
    ctx.beginPath();
    ctx.ellipse(x, y, w * 1.04, h * 1.02, 0, Math.PI * 1.08, Math.PI * 1.92);
    ctx.lineWidth = 2.2;
    ctx.stroke();
  }
}

/** Rosy cheek blush. */
export function blush(ctx: Ctx, x: number, y: number, r: number): void {
  glow(ctx, x, y, r, P.berry, 0.45);
}

import Phaser from 'phaser';
import { TEX_RES } from '../config/layout';
import { PALETTE as P } from '../config/palette';
import { canvasTexture, dark, light, rgba, roundRectPath, type Ctx } from '../art/paint';

/**
 * Static UI (panels, bars, button faces) is painted once with Canvas 2D and
 * cached as a texture. Images are far cheaper per frame than live Graphics,
 * and canvas gives real gradients for a polished look.
 */
export function bakeCanvas(scene: Phaser.Scene, key: string, w: number, h: number, draw: (ctx: Ctx) => void): string {
  canvasTexture(scene, key, w, h, draw);
  return key;
}

/** Bakes a drawing over the region (x, y, w, h) - drawing uses local coords - and places it as an Image. */
export function bakeCanvasImage(scene: Phaser.Scene, key: string, x: number, y: number, w: number, h: number, draw: (ctx: Ctx) => void): Phaser.GameObjects.Image {
  bakeCanvas(scene, key, w, h, draw);
  return scene.add.image(x, y, key).setOrigin(0).setScale(1 / TEX_RES);
}

/** Jewel-toned panel: plum gradient body, gold double rim, top sheen and corner studs. */
export function drawPanelCanvas(c: Ctx, x: number, y: number, w: number, h: number, radius = 18, alpha = 0.9): void {
  // drop shadow
  roundRectPath(c, x + 3, y + 6, w, h, radius);
  c.fillStyle = rgba(P.ink, 0.4);
  c.fill();
  roundRectPath(c, x, y, w, h, radius);
  const g = c.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, rgba(mix2(P.arcane, P.ink, 0.62), alpha));
  g.addColorStop(1, rgba(mix2(P.arcane, P.ink, 0.85), alpha));
  c.fillStyle = g;
  c.fill();
  // sheen
  roundRectPath(c, x + 6, y + 6, w - 12, Math.min(34, h * 0.3), radius - 6);
  const s = c.createLinearGradient(0, y + 6, 0, y + 40);
  s.addColorStop(0, rgba(P.cream, 0.14));
  s.addColorStop(1, rgba(P.cream, 0));
  c.fillStyle = s;
  c.fill();
  // rims
  roundRectPath(c, x + 1.5, y + 1.5, w - 3, h - 3, radius - 1);
  c.lineWidth = 3;
  const rg = c.createLinearGradient(0, y, 0, y + h);
  rg.addColorStop(0, rgba(light(P.gold, 0.35)));
  rg.addColorStop(1, rgba(dark(P.gold, 0.3)));
  c.strokeStyle = rg;
  c.stroke();
  roundRectPath(c, x + 7, y + 7, w - 14, h - 14, Math.max(4, radius - 7));
  c.lineWidth = 1;
  c.strokeStyle = rgba(P.gold, 0.35);
  c.stroke();
  const stud = (cx: number, cy: number) => {
    c.beginPath();
    c.arc(cx, cy, 5, 0, Math.PI * 2);
    c.fillStyle = rgba(P.ink);
    c.fill();
    const sg = c.createRadialGradient(cx - 1.2, cy - 1.2, 0.5, cx, cy, 4);
    sg.addColorStop(0, rgba(P.cream));
    sg.addColorStop(0.4, rgba(P.gold));
    sg.addColorStop(1, rgba(dark(P.gold, 0.4)));
    c.beginPath();
    c.arc(cx, cy, 3.6, 0, Math.PI * 2);
    c.fillStyle = sg;
    c.fill();
  };
  const i = Math.min(radius * 0.5, 10);
  stud(x + i, y + i);
  stud(x + w - i, y + i);
  stud(x + i, y + h - i);
  stud(x + w - i, y + h - i);
}

export function drawTopBar(c: Ctx, w: number, h: number, pad = 0): void {
  const g = c.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, rgba(mix2(P.arcane, P.ink, 0.7), 0.97));
  g.addColorStop(1, rgba(mix2(P.arcane, P.ink, 0.86), 0.97));
  c.fillStyle = g;
  c.fillRect(0, 0, w, h);
  const shadow = c.createLinearGradient(0, h, 0, h + 8);
  shadow.addColorStop(0, rgba(P.ink, 0.5));
  shadow.addColorStop(1, rgba(P.ink, 0));
  c.fillStyle = shadow;
  c.fillRect(0, h, w, 8);
  // gold edge
  c.fillStyle = rgba(P.gold);
  c.fillRect(0, h - 3, w, 3);
  c.fillStyle = rgba(light(P.gold, 0.5), 0.8);
  c.fillRect(0, h - 3, w, 1);
  // resource chips (content row sits `pad` px lower on tall screens)
  c.translate(0, pad);
  const chip = (x: number, cw: number) => {
    roundRectPath(c, x, 12, cw, 44, 22);
    c.fillStyle = rgba(P.ink, 0.65);
    c.fill();
    c.lineWidth = 2;
    c.strokeStyle = rgba(P.gold, 0.6);
    c.stroke();
    roundRectPath(c, x + 4, 15, cw - 8, 16, 8);
    c.fillStyle = rgba(P.cream, 0.07);
    c.fill();
  };
  chip(12, 160);
  chip(176, 124);
  chip(304, 160);
  // divider under the info row
  c.fillStyle = rgba(P.cream, 0.08);
  c.fillRect(16, 64, w - 32, 1);
  c.translate(0, -pad);
}

export function drawDock(c: Ctx, w: number, h: number): void {
  const top = 8;
  const shadow = c.createLinearGradient(0, 0, 0, top);
  shadow.addColorStop(0, rgba(P.ink, 0));
  shadow.addColorStop(1, rgba(P.ink, 0.5));
  c.fillStyle = shadow;
  c.fillRect(0, 0, w, top);
  const g = c.createLinearGradient(0, top, 0, h);
  g.addColorStop(0, rgba(mix2(P.arcane, P.ink, 0.72)));
  g.addColorStop(1, rgba(mix2(P.arcane, P.ink, 0.9)));
  c.fillStyle = g;
  c.fillRect(0, top, w, h - top);
  c.fillStyle = rgba(P.gold);
  c.fillRect(0, top, w, 3);
  c.fillStyle = rgba(light(P.gold, 0.5), 0.8);
  c.fillRect(0, top + 2, w, 1);
  // ornamental pattern
  c.globalAlpha = 0.06;
  c.fillStyle = rgba(P.cream);
  for (let x = 20; x < w; x += 40) {
    for (let y = top + 24; y < h; y += 40) {
      c.beginPath();
      c.moveTo(x, y - 5);
      c.lineTo(x + 5, y);
      c.lineTo(x, y + 5);
      c.lineTo(x - 5, y);
      c.closePath();
      c.fill();
    }
  }
  c.globalAlpha = 1;
}

/** Glossy button face for a given size, colour and state. */
export function drawButtonFace(c: Ctx, w: number, h: number, pad: number, r: number, face: number, state: 'normal' | 'hover' | 'pressed' | 'disabled', toggled: boolean): void {
  const x = pad;
  const lift = state === 'pressed' ? 2 : 0;
  // base lip
  roundRectPath(c, x, pad + 4, w, h, r);
  c.fillStyle = rgba(P.ink, 0.6);
  c.fill();
  if (state === 'disabled') {
    roundRectPath(c, x, pad, w, h, r);
    c.fillStyle = rgba(mix2(P.ink, P.stone, 0.12));
    c.fill();
    c.lineWidth = 2;
    c.strokeStyle = rgba(P.stone, 0.25);
    c.stroke();
    return;
  }
  const f = state === 'hover' ? light(face, 0.12) : face;
  roundRectPath(c, x, pad + lift, w, h, r);
  c.fillStyle = rgba(dark(f, 0.45));
  c.fill();
  roundRectPath(c, x + 2, pad + lift + 2, w - 4, h - 5, r - 2);
  const g = c.createLinearGradient(0, pad + lift, 0, pad + lift + h);
  g.addColorStop(0, rgba(light(f, 0.28)));
  g.addColorStop(0.5, rgba(f));
  g.addColorStop(1, rgba(dark(f, 0.25)));
  c.fillStyle = g;
  c.fill();
  if (state !== 'pressed') {
    roundRectPath(c, x + 7, pad + lift + 4, w - 14, Math.max(4, h * 0.36), Math.max(2, r - 6));
    const s = c.createLinearGradient(0, pad + 4, 0, pad + 4 + h * 0.36);
    s.addColorStop(0, rgba(P.cream, state === 'hover' ? 0.45 : 0.32));
    s.addColorStop(1, rgba(P.cream, 0.02));
    c.fillStyle = s;
    c.fill();
  }
  roundRectPath(c, x + 1, pad + lift + 1, w - 2, h - 2, r);
  c.lineWidth = toggled ? 3.5 : 2;
  c.strokeStyle = toggled ? rgba(P.gold) : rgba(light(P.gold, 0.2), state === 'hover' ? 0.95 : 0.6);
  c.stroke();
  if (toggled) {
    roundRectPath(c, x - 2, pad + lift - 2, w + 4, h + 4, r + 2);
    c.lineWidth = 2;
    c.strokeStyle = rgba(P.cream, 0.6);
    c.stroke();
  }
}

function mix2(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  return (Math.round(ar + (br - ar) * t) << 16) | (Math.round(ag + (bg - ag) * t) << 8) | Math.round(ab + (bb - ab) * t);
}

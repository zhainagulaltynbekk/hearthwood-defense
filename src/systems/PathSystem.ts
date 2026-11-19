import { GRID_COLS, GRID_ROWS, MAP_X, MAP_Y, TILE } from '../config/layout';
import type { MapDef } from '../maps/map1';

export const TileKind = {
  Grass: 0,
  Path: 1,
  Water: 2,
  Tree: 3,
  Rock: 4,
  Flower: 5,
  Mushroom: 6,
} as const;
export type TileKind = (typeof TileKind)[keyof typeof TileKind];

export interface Vec2 {
  x: number;
  y: number;
}

/**
 * Owns the static map: tile kinds, which tiles are buildable/occupied, and the
 * enemy path as a polyline with distance-based lookups (no allocations).
 */
export class PathSystem {
  readonly tiles: Uint8Array;
  private readonly occupied: Uint8Array;
  /** Waypoints in world pixels. */
  readonly points: Vec2[];
  private readonly segLen: number[];
  private readonly segStart: number[];
  private readonly segDirX: number[];
  private readonly segDirY: number[];
  readonly totalLength: number;

  constructor(map: MapDef) {
    this.tiles = new Uint8Array(GRID_COLS * GRID_ROWS);
    this.occupied = new Uint8Array(GRID_COLS * GRID_ROWS);

    for (let r = 0; r < GRID_ROWS; r++) {
      const row = map.layout[r] ?? '';
      for (let c = 0; c < GRID_COLS; c++) {
        const ch = row.charAt(c);
        let kind: TileKind = TileKind.Grass;
        if (ch === 'w') kind = TileKind.Water;
        else if (ch === 'T') kind = TileKind.Tree;
        else if (ch === 'R') kind = TileKind.Rock;
        else if (ch === 'F') kind = TileKind.Flower;
        else if (ch === 'M') kind = TileKind.Mushroom;
        this.tiles[r * GRID_COLS + c] = kind;
      }
    }

    this.points = map.waypoints.map(([c, r]) => ({ x: MAP_X + (c + 0.5) * TILE, y: MAP_Y + (r + 0.5) * TILE }));

    // Mark path tiles along each axis-aligned segment.
    for (let i = 0; i < map.waypoints.length - 1; i++) {
      const [c0, r0] = map.waypoints[i];
      const [c1, r1] = map.waypoints[i + 1];
      const steps = Math.ceil(Math.max(Math.abs(c1 - c0), Math.abs(r1 - r0)) * 4);
      for (let s = 0; s <= steps; s++) {
        const t = steps === 0 ? 0 : s / steps;
        const c = Math.round(c0 + (c1 - c0) * t);
        const r = Math.round(r0 + (r1 - r0) * t);
        if (this.inGrid(c, r)) this.tiles[r * GRID_COLS + c] = TileKind.Path;
      }
    }

    this.segLen = [];
    this.segStart = [];
    this.segDirX = [];
    this.segDirY = [];
    let acc = 0;
    for (let i = 0; i < this.points.length - 1; i++) {
      const a = this.points[i];
      const b = this.points[i + 1];
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      this.segStart.push(acc);
      this.segLen.push(len);
      this.segDirX.push((b.x - a.x) / len);
      this.segDirY.push((b.y - a.y) / len);
      acc += len;
    }
    this.totalLength = acc;
  }

  inGrid(c: number, r: number): boolean {
    return c >= 0 && r >= 0 && c < GRID_COLS && r < GRID_ROWS;
  }

  tileAt(c: number, r: number): TileKind {
    return this.tiles[r * GRID_COLS + c] as TileKind;
  }

  isBuildable(c: number, r: number): boolean {
    return this.inGrid(c, r) && this.tiles[r * GRID_COLS + c] === TileKind.Grass && this.occupied[r * GRID_COLS + c] === 0;
  }

  setOccupied(c: number, r: number, value: boolean): void {
    if (this.inGrid(c, r)) this.occupied[r * GRID_COLS + c] = value ? 1 : 0;
  }

  worldToTile(x: number, y: number, out: Vec2): Vec2 {
    out.x = Math.floor((x - MAP_X) / TILE);
    out.y = Math.floor((y - MAP_Y) / TILE);
    return out;
  }

  tileCenter(c: number, r: number, out: Vec2): Vec2 {
    out.x = MAP_X + (c + 0.5) * TILE;
    out.y = MAP_Y + (r + 0.5) * TILE;
    return out;
  }

  /** Writes the point at `dist` along the path into `out`; returns the segment index. */
  pointAt(dist: number, out: Vec2): number {
    const n = this.segLen.length;
    if (dist <= 0) {
      out.x = this.points[0].x;
      out.y = this.points[0].y;
      return 0;
    }
    for (let i = 0; i < n; i++) {
      const start = this.segStart[i];
      const len = this.segLen[i];
      if (dist <= start + len || i === n - 1) {
        const t = Math.min(dist - start, len);
        out.x = this.points[i].x + this.segDirX[i] * t;
        out.y = this.points[i].y + this.segDirY[i] * t;
        return i;
      }
    }
    return n - 1;
  }

  segmentDirX(i: number): number {
    return this.segDirX[i];
  }

  segmentDirY(i: number): number {
    return this.segDirY[i];
  }
}

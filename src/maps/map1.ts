/**
 * Map 1 - "Blossom Hollow" (portrait, 10 x 13 tiles of 72 px).
 *
 * Legend:
 *   .  buildable grass
 *   #  path (informational - the path tiles are derived from the waypoints)
 *   w  water (not buildable, animated shimmer)
 *   T  tree (oak, pine or cherry blossom; blocks building)
 *   R  rock (blocks building)
 *   F  flower bush (blocks building)
 *   M  mushrooms (blocks building)
 */
export interface MapDef {
  name: string;
  layout: readonly string[];
  /** Path waypoints in tile coordinates (tile centers). May start/end off-grid. */
  waypoints: readonly (readonly [number, number])[];
  /** Seed for deterministic decoration scattering. */
  seed: number;
}

export const MAP1: MapDef = {
  name: 'Blossom Hollow',
  seed: 2024,
  layout: [
    'TT#..T..TT',
    'T.#....M.T',
    '..######..',
    'F......#.R',
    '..T....#..',
    'ww..####..',
    'ww..#...F.',
    'w...#..T..',
    '..R.#####.',
    'M.......#T',
    'T..F....#.',
    '#########.',
    'TT.www.MTT',
  ],
  waypoints: [
    [2, -1.4],
    [2, 2],
    [7, 2],
    [7, 5],
    [4, 5],
    [4, 8],
    [8, 8],
    [8, 11],
    [-1.4, 11],
  ],
};

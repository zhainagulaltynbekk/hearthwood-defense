/**
 * Map 1 - "Mossy Hollow".
 *
 * Legend:
 *   .  buildable grass
 *   #  path (informational - the path tiles are derived from the waypoints)
 *   w  water (not buildable, animated shimmer)
 *   T  tree (blocks building)
 *   R  rock (blocks building)
 *   F  flower bush (blocks building)
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
  name: 'Mossy Hollow',
  seed: 1337,
  layout: [
    'TT...F...TT.......TT',
    'T..........R#####..T',
    '####........#...#..R',
    'T..#..F.....#...#...',
    '...#....#####...#.T.',
    '...#.ww.#.......#...',
    'T..#.ww.#..R....#...',
    '...#....#.......#.F.',
    '...#..F.#.......###.',
    'TT.######..www....#.',
    'T.......R.wwwww...#T',
    'TT..F...wwwwwww...#T',
  ],
  waypoints: [
    [-1.2, 2],
    [3, 2],
    [3, 9],
    [8, 9],
    [8, 4],
    [12, 4],
    [12, 1],
    [16, 1],
    [16, 8],
    [18, 8],
    [18, 12.8],
  ],
};

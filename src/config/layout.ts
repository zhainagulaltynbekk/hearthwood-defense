/** Logical (world) resolution. All game coordinates use this space. */
export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;

/** True on phones / tablets (coarse pointer): enables tap-to-preview building and touch-friendly hints. */
export const IS_TOUCH =
  typeof window !== 'undefined' && (navigator.maxTouchPoints > 0 || 'ontouchstart' in window) && window.matchMedia('(pointer: coarse)').matches;

/**
 * Render resolution multiplier for crisp output on high-DPI screens.
 * The canvas is GAME_WIDTH * RENDER_SCALE wide and every camera zooms by it,
 * so world coordinates stay 1280x720 while pixels stay sharp. Phones get a
 * lower cap: their GPUs pay for every pixel the bloom / vignette passes touch.
 */
export const RENDER_SCALE = Math.max(1, Math.min(IS_TOUCH ? 1.5 : 2, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1));

/** Generated textures are drawn at this multiple and displayed at 1 / TEX_RES. */
export const TEX_RES = 2;

/** Map grid. */
export const TILE = 56;
export const GRID_COLS = 20;
export const GRID_ROWS = 12;
export const MAP_X = 0;
export const MAP_Y = 48;
export const MAP_WIDTH = GRID_COLS * TILE; // 1120
export const MAP_HEIGHT = GRID_ROWS * TILE; // 672

/** UI regions (never overlap the map grid). */
export const TOP_BAR_HEIGHT = MAP_Y;
export const SIDEBAR_X = MAP_X + MAP_WIDTH;
export const SIDEBAR_WIDTH = GAME_WIDTH - SIDEBAR_X; // 160

/** Depth bands. Entities inside the world band sort by their y position. */
export const DEPTH = {
  terrain: 0,
  water: 1,
  groundFx: 5,
  rangeCircle: 8,
  placement: 9,
  worldBase: 10, // + y for props, towers, ground enemies
  flying: 2000,
  projectile: 2500,
  fx: 3000,
  healthBars: 3500,
  floatingText: 4000,
} as const;

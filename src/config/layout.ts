/**
 * Portrait layout. World coordinates are always 720 x 1280; the canvas is
 * rendered at RENDER_SCALE and every camera zooms by it so pixels stay sharp.
 *
 *   0    ..  104   top HUD (gold, lives, wave, speed / pause / sound)
 *   104  .. 1040   map: 10 x 13 tiles of 72 px
 *   1040 .. 1280   bottom dock (tower shop / selected tower panel, wave button)
 */
export const GAME_WIDTH = 720;
/** Design height; taller phones get extra world height so the game fills the screen (no black bars). */
export const BASE_HEIGHT = 1280;
const ASPECT = typeof window !== 'undefined' ? window.innerHeight / Math.max(1, window.innerWidth) : 16 / 9;
/** Extra world height on screens taller than 9:16 (split between the top bar and the bottom dock). */
export const EXTRA_HEIGHT = Math.max(0, Math.min(420, Math.round(GAME_WIDTH * ASPECT) - BASE_HEIGHT));
export const GAME_HEIGHT = BASE_HEIGHT + EXTRA_HEIGHT;
/** How far the HUD contents move down (the rest of the extra height goes to the dock). */
export const TOP_PAD = Math.round(EXTRA_HEIGHT * 0.45);

/** True on phones / tablets (coarse pointer): enables tap-to-preview building and touch-friendly hints. */
export const IS_TOUCH =
  typeof window !== 'undefined' && (navigator.maxTouchPoints > 0 || 'ontouchstart' in window) && window.matchMedia('(pointer: coarse)').matches;

/** Render resolution multiplier (device pixel ratio, capped at 2). */
export const RENDER_SCALE = Math.max(1, Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1));

/** Generated textures are drawn at this multiple and displayed at 1 / TEX_RES. */
export const TEX_RES = 2;

/** Map grid. */
export const TILE = 72;
export const GRID_COLS = 10;
export const GRID_ROWS = 13;
export const MAP_X = 0;
export const MAP_Y = 104 + TOP_PAD;
export const MAP_WIDTH = GRID_COLS * TILE; // 720
export const MAP_HEIGHT = GRID_ROWS * TILE; // 936

/** UI regions (never overlap the map grid). */
export const TOP_BAR_HEIGHT = MAP_Y;
export const DOCK_Y = MAP_Y + MAP_HEIGHT; // 1040
export const DOCK_HEIGHT = GAME_HEIGHT - DOCK_Y; // 240

/** Depth bands. Entities inside the world band sort by their y position. */
export const DEPTH = {
  terrain: 0,
  water: 1,
  groundFx: 5,
  rangeCircle: 8,
  placement: 9,
  worldBase: 10, // + y for props, towers, ground enemies
  flying: 3000,
  projectile: 3500,
  fx: 4000,
  healthBars: 4500,
  floatingText: 5000,
} as const;

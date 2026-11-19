/**
 * The one cohesive "cozy fantasy" palette. Every texture, UI element and
 * particle in the game is drawn from these 12 colors; shading is done by
 * layering them with alpha (ink for shadow, cream for highlight).
 */
export const PALETTE = {
  ink: 0x2a2238, // outlines, shadows, UI panels
  pine: 0x3f7a4a, // dark foliage, deep grass
  grass: 0x77b255, // base grass
  leaf: 0xb8d66a, // light grass, highlights on foliage
  stone: 0xc8b79c, // path, rocks, masonry
  wood: 0x8f5a3c, // timber, bark, cannon wood
  water: 0x3f8fbf, // water, frost tower body
  ice: 0xa8e4f0, // frost effects, water shimmer
  gold: 0xf2c14e, // coins, trims, archer accents
  cream: 0xfff4dc, // highlights, text
  berry: 0xd8576b, // enemies, damage, danger
  arcane: 0x8e6bd8, // mage, magic, dusk
} as const;

export type PaletteKey = keyof typeof PALETTE;

/** CSS hex string for a palette color (used by Text objects). */
export function css(color: number): string {
  return '#' + color.toString(16).padStart(6, '0');
}

/** Fredoka is bundled with the build (@fontsource), so it works offline and on every phone. */
export const FONT_FAMILY = '"Fredoka", "Trebuchet MS", "Segoe UI", system-ui, sans-serif';

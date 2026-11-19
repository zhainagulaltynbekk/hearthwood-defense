/**
 * One cohesive, vivid "storybook anime" palette. Every texture, UI element and
 * particle is drawn from these 12 colors; shading uses gradients and blends
 * between them (see art/paint.ts `mix`), never outside hues.
 */
export const PALETTE = {
  ink: 0x1e1633, // outlines, deep shadow, UI panels
  pine: 0x1f7a52, // dark foliage, deep grass
  grass: 0x5cc24f, // base grass
  leaf: 0xc6ef6e, // light grass, highlights on foliage
  stone: 0xe4d3b0, // path, rocks, masonry
  wood: 0xa85b32, // timber, bark, warm hair
  water: 0x2a86e0, // water, frost body
  ice: 0x8ff1ff, // frost effects, shimmer
  gold: 0xffc22e, // coins, trims, blonde hair
  cream: 0xfff8ea, // highlights, skin base, text
  berry: 0xff4a6e, // slimes, damage, danger, blush
  arcane: 0x9a5bff, // mage, magic, dusk
} as const;

export type PaletteKey = keyof typeof PALETTE;

/** CSS hex string for a palette color (used by Text objects). */
export function css(color: number): string {
  return '#' + color.toString(16).padStart(6, '0');
}

/** Fredoka is bundled with the build (@fontsource), so it works offline and on every phone. */
export const FONT_FAMILY = '"Fredoka", "Trebuchet MS", "Segoe UI", system-ui, sans-serif';

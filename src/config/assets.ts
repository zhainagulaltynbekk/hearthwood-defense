/**
 * Optional external sprite pack switch - the ONE place to turn it on.
 *
 * By default every texture is generated in code (src/art/TextureFactory.ts).
 * To use a sprite pack instead (e.g. a CC0 pack from kenney.nl):
 *   1. Put the image files in public/assets/.
 *   2. Set USE_SPRITE_PACK to true.
 *   3. Map the texture keys you want to replace below. Keys you do not list
 *      keep their generated texture, so you can replace art gradually.
 *
 * `scale` is the display scale for the image. Generated textures are drawn at
 * 2x and shown at 0.5, so a 64 px image meant to fill one 56 px tile would use
 * scale 56 / 64 = 0.875. Turret images must point to the right (angle 0).
 *
 * Useful keys: tree_0, tree_1, rock, bush, enemy_basic, enemy_fast,
 * enemy_armored, enemy_flying_0, enemy_flying_1, enemy_boss,
 * tower_<type>_base_<1..3>, tower_<type>_turret_<1..3>, proj_arrow,
 * proj_cannonball, proj_frostbolt.
 */
export const USE_SPRITE_PACK = false;

export interface SpritePackEntry {
  key: string;
  /** Path relative to public/, e.g. 'assets/towerDefense_tile249.png'. */
  file: string;
  scale: number;
}

export const SPRITE_PACK: readonly SpritePackEntry[] = [
  // Example: { key: 'enemy_basic', file: 'assets/towerDefense_tile245.png', scale: 0.6 },
];

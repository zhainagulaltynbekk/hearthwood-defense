# Hearthwood Defense

A cozy-fantasy 2D tower defense game for the browser, built with TypeScript (strict), Vite and Phaser 4 (WebGL).
Every texture is generated in code at boot, and every sound is synthesised with the Web Audio API, so the
project ships no image or audio files.

## Run it

```
npm install
npm run dev        # dev server (http://localhost:5173, or the next free port)
npm run build      # type check + production build into dist/
npm run preview    # serve dist/ locally
npm run typecheck  # type check only
```

`dist/` is plain static files (relative paths), so it can be hosted anywhere or opened through any static server.

Dev-only extras: `window.__td` exposes the running GameScene in the console, and `?stress` on the URL floods the
map with 200 enemies to check performance.

## Play on your phone (GitHub Pages)

The repo includes `.github/workflows/deploy.yml`. After pushing to a GitHub repository's `main` branch:

1. On GitHub open **Settings > Pages** and set **Source** to **GitHub Actions** (one time).
2. Every push builds the game and publishes it at `https://<your-user>.github.io/<repo-name>/`.
3. Open that link in Chrome on Android. Hold the phone sideways; tapping **Play** goes full screen.
   Use Chrome's menu > **Add to Home screen** to install it like an app (full screen, landscape, own icon).

On touch screens: tap a tower card, tap a tile to preview the tower and its range, tap the same tile again to build.
Tap a built tower to upgrade, sell or change targeting. Tap the active card again to cancel.

## Controls

| Input | Action |
| --- | --- |
| Left click | Build (when a tower is selected in the shop), select a placed tower |
| Shift + click | Keep building the same tower |
| Right click / Esc | Cancel build / deselect (Esc also closes the pause menu) |
| 1-4 | Pick Archer / Cannon / Frost / Mage |
| Space | Start the first wave, or call the next wave early for bonus gold |
| F | Toggle 1x / 2x speed |
| P | Pause (pause menu has Resume / Restart / Main menu) |
| U / T / Del | Upgrade / cycle targeting / sell the selected tower |
| M | Mute (saved) |

## Project layout

```
src/
  main.ts            Phaser config: WebGL, Scale.FIT, 1280x720 world rendered at devicePixelRatio
  config/            balance.ts (towers, enemies, economy), waves.ts, palette.ts, layout.ts, assets.ts
  scenes/            Boot, Preload, Menu, Game, UI (runs on top of Game), GameOver
  entities/          Tower, Enemy (pooled), Projectile (pooled)
  systems/           WaveManager, TargetingSystem, EconomySystem, PathSystem, AudioManager,
                     EffectsManager, SaveData, GameEvents
  art/               TextureFactory (all procedural textures + bitmap number font), rng
  maps/              map1.ts (tile layout + path waypoints)
  ui/                Button, bake (static vector UI baked to cached textures)
```

### Using a sprite pack instead of generated art

Put images in `public/assets/`, set `USE_SPRITE_PACK = true` in `src/config/assets.ts` and map texture keys to files
there. Keys you don't map keep their generated texture.

## Features

- **Art**: one 12-colour palette (`palette.ts`); layered, outlined, soft-shaded sprites generated with Phaser
  Graphics at 2x and displayed at 0.5x for crisp high-DPI output. Baked terrain with grass variation, a cobbled
  winding path, seamless water with shore and shimmer, lily pads, depth-sorted swaying trees, rocks and flower
  bushes with soft drop shadows.
- **Towers**: base + smoothly eased rotating turret, distinct silhouettes, new art for every upgrade level (pips,
  crenellations, banners, extra barrels/crystals), recoil, glow filter at max level, range circle on hover and
  selection, green/red placement ghost that snaps to tiles with an eased slide.
- **Enemies**: goblin, fox scout (fast), shell knight (armored), bat wisp (flying, 2-frame wing flap), ogre chief
  boss every 5th wave. Walk bobbing, fade-in at the entrance, white hit flash, health bars, ice tint + ice
  particles while slowed, death burst then fade/scale-down.
- **Effects**: particle muzzle flashes, projectile trails, impact sparks, cannon explosions with debris and
  shockwave rings, jittering chain-lightning arcs, floating damage and gold numbers, camera shake on big hits,
  boss arrivals and leaks, camera bloom, vignette, and a day-to-dusk colour grade that deepens across the waves.
  Ambient pollen motes drift over the meadow.
- **Gameplay**: 4 towers x 3 levels, sell for 70%, First / Strongest / Closest targeting, physical vs. magic
  damage with armour / magic resist, cannons can't hit flyers, 20 hand-tuned waves, gold per kill, wave-start
  bonus, early-call bonus, lives, victory and defeat.
- **UI**: top bar (animated gold counter, lives, wave, countdown, call-wave button, speed/pause/mute), right
  sidebar shop with costs and hotkeys, tower info panel with current stats, next-level preview, kills, targeting,
  upgrade cost and sell value. The map grid never sits under the UI. Hover, pressed, disabled and toggled states
  on every button. Menu, pause, game over and victory screens; best wave saved in localStorage.
- **Audio**: synthesised shots per tower, hits, explosions, deaths, boss death, place, upgrade, sell, wave horn,
  boss horn, life lost, UI clicks, victory and defeat jingles. Mute is saved.
- **Performance**: pooled enemies, projectiles and floating numbers (bitmap font, so updates never re-render a
  canvas), sprite-based health bars, no allocations in the per-frame loops, static vector UI baked to textures.
  Measured ~58-60 FPS with 280 enemies and 16 towers on an Intel UHD iGPU. If the frame rate stays below 48 FPS
  the bloom pass switches itself off.
- Game speed 2x scales the simulation, tweens, timers and particles; pause freezes the whole game scene while the
  UI stays live.

## Balance values you'll most likely want to tune

All in `src/config/balance.ts` and `src/config/waves.ts`.

| Value | Where | Current |
| --- | --- | --- |
| Starting gold / lives | `ECONOMY.startGold`, `ECONOMY.startLives` | 250 / 20 |
| Sell refund | `ECONOMY.sellRatio` | 0.7 |
| Break between waves | `ECONOMY.waveBreak` | 14 s |
| Early-call bonus | `ECONOMY.earlyCallGoldPerSecond` | 2 gold per second skipped |
| Wave-start bonus | `ECONOMY.waveStartBonus` + `waveStartBonusPerWave` x wave | 20 + 4 x wave |
| Enemy HP growth | `hpScale` per wave in `WAVES` | 1.0 (w1) to 3.85 (w20) |
| Late-game gold per kill | `goldScale` per wave | 1.0 down to 0.75 |
| Tower build / upgrade costs | `TOWERS.<type>.levels[n].cost` | Archer 70/65/120, Cannon 120/105/180, Frost 90/80/140, Mage 150/130/210 |
| Tower damage / fire interval / range | `TOWERS.<type>.levels[n]` | e.g. Archer 12 dmg every 0.6 s, 150 px range |
| Cannon splash radius | `splashRadius` | 58 / 68 / 82 px |
| Frost slow | `slowFactor`, `slowDuration` | 40% for 1.8 s up to 60% for 2.6 s |
| Mage chains | `chainCount`, `chainFalloff`, `chainRange` | 2/3/5 jumps, x0.8-0.85 per jump |
| Enemy HP, speed, gold, armour | `ENEMIES` | e.g. Shell Knight 150 HP, 50% physical armour |
| Boss HP and lives cost | `ENEMIES.boss` | 1300 HP (x wave scale), costs 8 lives |

A scripted bot that builds 15 towers and upgrades them (without calling waves early) loses lives on wave 8
(fast + armored mix) and falls on the final three-boss wave, so the curve is meant to need more towers, good
placement and a sensible tower mix by the end.

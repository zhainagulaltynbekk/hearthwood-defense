import Phaser from 'phaser';
import '@fontsource/fredoka/latin-500.css';
import '@fontsource/fredoka/latin-700.css';
import { GAME_HEIGHT, GAME_WIDTH, RENDER_SCALE } from './config/layout';
import { PALETTE, css } from './config/palette';
import { AudioManager } from './systems/AudioManager';
import { BootScene } from './scenes/BootScene';
import { PreloadScene } from './scenes/PreloadScene';
import { MenuScene } from './scenes/MenuScene';
import { GameScene } from './scenes/GameScene';
import { UIScene } from './scenes/UIScene';
import { GameOverScene } from './scenes/GameOverScene';

const game = new Phaser.Game({
  type: Phaser.WEBGL,
  parent: 'game',
  // Render at device resolution; cameras zoom by RENDER_SCALE so the world stays 1280x720.
  width: GAME_WIDTH * RENDER_SCALE,
  height: GAME_HEIGHT * RENDER_SCALE,
  backgroundColor: css(PALETTE.ink),
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  render: {
    antialias: true,
    roundPixels: false,
    powerPreference: 'high-performance',
  },
  audio: { noAudio: true }, // all sound is synthesised by AudioManager
  banner: false,
  disableContextMenu: true,
  input: { activePointers: 2 },
  scene: [BootScene, PreloadScene, MenuScene, GameScene, UIScene, GameOverScene],
});

game.registry.set('audio', new AudioManager());

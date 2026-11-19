import Phaser from 'phaser';
import { fitCamera } from './sceneUtils';

/** First scene: sets up global input behaviour, then hands off to the preloader. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create(): void {
    fitCamera(this);
    this.input.mouse?.disableContextMenu();
    this.scene.start('PreloadScene');
  }
}

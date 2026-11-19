/** Event names emitted on GameScene.events and consumed by UIScene. */
export const GameEvents = {
  GoldChanged: 'gold-changed', // (gold: number, delta: number)
  LivesChanged: 'lives-changed', // (lives: number, delta: number)
  WaveChanged: 'wave-changed', // (waveNumber: number, totalWaves: number)
  WaveTimer: 'wave-timer', // (secondsLeft: number | null, canCallEarly: boolean)
  SelectionChanged: 'selection-changed', // (tower: Tower | null)
  BuildModeChanged: 'build-mode-changed', // (type: TowerType | null)
  TowerChanged: 'tower-changed', // (tower: Tower) - upgraded / target mode
  SpeedChanged: 'speed-changed', // (speed: number)
  PausedChanged: 'paused-changed', // (paused: boolean)
  GameEnded: 'game-ended', // (victory: boolean, waveReached: number)
  Toast: 'toast', // (message: string)
} as const;

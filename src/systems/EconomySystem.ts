import Phaser from 'phaser';
import { ECONOMY } from '../config/balance';
import { GameEvents } from './GameEvents';

/** Gold and lives bookkeeping. Emits change events on the owning scene's emitter. */
export class EconomySystem {
  private _gold: number = ECONOMY.startGold;
  private _lives: number = ECONOMY.startLives;

  constructor(private readonly events: Phaser.Events.EventEmitter) {}

  get gold(): number {
    return this._gold;
  }

  get lives(): number {
    return this._lives;
  }

  canAfford(cost: number): boolean {
    return this._gold >= cost;
  }

  spend(cost: number): boolean {
    if (cost > this._gold) return false;
    this._gold -= cost;
    this.events.emit(GameEvents.GoldChanged, this._gold, -cost);
    return true;
  }

  earn(amount: number): void {
    if (amount <= 0) return;
    this._gold += amount;
    this.events.emit(GameEvents.GoldChanged, this._gold, amount);
  }

  loseLives(amount: number): void {
    const before = this._lives;
    this._lives = Math.max(0, this._lives - amount);
    if (this._lives !== before) this.events.emit(GameEvents.LivesChanged, this._lives, this._lives - before);
  }

  /** Sell value for a tower with `invested` total gold spent on it. */
  sellValue(invested: number): number {
    return Math.floor(invested * ECONOMY.sellRatio);
  }
}

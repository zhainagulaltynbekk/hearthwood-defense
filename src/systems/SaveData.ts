/** Tiny localStorage wrapper. Every access is guarded: storage may be unavailable. */
const PREFIX = 'hearthwood-td:';

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(PREFIX + key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    window.localStorage.setItem(PREFIX + key, value);
  } catch {
    // storage blocked or full - the game works fine without it
  }
}

export const SaveData = {
  getBestWave(): number {
    const v = Number(read('bestWave'));
    return Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
  },
  /** Stores `wave` if it beats the record; returns true when it is a new record. */
  submitWave(wave: number): boolean {
    if (wave > this.getBestWave()) {
      write('bestWave', String(wave));
      return true;
    }
    return false;
  },
  getMuted(): boolean {
    return read('muted') === '1';
  },
  setMuted(muted: boolean): void {
    write('muted', muted ? '1' : '0');
  },
};

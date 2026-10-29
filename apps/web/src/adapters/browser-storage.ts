import type {CoreSnapshot} from '@ardesia/contracts';
import type {StorageAdapter} from '@ardesia/core';

export const STORAGE_KEY = 'ardesia-next.core.v1';

/** One snapshot is the only authoritative device store. Web Locks serializes writers. */
export class BrowserStorage implements StorageAdapter {
  #expected: string | null = null;
  async read(): Promise<unknown | null> {
    this.#expected = localStorage.getItem(STORAGE_KEY);
    return this.#expected === null ? null : JSON.parse(this.#expected) as unknown;
  }
  async write(snapshot: CoreSnapshot): Promise<void> {
    if(!navigator.locks) throw new Error('Questo browser non supporta il salvataggio protetto fra schede. Usa un browser aggiornato.');
    const value = JSON.stringify(snapshot);
    if(new TextEncoder().encode(value).length > 4 * 1024 * 1024) throw new Error('Spazio della preview esaurito. Esporta il lavoro prima di continuare.');
    await navigator.locks.request(`${STORAGE_KEY}.write`, async () => {
      if(localStorage.getItem(STORAGE_KEY) !== this.#expected) throw new Error('Il documento è cambiato in un’altra scheda. Ricarica prima di continuare.');
      localStorage.setItem(STORAGE_KEY, value);
      this.#expected = value;
    });
  }
}

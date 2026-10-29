import type { WriterSnapshot } from "./writer.api";

export const RECOVERY_DB = "papertrail-writer-recovery";
export const RECOVERY_STORE = "drafts";
export const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
export const MAX_DRAFTS = 100;
export interface RecoveryDraft extends WriterSnapshot {
  formatVersion: 1;
  accountId: string;
  documentId: string;
  sessionId: string;
  token: string;
  baseRevision: number;
  savedLocallyAt: number;
  lastKnownServerUpdatedAt: string;
}
export const recoveryKey = (
  draft: Pick<RecoveryDraft, "accountId" | "documentId" | "sessionId">,
) => [draft.accountId, draft.documentId, draft.sessionId];

/** No authentication data is stored. One latest snapshot per editing session prevents
 * another tab's successful save from erasing this tab's conflicted work. */
export class RecoveryStore {
  private open(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        settled = true;
        reject(new Error("Recovery storage timed out"));
      }, 1500);
      const fail = () => {
        clearTimeout(timer);
        settled = true;
        reject(new Error("Recovery storage unavailable"));
      };
      try {
        const request = indexedDB.open(RECOVERY_DB, 2);
        request.onupgradeneeded = () => {
          const store = request.result.objectStoreNames.contains(RECOVERY_STORE)
            ? request.transaction!.objectStore(RECOVERY_STORE)
            : request.result.createObjectStore(RECOVERY_STORE, {
                keyPath: ["accountId", "documentId", "sessionId"],
              });
          if (!store.indexNames.contains("document"))
            store.createIndex("document", ["accountId", "documentId"]);
          if (!store.indexNames.contains("savedLocallyAt"))
            store.createIndex("savedLocallyAt", "savedLocallyAt");
        };
        request.onerror = fail;
        request.onblocked = fail;
        request.onsuccess = () => {
          clearTimeout(timer);
          if (settled) request.result.close();
          else {
            settled = true;
            request.result.onversionchange = () => request.result.close();
            resolve(request.result);
          }
        };
      } catch {
        fail();
      }
    });
  }
  private async transaction<T>(
    mode: IDBTransactionMode,
    action: (store: IDBObjectStore, result: (value: T) => void) => void,
  ): Promise<T> {
    const db = await this.open();
    try {
      return await new Promise<T>((resolve, reject) => {
        const tx = db.transaction(RECOVERY_STORE, mode);
        let value: T;
        const timer = setTimeout(() => {
          try {
            tx.abort();
          } catch {
            /* Already finished. */
          }
          reject(new Error("Recovery storage timed out"));
        }, 1500);
        tx.oncomplete = () => {
          clearTimeout(timer);
          resolve(value);
        };
        tx.onabort = tx.onerror = () => {
          clearTimeout(timer);
          reject(new Error("Recovery storage unavailable"));
        };
        try {
          action(tx.objectStore(RECOVERY_STORE), (v) => {
            value = v;
          });
        } catch (error) {
          clearTimeout(timer);
          tx.abort();
          reject(error);
        }
      });
    } finally {
      db.close();
    }
  }
  async list(accountId: string, documentId: string): Promise<unknown[]> {
    await this.cleanup();
    return this.transaction("readonly", (store, done) => {
      const request = store.index("document").getAll([accountId, documentId]);
      request.onsuccess = () => done(request.result);
    });
  }
  async put(draft: RecoveryDraft): Promise<void> {
    if (JSON.stringify(draft).length > 1_000_000)
      throw new Error("Recovery snapshot exceeds local limit");
    await this.transaction<void>("readwrite", (store) => {
      store.put(draft);
    });
    await this.cleanup();
  }
  /** Compare-and-delete protects a newer write made after the recovery dialog opened. */
  remove(
    draft: Pick<
      RecoveryDraft,
      "accountId" | "documentId" | "sessionId" | "token"
    >,
  ): Promise<void> {
    return this.transaction("readwrite", (store) => {
      const request = store.get(recoveryKey(draft));
      request.onsuccess = () => {
        if (request.result?.token === draft.token)
          store.delete(recoveryKey(draft));
      };
    });
  }
  cleanup(now = Date.now()): Promise<void> {
    return this.transaction("readwrite", (store) => {
      // Scan timestamp keys only: cleanup never loads other documents' JSON.
      let count = 0;
      const indexedKeys = new Set<string>();
      const request = store.index("savedLocallyAt").openKeyCursor(null, "prev");
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) {
          // Missing timestamp fields are not present in the index; remove those
          // corrupt records using primary keys, still without reading snapshots.
          const keys = store.getAllKeys();
          keys.onsuccess = () =>
            keys.result.forEach((key) => {
              if (!indexedKeys.has(JSON.stringify(key))) store.delete(key);
            });
          return;
        }
        indexedKeys.add(JSON.stringify(cursor.primaryKey));
        const timestamp = cursor.key;
        if (
          typeof timestamp !== "number" ||
          timestamp <= now - RETENTION_MS ||
          timestamp > now + 60_000 ||
          ++count > MAX_DRAFTS
        )
          store.delete(cursor.primaryKey);
        cursor.continue();
      };
    });
  }
}
export const recoveryStore = new RecoveryStore();

import type { WriterDocument, WriterSnapshot } from "./writer.api";
import { recoveryStore } from "./recovery-store";
import type { RecoveryDraft, RecoveryStore } from "./recovery-store";

/** Independent of network saves. No JSON serialization or IDB write on a keystroke. */
export class RecoverySession {
  private latest: WriterSnapshot | null = null;
  private failed = false;
  private timer?: ReturnType<typeof setTimeout>;
  private deadline?: ReturnType<typeof setTimeout>;
  private pending: Promise<void> = Promise.resolve();
  private stored?: RecoveryDraft;
  private sessionId = crypto.randomUUID();
  private revision: number;
  private updatedAt: string;
  private accountId: string;
  private documentId: string;
  private storage: Pick<RecoveryStore, "put" | "remove">;
  private unavailable: () => void;
  constructor(
    accountId: string,
    document: WriterDocument,
    unavailable: () => void,
    storage: Pick<RecoveryStore, "put" | "remove"> = recoveryStore,
  ) {
    this.accountId = accountId;
    this.documentId = document.id;
    this.revision = document.revision;
    this.updatedAt = document.updatedAt;
    this.unavailable = unavailable;
    this.storage = storage;
  }
  update(snapshot: WriterSnapshot) {
    this.latest = snapshot;
    if (this.failed) return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      void this.flush();
    }, 250);
    this.deadline ??= setTimeout(() => {
      void this.flush();
    }, 1000);
  }
  private enqueue(action: () => Promise<void>) {
    const operation = this.pending.then(() => {
      if (this.failed)
        throw new Error("Recovery unavailable until document is reopened");
      return action();
    });
    this.pending = operation.catch(() => {
      if (!this.failed) this.unavailable();
      this.failed = true;
      clearTimeout(this.timer);
      clearTimeout(this.deadline);
      this.deadline = undefined;
    });
    return operation;
  }
  flush(): Promise<void> {
    clearTimeout(this.timer);
    clearTimeout(this.deadline);
    this.deadline = undefined;
    if (!this.latest) return this.pending;
    const draft: RecoveryDraft = {
      formatVersion: 1,
      accountId: this.accountId,
      documentId: this.documentId,
      sessionId: this.sessionId,
      token: crypto.randomUUID(),
      baseRevision: this.revision,
      savedLocallyAt: Date.now(),
      lastKnownServerUpdatedAt: this.updatedAt,
      title: this.latest.title,
      content: this.latest.content,
      pageSettings: this.latest.pageSettings,
    };
    // Record the token before queueing: a later save's deletion queues after this write.
    this.stored = draft;
    const operation = this.enqueue(() => this.storage.put(draft));
    // Timers/lifecycle callers need safe fallback; explicit adoption awaits this write below.
    void operation.catch(() => {});
    return operation;
  }
  async adopt(snapshot: WriterSnapshot, source: RecoveryDraft): Promise<void> {
    this.update(snapshot);
    try {
      await this.flush();
      await this.enqueue(() => this.storage.remove(source));
    } catch {
      /* Keep the original recovery record if transfer could not complete. */
    }
  }
  saved(
    snapshot: WriterSnapshot,
    result: { revision: number; updatedAt: string },
  ) {
    this.revision = result.revision;
    this.updatedAt = result.updatedAt;
    if (this.latest === snapshot) {
      this.latest = null;
      clearTimeout(this.timer);
      clearTimeout(this.deadline);
      this.deadline = undefined;
      const stored = this.stored;
      this.stored = undefined;
      if (stored)
        void this.enqueue(() => this.storage.remove(stored)).catch(() => {});
    } else if (this.latest) {
      // A succeeded while B was being typed: retain B, now based on A's revision.
      void this.flush().catch(() => {});
    }
  }
  dispose() {
    void this.flush().catch(() => {});
  }
}

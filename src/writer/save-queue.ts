import type { WriterSnapshot } from "./writer.api";
export type SaveStatus =
  | "Saved"
  | "Unsaved changes"
  | "Saving…"
  | "Unable to save — retrying…"
  | "Conflict — copy changes before reloading"
  | "Unable to save — check document content";
/** Serializes saves; an older response can never replace newer editor state. */
export class WriterSaveQueue {
  private generation = 0;
  private savedGeneration = 0;
  private timer?: ReturnType<typeof setTimeout>;
  private inFlight?: Promise<number>;
  private disposed = false;
  private conflict = false;
  private snapshot: WriterSnapshot;
  private revision: number;
  private save: (
    snapshot: WriterSnapshot,
    revision: number,
  ) => Promise<{ revision: number }>;
  private notify: (status: SaveStatus) => void;
  constructor(
    snapshot: WriterSnapshot,
    revision: number,
    save: (
      snapshot: WriterSnapshot,
      revision: number,
    ) => Promise<{ revision: number }>,
    notify: (status: SaveStatus) => void,
  ) {
    this.snapshot = snapshot;
    this.revision = revision;
    this.save = save;
    this.notify = notify;
  }
  get dirty() {
    return this.generation !== this.savedGeneration;
  }
  update(snapshot: WriterSnapshot) {
    this.snapshot = snapshot;
    this.generation++;
    this.notify(
      this.conflict
        ? "Conflict — copy changes before reloading"
        : "Unsaved changes",
    );
    clearTimeout(this.timer);
    if (!this.conflict)
      this.timer = setTimeout(() => {
        void this.flush().catch(() => {});
      }, 1000);
  }
  flush(): Promise<number> {
    clearTimeout(this.timer);
    if (this.inFlight) return this.inFlight;
    if (this.conflict)
      return Promise.reject(
        new Error(
          "Copy your changes before reloading this conflicted document.",
        ),
      );
    this.inFlight = this.drain().finally(() => {
      this.inFlight = undefined;
    });
    return this.inFlight;
  }
  private async drain() {
    try {
      while (this.dirty) {
        const generation = this.generation;
        const snapshot = this.snapshot;
        this.notify("Saving…");
        const result = await this.save(snapshot, this.revision);
        this.revision = result.revision;
        this.savedGeneration = generation;
      }
      this.notify("Saved");
      return this.revision;
    } catch (error) {
      this.conflict =
        error instanceof Error && "status" in error && error.status === 409;
      const invalid =
        error instanceof Error && "status" in error && error.status === 400;
      this.notify(
        this.conflict
          ? "Conflict — copy changes before reloading"
          : invalid
            ? "Unable to save — check document content"
            : "Unable to save — retrying…",
      );
      if (!this.disposed && !this.conflict && !invalid)
        this.timer = setTimeout(() => {
          void this.flush().catch(() => {});
        }, 3000);
      throw error;
    }
  }
  dispose() {
    this.disposed = true;
    clearTimeout(this.timer);
  }
}

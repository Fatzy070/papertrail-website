import test from "node:test";
import assert from "node:assert/strict";
import { WriterSaveQueue } from "../../src/writer/save-queue";
import type { WriterSnapshot } from "../../src/writer/writer.api";
const snapshot: WriterSnapshot = {
  title: "Draft",
  content: { type: "doc", content: [{ type: "paragraph" }] },
  pageSettings: {
    size: "A4",
    orientation: "portrait",
    margins: { top: 20, right: 20, bottom: 20, left: 20 },
  },
};
test("flush serializes in-flight saves and includes edits made before export", async () => {
  let resolve!: (value: { revision: number }) => void;
  const calls: { title: string; revision: number }[] = [];
  const queue = new WriterSaveQueue(
    snapshot,
    1,
    async (data, revision) => {
      calls.push({ title: data.title, revision });
      if (calls.length === 1) return new Promise((r) => (resolve = r));
      return { revision: revision + 1 };
    },
    () => {},
  );
  queue.update({ ...snapshot, title: "first" });
  const first = queue.flush();
  queue.update({ ...snapshot, title: "latest" });
  const exportFlush = queue.flush();
  assert.equal(first, exportFlush);
  resolve({ revision: 2 });
  assert.equal(await exportFlush, 3);
  assert.deepEqual(calls, [
    { title: "first", revision: 1 },
    { title: "latest", revision: 2 },
  ]);
  assert.equal(queue.dirty, false);
  queue.dispose();
});
test("save failure preserves dirty state and retry uses the same revision", async () => {
  let failed = true;
  const revisions: number[] = [];
  const queue = new WriterSaveQueue(
    snapshot,
    1,
    async (_, r) => {
      revisions.push(r);
      if (failed) throw new Error("offline");
      return { revision: r + 1 };
    },
    () => {},
  );
  queue.update({ ...snapshot, title: "unsaved" });
  await assert.rejects(queue.flush());
  assert.equal(queue.dirty, true);
  failed = false;
  assert.equal(await queue.flush(), 2);
  assert.deepEqual(revisions, [1, 1]);
  queue.dispose();
});
test("conflicts retain content without repeatedly overwriting a newer session", async () => {
  let calls = 0;
  const queue = new WriterSaveQueue(
    snapshot,
    1,
    async () => {
      calls++;
      throw Object.assign(new Error("Conflict"), { status: 409 });
    },
    () => {},
  );
  queue.update(snapshot);
  await assert.rejects(queue.flush());
  queue.update({ ...snapshot, title: "still editable" });
  await assert.rejects(queue.flush());
  assert.equal(calls, 1);
  assert.equal(queue.dirty, true);
  queue.dispose();
});

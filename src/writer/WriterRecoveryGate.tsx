import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Dialog } from "../components/ui/Dialog";
import { LoadingState } from "../components/ui/LoadingState";
import { recoveryStore } from "./recovery-store";
import type { RecoveryDraft } from "./recovery-store";
import { recoveryKind, validRecovery } from "./recovery-validation";
import type { WriterDocument, WriterSpec } from "./writer.api";
import "./writer-recovery.css";

export function WriterRecoveryGate({
  accountId,
  server,
  spec,
  children,
}: {
  accountId: string;
  server: WriterDocument;
  spec: WriterSpec;
  children: (draft: RecoveryDraft | undefined, notice: string) => ReactNode;
}) {
  const [decision, setDecision] = useState<{ draft?: RecoveryDraft }>();
  const [drafts, setDrafts] = useState<RecoveryDraft[] | null>(null);
  const [selected, setSelected] = useState(0);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const records = await recoveryStore.list(accountId, server.id);
        const recoverable: RecoveryDraft[] = [];
        for (const record of records) {
          if (!validRecovery(record, accountId, server.id, spec)) {
            // Values originate from the compound-key index, never another account.
            const invalid = record as RecoveryDraft;
            await recoveryStore.remove(invalid);
            if (!cancelled)
              setNotice(
                "An unreadable local draft was discarded. Your saved document is available.",
              );
          } else if (recoveryKind(record, server) === "saved")
            await recoveryStore.remove(record);
          else recoverable.push(record);
        }
        if (!cancelled) {
          setDrafts(
            recoverable.sort((a, b) => b.savedLocallyAt - a.savedLocallyAt),
          );
          if (!recoverable.length) setDecision({});
        }
      } catch {
        if (!cancelled) {
          setNotice(
            "Local recovery is unavailable on this device. Keep this tab open until your changes are saved online.",
          );
          setDecision({});
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accountId, server, spec]);
  if (decision) return children(decision.draft, notice);
  if (!drafts?.length)
    return (
      <div className="writer-load">
        <LoadingState label="Checking for unsaved changes…" />
      </div>
    );
  const draft = drafts[selected];
  const conflict = recoveryKind(draft, server) === "conflict";
  const keepServer = () => {
    void Promise.all(drafts.map((item) => recoveryStore.remove(item))).catch(
      () => {},
    );
    setDecision({});
  };
  return (
    <div className="writer-load">
      <Dialog
        title={conflict ? "Saved version has changed" : "Unsaved changes found"}
        description={
          conflict
            ? "This document was updated since these local changes began. Recovering replaces its saved content when autosave next succeeds. Nothing changes unless you choose to recover."
            : "These changes may not have finished saving before the document was closed."
        }
        onClose={() => {
          setNotice(
            "Your local draft is still available the next time you open this document.",
          );
          setDecision({});
        }}
      >
        <div className="writer-recovery">
          {drafts.length > 1 && (
            <label>
              Local draft
              <select
                aria-label="Local draft"
                value={selected}
                onChange={(event) => setSelected(Number(event.target.value))}
              >
                {drafts.map((item, index) => (
                  <option key={item.token} value={index}>
                    {new Date(item.savedLocallyAt).toLocaleString()} —{" "}
                    {item.title || "Untitled document"}
                  </option>
                ))}
              </select>
            </label>
          )}
          <p>
            On this device:{" "}
            <time>{new Date(draft.savedLocallyAt).toLocaleString()}</time>
          </p>
          <p>
            Saved online:{" "}
            <time>{new Date(server.updatedAt).toLocaleString()}</time>
          </p>
          <div className="writer-recovery-actions">
            <button
              type="button"
              className="toolbar-button bordered"
              onClick={keepServer}
            >
              {conflict ? "Keep saved version" : "Use saved version"}
            </button>
            <button
              type="button"
              className="primary-button"
              onClick={() => setDecision({ draft })}
            >
              {conflict ? "Recover local changes" : "Recover changes"}
            </button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

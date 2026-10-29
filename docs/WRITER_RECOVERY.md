# Writer local draft recovery

This is temporary, device-local crash recovery, not offline synchronization. MongoDB remains canonical. No backend, PDF export, pagination, PDF editor, authentication, billing, storage, or dashboard implementation was changed.

## Existing behavior and integration

Writer saves title, Tiptap JSON, and page settings as one snapshot. The existing queue debounces for one second, serializes saves, and sends the current revision. Backend updates compare the revision atomically and increment it; 409 stops retries. Previously, unsaved snapshots lived only in memory. The unload warning and Documents-button save flush could not protect against process termination.

`WriterPage` now sends the same immutable snapshot to a separate recovery session. Its existing save callback reports successful snapshots/revisions to recovery without awaiting IndexedDB. The save queue itself is unchanged. “Saved” still exclusively means successful backend persistence. Writer's read query is account-scoped and waits for a fresh fetch before comparing local state with the server. This reuses the existing verified `useCurrentUser` identity and cookie/Bearer API client; it does not add an authentication source.

## Storage

Native IndexedDB; no added dependency. Database: `papertrail-writer-recovery`, store: `drafts`. The compound key is `[accountId, documentId, sessionId]`. There is one latest snapshot per editing session, not a revision history. Separate session keys prevent an active tab's successful save from deleting another tab's unsaved/conflicted work.

Records contain only:

- format version, account ID, document ID, editing-session ID;
- opaque random write token for compare-and-delete (not an authentication token);
- title, structured content, page settings;
- base server revision, last known server update timestamp, local write timestamp.

No JWT, cookie, auth header, billing information, or PDF artifact is stored. Presence means pending recovery; no misleading local “Saved” status exists.

Local writes use a 250 ms debounce and a one-second maximum interval during continuous edits. JSON serialization occurs on checkpoint writes, not on every keystroke. Visibility-hidden, pagehide, and component disposal attempt an extra flush. These lifecycle writes are best effort: a crash before the checkpoint transaction commits can still lose the most recent fraction of a second (up to the one-second continuous-input interval plus storage latency). Browser storage is not a backup guarantee.

Retention is seven days, enforced on reads/writes, with at most 100 records across the browser and a 1,000,000-character serialized record ceiling. Oldest drafts are evicted beyond the count cap. Cleanup scans timestamp/primary keys without loading other documents' content. Missing/invalid timestamps are removed. There is no background worker.

Writer currently has no deletion endpoint. Orphaned records therefore expire through retention; a 404 is deliberately not treated as proof of permanent deletion, because ownership denial can also produce it. Cleanup occurs when Writer recovery storage is next accessed.

## Race handling

Storage operations are ordered per editing session. A successful server response clears the draft only when its snapshot is still the session's latest snapshot. If B was typed while A saved, B is retained and checkpointed with A's confirmed revision as its baseline. Ordered writes ensure a late A storage operation cannot resurrect a draft after its cleanup. Compare-and-delete tokens prevent an old dialog or cleanup from deleting a newer record.

When adopting a recovered draft, the new session first writes its copy durably, then conditionally removes the source. If storage transfer fails, the source remains. Other session drafts are not erased by this adoption.

## Recovery decisions

The server document must load successfully before local content is offered. Matching local/server title, JSON, and settings are silently discarded, independent of JSON object-key order. Revisions alone are not proof that different content was saved.

Different content opens a Papertrail dialog with local/server timestamps. If several session drafts exist, the user can choose one. No editor or autosave is initialized with the local content before the decision.

- Same revision: Recover loads JSON, title, and settings as dirty content; existing autosave persists it.
- Different revision: a stronger warning explains that recovering will replace saved content after autosave. Only explicit recovery loads it, retaining the current server revision as the concurrency baseline. Another intervening server save still causes 409.
- Use/Keep saved version: conditionally delete the displayed drafts and use the server document.
- Close/Escape: use the server document for now, retaining the local drafts for a later visit.

Recovery uses one normal Writer editor instance. Formatting/link behavior and page-layout extensions are unchanged.

## Failure behavior

Local records are untrusted. Validation checks identifiers, timestamps, revisions, title/settings bounds, allowed node/mark structure, nesting/count/size limits, approved fonts/sizes and safe link schemes before injection into Tiptap. Invalid records are removed and the server document opens with a non-destructive notice. The local size ceiling is deliberately larger than the backend content ceiling so a valid oversized draft can be recovered and shortened rather than silently discarded.

Open/transaction timeouts and storage errors degrade to an inline notice. After a storage failure, the editing session stops attempting local writes until reopened, avoiding an accumulating queue of failed writes. Backend autosave and editing continue independently. No document content is logged. Logout, 401, temporary auth failure, and account changes do not erase drafts. Reads and component identity are scoped to the authenticated account; another account's drafts are never offered.

## Verification

Run focused tests:

```sh
node --import tsx scripts/writer/recovery.test.ts
node --import tsx scripts/writer/save-queue.test.ts
```

Browser checks use the existing isolated Writer harness (temporary MongoDB, no production services), its `/tmp/writer-poc-auth.json`, and frontend on port 5175:

```sh
node scripts/writer/recovery-browser.cjs
node scripts/writer/link-dialog.cjs
```

The recovery browser script uses real IndexedDB and covers normal-save cleanup, interrupted/failed-save recovery, structured mixed-format content, title/settings, newer-server choice and revision baseline, account switching, expiration/cap, compare-delete, malformed records, expired save authorization, unavailable IndexedDB, and an actual delayed-A/failed-B request race. It records 1/3/10-page editing timings in `/tmp/writer-recovery-results.json` and captures mobile light/dark recovery dialogs.

These tests simulate tab closure after a committed local checkpoint; they do not claim OS-level power-loss testing or Safari/Firefox coverage. Timing samples measure synchronous ProseMirror edits and next-animation-frame latency in local Chromium, not end-to-end hardware input latency.

## Exact changes for this task

Existing file modified:

- `src/writer/WriterPage.tsx`

Files added:

- `src/writer/recovery-store.ts`
- `src/writer/recovery-session.ts`
- `src/writer/recovery-validation.ts`
- `src/writer/WriterRecoveryGate.tsx`
- `src/writer/writer-recovery.css`
- `scripts/writer/recovery.test.ts`
- `scripts/writer/recovery-browser.cjs`
- `docs/WRITER_RECOVERY.md`

Other uncommitted files in the checkout predate this task. No package or lockfile changes were needed.

## Validator schema tracking (follow-up)

The installed Tiptap 3.31.4 link mark serializes every link with all five attributes, even when unset: `{ href, target: "_blank", rel: "noopener noreferrer nofollow", class: null, title: null }`. The validator accepts exactly these keys (`title`/`target`/`rel`/`class` must be `null` or a string ≤ 256 chars; `href` must be an absolute `http:`/`https:`/`mailto:` URL ≤ 2048 chars). Unknown attributes, non-string titles, relative/unsafe hrefs and array attrs are rejected.

`scripts/writer/recovery.test.ts` builds the real schema with `getSchema` from the same extension configuration as `WriterPage` and asserts the default link attrs. That test fails if a Tiptap upgrade changes the link shape, rather than drafts being silently discarded. It also round-trips a representative mixed-format document (headings, alignment, bold/italic/underline, font family/size, hard break, nested bullet list, ordered list with start, link, page break) through the schema and validator.

The browser suite also checks:

- mixed-format recovery, including a titled link, font family and size, alignment, and Letter/landscape;
- the dialog at 320/375/390/430 px in light and dark themes (no overflow, reachable and unclipped actions; screenshots in `/tmp/writer-recovery-{theme}-{width}.png`);
- `/auth/me` 401 session expiry keeping the draft, account B not seeing it, and account A being offered it again;
- the browser-wide cap evicting the oldest records across accounts;
- garbage and unexpected-attribute records falling back to the server document.

Files changed after handover: `scripts/writer/recovery.test.ts`, `scripts/writer/recovery-browser.cjs`, `docs/WRITER_RECOVERY.md`.

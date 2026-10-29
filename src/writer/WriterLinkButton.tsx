import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Editor } from "@tiptap/react";
import type { SelectionBookmark } from "@tiptap/pm/state";
import { Dialog } from "../components/ui/Dialog";
import "./writer-link.css";

function normalizeLink(value: string): string | null {
  const trimmed = value.trim();
  if (/\s/.test(trimmed)) return null;
  const href = /^[a-z][a-z\d+.-]*:/i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  try {
    const url = new URL(href);
    if (url.protocol === "mailto:") return url.pathname.includes("@") ? href : null;
    if (!["https:", "http:"].includes(url.protocol) || !url.hostname || url.username || url.password)
      return null;
    return url.href;
  } catch {
    return null;
  }
}

export function WriterLinkButton({ editor }: { editor: Editor }) {
  const [draft, setDraft] = useState<{ href: string; existing: boolean } | null>(null);
  const [error, setError] = useState("");
  const selection = useRef<SelectionBookmark | null>(null);
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const isOpen = draft !== null;
  useEffect(() => {
    if (!isOpen) return;
    const dialog = inputRef.current?.closest("dialog");
    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || !dialog) return;
      const controls = [...dialog.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled)")];
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    dialog?.addEventListener("keydown", trapFocus);
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => {
      cancelAnimationFrame(frame);
      dialog?.removeEventListener("keydown", trapFocus);
    };
  }, [isOpen]);
  const restore = () => {
    if (!selection.current || editor.isDestroyed) return;
    editor.view.dispatch(editor.state.tr.setSelection(selection.current.resolve(editor.state.doc)));
  };
  const close = () => {
    setDraft(null);
    restore();
    // Wait until the native dialog has released its modal focus trap.
    requestAnimationFrame(() => { if (!editor.isDestroyed) editor.commands.focus(); });
  };
  const apply = (remove = false) => {
    if (!draft) return;
    const empty = !draft.href.trim();
    const href = empty ? null : normalizeLink(draft.href);
    if (!remove && !(empty && draft.existing) && !href) {
      setError("Enter a valid https://, http://, or mailto: link.");
      return;
    }
    restore();
    const chain = editor.chain().extendMarkRange("link");
    if (remove || empty) chain.unsetLink().run();
    else chain.setLink({ href: href! }).run();
    close();
  };
  return <>
    <button type="button" aria-haspopup="dialog" onClick={() => {
      selection.current = editor.state.selection.getBookmark();
      const href = String(editor.getAttributes("link").href || "");
      setError("");
      setDraft({ href, existing: editor.isActive("link") });
    }}>Link</button>
    {draft && createPortal(
      <Dialog title={draft.existing ? "Edit link" : "Add link"} onClose={close}>
        <form className="writer-link-form" onSubmit={(event) => { event.preventDefault(); apply(); }}>
          <label htmlFor={id}>URL</label>
          <input ref={inputRef} id={id} autoFocus type="text" inputMode="url" autoComplete="off" spellCheck={false}
            placeholder="https://example.com" value={draft.href}
            aria-invalid={Boolean(error)} aria-describedby={`${id}-help${error ? ` ${id}-error` : ""}`}
            onChange={(event) => { setDraft({ ...draft, href: event.target.value }); setError(""); }} />
          <p id={`${id}-help`}>Use a web address or mailto: email link.</p>
          {error && <p id={`${id}-error`} role="alert">{error}</p>}
          <div className="writer-link-actions">
            {draft.existing && <button type="button" onClick={() => apply(true)}>Remove link</button>}
            <button type="button" onClick={close}>Cancel</button>
            <button type="submit" className="primary-button">Apply link</button>
          </div>
        </form>
      </Dialog>, document.body,
    )}
  </>;
}

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Highlighter, Check, Ban } from "lucide-react";
import { useEditorState, type Editor } from "@tiptap/react";
import type { SelectionBookmark } from "@tiptap/pm/state";
import {
  useFloating,
  autoUpdate,
  offset,
  flip,
  shift,
} from "@floating-ui/react-dom";
import type { WriterSpec } from "./writer.api";

// 9 columns: Gray, Yellow, Green, Teal, Blue, Purple, Pink, Red, Orange
// 3 rows: Light / Pastel (top), Classic / Main (middle), Deeper / Accent (bottom)
const PREFERRED_SWATCH_ORDER = [
  "#f3f4f6", "#fef9c3", "#dcfce7", "#ccfbf1", "#e0f2fe", "#ede9fe", "#fce7f3", "#fee2e2", "#ffedd5",
  "#e5e7eb", "#fef08a", "#bbf7d0", "#99f6e4", "#bfdbfe", "#ddd6fe", "#fbcfe8", "#fecaca", "#fed7aa",
  "#cbd5e1", "#fde047", "#86efac", "#5eead4", "#93c5fd", "#c4b5fd", "#f9a8d4", "#fca5a5", "#fdba74",
];

export function WriterHighlightButton({
  editor,
  colors,
}: {
  editor: Editor;
  colors: WriterSpec["highlightColors"];
}) {
  const [open, setOpen] = useState(false);
  const selection = useRef<SelectionBookmark | null>(null);

  const { refs, floatingStyles } = useFloating({
    placement: "bottom-start",
    middleware: [
      offset(6),
      flip({ fallbackPlacements: ["top-start", "bottom", "top"] }),
      shift({ padding: 10 }),
    ],
    whileElementsMounted: autoUpdate,
  });

  const { setReference, setFloating, reference, floating } = refs;

  const selected = useEditorState({
    editor,
    selector: ({ editor: e }) =>
      e.isActive("highlight")
        ? String(e.getAttributes("highlight").color ?? colors[0]?.value ?? "")
        : null,
  });

  const sortedColors = useMemo(() => {
    const list = [...colors];
    return list.sort((a, b) => {
      const idxA = PREFERRED_SWATCH_ORDER.indexOf(a.value);
      const idxB = PREFERRED_SWATCH_ORDER.indexOf(b.value);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return 0;
    });
  }, [colors]);

  const applyColor = (color: string | null) => {
    if (!editor.isDestroyed) {
      if (selection.current) {
        editor.view.dispatch(
          editor.state.tr.setSelection(
            selection.current.resolve(editor.state.doc),
          ),
        );
      }
      if (color === null) {
        editor.chain().focus().unsetHighlight().run();
      } else {
        editor.chain().focus().setHighlight({ color }).run();
      }
    }
    selection.current = null;
    setOpen(false);
  };

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        floating.current &&
        !(floating.current as HTMLElement).contains(target) &&
        reference.current &&
        !(reference.current as HTMLElement).contains(target)
      ) {
        selection.current = null;
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        selection.current = null;
        setOpen(false);
        if (!editor.isDestroyed) {
          editor.commands.focus();
        }
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, floating, reference, editor]);

  return (
    <>
      <button
        ref={setReference}
        type="button"
        title="Highlight text"
        aria-label="Highlight text"
        aria-haspopup="true"
        aria-expanded={open}
        aria-pressed={Boolean(selected)}
        className="writer-highlight-btn"
        onMouseDown={() => {
          selection.current = editor.state.selection.getBookmark();
        }}
        onClick={() => {
          if (!selection.current) {
            selection.current = editor.state.selection.getBookmark();
          }
          setOpen((prev) => !prev);
        }}
      >
        <span className="writer-highlight-icon-wrapper">
          <Highlighter size={15} aria-hidden="true" />
          <span
            className="writer-highlight-indicator"
            style={{ backgroundColor: selected || "transparent" }}
            aria-hidden="true"
          />
        </span>
        Highlight
      </button>

      {open &&
        createPortal(
          <div
            ref={setFloating}
            style={floatingStyles}
            className="writer-highlight-popover"
            role="dialog"
            aria-label="Highlight colors"
          >
            <div className="writer-highlight-popover-header">
              <button
                type="button"
                className="writer-highlight-none-btn"
                onClick={() => applyColor(null)}
                title="Remove highlight"
                aria-label="Remove highlight"
              >
                <Ban size={14} aria-hidden="true" />
                <span>Remove highlight</span>
              </button>
            </div>
            <div className="writer-highlight-popover-divider" />
            <div
              className="writer-highlight-palette"
              role="group"
              aria-label="Highlight colors"
            >
              {sortedColors.map((color) => {
                const isActive = selected === color.value;
                return (
                  <button
                    key={color.value}
                    type="button"
                    className="writer-highlight-swatch-btn"
                    style={{ backgroundColor: color.value }}
                    title={color.name}
                    aria-label={color.name}
                    aria-pressed={isActive}
                    onClick={() => applyColor(color.value)}
                  >
                    {isActive && (
                      <Check size={12} className="writer-swatch-check" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

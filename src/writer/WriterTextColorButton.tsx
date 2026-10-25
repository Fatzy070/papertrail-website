import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Baseline, Check, Ban } from "lucide-react";
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

export function WriterTextColorButton({
  editor,
  colors,
}: {
  editor: Editor;
  colors?: WriterSpec["textColors"];
}) {
  const [open, setOpen] = useState(false);
  const selection = useRef<SelectionBookmark | null>(null);
  const palette = colors ?? [];

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
    selector: ({ editor: e }) => {
      const color = e.getAttributes("textStyle").color;
      return typeof color === "string" && color ? color : null;
    },
  });

  const applyColor = (color: string | null) => {
    if (!editor.isDestroyed) {
      if (selection.current) {
        try {
          editor.view.dispatch(
            editor.state.tr.setSelection(
              selection.current.resolve(editor.state.doc),
            ),
          );
        } catch {
          // Ignore if doc changed
        }
      }
      if (color === null) {
        editor.chain().focus().unsetColor().run();
      } else {
        editor.chain().focus().setColor(color).run();
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

  if (!palette.length) return null;

  return (
    <>
      <button
        ref={setReference}
        type="button"
        title="Text color"
        aria-label="Text color"
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
          <Baseline size={15} aria-hidden="true" />
          <span
            className="writer-highlight-indicator"
            style={{ backgroundColor: selected || "currentColor" }}
            aria-hidden="true"
          />
        </span>
        Color
      </button>

      {open &&
        createPortal(
          <div
            ref={setFloating}
            style={floatingStyles}
            className="writer-highlight-popover"
            role="dialog"
            aria-label="Text colors"
          >
            <div className="writer-highlight-popover-header">
              <button
                type="button"
                className="writer-highlight-none-btn"
                onClick={() => applyColor(null)}
                title="Default text color"
                aria-label="Default text color"
              >
                <Ban size={14} aria-hidden="true" />
                <span>Default text color</span>
              </button>
            </div>
            <div className="writer-highlight-popover-divider" />
            <div
              className="writer-highlight-palette"
              role="group"
              aria-label="Text colors"
            >
              {palette.map((color) => {
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
                      <Check
                        size={12}
                        className="writer-swatch-check"
                        style={{ color: "#ffffff" }}
                      />
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

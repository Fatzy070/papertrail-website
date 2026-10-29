import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Table2, Plus, Trash2 } from "lucide-react";
import { useEditorState, type Editor } from "@tiptap/react";
import type { SelectionBookmark } from "@tiptap/pm/state";
import {
  useFloating,
  autoUpdate,
  offset,
  flip,
  shift,
} from "@floating-ui/react-dom";

const DEFAULT_ROWS = 3;
const DEFAULT_COLS = 3;
const GRID_MAX_ROWS = 8;
const GRID_MAX_COLS = 8;

export function WriterTableButton({
  editor,
  disabled,
}: {
  editor: Editor;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState(DEFAULT_ROWS);
  const [cols, setCols] = useState(DEFAULT_COLS);
  const [withHeaderRow, setWithHeaderRow] = useState(true);
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

  const inTable = useEditorState({
    editor,
    selector: ({ editor: e }) => e.isActive("table"),
  });

  const restoreSelection = () => {
    if (!editor.isDestroyed && selection.current) {
      try {
        editor.view.dispatch(
          editor.state.tr.setSelection(
            selection.current.resolve(editor.state.doc),
          ),
        );
      } catch {
        // Ignore if document changed while popover was open
      }
    }
  };

  const handleInsertTable = (r: number, c: number) => {
    const safeRows = Math.max(1, Math.min(50, Math.round(r || DEFAULT_ROWS)));
    const safeCols = Math.max(1, Math.min(12, Math.round(c || DEFAULT_COLS)));
    if (!editor.isDestroyed) {
      restoreSelection();
      editor.commands.insertTable({
        rows: safeRows,
        cols: safeCols,
        withHeaderRow,
      });
    }
    selection.current = null;
    setOpen(false);
  };

  const runTableAction = (action: () => boolean) => {
    if (!editor.isDestroyed) {
      restoreSelection();
      editor.commands.focus();
      action();
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
        title="Table"
        aria-label="Table"
        aria-haspopup="true"
        aria-expanded={open}
        aria-pressed={inTable}
        disabled={disabled}
        onMouseDown={() => {
          selection.current = editor.state.selection.getBookmark();
        }}
        onClick={() => {
          if (!selection.current) {
            selection.current = editor.state.selection.getBookmark();
          }
          setOpen((prev) => {
            if (!prev) {
              setRows(DEFAULT_ROWS);
              setCols(DEFAULT_COLS);
            }
            return !prev;
          });
        }}
      >
        <Table2 size={15} aria-hidden="true" />
        Table
      </button>

      {open &&
        createPortal(
          <div
            ref={setFloating}
            style={floatingStyles}
            className="writer-table-popover"
            role="dialog"
            aria-label="Table options"
          >
            <div className="writer-table-popover-section">
              <div className="writer-table-popover-title">
                <span>Insert table</span>
                <span className="writer-table-dimensions-badge">
                  {cols} × {rows}
                </span>
              </div>

              <div
                className="writer-table-grid-picker"
                role="group"
                aria-label="Select table dimensions"
              >
                {Array.from({ length: GRID_MAX_ROWS }, (_, rIdx) => {
                  const r = rIdx + 1;
                  return Array.from({ length: GRID_MAX_COLS }, (__, cIdx) => {
                    const c = cIdx + 1;
                    const active = r <= rows && c <= cols;
                    return (
                      <button
                        key={`${r}-${c}`}
                        type="button"
                        className={`writer-table-grid-cell${active ? " active" : ""}`}
                        aria-label={`Insert ${c} columns by ${r} rows table`}
                        onMouseEnter={() => {
                          setRows(r);
                          setCols(c);
                        }}
                        onClick={() => handleInsertTable(r, c)}
                      />
                    );
                  });
                })}
              </div>

              <div className="writer-table-custom-inputs">
                <label>
                  Cols
                  <input
                    type="number"
                    aria-label="Table columns"
                    min={1}
                    max={12}
                    value={cols}
                    onChange={(e) =>
                      setCols(
                        Math.max(
                          1,
                          Math.min(12, Number(e.target.value) || DEFAULT_COLS),
                        ),
                      )
                    }
                  />
                </label>
                <label>
                  Rows
                  <input
                    type="number"
                    aria-label="Table rows"
                    min={1}
                    max={50}
                    value={rows}
                    onChange={(e) =>
                      setRows(
                        Math.max(
                          1,
                          Math.min(50, Number(e.target.value) || DEFAULT_ROWS),
                        ),
                      )
                    }
                  />
                </label>
              </div>

              <label className="writer-table-header-toggle">
                <input
                  type="checkbox"
                  checked={withHeaderRow}
                  onChange={(e) => setWithHeaderRow(e.target.checked)}
                />
                <span>Include header row</span>
              </label>

              <button
                type="button"
                className="writer-table-insert-btn"
                onClick={() => handleInsertTable(rows, cols)}
              >
                <Plus size={14} aria-hidden="true" />
                Insert {cols} × {rows} table
              </button>
            </div>

            {inTable && (
              <>
                <div className="writer-highlight-popover-divider" />
                <div
                  className="writer-table-actions-section"
                  role="group"
                  aria-label="Edit current table"
                >
                  <div className="writer-table-popover-subtitle">
                    Edit current table
                  </div>
                  <div className="writer-table-actions-grid">
                    <button
                      type="button"
                      onClick={() =>
                        runTableAction(() =>
                          editor.commands.addTableRowBefore(),
                        )
                      }
                    >
                      + Row above
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        runTableAction(() => editor.commands.addTableRowAfter())
                      }
                    >
                      + Row below
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        runTableAction(() =>
                          editor.commands.addTableColumnBefore(),
                        )
                      }
                    >
                      + Col left
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        runTableAction(() =>
                          editor.commands.addTableColumnAfter(),
                        )
                      }
                    >
                      + Col right
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        runTableAction(() => editor.commands.deleteTableRow())
                      }
                    >
                      Delete row
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        runTableAction(() =>
                          editor.commands.deleteTableColumn(),
                        )
                      }
                    >
                      Delete col
                    </button>
                    <button
                      type="button"
                      className="writer-table-span-2"
                      onClick={() =>
                        runTableAction(() =>
                          editor.commands.toggleTableHeaderRow(),
                        )
                      }
                    >
                      Toggle header row
                    </button>
                    <button
                      type="button"
                      className="writer-table-span-2 writer-table-danger-btn"
                      onClick={() =>
                        runTableAction(() =>
                          editor.commands.deleteWriterTable(),
                        )
                      }
                    >
                      <Trash2 size={13} aria-hidden="true" />
                      Remove table
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}

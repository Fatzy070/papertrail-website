# Writer highlight and view zoom

## Highlight

Uses official `@tiptap/extension-highlight@3.31.4`, matching installed Tiptap.
Actual serialized mark inspected before changing validation:

```json
{"type":"highlight","attrs":{"color":"#fef08a"}}
```

The official default is `color: null`; both default and absent color render as
palette Yellow. Seven named colors are defined once in backend `writer-spec.ts`
and delivered by the existing `/writer/spec` endpoint:

| Color | Value |
|---|---|
| Yellow | #fef08a |
| Green | #bbf7d0 |
| Blue | #bfdbfe |
| Pink | #fbcfe8 |
| Orange | #fed7aa |
| Purple | #ddd6fe |
| Gray | #e5e7eb |

The dialog preserves the ProseMirror selection bookmark. It exposes named swatches,
selected state, Remove highlight, Escape dismissal, and native modal focus handling.
Highlight is a standard mark: autosave, revisions, Mongo persistence, GET/reload,
and IndexedDB recovery use the existing document pipeline. Clear formatting unsets
highlight along with other visual marks, retaining links and block structure.

Backend and recovery allow exactly the highlight color attribute, null/default or
palette hex values. The inline mark count becomes six so all legitimate Writer marks
can coexist. Unknown marks, arbitrary CSS, unapproved colors, and unknown attributes
remain invalid. Renderer CSS uses a value selected from the server palette, never
raw document styling. Document text retains its existing color.

Paste parsing recognizes `<mark>` and Google Docs-style inline background-color
spans. Browser CSS color parsing maps opaque colors to the nearest palette RGB value;
transparent/unsupported backgrounds are dropped without removing text. No external
Google Docs account was used; tests exercise representative HTML in the real Writer.

## View zoom

Zoom is session React state, default 100%, with minus/plus and presets:
50, 75, 90, 100, 110, 125, 150, 175, 200. It is not in snapshots, page settings,
Mongo, local storage, or recovery drafts. Fit-width is deliberately omitted.

The physical paper/editor layout width is unchanged. A transform scales the outer
paper, including gaps; a ResizeObserver measures unscaled paper height and reserves
the corresponding scaled scroll area. Overflow stays within the workspace, leaving
the application shell usable on mobile. Browser pinch zoom is not disabled.

Installed ProseMirror view 1.42.6 explicitly handles transformed element dimensions
in `domcoords.ts`. Native mouse caret placement and drag selection were tested at
six scales; typing at 200% and undo were also tested.

### Dependency coordinate mismatch and remaining verification

A deeper regression exposed an existing `tiptap-pagination-plus@3.1.0` mismatch:
`calculatePageCount` divides the viewport-scaled last-page gap by an unscaled page
content height. Inserting an entire multi-page document at 200% produced 5 pages
rather than 4, despite static zoom and small typing tests passing.

`build/writer-pagination-zoom.ts` applies a checked, single-expression compatibility
patch that converts only that screen-distance delta to document units first. It
changes no pagination algorithm, physical page configuration, or document nodes.
Vite applies the same transform in development and production; the dependency is
excluded from prebundling so the patch cannot be skipped. Unexpected package versions
or upstream source signatures fail the build and require review. No node_modules
files are edited and no pagination library is replaced.

The post-fix multi-page insertion browser command was declined. Build/static patch
checks pass, but **the final browser reflow regression must be rerun before calling
zoom fully verified**. The regression is now part of `scripts/writer/highlight-zoom.cjs`.

## Results

Passed before the final dependency-coordinate patch:

* Selected text yellow → green, selected-state palette, removal preserving bold/link,
  undo/redo, clear formatting, Mongo GET equality and refresh.
* Forced failed save → IndexedDB retention → tab close/reopen → recover → save.
* Google Docs-style highlighted paste and six simultaneous marks save successfully.
* Four-page fixture at 50/75/100/125/150/200: same page count, block positions, wrapping,
  manual-break heights, JSON, revision; zero PATCH and zero recovery drafts from zoom.
* Actual toolbar export at 50/100/200: all four rasterized PDF pages pixel-identical;
  yellow highlight visibly preserved. PDF timestamps are not used for comparison.
* Native caret and drag selection at six scales, typing at 200%, undo.
* 320/375/390/430 shell overflow and dialog bounds; Escape; dark-mode visual inspection.

Current static checks:

* Frontend build/lint passed. No `npm test` script configured.
* Frontend recovery 14 tests and save queue 3 tests passed.
* Backend build and changed-file lint passed; isolated Writer suite 35 tests passed.
* Full backend lint: existing 129 errors/43 warnings outside changed files.
* Full backend test: 6 suites passed, 7 blocked by missing legacy mocks.
* Dependency transform applies exactly once and fails closed for changed source.

The existing export flow toggles editability and flushes saves. Its own save requests
are measured separately from zoom-only behavior; this work does not change that flow.

References: [official Highlight extension](https://tiptap.dev/docs/editor/extensions/marks/highlight)
and [ProseMirror view coordinate API](https://prosemirror.net/docs/ref/).

## Exact files changed for this task

Frontend:
* package.json
* package-lock.json
* vite.config.ts
* build/writer-pagination-zoom.ts (new)
* src/writer/WriterPage.tsx
* src/writer/WriterView.tsx (new)
* src/writer/WriterHighlightButton.tsx (new)
* src/writer/highlight.ts (new)
* src/writer/writer.api.ts
* src/writer/recovery-validation.ts
* src/writer/writer.css
* scripts/writer/recovery.test.ts
* scripts/writer/highlight-zoom.cjs (new)
* docs/WRITER_HIGHLIGHT_ZOOM.md (new)

Backend:
* src/writer/renderer/writer-spec.ts
* src/writer/renderer/writer-renderer.ts
* src/writer/writer-highlight.spec.ts (new)

Existing PDF editor, pagination.ts, autosave/recovery lifecycle, auth, billing, library,
and physical document settings were not changed by this task.

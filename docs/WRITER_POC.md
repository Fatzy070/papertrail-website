# Papertrail Writer POC

Writer is a separate flow-based editor at `/writer/:documentId`. The existing PDF editor, engines, stores, exports, billing, support and admin implementations are unchanged.

## Architecture

- The dashboard adds Create document and a small Writer document list; existing PDF library/upload navigation remains in place.
- The Writer route is lazy-loaded. Tiptap 3 uses one ProseMirror document, one selection, and one undo history. Canonical JSON contains logical paragraphs/headings/lists and explicit `pageBreak` atoms, never coordinates or derived pages.
- StarterKit supplies paragraphs, headings 1–3, bold, italic, underline, links, lists and history. TextStyle, FontFamily, FontSize and TextAlign provide the remaining formatting. Unsupported StarterKit blocks are disabled.
- `tiptap-pagination-plus@3.1.0` is the isolated pagination candidate. Its decoration floats exclude real areas from text flow. Long paragraphs actually continue after a page gap; this is not a background-only page illusion. The custom manual-break plugin measures and sizes explicit breaks in requestAnimationFrame without changing the JSON or history. Font loading and page-settings changes trigger reflow.
- Browser float layout was chosen over per-page editors or splitting paragraphs into page nodes because it preserves native selection, typing, paste and undo. Official Tiptap Pages requires a private registry and documents no browser-print integration. This POC does not assume a commercial account or service.
- The backend `/writer/spec` response is the single rendering specification: physical dimensions, defaults, approved sizes/families, typography CSS and embedded licensed Arimo/Noto Serif font files. Both preview and Chromium consume the same font bytes and CSS. The frontend does not maintain a second typography stylesheet.
- Page dimensions use mm converted at 96 CSS px/in for the preview and real mm in Chromium `@page`. Margins are 5–50 mm, initially 20 mm. Pages remain white in dark mode; the surrounding UI follows Papertrail's theme. On mobile the toolbar and physical page workspace scroll horizontally without widening the outer app.

## Saving and export

The existing authenticated API client and React Query are reused. The save queue debounces for 1 second, serializes writes, drains edits made during an in-flight request, and retains dirty state on failure. Transient failures retry after 3 seconds. Revision conflicts stop retries and preserve the editor with a warning; copying changes before reload is required in this POC. Validation errors wait for the user to correct the document. Browser unload warns for dirty content. The Documents button saves before leaving. There is no durable offline recovery or cross-tab merge yet.

Export temporarily freezes editing, flushes the queue, and requests the exact persisted revision. The backend verifies ownership and revision, snapshots JSON, renders trusted semantic HTML, and prints it with Puppeteer/Chromium. No client HTML or client PDF is accepted. Links permit only HTTP(S)/mailto; renderer text is escaped; unsupported nodes/fonts/sizes are rejected. Browser JavaScript and external network requests are disabled for export.

PDFs stream directly to the user. This POC performs no R2 writes and cannot introduce missing-object references. A future artifact model should key exports by document ID, source revision, schema/rendering version and storage key; upload through the existing StorageService before storing that metadata.

## Local validation

Use an isolated temporary MongoDB; do not point these scripts at production. The harness uses the existing JwtStrategy/JwtAuthGuard with fixture users and a test-only secret. It does not load `.env`, contact R2, send email or access the application database.

1. In `papertrail-backend`: `npm run build`, then `node validation/writer/poc-server.cjs` (port 3007). The first run can download a MongoDB test binary. It writes temporary fixture tokens under `/tmp`.
2. In `papertrail-website`: `VITE_API_BASE_URL=http://127.0.0.1:3007/api npm run dev -- --host 127.0.0.1 --port 5175 --strictPort`.
3. Run `node scripts/writer/acceptance.cjs`. Requires local Chromium and Poppler's `pdftotext`.
4. Run `node scripts/writer/inspect.cjs`, then `node scripts/writer/parity.cjs` for the mixed-content specimen and page-by-page text comparison. Screenshots/PDFs/results go to `/tmp/writer-*`.
5. Run `node --import tsx scripts/writer/save-queue.test.ts` for three autosave queue tests.
6. In the backend: `npm test -- --config writer.jest.json --runInBand` for focused ownership, revision, renderer and page-settings tests. This separate config avoids the repository's missing legacy test mocks without changing them.

The fixture includes H1/H2, several paragraphs, a single paragraph crossing a page boundary, both list types, bold/italic/underline/link and an explicit page break. The performance specimens are calibrated to 1, 3 and 10 pages. Measurements time 30 sequential ProseMirror insert commands, including synchronous layout; next-rAF timing is also recorded. They are local measurements, not a cross-device latency guarantee.

## Limits and next decision

The canonical JSON/persistence/export boundaries are suitable for continued development. Pagination remains a POC candidate, not a production guarantee. Validate Firefox, Safari/iOS, IME, complex scripts, browser zoom, many consecutive breaks, deep nested lists and large mixed-size runs before shipping. The bundled Latin font subsets do not establish deterministic coverage for every language. Header/footer, tables, images, collaboration, history UI and PDF-editor integration are deliberately absent.

Native print fragmentation can differ from float layout around paragraph margins at page boundaries, large headings and nested lists. Do not treat matching total page counts as proof: use the included per-page text comparison and visual inspection. Current measured outcomes are recorded in `WRITER_VALIDATION.md`.

References: [ProseMirror decorations](https://prosemirror.net/docs/guide/#view.decorations), [pagination candidate](https://github.com/RomikMakavana/tiptap-pagination-plus), [Tiptap Pages limitations](https://tiptap.dev/docs/pages/core-concepts/limitations), [Puppeteer deployment](https://pptr.dev/troubleshooting), [Render Docker deployment](https://render.com/docs/docker).

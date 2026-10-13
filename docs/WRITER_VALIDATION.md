# Writer POC validation — 12 October 2026

Implementation and tests ran locally against an isolated temporary MongoDB, the existing JWT strategy, the real Writer Nest module and headless Chromium. No production documents or external storage/billing services were used.

## Outcome

The POC demonstrates natural writing, continuous pagination, autosave/refresh, and backend PDF generation. The existing PDF editor implementation was not modified. Recommend continuing this architecture, with the pagination dependency treated as a constrained POC until cross-browser/IME/complex-language testing is complete. This is not a production-readiness claim.

## Pagination and export parity

All tested formats preserved the complete text, respected the explicit page break, matched page counts and matched normalized text page by page. Comparison normalizes whitespace and list markers; it is not a pixel-equivalence assertion. Screenshots and rendered PDF pages were also inspected for fonts, margins, headings, lists and page transitions. Poppler confirmed embedded Arimo and Noto Serif font subsets.

| Mixed-content specimen | Preview | Backend PDF | Page text |
|---|---:|---:|---|
| A4 portrait / sans | 4 | 4 | All pages match |
| Letter portrait / sans | 4 | 4 | All pages match |
| A4 landscape / sans | 4 | 4 | All pages match |
| Letter landscape / serif 14 pt / custom margins | 6 | 6 | All pages match |

Two real discrepancies were found and fixed: pagination margin decorations created extra inline line boxes, and the app inherited text-rendering settings that were absent from print. Before the final typography fix, alternate formats moved 7–29 non-whitespace characters across some boundaries despite matching page counts. Explicit shared whitespace/kerning/text-rendering settings eliminated those differences in the final specimens. No remaining discrepancy was observed in these test cases; untested content is not guaranteed identical.

## Performance

30 sequential ProseMirror insert commands per document, measured in one local Chromium session. Synchronous time includes the immediate editor/layout work; next-rAF timing is **not** a measured end-to-end hardware input/paint latency. Results vary with machine load.

| Preview / PDF pages | Paragraphs | Median synchronous edit | p95 synchronous edit | p95 next rAF |
|---|---:|---:|---:|---:|
| 1 / 1 | 4 | 2.0 ms | 4.3 ms | 38.1 ms |
| 3 / 3 | 20 | 2.0 ms | 5.1 ms | 31.7 ms |
| 10 / 10 | 70 | 1.9 ms | 5.9 ms | 46.3 ms |

All per-page text comparisons also matched for these 1/3/10-page specimens. No obvious typing stall was observed at this scale. Pagination still performs document-level work; 200-page performance is not claimed.

## Acceptance checks passed

- Dashboard create -> Writer route
- Ownership read/update/export, unauthenticated rejection, forged owner, invalid settings, cookie + bearer
- Autosave + refresh persistence
- Insert at start reflows; undo across continuous document
- Deleting earlier paragraphs pulls later content backward
- Keyboard typing near first-page boundary
- Multi-paragraph paste
- Font-size reflow
- A4 -> Letter and portrait -> landscape reflow
- Save failure retains content and retry persists
- Export flushes latest content before debounce
- Mobile/tablet/desktop outer layout and dark mode

## Build and test results

- Frontend `npm run build`: passed; existing large-chunk / MuPDF browser-externalization warnings remain.
- Frontend `npm run lint`: passed.
- Frontend has no configured `npm test`; three focused autosave queue tests passed via `node --import tsx scripts/writer/save-queue.test.ts`.
- Backend `npm run build`: passed.
- Backend focused Writer suite: 11 tests passed; renderer, ownership, create, conflict/update, export revision/authorization and page settings.
- Backend new Writer TypeScript lint: passed with no errors or warnings.
- Backend repository lint (`npm run lint -- --fix=false`): 129 errors and 43 warnings in existing non-Writer files. The no-fix override prevents reformatting unrelated implementations.
- Backend normal `npm test -- --runInBand`: 4 suites / 9 tests passed; 7 suites could not run because package.json maps Nest/Mongoose/file-type imports to missing files under `test/`. A separate Writer test config works around this without modifying legacy test configuration.
- Existing PDF engine, upload, document list, auth, billing, support and admin implementation files are unchanged. Auth and dashboard were exercised by the isolated harness; live R2/Paystack/email/admin and full existing PDF-editor integration were not exercised. Build and diff review are the regression evidence for those unchanged areas.
- Docker/Render deployment was documented, not deployed or benchmarked. Chromium browser availability, sandbox support, OS libraries, memory budget and container behavior still need verification on the actual Render plan.

## Exact file manifest

Paths below are relative to each named repository. The backend lockfile already had local changes before this task; dependency installation extended it without resetting the file.

### papertrail-website — added

- `docs/WRITER_POC.md`
- `docs/WRITER_VALIDATION.md`
- `scripts/writer/acceptance.cjs`
- `scripts/writer/fixture.cjs`
- `scripts/writer/formats.cjs`
- `scripts/writer/inspect.cjs`
- `scripts/writer/parity.cjs`
- `scripts/writer/save-queue.test.ts`
- `src/writer/WriterDashboard.tsx`
- `src/writer/WriterPage.tsx`
- `src/writer/pagination.ts`
- `src/writer/save-queue.ts`
- `src/writer/writer.api.ts`
- `src/writer/writer.css`

### papertrail-website — modified existing files

- `package-lock.json`
- `package.json`
- `src/App.tsx`
- `src/pages/DashboardPage.tsx`

### papertrail-backend — added

- `.dockerignore`
- `Dockerfile.writer-poc`
- `WRITER_DEPLOYMENT.md`
- `src/writer/dto/writer.dto.ts`
- `src/writer/renderer/writer-pdf.service.ts`
- `src/writer/renderer/writer-renderer.ts`
- `src/writer/renderer/writer-spec.ts`
- `src/writer/schemas/writer-document.schema.ts`
- `src/writer/writer.controller.ts`
- `src/writer/writer.module.ts`
- `src/writer/writer.service.ts`
- `src/writer/writer.spec.ts`
- `validation/writer/poc-server.cjs`
- `writer.jest.json`

### papertrail-backend — modified existing files

- `package-lock.json`
- `package.json`
- `src/app.module.ts`

# Source-text fidelity investigation and verification

Input: the supplied `Notice of Salary Renegotiation.pdf`. The original file was
not modified or uploaded. Only the affected local sentence was logged.

## Diagnosis

The larger-run hypothesis was **rejected for this document**. PDF.js item 11 is
`₦`; item 12 is `200,000`. Item 16 is the second `₦`; item 17 is `150,000`.
Each becomes a separate Papertrail element. There is no `sourceIdentifier` field:
the first digits use `pdf-text-${pageId}-12` (`pdf-text-p1-12` in the test).

PDF.js item 12 has:

```text
str:       200,000
fontName:  g_d0_f1 (the document-load prefix varies)
transform: [11.9999995, 0, 0, 11.9999995, 301.11912807836916, 640.16998840625]
width:     43.37695103262697
height:    11.9999995
```

Papertrail's original box is x=301.11912807836916, y=192.14999199375,
width=43.37695103262697, height=11.9999995. Baseline is 201.74999159375pt
in top-origin page coordinates. Font size is approximately 12pt.

MuPDF `preserve-spans` places the local groups in zero-based block 3:

| Structured line/span | Text | Font | Baseline |
| --- | --- | --- | --- |
| 2 | agreement regarding your monthly salary of (space) | Arimo-Regular | 201.75 |
| 3 | ₦ | LiberationSerif-Bold | 201.75 |
| 4 | 200,000 | Arimo-Bold | 201.75 |
| 5 | (space)to(space) | Arimo-Regular | 201.75 |
| 6 | ₦ | LiberationSerif-Bold | 201.75 |
| 7 | 150,000 | Arimo-Bold | 201.75 |
| 8 | , effective October | Arimo-Regular | 201.75 |

These are span-preserving groups on one physical baseline. The first digits have
seven characters with X origins 301.119140625, 307.7911376953125,
314.463134765625, 321.1351318359375, 324.47113037109375, 331.14312744140625,
337.81512451171875. Their quad union is
[301.119140625,190.88671875,344.48712158203125,204.29296875].
The preceding currency glyph ends at X=301.11712646484375, about 0.002pt away.

Three causes were reproduced:

1. Export padded source bounds by 2pt, intersecting and truly removing the adjacent
   currency glyph. The second amount's padding also reaches the following comma.
2. Typing enlarged the live source element to at least 60pt, and its 92%-opaque
   white background covered the neighboring ` to `. This was a separate preview
   problem, not evidence of a larger source run.
3. The preview used a CSS line box over an assumed 80%-ascent bbox, rather than
   aligning the actual font baseline. Its old Chromium baseline was 203.140625px
   at 100%, versus 201.75. Arimo also carried `isSerif=true`, and the unrecognized
   family fell back to Times Bold. The exporter's numerical baseline was already
   correct; the font substitution and live preview caused the apparent shift.

## Fix

Horizontal source text is matched to MuPDF characters using original text,
position, baseline, and extent. The rectangle comes from selected character
geometry, with a 0.01pt interior inset to avoid floating-point contact with adjacent
boxes. MuPDF removes intersected glyphs in full; this is not a painted cover.
Unselected-character intersections or ambiguous geometry cause a safe export error.
Rotated/legacy paths and MuPDF's image/vector/text redaction policy are unchanged.

The matcher handles the existing 4pt minimum hit box and same-boundary saved
replacements when Save updates bytes but retains live extraction metadata. Changed
extents that cannot be matched safely are rejected rather than risking neighbors.

The preview cover now uses original bounds independently of editable width. The
60pt minimum no longer applies to source text. Browser font metrics align the live
text to the stored baseline. A narrow Arimo-family override selects the existing
metrically compatible Helvetica path before consulting the misleading serif flag.
No surrounding-run reconstruction, Writer change, or new font dependency was used.

Rectangles below are [left,top,right,bottom], in page points:

| Digits | Before | After |
| --- | --- | --- |
| 200,000 | [299.11912807836916,190.14999199375,346.4960791109961,206.14999149375] | [301.129140625,190.89671875,344.47712158203126,204.28296875] |
| 150,000 | [367.8378752150879,190.14999199375,415.21482624771486,206.14999149375] | [369.847890625,190.89671875,413.19587158203126,204.28296875] |

Original and replacement exported baselines are both **201.75pt**; digit advances
match within 0.01pt. Replacement is Helvetica-Bold, approximately 12pt. Browser
preview baseline differences were below 0.21 CSS pixels at the tested zooms.

## Verification and limits

- Both actual amount edits pass: `200,000 -> 300,000`, `150,000 -> 175,000`.
- Currency symbols, surrounding glyph coordinates, and punctuation survive.
- At 2x raster resolution, **zero pixels outside either edited amount change**.
- Extraction finds the replacement and not the removed original amount.
- Synthetic single-run salary fixture passes both numeric-range replacements.
- `document -> PDF` inside `Papertrail makes document editing simple.` preserves
  surrounding glyphs. This tests geometry/export, not a new substring-selection UI.
- Normal/bold controls cover short/long words, numbers, beginning/end edits,
  narrow single characters, and punctuation.
- Save-byte replacement followed immediately by export passes. Re-extracting the
  saved PDF and exporting again also passes.
- Earlier Chromium checks of the same implementation passed at 100%, 125%, and
  160%; canonical bounds stayed fixed and exported rasters were identical.
- Authenticated cloud Save/refresh was **not** exercised. Local save-byte/reopen
  checks do not claim to test the backend request.
- Latest lint passed. Source-text tests: **19 passed**. Existing frontend tests:
  **17 passed**. No `npm test` script is configured.
- Build and lint pass after the separately requested restoration of
  `src/polyfills.ts`, which commit `36aca5d` had deleted while both entry points
  still imported it.

Run from the frontend root:

```sh
SOURCE_TEXT_PDF='/path/to/Notice of Salary Renegotiation.pdf' node --import tsx --test src/engine/__tests__/source-text-fidelity.test.ts
node --import tsx --test src/writer/__tests__/*.test.ts
npm run build
npm run lint
```

Without `SOURCE_TEXT_PDF`, the private-document test is explicitly skipped. The
committed 6.5KB synthetic fixture contains only the invented salary sentence and
an embedded DejaVu Sans subset; it contains no private document content.

## Exact task files

Implementation, already present in commit `36aca5d` when this task resumed:

- `src/components/editor/TextOverlay.tsx`
- `src/engine/font-registry.ts`
- `src/engine/mupdf/mupdf-redaction.ts`
- `src/engine/mupdf/source-glyph-geometry.ts`
- `src/engine/pdf-exporter.ts`
- `src/engine/text-measurement.ts`

Regression/report files restored after the temporary session files disappeared:

- `src/engine/__tests__/source-text-fidelity.test.ts`
- `src/engine/__tests__/fixtures/salary-run.pdf`
- `src/engine/__tests__/source-text-fidelity.md`

Other changes in that existing commit are not part of this fix. No backend files,
Writer files, editor stores, authentication, billing, Support, or Admin were changed
by this task.

## New SF UI document — October 14 follow-up

The newly supplied PDF differs from the original Arimo document above. PDF.js
item 22 is `250,000 to` (x=121.07031094, width=53.58099915), while item 25 is
`200,000` (x=183.56323416, width=41.44303923). Both are 9.6012972pt with
baseline 280.1259pt. Currency symbols are separate items. In this document the
first number really does share a PDF.js run with the following word.

MuPDF exposes individual characters, baseline 280.12585449, with vertical quads
270.98541260–282.43975830. It reports `.SFUI-Regular_wdth_opsz1`, isBold=false,
and isSerif=true for the amounts. The full embedded PDF font name is
`AAAAAB+.SFUI-Regular_wdth_opsz110000_GRAD_wght2BC0000`: the variable weight is
lost in the shortened name. Existing font resolution substitutes Times Regular,
changing both the appearance and spacing of the whole run, including `to`.

The narrow correction matches SF UI numeric source runs to their actual embedded
font by character advances. Same-length numeric edits with available embedded
glyphs use those outlines in an SVG preview and embed that program on export.
Characters keep their original X origins and baseline. Only the corrected number
is truly redacted and redrawn; neighboring words/currency/punctuation remain native.
The first number's character rectangles span x=121.08031250–162.30172180; the
second spans x=183.57323242–224.99627136 (individual inset rectangles, not a padded
parent-run rectangle). Both retain the source baseline 280.12585449pt.

No font bytes or glyph caches are persisted in document state. A WeakMap follows
source-style object identity through immutable edits/history. Reopening extracts
and registers the original Unicode-capable font again; generated subsets without
cmap are skipped. Explicit formatting, moved/rotated text, different-length edits,
and characters missing from the embedded subset retain the existing edit path.
This is not a universal missing-font replacement system.

Verification on the new private PDF:

- `250,000 -> 300,000` and `200,000 -> 300,000`: live Chromium preview and export.
- Both currency symbols, `to`, comma, and all neighboring glyph positions survive.
- At 3x raster resolution, zero pixels differ outside the actually changed digits.
- PDF.js extracts the complete new number and not the removed amount.
- Save-byte replacement/re-export, re-extraction, and a subsequent `500,000` edit pass.
- Chromium checks at 100%, 125%, and 200% retain the same canonical geometry.
- Local save/reopen was tested; authenticated cloud persistence was not exercised.
- Full regression run: 36 passed, one skipped (the older private Arimo PDF, whose
  supplied path now contains this newer file). Build and lint pass; build retains
  the existing large-chunk warning. There is no npm test script.

Run the new private-file regression with `SFUI_SOURCE_PDF=/path/to/new.pdf`.
The source PDF and its proprietary font are not committed as test fixtures.

Files in this follow-up: `source-number-edit.ts` (new), `text-style-enricher.ts`,
`pdf-exporter.ts`, `TextOverlay.tsx`, `source-text-fidelity.test.ts`, and this report.
No Writer/backend files or global MuPDF redaction policies changed.

### Missing-digit follow-up

`200,000 -> 100,000` exposed a gap in the first SF UI fix: the bold embedded
subset has no glyph for `1` (nor `4`, `6`, `8`, or `9`). The prior implementation
returned to whole-run Times substitution when any replacement glyph was missing.
It now keeps the precise numeric geometry and original outlines for every
available glyph, using a matching-weight sans-serif fallback only for missing
digits. Weight is read from the full PDF font resource's fixed-point `wght`
value (700 here), not the misleading shortened Regular name.

Preview uses the already bundled Arimo outline; PDF export uses the metrically
compatible Base-14 Helvetica face for that missing digit. This is a substitute
for an absent glyph, not a claim to recover the original SF UI outline. The rest
of the number remains in its original font. Bundled Arimo TTF subsetting exposed
invalid composite glyphs during testing, so this path uses the existing standard
PDF font rather than shipping an unreadable fallback subset.

Added `100,000` and `900,000` coverage, including actual raster ink at the new
digit (searchability alone does not prove a glyph rendered), zero pixel changes
outside changed digit cells, preserved neighboring glyphs/baselines, and local
save/reopen/export. Live Chromium typing checks cover `100,000` and the previous
`300,000` case at 100%, 125%, and 200%. Authenticated cloud persistence was not
exercised. Only `source-number-edit.ts`, `pdf-exporter.ts`, the source-text test,
and this report changed in this follow-up; no Writer or global redaction changes.

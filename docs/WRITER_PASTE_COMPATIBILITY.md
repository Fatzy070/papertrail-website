# Writer rich-paste compatibility investigation

## Confirmed cause (2026-10-13)

The supplied failing Google Docs request's first invalid mark is at
`content.content[0].content[0].marks[0]`: `textStyle` with
`fontFamily: ""` and `fontSize: ""`. The first rejection is `fontFamily`.
Many later text and hard-break marks repeat the empty family.

The frontend strips unsupported source fonts/sizes from pasted HTML. Installed
Tiptap **3.31.4** FontFamily/FontSize parseHTML rules fall back to
`element.style.fontFamily` / `fontSize`, which return empty strings when absent.
Those strings pass the ProseMirror schema and render using inherited styles, but
backend `validateContent` accepted only null/absent or approved values. This is
not a link-title, list, hard-break, or document-size failure.

The exact first mark structure was reproduced against the old validator (400),
then against path-aware diagnostics before changing acceptance. The regression
fixture is an excerpt of the supplied serialization; personal text and URLs are
redacted, while node/mark/attribute shapes and empty values are preserved.

## Narrow compatibility changes

* New HTML imports use Writer-specific FontFamily/FontSize parsing: approved
  values remain; absent/unsupported styles become null. Existing paste cleanup
  still converts approved pixel sizes into points. No paragraphs/text are removed.
* Backend and local recovery validation accept exactly the empty-string sentinel
  in addition to existing null/default values. This supports previously failed
  drafts without requiring a destructive cleanup or migration. Nonempty unknown
  fonts/sizes remain invalid. The renderer already treats empty strings as default.
* Backend now checks node/mark attribute names instead of silently ignoring
  arbitrary metadata. It retains supported link attributes including title.
* Ordered-list `type` was parsed by installed Tiptap and accepted by recovery,
  but omitted by the PDF HTML renderer. It is now validated and rendered using
  the restricted `1/a/A/i/I` enum. A small extension of the installed OrderedList renderer uses the same fixed CSS marker styles in Writer, avoiding Tailwind resets and case-insensitive HTML attribute selectors. No export pipeline changes.
* Backend logs controlled path/type/reason/attribute metadata and the owned
  document ID. It never logs document text, URLs, or arbitrary attribute values.
  Public errors remain generic. Size/node/depth limits remain unchanged.

## Schema comparison

| Node/mark | Current Writer attributes | Backend/recovery treatment |
|---|---|---|
| doc, bulletList, listItem, text, hardBreak, pageBreak | None | Existing structures retained; listItem begins with paragraph |
| paragraph | textAlign | null or left/center/right/justify |
| heading | textAlign, level | Same alignment; levels 1–3 |
| orderedList | start, type | Start 1–10000; null or 1/a/A/i/I; numbering rendered |
| bold, italic, underline | None | Accepted |
| link | href, target, rel, class, title | Safe http/https/mailto href; renderer escapes href and controls rel |
| textStyle | fontFamily, fontSize | Approved spec values, null/absent, legacy empty strings |
| color/backgroundColor/highlight/external metadata | No enabled extension | Not added to Writer; unknown attrs rejected |

Installed ProseMirror: model **1.25.12**, view **1.42.6**. Reviewed installed
extension source rather than assuming latest-version behavior. Reference:
[ProseMirror paste/schema API](https://prosemirror.net/docs/ref/) and
[Tiptap TextStyle](https://tiptap.dev/docs/editor/extensions/marks/text-style).

## Verification

* `writer-validation.spec.ts`: captured excerpt, safe diagnostics, immutable input,
  invalid nodes/URLs/attrs/fonts, size limit, nested and typed ordered lists.
* `scripts/writer/paste-browser.cjs`: actual Writer + real isolated Nest/Mongo API;
  forced HTTP 400 keeps legacy empty-style JSON in IndexedDB; closing/reopening
  offers recovery, recovery saves successfully. Substantial Google Docs-style HTML
  passed through the actual paste pipeline, typing, autosave, refresh JSON equality,
  backend Chromium PDF generation, and invalid-node HTTP 400 all passed.
* This browser test uses representative HTML and the user-supplied serialized
  excerpt. It does **not** claim a fresh copy from a live Google Docs account.
* Existing recovery and save-queue regressions retained.

No changes to PDF editor, pagination, recovery storage/lifecycle, authentication,
billing, lazy routing, document library, or storage architecture.

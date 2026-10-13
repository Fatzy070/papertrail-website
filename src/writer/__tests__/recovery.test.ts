import test from "node:test";
import assert from "node:assert/strict";
import { getSchema } from "@tiptap/core";
import { Node as PMNode } from "@tiptap/pm/model";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle, FontFamily, FontSize } from "@tiptap/extension-text-style";
import { PageBreak } from "../pagination";
import { RecoverySession } from "../recovery-session";
import {
  validRecovery,
  recoveryKind,
} from "../recovery-validation";
import type { RecoveryDraft } from "../recovery-store";
import type { WriterDocument, WriterSpec } from "../writer.api";
const doc: WriterDocument = {
  id: "document",
  title: "Saved",
  revision: 5,
  schemaVersion: 1,
  updatedAt: new Date().toISOString(),
  content: { type: "doc", content: [{ type: "paragraph" }] },
  pageSettings: {
    size: "A4",
    orientation: "portrait",
    margins: { top: 20, right: 20, bottom: 20, left: 20 },
  },
};
const spec: WriterSpec = {
  version: 1,
  css: "",
  defaultPage: doc.pageSettings,
  pageSizes: { A4: [210, 297], Letter: [215.9, 279.4] },
  highlightColors: [{ name: "Yellow", value: "#fef08a" }],
  fontFamilies: ["Writer Sans", "Writer Serif"],
  fontSizes: [8, 10, 11, 12, 14, 16, 18, 24, 30, 36],
};
const record = (): RecoveryDraft => ({
  ...doc,
  formatVersion: 1,
  accountId: "a",
  documentId: doc.id,
  sessionId: "tab",
  token: "token",
  baseRevision: 5,
  savedLocallyAt: Date.now(),
  lastKnownServerUpdatedAt: doc.updatedAt,
});
const memory = () => {
  let draft: RecoveryDraft | undefined;
  return {
    get draft() {
      return draft;
    },
    async put(value: RecoveryDraft) {
      draft = structuredClone(value);
    },
    async remove(value: Pick<RecoveryDraft, "token">) {
      if (draft?.token === value.token) draft = undefined;
    },
  };
};
const tick = () => new Promise((resolve) => setTimeout(resolve, 5));
test("recovery validation isolates account/document and rejects malformed structure/settings/unsafe links", () => {
  assert.equal(validRecovery(record(), "a", doc.id, spec), true);
  assert.equal(validRecovery(record(), "b", doc.id, spec), false);
  assert.equal(validRecovery(record(), "a", "other", spec), false);
  for (const content of [
    { type: "doc", content: [{ type: "unknown" }] },
    {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "x",
              marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }],
            },
          ],
        },
      ],
    },
    { type: "doc", content: [{ type: "paragraph", content: "broken" }] },
  ])
    assert.equal(
      validRecovery({ ...record(), content }, "a", doc.id, spec),
      false,
    );
  assert.equal(
    validRecovery(
      {
        ...record(),
        pageSettings: { ...doc.pageSettings, margins: { top: -1 } },
      },
      "a",
      doc.id,
      spec,
    ),
    false,
  );
  assert.equal(
    validRecovery({ ...record(), baseRevision: 0 }, "a", doc.id, spec),
    false,
  );
});
test("detection distinguishes identical, unsaved and newer server state without modifying server", () => {
  assert.equal(recoveryKind(record(), doc), "saved");
  const unsaved = { ...record(), title: "Unsaved" };
  assert.equal(recoveryKind(unsaved, doc), "unsaved");
  assert.equal(recoveryKind(unsaved, { ...doc, revision: 6 }), "conflict");
  assert.equal(doc.title, "Saved");
});
test("successful exact save clears only matching recovery state", async () => {
  const store = memory();
  const session = new RecoverySession("a", doc, () => assert.fail(), store);
  const a = { ...doc, title: "A" };
  session.update(a);
  await session.flush();
  assert.equal(store.draft?.title, "A");
  session.saved(a, { revision: 6, updatedAt: doc.updatedAt });
  await tick();
  assert.equal(store.draft, undefined);
  session.dispose();
});
test("save A cannot delete newer local B; B receives new server revision baseline", async () => {
  const store = memory();
  const session = new RecoverySession("a", doc, () => assert.fail(), store);
  const a = { ...doc, title: "A" },
    b = { ...doc, title: "B" };
  session.update(a);
  await session.flush();
  session.update(b);
  await session.flush();
  session.saved(a, { revision: 6, updatedAt: doc.updatedAt });
  await tick();
  assert.equal(store.draft?.title, "B");
  assert.equal(store.draft?.baseRevision, 6);
  session.saved(b, { revision: 7, updatedAt: doc.updatedAt });
  await tick();
  assert.equal(store.draft, undefined);
  session.dispose();
});
test("late storage write finishes before exact save cleanup", async () => {
  const store = memory();
  let release!: () => void;
  const storage = {
    remove: store.remove,
    async put(value: RecoveryDraft) {
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      await store.put(value);
    },
  };
  const session = new RecoverySession("a", doc, () => assert.fail(), storage);
  const a = { ...doc, title: "A" };
  session.update(a);
  const pending = session.flush();
  await tick();
  session.saved(a, { revision: 6, updatedAt: doc.updatedAt });
  release();
  await pending;
  await tick();
  assert.equal(store.draft, undefined);
  session.dispose();
});
test("storage failure is reported without preventing server save acknowledgement", async () => {
  let failures = 0;
  const session = new RecoverySession("a", doc, () => failures++, {
    async put() {
      throw new Error("quota");
    },
    async remove() {},
  });
  const a = { ...doc, title: "A" };
  session.update(a);
  await assert.rejects(session.flush());
  session.saved(a, { revision: 6, updatedAt: doc.updatedAt });
  await tick();
  assert.ok(failures >= 1);
  session.dispose();
});
test("recovering keeps source draft if durable transfer fails", async () => {
  let removed = false;
  const session = new RecoverySession("a", doc, () => {}, {
    async put() {
      throw new Error("quota");
    },
    async remove() {
      removed = true;
    },
  });
  await session.adopt(doc, record());
  assert.equal(removed, false);
  session.saved(doc, { revision: 6, updatedAt: doc.updatedAt });
  await tick();
  session.dispose();
});
test("continuous edits are locally checkpointed within one second", async () => {
  const store = memory();
  const session = new RecoverySession("a", doc, () => assert.fail(), store);
  for (let i = 0; i < 12; i++) {
    session.update({ ...doc, title: `Draft ${i}` });
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.ok(store.draft);
  await session.flush();
  assert.equal(store.draft?.title, "Draft 11");
  session.dispose();
});

test("normalized Tiptap links with optional title remain recoverable", () => {
  const draft = {
    ...record(),
    content: {
      type: "doc",
      content: [
        {
          type: "paragraph",
          attrs: { textAlign: null },
          content: [
            {
              type: "text",
              text: "Papertrail",
              marks: [
                {
                  type: "link",
                  attrs: {
                    href: "https://example.com",
                    target: "_blank",
                    rel: "noopener noreferrer nofollow",
                    class: null,
                    title: null,
                  },
                },
              ],
            },
          ],
        },
      ],
    },
  };
  assert.equal(validRecovery(draft, "a", doc.id, spec), true);
});

// Same schema-relevant extension configuration as WriterPage (pagination plugins add no schema).
const schema = getSchema([
  StarterKit.configure({
    heading: { levels: [1, 2, 3] },
    blockquote: false,
    code: false,
    codeBlock: false,
    horizontalRule: false,
    strike: false,
    link: { openOnClick: false, protocols: ["http", "https", "mailto"] },
  }),
  TextStyle,
  FontFamily,
  FontSize,
  TextAlign.configure({ types: ["heading", "paragraph"] }),
  PageBreak,
]);
/** Actual installed-Tiptap serialization: parse through the schema, check, re-serialize. */
const serialize = (json: unknown) => {
  const node = PMNode.fromJSON(schema, json);
  node.check();
  return node.toJSON() as WriterDocument["content"];
};
const linkText = (attrs: Record<string, unknown>) =>
  serialize({
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "Papertrail",
            marks: [{ type: "link", attrs }],
          },
        ],
      },
    ],
  });
const withContent = (content: unknown) => ({ ...record(), content });
test("installed Tiptap link serialization (title null/''/'Example') is accepted and round-trips", () => {
  const defaults = schema
    .text("x", [schema.marks.link.create({ href: "https://example.com" })])
    .toJSON() as { marks: { attrs: Record<string, unknown> }[] };
  // Guards the exact shape the validator must track if Tiptap changes link attrs.
  assert.deepEqual(
    { ...defaults.marks[0].attrs },
    {
      href: "https://example.com",
      target: "_blank",
      rel: "noopener noreferrer nofollow",
      class: null,
      title: null,
    },
  );
  for (const title of [null, "", "Example"]) {
    const content = linkText({ href: "https://example.com", title });
    assert.equal(
      validRecovery(withContent(content), "a", doc.id, spec),
      true,
      `title ${title}`,
    );
    // Restored content is identical after passing back through the editor schema.
    assert.deepEqual(serialize(content), content);
  }
  assert.equal(
    validRecovery(
      withContent(linkText({ href: "mailto:a@example.com" })),
      "a",
      doc.id,
      spec,
    ),
    true,
  );
});
test("malformed or unsafe link marks are still rejected", () => {
  const base = linkText({ href: "https://example.com" }) as {
    content: { content: { marks: { attrs: Record<string, unknown> }[] }[] }[];
  };
  const mutate = (change: (attrs: Record<string, unknown>) => unknown) => {
    const copy = structuredClone(base);
    const mark = copy.content[0].content[0].marks[0] as Record<string, unknown>;
    mark.attrs = change({ ...(mark.attrs as Record<string, unknown>) });
    return withContent(copy);
  };
  for (const bad of [
    mutate((a) => ({ ...a, href: "javascript:alert(1)" })),
    mutate((a) => ({ ...a, href: "data:text/html,x" })),
    mutate((a) => ({ ...a, href: "/relative" })),
    mutate((a) => ({ ...a, href: null })),
    mutate((a) => ({ ...a, title: 5 })),
    mutate((a) => ({ ...a, title: { nested: true } })),
    mutate((a) => ({ ...a, title: "x".repeat(257) })),
    mutate((a) => ({ ...a, onclick: "alert(1)" })),
    mutate((a) => ({ ...a, style: "color:red" })),
    mutate(() => ["https://example.com"]),
  ])
    assert.equal(validRecovery(bad, "a", doc.id, spec), false);
});
test("representative mixed-format Writer document from the real schema is accepted unchanged", () => {
  const style = (fontFamily: string | null, fontSize: string | null) => ({
    type: "textStyle",
    attrs: { fontFamily, fontSize },
  });
  const content = serialize({
    type: "doc",
    content: [
      {
        type: "heading",
        attrs: { level: 1, textAlign: "center" },
        content: [{ type: "text", text: "Title" }],
      },
      {
        type: "heading",
        attrs: { level: 3 },
        content: [{ type: "text", text: "Sub" }],
      },
      {
        type: "paragraph",
        attrs: { textAlign: "justify" },
        content: [
          { type: "text", text: "bold ", marks: [{ type: "bold" }] },
          { type: "text", text: "italic ", marks: [{ type: "italic" }] },
          { type: "text", text: "under ", marks: [{ type: "underline" }] },
          {
            type: "text",
            text: "serif18",
            marks: [style("Writer Serif", "18pt")],
          },
          { type: "hardBreak" },
          {
            type: "text",
            text: "link",
            marks: [
              { type: "bold" },
              {
                type: "link",
                attrs: { href: "https://papertrail.example/x?y=1" },
              },
              style(null, "14pt"),
            ],
          },
        ],
      },
      {
        type: "bulletList",
        content: [
          {
            type: "listItem",
            content: [
              { type: "paragraph", content: [{ type: "text", text: "a" }] },
              {
                type: "bulletList",
                content: [
                  { type: "listItem", content: [{ type: "paragraph" }] },
                ],
              },
            ],
          },
        ],
      },
      {
        type: "orderedList",
        attrs: { start: 3 },
        content: [
          {
            type: "listItem",
            content: [
              {
                type: "paragraph",
                attrs: { textAlign: "right" },
                content: [{ type: "text", text: "n" }],
              },
            ],
          },
        ],
      },
      { type: "pageBreak" },
      { type: "paragraph" },
    ],
  });
  const draft = {
    ...withContent(content),
    title: "Mixed",
    pageSettings: {
      size: "Letter" as const,
      orientation: "landscape" as const,
      margins: { top: 12, right: 30, bottom: 50, left: 5 },
    },
  };
  assert.equal(validRecovery(draft, "a", doc.id, spec), true);
  assert.deepEqual(serialize(draft.content), content);
  // Unknown node attrs, unapproved fonts and unknown marks stay rejected.
  const json = JSON.stringify(content);
  for (const bad of [
    json.replace('"level":3', '"level":4'),
    json.replace('"Writer Serif"', '"Comic Sans"'),
    json.replace('"18pt"', '"19pt"'),
    json.replace('"type":"italic"', '"type":"strike"'),
    json.replace('"type":"pageBreak"', '"type":"pageBreak","attrs":{"x":1}'),
    json.replace('"start":3', '"start":3,"onclick":"x"'),
  ]) {
    assert.notEqual(bad, json);
    assert.equal(
      validRecovery({ ...draft, content: JSON.parse(bad) }, "a", doc.id, spec),
      false,
    );
  }
});

test("legacy Google Docs empty font attrs remain recoverable but unsupported styles do not", () => {
  const draft = record();
  draft.content = {
    type: "doc",
    content: [
      {
        type: "heading",
        attrs: { textAlign: null, level: 1 },
        content: [
          {
            type: "text",
            text: "Redacted heading",
            marks: [
              { type: "textStyle", attrs: { fontFamily: "", fontSize: "" } },
              { type: "bold" },
            ],
          },
        ],
      },
    ],
  };
  assert.equal(validRecovery(draft, "a", doc.id, spec), true);
  draft.content.content![0].content![0].marks![0].attrs!.fontFamily =
    "Unsupported font";
  assert.equal(validRecovery(draft, "a", doc.id, spec), false);
});

test("official Highlight JSON and six combined inline marks recover; unsafe colors do not", () => {
  const draft = record();
  draft.content = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "Important",
            marks: [
              { type: "highlight", attrs: { color: "#fef08a" } },
              { type: "bold" },
              { type: "italic" },
              { type: "underline" },
              {
                type: "textStyle",
                attrs: { fontSize: "12pt", fontFamily: "Writer Sans" },
              },
              {
                type: "link",
                attrs: { href: "https://example.com", title: null },
              },
            ],
          },
        ],
      },
    ],
  };
  assert.equal(validRecovery(draft, "a", doc.id, spec), true);
  for (const color of [
    "red",
    "javascript:alert(1)",
    "#fef08a;background:url(x)",
    {},
    10,
  ]) {
    draft.content.content![0].content![0].marks![0].attrs!.color = color;
    assert.equal(validRecovery(draft, "a", doc.id, spec), false);
  }
  draft.content.content![0].content![0].marks![0].attrs!.color = null;
  assert.equal(validRecovery(draft, "a", doc.id, spec), true);
});

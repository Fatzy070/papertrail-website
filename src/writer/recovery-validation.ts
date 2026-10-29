import type { WriterDocument, WriterSnapshot, WriterSpec } from "./writer.api";
import type { RecoveryDraft } from "./recovery-store";
const object = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);
const keys = (value: Record<string, unknown>, allowed: string[]) =>
  Object.keys(value).every((key) => allowed.includes(key));
const allowedChildren: Record<string, string[]> = {
  root: ["doc"],
  doc: [
    "paragraph",
    "heading",
    "bulletList",
    "orderedList",
    "pageBreak",
    "horizontalRule",
    "table",
    "image",
  ],
  paragraph: ["text", "hardBreak"],
  heading: ["text", "hardBreak"],
  bulletList: ["listItem"],
  orderedList: ["listItem"],
  listItem: [
    "paragraph",
    "heading",
    "bulletList",
    "orderedList",
    "pageBreak",
    "horizontalRule",
  ],
  table: ["tableRow"],
  tableRow: ["tableHeader", "tableCell"],
  tableHeader: [
    "paragraph",
    "heading",
    "bulletList",
    "orderedList",
    "horizontalRule",
    "image",
  ],
  tableCell: [
    "paragraph",
    "heading",
    "bulletList",
    "orderedList",
    "horizontalRule",
    "image",
  ],
};
const ASSET_ID_RE = /^[a-f0-9]{24}$/i;
const HEX_COLOR_RE = /^#[0-9a-f]{6}$/i;
/** Validate untrusted local data before Tiptap sees it. Limits bound validation work;
 * a larger-than-server-limit draft may still be recovered and shortened by its owner. */
export function validRecovery(
  value: unknown,
  accountId: string,
  documentId: string,
  spec: WriterSpec,
): value is RecoveryDraft {
  try {
    if (
      !object(value) ||
      value.formatVersion !== 1 ||
      value.accountId !== accountId ||
      value.documentId !== documentId ||
      typeof value.sessionId !== "string" ||
      !value.sessionId ||
      typeof value.token !== "string" ||
      !value.token ||
      !Number.isSafeInteger(value.baseRevision) ||
      Number(value.baseRevision) < 1 ||
      typeof value.savedLocallyAt !== "number" ||
      !Number.isFinite(value.savedLocallyAt) ||
      typeof value.lastKnownServerUpdatedAt !== "string" ||
      !Number.isFinite(Date.parse(value.lastKnownServerUpdatedAt)) ||
      typeof value.title !== "string" ||
      value.title.length > 160 ||
      JSON.stringify(value).length > 1_000_000
    )
      return false;
    const settings = value.pageSettings;
    if (
      !object(settings) ||
      !["A4", "Letter"].includes(String(settings.size)) ||
      !["portrait", "landscape"].includes(String(settings.orientation)) ||
      !object(settings.margins)
    )
      return false;
    const margins = settings.margins;
    if (
      !["top", "right", "bottom", "left"].every(
        (key) =>
          typeof margins[key] === "number" &&
          Number.isFinite(margins[key]) &&
          Number(margins[key]) >= 5 &&
          Number(margins[key]) <= 50,
      )
    )
      return false;
    let count = 0;
    const node = (n: unknown, parent: string, depth: number): boolean => {
      if (
        !object(n) ||
        ++count > 10000 ||
        depth > 12 ||
        typeof n.type !== "string" ||
        !allowedChildren[parent]?.includes(n.type) ||
        !keys(n, ["type", "attrs", "content", "marks", "text"])
      )
        return false;
      if (
        n.type === "text"
          ? typeof n.text !== "string" || !n.text || n.content !== undefined
          : n.text !== undefined
      )
        return false;
      if (n.content !== undefined && !Array.isArray(n.content)) return false;
      const children = (n.content ?? []) as unknown[];
      if (
        [
          "doc",
          "listItem",
          "bulletList",
          "orderedList",
          "table",
          "tableRow",
          "tableHeader",
          "tableCell",
        ].includes(n.type) &&
        !children.length
      )
        return false;
      if (
        ["pageBreak", "horizontalRule", "image", "hardBreak"].includes(
          n.type,
        ) &&
        children.length > 0
      )
        return false;
      if (
        n.type === "listItem" &&
        (!object(children[0]) || children[0].type !== "paragraph")
      )
        return false;
      if (n.type === "table" && children.length > 200) return false;
      if (n.type === "tableRow" && children.length > 20) return false;
      const attrs = n.attrs ?? {};
      if (!object(attrs)) return false;
      const nodeAttrs: Record<string, string[]> = {
        heading: ["level", "textAlign"],
        paragraph: ["textAlign"],
        orderedList: ["start", "type"],
        image: ["assetId", "alt", "width", "align"],
        tableHeader: ["colspan", "rowspan", "colwidth"],
        tableCell: ["colspan", "rowspan", "colwidth"],
      };
      if (!keys(attrs, nodeAttrs[n.type] ?? [])) return false;
      if (
        n.type === "heading" &&
        (typeof attrs.level !== "number" || ![1, 2, 3].includes(attrs.level))
      )
        return false;
      if (
        attrs.textAlign != null &&
        !["left", "right", "center", "justify"].includes(
          String(attrs.textAlign),
        )
      )
        return false;
      if (
        attrs.start != null &&
        (!Number.isInteger(attrs.start) ||
          Number(attrs.start) < 1 ||
          Number(attrs.start) > 10000)
      )
        return false;
      if (
        attrs.type != null &&
        !["1", "a", "A", "i", "I"].includes(String(attrs.type))
      )
        return false;
      if (n.type === "image") {
        if (
          typeof attrs.assetId !== "string" ||
          !ASSET_ID_RE.test(attrs.assetId)
        )
          return false;
        if (
          attrs.alt != null &&
          (typeof attrs.alt !== "string" || attrs.alt.length > 256)
        )
          return false;
        if (
          attrs.width != null &&
          (typeof attrs.width !== "number" ||
            !Number.isFinite(attrs.width) ||
            attrs.width < 40 ||
            attrs.width > 1200)
        )
          return false;
        if (
          attrs.align != null &&
          !["left", "center", "right"].includes(String(attrs.align))
        )
          return false;
      }
      if (n.type === "tableHeader" || n.type === "tableCell") {
        if (
          attrs.colspan != null &&
          (!Number.isInteger(attrs.colspan) ||
            Number(attrs.colspan) < 1 ||
            Number(attrs.colspan) > 20)
        )
          return false;
        if (
          attrs.rowspan != null &&
          (!Number.isInteger(attrs.rowspan) ||
            Number(attrs.rowspan) < 1 ||
            Number(attrs.rowspan) > 100)
        )
          return false;
        if (
          attrs.colwidth != null &&
          (!Array.isArray(attrs.colwidth) ||
            attrs.colwidth.length > 20 ||
            !attrs.colwidth.every(
              (w) =>
                typeof w === "number" &&
                Number.isFinite(w) &&
                w >= 20 &&
                w <= 2000,
            ))
        )
          return false;
      }
      if (
        n.marks !== undefined &&
        (!Array.isArray(n.marks) ||
          n.marks.length > 6 ||
          !["text", "hardBreak"].includes(n.type))
      )
        return false;
      const markTypes = new Set<unknown>();
      for (const mark of (n.marks ?? []) as unknown[]) {
        if (
          !object(mark) ||
          ![
            "bold",
            "italic",
            "underline",
            "textStyle",
            "link",
            "highlight",
          ].includes(String(mark.type)) ||
          !keys(mark, ["type", "attrs"])
        )
          return false;
        if (markTypes.has(mark.type)) return false;
        markTypes.add(mark.type);
        const a = mark.attrs ?? {};
        if (!object(a)) return false;
        if (mark.type === "link") {
          if (
            !keys(a, ["href", "target", "rel", "class", "title"]) ||
            typeof a.href !== "string" ||
            a.href.length > 2048 ||
            !["http:", "https:", "mailto:"].includes(new URL(a.href).protocol)
          )
            return false;
          if (
            !["target", "rel", "class", "title"].every(
              (key) =>
                a[key] == null ||
                (typeof a[key] === "string" && String(a[key]).length <= 256),
            )
          )
            return false;
        } else if (mark.type === "highlight") {
          if (
            !keys(a, ["color"]) ||
            (a.color != null &&
              !spec.highlightColors.some(({ value }) => value === a.color))
          )
            return false;
        } else if (mark.type === "textStyle") {
          const colorStr = typeof a.color === "string" ? a.color : "";
          const validColor =
            a.color == null ||
            a.color === "" ||
            (typeof a.color === "string" &&
              (spec.textColors
                ? spec.textColors.some(
                    ({ value: c }) =>
                      c.toLowerCase() === colorStr.toLowerCase(),
                  )
                : HEX_COLOR_RE.test(colorStr)));
          if (
            !keys(a, ["fontFamily", "fontSize", "color"]) ||
            (a.fontFamily != null &&
              a.fontFamily !== "" &&
              !spec.fontFamilies.includes(String(a.fontFamily))) ||
            (a.fontSize != null &&
              a.fontSize !== "" &&
              !spec.fontSizes.some((size) => `${size}pt` === a.fontSize)) ||
            !validColor
          )
            return false;
        } else if (Object.keys(a).length) return false;
      }
      return children.every((child) =>
        node(child, n.type as string, depth + 1),
      );
    };
    return node(value.content, "root", 0);
  } catch {
    return false;
  }
}
const canonical = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (object(value))
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
      .join(",")}}`;
  return JSON.stringify(value);
};
export function sameSnapshot(a: WriterSnapshot, b: WriterSnapshot) {
  return (
    (a.title.trim() || "Untitled document") ===
      (b.title.trim() || "Untitled document") &&
    canonical(a.content) === canonical(b.content) &&
    canonical(a.pageSettings) === canonical(b.pageSettings)
  );
}
export function recoveryKind(draft: RecoveryDraft, server: WriterDocument) {
  return sameSnapshot(draft, server)
    ? "saved"
    : draft.baseRevision === server.revision
      ? "unsaved"
      : "conflict";
}

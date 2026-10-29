import { createRequire } from "node:module";
import type { Plugin } from "vite";

/** tiptap-pagination-plus 3.1.0 mixes a viewport-pixel delta with an unscaled
 * page height. Normalize ONLY that delta at the dependency boundary. Its page
 * algorithm, page dimensions, document, and decorations are otherwise untouched.
 * Excluding it from prebundling makes the same checked patch run in dev/build. */
export function writerPaginationZoom(): Plugin {
  const require = createRequire(import.meta.url);
  const { version } = require("tiptap-pagination-plus/package.json") as {
    version: string;
  };
  const original =
    "const lastPageGap = lastElementRect.bottom -\n                lastPageBreakRect.bottom;";
  const replacement = `const viewScale = editorDom.getBoundingClientRect().width / editorDom.offsetWidth || 1;
            const lastPageGap = (lastElementRect.bottom - lastPageBreakRect.bottom) / viewScale;`;
  return {
    name: "writer-pagination-document-coordinates",
    enforce: "pre",
    config: () => ({
      optimizeDeps: {
        exclude: ["tiptap-pagination-plus"],
        // The unbundled pagination module must import the SAME optimized PM
        // classes as Tiptap. A second DecorationSet copy fails instanceof
        // checks inside DecorationGroup and crashes with `localsInner`.
        include: [
          "@tiptap/core",
          "@tiptap/pm/state",
          "@tiptap/pm/view",
          "@tiptap/pm/transform",
          "@tiptap/pm/tables",
        ],
      },
      resolve: {
        dedupe: [
          "@tiptap/core",
          "@tiptap/pm",
          "prosemirror-view",
          "prosemirror-state",
          "prosemirror-model",
          "prosemirror-transform",
          "prosemirror-tables",
        ],
      },
    }),
    transform(code, id) {
      if (
        !id
          .replaceAll("\\", "/")
          .endsWith("/tiptap-pagination-plus/dist/PaginationPlus.js")
      )
        return;
      if (version !== "3.1.0" || code.split(original).length !== 2)
        throw new Error(
          "Writer pagination dependency changed: review the view-coordinate compatibility patch before enabling zoom.",
        );
      return { code: code.replace(original, replacement), map: null };
    },
  };
}

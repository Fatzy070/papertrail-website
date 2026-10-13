import { Node, Extension } from "@tiptap/core";
import { Plugin } from "@tiptap/pm/state";
import { PaginationPlus } from "tiptap-pagination-plus";
import type { PageSettings, WriterSpec } from "./writer.api";

const px = (mm: number) => (mm * 96) / 25.4;
export function pageDimensions(settings: PageSettings, spec: WriterSpec) {
  const [w, h] = spec.pageSizes[settings.size];
  return settings.orientation === "portrait"
    ? { width: px(w), height: px(h) }
    : { width: px(h), height: px(w) };
}
export function paginationOptions(settings: PageSettings, spec: WriterSpec) {
  const { width, height } = pageDimensions(settings, spec);
  return {
    pageWidth: width,
    pageHeight: height,
    pageGap: 24,
    pageGapBorderSize: 0,
    pageBreakBackground: "var(--writer-desk)",
    pageGapBorderColor: "transparent",
    marginTop: px(settings.margins.top),
    marginBottom: px(settings.margins.bottom),
    marginLeft: px(settings.margins.left),
    marginRight: px(settings.margins.right),
    contentMarginTop: 0,
    contentMarginBottom: 0,
    headerLeft: "",
    headerRight: "",
    footerLeft: "",
    footerRight: "",
  };
}
export { PaginationPlus };
export const PageBreak = Node.create({
  name: "pageBreak",
  group: "block",
  atom: true,
  selectable: true,
  parseHTML: () => [{ tag: "div[data-page-break]" }],
  renderHTML: () => [
    "div",
    { "data-page-break": "true", "aria-label": "Page break" },
  ],
  addKeyboardShortcuts() {
    return {
      "Mod-Enter": () =>
        this.editor.commands.insertContent([
          { type: "pageBreak" },
          { type: "paragraph" },
        ]),
    };
  },
});
/** Manual breaks are layout-only spacers. They never split or rewrite document nodes. */
export const ManualBreakLayout = Extension.create({
  name: "writerBreakLayout",
  addProseMirrorPlugins() {
    const editor = this.editor;
    return [
      new Plugin({
        view(view) {
          let frame = 0;
          let dead = false;
          const layout = () => {
            frame = 0;
            if (dead || view.composing) return;
            const start = performance.now();
            const options = editor.storage.PaginationPlus;
            const rect = view.dom.getBoundingClientRect();
            const scale = rect.width / view.dom.offsetWidth || 1;
            const pitch = options.pageHeight + options.pageGap;
            let changed = false;
            for (const element of view.dom.querySelectorAll<HTMLElement>(
              "[data-page-break]",
            )) {
              const top =
                (element.getBoundingClientRect().top - rect.top) / scale;
              const next =
                (Math.floor((top + 0.5) / pitch) + 1) * pitch +
                options.marginTop;
              const height = Math.max(1, next - top);
              if (
                Math.abs(parseFloat(element.style.height || "0") - height) > 0.5
              ) {
                element.style.height = `${height}px`;
                changed = true;
              }
            }
            view.dom.dataset.layoutMs = String(performance.now() - start);
            if (changed)
              view.dispatch(
                view.state.tr
                  .setMeta("writer-layout", true)
                  .setMeta("addToHistory", false),
              );
          };
          const schedule = () => {
            if (!frame && !dead) frame = requestAnimationFrame(layout);
          };
          void document.fonts.ready.then(() => {
            if (!dead) {
              view.dispatch(view.state.tr.setMeta("writer-fonts", true));
              schedule();
            }
          });
          const observer = new ResizeObserver(schedule);
          observer.observe(view.dom);
          view.dom.addEventListener("compositionend", schedule);
          schedule();
          return {
            update: schedule,
            destroy() {
              dead = true;
              cancelAnimationFrame(frame);
              observer.disconnect();
              view.dom.removeEventListener("compositionend", schedule);
            },
          };
        },
      }),
    ];
  },
});

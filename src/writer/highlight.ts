import Highlight from "@tiptap/extension-highlight";
import type { WriterSpec } from "./writer.api";

export function writerHighlight(spec: Pick<WriterSpec, "highlightColors">) {
  const palette = spec.highlightColors;
  let context: CanvasRenderingContext2D | null | undefined;
  // Browser CSS parsing resolves named/rgb/hex colors. Only opaque colors are
  // mapped; unsupported expressions and transparent backgrounds are discarded.
  const normalize = (value: string): string | null => {
    if (
      !value ||
      !CSS.supports("color", value) ||
      /var\(|currentcolor|inherit/i.test(value)
    )
      return null;
    context ??= document.createElement("canvas").getContext("2d");
    if (!context) return null;
    context.fillStyle = "#000000";
    context.fillStyle = value;
    const color = context.fillStyle;
    if (!/^#[\da-f]{6}$/i.test(color)) return null;
    const rgb = (hex: string) =>
      [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    const source = rgb(color);
    return (
      [...palette].sort((a, b) => {
        const distance = (hex: string) =>
          rgb(hex).reduce((sum, v, i) => sum + (v - source[i]) ** 2, 0);
        return distance(a.value) - distance(b.value);
      })[0]?.value ?? null
    );
  };
  const colorFor = (element: HTMLElement) =>
    normalize(
      element.getAttribute("data-color") || element.style.backgroundColor,
    );
  return Highlight.extend({
    addAttributes() {
      return {
        color: { default: null, parseHTML: (element) => colorFor(element) },
      };
    },
    parseHTML() {
      return [
        {
          tag: "mark",
          getAttrs: (element) =>
            !element.getAttribute("data-color") &&
            !element.style.backgroundColor
              ? null
              : colorFor(element)
                ? null
                : false,
        },
        {
          tag: "span[style]",
          getAttrs: (element) => (colorFor(element) ? null : false),
        },
      ];
    },
    renderHTML({ mark }) {
      const color =
        palette.find((item) => item.value === mark.attrs.color) ?? palette[0];
      return [
        "mark",
        {
          "data-color": color.value,
          style: `background-color:${color.value};color:inherit`,
        },
        0,
      ];
    },
  }).configure({ multicolor: true });
}

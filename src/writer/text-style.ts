import { Color, FontFamily, FontSize } from "@tiptap/extension-text-style";
import type { WriterSpec } from "./writer.api";

/** CSSStyleDeclaration returns "" for absent styles. Keep the canonical JSON
 * null/default instead, and constrain imported styles to our rendering spec. */
export function writerFontExtensions(
  spec: Pick<WriterSpec, "fontFamilies" | "fontSizes" | "textColors">,
) {
  const extensions = [
    FontFamily.extend({
      addGlobalAttributes() {
        return [
          {
            types: ["textStyle"],
            attributes: {
              fontFamily: {
                ...this.parent?.()[0].attributes.fontFamily,
                parseHTML: (element: HTMLElement) => {
                  const family = element.style.fontFamily.replace(/["']/g, "");
                  return spec.fontFamilies.includes(family) ? family : null;
                },
              },
            },
          },
        ];
      },
    }),
    FontSize.extend({
      addGlobalAttributes() {
        return [
          {
            types: ["textStyle"],
            attributes: {
              fontSize: {
                ...this.parent?.()[0].attributes.fontSize,
                parseHTML: (element: HTMLElement) => {
                  const size = element.style.fontSize;
                  return spec.fontSizes.some((value) => `${value}pt` === size)
                    ? size
                    : null;
                },
              },
            },
          },
        ];
      },
    }),
  ];

  if (spec.textColors?.length) {
    const palette = spec.textColors;
    extensions.push(
      Color.extend({
        addGlobalAttributes() {
          return [
            {
              types: ["textStyle"],
              attributes: {
                color: {
                  ...this.parent?.()[0].attributes.color,
                  parseHTML: (element: HTMLElement) => {
                    const raw = element.style.color?.trim().toLowerCase();
                    if (!raw) return null;
                    const exact = palette.find(
                      (c) => c.value.toLowerCase() === raw,
                    );
                    return exact ? exact.value : null;
                  },
                },
              },
            },
          ];
        },
      }),
    );
  }

  return extensions;
}

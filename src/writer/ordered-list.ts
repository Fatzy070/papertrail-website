import { OrderedList } from "@tiptap/extension-list";
import { mergeAttributes } from "@tiptap/core";

// Inline marker style survives Tailwind's list reset. HTML `type` selectors are
// case-insensitive, although lowercase/uppercase numbering have different meanings.
export const WriterOrderedList = OrderedList.extend({
  renderHTML({ HTMLAttributes }) {
    const styles: Record<string, string> = {
      "1": "decimal",
      a: "lower-alpha",
      A: "upper-alpha",
      i: "lower-roman",
      I: "upper-roman",
    };
    return [
      "ol",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        style: `list-style-type: ${styles[HTMLAttributes.type as string] ?? "decimal"}`,
      }),
      0,
    ];
  },
});

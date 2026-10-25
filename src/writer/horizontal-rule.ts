import HorizontalRule from "@tiptap/extension-horizontal-rule";
import { nodeInputRule } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";

/**
 * HorizontalRule extension for Papertrail Writer.
 * Supports toolbar insertion (`setHorizontalRule`) as well as typing `---`
 * followed by Enter (or Space) to insert a horizontal divider.
 */
export const WriterHorizontalRule = HorizontalRule.extend({
  addInputRules() {
    return [
      nodeInputRule({
        find: /^(?:---\s|___\s|\*\*\*\s)$/,
        type: this.type,
      }),
    ];
  },
  addKeyboardShortcuts() {
    return {
      Enter: ({ editor }) => {
        const { state, view } = editor;
        const { selection } = state;
        if (!selection.empty) return false;
        const { $from } = selection;
        const parent = $from.parent;
        if (parent.type.name !== "paragraph") return false;
        const text = parent.textContent;
        if (!/^(?:---|___|\*\*\*)$/.test(text)) return false;

        const hrType = state.schema.nodes.horizontalRule;
        const pType = state.schema.nodes.paragraph;
        if (!hrType || !pType) return false;

        const from = $from.before();
        const to = $from.after();
        const hrNode = hrType.create();
        const pNode = pType.create();
        const tr = state.tr.replaceWith(from, to, [hrNode, pNode]);
        const targetPos = Math.min(
          tr.doc.content.size,
          from + hrNode.nodeSize + 1,
        );
        tr.setSelection(TextSelection.create(tr.doc, targetPos));
        tr.scrollIntoView();
        view.dispatch(tr);
        return true;
      },
    };
  },
});

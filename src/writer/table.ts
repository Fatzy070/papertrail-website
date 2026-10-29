import { Node, mergeAttributes } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
import {
  tableEditing,
  goToNextCell,
  addColumnBefore,
  addColumnAfter,
  deleteColumn,
  addRowBefore,
  addRowAfter,
  deleteRow,
  deleteTable,
  toggleHeaderRow,
  isInTable,
} from "@tiptap/pm/tables";

declare module "@tiptap/core" {
  interface NodeConfig<Options, Storage> {
    tableRole?:
      | string
      | ((this: {
          name: string;
          options: Options;
          storage: Storage;
        }) => string);
  }
  interface Commands<ReturnType> {
    writerTable: {
      insertTable: (options?: {
        rows?: number;
        cols?: number;
        withHeaderRow?: boolean;
      }) => ReturnType;
      addTableColumnBefore: () => ReturnType;
      addTableColumnAfter: () => ReturnType;
      deleteTableColumn: () => ReturnType;
      addTableRowBefore: () => ReturnType;
      addTableRowAfter: () => ReturnType;
      deleteTableRow: () => ReturnType;
      deleteWriterTable: () => ReturnType;
      toggleTableHeaderRow: () => ReturnType;
    };
  }
}

export const WriterTable = Node.create({
  name: "table",
  group: "block",
  content: "tableRow+",
  tableRole: "table",
  isolating: true,
  parseHTML() {
    return [{ tag: "table" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["table", mergeAttributes(HTMLAttributes), ["tbody", 0]];
  },
  addCommands() {
    return {
      insertTable:
        ({ rows = 3, cols = 3, withHeaderRow = true } = {}) =>
        ({ state, dispatch, tr }) => {
          const safeRows = Math.max(1, Math.min(20, Math.floor(rows)));
          const safeCols = Math.max(1, Math.min(10, Math.floor(cols)));
          const { schema } = state;
          const tableType = schema.nodes.table;
          const rowType = schema.nodes.tableRow;
          const cellType = schema.nodes.tableCell;
          const headerType = schema.nodes.tableHeader;
          const paragraphType = schema.nodes.paragraph;
          if (!tableType || !rowType || !cellType || !headerType || !paragraphType) {
            return false;
          }
          const rowNodes = [];
          for (let r = 0; r < safeRows; r++) {
            const cells = [];
            const cType = withHeaderRow && r === 0 ? headerType : cellType;
            for (let c = 0; c < safeCols; c++) {
              cells.push(
                cType.create(
                  { colspan: 1, rowspan: 1, colwidth: null },
                  paragraphType.create(),
                ),
              );
            }
            rowNodes.push(rowType.create(null, cells));
          }
          const tableNode = tableType.create(null, rowNodes);
          if (dispatch) {
            const insertPos = tr.selection.from;
            tr.replaceSelectionWith(tableNode);
            // Place cursor inside the first cell of the newly inserted table
            const resolved = tr.doc.resolve(
              Math.min(insertPos + 4, tr.doc.content.size),
            );
            tr.setSelection(TextSelection.near(resolved, 1));
            tr.scrollIntoView();
          }
          return true;
        },
      addTableColumnBefore:
        () =>
        ({ state, dispatch }) =>
          addColumnBefore(state, dispatch),
      addTableColumnAfter:
        () =>
        ({ state, dispatch }) =>
          addColumnAfter(state, dispatch),
      deleteTableColumn:
        () =>
        ({ state, dispatch }) =>
          deleteColumn(state, dispatch),
      addTableRowBefore:
        () =>
        ({ state, dispatch }) =>
          addRowBefore(state, dispatch),
      addTableRowAfter:
        () =>
        ({ state, dispatch }) =>
          addRowAfter(state, dispatch),
      deleteTableRow:
        () =>
        ({ state, dispatch }) =>
          deleteRow(state, dispatch),
      deleteWriterTable:
        () =>
        ({ state, dispatch }) =>
          deleteTable(state, dispatch),
      toggleTableHeaderRow:
        () =>
        ({ state, dispatch }) =>
          toggleHeaderRow(state, dispatch),
    };
  },
  addKeyboardShortcuts() {
    return {
      Tab: () => {
        const { state, view } = this.editor;
        if (!isInTable(state)) return false;
        if (goToNextCell(1)(state, view.dispatch)) return true;
        // At the last cell of the table: add a new row and move into it
        if (addRowAfter(state, view.dispatch)) {
          return goToNextCell(1)(this.editor.state, view.dispatch);
        }
        return false;
      },
      "Shift-Tab": () => {
        const { state, view } = this.editor;
        if (!isInTable(state)) return false;
        return goToNextCell(-1)(state, view.dispatch);
      },
    };
  },
  addProseMirrorPlugins() {
    return [tableEditing()];
  },
});

export const WriterTableRow = Node.create({
  name: "tableRow",
  content: "(tableCell | tableHeader)+",
  tableRole: "row",
  parseHTML() {
    return [{ tag: "tr" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["tr", mergeAttributes(HTMLAttributes), 0];
  },
});

const cellAttributes = {
  colspan: {
    default: 1,
    parseHTML: (element: HTMLElement) => {
      const val = Number(element.getAttribute("colspan") || 1);
      return Number.isInteger(val) && val >= 1 && val <= 20 ? val : 1;
    },
    renderHTML: (attributes: Record<string, unknown>) =>
      typeof attributes.colspan === "number" && attributes.colspan > 1
        ? { colspan: attributes.colspan }
        : {},
  },
  rowspan: {
    default: 1,
    parseHTML: (element: HTMLElement) => {
      const val = Number(element.getAttribute("rowspan") || 1);
      return Number.isInteger(val) && val >= 1 && val <= 100 ? val : 1;
    },
    renderHTML: (attributes: Record<string, unknown>) =>
      typeof attributes.rowspan === "number" && attributes.rowspan > 1
        ? { rowspan: attributes.rowspan }
        : {},
  },
  colwidth: {
    default: null,
    parseHTML: (element: HTMLElement) => {
      const attr = element.getAttribute("data-colwidth");
      if (!attr) return null;
      const widths = attr.split(",").map(Number);
      return widths.every((w) => Number.isFinite(w) && w >= 20 && w <= 2000)
        ? widths
        : null;
    },
    renderHTML: (attributes: Record<string, unknown>) =>
      Array.isArray(attributes.colwidth) && attributes.colwidth.length > 0
        ? { "data-colwidth": attributes.colwidth.join(",") }
        : {},
  },
};

export const WriterTableHeader = Node.create({
  name: "tableHeader",
  content: "(paragraph | heading | bulletList | orderedList | horizontalRule | image)+",
  tableRole: "header_cell",
  isolating: true,
  addAttributes() {
    return cellAttributes;
  },
  parseHTML() {
    return [{ tag: "th" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["th", mergeAttributes(HTMLAttributes), 0];
  },
});

export const WriterTableCell = Node.create({
  name: "tableCell",
  content: "(paragraph | heading | bulletList | orderedList | horizontalRule | image)+",
  tableRole: "cell",
  isolating: true,
  addAttributes() {
    return cellAttributes;
  },
  parseHTML() {
    return [{ tag: "td" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["td", mergeAttributes(HTMLAttributes), 0];
  },
});

export const writerTableExtensions = [
  WriterTable,
  WriterTableRow,
  WriterTableHeader,
  WriterTableCell,
];

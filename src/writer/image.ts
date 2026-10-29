import { Node } from "@tiptap/core";
import { NodeSelection } from "@tiptap/pm/state";

export interface WriterImageAttrs {
  assetId: string;
  alt?: string | null;
  width?: number | null;
  align?: "left" | "center" | "right" | null;
}

export interface WriterImageLoaderOptions {
  documentId: string;
  fetchAssetObjectUrl: (documentId: string, assetId: string) => Promise<string>;
  invalidateAssetUrl?: (documentId: string, assetId: string) => void;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    writerImage: {
      insertWriterImage: (attrs: WriterImageAttrs) => ReturnType;
      updateWriterImage: (attrs: Partial<WriterImageAttrs>) => ReturnType;
      removeWriterImage: () => ReturnType;
    };
  }
}

export function createWriterImageExtension(loader?: WriterImageLoaderOptions) {
  return Node.create({
    name: "image",
    group: "block",
    atom: true,
    selectable: true,
    draggable: true,
    addAttributes() {
      return {
        assetId: {
          default: null,
          parseHTML: (el: HTMLElement) =>
            el.getAttribute("data-asset-id") || null,
          renderHTML: (attrs: Record<string, unknown>) =>
            attrs.assetId ? { "data-asset-id": String(attrs.assetId) } : {},
        },
        alt: {
          default: null,
          parseHTML: (el: HTMLElement) =>
            el.querySelector("img")?.getAttribute("alt") ||
            el.getAttribute("data-alt") ||
            null,
          renderHTML: (attrs: Record<string, unknown>) =>
            attrs.alt ? { "data-alt": String(attrs.alt) } : {},
        },
        width: {
          default: null,
          parseHTML: (el: HTMLElement) => {
            const raw =
              el.getAttribute("data-width") ||
              el.querySelector("img")?.getAttribute("width");
            const num = raw ? Number(raw) : NaN;
            return Number.isFinite(num) && num >= 40 && num <= 1200
              ? Math.round(num)
              : null;
          },
          renderHTML: (attrs: Record<string, unknown>) =>
            typeof attrs.width === "number"
              ? { "data-width": String(Math.round(attrs.width)) }
              : {},
        },
        align: {
          default: "left",
          parseHTML: (el: HTMLElement) => {
            const a = el.getAttribute("data-align");
            return a === "center" || a === "right" ? a : "left";
          },
          renderHTML: (attrs: Record<string, unknown>) => ({
            "data-align":
              attrs.align === "center" || attrs.align === "right"
                ? attrs.align
                : "left",
          }),
        },
      };
    },
    parseHTML() {
      return [{ tag: "figure.writer-image[data-asset-id]" }];
    },
    renderHTML({ HTMLAttributes }) {
      const align =
        HTMLAttributes["data-align"] === "center" ||
        HTMLAttributes["data-align"] === "right"
          ? (HTMLAttributes["data-align"] as string)
          : "left";
      return [
        "figure",
        {
          class: "writer-image",
          "data-asset-id": HTMLAttributes["data-asset-id"],
          "data-align": align,
          ...(HTMLAttributes["data-width"]
            ? { "data-width": HTMLAttributes["data-width"] }
            : {}),
          ...(HTMLAttributes["data-alt"]
            ? { "data-alt": HTMLAttributes["data-alt"] }
            : {}),
        },
      ];
    },
    addCommands() {
      return {
        insertWriterImage:
          (attrs) =>
          ({ chain }) =>
            chain()
              .focus()
              .insertContent([
                {
                  type: "image",
                  attrs: {
                    assetId: attrs.assetId,
                    alt: attrs.alt ?? null,
                    width: attrs.width ?? null,
                    align: attrs.align ?? "center",
                  },
                },
                { type: "paragraph" },
              ])
              .run(),
        updateWriterImage:
          (attrs) =>
          ({ state, dispatch }) => {
            const { selection } = state;
            if (
              selection instanceof NodeSelection &&
              selection.node.type.name === "image"
            ) {
              if (dispatch) {
                dispatch(
                  state.tr.setNodeMarkup(selection.from, undefined, {
                    ...selection.node.attrs,
                    ...attrs,
                  }),
                );
              }
              return true;
            }
            return false;
          },
        removeWriterImage:
          () =>
          ({ state, dispatch }) => {
            const { selection } = state;
            if (
              selection instanceof NodeSelection &&
              selection.node.type.name === "image"
            ) {
              if (dispatch) {
                dispatch(state.tr.deleteSelection());
              }
              return true;
            }
            return false;
          },
      };
    },
    addNodeView() {
      if (!loader) return null;
      const { documentId, fetchAssetObjectUrl, invalidateAssetUrl } = loader;
      return ({ node: initialNode, view, getPos }) => {
        let currentNode = initialNode;
        let destroyed = false;

        const dom = document.createElement("figure");
        dom.className = "writer-image";
        dom.contentEditable = "false";

        const frame = document.createElement("div");
        frame.className = "writer-image-frame";

        const img = document.createElement("img");
        img.className = "writer-image-el";
        img.draggable = false;

        const statusEl = document.createElement("div");
        statusEl.className = "writer-image-status";
        statusEl.textContent = "Loading image…";

        const controls = document.createElement("div");
        controls.className = "writer-image-controls";
        controls.setAttribute("role", "toolbar");
        controls.setAttribute("aria-label", "Image controls");

        const setAttrs = (patch: Record<string, unknown>) => {
          const pos = typeof getPos === "function" ? getPos() : undefined;
          if (typeof pos !== "number") return;
          const tr = view.state.tr.setNodeMarkup(pos, undefined, {
            ...currentNode.attrs,
            ...patch,
          });
          view.dispatch(tr);
        };

        const deleteSelf = () => {
          const pos = typeof getPos === "function" ? getPos() : undefined;
          if (typeof pos !== "number") return;
          const tr = view.state.tr.delete(pos, pos + currentNode.nodeSize);
          view.dispatch(tr);
          view.focus();
        };

        const makeBtn = (
          label: string,
          ariaLabel: string,
          onClick: () => void,
          extraClass = "",
        ) => {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.textContent = label;
          btn.setAttribute("aria-label", ariaLabel);
          btn.title = ariaLabel;
          btn.className = `writer-image-ctrl-btn ${extraClass}`.trim();
          btn.addEventListener("mousedown", (e) => {
            e.preventDefault();
            e.stopPropagation();
          });
          btn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            onClick();
          });
          return btn;
        };

        const alignLeftBtn = makeBtn("Left", "Align image left", () =>
          setAttrs({ align: "left" }),
        );
        const alignCenterBtn = makeBtn("Center", "Align image center", () =>
          setAttrs({ align: "center" }),
        );
        const alignRightBtn = makeBtn("Right", "Align image right", () =>
          setAttrs({ align: "right" }),
        );
        const smallerBtn = makeBtn("−", "Decrease image width", () => {
          const cur =
            typeof currentNode.attrs.width === "number"
              ? currentNode.attrs.width
              : img.offsetWidth || 320;
          setAttrs({ width: Math.max(80, Math.round(cur - 60)) });
        });
        const largerBtn = makeBtn("+", "Increase image width", () => {
          const cur =
            typeof currentNode.attrs.width === "number"
              ? currentNode.attrs.width
              : img.offsetWidth || 320;
          setAttrs({ width: Math.min(720, Math.round(cur + 60)) });
        });
        const removeBtn = makeBtn(
          "Remove",
          "Remove image",
          deleteSelf,
          "writer-image-remove-btn",
        );

        controls.append(
          alignLeftBtn,
          alignCenterBtn,
          alignRightBtn,
          smallerBtn,
          largerBtn,
          removeBtn,
        );

        const resizeHandle = document.createElement("div");
        resizeHandle.className = "writer-image-resize-handle";
        resizeHandle.title = "Drag to resize image";
        resizeHandle.addEventListener("mousedown", (startEvent) => {
          startEvent.preventDefault();
          startEvent.stopPropagation();
          const startX = startEvent.clientX;
          const startWidth =
            img.offsetWidth ||
            (typeof currentNode.attrs.width === "number"
              ? currentNode.attrs.width
              : 320);
          const editorRect = view.dom.getBoundingClientRect();
          const scale = editorRect.width / view.dom.offsetWidth || 1;
          let nextWidth = startWidth;
          const onMove = (moveEvent: MouseEvent) => {
            const delta = (moveEvent.clientX - startX) / scale;
            nextWidth = Math.max(80, Math.min(720, Math.round(startWidth + delta)));
            img.style.width = `${nextWidth}px`;
          };
          const onUp = () => {
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
            setAttrs({ width: nextWidth });
          };
          window.addEventListener("mousemove", onMove);
          window.addEventListener("mouseup", onUp);
        });

        frame.append(statusEl, img, controls, resizeHandle);
        dom.append(frame);

        frame.addEventListener("click", (e) => {
          if ((e.target as HTMLElement).closest("button")) return;
          const pos = typeof getPos === "function" ? getPos() : undefined;
          if (typeof pos === "number") {
            view.dispatch(
              view.state.tr.setSelection(
                NodeSelection.create(view.state.doc, pos),
              ),
            );
          }
        });

        let loadedAssetId = "";
        const loadAsset = (assetId: string) => {
          if (!assetId || loadedAssetId === assetId) return;
          loadedAssetId = assetId;
          statusEl.style.display = "flex";
          statusEl.textContent = "Loading image…";
          img.style.display = "none";

          void fetchAssetObjectUrl(documentId, assetId)
            .then((url) => {
              if (destroyed || loadedAssetId !== assetId) return;
              img.onload = () => {
                if (destroyed) return;
                statusEl.style.display = "none";
                img.style.display = "block";
                view.dispatch(
                  view.state.tr
                    .setMeta("writer-layout", true)
                    .setMeta("addToHistory", false),
                );
              };
              img.src = url;
            })
            .catch(() => {
              if (destroyed || loadedAssetId !== assetId) return;
              statusEl.innerHTML = "";
              const msg = document.createElement("span");
              msg.textContent = "Unable to load image.";
              const retry = makeBtn("Retry", "Retry loading image", () => {
                invalidateAssetUrl?.(documentId, assetId);
                loadedAssetId = "";
                loadAsset(assetId);
              });
              const del = makeBtn(
                "Remove",
                "Remove image",
                deleteSelf,
                "writer-image-remove-btn",
              );
              statusEl.append(msg, retry, del);
              statusEl.style.display = "flex";
            });
        };

        const syncAttributes = (n: typeof initialNode) => {
          const align =
            n.attrs.align === "center" || n.attrs.align === "right"
              ? (n.attrs.align as string)
              : "left";
          dom.setAttribute("data-align", align);
          dom.setAttribute("data-asset-id", String(n.attrs.assetId ?? ""));
          img.alt = String(n.attrs.alt ?? "");
          if (typeof n.attrs.width === "number") {
            img.style.width = `${Math.round(n.attrs.width)}px`;
            img.setAttribute("width", String(Math.round(n.attrs.width)));
          } else {
            img.style.width = "";
            img.removeAttribute("width");
          }
          alignLeftBtn.setAttribute(
            "aria-pressed",
            String(align === "left"),
          );
          alignCenterBtn.setAttribute(
            "aria-pressed",
            String(align === "center"),
          );
          alignRightBtn.setAttribute(
            "aria-pressed",
            String(align === "right"),
          );
          loadAsset(String(n.attrs.assetId ?? ""));
        };

        syncAttributes(currentNode);

        return {
          dom,
          update(updatedNode) {
            if (updatedNode.type.name !== "image") return false;
            currentNode = updatedNode;
            syncAttributes(currentNode);
            return true;
          },
          selectNode() {
            dom.classList.add("ProseMirror-selectednode");
          },
          deselectNode() {
            dom.classList.remove("ProseMirror-selectednode");
          },
          stopEvent(event) {
            const target = event.target as HTMLElement | null;
            return Boolean(
              target?.closest(".writer-image-controls") ||
                target?.closest(".writer-image-resize-handle") ||
                target?.closest(".writer-image-status button"),
            );
          },
          ignoreMutation() {
            return true;
          },
          destroy() {
            destroyed = true;
          },
        };
      };
    },
  });
}

export const WriterImage = createWriterImageExtension();

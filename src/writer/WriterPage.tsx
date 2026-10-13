import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { useEditor, useEditorState } from "@tiptap/react";
import type { Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import { ArrowLeft, Download, RemoveFormatting } from "lucide-react";
import { ThemeToggle } from "../components/ui/ThemeToggle";
import { LoadingState } from "../components/ui/LoadingState";
import { writerApi } from "./writer.api";
import type {
  PageSettings,
  WriterDocument,
  WriterSnapshot,
  WriterSpec,
} from "./writer.api";
import { WriterOrderedList } from "./ordered-list";
import { writerFontExtensions } from "./text-style";
import { WriterSaveQueue } from "./save-queue";
import type { SaveStatus } from "./save-queue";
import {
  PageBreak,
  ManualBreakLayout,
  PaginationPlus,
  paginationOptions,
  pageDimensions,
} from "./pagination";
import { writerHighlight } from "./highlight";
import { WriterHighlightButton } from "./WriterHighlightButton";
import { WriterWorkspace, WriterZoomControl } from "./WriterView";
import { WriterLinkButton } from "./WriterLinkButton";
import { useCurrentUser } from "../hooks/use-auth";
import { WriterRecoveryGate } from "./WriterRecoveryGate";
import { RecoverySession } from "./recovery-session";
import type { RecoveryDraft } from "./recovery-store";
import "./writer.css";
export default function WriterPage() {
  const { documentId = "" } = useParams();
  const user = useCurrentUser();
  const accountId = user.data?.id;
  const doc = useQuery({
    queryKey: ["writer", accountId, documentId],
    enabled: Boolean(accountId),
    queryFn: () => writerApi.get(documentId),
  });
  const spec = useQuery({
    queryKey: ["writer-spec"],
    queryFn: writerApi.spec,
    staleTime: Infinity,
  });
  if (doc.isError || spec.isError)
    return (
      <div className="writer-load" role="alert">
        {doc.error?.message || spec.error?.message}
        <button
          onClick={() => {
            void doc.refetch();
            void spec.refetch();
          }}
        >
          Retry
        </button>
      </div>
    );
  if (!accountId || !doc.data || !doc.isFetchedAfterMount || !spec.data)
    return (
      <div className="writer-load">
        <LoadingState />
      </div>
    );
  return (
    <WriterRecoveryGate
      key={`${accountId}:${documentId}`}
      accountId={accountId}
      server={doc.data}
      spec={spec.data}
    >
      {(draft, notice) => (
        <WriterSession
          accountId={accountId}
          initial={doc.data!}
          spec={spec.data!}
          recoveryDraft={draft}
          notice={notice}
        />
      )}
    </WriterRecoveryGate>
  );
}
function WriterSession({
  initial,
  spec,
  accountId,
  recoveryDraft,
  notice,
}: {
  initial: WriterDocument;
  spec: WriterSpec;
  accountId: string;
  recoveryDraft?: RecoveryDraft;
  notice: string;
}) {
  const [opened] = useState<WriterDocument>(() =>
    recoveryDraft
      ? {
          ...initial,
          content: recoveryDraft.content,
          title: recoveryDraft.title,
          pageSettings: recoveryDraft.pageSettings,
        }
      : initial,
  );
  const [recoveryNotice, setRecoveryNotice] = useState(notice);
  const [recovery] = useState(
    () =>
      new RecoverySession(accountId, initial, () => {
        setRecoveryNotice(
          "Local recovery is unavailable on this device. Keep this tab open until your changes are saved online.",
        );
      }),
  );
  const [snapshot, setSnapshot] = useState<WriterSnapshot>(opened);
  const latest = useRef<WriterSnapshot>(opened);
  const [status, setStatus] = useState<SaveStatus>(
    recoveryDraft ? "Unsaved changes" : "Saved",
  );
  const [busy, setBusy] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const client = useQueryClient();
  const queue = useRef<WriterSaveQueue | null>(null);
  useEffect(() => {
    const saver = new WriterSaveQueue(
      opened,
      opened.revision,
      async (data, revision) => {
        const saved = await writerApi.save(opened.id, data, revision);
        recovery.saved(data, saved);
        void client.invalidateQueries({ queryKey: ["writer-list"] });
        return saved;
      },
      setStatus,
    );
    queue.current = saver;
    if (recoveryDraft) {
      void recovery.adopt(opened, recoveryDraft);
      saver.update(opened);
    }
    const protect = () => {
      void recovery.flush().catch(() => {});
    };
    const hidden = () => {
      if (document.visibilityState === "hidden") protect();
    };
    window.addEventListener("pagehide", protect);
    document.addEventListener("visibilitychange", hidden);
    const warn = (e: BeforeUnloadEvent) => {
      if (saver.dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => {
      saver.dispose();
      recovery.dispose();
      window.removeEventListener("pagehide", protect);
      document.removeEventListener("visibilitychange", hidden);
      window.removeEventListener("beforeunload", warn);
    };
  }, [client, opened, recovery, recoveryDraft]);
  const update = (changes: Partial<WriterSnapshot>) => {
    latest.current = { ...latest.current, ...changes };
    setSnapshot(latest.current);
    recovery.update(latest.current);
    queue.current?.update(latest.current);
  };
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        blockquote: false,
        code: false,
        codeBlock: false,
        horizontalRule: false,
        strike: false,
        orderedList: false,
        link: { openOnClick: false, protocols: ["http", "https", "mailto"] },
      }),
      TextStyle,
      writerHighlight(spec),
      WriterOrderedList,
      ...writerFontExtensions(spec),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      PageBreak,
      PaginationPlus.configure(paginationOptions(opened.pageSettings, spec)),
      ManualBreakLayout,
    ],
    content: opened.content,
    editorProps: {
      transformPastedHTML(html) {
        const document = new DOMParser().parseFromString(html, "text/html");
        document.querySelectorAll<HTMLElement>("[style]").forEach((element) => {
          const family = element.style.fontFamily.replace(/["']/g, "");
          if (!spec.fontFamilies.includes(family))
            element.style.removeProperty("font-family");
          const size = element.style.fontSize;
          const points = parseFloat(size) * (size.endsWith("px") ? 0.75 : 1);
          if (spec.fontSizes.includes(points))
            element.style.fontSize = `${points}pt`;
          else element.style.removeProperty("font-size");
        });
        return document.body.innerHTML;
      },
      attributes: {
        class: "writer-content",
        "aria-label": "Document content",
        role: "textbox",
        "aria-multiline": "true",
      },
    },
    onUpdate: ({ editor: current }) => update({ content: current.getJSON() }),
  });
  useEffect(() => {
    if (recoveryDraft && editor) editor.commands.focus("end");
  }, [editor, recoveryDraft]);
  const pageSettings = (settings: PageSettings) => {
    update({ pageSettings: settings });
    const options = paginationOptions(settings, spec);
    editor
      ?.chain()
      .updatePageWidth(options.pageWidth)
      .updatePageHeight(options.pageHeight)
      .updateMargins({
        top: options.marginTop,
        bottom: options.marginBottom,
        left: options.marginLeft,
        right: options.marginRight,
      })
      .run();
  };
  const leave = async () => {
    try {
      await queue.current?.flush();
      navigate("/dashboard");
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Unable to save. Keep this document open.",
      );
    }
  };
  const exportPdf = async () => {
    if (!editor || !queue.current) return;
    setBusy(true);
    setError("");
    editor.setEditable(false);
    try {
      const revision = await queue.current.flush();
      const blob = await writerApi.export(opened.id, revision);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${latest.current.title.trim() || "Untitled document"}.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to prepare PDF.");
    } finally {
      setBusy(false);
      editor.setEditable(true);
    }
  };
  const dimensions = pageDimensions(snapshot.pageSettings, spec);
  return (
    <div className="writer-app">
      <style>{spec.css}</style>
      <header className="writer-topbar">
        <button
          className="toolbar-button"
          onClick={() => void leave()}
          disabled={busy}
        >
          <ArrowLeft size={16} /> Documents
        </button>
        <label className="writer-title">
          <span className="eyebrow">PAPERTRAIL WRITER · POC</span>
          <input
            aria-label="Document title"
            maxLength={160}
            value={snapshot.title}
            disabled={busy}
            onChange={(e) => update({ title: e.target.value })}
          />
        </label>
        <span role="status" className="writer-save">
          {busy ? "Preparing PDF…" : status}
        </span>
        <ThemeToggle />
        <button
          className="primary-button"
          onClick={() => void exportPdf()}
          disabled={busy || !editor}
        >
          <Download size={16} /> Export PDF
        </button>
      </header>
      {recoveryNotice && (
        <p role="status" className="writer-recovery-notice">
          {recoveryNotice}
        </p>
      )}
      {error && (
        <p className="writer-error" role="alert">
          {error}
        </p>
      )}
      {editor && <WriterToolbar editor={editor} spec={spec} disabled={busy} />}
      <fieldset className="writer-page-settings" disabled={busy}>
        <legend className="sr-only">Page settings</legend>
        <label>
          Paper{" "}
          <select
            aria-label="Page size"
            value={snapshot.pageSettings.size}
            onChange={(e) =>
              pageSettings({
                ...snapshot.pageSettings,
                size: e.target.value as PageSettings["size"],
              })
            }
          >
            <option>A4</option>
            <option value="Letter">US Letter</option>
          </select>
        </label>
        <label>
          Orientation{" "}
          <select
            aria-label="Orientation"
            value={snapshot.pageSettings.orientation}
            onChange={(e) =>
              pageSettings({
                ...snapshot.pageSettings,
                orientation: e.target.value as PageSettings["orientation"],
              })
            }
          >
            <option value="portrait">Portrait</option>
            <option value="landscape">Landscape</option>
          </select>
        </label>
        <details>
          <summary>Margins (mm)</summary>
          <div>
            {(["top", "right", "bottom", "left"] as const).map((side) => (
              <label key={side}>
                {side}
                <input
                  aria-label={`${side} margin`}
                  type="number"
                  min={5}
                  max={50}
                  value={snapshot.pageSettings.margins[side]}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    if (n >= 5 && n <= 50)
                      pageSettings({
                        ...snapshot.pageSettings,
                        margins: {
                          ...snapshot.pageSettings.margins,
                          [side]: n,
                        },
                      });
                  }}
                />
              </label>
            ))}
          </div>
        </details>
        <WriterZoomControl value={zoom} onChange={setZoom} />
      </fieldset>
      <WriterWorkspace editor={editor} width={dimensions.width} zoom={zoom} />
    </div>
  );
}
function clearInlineFormatting(editor: Editor) {
  editor
    .chain()
    .focus()
    .unsetBold()
    .unsetItalic()
    .unsetUnderline()
    .unsetMark("textStyle")
    .unsetHighlight()
    .run();
}
function WriterToolbar({
  editor,
  spec,
  disabled,
}: {
  editor: Editor;
  spec: WriterSpec;
  disabled: boolean;
}) {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      const textStyle =
        !e.state.selection.empty || e.isActive("textStyle")
          ? e.getAttributes("textStyle")
          : {};
      return {
        bold: e.isActive("bold"),
        italic: e.isActive("italic"),
        underline: e.isActive("underline"),
        bullet: e.isActive("bulletList"),
        ordered: e.isActive("orderedList"),
        heading: e.getAttributes("heading").level as number | undefined,
        font: textStyle.fontFamily as string | undefined,
        size: textStyle.fontSize as string | undefined,
        align: (e.getAttributes("paragraph").textAlign ||
          e.getAttributes("heading").textAlign ||
          "left") as string,
      };
    },
  });
  return (
    <fieldset className="writer-toolbar" disabled={disabled}>
      <legend className="sr-only">Formatting</legend>
      <button title="Undo" onClick={() => editor.chain().focus().undo().run()}>
        Undo
      </button>
      <button title="Redo" onClick={() => editor.chain().focus().redo().run()}>
        Redo
      </button>
      <select
        aria-label="Paragraph style"
        value={state.heading || 0}
        onChange={(e) => {
          const level = Number(e.target.value);
          if (level)
            editor
              .chain()
              .focus()
              .setHeading({ level: level as 1 | 2 | 3 })
              .run();
          else editor.chain().focus().setParagraph().run();
        }}
      >
        <option value={0}>Paragraph</option>
        {[1, 2, 3].map((n) => (
          <option key={n} value={n}>
            Heading {n}
          </option>
        ))}
      </select>
      <select
        aria-label="Font family"
        value={state.font || "Writer Sans"}
        onChange={(e) =>
          editor.chain().focus().setFontFamily(e.target.value).run()
        }
      >
        {spec.fontFamilies.map((f) => (
          <option key={f}>{f}</option>
        ))}
      </select>
      <select
        aria-label="Font size"
        value={state.size || "12pt"}
        onChange={(e) =>
          editor.chain().focus().setFontSize(e.target.value).run()
        }
      >
        {spec.fontSizes.map((s) => (
          <option key={s} value={`${s}pt`}>
            {s} pt
          </option>
        ))}
      </select>
      <button
        aria-label="Bold"
        aria-pressed={state.bold}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <b>B</b>
      </button>
      <button
        aria-label="Italic"
        aria-pressed={state.italic}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <i>I</i>
      </button>
      <button
        aria-label="Underline"
        aria-pressed={state.underline}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <u>U</u>
      </button>
      <button
        type="button"
        title="Clear formatting"
        aria-label="Clear formatting"
        onClick={() => clearInlineFormatting(editor)}
      >
        <RemoveFormatting size={14} aria-hidden="true" />
      </button>
      <select
        aria-label="Alignment"
        value={state.align}
        onChange={(e) =>
          editor.chain().focus().setTextAlign(e.target.value).run()
        }
      >
        {["left", "center", "right", "justify"].map((a) => (
          <option key={a}>{a}</option>
        ))}
      </select>
      <button
        aria-pressed={state.bullet}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        Bullets
      </button>
      <button
        aria-pressed={state.ordered}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        Numbered
      </button>
      <WriterHighlightButton editor={editor} colors={spec.highlightColors} />
      <WriterLinkButton editor={editor} />
      <button
        onClick={() =>
          editor
            .chain()
            .focus()
            .insertContent([{ type: "pageBreak" }, { type: "paragraph" }])
            .run()
        }
      >
        Page break
      </button>
    </fieldset>
  );
}

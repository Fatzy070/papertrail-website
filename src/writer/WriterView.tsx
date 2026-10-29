import { useLayoutEffect, useRef, useState } from "react";
import { EditorContent, type Editor } from "@tiptap/react";
import { Minus, Plus } from "lucide-react";
const WRITER_ZOOM_LEVELS = [50, 75, 90, 100, 110, 125, 150, 175, 200];
export function WriterZoomControl({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  const index = WRITER_ZOOM_LEVELS.indexOf(value);
  return (
    <div
      className="writer-zoom-control"
      role="group"
      aria-label="Document view zoom"
    >
      <button
        type="button"
        aria-label="Zoom out"
        title="Zoom out"
        disabled={index === 0}
        onClick={() => onChange(WRITER_ZOOM_LEVELS[index - 1])}
      >
        <Minus size={14} />
      </button>
      <select
        aria-label="Document view zoom percentage"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      >
        {WRITER_ZOOM_LEVELS.map((level) => (
          <option key={level} value={level}>
            {level}%
          </option>
        ))}
      </select>
      <button
        type="button"
        aria-label="Zoom in"
        title="Zoom in"
        disabled={index === WRITER_ZOOM_LEVELS.length - 1}
        onClick={() => onChange(WRITER_ZOOM_LEVELS[index + 1])}
      >
        <Plus size={14} />
      </button>
    </div>
  );
}
/** The paper keeps its physical layout width. Only the outer view scales;
 * the measured stage reserves the scaled scroll area without resizing the editor. */
export function WriterWorkspace({
  editor,
  width,
  zoom,
}: {
  editor: Editor | null;
  width: number;
  zoom: number;
}) {
  const paper = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);
  useLayoutEffect(() => {
    if (!paper.current) return;
    const element = paper.current;
    const measure = () => setHeight(element.offsetHeight);
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    measure();
    return () => observer.disconnect();
  }, [editor]);
  const scale = zoom / 100;
  return (
    <main className="writer-workspace" aria-label="Document workspace">
      <div
        className="writer-view-stage"
        style={{ width: width * scale, height: height * scale }}
      >
        <div
          ref={paper}
          className="writer-paper"
          style={{ width, transform: `scale(${scale})` }}
        >
          <EditorContent editor={editor} />
        </div>
      </div>
    </main>
  );
}

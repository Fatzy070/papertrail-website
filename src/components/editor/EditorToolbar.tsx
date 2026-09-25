import {
  ArrowLeft,
  Check,
  Circle,
  Download,
  History,
  LoaderCircle,
  MousePointer2,
  Redo2,
  Save,
  Type,
  Undo2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { useEditorStore } from '../../store/editor-store'
import { ThemeToggle } from '../ui/ThemeToggle'

interface Props {
  onBack: () => void
  onDownload: () => void
  onSave: () => void
  onVersions: () => void
  saving: boolean
  saveError: boolean
}

export function EditorToolbar({
  onBack,
  onDownload,
  onSave,
  onVersions,
  saving,
  saveError,
}: Props) {
  const state = useEditorStore()
  return (
    <>
      <header className="editor-topbar">
        <button
          className="icon-button"
          onClick={onBack}
          aria-label="Back to documents"
          title="Back to documents"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="editor-title">
          <strong>{state.document?.name ?? 'Opening document…'}</strong>
          <span className={saveError ? 'save-status failed' : 'save-status'}>
            {saving ? (
              <LoaderCircle size={12} className="animate-spin" />
            ) : state.dirty ? (
              <Circle size={9} />
            ) : (
              <Check size={12} />
            )}
            {saveError
              ? 'Save failed'
              : saving
                ? 'Saving changes'
                : state.dirty
                  ? 'Unsaved changes'
                  : 'All changes saved'}
          </span>
        </div>
        <div className="topbar-actions">
          <ThemeToggle />
          <button
            className="toolbar-button"
            onClick={onVersions}
            title="Version history"
          >
            <History size={16} />
            <span>History</span>
          </button>
          <button
            className="toolbar-button bordered"
            disabled={!state.document}
            onClick={onDownload}
          >
            <Download size={16} />
            <span>Download</span>
          </button>
          <button
            className="primary-button"
            disabled={!state.document || !state.dirty || saving}
            onClick={onSave}
          >
            <Save size={15} /> Save
          </button>
        </div>
      </header>
      <div className="editor-tools">
        <div className="tool-group">
          <button
            className="icon-button"
            aria-label="Undo"
            title="Undo"
            disabled={state.historyIndex <= 0}
            onClick={state.undo}
          >
            <Undo2 size={16} />
          </button>
          <button
            className="icon-button"
            aria-label="Redo"
            title="Redo"
            disabled={state.historyIndex >= state.history.length - 1}
            onClick={state.redo}
          >
            <Redo2 size={16} />
          </button>
        </div>
        <div className="tool-group">
          {(['select', 'text'] as const).map((tool) => (
            <button
              key={tool}
              className={
                state.activeTool === tool
                  ? 'toolbar-button active'
                  : 'toolbar-button'
              }
              aria-pressed={state.activeTool === tool}
              onClick={() => state.setActiveTool(tool)}
            >
              {tool === 'select' ? (
                <MousePointer2 size={16} />
              ) : (
                <Type size={16} />
              )}
              {tool === 'select' ? 'Select' : 'Add text'}
            </button>
          ))}
        </div>
        <span className="tool-tip">Select text to edit · drag to move</span>
        <div className="zoom-control">
          <button
            className="icon-button"
            aria-label="Zoom out"
            onClick={() => state.setZoom(state.zoom - 0.1)}
          >
            <ZoomOut size={15} />
          </button>
          <span>{Math.round(state.zoom * 100)}%</span>
          <button
            className="icon-button"
            aria-label="Zoom in"
            onClick={() => state.setZoom(state.zoom + 0.1)}
          >
            <ZoomIn size={15} />
          </button>
        </div>
      </div>
    </>
  )
}

import {
  ArrowLeft,
  Check,
  Circle,
  Download,
  History,
  Image as ImageIcon,
  LoaderCircle,
  MousePointer2,
  Redo2,
  Save,
  Type,
  Undo2,
  ZoomIn,
  ZoomOut,
  Pencil,
  FileSignature,
  StickyNote,
  TextCursorInput
} from 'lucide-react'
import { useEditorStore } from '../../store/editor-store'
import { ThemeToggle } from '../ui/ThemeToggle'

interface Props {
  onBack: () => void
  onDownload: () => void
  onSave: () => void
  onVersions: () => void
  onImageClick: () => void
  saving: boolean
  saveError: boolean
}

export function EditorToolbar({
  onBack,
  onDownload,
  onSave,
  onVersions,
  onImageClick,
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
          {(['pointer', 'edit-text', 'text', 'image', 'draw', 'sign', 'note'] as const).map((tool) => (
            <button
              key={tool}
              className={
                state.activeTool === tool
                  ? 'toolbar-button active'
                  : 'toolbar-button'
              }
              aria-pressed={state.activeTool === tool}
              onClick={() => {
                if (tool === 'image') {
                  onImageClick()
                } else {
                  state.setActiveTool(tool)
                }
              }}
              title={
                tool === 'pointer' ? 'Pointer' :
                tool === 'edit-text' ? 'Edit Text' :
                tool === 'text' ? 'Add text' :
                tool === 'image' ? 'Add image' :
                tool === 'draw' ? 'Draw' :
                tool === 'sign' ? 'Signature' :
                'Note'
              }
            >
              {tool === 'pointer' ? <MousePointer2 size={16} /> :
               tool === 'edit-text' ? <TextCursorInput size={16} /> :
               tool === 'text' ? <Type size={16} /> :
               tool === 'image' ? <ImageIcon size={16} /> :
               tool === 'draw' ? <Pencil size={16} /> :
               tool === 'sign' ? <FileSignature size={16} /> :
               <StickyNote size={16} />}
              {tool === 'pointer' ? 'Pointer' : 
               tool === 'edit-text' ? 'Edit' : 
               tool === 'text' ? 'Text' : 
               tool === 'image' ? 'Image' :
               tool === 'draw' ? 'Draw' :
               tool === 'sign' ? 'Sign' :
               'Note'}
            </button>
          ))}
        </div>
        
        {state.activeTool === 'draw' && (
          <div className="tool-group" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px' }}>
              Color:
              <input 
                type="color" 
                value={state.drawSettings.color} 
                onChange={(e) => state.setDrawSettings({ color: e.target.value })}
                style={{ width: '24px', height: '24px', padding: 0, border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              />
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px' }}>
              Width:
              <input 
                type="range" 
                min="1" max="20" 
                value={state.drawSettings.strokeWidth}
                onChange={(e) => state.setDrawSettings({ strokeWidth: Number(e.target.value) })}
                style={{ width: '80px' }}
              />
            </label>
          </div>
        )}

        <span className="tool-tip">Select text to edit · drag to move</span>
        <div className="zoom-control">
          <button 
            className="icon-button text-xs font-medium" 
            style={{ fontSize: '11px', padding: '0 6px' }}
            onClick={() => {
              const container = document.querySelector('.pdf-workspace')
              if (container && state.document?.pages[0]) {
                const availableWidth = container.clientWidth - 40
                const zoom = availableWidth / state.document.pages[0].width
                state.setZoom(Math.max(0.1, Math.min(zoom, 5)))
              }
            }}
            title="Fit Width"
          >
            Fit W
          </button>
          <button 
            className="icon-button text-xs font-medium" 
            style={{ fontSize: '11px', padding: '0 6px' }}
            onClick={() => {
              const container = document.querySelector('.pdf-workspace')
              if (container && state.document?.pages[0]) {
                const availableHeight = container.clientHeight - 40
                const zoom = availableHeight / state.document.pages[0].height
                state.setZoom(Math.max(0.1, Math.min(zoom, 5)))
              }
            }}
            title="Fit Page"
          >
            Fit P
          </button>
          <button 
            className="icon-button text-xs font-medium" 
            style={{ fontSize: '11px', padding: '0 6px' }}
            onClick={() => state.setZoom(1)}
            title="100% Zoom"
          >
            100%
          </button>
          <div style={{ width: '1px', height: '16px', background: 'var(--border-color)', margin: '0 4px' }} />
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

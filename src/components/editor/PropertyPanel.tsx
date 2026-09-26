import { useState } from 'react'
import { SlidersHorizontal, Trash2, Type, Bold, Italic, AlignLeft, AlignCenter, AlignRight, Link as LinkIcon } from 'lucide-react'
import { useEditorStore } from '../../store/editor-store'
import { ColorPicker } from '../ui/ColorPicker'
import { LinkModal } from './LinkModal'

export function PropertyPanel() {
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false)
  const selected = useEditorStore((s) =>
    s.elements.find((e) => e.id === s.selectedElementId),
  ) as import('../../types/editor').EditorElement | undefined
  const document = useEditorStore((s) => s.document)
  const update = useEditorStore((s) => s.updateElement)
  const remove = useEditorStore((s) => s.deleteSelected)
  return (
    <aside className="property-panel">
      <div className="panel-heading">
        <SlidersHorizontal size={15} /> Properties
      </div>
      {selected ? (
        selected.type === 'source-image' ? (
          <div className="panel-body">
            <div className="section-label">Existing PDF image</div>
            <button className="danger-button subtle" onClick={remove} style={{ marginTop: '8px' }}>
              <Trash2 size={15} /> Delete
            </button>
          </div>
        ) : (
        <div className="panel-body">
          {(selected.type === 'text' || selected.type === 'note') && (
            <>
              <div className="section-label">
                <Type size={14} /> Text selection
              </div>
              <label className="field-label">
                Content
                <textarea
                  className="text-input"
                  rows={4}
                  value={selected.text}
                  onChange={(e) => update(selected.id, { text: e.target.value })}
                />
              </label>
            </>
          )}
          
          {selected.type === 'text' && (
            <div className="property-grid" style={{ marginBottom: '12px' }}>
              <div className="field-label" style={{ gridColumn: '1 / -1' }}>
                <div style={{ display: 'flex', gap: '4px', background: 'var(--surface-hover)', padding: '4px', borderRadius: '8px', width: 'fit-content' }}>
                  <button 
                    className={`toolbar-btn ${selected.bold ? 'active' : ''}`}
                    onClick={() => update(selected.id, { bold: !selected.bold })}
                    title="Bold"
                  ><Bold size={16} /></button>
                  <button 
                    className={`toolbar-btn ${selected.italic ? 'active' : ''}`}
                    onClick={() => update(selected.id, { italic: !selected.italic })}
                    title="Italic"
                  ><Italic size={16} /></button>
                  <div style={{ width: '1px', background: 'var(--border)', margin: '0 4px' }} />
                  <button 
                    className={`toolbar-btn ${selected.textAlign === 'left' ? 'active' : ''}`}
                    onClick={() => update(selected.id, { textAlign: 'left' })}
                    title="Align Left"
                  ><AlignLeft size={16} /></button>
                  <button 
                    className={`toolbar-btn ${selected.textAlign === 'center' ? 'active' : ''}`}
                    onClick={() => update(selected.id, { textAlign: 'center' })}
                    title="Align Center"
                  ><AlignCenter size={16} /></button>
                  <button 
                    className={`toolbar-btn ${selected.textAlign === 'right' ? 'active' : ''}`}
                    onClick={() => update(selected.id, { textAlign: 'right' })}
                    title="Align Right"
                  ><AlignRight size={16} /></button>
                </div>
              </div>
            </div>
          )}

          {selected.type === 'text' && (
            <div className="property-grid" style={{ marginBottom: '12px' }}>
              <div className="field-label" style={{ gridColumn: '1 / -1' }}>
                Link
                {!selected.link ? (
                  <button 
                    className="toolbar-button" 
                    onClick={() => setIsLinkModalOpen(true)}
                    style={{ width: '100%', marginTop: '4px', justifyContent: 'center' }}
                  >
                    <LinkIcon size={14} style={{ marginRight: '4px' }} /> Add link
                  </button>
                ) : (
                  <div style={{ marginTop: '4px', padding: '8px', background: 'var(--surface-hover)', borderRadius: '6px' }}>
                    <div style={{ fontSize: '12px', color: 'var(--primary)', marginBottom: '8px', wordBreak: 'break-all' }}>
                      <a href={selected.link.url} target="_blank" rel="noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>
                        {selected.link.url}
                      </a>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button className="toolbar-button" onClick={() => setIsLinkModalOpen(true)} style={{ flex: 1, justifyContent: 'center', fontSize: '12px', padding: '4px' }}>
                        Edit link
                      </button>
                      <button className="toolbar-button" onClick={() => update(selected.id, { link: undefined })} style={{ flex: 1, justifyContent: 'center', fontSize: '12px', padding: '4px', color: 'var(--danger)' }}>
                        Remove link
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {selected.type === 'text' && (
            <LinkModal
              isOpen={isLinkModalOpen}
              onClose={() => setIsLinkModalOpen(false)}
              initialText={selected.text}
              initialUrl={selected.link?.url || ''}
              onApply={(newText, newUrl) => {
                update(selected.id, { text: newText, link: { url: newUrl } })
              }}
            />
          )}

          {selected.type === 'text' && (
            <div className="property-grid">
              <label className="field-label">
                Size
                <input
                  type="number"
                  min="1"
                  max="200"
                  className="text-input"
                  value={selected.fontSize}
                  onChange={(e) => {
                    const value = +e.target.value
                    if (value > 0 && value <= 200)
                      update(selected.id, { fontSize: value })
                  }}
                />
              </label>
              <label className="field-label">
                Line Height
                <input
                  type="number"
                  step="0.1"
                  min="0.5"
                  max="3"
                  className="text-input"
                  value={selected.lineHeight || 1.2}
                  onChange={(e) => {
                    const value = +e.target.value
                    if (value > 0)
                      update(selected.id, { lineHeight: value })
                  }}
                />
              </label>
              <div className="field-label" style={{ gridColumn: '1 / -1' }}>
                Color
                <ColorPicker
                  color={selected.color}
                  onChange={(color) => update(selected.id, { color })}
                />
              </div>
            </div>
          )}
          {selected.type === 'drawing' && (
            <div className="property-grid">
              <label className="field-label">
                Stroke Width
                <input
                  type="number"
                  min="1"
                  max="50"
                  className="text-input"
                  value={selected.strokeWidth}
                  onChange={(e) => {
                    const value = +e.target.value
                    if (value > 0 && value <= 50)
                      update(selected.id, { strokeWidth: value })
                  }}
                />
              </label>
              <div className="field-label" style={{ gridColumn: '1 / -1' }}>
                Color
                <ColorPicker
                  color={selected.color}
                  onChange={(color) => update(selected.id, { color })}
                />
              </div>
            </div>
          )}
          {selected.type === 'note' && (
            <div className="property-grid">
              <div className="field-label" style={{ gridColumn: '1 / -1' }}>
                Background Color
                <ColorPicker
                  color={selected.color}
                  onChange={(color) => update(selected.id, { color })}
                />
              </div>
            </div>
          )}
          <div className="section-label">Position · page points</div>
          <div className="property-grid">
            {(['x', 'y'] as const).map((axis) => (
              <label key={axis} className="field-label">
                {axis.toUpperCase()}
                <input
                  className="text-input"
                  type="number"
                  value={Math.round(selected[axis])}
                  onChange={(e) =>
                    update(selected.id, { [axis]: +e.target.value })
                  }
                />
              </label>
            ))}
          </div>
          <div className="property-grid" style={{ marginTop: '16px' }}>
            <button className="toolbar-button" onClick={() => useEditorStore.getState().duplicateSelected()}>
              Duplicate
            </button>
            <button className="toolbar-button" onClick={() => useEditorStore.getState().toggleLock()}>
              {selected.locked ? 'Unlock' : 'Lock'}
            </button>
            <button className="toolbar-button" onClick={() => useEditorStore.getState().bringForward()}>
              Bring Fwd
            </button>
            <button className="toolbar-button" onClick={() => useEditorStore.getState().sendBackward()}>
              Send Back
            </button>
          </div>
          
          <button className="danger-button subtle" onClick={remove} style={{ marginTop: '8px' }}>
            <Trash2 size={15} /> Delete
          </button>
        </div>
        )
      ) : (
        <div className="panel-body">
          <div className="section-label">Document</div>
          <p className="document-property-name">
            {document?.name ?? 'Opening document'}
          </p>
          <dl className="property-details">
            <dt>Format</dt>
            <dd>PDF document</dd>
            <dt>Pages</dt>
            <dd>{document?.pages.length ?? '—'}</dd>
          </dl>
          <div className="selection-hint">
            <SlidersHorizontal size={22} />
            <p>Select text or image on the page</p>
            <span>Edit its content, size, color and position here.</span>
          </div>
        </div>
      )}
    </aside>
  )
}

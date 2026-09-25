import { SlidersHorizontal, Trash2, Type } from 'lucide-react'
import { useEditorStore } from '../../store/editor-store'
export function PropertyPanel() {
  const selected = useEditorStore((s) =>
    s.textElements.find((e) => e.id === s.selectedElementId),
  )
  const document = useEditorStore((s) => s.document)
  const update = useEditorStore((s) => s.updateElement)
  const remove = useEditorStore((s) => s.deleteSelected)
  return (
    <aside className="property-panel">
      <div className="panel-heading">
        <SlidersHorizontal size={15} /> Properties
      </div>
      {selected ? (
        <div className="panel-body">
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
              Color
              <input
                className="color-input"
                type="color"
                value={selected.color}
                onChange={(e) => update(selected.id, { color: e.target.value })}
              />
            </label>
          </div>
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
          <button className="danger-button subtle" onClick={remove}>
            <Trash2 size={15} /> Delete text
          </button>
        </div>
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
            <p>Select text on the page</p>
            <span>Edit its content, size, color and position here.</span>
          </div>
        </div>
      )}
    </aside>
  )
}

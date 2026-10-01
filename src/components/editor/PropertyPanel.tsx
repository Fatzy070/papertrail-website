import { useState } from 'react'
import { SlidersHorizontal, Trash2, Type, Bold, Italic, AlignLeft, AlignCenter, AlignRight, Link as LinkIcon, X } from 'lucide-react'
import { useEditorStore } from '../../store/editor-store'
import { ColorPicker } from '../ui/ColorPicker'
import { LinkModal } from './LinkModal'
import {
  FONT_REGISTRY,
  FONT_ORDER,
  resolveElementFontId,
  resolveElementBold,
  resolveElementItalic,
  parseFontNameVariant,
  getCssFontFamily,
} from '../../engine/font-registry'
import type { FontId } from '../../engine/font-registry'

export function PropertyPanel({ mobileOpen = false, onMobileDismiss }: { mobileOpen?: boolean; onMobileDismiss?: () => void }) {
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false)
  const selected = useEditorStore((s) =>
    s.elements.find((e) => e.id === s.selectedElementId),
  ) as import('../../types/editor').EditorElement | undefined
  const document = useEditorStore((s) => s.document)
  const update = useEditorStore((s) => s.updateElement)
  const remove = useEditorStore((s) => s.deleteSelected)
  return (
    <aside className={mobileOpen ? 'property-panel mobile-panel-open' : 'property-panel'}>
      <div className="panel-heading">
        <SlidersHorizontal size={15} /> Properties
        <button type="button" className="mobile-panel-close" onClick={onMobileDismiss} aria-label="Close properties panel"><X size={18} /></button>
      </div>
      {selected ? (
        selected.type === 'source-image' ? (
          <div className="panel-body">
            <div className="section-label">Existing PDF image</div>
            <button className="danger-button subtle mt-2" onClick={remove}>
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

          {/* Font family dropdown — text elements only */}
          {selected.type === 'text' && (() => {
            const currentFontId: FontId = resolveElementFontId(selected)
            const isBold = resolveElementBold(selected)
            const isItalic = resolveElementItalic(selected)

            // Friendly label for source PDF font (shown below dropdown when font is from source)
            const sourceFontLabel = (() => {
              const norm = selected.sourceStyle?.normalizedFontName
              if (!norm) return null
              // If we resolved to a known registry font, use its label
              const resolved = resolveElementFontId(selected)
              if (resolved !== 'helvetica' || norm.toLowerCase().includes('helvetica')) {
                return FONT_REGISTRY[resolved].label
              }
              // Unsupported source font — show family part
              const { family } = parseFontNameVariant(norm)
              return family || 'Original PDF font'
            })()
            const hasUserFontOverride = !!selected.styleOverrides?.fontId

            return (
              <label className="field-label col-span-full">
                Font
                {!hasUserFontOverride && sourceFontLabel && (
                  <span className="text-[11px] text-[var(--muted)] block mb-1">
                    Source: {sourceFontLabel}{isBold ? ' Bold' : ''}{isItalic ? ' Italic' : ''}
                  </span>
                )}
                <select
                  className="text-input"
                  value={currentFontId}
                  onChange={(e) => {
                    const newFontId = e.target.value as FontId
                    const entry = FONT_REGISTRY[newFontId]
                    update(selected.id, {
                      fontId: newFontId,
                      fontFamily: entry.label,
                      styleOverrides: { ...selected.styleOverrides, fontId: newFontId },
                    })
                  }}
                  style={{ fontFamily: getCssFontFamily(currentFontId) }}
                >
                  {FONT_ORDER.map((fid) => (
                    <option
                      key={fid}
                      value={fid}
                      style={{ fontFamily: getCssFontFamily(fid) }}
                    >
                      {FONT_REGISTRY[fid].label}
                    </option>
                  ))}
                </select>
              </label>
            )
          })()}
          
          {selected.type === 'text' && (
            <div className="property-grid mb-3">
              <div className="field-label col-span-full">
                <div className="flex gap-1 bg-[var(--surface-hover)] p-1 rounded-lg w-fit">
                  <button 
                    className={`toolbar-btn ${resolveElementBold(selected) ? 'active' : ''}`}
                    onClick={() => {
                      const newBold = !resolveElementBold(selected)
                      update(selected.id, {
                        bold: newBold,
                        styleOverrides: { ...selected.styleOverrides, bold: newBold },
                      })
                    }}
                    title="Bold"
                  ><Bold size={16} /></button>
                  <button 
                    className={`toolbar-btn ${resolveElementItalic(selected) ? 'active' : ''}`}
                    onClick={() => {
                      const newItalic = !resolveElementItalic(selected)
                      update(selected.id, {
                        italic: newItalic,
                        styleOverrides: { ...selected.styleOverrides, italic: newItalic },
                      })
                    }}
                    title="Italic"
                  ><Italic size={16} /></button>
                  <div className="w-[1px] bg-[var(--border)] mx-1" />
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
            <div className="property-grid mb-3">
              <div className="field-label col-span-full">
                Link
                {!selected.link ? (
                  <button 
                    className="toolbar-button w-full mt-1 justify-center" 
                    onClick={() => setIsLinkModalOpen(true)}
                  >
                    <LinkIcon size={14} className="mr-1" /> Add link
                  </button>
                ) : (
                  <div className="mt-1 p-2 bg-[var(--surface-hover)] rounded-md">
                    <div className="text-xs text-[var(--primary)] mb-2 break-all">
                      <a href={selected.link.url} target="_blank" rel="noreferrer" className="text-inherit underline">
                        {selected.link.url}
                      </a>
                    </div>
                    <div className="flex gap-2">
                      <button className="toolbar-button flex-1 justify-center text-xs p-1" onClick={() => setIsLinkModalOpen(true)}>
                        Edit link
                      </button>
                      <button className="toolbar-button flex-1 justify-center text-xs p-1 text-[var(--danger)]" onClick={() => update(selected.id, { link: undefined })}>
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
                      update(selected.id, {
                        fontSize: value,
                        styleOverrides: { ...selected.styleOverrides, fontSize: value },
                      })
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
              <div className="field-label col-span-full">
                Color
                <ColorPicker
                  color={selected.color}
                  onChange={(color) =>
                    update(selected.id, {
                      color,
                      styleOverrides: { ...selected.styleOverrides, color },
                    })
                  }
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
              <div className="field-label col-span-full">
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
              <div className="field-label col-span-full">
                Background Color
                <ColorPicker
                  color={selected.color}
                  onChange={(color) => update(selected.id, { color })}
                />
              </div>
            </div>
          )}
          <div className="section-label">Transform</div>
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
            <label className="field-label">
              Rotation
              <input
                className="text-input"
                type="number"
                value={Math.round(('rotation' in selected ? selected.rotation : 0) || 0)}
                onChange={(e) =>
                  update(selected.id, { rotation: +e.target.value })
                }
              />
            </label>
          </div>
          <div className="property-grid mt-4">
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
          
          <button className="danger-button subtle mt-2" onClick={remove}>
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

import { useState } from 'react'
import { createPortal } from 'react-dom'
import type { WatermarkConfig } from '../../types/editor'

interface Props {
  initialConfig?: WatermarkConfig
  onClose: () => void
  onSave: (config: WatermarkConfig) => void
  onRemove?: () => void
}

export function WatermarkModal({ initialConfig, onClose, onSave, onRemove }: Props) {
  const [tab, setTab] = useState<'text' | 'image'>(initialConfig?.type || 'text')
  
  // Common properties
  const [opacity, setOpacity] = useState(initialConfig?.opacity ?? 0.5)
  const [scale, setScale] = useState(initialConfig?.scale ?? 1.0)
  const [rotation, setRotation] = useState(initialConfig?.rotation ?? 45)

  // Text properties
  const [text, setText] = useState(initialConfig?.text ?? 'CONFIDENTIAL')
  const [color, setColor] = useState(initialConfig?.color ?? '#ff0000')

  // Image properties
  const [imageUrl, setImageUrl] = useState<string | null>(initialConfig?.imageUrl ?? null)
  const [imageBytes, setImageBytes] = useState<Uint8Array | null>(initialConfig?.imageBytes ?? null)

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    setImageUrl(url)
    file.arrayBuffer().then((buf) => setImageBytes(new Uint8Array(buf)))
  }

  const isSaveEnabled = 
    (tab === 'text' && text.trim().length > 0) ||
    (tab === 'image' && imageBytes !== null)

  const handleSave = () => {
    if (!isSaveEnabled) return
    onSave({
      source: 'user',
      type: tab,
      opacity,
      scale,
      rotation,
      text: tab === 'text' ? text : undefined,
      color: tab === 'text' ? color : undefined,
      imageUrl: tab === 'image' ? (imageUrl ?? undefined) : undefined,
      imageBytes: tab === 'image' ? (imageBytes ?? undefined) : undefined,
    })
  }

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">Watermark</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        <div className="flex border-b border-gray-100">
          <button 
            className={`flex-1 py-3 text-sm font-medium ${tab === 'text' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:bg-gray-50'}`} 
            onClick={() => setTab('text')}
          >
            Text
          </button>
          <button 
            className={`flex-1 py-3 text-sm font-medium ${tab === 'image' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:bg-gray-50'}`} 
            onClick={() => setTab('image')}
          >
            Image
          </button>
        </div>

        <div className="p-6 flex-1 overflow-y-auto">
          {tab === 'text' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Text</label>
                <input 
                  type="text" 
                  value={text}
                  onChange={e => setText(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder="e.g. CONFIDENTIAL"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Color</label>
                <div className="flex gap-2">
                  {['#ff0000', '#000000', '#2563eb', '#16a34a', '#a8a29e'].map(c => (
                    <button
                      key={c}
                      onClick={() => setColor(c)}
                      className={`w-8 h-8 rounded-full border-2 ${color === c ? 'border-blue-500 scale-110' : 'border-transparent'}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                  <input 
                    type="color" 
                    value={color}
                    onChange={e => setColor(e.target.value)}
                    className="w-8 h-8 p-0 border-0 rounded-full overflow-hidden cursor-pointer"
                  />
                </div>
              </div>
            </div>
          )}

          {tab === 'image' && (
            <div className="space-y-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Upload Image</label>
              {!imageUrl ? (
                <label className="border-2 border-dashed border-gray-300 rounded-lg p-8 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 hover:border-blue-500 transition-colors">
                  <span className="text-sm font-medium text-blue-600 mb-1">Click to upload</span>
                  <span className="text-xs text-gray-500">PNG, JPG up to 5MB</span>
                  <input type="file" accept="image/png, image/jpeg" className="hidden" onChange={handleImageUpload} />
                </label>
              ) : (
                <div className="relative border border-gray-200 rounded-lg p-4 flex items-center justify-center bg-gray-50 min-h-[120px]">
                  <img src={imageUrl} alt="Watermark" className="max-h-32 object-contain" />
                  <button 
                    onClick={() => { setImageUrl(null); setImageBytes(null) }}
                    className="absolute top-2 right-2 bg-white/90 shadow rounded-full w-8 h-8 flex items-center justify-center text-red-500 hover:text-red-600 hover:bg-white transition-colors"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="mt-8 space-y-6 border-t border-gray-100 pt-6">
            <div>
              <div className="flex justify-between mb-1">
                <label className="text-sm font-medium text-gray-700">Opacity</label>
                <span className="text-sm text-gray-500">{Math.round(opacity * 100)}%</span>
              </div>
              <input 
                type="range" min="0.1" max="1" step="0.05" 
                value={opacity} onChange={e => setOpacity(parseFloat(e.target.value))}
                className="w-full accent-blue-600"
              />
            </div>
            
            <div>
              <div className="flex justify-between mb-1">
                <label className="text-sm font-medium text-gray-700">Scale</label>
                <span className="text-sm text-gray-500">{Math.round(scale * 100)}%</span>
              </div>
              <input 
                type="range" min="0.1" max="3" step="0.1" 
                value={scale} onChange={e => setScale(parseFloat(e.target.value))}
                className="w-full accent-blue-600"
              />
            </div>

            <div>
              <div className="flex justify-between mb-1">
                <label className="text-sm font-medium text-gray-700">Rotation</label>
                <span className="text-sm text-gray-500">{rotation}°</span>
              </div>
              <input 
                type="range" min="0" max="360" step="15" 
                value={rotation} onChange={e => setRotation(parseFloat(e.target.value))}
                className="w-full accent-blue-600"
              />
            </div>
          </div>

        </div>

        <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-between">
          <div>
            {onRemove && (
              <button 
                onClick={onRemove}
                className="px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                Remove
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button 
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 bg-gray-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button 
              onClick={handleSave}
              disabled={!isSaveEnabled}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {initialConfig ? 'Update' : 'Apply'}
            </button>
          </div>
        </div>

      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}

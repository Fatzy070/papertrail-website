import { useState, useRef, useEffect, type PointerEvent as ReactPointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { getStroke } from 'perfect-freehand'

interface Props {
  onClose: () => void
  onSave: (src: string) => void
}

const FONTS = [
  'Caveat, cursive',
  'Dancing Script, cursive',
  'Pacifico, cursive',
  'Brush Script MT, cursive'
]

function getSvgPathFromStroke(stroke: number[][]) {
  if (!stroke.length) return ''
  const d = stroke.reduce(
    (acc, [x0, y0], i, arr) => {
      const [x1, y1] = arr[(i + 1) % arr.length]
      acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2)
      return acc
    },
    ['M', ...stroke[0], 'Q']
  )
  d.push('Z')
  return d.join(' ')
}

export function SignatureModal({ onClose, onSave }: Props) {
  const [tab, setTab] = useState<'draw' | 'upload' | 'type'>('draw')
  const [color, setColor] = useState<'#000000' | '#2563eb'>('#000000')

  // Type tab state
  const [text, setText] = useState('')
  const [selectedFont, setSelectedFont] = useState(FONTS[0])

  // Upload tab state
  const [uploadSrc, setUploadSrc] = useState<string | null>(null)
  
  // Draw tab state
  const [strokes, setStrokes] = useState<number[][][]>([])
  const [currentStroke, setCurrentStroke] = useState<number[][]>([])
  const isDrawing = useRef(false)

  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Load Google Fonts
  useEffect(() => {
    const link = document.createElement('link')
    link.href = 'https://fonts.googleapis.com/css2?family=Caveat:wght@600&family=Dancing+Script:wght@600&family=Pacifico&display=swap'
    link.rel = 'stylesheet'
    document.head.appendChild(link)
    return () => {
      document.head.removeChild(link)
    }
  }, [])

  function handlePointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    isDrawing.current = true
    const rect = e.currentTarget.getBoundingClientRect()
    setCurrentStroke([[e.clientX - rect.left, e.clientY - rect.top]])
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function handlePointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!isDrawing.current) return
    const rect = e.currentTarget.getBoundingClientRect()
    setCurrentStroke(prev => [...prev, [e.clientX - rect.left, e.clientY - rect.top]])
  }

  function handlePointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    if (!isDrawing.current) return
    isDrawing.current = false
    setStrokes(prev => [...prev, currentStroke])
    setCurrentStroke([])
    e.currentTarget.releasePointerCapture(e.pointerId)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => {
      setUploadSrc(e.target?.result as string)
    }
    reader.readAsDataURL(file)
  }

  function handleSave() {
    if (tab === 'type') {
      if (!text.trim()) return
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      
      // Clear and setup
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      const fontSize = 48
      ctx.font = `600 ${fontSize}px ${selectedFont}`
      const metrics = ctx.measureText(text)
      
      const width = Math.ceil(metrics.width) + 40
      const height = fontSize * 1.5
      canvas.width = width
      canvas.height = height
      
      ctx.font = `600 ${fontSize}px ${selectedFont}`
      ctx.fillStyle = color
      ctx.textBaseline = 'middle'
      ctx.textAlign = 'center'
      ctx.fillText(text, width / 2, height / 2)
      
      const dataUrl = canvas.toDataURL('image/png')
      onSave(dataUrl)
    } else if (tab === 'upload') {
      if (!uploadSrc) return
      onSave(uploadSrc)
    } else if (tab === 'draw') {
      if (strokes.length === 0 && currentStroke.length === 0) return
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      canvas.width = 500
      canvas.height = 250
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      
      ctx.fillStyle = color
      const allPaths = strokes
      for (const pts of allPaths) {
        const strokeData = getStroke(pts, { size: 6, thinning: 0.5, smoothing: 0.5, streamline: 0.5 })
        const pathString = getSvgPathFromStroke(strokeData)
        if (pathString) {
           const p = new Path2D(pathString)
           ctx.fill(p)
        }
      }
      
      // Compute bounds to crop
      let minX = canvas.width, minY = canvas.height, maxX = 0, maxY = 0
      for (const pts of allPaths) {
        for (const [x, y] of pts) {
           if (x < minX) minX = x;
           if (x > maxX) maxX = x;
           if (y < minY) minY = y;
           if (y > maxY) maxY = y;
        }
      }
      
      const pad = 10;
      minX = Math.max(0, minX - pad)
      minY = Math.max(0, minY - pad)
      maxX = Math.min(canvas.width, maxX + pad)
      maxY = Math.min(canvas.height, maxY + pad)
      
      const drawW = maxX - minX
      const drawH = maxY - minY
      
      if (drawW <= 0 || drawH <= 0) return;
      
      const cropCanvas = document.createElement('canvas')
      cropCanvas.width = drawW
      cropCanvas.height = drawH
      const cropCtx = cropCanvas.getContext('2d')
      if (!cropCtx) return
      cropCtx.putImageData(ctx.getImageData(minX, minY, drawW, drawH), 0, 0)
      
      const dataUrl = cropCanvas.toDataURL('image/png')
      onSave(dataUrl)
    }
  }

  const allStrokes = currentStroke.length > 0 ? [...strokes, currentStroke] : strokes
  const pathDatas = allStrokes.map(pts => getSvgPathFromStroke(getStroke(pts, { size: 6, thinning: 0.5, smoothing: 0.5, streamline: 0.5 })))

  const isSaveEnabled = 
    (tab === 'type' && text.trim().length > 0) ||
    (tab === 'upload' && uploadSrc !== null) ||
    (tab === 'draw' && strokes.length > 0)

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">Add Signature</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        <div className="flex border-b border-gray-100">
          <button 
            className={`flex-1 py-3 text-sm font-medium ${tab === 'draw' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:bg-gray-50'}`} 
            onClick={() => setTab('draw')}
          >
            Draw
          </button>
          <button 
            className={`flex-1 py-3 text-sm font-medium ${tab === 'upload' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:bg-gray-50'}`} 
            onClick={() => setTab('upload')}
          >
            Upload
          </button>
          <button 
            className={`flex-1 py-3 text-sm font-medium ${tab === 'type' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:bg-gray-50'}`} 
            onClick={() => setTab('type')}
          >
            Type
          </button>
        </div>
        
        <div className="p-6 bg-gray-50 flex-1 flex flex-col gap-4">
          
          {tab === 'draw' && (
            <div 
              className="border border-gray-300 rounded-lg bg-white h-[200px] touch-none relative overflow-hidden cursor-crosshair w-full"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
            >
              <svg className="w-full h-full pointer-events-none">
                 {pathDatas.map((d, i) => (
                   <path key={i} d={d} fill={color} />
                 ))}
              </svg>
            </div>
          )}

          {tab === 'upload' && (
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 flex flex-col items-center justify-center gap-2 h-[200px] hover:bg-gray-50 relative bg-white transition-colors">
              {uploadSrc ? (
                 <img src={uploadSrc} alt="Signature preview" className="max-h-full max-w-full object-contain pointer-events-none" />
              ) : (
                 <>
                   <span className="text-gray-500 font-medium">Click to upload image</span>
                   <span className="text-xs text-gray-400">PNG, JPG, WEBP</span>
                 </>
              )}
              <input 
                 type="file" 
                 accept="image/png, image/jpeg, image/webp" 
                 className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                 onChange={handleFileChange}
              />
            </div>
          )}

          {tab === 'type' && (
            <>
              <input
                type="text"
                placeholder="Type your name..."
                autoFocus
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg bg-white"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSave()
                }}
              />
              <div className="flex flex-col gap-2">
                <span className="text-sm text-gray-500 font-medium">Select a style:</span>
                <div className="grid grid-cols-2 gap-3">
                  {FONTS.map(font => (
                    <button
                      key={font}
                      className={`p-3 border rounded-lg text-xl text-center cursor-pointer transition-colors ${
                        selectedFont === font ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:border-blue-300'
                      }`}
                      style={{ fontFamily: font, color }}
                      onClick={() => setSelectedFont(font)}
                    >
                      {text || 'Signature'}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {tab !== 'upload' && (
            <div className="flex items-center gap-2 justify-between mt-2">
              <div className="flex gap-3 items-center">
                <span className="text-sm text-gray-500 font-medium">Color:</span>
                <button 
                   className={`w-7 h-7 rounded-full bg-black border-2 transition-all ${color === '#000000' ? 'border-blue-400 scale-110 shadow-sm' : 'border-transparent hover:scale-105'}`} 
                   onClick={() => setColor('#000000')} 
                   aria-label="Black"
                />
                <button 
                   className={`w-7 h-7 rounded-full bg-blue-600 border-2 transition-all ${color === '#2563eb' ? 'border-blue-400 scale-110 shadow-sm' : 'border-transparent hover:scale-105'}`} 
                   onClick={() => setColor('#2563eb')} 
                   aria-label="Blue"
                />
              </div>
              {tab === 'draw' && (
                <button onClick={() => { setStrokes([]); setCurrentStroke([]); }} className="text-sm text-red-500 hover:text-red-700 font-medium px-2 py-1">
                  Clear
                </button>
              )}
            </div>
          )}

        </div>

        <div className="p-4 border-t border-gray-100 flex justify-end gap-3 bg-white">
          <button onClick={onClose} className="px-5 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 font-medium transition-colors">
            Cancel
          </button>
          <button 
            onClick={handleSave} 
            disabled={!isSaveEnabled} 
            className="px-5 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
          >
            Add Signature
          </button>
        </div>
      </div>
      {/* Hidden canvas for rendering */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  )

  return createPortal(modalContent, document.body)
}

import { useState, useRef, type PointerEvent } from 'react'
import { getStroke } from 'perfect-freehand'

interface Props {
  onClose: () => void
  onSave: (src: string) => void
}

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
  const [strokes, setStrokes] = useState<{ x: number; y: number; pressure?: number }[][]>([])
  const [currentStroke, setCurrentStroke] = useState<{ x: number; y: number; pressure?: number }[]>([])
  const [isDrawing, setIsDrawing] = useState(false)
  const svgRef = useRef<SVGSVGElement>(null)

  function getPoint(e: PointerEvent<HTMLDivElement>) {
    const bounds = e.currentTarget.getBoundingClientRect()
    return {
      x: e.clientX - bounds.left,
      y: e.clientY - bounds.top,
      pressure: e.pressure || 0.5
    }
  }

  function handlePointerDown(e: PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    setIsDrawing(true)
    setCurrentStroke([getPoint(e)])
  }

  function handlePointerMove(e: PointerEvent<HTMLDivElement>) {
    if (!isDrawing) return
    setCurrentStroke([...currentStroke, getPoint(e)])
  }

  function handlePointerUp(e: PointerEvent<HTMLDivElement>) {
    if (!isDrawing) return
    setIsDrawing(false)
    e.currentTarget.releasePointerCapture(e.pointerId)
    if (currentStroke.length > 2) {
      setStrokes([...strokes, currentStroke])
    }
    setCurrentStroke([])
  }

  function handleClear() {
    setStrokes([])
    setCurrentStroke([])
  }

  function handleSave() {
    if (!svgRef.current) return
    const svgData = new XMLSerializer().serializeToString(svgRef.current)
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(svgBlob)
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = svgRef.current!.clientWidth
      canvas.height = svgRef.current!.clientHeight
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(img, 0, 0)
        onSave(canvas.toDataURL('image/png'))
      }
      URL.revokeObjectURL(url)
    }
    img.src = url
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">Create Signature</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        
        <div className="p-6 bg-gray-50 flex-1">
          <div 
            className="w-full h-48 bg-white border-2 border-dashed border-gray-200 rounded-lg cursor-crosshair relative touch-none"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            {strokes.length === 0 && currentStroke.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center text-gray-400 pointer-events-none select-none">
                Draw your signature here
              </div>
            )}
            <svg ref={svgRef} className="absolute inset-0 w-full h-full pointer-events-none">
              {strokes.map((stroke, i) => (
                <path key={i} d={getSvgPathFromStroke(getStroke(stroke, { size: 6, thinning: 0.7, smoothing: 0.5, streamline: 0.5 }))} fill="#000000" />
              ))}
              {currentStroke.length > 0 && (
                <path d={getSvgPathFromStroke(getStroke(currentStroke, { size: 6, thinning: 0.7, smoothing: 0.5, streamline: 0.5 }))} fill="#000000" />
              )}
            </svg>
          </div>
        </div>

        <div className="p-4 border-t border-gray-100 flex justify-between bg-white">
          <button onClick={handleClear} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 font-medium">
            Clear
          </button>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 font-medium">
              Cancel
            </button>
            <button onClick={handleSave} disabled={strokes.length === 0} className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium">
              Save Signature
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

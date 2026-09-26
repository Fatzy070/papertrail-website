import { ResizableWrapper } from './ResizableWrapper'
import type { ImageElement, SignatureElement } from '../../types/editor'

export function ImageOverlay({
  element,
  zoom,
  onSelect,
}: {
  element: ImageElement | SignatureElement
  zoom: number
  onSelect: (id: string) => void
}) {
  return (
    <ResizableWrapper 
      element={element} 
      zoom={zoom} 
      onSelect={onSelect} 
      preserveAspectRatio={true}
    >
      <img 
        src={element.src} 
        alt=""
        draggable={false}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          display: 'block',
          pointerEvents: 'none',
        }}
      />
    </ResizableWrapper>
  )
}

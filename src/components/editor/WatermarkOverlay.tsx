import { useEditorStore } from '../../store/editor-store'

interface Props {
  pageId: string
  zoom: number
}

export function WatermarkOverlay({ zoom }: Props) {
  const watermark = useEditorStore((s) => s.watermark)
  
  if (!watermark || watermark.source === 'pdf') {
    return null
  }

  return (
    <div 
      className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden z-40"
    >
      <div 
        style={{
          opacity: watermark.opacity,
          transform: `scale(${watermark.scale * zoom}) rotate(${-watermark.rotation}deg)`,
          transformOrigin: 'center center',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {watermark.type === 'text' && watermark.text && (
          <span 
            style={{
              color: watermark.color,
              fontSize: '72px', // Base size, scaled by transform
              fontWeight: 'bold',
              fontFamily: 'Helvetica, sans-serif',
              whiteSpace: 'nowrap',
            }}
          >
            {watermark.text}
          </span>
        )}
        
        {watermark.type === 'image' && watermark.imageUrl && (
          <img 
            src={watermark.imageUrl} 
            alt="Watermark" 
            style={{ 
              maxWidth: '80%', 
              maxHeight: '80%', 
              objectFit: 'contain' 
            }} 
          />
        )}
      </div>
    </div>
  )
}

let measurementCanvas: HTMLCanvasElement | null = null
let measurementContext: CanvasRenderingContext2D | null = null

function getMeasurementContext(): CanvasRenderingContext2D {
  if (!measurementCanvas) {
    measurementCanvas = document.createElement('canvas')
    measurementContext = measurementCanvas.getContext('2d')
  }
  if (!measurementContext) {
    throw new Error('Failed to create canvas 2d context for text measurement')
  }
  return measurementContext
}

export function measureTextElement(
  text: string,
  fontSize: number,
  fontFamily: string,
  bold?: boolean,
  italic?: boolean
): number {
  if (!text) return 0
  
  const ctx = getMeasurementContext()
  const fontWeight = bold ? 'bold' : 'normal'
  const fontStyle = italic ? 'italic' : 'normal'
  ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`
  
  const lines = text.split('\n')
  let maxWidth = 0
  
  for (const line of lines) {
    const metrics = ctx.measureText(line)
    if (metrics.width > maxWidth) {
      maxWidth = metrics.width
    }
  }
  
  // Return maxWidth + small buffer for caret/precision difference between canvas and DOM
  return Math.ceil(maxWidth) + 4
}

import { resolveFontId, getCssFontFamily } from './font-registry'
import type { FontId } from './font-registry'

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

/**
 * Measure the rendered width of text using the canvas 2D API.
 *
 * Uses the font-registry so measurement always matches export.
 * Accepts either a canonical fontId or a raw fontFamily string (will be resolved).
 */
export function measureTextElement(
  text: string,
  fontSize: number,
  fontFamily: string,
  bold?: boolean,
  italic?: boolean,
  fontIdHint?: FontId,
): number {
  if (!text) return 0

  const ctx = getMeasurementContext()
  const fontId = fontIdHint ?? resolveFontId(fontFamily)
  const cssFontFamily = getCssFontFamily(fontId)

  const fontWeight = bold ? 'bold' : 'normal'
  const fontStyle = italic ? 'italic' : 'normal'
  ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${cssFontFamily}`

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

/**
 * Measure how many lines text will take when wrapped at a given width,
 * and return the total height needed (in page-space points).
 */
export function measureTextHeight(
  text: string,
  fontSize: number,
  fontFamily: string,
  bold: boolean | undefined,
  italic: boolean | undefined,
  lineHeight: number,
  boxWidth: number,
  fontIdHint?: FontId,
): number {
  if (!text) return fontSize * lineHeight

  const ctx = getMeasurementContext()
  const fontId = fontIdHint ?? resolveFontId(fontFamily)
  const cssFontFamily = getCssFontFamily(fontId)
  const fontWeight = bold ? 'bold' : 'normal'
  const fontStyle = italic ? 'italic' : 'normal'
  ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${cssFontFamily}`

  const paragraphs = text.split('\n')
  let totalLines = 0

  for (const para of paragraphs) {
    if (!para) {
      totalLines += 1
      continue
    }
    const words = para.split(/(\s+)/)
    let currentLine = ''
    let lineCount = 0
    for (const word of words) {
      if (!word) continue
      const testLine = currentLine + word
      const w = ctx.measureText(testLine).width
      if (w > boxWidth && currentLine !== '') {
        lineCount++
        currentLine = word
      } else {
        currentLine = testLine
      }
    }
    if (currentLine) lineCount++
    totalLines += lineCount
  }

  return Math.max(1, totalLines) * fontSize * lineHeight
}

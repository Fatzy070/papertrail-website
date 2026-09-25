import type { PDFPageProxy } from 'pdfjs-dist'
import type { PdfPageInfo, TextElement } from '../types/editor'

export interface ViewportRect {
  left: number
  top: number
  width: number
  height: number
  rotation: number
}

export function viewportRectToPageRect(
  page: PDFPageProxy,
  item: { transform: number[]; width: number; height: number },
): TextElement['originalBounds'] & { rotation: number } {
  const viewport = page.getViewport({ scale: 1 })
  const tx = item.transform
  const x = tx[4] ?? 0
  const baseline = tx[5] ?? 0
  const fontHeight = Math.max(Math.abs(tx[3] ?? 0), item.height, 8)
  return {
    x,
    y: viewport.height - baseline - fontHeight,
    width: Math.max(item.width, 4),
    height: fontHeight,
    rotation: Math.atan2(tx[1] ?? 0, tx[0] ?? 1) * (180 / Math.PI),
  }
}

export function pageRectToCss(
  rect: { x: number; y: number; width: number; height: number; rotation: number },
  _page: PdfPageInfo,
  zoom: number,
): ViewportRect {
  return {
    left: rect.x * zoom,
    top: rect.y * zoom,
    width: rect.width * zoom,
    height: rect.height * zoom,
    rotation: rect.rotation,
  }
}

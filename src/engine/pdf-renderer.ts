import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist'
import type { PdfPageInfo } from '../types/editor'

export function getPageInfo(page: PDFPageProxy, index: number): PdfPageInfo {
  const viewport = page.getViewport({ scale: 1 })
  return {
    index,
    width: viewport.width,
    height: viewport.height,
    rotation: viewport.rotation,
  }
}

export async function renderPage(
  document: PDFDocumentProxy,
  pageInfo: PdfPageInfo,
  canvas: HTMLCanvasElement,
  zoom: number,
  signal?: AbortSignal,
) {
  const page = await document.getPage(pageInfo.index + 1)
  if (signal?.aborted) return
  const viewport = page.getViewport({ scale: zoom })
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Unable to create a PDF canvas context.')

  const deviceScale = window.devicePixelRatio || 1
  canvas.width = Math.floor(viewport.width * deviceScale)
  canvas.height = Math.floor(viewport.height * deviceScale)
  canvas.style.width = `${viewport.width}px`
  canvas.style.height = `${viewport.height}px`
  context.setTransform(deviceScale, 0, 0, deviceScale, 0, 0)

  const task = page.render({ canvasContext: context, canvas, viewport })
  const cancel = () => task.cancel()
  signal?.addEventListener('abort', cancel, { once: true })
  try {
    await task.promise
  } catch (error) {
    if (!signal?.aborted) throw error
  } finally {
    signal?.removeEventListener('abort', cancel)
  }
  return { width: viewport.width, height: viewport.height }
}

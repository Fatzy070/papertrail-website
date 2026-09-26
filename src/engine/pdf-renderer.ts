import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist'
import type { EditorPage } from '../types/editor'

export function getPageInfo(page: PDFPageProxy, index: number): EditorPage {
  const viewport = page.getViewport({ scale: 1 })
  return {
    id: crypto.randomUUID(),
    kind: 'source',
    sourcePageIndex: index,
    width: viewport.width,
    height: viewport.height,
    rotation: viewport.rotation
  }
}

export async function renderPage(
  document: PDFDocumentProxy,
  pageInfo: EditorPage,
  canvas: HTMLCanvasElement,
  zoom: number,
  signal?: AbortSignal,
) {
  const deviceScale = window.devicePixelRatio || 1

  if (pageInfo.kind === 'blank') {
    canvas.width = Math.floor(pageInfo.width * zoom * deviceScale)
    canvas.height = Math.floor(pageInfo.height * zoom * deviceScale)
    canvas.style.width = `${pageInfo.width * zoom}px`
    canvas.style.height = `${pageInfo.height * zoom}px`
    const context = canvas.getContext('2d')
    if (context) {
      context.fillStyle = 'white'
      context.fillRect(0, 0, canvas.width, canvas.height)
    }
    return { width: pageInfo.width * zoom, height: pageInfo.height * zoom }
  }

  const sourcePageIndex = pageInfo.kind === 'imported' ? pageInfo.sourcePageIndex : (pageInfo as any).sourcePageIndex
  const page = await document.getPage(sourcePageIndex + 1)
  if (signal?.aborted) return
  const viewport = page.getViewport({ scale: zoom })
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Unable to create a PDF canvas context.')

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

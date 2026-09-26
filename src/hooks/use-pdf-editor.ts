import { useCallback, useState } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { extractNativeText } from '../engine/text-extractor'
import { extractNativeImages } from '../engine/image-extractor'
import { extractAnnotations } from '../engine/annotations/annotation-reader'
import { isPdfFile, loadPdfDocument } from '../engine/pdf-loader'
import { getPageInfo } from '../engine/pdf-renderer'
import { useEditorStore } from '../store/editor-store'
import type { PdfDocumentState } from '../types/editor'

type Source = PdfDocumentState['source']

export function usePdfEditor() {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const setDocument = useEditorStore((state) => state.setDocument)

  const openBytes = useCallback(async (name: string, bytes: ArrayBuffer, source: Source) => {
    setError(null)
    setLoading(true)
    try {
      const loadedPdf = await loadPdfDocument(bytes)
      setPdf(loadedPdf)
      const pages = []
      for (let index = 0; index < loadedPdf.numPages; index += 1) {
        pages.push(getPageInfo(await loadedPdf.getPage(index + 1), index))
      }
      const textElements = await extractNativeText(loadedPdf, pages)
      const annotationElements = await extractAnnotations(loadedPdf, pages)
      const imageElements = []
      for (let i = 0; i < loadedPdf.numPages; i++) {
        const page = await loadedPdf.getPage(i + 1)
        const images = await extractNativeImages(page, pages[i].id)
        imageElements.push(...images)
      }
      setDocument(
        { name, bytes, pages, source },
        [...textElements, ...annotationElements, ...imageElements]
      )
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to open this PDF.')
    } finally {
      setLoading(false)
    }
  }, [setDocument])

  const openFile = useCallback(async (file: File) => {
    if (file.size === 0 || file.size > 50 * 1024 * 1024) {
      setError('Choose a PDF smaller than 50 MB.')
      return
    }
    if (!(await isPdfFile(file))) {
      setError('That file is not a valid PDF.')
      return
    }
    await openBytes(file.name, await file.arrayBuffer(), { type: 'local' })
  }, [openBytes])

  return { pdf, openFile, openBytes, loading, error }
}

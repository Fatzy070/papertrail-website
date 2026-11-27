import { useCallback, useEffect, useRef, useState } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { extractPageNativeText } from '../engine/text-extractor'
import { enrichTextElementsWithMuPDF } from '../engine/text-style-enricher'
import { extractNativeImages } from '../engine/image-extractor'
import { extractPageAnnotations } from '../engine/annotations/annotation-reader'
import { isPdfFile, loadPdfDocument } from '../engine/pdf-loader'
import { getPageInfo } from '../engine/pdf-renderer'
import { useEditorStore } from '../store/editor-store'
import type { EditorPage, PdfDocumentState, TextElement } from '../types/editor'

type Source = PdfDocumentState['source']

const PAGE_INFO_BATCH_SIZE = 12
const BACKGROUND_EXTRACT_BATCH_SIZE = 4

function yieldToMainThread(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

function yieldAfterNextPaint(): Promise<void> {
  if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
    return yieldToMainThread()
  }
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => {
      setTimeout(resolve, 0)
    })
  })
}

export function usePdfEditor() {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const setDocument = useEditorStore((state) => state.setDocument)
  const runIdRef = useRef(0)
  const hydrationPromiseRef = useRef<Promise<void> | null>(null)

  useEffect(() => {
    return () => {
      runIdRef.current += 1
    }
  }, [])

  const openBytes = useCallback(async (name: string, bytes: ArrayBuffer, source: Source) => {
    const runId = ++runIdRef.current
    const isCancelled = () => runIdRef.current !== runId

    setError(null)
    setLoading(true)
    try {
      const loadedPdf = await loadPdfDocument(bytes)
      if (isCancelled()) return

      const firstPdfPage = await loadedPdf.getPage(1)
      if (isCancelled()) return

      const pages: EditorPage[] = new Array(loadedPdf.numPages)
      pages[0] = getPageInfo(firstPdfPage, 0)

      for (let start = 1; start < loadedPdf.numPages; start += PAGE_INFO_BATCH_SIZE) {
        const end = Math.min(start + PAGE_INFO_BATCH_SIZE, loadedPdf.numPages)
        const batch = await Promise.all(
          Array.from({ length: end - start }, async (_, offset) => {
            const pageIndex = start + offset
            const pageProxy = await loadedPdf.getPage(pageIndex + 1)
            return { pageIndex, info: getPageInfo(pageProxy, pageIndex) }
          }),
        )
        if (isCancelled()) return
        for (const item of batch) {
          pages[item.pageIndex] = item.info
        }
      }

      // Extract Page 1 elements immediately so Page 1 is interactive right away
      const [firstPageText, firstPageAnnotations, firstPageImages] = await Promise.all([
        extractPageNativeText(firstPdfPage, pages[0].id),
        extractPageAnnotations(firstPdfPage, pages[0].id),
        extractNativeImages(firstPdfPage, pages[0].id),
      ])
      if (isCancelled()) return

      setPdf(loadedPdf)
      setDocument(
        { name, bytes, pages, source },
        [...firstPageText, ...firstPageAnnotations, ...firstPageImages],
      )
      setLoading(false)

      // Stage 2: Background extraction for pages 2..N + MuPDF font metadata enrichment
      const hydrationTask = (async () => {
        await yieldAfterNextPaint()
        if (isCancelled()) return

        const allSourceText: TextElement[] = firstPageText.map((el) => ({
          ...el,
          sourceStyle: el.sourceStyle ? { ...el.sourceStyle } : undefined,
        }))

        for (let start = 1; start < loadedPdf.numPages; start += BACKGROUND_EXTRACT_BATCH_SIZE) {
          if (isCancelled()) return
          const end = Math.min(start + BACKGROUND_EXTRACT_BATCH_SIZE, loadedPdf.numPages)
          const batchResults = await Promise.all(
            Array.from({ length: end - start }, async (_, offset) => {
              const pageIndex = start + offset
              const pageProxy = await loadedPdf.getPage(pageIndex + 1)
              const pageId = pages[pageIndex].id
              const [text, annotations, images] = await Promise.all([
                extractPageNativeText(pageProxy, pageId),
                extractPageAnnotations(pageProxy, pageId),
                extractNativeImages(pageProxy, pageId),
              ])
              return { text, annotations, images }
            }),
          )
          if (isCancelled()) return

          const chunkElements = []
          for (const res of batchResults) {
            for (const t of res.text) {
              allSourceText.push({
                ...t,
                sourceStyle: t.sourceStyle ? { ...t.sourceStyle } : undefined,
              })
            }
            chunkElements.push(...res.text, ...res.annotations, ...res.images)
          }

          useEditorStore.getState().hydrateBackgroundElements(chunkElements)
          await yieldToMainThread()
        }

        if (isCancelled() || allSourceText.length === 0) return

        // Enrich PDF.js elements with reliable font metadata from MuPDF in background.
        try {
          await enrichTextElementsWithMuPDF(allSourceText, bytes, pages, {
            yieldBetweenPages: true,
            isCancelled,
          })
          if (isCancelled()) return

          const stylesById = new Map<string, NonNullable<TextElement['sourceStyle']>>()
          for (const el of allSourceText) {
            if (el.sourceStyle) {
              stylesById.set(el.id, el.sourceStyle)
            }
          }
          useEditorStore.getState().applySourceStyles(stylesById)
        } catch (enrichErr) {
          console.warn('[use-pdf-editor] MuPDF enrichment skipped:', enrichErr)
        }
      })()

      hydrationPromiseRef.current = hydrationTask
    } catch (cause) {
      if (!isCancelled()) {
        setError(cause instanceof Error ? cause.message : 'Unable to open this PDF.')
      }
    } finally {
      if (!isCancelled()) {
        setLoading(false)
      }
    }
  }, [setDocument])

  const ensureHydrated = useCallback(async () => {
    if (hydrationPromiseRef.current) {
      await hydrationPromiseRef.current
    }
  }, [])

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

  return { pdf, openFile, openBytes, ensureHydrated, loading, error }
}

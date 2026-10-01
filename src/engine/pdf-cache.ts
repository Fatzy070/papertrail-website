import type { PDFDocumentProxy } from 'pdfjs-dist'

export const pdfCache = new Map<string, { bytes: ArrayBuffer, proxy: PDFDocumentProxy }>()

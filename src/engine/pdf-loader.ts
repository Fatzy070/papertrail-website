import * as pdfjsLib from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

export async function loadPdfDocument(bytes: ArrayBuffer) {
  // PDF.js transfers its input buffer to the worker. Retain the original for export.
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(bytes.slice(0)),
  })
  return loadingTask.promise
}

export async function isPdfFile(file: File): Promise<boolean> {
  if (
    file.type === 'application/pdf' ||
    file.name.toLowerCase().endsWith('.pdf')
  ) {
    const header = new Uint8Array(await file.slice(0, 5).arrayBuffer())
    return new TextDecoder().decode(header) === '%PDF-'
  }
  return false
}

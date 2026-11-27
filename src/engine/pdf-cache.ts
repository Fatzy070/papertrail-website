import type { PDFDocumentProxy } from 'pdfjs-dist'

export const pdfCache = new Map<string, { bytes: ArrayBuffer, proxy: PDFDocumentProxy }>()

interface CachedRemoteDocumentBytes {
  bytes: ArrayBuffer
  versionNumber?: number
}

const MAX_CACHED_DOCUMENTS = 3
const MAX_TOTAL_CACHE_BYTES = 45 * 1024 * 1024
const MAX_SINGLE_FILE_BYTES = 35 * 1024 * 1024

const remoteDocumentBytesCache = new Map<string, CachedRemoteDocumentBytes>()
let totalCachedBytes = 0

export function getCachedDocumentBytes(
  documentId: string,
  expectedVersionNumber?: number,
): ArrayBuffer | null {
  const entry = remoteDocumentBytesCache.get(documentId)
  if (!entry) return null

  if (
    expectedVersionNumber !== undefined &&
    entry.versionNumber !== undefined &&
    entry.versionNumber !== expectedVersionNumber
  ) {
    invalidateCachedDocumentBytes(documentId)
    return null
  }

  // Refresh LRU order
  remoteDocumentBytesCache.delete(documentId)
  remoteDocumentBytesCache.set(documentId, entry)
  return entry.bytes.slice(0)
}

export function setCachedDocumentBytes(
  documentId: string,
  bytes: ArrayBuffer,
  versionNumber?: number,
) {
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_SINGLE_FILE_BYTES) return

  invalidateCachedDocumentBytes(documentId)

  while (
    remoteDocumentBytesCache.size >= MAX_CACHED_DOCUMENTS ||
    totalCachedBytes + bytes.byteLength > MAX_TOTAL_CACHE_BYTES
  ) {
    const oldestKey = remoteDocumentBytesCache.keys().next().value
    if (!oldestKey) break
    invalidateCachedDocumentBytes(oldestKey)
  }

  const copy = bytes.slice(0)
  remoteDocumentBytesCache.set(documentId, { bytes: copy, versionNumber })
  totalCachedBytes += copy.byteLength
}

export function invalidateCachedDocumentBytes(documentId: string) {
  const existing = remoteDocumentBytesCache.get(documentId)
  if (existing) {
    totalCachedBytes = Math.max(0, totalCachedBytes - existing.bytes.byteLength)
    remoteDocumentBytesCache.delete(documentId)
  }
}

let editorPreloadStarted = false
export function preloadEditorResources() {
  if (editorPreloadStarted) return
  editorPreloadStarted = true
  void import('./pdf-loader')
    .then((m) => m.ensurePdfWorker())
    .catch(() => {})
  void import('../pages/EditorPage').catch(() => {})
}

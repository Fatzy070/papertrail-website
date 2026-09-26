import * as mupdf from 'mupdf'

export interface PendingRedaction {
  id: string
  pageId: string
  sourcePageIndex: number
  rect: {
    x: number
    y: number
    width: number
    height: number
  }
}

/**
 * Experimental POC function to permanently redact text using MuPDF.
 * Applies pending redactions and returns the new PDF bytes.
 */
export async function applyMuPdfRedactions(
  sourceBytes: ArrayBuffer,
  redactions: PendingRedaction[]
): Promise<Uint8Array> {
  if (redactions.length === 0) {
    return new Uint8Array(sourceBytes)
  }

  // Group redactions by page
  const redactionsByPage = new Map<number, PendingRedaction[]>()
  for (const r of redactions) {
    if (!redactionsByPage.has(r.sourcePageIndex)) {
      redactionsByPage.set(r.sourcePageIndex, [])
    }
    redactionsByPage.get(r.sourcePageIndex)!.push(r)
  }

  let doc: mupdf.PDFDocument | null = null
  try {
    const baseDoc = mupdf.Document.openDocument(sourceBytes, 'application/pdf')
    doc = baseDoc.asPDF()
    if (!doc) {
      throw new Error('Not a valid PDF document for MuPDF')
    }
    
    for (const [pageIndex, pageRedactions] of redactionsByPage.entries()) {
      let page: mupdf.PDFPage | undefined
      try {
        page = doc.loadPage(pageIndex)
        
        for (const r of pageRedactions) {
          // Papertrail coordinate system uses (0,0) at top-left.
          // MuPDF also uses (0,0) at top-left for its page-space annotation Rects.
          const x0 = r.rect.x
          const y0 = r.rect.y
          const x1 = r.rect.x + r.rect.width
          const y1 = r.rect.y + r.rect.height
          
          const annot = page.createAnnotation('Redact')
          annot.setRect([x0, y0, x1, y1])
        }
        
        // Apply all Redact annotations on the page.
        // false: no black_boxes
        // 0: REDACT_IMAGE_NONE
        // 0: REDACT_LINE_ART_NONE
        // 0: REDACT_TEXT_REMOVE
        page.applyRedactions(false, 0, 0, 0)
        page.update()
      } finally {
        if (page) {
          // No explicit free/destroy for page in typical JS usage
          // The WASM GC cleans it up when doc is closed.
        }
      }
    }
    
    const outBuf = doc.saveToBuffer("")
    return outBuf.asUint8Array()
  } finally {
    // There isn't a direct explicit close in the JS bindings (they rely on JS GC usually).
    // Let's rely on standard GC or internal cleanup.
  }
}

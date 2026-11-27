import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist'
import type { NoteElement, EditorPage } from '../../types/editor'

export async function extractPageAnnotations(
  page: PDFPageProxy,
  pageId: string,
): Promise<NoteElement[]> {
  const elements: NoteElement[] = []
  const annotations = await page.getAnnotations()
  const viewport = page.getViewport({ scale: 1 })

  // PDF.js normalizes annotation data
  for (const annot of annotations) {
    if (annot.subtype === 'Text') {
      const id = annot.id ?? crypto.randomUUID()
      const rect = annot.rect // [llx, lly, urx, ury]

      // Convert to DOM coords
      // PDF.js rect is in default user space.
      // viewport.height is the total page height in user space points
      const x = rect[0]
      const y = viewport.height - rect[3]

      let color = '#fef08a'
      if (annot.color && Array.isArray(annot.color)) {
        const r = Math.round(annot.color[0] || 255).toString(16).padStart(2, '0')
        const g = Math.round(annot.color[1] || 255).toString(16).padStart(2, '0')
        const b = Math.round(annot.color[2] || 0).toString(16).padStart(2, '0')
        color = `#${r}${g}${b}`
      }

      elements.push({
        type: 'note',
        id: id,
        pageId: pageId,
        text: annot.contents || '',
        color: color,
        x: x,
        y: y,
        width: 24, // Icon width
        height: 24, // Icon height
        author: annot.titleObj?.str || annot.title || 'Unknown',
        source: 'pdf-annotation'
      })
    }
  }

  return elements
}

export async function extractAnnotations(pdf: PDFDocumentProxy, pages: EditorPage[]): Promise<NoteElement[]> {
  const elements: NoteElement[] = []

  for (let pageIndex = 0; pageIndex < pdf.numPages; pageIndex++) {
    const page = await pdf.getPage(pageIndex + 1)
    const pageElements = await extractPageAnnotations(page, pages[pageIndex].id)
    elements.push(...pageElements)
  }

  return elements
}

import type { PDFDocumentProxy } from 'pdfjs-dist'
import { viewportRectToPageRect } from './coordinate-transformer'
import type { TextElement } from '../types/editor'

export async function extractNativeText(document: PDFDocumentProxy): Promise<TextElement[]> {
  const elements: TextElement[] = []
  for (let pageIndex = 0; pageIndex < document.numPages; pageIndex += 1) {
    const page = await document.getPage(pageIndex + 1)
    const content = await page.getTextContent()
    content.items.forEach((rawItem, itemIndex) => {
      if (!('str' in rawItem) || !rawItem.str.trim()) return
      const bounds = viewportRectToPageRect(page, rawItem)
      elements.push({
        id: `pdf-text-${pageIndex}-${itemIndex}`,
        pageIndex,
        source: 'pdf',
        originalText: rawItem.str,
        text: rawItem.str,
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        fontSize: bounds.height,
        fontFamily: 'Helvetica',
        color: '#1f2937',
        rotation: bounds.rotation,
        originalBounds: bounds,
        edited: false,
      })
    })
  }
  return elements
}

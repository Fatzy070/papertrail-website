import type { PDFDocumentProxy } from 'pdfjs-dist'
import { viewportRectToPageRect } from './coordinate-transformer'
import type { TextElement, EditorPage } from '../types/editor'

export async function extractNativeText(document: PDFDocumentProxy, pages: EditorPage[]): Promise<TextElement[]> {
  const elements: TextElement[] = []
  for (let pageIndex = 0; pageIndex < document.numPages; pageIndex += 1) {
    const page = await document.getPage(pageIndex + 1)
    const content = await page.getTextContent()
    const pageId = pages[pageIndex].id
    content.items.forEach((rawItem, itemIndex) => {
      if (!('str' in rawItem) || !rawItem.str.trim()) return
      const bounds = viewportRectToPageRect(page, rawItem)
      
      const style = content.styles[rawItem.fontName]
      let fontFamily = 'Helvetica'
      let isBold = false
      let isItalic = false
      
      if (style && style.fontFamily) {
        // Many PDFs have weird font family names, we keep it as is.
        // It's better than forcing everything to Helvetica.
        fontFamily = style.fontFamily
      }
      
      const lowerFontName = rawItem.fontName.toLowerCase()
      if (lowerFontName.includes('bold')) {
        isBold = true
      }
      if (lowerFontName.includes('italic') || lowerFontName.includes('oblique')) {
        isItalic = true
      }

      elements.push({
        type: 'text',
        id: `pdf-text-${pageId}-${itemIndex}`,
        pageId,
        source: 'pdf',
        originalText: rawItem.str,
        text: rawItem.str,
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        fontSize: bounds.height,
        fontFamily,
        bold: isBold,
        italic: isItalic,
        color: '#1f2937',
        rotation: bounds.rotation,
        originalBounds: bounds,
        edited: false,
      })
    })
  }
  return elements
}

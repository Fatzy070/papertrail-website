import type { PDFPageProxy } from 'pdfjs-dist'
import * as pdfjsLib from 'pdfjs-dist'
import type { SourceImageElement } from '../types/editor'

export async function extractNativeImages(page: PDFPageProxy, pageId: string): Promise<SourceImageElement[]> {
  const elements: SourceImageElement[] = []
  
  try {
    const opList = await page.getOperatorList()
    const viewport = page.getViewport({ scale: 1 })
    
    let ctm = [1, 0, 0, 1, 0, 0]
    const ctmStack: number[][] = []
    
    const transform = (m1: number[], m2: number[]) => {
      return [
        m1[0] * m2[0] + m1[2] * m2[1],
        m1[1] * m2[0] + m1[3] * m2[1],
        m1[0] * m2[2] + m1[2] * m2[3],
        m1[1] * m2[2] + m1[3] * m2[3],
        m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
        m1[1] * m2[4] + m1[3] * m2[5] + m1[5]
      ]
    }
    
    for (let i = 0; i < opList.fnArray.length; i++) {
      const fn = opList.fnArray[i]
      const args = opList.argsArray[i]
      
      if (fn === pdfjsLib.OPS.save) {
        ctmStack.push([...ctm])
      } else if (fn === pdfjsLib.OPS.restore) {
        if (ctmStack.length > 0) {
          ctm = ctmStack.pop()!
        }
      } else if (fn === pdfjsLib.OPS.transform) {
        ctm = transform(ctm, args as number[])
      } else if (fn === pdfjsLib.OPS.paintImageXObject || fn === pdfjsLib.OPS.paintInlineImageXObject) {
        // Map corners in PDF space
        const corners = [
          [0, 0], [1, 0], [0, 1], [1, 1]
        ].map(([lx, ly]) => {
          return [
            ctm[0] * lx + ctm[2] * ly + ctm[4],
            ctm[1] * lx + ctm[3] * ly + ctm[5]
          ]
        })
        
        const xs = corners.map(c => c[0])
        const ys = corners.map(c => c[1])
        const minX = Math.min(...xs)
        const maxX = Math.max(...xs)
        const minY = Math.min(...ys)
        const maxY = Math.max(...ys)
        
        // Convert from PDF space to viewport space
        const rect = viewport.convertToViewportRectangle([minX, minY, maxX, maxY])
        
        const vx = Math.min(rect[0], rect[2])
        const vy = Math.min(rect[1], rect[3])
        const vw = Math.abs(rect[2] - rect[0])
        const vh = Math.abs(rect[3] - rect[1])
        
        elements.push({
          type: 'source-image',
          id: `pdf-img-${pageId}-${i}`,
          pageId,
          x: vx,
          y: vy,
          width: vw,
          height: vh,
          deleted: false,
        })
      }
    }
  } catch (e) {
    console.warn("Failed to extract images for page", pageId, e)
  }
  
  return elements
}

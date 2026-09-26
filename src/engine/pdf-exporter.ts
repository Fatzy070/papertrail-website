import { PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import type { PDFFont } from 'pdf-lib'
import type { PdfDocumentState, EditorElement } from '../types/editor'
import { applyTextAnnotation } from './annotations/text-annotation'
import { applyInkAnnotation } from './annotations/ink-annotation'
import { parseHexColor, domToPdfRect } from './annotations/annotation-utils'
import { applyLinkAnnotation } from './annotations/link-annotation'
import { pdfCache } from './pdf-cache'
import {
  FONT_REGISTRY,
  resolveFontId,
  fetchFontBytes,
  type FontId,
  type FontVariant,
} from './font-registry'

/** Resolve a variant name from bold/italic flags */
function variantFromFlags(bold?: boolean, italic?: boolean): FontVariant {
  if (bold && italic) return 'boldItalic'
  if (bold) return 'bold'
  if (italic) return 'italic'
  return 'regular'
}

/** Embedded font cache for one export run. Key: `fontId:variant` */
type EmbedCache = Map<string, PDFFont>

async function getOrEmbedFont(
  pdf: PDFDocument,
  fontId: FontId,
  variant: FontVariant,
  cache: EmbedCache,
): Promise<PDFFont> {
  const key = `${fontId}:${variant}`
  const cached = cache.get(key)
  if (cached) return cached

  const entry = FONT_REGISTRY[fontId]

  if (entry.isStandard) {
    // Map to pdf-lib StandardFonts
    let stdFont: StandardFonts
    if (fontId === 'times') {
      stdFont =
        variant === 'boldItalic' ? StandardFonts.TimesRomanBoldItalic
        : variant === 'bold'     ? StandardFonts.TimesRomanBold
        : variant === 'italic'   ? StandardFonts.TimesRomanItalic
        :                          StandardFonts.TimesRoman
    } else if (fontId === 'courier') {
      stdFont =
        variant === 'boldItalic' ? StandardFonts.CourierBoldOblique
        : variant === 'bold'     ? StandardFonts.CourierBold
        : variant === 'italic'   ? StandardFonts.CourierOblique
        :                          StandardFonts.Courier
    } else {
      // helvetica
      stdFont =
        variant === 'boldItalic' ? StandardFonts.HelveticaBoldOblique
        : variant === 'bold'     ? StandardFonts.HelveticaBold
        : variant === 'italic'   ? StandardFonts.HelveticaOblique
        :                          StandardFonts.Helvetica
    }
    const font = await pdf.embedFont(stdFont)
    cache.set(key, font)
    return font
  }

  // Custom font: fetch TTF bytes and embed with fontkit
  const bytes = await fetchFontBytes(fontId, variant)
  if (!bytes) {
    // Fallback: try regular variant, then helvetica
    if (variant !== 'regular') return getOrEmbedFont(pdf, fontId, 'regular', cache)
    return getOrEmbedFont(pdf, 'helvetica', 'regular', cache)
  }
  const font = await pdf.embedFont(bytes)
  cache.set(key, font)
  return font
}


export async function exportPdf(documentState: PdfDocumentState, allElements: EditorElement[]) {
  const originalPdf = await PDFDocument.load(documentState.bytes)
  const pdf = await PDFDocument.create()
  pdf.registerFontkit(fontkit)

  // Per-export font cache (avoids re-fetching / re-embedding same font)
  const embedCache: EmbedCache = new Map()

  // Iterate over documentState.pages and reconstruct the PDF
  const pageIdToIndex = new Map<string, number>()
  const pdfLibCache = new Map<string, PDFDocument>()

  for (let i = 0; i < documentState.pages.length; i++) {
    const pageInfo = documentState.pages[i]
    pageIdToIndex.set(pageInfo.id, i)
    if (pageInfo.kind === 'blank') {
      pdf.addPage([pageInfo.width, pageInfo.height])
    } else if (pageInfo.kind === 'imported') {
      let importedPdf = pdfLibCache.get(pageInfo.sourceDocumentId)
      if (!importedPdf) {
        const cached = pdfCache.get(pageInfo.sourceDocumentId)
        if (!cached) throw new Error('Imported PDF bytes not found in cache.')
        importedPdf = await PDFDocument.load(cached.bytes)
        pdfLibCache.set(pageInfo.sourceDocumentId, importedPdf)
      }
      const [copiedPage] = await pdf.copyPages(importedPdf, [pageInfo.sourcePageIndex])
      pdf.addPage(copiedPage)
    } else {
      const originalIndex = pageInfo.sourcePageIndex ?? i
      const [copiedPage] = await pdf.copyPages(originalPdf, [originalIndex])
      pdf.addPage(copiedPage)
    }
    
    // Apply user-defined rotation if any
    if (pageInfo.rotation) {
      const page = pdf.getPage(pdf.getPageCount() - 1)
      page.setRotation(degrees(pageInfo.rotation))
    }
  }

  for (const element of allElements) {
    const targetIndex = pageIdToIndex.get(element.pageId)
    if (targetIndex === undefined) continue
    const page = pdf.getPage(targetIndex)
    const pageHeight = page.getHeight()
    
    if (element.type === 'source-image') {
      if ((element as import('../types/editor').SourceImageElement).deleted) {
        const coverY = pageHeight - element.y - element.height
        page.drawRectangle({
          x: element.x,
          y: coverY,
          width: element.width,
          height: element.height,
          color: rgb(1, 1, 1),
          opacity: 1,
        })
      }
      continue
    }

    if (element.type === 'text') {
      if (element.source === 'pdf' && !element.edited) {
        // Native text is already in the PDF. Only draw it if we added a link or modified it.
        if (!element.link) continue
      }
      
      const original = element.originalBounds ?? element
      const coverY = pageHeight - original.y - original.height
      
      if (element.edited && element.source !== 'user') {
        page.drawRectangle({
          x: original.x,
          y: coverY,
          width: original.width,
          height: original.height + 2,
          color: rgb(1, 1, 1),
          opacity: 0.98,
        })
      }

      if (element.text.trim() && (element.source === 'user' || element.edited)) {
        const fontId = element.fontId ?? resolveFontId(element.fontFamily || 'Helvetica')
        const variant = variantFromFlags(element.bold, element.italic)
        const activeFont = await getOrEmbedFont(pdf, fontId, variant, embedCache)

        const lineHeight = (element.lineHeight || 1.2) * element.fontSize

        // Helper to wrap text precisely within width
        const rawBlocks = element.text.split('\n')
        const wrappedLines: string[] = []
        for (const block of rawBlocks) {
          if (!block) {
            wrappedLines.push('')
            continue
          }
          const words = block.split(/(\s+)/) // keep space as tokens
          let currentLine = ''
          for (const word of words) {
            if (!word) continue
            const testLine = currentLine + word
            const width = activeFont.widthOfTextAtSize(testLine, element.fontSize)
            if (width > element.width && currentLine !== '') {
              if (word.trim() === '') {
                // If it's just spaces exceeding width, we skip them
                continue
              }
              wrappedLines.push(currentLine)
              currentLine = word
            } else {
              currentLine = testLine
            }
          }
          if (currentLine) {
            wrappedLines.push(currentLine)
          }
        }

        wrappedLines.forEach((line, index) => {
          let textX = element.x
          const textWidth = activeFont.widthOfTextAtSize(line, element.fontSize)

          if (element.textAlign === 'center') {
            textX = element.x + element.width / 2 - textWidth / 2
          } else if (element.textAlign === 'right') {
            textX = element.x + element.width - textWidth
          }

          // The first line baseline starts 1 fontSize from the top of the box.
          const textY = pageHeight - element.y - element.fontSize - index * lineHeight

          // To rotate around the center of the text element:
          const cx = element.x + element.width / 2
          const cy = pageHeight - (element.y + element.height / 2)

          // Translate to origin, rotate, translate back
          const dx = textX - cx
          const dy = textY - cy
          const rad = -element.rotation * (Math.PI / 180) // negative because PDF is CCW

          const rotatedX = cx + dx * Math.cos(rad) - dy * Math.sin(rad)
          const rotatedY = cy + dx * Math.sin(rad) + dy * Math.cos(rad)

          page.drawText(line, {
            x: rotatedX,
            y: rotatedY,
            size: element.fontSize,
            font: activeFont,
            color: rgb(...parseHexColor(element.color)),
            rotate: degrees(-element.rotation),
          })

          if (element.link) {
            const linkDx = textX - cx
            const linkDy = textY - 2 - cy
            const linkRotatedX = cx + linkDx * Math.cos(rad) - linkDy * Math.sin(rad)
            const linkRotatedY = cy + linkDx * Math.sin(rad) + linkDy * Math.cos(rad)

            const endDx = textX + textWidth - cx
            const endDy = textY - 2 - cy
            const endRotatedX = cx + endDx * Math.cos(rad) - endDy * Math.sin(rad)
            const endRotatedY = cy + endDx * Math.sin(rad) + endDy * Math.cos(rad)

            page.drawLine({
              start: { x: linkRotatedX, y: linkRotatedY },
              end: { x: endRotatedX, y: endRotatedY },
              thickness: 1,
              color: rgb(...parseHexColor(element.color)),
            })
          }
        })
      }

      if (element.link) {
        applyLinkAnnotation(page, {
          id: element.id,
          rect: domToPdfRect(element.x, element.y, element.width, element.height, pageHeight),
          url: element.link.url,
        })
      }
    } else if (element.type === 'image' || element.type === 'signature') {
      let pdfImage

      
      let imageBuffer: ArrayBuffer | string = element.src
      const isWebp = element.type === 'image' && element.mimeType === 'image/webp'
      
      if (isWebp) {
        // convert WebP to PNG buffer for pdf-lib
        imageBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
          const img = new Image()
          img.onload = () => {
            const canvas = document.createElement('canvas')
            canvas.width = img.width
            canvas.height = img.height
            canvas.getContext('2d')?.drawImage(img, 0, 0)
            canvas.toBlob(blob => {
              if (blob) blob.arrayBuffer().then(resolve).catch(reject)
              else reject(new Error('Canvas toBlob failed'))
            }, 'image/png')
          }
          img.onerror = reject
          img.src = element.src
        })
      } else if (element.src.startsWith('blob:')) {
        const response = await fetch(element.src)
        imageBuffer = await response.arrayBuffer()
      } else if (element.src.startsWith('data:image/')) {
        const response = await fetch(element.src)
        imageBuffer = await response.arrayBuffer()
      }

      const isJpeg = (element.type === 'image' && (element.mimeType === 'image/jpeg' || element.mimeType === 'image/jpg')) || element.src.startsWith('data:image/jpeg') || element.src.startsWith('data:image/jpg')
      
      if (isJpeg) {
        pdfImage = await pdf.embedJpg(imageBuffer)
      } else {
        pdfImage = await pdf.embedPng(imageBuffer)
      }

      const imgX = element.x
      const imgY = pageHeight - element.y - element.height
      
      const cx = element.x + element.width / 2
      const cy = pageHeight - (element.y + element.height / 2)
      
      const dx = imgX - cx
      const dy = imgY - cy
      const rad = -element.rotation * (Math.PI / 180)
      
      const rotatedX = cx + dx * Math.cos(rad) - dy * Math.sin(rad)
      const rotatedY = cy + dx * Math.sin(rad) + dy * Math.cos(rad)

      page.drawImage(pdfImage, {
        x: rotatedX,
        y: rotatedY,
        width: element.width,
        height: element.height,
        rotate: degrees(-element.rotation),
      })
    } else if (element.type === 'drawing') {
      // Calculate inkLists - for perfect-freehand, it generates a polygon (filled shape)
      // Standard PDF Ink annotations don't support filled shapes, they only support strokes.
      // So instead of just generating the path, we will save the raw points as InkList for true /Ink annotation.
      // We still use perfect-freehand points in the UI, but export standard lines in the PDF.
      // Alternatively, we could save the outline stroke from perfect-freehand, but PDF InkList is just
      // an array of strokes, where each stroke is an array of [x, y].
      // For a single drawing stroke, we'll map the element's raw points to PDF coordinates.
      
      const inkStroke = element.points.map(p => {
        const x = element.x + p.x
        const y = element.y + p.y
        return [x, pageHeight - y] as [number, number]
      })

      applyInkAnnotation(page, {
        id: element.id,
        rect: domToPdfRect(element.x, element.y, element.width, element.height, pageHeight),
        inkLists: [inkStroke],
        color: parseHexColor(element.color),
        strokeWidth: element.strokeWidth
      })
    } else if (element.type === 'note') {
      applyTextAnnotation(page, {
        id: element.id,
        rect: domToPdfRect(element.x, element.y, element.width, element.height, pageHeight),
        contents: element.text,
        color: parseHexColor(element.color),
        author: element.author || 'User',
      })
    }
  }

  // Draw watermark if configured
  if (documentState.watermark && documentState.watermark.source === 'user') {
    const wm = documentState.watermark
    const wmFont = await getOrEmbedFont(pdf, 'helvetica', 'bold', embedCache)
    let pdfImage: Awaited<ReturnType<typeof pdf.embedPng>> | undefined
    if (wm.type === 'image' && wm.imageBytes) {
      try {
        pdfImage = await pdf.embedPng(wm.imageBytes)
      } catch {
        pdfImage = await pdf.embedJpg(wm.imageBytes)
      }
    }

    for (let i = 0; i < pdf.getPageCount(); i++) {
      const page = pdf.getPage(i)
      const { width, height } = page.getSize()
      const cx = width / 2
      const cy = height / 2

      if (wm.type === 'text' && wm.text) {
        const font = wmFont
        // Start with base size of 72, scale it
        const fontSize = 72 * wm.scale
        const textWidth = font.widthOfTextAtSize(wm.text, fontSize)
        const textHeight = font.heightAtSize(fontSize)
        
        // Calculate offset to rotate around center of text
        // In pdf-lib, rotation is around (x,y) which is the bottom-left of the text bounding box.
        // We want the center of the text to be at (cx, cy).
        // The bottom-left of the text unrotated would be:
        // tx = cx - textWidth / 2
        // ty = cy - textHeight / 2
        
        const dx = -textWidth / 2
        const dy = -textHeight / 2
        const rad = -wm.rotation * (Math.PI / 180)
        
        const rotatedX = cx + dx * Math.cos(rad) - dy * Math.sin(rad)
        const rotatedY = cy + dx * Math.sin(rad) + dy * Math.cos(rad)
        
        page.drawText(wm.text, {
          x: rotatedX,
          y: rotatedY,
          size: fontSize,
          font,
          color: rgb(...parseHexColor(wm.color || '#ff0000')),
          opacity: wm.opacity,
          rotate: degrees(-wm.rotation),
        })
      } else if (wm.type === 'image' && pdfImage) {
        const imgDims = pdfImage.scale(1)
        // Keep within 80% of page size max
        const maxWidth = width * 0.8
        const maxHeight = height * 0.8
        let drawW = imgDims.width
        let drawH = imgDims.height
        
        if (drawW > maxWidth) {
          drawH = drawH * (maxWidth / drawW)
          drawW = maxWidth
        }
        if (drawH > maxHeight) {
          drawW = drawW * (maxHeight / drawH)
          drawH = maxHeight
        }
        
        // apply scale
        drawW *= wm.scale
        drawH *= wm.scale
        
        const dx = -drawW / 2
        const dy = -drawH / 2
        const rad = -wm.rotation * (Math.PI / 180)
        
        const rotatedX = cx + dx * Math.cos(rad) - dy * Math.sin(rad)
        const rotatedY = cy + dx * Math.sin(rad) + dy * Math.cos(rad)
        
        page.drawImage(pdfImage, {
          x: rotatedX,
          y: rotatedY,
          width: drawW,
          height: drawH,
          opacity: wm.opacity,
          rotate: degrees(-wm.rotation),
        })
      }
    }
  }

  return pdf.save()
}

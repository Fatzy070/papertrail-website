import { PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib'
import type { PdfDocumentState, EditorElement } from '../types/editor'
import { applyTextAnnotation } from './annotations/text-annotation'
import { applyInkAnnotation } from './annotations/ink-annotation'
import { parseHexColor, domToPdfRect } from './annotations/annotation-utils'
import { applyLinkAnnotation } from './annotations/link-annotation'


export async function exportPdf(documentState: PdfDocumentState, allElements: EditorElement[]) {
  const originalPdf = await PDFDocument.load(documentState.bytes)
  const pdf = await PDFDocument.create()
  
  const fonts = {
    helvetica: {
      regular: await pdf.embedFont(StandardFonts.Helvetica),
      bold: await pdf.embedFont(StandardFonts.HelveticaBold),
      italic: await pdf.embedFont(StandardFonts.HelveticaOblique),
      boldItalic: await pdf.embedFont(StandardFonts.HelveticaBoldOblique),
    },
    times: {
      regular: await pdf.embedFont(StandardFonts.TimesRoman),
      bold: await pdf.embedFont(StandardFonts.TimesRomanBold),
      italic: await pdf.embedFont(StandardFonts.TimesRomanItalic),
      boldItalic: await pdf.embedFont(StandardFonts.TimesRomanBoldItalic),
    },
    courier: {
      regular: await pdf.embedFont(StandardFonts.Courier),
      bold: await pdf.embedFont(StandardFonts.CourierBold),
      italic: await pdf.embedFont(StandardFonts.CourierOblique),
      boldItalic: await pdf.embedFont(StandardFonts.CourierBoldOblique),
    }
  }

  // Iterate over documentState.pages and reconstruct the PDF
  const pageIdToIndex = new Map<string, number>()
  for (let i = 0; i < documentState.pages.length; i++) {
    const pageInfo = documentState.pages[i]
    pageIdToIndex.set(pageInfo.id, i)
    if (pageInfo.kind === 'blank') {
      pdf.addPage([pageInfo.width, pageInfo.height])
    } else {
      const originalIndex = pageInfo.sourcePageIndex ?? i
      const [copiedPage] = await pdf.copyPages(originalPdf, [originalIndex])
      pdf.addPage(copiedPage)
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

      if (element.text.trim()) {
        const family = element.fontFamily?.toLowerCase() || ''
        const fontSet = family.includes('times') || family.includes('serif') ? fonts.times
                      : family.includes('courier') || family.includes('mono') ? fonts.courier
                      : fonts.helvetica

        const activeFont = element.bold && element.italic ? fontSet.boldItalic
                         : element.bold ? fontSet.bold
                         : element.italic ? fontSet.italic
                         : fontSet.regular;

        const lines = element.text.split('\n')
        const lineHeight = (element.lineHeight || 1.2) * element.fontSize

        lines.forEach((line, index) => {
          let textX = element.x
          
          if (element.textAlign === 'center' || element.textAlign === 'right') {
            const textWidth = activeFont.widthOfTextAtSize(line, element.fontSize)
            if (element.textAlign === 'center') {
              textX = element.x + (element.width / 2) - (textWidth / 2)
            } else if (element.textAlign === 'right') {
              textX = element.x + element.width - textWidth
            }
          }

          const textY = pageHeight - element.y - element.fontSize - (index * lineHeight)
          
          page.drawText(line, {
            x: textX,
            y: textY,
            size: element.fontSize,
            font: activeFont,
            color: rgb(...parseHexColor(element.color)),
            rotate: degrees(element.rotation),
          })
          
          if (element.link) {
            const textWidth = activeFont.widthOfTextAtSize(line, element.fontSize)
            page.drawLine({
              start: { x: textX, y: textY - 2 },
              end: { x: textX + textWidth, y: textY - 2 },
              thickness: 1,
              color: rgb(...parseHexColor(element.color))
            })
          }
        })
        
        if (element.link) {
          applyLinkAnnotation(page, {
            id: element.id,
            rect: domToPdfRect(element.x, element.y, element.width, element.height, pageHeight),
            url: element.link.url
          })
        }
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
      }

      const isJpeg = (element.type === 'image' && (element.mimeType === 'image/jpeg' || element.mimeType === 'image/jpg')) || element.src.startsWith('data:image/jpeg') || element.src.startsWith('data:image/jpg')
      
      if (isJpeg) {
        pdfImage = await pdf.embedJpg(imageBuffer)
      } else {
        pdfImage = await pdf.embedPng(imageBuffer)
      }

      page.drawImage(pdfImage, {
        x: element.x,
        y: pageHeight - element.y - element.height,
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

  return pdf.save()
}

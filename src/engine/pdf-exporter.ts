import { PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib'
import type { PdfDocumentState, TextElement } from '../types/editor'

function parseColor(hex: string) {
  const value = hex.replace('#', '')
  const red = Number.parseInt(value.slice(0, 2), 16) / 255
  const green = Number.parseInt(value.slice(2, 4), 16) / 255
  const blue = Number.parseInt(value.slice(4, 6), 16) / 255
  return rgb(Number.isNaN(red) ? 0.12 : red, Number.isNaN(green) ? 0.16 : green, Number.isNaN(blue) ? 0.21 : blue)
}

export async function exportPdf(documentState: PdfDocumentState, elements: TextElement[]) {
  const pdf = await PDFDocument.load(documentState.bytes)
  const font = await pdf.embedFont(StandardFonts.Helvetica)

  elements.filter((element) => element.edited || element.source === 'user').forEach((element) => {
    const page = pdf.getPage(element.pageIndex)
    const pageHeight = page.getHeight()
    const original = element.originalBounds ?? element
    const coverY = pageHeight - original.y - original.height
    page.drawRectangle({
      x: original.x,
      y: coverY,
      width: original.width,
      height: original.height + 2,
      color: rgb(1, 1, 1),
      opacity: 0.98,
    })

    if (element.text.trim()) {
      page.drawText(element.text, {
        x: element.x,
        y: pageHeight - element.y - element.height,
        size: element.fontSize,
        font,
        color: parseColor(element.color),
        rotate: degrees(element.rotation),
      })
    }
  })

  return pdf.save()
}

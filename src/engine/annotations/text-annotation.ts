import { PDFPage, PDFDict, PDFName, PDFString, PDFHexString } from 'pdf-lib'
import type { TextAnnotationData } from './annotation-types'

export function applyTextAnnotation(page: PDFPage, data: TextAnnotationData) {
  const dict = page.doc.context.obj({
    Type: 'Annot',
    Subtype: 'Text',
    Rect: data.rect,
    Contents: PDFString.of(data.contents),
    NM: PDFString.of(data.id),
    C: [data.color[0], data.color[1], data.color[2]],
    Name: 'Comment',
    Open: data.open ?? false,
    ...(data.author ? { T: PDFString.of(data.author) } : {})
  })

  let annots = page.node.Annots()
  if (!annots) {
    annots = page.doc.context.obj([])
    page.node.set(PDFName.of('Annots'), annots)
  }

  // Find existing
  let existingIndex = -1
  for (let i = 0; i < annots.size(); i++) {
    const annotRef = annots.get(i)
    const annot = page.doc.context.lookup(annotRef)
    if (annot instanceof PDFDict) {
      const nm = annot.lookup(PDFName.of('NM'))
      let nmValue = ''
      if (nm instanceof PDFString) nmValue = nm.decodeText()
      else if (nm instanceof PDFHexString) nmValue = nm.decodeText()
      
      if (nmValue === data.id) {
        existingIndex = i
        break
      }
    }
  }

  const newRef = page.doc.context.register(dict)
  
  if (existingIndex !== -1) {
    annots.set(existingIndex, newRef)
  } else {
    annots.push(newRef)
  }
}

export function removeAnnotation(page: PDFPage, id: string) {
  const annots = page.node.Annots()
  if (!annots) return

  for (let i = annots.size() - 1; i >= 0; i--) {
    const annotRef = annots.get(i)
    const annot = page.doc.context.lookup(annotRef)
    if (annot instanceof PDFDict) {
      const nm = annot.lookup(PDFName.of('NM'))
      let nmValue = ''
      if (nm instanceof PDFString) nmValue = nm.decodeText()
      else if (nm instanceof PDFHexString) nmValue = nm.decodeText()
      
      if (nmValue === id) {
        annots.remove(i)
        break
      }
    }
  }
}

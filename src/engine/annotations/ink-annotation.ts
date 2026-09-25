import { PDFPage, PDFDict, PDFName, PDFString, PDFHexString } from 'pdf-lib'
import type { InkAnnotationData } from './annotation-types'

export function applyInkAnnotation(page: PDFPage, data: InkAnnotationData) {
  const inkListsArray = page.doc.context.obj(
    data.inkLists.map(stroke => 
      page.doc.context.obj(
        stroke.flatMap(point => [point[0], point[1]])
      )
    )
  )

  const borderArray = page.doc.context.obj([0, 0, data.strokeWidth])

  const dict = page.doc.context.obj({
    Type: 'Annot',
    Subtype: 'Ink',
    Rect: data.rect,
    InkList: inkListsArray,
    NM: PDFString.of(data.id),
    C: [data.color[0], data.color[1], data.color[2]],
    Border: borderArray,
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

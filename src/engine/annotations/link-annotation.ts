import { PDFPage, PDFDict, PDFName, PDFString } from 'pdf-lib'

export interface LinkAnnotationData {
  id: string
  rect: [number, number, number, number]
  url: string
}

export function applyLinkAnnotation(page: PDFPage, data: LinkAnnotationData) {
  const doc = page.doc
  
  // Create URI action dictionary
  const actionDict = doc.context.obj({
    Type: 'Action',
    S: 'URI',
    URI: PDFString.of(data.url)
  })

  // Create Link annotation dictionary
  const annotDict = doc.context.obj({
    Type: 'Annot',
    Subtype: 'Link',
    Rect: data.rect,
    A: actionDict,
    Border: [0, 0, 0], // No border, as styling is handled visually
    NM: PDFString.of(`link-${data.id}`)
  })

  let annots = page.node.lookup(PDFName.of('Annots')) as import('pdf-lib').PDFArray | undefined
  if (!annots) {
    annots = doc.context.obj([]) as import('pdf-lib').PDFArray
    page.node.set(PDFName.of('Annots'), annots)
  }

  // Remove existing annotation with the same ID if any
  const size = annots.size()
  for (let i = size - 1; i >= 0; i--) {
    const annotRef = annots.get(i)
    try {
      const annot = doc.context.lookup(annotRef) as PDFDict
      if (annot && annot.get(PDFName.of('NM'))) {
        const nm = annot.get(PDFName.of('NM')) as PDFString
        if (nm.decodeText() === `link-${data.id}`) {
          annots.remove(i)
        }
      }
    } catch {
      // Ignore
    }
  }

  const annotRef = doc.context.register(annotDict)
  annots.push(annotRef)
}

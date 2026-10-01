import { PDFDocument } from 'pdf-lib'
import * as mupdf from 'mupdf'
import fs from 'fs'

type DestroyableMuPdfBuffer = {
  destroy?: () => void
}

async function run() {
  console.log('--- MuPDF Buffer Detachment Diagnostic ---')
  const pdfBytes = fs.readFileSync('../backend/scripts/dummy.pdf')

  let outBuffer: Uint8Array
  let mupdfBufferObj: DestroyableMuPdfBuffer | undefined

  try {
    const baseDoc = mupdf.Document.openDocument(pdfBytes, 'application/pdf')
    const doc = baseDoc.asPDF()
    if (!doc) throw new Error('Not a PDF')
    
    // Simulate some simple change
    const page = doc.loadPage(0)
    const annot = page.createAnnotation('Redact')
    annot.setRect([0, 0, 100, 100])
    page.applyRedactions(false, 0, 0, 0)
    page.update()

    const outBuf = doc.saveToBuffer("")
    mupdfBufferObj = outBuf
    outBuffer = outBuf.asUint8Array()
    console.log(`outBuffer length inside scope: ${outBuffer.byteLength}`)
  } catch (e) {
    console.error('MuPDF error:', e)
    return
  }

  // At this point outBuffer is a Uint8Array backed by MuPDF's WASM memory
  console.log(`outBuffer length after MuPDF scope: ${outBuffer.byteLength}`)

  try {
    console.log('Loading with pdf-lib...')
    const pdf = await PDFDocument.load(outBuffer)
    console.log('Loaded successfully.')
    
    // Force garbage collection in JS (if possible) or just do an operation
    console.log('Modifying with pdf-lib...')
    const page = pdf.getPages()[0]
    page.drawText('Hello', { x: 50, y: 50, size: 24 })
    
    // Destroy mupdf buffer to simulate GC
    if (mupdfBufferObj && typeof mupdfBufferObj.destroy === 'function') {
      console.log('Simulating GC of MuPDF Buffer...')
      mupdfBufferObj.destroy()
    }
    
    console.log('Saving with pdf-lib...')
    const finalBytes = await pdf.save()
    console.log(`Saved successfully. Final bytes: ${finalBytes.byteLength}`)
  } catch (e: unknown) {
    console.error('PDF-Lib Error:', e instanceof Error ? e.message : e)
    if (e instanceof Error) console.error(e.stack)
  }
  
  console.log('--- Test Independent Copy ---')
  try {
    const safeBytes = new Uint8Array(outBuffer) // Creates an independent copy
    console.log(`safeBytes length: ${safeBytes.byteLength}`)
    const pdf2 = await PDFDocument.load(safeBytes)
    const page2 = pdf2.getPages()[0]
    page2.drawText('Safe Copy', { x: 50, y: 50, size: 24 })
    const finalBytes2 = await pdf2.save()
    console.log(`Independent copy saved successfully. Length: ${finalBytes2.byteLength}`)
  } catch (e: unknown) {
    console.error('Safe Copy Error:', e instanceof Error ? e.message : e)
  }
}

run().catch(console.error)

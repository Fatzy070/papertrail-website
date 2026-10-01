import { PDFDocument } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import fs from 'fs'
import * as mupdf from 'mupdf'

async function run() {
  try {
    const nodeBuffer = fs.readFileSync('/home/fatzy/Downloads/Recipt1771584462029.pdf')
    // Convert to strict ArrayBuffer to simulate browser
    const arrayBuffer = nodeBuffer.buffer.slice(nodeBuffer.byteOffset, nodeBuffer.byteOffset + nodeBuffer.byteLength)
    
    // 1. Redact
    const baseDoc = mupdf.Document.openDocument(arrayBuffer, 'application/pdf')
    const doc = baseDoc.asPDF()
    const page = doc.loadPage(0) as mupdf.PDFPage
    const annot = page.createAnnotation('Redact')
    annot.setRect([100, 100, 200, 200]) // huge rect to intersect all text
    page.applyRedactions(false, 0, 0, 0)
    page.update()
    const outBuf = doc.saveToBuffer("")
    const mutationBase = new Uint8Array(outBuf.asUint8Array())
    
    console.log("MuPDF returned buffer of length", mutationBase.length)

    // 2. pdf-lib load
    console.log("Loading originalPdf...")
    const originalPdf = await PDFDocument.load(mutationBase)
    
    console.log("Creating new pdf...")
    const pdf = await PDFDocument.create()
    pdf.registerFontkit(fontkit)
    
    console.log("Copying pages...")
    const [copiedPage] = await pdf.copyPages(originalPdf, [0])
    pdf.addPage(copiedPage)
    
    console.log("Saving pdf...")
    const finalBytes = await pdf.save()
    console.log("Success! final size:", finalBytes.length)

  } catch (e: unknown) {
    console.error('ERROR:', e instanceof Error ? e.message : e)
    if (e instanceof Error) console.error(e.stack)
  }
}
run()

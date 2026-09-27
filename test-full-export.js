import { exportPdf } from './src/engine/pdf-exporter.ts'

window.runFullExportTest = async (file) => {
  try {
    const arrayBuffer = await file.arrayBuffer()
    
    // Construct fake document state and elements
    const documentState = {
      id: 'test-doc',
      name: 'test.pdf',
      bytes: arrayBuffer,
      pages: []
    }
    
    const { PDFDocument } = await import('pdf-lib')
    const tempDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true })
    const pageCount = tempDoc.getPageCount()
    
    for (let i=0; i<pageCount; i++) {
      documentState.pages.push({
        id: `page-${i}`,
        kind: 'source',
        sourcePageIndex: i,
        width: 600,
        height: 800
      })
    }
    
    const allElements = [
      {
        id: 'elem-1',
        type: 'text',
        source: 'pdf',
        pageId: 'page-0',
        deleted: true, // triggers redaction
        x: 50,
        y: 50,
        width: 100,
        height: 20,
        text: 'test'
      }
    ]
    
    console.log("Starting FIRST exportPdf...")
    const finalBytes1 = await exportPdf(documentState, allElements)
    console.log("FIRST SUCCESS! final bytes: " + finalBytes1.length)
    
    // Mimic markSaved
    documentState.bytes = finalBytes1.buffer;
    console.log("documentState.bytes is now buffer of length: " + documentState.bytes.byteLength);

    console.log("Starting SECOND exportPdf...")
    const finalBytes2 = await exportPdf(documentState, allElements)
    console.log("SECOND SUCCESS! final bytes: " + finalBytes2.length)
    
    return "SUCCESS"
  } catch(e) {
    console.error(e)
    return "ERROR: " + e.message + "\n" + e.stack
  }
}

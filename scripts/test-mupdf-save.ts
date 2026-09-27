import fs from 'fs'
import { applyMuPdfRedactions } from '../src/engine/mupdf/mupdf-redaction'

async function run() {
  const bytes = fs.readFileSync('.user_uploaded/paystack.pdf')
  console.log('Original length:', bytes.length)
  
  const redaction = {
    id: 'test',
    pageId: 'page1',
    sourcePageIndex: 0,
    rect: { x: 50, y: 50, width: 200, height: 50 }
  }
  
  try {
    const outBytes = await applyMuPdfRedactions(bytes, [redaction])
    console.log('MuPDF output length:', outBytes.byteLength)
    fs.writeFileSync('scripts/mupdf-diagnostic.pdf', outBytes)
    console.log('Saved to scripts/mupdf-diagnostic.pdf')
  } catch (e) {
    console.error('Error:', e)
  }
}
run()

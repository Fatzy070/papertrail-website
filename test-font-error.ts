import { PDFDocument, rgb } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import fs from 'fs'

async function run() {
  try {
    const originalPdf = await PDFDocument.load(fs.readFileSync('/home/fatzy/Downloads/Recipt1771584462029.pdf'))
    const pdf = await PDFDocument.create()
    pdf.registerFontkit(fontkit)
    
    const [copiedPage] = await pdf.copyPages(originalPdf, [0])
    pdf.addPage(copiedPage)
    
    console.log("Fetching font...");
    // Mock browser user agent
    const res = await fetch('https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfMZhrj72A.ttf', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36'
      }
    });
    const bytes = await res.arrayBuffer();
    
    console.log("Embedding font...");
    const font = await pdf.embedFont(bytes);
    
    console.log("Saving pdf...");
    const finalBytes = await pdf.save();
    console.log("Success! final size:", finalBytes.length)

  } catch (e: any) {
    console.error("ERROR:", e.message)
    console.error(e.stack)
  }
}
run()

import fs from 'fs';
import * as mupdf from 'mupdf';

async function run() {
  const fileBytes = fs.readFileSync('/home/fatzy/Downloads/Paystack_Merchant_Service_Agreement_2021675.pdf');
  const muDoc = mupdf.Document.openDocument(fileBytes, "application/pdf");
  const muPage = muDoc.loadPage(0); // page 0
  const stext = muPage.toStructuredText();
  const stextJson = JSON.parse(stext.asJSON());
  
  console.log("=== 12. MuPDF StructuredText ===");
  for (const block of stextJson.blocks) {
    if (block.type === 'text' || block.type === 0) {
      for (const line of block.lines) {
         if (line.text && line.text.toLowerCase().includes('parvis')) {
           console.log("MuPDF Line:", JSON.stringify(line, null, 2));
         }
      }
    }
  }
}
run().catch(console.error);

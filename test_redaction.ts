import fs from 'fs';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import * as mupdf from 'mupdf';
import { PDFDocument } from 'pdf-lib';
import { applyMuPdfRedactions } from './src/engine/mupdf/mupdf-redaction.ts';

async function extractTextWithPdfjs(bytes: Uint8Array) {
  const pdfjsDoc = await getDocument({ data: bytes }).promise;
  let fullText = "";
  for (let i = 1; i <= pdfjsDoc.numPages; i++) {
    const page = await pdfjsDoc.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map((item: any) => item.str).join(' ');
    fullText += pageText + " ";
  }
  return fullText;
}

async function run() {
  const fileBytes = fs.readFileSync('/home/fatzy/Downloads/Paystack_Merchant_Service_Agreement_2021675.pdf');
  
  console.log("=== 1. Extract Text From Original Bytes ===");
  const origText = await extractTextWithPdfjs(new Uint8Array(fileBytes));
  console.log("Old URL found:", origText.includes("https://www.parvis.com.ng"));
  console.log("New URL found:", origText.includes("https://www.ogunsolafaruk.name.ng"));
  
  console.log("\n=== 3. Extract Text From MuPDF Intermediate Bytes ===");
  // Hardcode the redaction bounding box that encompasses the URL on page 0
  const pendingRedaction = {
    id: "test",
    pageId: "page-0",
    sourcePageIndex: 0,
    rect: {
      x: 61,
      y: 288,
      width: 147,
      height: 16
    }
  };
  
  const mupdfBytes = await applyMuPdfRedactions(fileBytes.buffer, [pendingRedaction]);
  const mupdfText = await extractTextWithPdfjs(mupdfBytes);
  console.log("Old URL found:", mupdfText.includes("https://www.parvis.com.ng"));
  console.log("Old URL (no scheme) found:", mupdfText.includes("parvis.com.ng"));
  
  console.log("\n=== 4. Reopen MuPDF Output With MuPDF ===");
  const muDoc2 = mupdf.Document.openDocument(mupdfBytes, "application/pdf");
  const muPage2 = muDoc2.loadPage(0);
  const stext2 = JSON.parse(muPage2.toStructuredText().asJSON());
  let foundInMuPdf = false;
  for (const block of stext2.blocks) {
    if (block.type === 'text' || block.type === 0) {
      for (const line of block.lines) {
         if (line.text && line.text.includes('parvis.com.ng')) {
           foundInMuPdf = true;
         }
      }
    }
  }
  console.log("Old URL found in MuPDF StructuredText:", foundInMuPdf);
  
  console.log("\n=== 5. Extract Text From Final pdf-lib Bytes ===");
  // We'll run the actual export using existing exported file if available
  const exportedPath = '/home/fatzy/Downloads/Paystack_Merchant_Service_Agreement_2021675-edited.pdf';
  if (fs.existsSync(exportedPath)) {
      const exportedBytes = fs.readFileSync(exportedPath);
      const exportedText = await extractTextWithPdfjs(new Uint8Array(exportedBytes));
      console.log("Old URL found:", exportedText.includes("https://www.parvis.com.ng"));
      console.log("Old URL (no scheme) found:", exportedText.includes("parvis.com.ng"));
      console.log("New URL found:", exportedText.includes("https://www.ogunsolafaruk.name.ng"));
  }
  
}
run().catch(console.error);

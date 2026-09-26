import fs from 'fs';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { applyMuPdfRedactions } from './src/engine/mupdf/mupdf-redaction.ts';

async function extractTextWithPdfjs(bytes: Uint8Array) {
  const pdfjsDoc = await getDocument({ data: bytes }).promise;
  const page = await pdfjsDoc.getPage(1);
  const content = await page.getTextContent();
  return content.items.map((item: any) => item.str).join(' ');
}

async function run() {
  const originalBytes = fs.readFileSync('/home/fatzy/Downloads/Paystack_Merchant_Service_Agreement_2021675.pdf');
  
  const pendingRedaction = {
    id: "test",
    pageId: "page-0",
    sourcePageIndex: 0,
    rect: { x: 63, y: 290, width: 70, height: 12 } // Half width
  };
  
  const redactedBytes = await applyMuPdfRedactions(originalBytes.buffer, [pendingRedaction]);
  const text = await extractTextWithPdfjs(redactedBytes);
  console.log("Extracted text near URL:");
  console.log(text.substring(text.indexOf('https'), text.indexOf('https') + 50));
}
run().catch(console.error);

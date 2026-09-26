import fs from 'fs';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { applyMuPdfRedactions } from './src/engine/mupdf/mupdf-redaction.ts';

async function run() {
  const originalBytes = fs.readFileSync('/home/fatzy/Downloads/Paystack_Merchant_Service_Agreement_2021675.pdf');
  
  const pendingRedaction = {
    id: "test",
    pageId: "page-0",
    sourcePageIndex: 0,
    rect: { x: 61, y: 288, width: 147, height: 16 }
  };
  
  const redactedBytes = await applyMuPdfRedactions(originalBytes.buffer, [pendingRedaction]);
  const pdfjsDoc = await getDocument({ data: redactedBytes }).promise;
  const page = await pdfjsDoc.getPage(1);
  const content = await page.getTextContent();
  const text = content.items.map((item: any) => item.str).join(' ');
  const idx = text.indexOf('Entity');
  console.log(text.substring(idx, idx + 200));
}
run().catch(console.error);

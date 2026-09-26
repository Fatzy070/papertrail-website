import fs from 'fs';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { applyMuPdfRedactions } from './src/engine/mupdf/mupdf-redaction.ts';

async function runTest(padding: number, yShift: number) {
  const originalBytes = fs.readFileSync('/home/fatzy/Downloads/Paystack_Merchant_Service_Agreement_2021675.pdf');
  
  const x = 63.75;
  const y = 291.00;
  const w = 142.7;
  const h = 12;

  const pendingRedaction = {
    id: "test",
    pageId: "page-0",
    sourcePageIndex: 0,
    rect: { 
       x: x - padding, 
       y: y + yShift - padding, 
       width: w + padding*2, 
       height: h + padding*2 
    }
  };
  
  const redactedBytes = await applyMuPdfRedactions(originalBytes.buffer, [pendingRedaction]);
  const pdfjsDoc = await getDocument({ data: redactedBytes }).promise;
  const page = await pdfjsDoc.getPage(1);
  const content = await page.getTextContent();
  const text = content.items.map((item: any) => item.str).join(' ');
  const found = text.includes("parvis");
  console.log(`Padding ${padding}, Y-shift ${yShift}: Old URL found = ${found}`);
}

async function run() {
  await runTest(0, 0);       // Original bounding box
  await runTest(2, 0);       // Padding 2 (my change in pdf-exporter.ts)
  await runTest(2, 2.4);     // Padding 2 + 2.4 yShift (descent fix in coordinate-transformer.ts)
  await runTest(-2, 0);      // Negative padding (smaller box)
  await runTest(10, 10);     // Huge padding / shift
}
run().catch(console.error);

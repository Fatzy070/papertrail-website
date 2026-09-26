import fs from 'fs';
import { PDFDocument } from 'pdf-lib';
import * as mupdf from 'mupdf';
import { applyMuPdfRedactions } from './src/engine/mupdf/mupdf-redaction.ts';

async function run() {
  const originalBytes = fs.readFileSync('/home/fatzy/Downloads/Paystack_Merchant_Service_Agreement_2021675.pdf');
  
  // 1. Apply Redaction
  const pendingRedaction = {
    id: "test",
    pageId: "page-0",
    sourcePageIndex: 0,
    rect: { x: 61, y: 288, width: 147, height: 16 }
  };
  const redactedBytes = await applyMuPdfRedactions(originalBytes.buffer, [pendingRedaction]);
  fs.writeFileSync('test_mupdf.pdf', redactedBytes);
  console.log("Wrote test_mupdf.pdf");

  // 2. Load into pdf-lib and copy pages
  const baseDoc = await PDFDocument.load(redactedBytes);
  const outDoc = await PDFDocument.create();
  const copiedPages = await outDoc.copyPages(baseDoc, baseDoc.getPageIndices());
  for (const p of copiedPages) {
     outDoc.addPage(p);
  }
  
  // Wait, let's actually just run pdf-lib save
  const finalBytes = await outDoc.save();
  fs.writeFileSync('test_export.pdf', finalBytes);
  console.log("Wrote test_export.pdf");
}
run().catch(console.error);

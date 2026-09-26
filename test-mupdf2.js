import mupdf from 'mupdf';
import { PDFDocument, rgb } from 'pdf-lib';
import fs from 'fs';

async function run() {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([500, 500]);
  page.drawText('https://www.faruk.name.ng', { x: 50, y: 400, size: 24, color: rgb(0,0,0) });
  const pdfBytes = await pdfDoc.save();
  
  const doc = mupdf.PDFDocument.openDocument(pdfBytes, "application/pdf");
  const mPage = doc.loadPage(0);
  const annot = mPage.createAnnotation('Redact');
  annot.setRect([0, 0, 500, 500]); 
  mPage.applyRedactions(false, 0, 0, 0); // 0 = REDACT_TEXT_REMOVE
  mPage.update();
  const outBuf = doc.saveToBuffer("");
  fs.writeFileSync('out-test2.pdf', outBuf.asUint8Array());
  console.log("Saved bytes:", outBuf.asUint8Array().length);
}

run().catch(console.error);

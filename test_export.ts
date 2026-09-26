import fs from 'fs';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import * as mupdf from 'mupdf';
import { PDFDocument } from 'pdf-lib';
import { exportPdf } from './src/engine/pdf-exporter.ts';

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
  
  // Fake state
  const state = {
    id: 'test',
    name: 'test',
    bytes: new Uint8Array(fileBytes).buffer,
    pages: []
  };
  
  // Load pdf to find pages
  const origPdfLib = await PDFDocument.load(fileBytes);
  for (let i = 0; i < origPdfLib.getPageCount(); i++) {
     state.pages.push({ id: `page-${i}`, kind: 'source', sourcePageIndex: i, width: 600, height: 800, rotation: 0 });
  }
  
  // Fake elements
  const elements = [
    {
      type: 'text',
      id: 'pdf-text-page-0-12',
      pageId: 'page-0',
      source: 'pdf',
      text: '', // redacted
      deleted: true,
      x: 63,
      y: 290,
      width: 142,
      height: 12,
      originalBounds: {
        x: 63.75,
        y: 291.00, // My updated code will use ascent/descent, let's just use what was calculated
        width: 142.7,
        height: 12,
        rotation: 0
      }
    },
    {
      type: 'text',
      id: 'user-text-1',
      pageId: 'page-0',
      source: 'user',
      text: 'https://www.ogunsolafaruk.name.ng',
      x: 63,
      y: 290,
      width: 250,
      height: 12,
      fontSize: 12,
      color: '#000000',
      rotation: 0
    }
  ];
  
  console.log("=== 5. Extract Text From Final pdf-lib Bytes ===");
  const finalBytes = await exportPdf(state as any, elements as any);
  
  const exportedText = await extractTextWithPdfjs(finalBytes);
  console.log("Old URL found:", exportedText.includes("https://www.parvis.com.ng"));
  console.log("Old URL (no scheme) found:", exportedText.includes("parvis.com.ng"));
  console.log("New URL found:", exportedText.includes("https://www.ogunsolafaruk.name.ng"));
  
  fs.writeFileSync('test_output.pdf', Buffer.from(finalBytes));
  console.log("Saved to test_output.pdf");
}

run().catch(console.error);

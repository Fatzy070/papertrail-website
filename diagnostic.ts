import fs from 'fs';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import * as mupdf from 'mupdf';
import { extractNativeText } from './src/engine/text-extractor.ts';

async function run() {
  const fileBytes = fs.readFileSync('/home/fatzy/Downloads/Paystack_Merchant_Service_Agreement_2021675.pdf');
  const pdfjsDoc = await getDocument({ data: new Uint8Array(fileBytes) }).promise;
  
  const pages = [];
  for (let i = 0; i < pdfjsDoc.numPages; i++) {
     pages.push({ id: `page-${i}`, kind: 'source', sourcePageIndex: i, width: 600, height: 800, rotation: 0 });
  }
  
  const elements = await extractNativeText(pdfjsDoc, pages);
  
  console.log("=== 1. PDF.js Fragments near URL ===");
  const parvisItem = elements.find(i => i.text.toLowerCase().includes('parvis'));
  let targetItems;
  
  if (parvisItem) {
     const y = parvisItem.y;
     targetItems = elements.filter(i => Math.abs(i.y - y) < 10 && i.pageId === parvisItem.pageId);
     targetItems.sort((a,b) => a.x - b.x); // sort by X
  } else {
     targetItems = [];
  }
  
  for (const item of targetItems) {
     console.log("PDF.js Item:", JSON.stringify(item));
  }
  
  const targetPageNum = targetItems.length > 0 ? parseInt(targetItems[0].pageId.split('-')[1]) : 0;
  
  // Dump MuPDF StructuredText
  console.log("=== 12. MuPDF StructuredText ===");
  const muDoc = mupdf.Document.openDocument(fileBytes, "application/pdf");
  const muPage = muDoc.loadPage(targetPageNum);
  const stext = muPage.toStructuredText();
  const stextJson = JSON.parse(stext.asJSON());
  
  for (const block of stextJson.blocks) {
    if (block.type === 'text' || block.type === 0) {
      for (const line of block.lines) {
         let lineText = '';
         if (line.chars) {
           lineText = line.chars.map((c: any) => c.c).join('');
         } else if (line.spans) {
           for (const span of line.spans) {
              lineText += span.chars.map((c: any) => String.fromCharCode(c.c || c.char)).join('');
           }
         }
         if (lineText.toLowerCase().includes('parvis')) {
           console.log("MuPDF Line:", JSON.stringify(line, null, 2));
         }
      }
    }
  }
  
  // Also parse the exported PDF to check search
  const editedBytes = fs.readFileSync('/home/fatzy/Downloads/Paystack_Merchant_Service_Agreement_2021675-edited.pdf');
  const editedPdfjsDoc = await getDocument({ data: new Uint8Array(editedBytes) }).promise;
  const editedPages = [];
  for (let i = 0; i < editedPdfjsDoc.numPages; i++) {
     editedPages.push({ id: `page-${i}`, kind: 'source', sourcePageIndex: i, width: 600, height: 800, rotation: 0 });
  }
  const editedElements = await extractNativeText(editedPdfjsDoc, editedPages);
  
  console.log("=== 11. Extracted Text From Exported PDF ===");
  const editedTargetItems = editedElements.filter(i => {
       const text = i.text.toLowerCase();
       return text.includes('parvis') || text.includes('ogun') || text.includes('name') || text.includes('.com') || text.includes('.ng') || text.includes('http');
  });
  
  for (const item of editedTargetItems) {
     console.log("Edited PDF.js Item:", JSON.stringify(item));
  }
  
  console.log("=== 10. Exact Search Test ===");
  let fullExportText = editedElements.map(e => e.text).join(' ');
  console.log("https://www.parvis.com.ng/:", fullExportText.includes("https://www.parvis.com.ng/") ? "found" : "not found");
  console.log("https://parvis.com.ng:", fullExportText.includes("https://parvis.com.ng") ? "found" : "not found");
  console.log("parvis.com.ng:", fullExportText.includes("parvis.com.ng") ? "found" : "not found");
  console.log("parvis:", fullExportText.toLowerCase().includes("parvis") ? "found" : "not found");
  
}

run().catch(console.error);

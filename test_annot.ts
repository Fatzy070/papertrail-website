import fs from 'fs';
import { PDFDocument } from 'pdf-lib';
import * as mupdf from 'mupdf';
import { exportPdf } from './src/engine/pdf-exporter.ts';

async function run() {
  const fileBytes = fs.readFileSync('/home/fatzy/Downloads/Paystack_Merchant_Service_Agreement_2021675.pdf');
  
  console.log("=== 10. Check For Link Annotation in Original ===");
  const muDoc = mupdf.Document.openDocument(fileBytes, "application/pdf");
  const muPage = muDoc.loadPage(0); // target is page 0
  const annots = muPage.getAnnotations();
  let foundOriginal = false;
  for (const annot of annots) {
      if (annot.type === 'Link') {
         console.log("Found annotation:", annot.type, annot.bounds);
      }
  }
  
  // Actually, pdf-lib makes it very easy to read annotation dictionaries.
  const origPdfLib = await PDFDocument.load(fileBytes);
  const origPage = origPdfLib.getPage(0);
  const origAnnots = origPage.node.Annots();
  if (origAnnots) {
      for (let i = 0; i < origAnnots.size(); i++) {
         const annotRef = origAnnots.get(i);
         const annot = origPdfLib.context.lookup(annotRef);
         if (annot && annot.dict) {
           const dictMap = annot.dict;
           const subtype = dictMap.get(origPdfLib.context.obj('Subtype'));
           if (subtype && subtype.encodedName === '/Link') {
               const a = dictMap.get(origPdfLib.context.obj('A'));
               if (a) {
                   const aObj = origPdfLib.context.lookup(a);
                   const uri = aObj.get(origPdfLib.context.obj('URI'));
                   if (uri) {
                       console.log("Original PDF has Link Annotation with URI:", uri.toString());
                       foundOriginal = true;
                   }
               }
           }
         }
      }
  }
  
  if (foundOriginal) {
      console.log("Yes, Link Annotation exists containing the URL in original.");
  }
  
  // Now check final exported bytes
  const exportedPath = '/home/fatzy/Downloads/Paystack_Merchant_Service_Agreement_2021675-edited.pdf';
  if (fs.existsSync(exportedPath)) {
      const exportedBytes = fs.readFileSync(exportedPath);
      const finalPdfLib = await PDFDocument.load(exportedBytes);
      const finalPage = finalPdfLib.getPage(0);
      const finalAnnots = finalPage.node.Annots();
      let foundFinal = false;
      if (finalAnnots) {
          for (let i = 0; i < finalAnnots.size(); i++) {
             const annotRef = finalAnnots.get(i);
             const annot = finalPdfLib.context.lookup(annotRef);
             if (annot && annot.dict) {
               const dictMap = annot.dict;
               const subtype = dictMap.get(finalPdfLib.context.obj('Subtype'));
               if (subtype && subtype.encodedName === '/Link') {
                   const a = dictMap.get(finalPdfLib.context.obj('A'));
                   if (a) {
                       const aObj = finalPdfLib.context.lookup(a);
                       const uri = aObj.get(finalPdfLib.context.obj('URI'));
                       if (uri) {
                           console.log("Final Exported PDF has Link Annotation with URI:", uri.toString());
                           if (uri.toString().includes('parvis')) {
                               foundFinal = true;
                           }
                       }
                   }
               }
             }
          }
      }
      
      console.log("Old URL survives in Link Annotation on exported PDF:", foundFinal);
  }
  
}
run().catch(console.error);

import fs from 'fs';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

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
  const fileBytes = fs.readFileSync('test_export.pdf');
  const text = await extractTextWithPdfjs(new Uint8Array(fileBytes));
  console.log("Old URL found:", text.includes("parvis.com.ng"));
}
run().catch(console.error);

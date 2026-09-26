import fs from 'fs';
import { PDFDocument } from 'pdf-lib';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

async function run() {
  const fileBytes = fs.readFileSync('/home/fatzy/Downloads/Paystack_Merchant_Service_Agreement_2021675.pdf');
  const pdfjsDoc = await getDocument({ data: new Uint8Array(fileBytes) }).promise;
  for (let i = 1; i <= pdfjsDoc.numPages; i++) {
    const page = await pdfjsDoc.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map((item: any) => item.str).join(' ');
    if (pageText.includes('parvis')) {
        console.log(`Found parvis on page ${i}`);
    }
  }
}
run().catch(console.error);

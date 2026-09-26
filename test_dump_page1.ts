import fs from 'fs';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

async function run() {
  const fileBytes = fs.readFileSync('/home/fatzy/Downloads/Paystack_Merchant_Service_Agreement_2021675.pdf');
  const pdfjsDoc = await getDocument({ data: new Uint8Array(fileBytes) }).promise;
  const page = await pdfjsDoc.getPage(1);
  const content = await page.getTextContent();
  
  let matches = 0;
  content.items.forEach((item: any) => {
      if (item.str.toLowerCase().includes('parvis')) {
          matches++;
          console.log(`Match ${matches}: '${item.str}' at [${item.transform.join(', ')}]`);
      }
  });
  console.log(`Total matches on page 1: ${matches}`);
}
run().catch(console.error);

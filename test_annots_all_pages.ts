import fs from 'fs';
import { PDFDocument } from 'pdf-lib';

async function run() {
  const fileBytes = fs.readFileSync('/home/fatzy/Downloads/Paystack_Merchant_Service_Agreement_2021675.pdf');
  const pdf = await PDFDocument.load(fileBytes);
  for (let i = 0; i < pdf.getPageCount(); i++) {
      const page = pdf.getPage(i);
      const annots = page.node.Annots();
      if (annots) {
          for (let j = 0; j < annots.size(); j++) {
              const a = pdf.context.lookup(annots.get(j));
              if (a.toString().includes('parvis')) {
                  console.log(`Found 'parvis' in annotation on page ${i}:`, a.toString());
              }
          }
      }
  }
}
run().catch(console.error);

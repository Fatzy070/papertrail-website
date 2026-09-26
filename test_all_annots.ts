import fs from 'fs';
import { PDFDocument } from 'pdf-lib';

async function run() {
  const fileBytes = fs.readFileSync('/home/fatzy/Downloads/Paystack_Merchant_Service_Agreement_2021675.pdf');
  const pdf = await PDFDocument.load(fileBytes);
  const page = pdf.getPage(0);
  const annots = page.node.Annots();
  if (!annots) {
      console.log("No annotations on page 0!");
  } else {
      console.log(`Found ${annots.size()} annotations on page 0.`);
      for (let i = 0; i < annots.size(); i++) {
          const a = pdf.context.lookup(annots.get(i));
          console.log(a.toString());
      }
  }
}
run().catch(console.error);

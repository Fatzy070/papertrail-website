import fs from 'fs';
import * as mupdf from 'mupdf';

async function run() {
  const fileBytes = fs.readFileSync('/home/fatzy/Downloads/Paystack_Merchant_Service_Agreement_2021675.pdf');
  const muDoc = mupdf.Document.openDocument(fileBytes, "application/pdf");
  const muPage = muDoc.loadPage(0); // page 0
  const stext = muPage.toStructuredText();
  const stextJson = JSON.parse(stext.asJSON());
  
  console.log(JSON.stringify(stextJson.blocks[0], null, 2));
}
run().catch(console.error);

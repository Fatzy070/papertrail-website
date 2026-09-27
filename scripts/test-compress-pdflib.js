import fs from 'fs';
import { PDFDocument } from 'pdf-lib';

async function test() {
  const bytes = fs.readFileSync('../Paystack_Merchant_Service_Agreement_2021675.pdf');
  console.log('Original size:', bytes.length);

  const doc = await PDFDocument.load(bytes);
  const out1 = await doc.save({ useObjectStreams: false });
  console.log('pdf-lib false:', out1.length);
  const out2 = await doc.save({ useObjectStreams: true });
  console.log('pdf-lib true:', out2.length);
}
test();

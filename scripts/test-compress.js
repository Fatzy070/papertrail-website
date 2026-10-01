import fs from 'fs';
import * as mupdf from 'mupdf';

const bytes = fs.readFileSync('../Paystack_Merchant_Service_Agreement_2021675.pdf');
console.log('Original size:', bytes.length);

const doc = mupdf.Document.openDocument(bytes, 'application/pdf');
const outBuf = doc.saveToBuffer('garbage=3,compress,compress-fonts,compress-images');
console.log('Compressed size (MuPDF):', outBuf.asUint8Array().length);

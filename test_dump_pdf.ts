import fs from 'fs';
import { PDFDocument, PDFString, PDFHexString, PDFName, PDFDict, PDFArray, PDFStream } from 'pdf-lib';
import zlib from 'zlib';

async function run(path: string, label: string) {
  console.log(`\n=== DUMPING ${label} ===`);
  const fileBytes = fs.readFileSync(path);
  const pdfDoc = await PDFDocument.load(fileBytes);
  
  const context = pdfDoc.context;
  const indirectObjects = context.enumerateIndirectObjects();
  
  let found = false;
  for (const [ref, obj] of indirectObjects) {
      // Check if it's a stream
      if (obj instanceof PDFStream) {
          try {
             // We can decode the stream if it's FlateDecode
             // pdf-lib stream.getContents() usually returns the uncompressed bytes if possible.
             // Actually pdfDoc.context doesn't automatically decode.
             const dict = obj.dict;
             const filter = dict.get(PDFName.of('Filter'));
             // let's just use string conversion of the raw obj
          } catch (e) {}
      }
      
      const str = obj.toString();
      if (str.toLowerCase().includes('parvis')) {
          console.log(`Found 'parvis' in Object ${ref.objectNumber} ${ref.generationNumber}:`);
          console.log(str.substring(0, 500));
          found = true;
      }
  }
  if (!found) console.log("Not found in raw object strings (might be compressed).");
}

async function main() {
   await run('/home/fatzy/Downloads/Paystack_Merchant_Service_Agreement_2021675.pdf', 'ORIGINAL');
   await run('/home/fatzy/Downloads/Paystack_Merchant_Service_Agreement_2021675-edited.pdf', 'EXPORTED');
}
main().catch(console.error);

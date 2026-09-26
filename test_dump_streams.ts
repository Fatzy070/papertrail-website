import fs from 'fs';
import { PDFDocument, PDFStream } from 'pdf-lib';
import zlib from 'zlib';

async function run() {
  const bytes = fs.readFileSync('test_export.pdf');
  const pdfDoc = await PDFDocument.load(bytes, { updateMetadata: false });
  const context = pdfDoc.context;
  let found = false;
  
  for (const [ref, obj] of context.enumerateIndirectObjects()) {
      if (obj instanceof PDFStream) {
          try {
              // pdf-lib stream contents are usually just the compressed bytes.
              // We can get the uncompressed bytes by decoding if it's FlateDecode
              const dict = obj.dict;
              const filter = dict.get(context.obj('Filter'));
              let rawBytes = obj.getContentsString(); // This gets the raw bytes as string
              // But to decode, we need zlib
              let decodedBytes = obj.getContents(); 
              
              if (filter && filter.toString().includes('FlateDecode')) {
                 decodedBytes = zlib.unzipSync(decodedBytes);
              }
              const str = Buffer.from(decodedBytes).toString('utf-8');
              if (str.toLowerCase().includes('parvis')) {
                  console.log(`Found in Stream ${ref.objectNumber} ${ref.generationNumber}:`);
                  const index = str.toLowerCase().indexOf('parvis');
                  console.log(str.substring(Math.max(0, index - 50), index + 100));
                  found = true;
              }
          } catch (e) {
              console.log(`Error decoding stream ${ref.objectNumber}: ${e.message}`);
          }
      } else {
          const str = obj.toString();
          if (str.toLowerCase().includes('parvis')) {
              console.log(`Found in Object ${ref.objectNumber} ${ref.generationNumber}:`);
              console.log(str);
              found = true;
          }
      }
  }
  
  if (!found) {
      console.log("Not found in any object or stream!");
  }
}
run().catch(console.error);

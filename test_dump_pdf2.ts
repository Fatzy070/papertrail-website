import fs from 'fs';
import { PDFDocument, PDFName, PDFStream } from 'pdf-lib';
import zlib from 'zlib';

async function run(path: string, label: string) {
  console.log(`\n=== DUMPING ${label} ===`);
  if (!fs.existsSync(path)) {
      console.log(`File not found: ${path}`);
      return;
  }
  const fileBytes = fs.readFileSync(path);
  const pdfDoc = await PDFDocument.load(fileBytes, { updateMetadata: false });
  
  const context = pdfDoc.context;
  const indirectObjects = context.enumerateIndirectObjects();
  
  let found = false;
  for (const [ref, obj] of indirectObjects) {
      if (obj instanceof PDFStream) {
          try {
             // pdf-lib's decode() method!
             const decodedBytes = obj.getContents(); // Wait, getting contents directly?
             // PDFStream doesn't have a public decode() that returns a string directly but we can try getting its bytes
             // No, let's just try to read obj.contents if it exists, or decode it.
          } catch (e) {}
      }
  }
  
  // Actually a much simpler way to extract all text is mupdf:
  // We already did mupdf extraction and it did NOT find the old URL in the MuPDF output.
  // Wait, did MuPDF extraction check annotations?
  // Let's use MuPDF to walk through the document and extract EVERYTHING: structured text, annotations, metadata.
}

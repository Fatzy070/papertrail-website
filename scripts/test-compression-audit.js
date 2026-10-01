import fs from 'fs';
import { PDFDocument } from 'pdf-lib';
import https from 'https';
import { fileURLToPath } from 'url';

async function generateTextPdf(dest) {
  const pdfDoc = await PDFDocument.create();
  for(let i=0; i<50; i++) {
    const page = pdfDoc.addPage([500, 700]);
    // Large amount of text
    page.drawText('This is a text heavy PDF page ' + 'word '.repeat(2000), { x: 50, y: 600, size: 10, lineHeight: 12 });
  }
  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync(dest, pdfBytes);
}

async function testCompression(name, filePath) {
  const originalBytes = fs.readFileSync(filePath);
  const pdfDoc = await PDFDocument.load(originalBytes, { ignoreEncryption: true });
  const compressedBytes = await pdfDoc.save({ useObjectStreams: true });
  
  const oSize = originalBytes.byteLength;
  const cSize = compressedBytes.length;
  const reduction = ((oSize - cSize) / oSize * 100).toFixed(2);
  
  console.log(`\n--- ${name} ---`);
  console.log(`Original: ${oSize} bytes`);
  console.log(`Compressed: ${cSize} bytes`);
  console.log(`Reduction: ${reduction}%`);
  console.log(cSize >= oSize ? "RESULT: LARGER OR EQUAL" : "RESULT: SMALLER");
}

async function main() {
  console.log("Generating test PDFs...");
  await generateTextPdf('text-heavy.pdf');
  await testCompression('Text Heavy (Unoptimized)', 'text-heavy.pdf');
  
  // Now test an already optimized PDF (we can just re-compress the output)
  const oBytes = fs.readFileSync('text-heavy.pdf');
  const doc = await PDFDocument.load(oBytes);
  fs.writeFileSync('text-heavy-optimized.pdf', await doc.save({ useObjectStreams: true }));
  
  await testCompression('Already Optimized', 'text-heavy-optimized.pdf');

  // Use a local image for testing image-heavy compression
  const imgPath = '../../scripts/review/tool-compress.png';
  const imgBytes = fs.readFileSync(imgPath);
  
  const imagePdfDoc = await PDFDocument.create();
  const pngImage = await imagePdfDoc.embedPng(imgBytes);
  for(let i=0; i<10; i++) {
    const page = imagePdfDoc.addPage([500, 700]);
    page.drawImage(pngImage, { x: 0, y: 0, width: 500, height: 500 });
  }
  fs.writeFileSync('image-heavy.pdf', await imagePdfDoc.save());
  await testCompression('Image Heavy', 'image-heavy.pdf');
}

main().catch(console.error);

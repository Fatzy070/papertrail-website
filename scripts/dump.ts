import * as fs from 'fs';
import { extractNativeText } from '../src/engine/text-extractor.ts';
import { enrichTextElementsWithMuPDF } from '../src/engine/text-style-enricher.ts';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

async function main() {
  const buf = fs.readFileSync('./scripts/test_nverify.pdf');
  const pdfjsDoc = await getDocument({ data: new Uint8Array(buf) }).promise;
  const pages = Array.from({ length: 100 }, (_, i) => ({ id: `page${i}`, kind: 'source' as const, sourcePageIndex: i }));
  
  const rawElements = await extractNativeText(pdfjsDoc, pages);
  const enriched = await enrichTextElementsWithMuPDF(rawElements, buf, pages);
  const target = enriched.find(e => e.text.includes('Current Core Product'));
  
  console.log("PDFJS ELEMENT:", JSON.stringify(target, null, 2));
}

main().catch(console.error);

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { PDFDocument, StandardFonts } from 'pdf-lib'
import * as mupdf from 'mupdf'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { extractNativeText } from '../text-extractor'
import { enrichTextElementsWithMuPDF } from '../text-style-enricher'
import { exportPdf } from '../pdf-exporter'
import { sourceGlyphRect } from '../mupdf/source-glyph-geometry'
import { applyMuPdfRedactions } from '../mupdf/mupdf-redaction'
import { resolveElementFontId } from '../font-registry'
import { sourceNumberEdit } from '../source-number-edit'
import type { EditorPage } from '../../types/editor'

function characters(bytes: Uint8Array) {
  const doc = mupdf.Document.openDocument(bytes, 'application/pdf')
  const page = doc.loadPage(0), structured = page.toStructuredText('')
  const result: { text: string; x: number; baseline: number }[] = []
  structured.walk({ onChar(text, origin) { result.push({ text, x: origin[0], baseline: origin[1] }) } })
  structured.destroy(); page.destroy(); doc.destroy()
  return result
}

async function elements(bytes: Uint8Array) {
  const loading = getDocument({ data: bytes.slice(), useSystemFonts: true })
  const pdf = await loading.promise
  const viewport = (await pdf.getPage(1)).getViewport({ scale: 1 })
  const pages: EditorPage[] = [{ id: 'p1', kind: 'source', sourcePageIndex: 0, width: viewport.width, height: viewport.height, rotation: 0 }]
  const buffer = bytes.slice().buffer
  const result = await enrichTextElementsWithMuPDF(await extractNativeText(pdf, pages), buffer, pages)
  await loading.destroy()
  return { result, state: { name: 'Regression', bytes: buffer, pages, source: { type: 'local' as const } } }
}

async function fixture(text: string, bold = false) {
  if (text.startsWith('Salary changes')) return new Uint8Array(readFileSync(new URL('./fixtures/salary-run.pdf', import.meta.url)))
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(bold ? StandardFonts.HelveticaBold : StandardFonts.Helvetica)
  doc.addPage([600, 800]).drawText(text, { x: 50, y: 600, size: 12, font })
  return doc.save()
}

for (const [sentence, oldText, newText] of [
  ['Salary changes from ₦200,000 to ₦150,000.', '200,000', '300,000'],
  ['Salary changes from ₦200,000 to ₦150,000.', '150,000', '175,000'],
  ['Papertrail makes document editing simple.', 'document', 'PDF'],
] as const) {
  test(`substring geometry: ${oldText} -> ${newText}`, async () => {
    const bytes = await fixture(sentence)
    const { result, state } = await elements(bytes)
    assert.equal(result[0].text, sentence, 'Fixture is one physical text run')
    const chars = characters(bytes), index = sentence.indexOf(oldText)
    const x = chars[index].x, width = chars[index + oldText.length].x - x
    const element = { ...result[0], originalText: oldText, text: newText, edited: true, x, width,
      originalBounds: { x, y: result[0].y, width, height: result[0].height } }
    const actual = characters(await exportPdf(state, [element]))
    for (const c of [...chars.slice(0, index), ...chars.slice(index + oldText.length)]) {
      assert.ok(actual.some(a => a.text === c.text && Math.abs(a.x - c.x) < .01 && Math.abs(a.baseline - c.baseline) < .01), `Preserve neighboring glyph at ${c.x}`)
    }
    assert.equal(actual.sort((a, b) => a.x - b.x).map(c => c.text).join(''), sentence.replace(oldText, newText))
    assert.ok(actual.every(c => Math.abs(c.baseline - 200) < .01))
  })
}

for (const bold of [false, true]) {
  for (const [oldText, newText] of [['i', 'j'], [',', '.'], ['Short', 'Brief'], ['consideration', 'deliberation'], ['123456', '654321'], ['Start middle end', 'Begin middle end'], ['Start middle end', 'Start middle finish']]) {
    test(`source run ${oldText}, bold=${bold}`, async () => {
      const { result, state } = await elements(await fixture(oldText, bold))
      const output = await exportPdf(state, [{ ...result[0], text: newText, width: 300, edited: true }])
      assert.equal(characters(output).map(c => c.text).join(''), newText)
      assert.ok(characters(output).every(c => Math.abs(c.baseline - 200) < .01))
    })
  }
}

test('unmatched geometry fails safely', async () => {
  const bytes = await fixture('Hello')
  const page = mupdf.Document.openDocument(bytes, 'application/pdf').asPDF()!.loadPage(0)
  assert.throws(() => sourceGlyphRect(page, { text: 'Missing', x: 50, baselineY: 200, width: 30 }), /safely locate/)
})

test('actual salary PDF: both amounts, neighboring pixels, save/reopen/export', { skip: !process.env.SOURCE_TEXT_PDF }, async () => {
  const bytes = new Uint8Array(readFileSync(process.env.SOURCE_TEXT_PDF!))
  for (const [oldText, newText] of [['200,000', '300,000'], ['150,000', '175,000']]) {
    const { result, state } = await elements(bytes)
    const element = result.find(e => e.text === oldText)!
    assert.ok(element)
    assert.equal(resolveElementFontId(element), 'helvetica', 'Arimo must not fall back to Times')
    const bounds = element.originalBounds!
    const oldRect = { x: bounds.x - 2, y: bounds.y - 2, width: bounds.width + 4, height: bounds.height + 4 }
    const oldOutput = await applyMuPdfRedactions(state.bytes, [{ id: element.id, pageId: 'p1', sourcePageIndex: 0, rect: oldRect }])
    assert.equal(characters(oldOutput).filter(c => c.text === '₦').length, characters(bytes).filter(c => c.text === '₦').length - 1, 'Reproduce old neighbor damage')
    const page = mupdf.Document.openDocument(bytes, 'application/pdf').asPDF()!.loadPage(0)
    const precise = sourceGlyphRect(page, { text: oldText, x: bounds.x, width: bounds.width, baselineY: element.sourceStyle!.baselineY })
    console.log(JSON.stringify({ id: element.id, text: element.text, bounds, sourceStyle: element.sourceStyle, oldRect, precise }))
    const edited = result.map(e => e === element ? { ...e, text: newText, edited: true } : e)
    const output = await exportPdf(state, edited)
    const original = characters(bytes), actual = characters(output)
    const inAmount = (c: (typeof actual)[number]) => Math.abs(c.baseline - element.sourceStyle!.baselineY) < .1 && c.x >= element.x - .01 && c.x < element.x + element.width - .1
    const originalAmount = original.filter(inAmount), replacement = actual.filter(inAmount)
    assert.equal(replacement.map(c => c.text).join(''), newText)
    replacement.forEach((c, i) => {
      assert.ok(Math.abs(c.x - originalAmount[i].x) < .01, 'Preserve advances')
      assert.ok(Math.abs(c.baseline - originalAmount[i].baseline) < .01, 'Preserve baseline')
    })
    for (const c of original.filter(c => !inAmount(c))) assert.ok(actual.some(a => a.text === c.text && Math.abs(a.x - c.x) < .02 && Math.abs(a.baseline - c.baseline) < .02))
    assert.ok(!actual.map(c => c.text).join('').includes(oldText), 'Old text physically removed')
    const render = (data: Uint8Array) => mupdf.Document.openDocument(data, 'application/pdf').loadPage(0)
      .toPixmap(mupdf.Matrix.scale(2, 2), mupdf.ColorSpace.DeviceRGB, false)
    const before = render(bytes), after = render(output)
    const pixels = before.getPixels(), changed = after.getPixels()
    let outside = 0
    for (let i = 0; i < pixels.length; i += 3) {
      if (pixels[i] === changed[i] && pixels[i + 1] === changed[i + 1] && pixels[i + 2] === changed[i + 2]) continue
      const x = (i / 3) % before.getWidth(), y = Math.floor(i / 3 / before.getWidth())
      if (x < Math.floor(element.x * 2) || x > Math.ceil((element.x + element.width) * 2) || y < Math.floor(precise[1] * 2) || y > Math.ceil(precise[3] * 2)) outside++
    }
    assert.equal(outside, 0, 'No neighboring pixels changed')
    const savedExport = await exportPdf({ ...state, bytes: output.slice().buffer }, edited)
    assert.equal(characters(savedExport).map(c => c.text).join(''), actual.map(c => c.text).join(''))
    const reloaded = await elements(output)
    assert.equal(characters(await exportPdf(reloaded.state, reloaded.result)).map(c => c.text).join(''), actual.map(c => c.text).join(''))
  }
})

test('SF UI amount edits retain embedded outlines, adjacent text, search and reopened editing', { skip: !process.env.SFUI_SOURCE_PDF }, async (t) => {
  const originalFetch = globalThis.fetch
  t.mock.method(globalThis, 'fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    if (typeof input === 'string' && input.startsWith('/fonts/')) {
      return new Response(readFileSync(new URL('../../../public' + input, import.meta.url)))
    }
    return originalFetch(input, init)
  })
  const bytes = new Uint8Array(readFileSync(process.env.SFUI_SOURCE_PDF!))
  const original = characters(bytes)
  for (const [oldText, newAmount] of [['250,000 to', '300,000'], ['200,000', '300,000'], ['200,000', '100,000'], ['200,000', '900,000']]) {
    const { result, state } = await elements(bytes)
    const element = result.find(e => e.text === oldText)!
    assert.ok(element)
    const edited = { ...element, text: oldText.replace(/2[05]0,000/, newAmount), edited: true }
    const plan = sourceNumberEdit(edited)
    assert.ok(plan, 'Embedded SF UI font must be matched')
    assert.equal(plan.glyphs.map(g => g.text).join(''), newAmount)
    assert.ok(plan.name.includes('SFUI'))
    assert.equal(sourceNumberEdit({ ...edited, styleOverrides: { bold: true } }), null, 'Explicit formatting keeps the existing path')
    assert.equal(plan.glyphs[0].name, /^[19]/.test(newAmount) ? 'Arimo-Bold' : plan.name, 'Only missing digits use matching-weight fallback')
    assert.ok(plan.glyphs.slice(1).every(g => g.name === plan.name), 'Unchanged digits keep the embedded source font')
    const edits = result.map(e => e === element ? edited : e)
    const output = await exportPdf(state, edits)
    const actual = characters(output)
    for (const c of original) {
      const replaced = plan.glyphs.some(g => Math.abs(g.x - c.x) < .01 && Math.abs(g.y - c.baseline) < .01)
      if (!replaced) assert.ok(actual.some(a => a.text === c.text && Math.abs(a.x - c.x) < .01 && Math.abs(a.baseline - c.baseline) < .01), 'Keep every neighboring glyph in place')
    }
    const loading = getDocument({ data: output.slice() })
    const pdf = await loading.promise
    const extracted = await (await pdf.getPage(1)).getTextContent()
    assert.ok(extracted.items.map(item => 'str' in item ? item.str : '').join('').includes(newAmount), 'Searchable replacement must remain a complete number')
    assert.ok(!extracted.items.some(item => 'str' in item && item.str.includes(oldText.split(' ')[0])), 'Original amount must be removed')
    await loading.destroy()
    // Source glyphs, rather than a substitute font, must rasterize identically
    // outside the two actually changed digit cells.
    const render = (data: Uint8Array) => mupdf.Document.openDocument(data, 'application/pdf').loadPage(0)
      .toPixmap(mupdf.Matrix.scale(3, 3), mupdf.ColorSpace.DeviceRGB, false)
    const before = render(bytes), after = render(output)
    const a = before.getPixels(), b = after.getPixels()
    let outside = 0
    for (let i = 0; i < a.length; i += 3) {
      if (a[i] === b[i] && a[i + 1] === b[i + 1] && a[i + 2] === b[i + 2]) continue
      const x = (i / 3) % before.getWidth(), y = Math.floor(i / 3 / before.getWidth())
      const changed = plan.glyphs.some((g, j) => g.text !== oldText[j] && x >= Math.floor(g.rect[0] * 3) && x <= Math.ceil(g.rect[2] * 3) && y >= Math.floor(g.rect[1] * 3) && y <= Math.ceil(g.rect[3] * 3))
      if (!changed) outside++
    }
    assert.equal(outside, 0, 'Unchanged number glyphs and neighbors retain their appearance')
    if (/^[19]/.test(newAmount)) {
      const g = plan.glyphs[0]
      let ink = 0
      for (let y = Math.ceil(g.rect[1] * 3); y < Math.floor(g.rect[3] * 3); y++) {
        for (let x = Math.ceil(g.rect[0] * 3); x < Math.floor(g.rect[2] * 3); x++) {
          if (b[(y * after.getWidth() + x) * 3] < 128) ink++
        }
      }
      assert.ok(ink > 10, 'Missing-subset digit must actually render, not only remain searchable')
    }
    const repeated = await exportPdf({ ...state, bytes: output.slice().buffer }, edits)
    assert.equal(characters(repeated).map(c => c.text).join(''), actual.map(c => c.text).join(''))
    const reloaded = await elements(output)
    if (/^[19]/.test(newAmount)) {
      const reexported = await exportPdf(reloaded.state, reloaded.result)
      assert.equal(characters(reexported).map(c => c.text).join(''), actual.map(c => c.text).join(''))
      continue
    }
    const amount = reloaded.result.find(e => e.text === '300,000')!
    assert.ok(amount)
    assert.ok(sourceNumberEdit({ ...amount, text: '500,000', edited: true }), 'Reopened source can reuse its original font again')
  }
})

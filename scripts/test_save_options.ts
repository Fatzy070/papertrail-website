import * as mupdf from 'mupdf'

try {
    const doc = new mupdf.Document()
    console.log("saveToBuffer methods/options?", typeof doc.saveToBuffer)
} catch (e) {
    console.log(e)
}

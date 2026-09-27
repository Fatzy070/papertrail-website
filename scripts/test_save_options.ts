import * as mupdf from 'mupdf'
import fs from 'fs'

try {
    const doc = new mupdf.Document()
    console.log("saveToBuffer methods/options?", typeof doc.saveToBuffer)
} catch (e) {
    console.log(e)
}

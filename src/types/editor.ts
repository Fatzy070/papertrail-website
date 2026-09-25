export type EditorTool = 'select' | 'text'
export type TextSource = 'pdf' | 'ocr' | 'user'

export interface PdfPageInfo {
  index: number
  width: number
  height: number
  rotation: number
}

export interface TextElement {
  id: string
  pageIndex: number
  source: TextSource
  originalText: string
  text: string
  x: number
  y: number
  width: number
  height: number
  fontSize: number
  fontFamily: string
  color: string
  rotation: number
  originalBounds?: { x: number; y: number; width: number; height: number }
  edited: boolean
}

export interface PdfDocumentState {
  name: string
  bytes: ArrayBuffer
  pages: PdfPageInfo[]
  source: { type: 'local' } | { type: 'remote'; documentId: string }
}

export interface EditorSnapshot {
  textElements: TextElement[]
}

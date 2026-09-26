export type EditorTool = 'pointer' | 'edit-text' | 'text' | 'image' | 'draw' | 'sign' | 'note'
export type TextSource = 'pdf' | 'ocr' | 'user'

export type EditorPage =
  | {
      id: string
      kind: 'source'
      sourcePageIndex: number
      width: number
      height: number
      rotation: number
    }
  | {
      id: string
      kind: 'blank'
      width: number
      height: number
      rotation: number
    }

export interface TextElement {
  type: 'text'
  id: string
  pageId: string
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
  bold?: boolean
  italic?: boolean
  textAlign?: 'left' | 'center' | 'right'
  lineHeight?: number
  locked?: boolean
  originalBounds?: { x: number; y: number; width: number; height: number }
  edited: boolean
  link?: {
    url: string
  }
}

export interface ImageElement {
  type: 'image'
  id: string
  pageId: string
  src: string
  x: number
  y: number
  width: number
  height: number
  rotation: number
  locked?: boolean
  mimeType: string
  source: 'user'
}

export interface DrawingElement {
  type: 'drawing'
  id: string
  pageId: string
  points: { x: number; y: number; pressure?: number }[]
  color: string
  strokeWidth: number
  x: number
  y: number
  width: number
  height: number
  locked?: boolean
}

export interface SignatureElement {
  type: 'signature'
  id: string
  pageId: string
  src: string
  x: number
  y: number
  width: number
  height: number
  rotation: number
  locked?: boolean
}

export interface NoteElement {
  type: 'note'
  id: string
  pageId: string
  text: string
  color: string
  x: number
  y: number
  width: number
  height: number
  author?: string
  source: 'user' | 'pdf-annotation'
  locked?: boolean
}

export interface SourceImageElement {
  type: 'source-image'
  id: string
  pageId: string
  x: number
  y: number
  width: number
  height: number
  deleted?: boolean
  locked?: boolean
}

export type EditorElement = TextElement | ImageElement | DrawingElement | SignatureElement | NoteElement | SourceImageElement

export interface PdfDocumentState {
  name: string
  bytes: ArrayBuffer
  pages: EditorPage[]
  source: { type: 'local' } | { type: 'remote'; documentId: string }
}

export interface EditorSnapshot {
  elements: EditorElement[]
  pages: EditorPage[]
}

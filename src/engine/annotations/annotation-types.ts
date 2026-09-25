
export interface TextAnnotationData {
  id: string // /NM
  rect: [number, number, number, number] // PDF coordinates: [llx, lly, urx, ury]
  contents: string // /Contents
  color: [number, number, number] // /C normalized RGB
  author?: string // /T
  open?: boolean // /Open
}

export interface InkAnnotationData {
  id: string
  rect: [number, number, number, number]
  inkLists: [number, number][][] // Array of strokes, each stroke is an array of [x, y]
  color: [number, number, number]
  strokeWidth: number
}

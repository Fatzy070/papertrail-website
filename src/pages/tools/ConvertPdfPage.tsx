import { useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { ArrowDown, ArrowLeft, ArrowUp, Download, FileOutput, FileText, Image as ImageIcon, Save, Trash2, UploadCloud } from 'lucide-react'
import { PDFDocument } from 'pdf-lib'
import { Link } from 'react-router-dom'
import { useToastStore } from '../../store/toast-store'
import { useUploadDocument } from '../../hooks/use-documents'
import { loadPdfDocument } from '../../engine/pdf-loader'

const maxBytes = 50 * 1024 * 1024

export function ConvertPdfPage() {
  const [mode, setMode] = useState<'pdf-to-images' | 'images-to-pdf'>('pdf-to-images')
  
  // States for PDF -> Images
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [extractedImages, setExtractedImages] = useState<{ url: string, name: string }[]>([])
  
  // States for Images -> PDF
  const [imageFiles, setImageFiles] = useState<File[]>([])
  const [pdfResult, setPdfResult] = useState<File | null>(null)
  
  const [isProcessing, setIsProcessing] = useState(false)
  const showToast = useToastStore((state) => state.show)
  const upload = useUploadDocument()

  const pdfDropzone = useDropzone({
    accept: { 'application/pdf': ['.pdf'] },
    maxSize: maxBytes,
    multiple: false,
    onDrop: (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        setPdfFile(acceptedFiles[0])
        setExtractedImages([])
      }
    },
    onDropRejected: () => showToast('Choose a PDF no larger than 50 MB.', 'error'),
  })

  const imagesDropzone = useDropzone({
    accept: {
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg']
    },
    maxSize: maxBytes,
    onDrop: (acceptedFiles) => {
      setImageFiles((prev) => [...prev, ...acceptedFiles])
      setPdfResult(null)
    },
    onDropRejected: () => showToast('Only PNG/JPG images under 50 MB are supported.', 'error'),
  })

  // --- PDF to Images Logic ---
  const handleExtractImages = async () => {
    if (!pdfFile) return
    setIsProcessing(true)
    try {
      const arrayBuffer = await pdfFile.arrayBuffer()
      const pdf = await loadPdfDocument(arrayBuffer)
      const numPages = pdf.numPages
      const images: { url: string, name: string }[] = []

      for (let i = 1; i <= numPages; i++) {
        const page = await pdf.getPage(i)
        const viewport = page.getViewport({ scale: 2.0 }) // High res
        
        const canvas = document.createElement('canvas')
        const context = canvas.getContext('2d')
        if (!context) continue
        
        canvas.height = viewport.height
        canvas.width = viewport.width

        await page.render({
          canvasContext: context,
          viewport: viewport,
          canvas: null as unknown as HTMLCanvasElement
        }).promise

        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
        if (blob) {
          images.push({
            url: URL.createObjectURL(blob),
            name: `page_${i}.png`
          })
        }
      }
      setExtractedImages(images)
      showToast(`Extracted ${images.length} images.`, 'success')
    } catch (e) {
      console.error(e)
      showToast('An error occurred extracting images.', 'error')
    } finally {
      setIsProcessing(false)
    }
  }

  const downloadAllImages = () => {
    // Sequentially trigger downloads
    let delay = 0
    extractedImages.forEach((img) => {
      setTimeout(() => {
        const a = document.createElement('a')
        a.href = img.url
        a.download = img.name
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
      }, delay)
      delay += 250 // Add slight delay to prevent browser blocking multiple popups
    })
  }

  // --- Images to PDF Logic ---
  const moveUp = (index: number) => {
    if (index === 0) return
    const newFiles = [...imageFiles]
    const temp = newFiles[index - 1]
    newFiles[index - 1] = newFiles[index]
    newFiles[index] = temp
    setImageFiles(newFiles)
  }

  const moveDown = (index: number) => {
    if (index === imageFiles.length - 1) return
    const newFiles = [...imageFiles]
    const temp = newFiles[index + 1]
    newFiles[index + 1] = newFiles[index]
    newFiles[index] = temp
    setImageFiles(newFiles)
  }

  const removeFile = (index: number) => {
    setImageFiles(imageFiles.filter((_, i) => i !== index))
  }

  const handleCreatePdf = async () => {
    if (imageFiles.length === 0) return
    setIsProcessing(true)
    try {
      const pdfDoc = await PDFDocument.create()

      for (const file of imageFiles) {
        const arrayBuffer = await file.arrayBuffer()
        let image
        if (file.type === 'image/jpeg' || file.type === 'image/jpg') {
          image = await pdfDoc.embedJpg(arrayBuffer)
        } else if (file.type === 'image/png') {
          image = await pdfDoc.embedPng(arrayBuffer)
        } else {
          continue
        }
        
        const dims = image.scale(1)
        const page = pdfDoc.addPage([dims.width, dims.height])
        page.drawImage(image, {
          x: 0,
          y: 0,
          width: dims.width,
          height: dims.height,
        })
      }

      const pdfBytes = await pdfDoc.save()
      const newFile = new File([pdfBytes as unknown as BlobPart], 'converted_images.pdf', { type: 'application/pdf' })
      setPdfResult(newFile)
      showToast('PDF created successfully!', 'success')
    } catch (e) {
      console.error(e)
      showToast('An error occurred creating the PDF.', 'error')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDownloadPdf = () => {
    if (!pdfResult) return
    const url = URL.createObjectURL(pdfResult)
    const a = document.createElement('a')
    a.href = url
    a.download = pdfResult.name
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleSaveToDocuments = async () => {
    if (!pdfResult || upload.isPending) return
    try {
      await upload.mutateAsync(pdfResult)
      showToast('Saved to My Documents.', 'success')
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : 'Upload failed.', 'error')
    }
  }

  return (
    <div className="max-w-7xl mx-auto p-8 w-full">
      <header className="mb-8">
        <Link to="/dashboard" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 mb-4 transition-colors">
          <ArrowLeft size={16} />
          Back to home
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 mb-1">Convert PDF</h1>
        <p className="text-slate-500 text-sm">Convert between PDFs and images.</p>
      </header>

      <div className="flex bg-slate-100 p-1 rounded-xl w-fit mb-8 shadow-sm">
        <button
          className={`px-5 py-2 text-sm font-medium rounded-lg transition-all ${mode === 'pdf-to-images' ? 'bg-white shadow text-blue-600' : 'text-slate-600 hover:text-slate-900'}`}
          onClick={() => setMode('pdf-to-images')}
        >
          PDF to Images
        </button>
        <button
          className={`px-5 py-2 text-sm font-medium rounded-lg transition-all ${mode === 'images-to-pdf' ? 'bg-white shadow text-blue-600' : 'text-slate-600 hover:text-slate-900'}`}
          onClick={() => setMode('images-to-pdf')}
        >
          Images to PDF
        </button>
      </div>

      {mode === 'pdf-to-images' && (
        <>
          {!pdfFile && (
            <div
              {...pdfDropzone.getRootProps()}
              className={`relative flex flex-col items-center justify-center p-10 mb-8 border-2 border-dashed rounded-3xl transition-all cursor-pointer group ${
                pdfDropzone.isDragActive
                  ? 'border-blue-500 bg-blue-50 ring-4 ring-blue-500/20'
                  : 'border-slate-300 bg-white hover:border-blue-400 hover:bg-slate-50 hover:shadow-sm'
              }`}
            >
              <input {...pdfDropzone.getInputProps()} />
              <div className="bg-blue-100 text-blue-600 p-3 rounded-full mb-3 group-hover:scale-110 transition-transform">
                <UploadCloud size={24} />
              </div>
              <div className="text-base text-slate-700 text-center mb-1">
                <strong>Drop a PDF here</strong> <span className="font-normal text-slate-500">or click to browse</span>
              </div>
            </div>
          )}

          {pdfFile && extractedImages.length === 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-8 max-w-xl mx-auto text-center">
              <div className="inline-flex bg-blue-50 p-3 rounded-xl text-blue-600 mb-4">
                <FileText size={24} />
              </div>
              <h3 className="font-semibold text-slate-900 mb-1">{pdfFile.name}</h3>
              <p className="text-sm text-slate-500 mb-6">Ready to extract images</p>
              
              <div className="flex justify-center gap-3">
                <button
                  onClick={() => setPdfFile(null)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                >
                  Change file
                </button>
                <button
                  onClick={handleExtractImages}
                  disabled={isProcessing}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl shadow-sm transition-all disabled:opacity-50 inline-flex items-center gap-2"
                >
                  {isProcessing && <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />}
                  {isProcessing ? 'Extracting...' : 'Extract Images'}
                </button>
              </div>
            </div>
          )}

          {extractedImages.length > 0 && (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-200">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Extracted Images</h2>
                  <p className="text-sm text-slate-500">{extractedImages.length} pages extracted from {pdfFile?.name}</p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setPdfFile(null)
                      setExtractedImages([])
                    }}
                    className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg shadow-sm"
                  >
                    Start Over
                  </button>
                  <button
                    onClick={downloadAllImages}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg shadow-sm flex items-center gap-2"
                  >
                    <Download size={16} />
                    Download All
                  </button>
                </div>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {extractedImages.map((img, i) => (
                  <div key={i} className="group relative bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all">
                    <div className="aspect-[3/4] bg-slate-100 relative">
                      <img src={img.url} alt={`Page ${i+1}`} className="w-full h-full object-contain p-2" />
                      <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <a
                          href={img.url}
                          download={img.name}
                          className="p-3 bg-white text-slate-900 rounded-full hover:scale-110 transition-transform shadow-lg"
                        >
                          <Download size={18} />
                        </a>
                      </div>
                    </div>
                    <div className="p-3 border-t border-slate-100 text-xs font-medium text-slate-600 text-center truncate">
                      {img.name}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {mode === 'images-to-pdf' && (
        <>
          <div
            {...imagesDropzone.getRootProps()}
            className={`relative flex flex-col items-center justify-center p-10 mb-8 border-2 border-dashed rounded-3xl transition-all cursor-pointer group ${
              imagesDropzone.isDragActive
                ? 'border-blue-500 bg-blue-50 ring-4 ring-blue-500/20'
                : 'border-slate-300 bg-white hover:border-blue-400 hover:bg-slate-50 hover:shadow-sm'
            }`}
          >
            <input {...imagesDropzone.getInputProps()} />
            <div className="bg-blue-100 text-blue-600 p-3 rounded-full mb-3 group-hover:scale-110 transition-transform">
              <ImageIcon size={24} />
            </div>
            <div className="text-base text-slate-700 text-center mb-1">
              <strong>Drop images here</strong> <span className="font-normal text-slate-500">or click to browse</span>
            </div>
            <span className="text-xs font-medium text-slate-400">PNG or JPG files</span>
          </div>

          {imageFiles.length > 0 && !pdfResult && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-8">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Images to convert</h2>
              <div className="space-y-3 mb-6">
                {imageFiles.map((file, idx) => (
                  <div key={`${file.name}-${idx}`} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-xl">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className="bg-white p-2 rounded-lg shadow-sm">
                        <ImageIcon size={18} className="text-blue-500" />
                      </div>
                      <span className="text-sm font-medium text-slate-700 truncate">{file.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => moveUp(idx)} disabled={idx === 0} className="p-1.5 text-slate-400 hover:text-slate-700 disabled:opacity-30 transition-colors">
                        <ArrowUp size={16} />
                      </button>
                      <button onClick={() => moveDown(idx)} disabled={idx === imageFiles.length - 1} className="p-1.5 text-slate-400 hover:text-slate-700 disabled:opacity-30 transition-colors">
                        <ArrowDown size={16} />
                      </button>
                      <div className="w-px h-4 bg-slate-200 mx-1" />
                      <button onClick={() => removeFile(idx)} className="p-1.5 text-red-400 hover:text-red-600 transition-colors">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleCreatePdf}
                  disabled={isProcessing}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl shadow-sm transition-all disabled:opacity-50 disabled:pointer-events-none inline-flex items-center gap-2"
                >
                  {isProcessing && <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />}
                  {isProcessing ? 'Converting...' : 'Create PDF'}
                </button>
              </div>
            </div>
          )}

          {pdfResult && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-8 text-center flex flex-col items-center">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4">
                <FileOutput size={32} />
              </div>
              <h2 className="text-xl font-bold text-emerald-900 mb-2">Conversion Complete!</h2>
              <p className="text-emerald-700 text-sm mb-8">Your PDF has been created successfully.</p>
              
              <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm">
                <button
                  onClick={handleDownloadPdf}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-emerald-300 hover:bg-emerald-100 text-emerald-800 text-sm font-medium rounded-xl shadow-sm transition-all"
                >
                  <Download size={16} />
                  Download
                </button>
                <button
                  onClick={handleSaveToDocuments}
                  disabled={upload.isPending}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-xl shadow-sm transition-all disabled:opacity-50"
                >
                  <Save size={16} />
                  {upload.isPending ? 'Saving...' : 'Save to My Documents'}
                </button>
              </div>
              
              <button 
                onClick={() => {
                  setPdfResult(null)
                  setImageFiles([])
                }}
                className="mt-6 text-sm text-emerald-600 hover:text-emerald-800 font-medium"
              >
                Start over
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

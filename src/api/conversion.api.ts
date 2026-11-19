import { apiFetchRaw, ApiError } from './client'

export interface ConversionResult {
  blob: Blob
  filename: string
}

export const conversionApi = {
  /**
   * Converts a Word (.docx) document to a PDF via the authenticated NestJS backend.
   */
  convertDocxToPdf: async (file: File): Promise<ConversionResult> => {
    const formData = new FormData()
    formData.append('file', file)

    const response = await apiFetchRaw('/convert/docx-to-pdf', {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      let message = 'Failed to convert Word document to PDF.'
      try {
        const errorJson = (await response.json()) as { message?: string | string[]; error?: string }
        if (Array.isArray(errorJson.message)) {
          message = errorJson.message[0]
        } else if (errorJson.message) {
          message = errorJson.message
        } else if (errorJson.error) {
          message = errorJson.error
        }
      } catch {
        // Fallback to default message
      }
      throw new ApiError(response.status, message)
    }

    const disposition = response.headers.get('content-disposition')
    let filename = file.name.replace(/\.[^/.]+$/, '') + '.pdf'
    if (disposition) {
      const match = disposition.match(/filename="?([^"]+)"?/)
      if (match?.[1]) {
        filename = match[1]
      }
    }

    const blob = await response.blob()
    return { blob, filename }
  },

  /**
   * Converts a PDF to an editable Word (.docx) document via the authenticated NestJS backend.
   */
  convertPdfToDocx: async (file: File): Promise<ConversionResult> => {
    const formData = new FormData()
    formData.append('file', file)

    const response = await apiFetchRaw('/convert/pdf-to-docx', {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      let message = 'Failed to convert PDF to Word (.docx).'
      try {
        const errorJson = (await response.json()) as { message?: string | string[]; error?: string }
        if (Array.isArray(errorJson.message)) {
          message = errorJson.message[0]
        } else if (errorJson.message) {
          message = errorJson.message
        } else if (errorJson.error) {
          message = errorJson.error
        }
      } catch {
        // Fallback to default message
      }
      throw new ApiError(response.status, message)
    }

    const disposition = response.headers.get('content-disposition')
    let filename = file.name.replace(/\.[^/.]+$/, '') + '.docx'
    if (disposition) {
      const match = disposition.match(/filename="?([^"]+)"?/)
      if (match?.[1]) {
        filename = match[1]
      }
    }

    const blob = await response.blob()
    return { blob, filename }
  },
}

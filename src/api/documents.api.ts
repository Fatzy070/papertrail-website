import { apiRequest, baseUrl } from './client'

export interface DocumentMetadata { id: string; name: string; mimeType: string; size: number; pageCount?: number; currentVersionNumber: number; createdAt: string; updatedAt: string; isStarred: boolean; deletedAt?: string; lastOpenedAt?: string }
export interface DocumentVersion { id: string; versionNumber: number; size: number; createdAt: string; current: boolean }

export const documentsApi = {
  list: (filter?: string) => apiRequest<DocumentMetadata[]>(filter ? `/documents?filter=${filter}` : '/documents'),
  get: (id: string) => apiRequest<DocumentMetadata>(`/documents/${id}`),
  upload: (file: File, name?: string) => { const data = new FormData(); data.append('file', file); if (name) data.append('name', name); return apiRequest<DocumentMetadata>('/documents', { method: 'POST', body: data }) },
  rename: (id: string, name: string) => apiRequest<DocumentMetadata>(`/documents/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) }),
  update: (id: string, updates: Partial<DocumentMetadata> & { restore?: boolean; isDeleted?: boolean }) => apiRequest<DocumentMetadata>(`/documents/${id}`, { method: 'PATCH', body: JSON.stringify(updates) }),
  remove: (id: string) => apiRequest<{ success: boolean }>(`/documents/${id}`, { method: 'DELETE' }),
  downloadUrl: (id: string) => apiRequest<{ url: string }>(`/documents/${id}/download`),
  contentUrl: (id: string) => `${baseUrl}/documents/${id}/content`,
  save: (id: string, blob: Blob) => { const data = new FormData(); data.append('file', blob, 'edited.pdf'); return apiRequest<DocumentMetadata>(`/documents/${id}/file`, { method: 'PUT', body: data }) },
  versions: (id: string) => apiRequest<DocumentVersion[]>(`/documents/${id}/versions`),
  restoreVersion: (id: string, versionId: string) => apiRequest<DocumentMetadata>(`/documents/${id}/versions/${versionId}/restore`, { method: 'POST' }),
}

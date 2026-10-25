import type { JSONContent } from "@tiptap/react";
import { apiRequest, apiFetchRaw, ApiError } from "../api/client";

export type WriterExportFormat = "pdf" | "docx" | "html" | "txt";

export interface PageSettings {
  size: "A4" | "Letter";
  orientation: "portrait" | "landscape";
  margins: { top: number; right: number; bottom: number; left: number };
}
export interface WriterSnapshot {
  title: string;
  content: JSONContent;
  pageSettings: PageSettings;
}
export interface WriterMetadata {
  id: string;
  title: string;
  pageSettings: PageSettings;
  revision: number;
  schemaVersion: number;
  deletedAt?: string | null;
  createdAt?: string;
  updatedAt: string;
}
export interface WriterDocument extends WriterSnapshot {
  id: string;
  revision: number;
  schemaVersion: number;
  deletedAt?: string | null;
  createdAt?: string;
  updatedAt: string;
}
export interface WriterListParams {
  page?: number;
  limit?: number;
  search?: string;
  sort?: "updatedAt" | "createdAt" | "title";
  order?: "asc" | "desc";
  status?: "active" | "trash";
}
export interface PaginatedWriterDocuments {
  items: WriterMetadata[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
export interface WriterSpec {
  version: number;
  defaultPage: PageSettings;
  pageSizes: Record<string, [number, number]>;
  fontFamilies: string[];
  fontSizes: number[];
  textColors?: { name: string; value: string }[];
  highlightColors: { name: string; value: string }[];
  css: string;
}
export interface WriterAssetMetadata {
  assetId: string;
  mimeType: "image/png" | "image/jpeg" | "image/webp";
  originalName: string;
  size: number;
  width: number;
  height: number;
}

const assetUrlCache = new Map<string, Promise<string>>();
const resolvedObjectUrls = new Map<string, string>();

export const writerApi = {
  spec: () => apiRequest<WriterSpec>("/writer/spec"),
  list: (params: WriterListParams = {}) => {
    const query = new URLSearchParams();
    if (params.page) query.set("page", String(params.page));
    if (params.limit) query.set("limit", String(params.limit));
    if (params.search?.trim()) query.set("search", params.search.trim());
    if (params.sort) query.set("sort", params.sort);
    if (params.order) query.set("order", params.order);
    if (params.status) query.set("status", params.status);
    const qs = query.toString();
    return apiRequest<PaginatedWriterDocuments>(
      qs ? `/writer?${qs}` : "/writer",
    );
  },
  create: (data: { title: string; pageSettings: PageSettings }) =>
    apiRequest<WriterDocument>("/writer", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  get: (id: string) => apiRequest<WriterDocument>(`/writer/${id}`),
  save: (id: string, snapshot: WriterSnapshot, revision: number) =>
    apiRequest<WriterDocument>(`/writer/${id}`, {
      method: "PATCH",
      body: JSON.stringify({
        content: snapshot.content,
        pageSettings: snapshot.pageSettings,
        title: snapshot.title.trim() || "Untitled document",
        revision,
      }),
    }),
  rename: (id: string, title: string) =>
    apiRequest<WriterMetadata>(`/writer/${id}/title`, {
      method: "PATCH",
      body: JSON.stringify({ title: title.trim() }),
    }),
  trash: (id: string) =>
    apiRequest<WriterMetadata>(`/writer/${id}`, {
      method: "DELETE",
    }),
  restore: (id: string) =>
    apiRequest<WriterMetadata>(`/writer/${id}/restore`, {
      method: "POST",
    }),
  uploadAsset: (documentId: string, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return apiRequest<WriterAssetMetadata>(`/writer/${documentId}/assets`, {
      method: "POST",
      body: formData,
    });
  },
  fetchAssetObjectUrl: (documentId: string, assetId: string): Promise<string> => {
    const cacheKey = `${documentId}:${assetId}`;
    const existing = assetUrlCache.get(cacheKey);
    if (existing) return existing;
    const promise = (async () => {
      try {
        const response = await apiFetchRaw(
          `/writer/${documentId}/assets/${assetId}`,
        );
        if (!response.ok) {
          throw new ApiError(response.status, "Unable to load image asset.");
        }
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        resolvedObjectUrls.set(cacheKey, url);
        return url;
      } catch (err) {
        assetUrlCache.delete(cacheKey);
        throw err;
      }
    })();
    assetUrlCache.set(cacheKey, promise);
    return promise;
  },
  invalidateAssetUrl: (documentId: string, assetId: string) => {
    const cacheKey = `${documentId}:${assetId}`;
    const url = resolvedObjectUrls.get(cacheKey);
    if (url) {
      URL.revokeObjectURL(url);
      resolvedObjectUrls.delete(cacheKey);
    }
    assetUrlCache.delete(cacheKey);
  },
  export: async (
    id: string,
    revision: number,
    format: WriterExportFormat = "pdf",
  ) => {
    const response = await apiFetchRaw(`/writer/${id}/export`, {
      method: "POST",
      body: JSON.stringify(
        format === "pdf" ? { revision } : { revision, format },
      ),
    });
    if (!response.ok) {
      const error = (await response.json().catch(() => null)) as {
        message?: string;
      } | null;
      throw new ApiError(
        response.status,
        error?.message || `Unable to prepare ${format.toUpperCase()}. Please retry.`,
      );
    }
    return response.blob();
  },
};

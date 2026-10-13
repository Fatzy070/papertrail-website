import type { JSONContent } from "@tiptap/react";
import { apiRequest, apiFetchRaw, ApiError } from "../api/client";

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
  highlightColors: { name: string; value: string }[];
  css: string;
}
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
  export: async (id: string, revision: number) => {
    const response = await apiFetchRaw(`/writer/${id}/export`, {
      method: "POST",
      body: JSON.stringify({ revision }),
    });
    if (!response.ok) {
      const error = (await response.json().catch(() => null)) as {
        message?: string;
      } | null;
      throw new ApiError(
        response.status,
        error?.message || "Unable to prepare PDF. Please retry.",
      );
    }
    return response.blob();
  },
};

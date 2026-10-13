import { useEffect, useRef, useState } from "react";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  FileText,
  MoreHorizontal,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
} from "lucide-react";
import { Dialog } from "../components/ui/Dialog";
import { useCurrentUser } from "../hooks/use-auth";
import { useToastStore } from "../store/toast-store";
import { writerApi } from "./writer.api";
import type {
  PageSettings,
  PaginatedWriterDocuments,
  WriterListParams,
  WriterMetadata,
} from "./writer.api";
import "./writer.css";

type SortOption = "updatedAt:desc" | "createdAt:asc" | "title:asc";

function parseSort(option: SortOption): {
  sort: NonNullable<WriterListParams["sort"]>;
  order: NonNullable<WriterListParams["order"]>;
} {
  const [sort, order] = option.split(":") as [
    NonNullable<WriterListParams["sort"]>,
    NonNullable<WriterListParams["order"]>,
  ];
  return { sort, order };
}

function formatRelativeTime(isoString?: string | null): string {
  if (!isoString) return "Recently";
  const time = Date.parse(isoString);
  if (!Number.isFinite(time)) return "Recently";
  const diffSeconds = Math.max(0, Math.floor((Date.now() - time) / 1000));
  if (diffSeconds < 60) return "Just now";
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60)
    return `${diffMinutes} ${diffMinutes === 1 ? "minute" : "minutes"} ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24)
    return `${diffHours} ${diffHours === 1 ? "hour" : "hours"} ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} ${diffDays === 1 ? "day" : "days"} ago`;
  return new Date(time).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatPageBadge(settings: PageSettings): string {
  const size = settings.size === "Letter" ? "US Letter" : "A4";
  const orientation =
    settings.orientation === "landscape" ? "Landscape" : "Portrait";
  return `${size} · ${orientation}`;
}

export function WriterDashboard({
  initialStatus = "active",
  embedded = false,
}: {
  initialStatus?: "active" | "trash";
  embedded?: boolean;
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [status, setStatus] = useState<"active" | "trash">(initialStatus);
  const [search, setSearch] = useState("");
  const [sortOption, setSortOption] = useState<SortOption>("updatedAt:desc");
  const [page, setPage] = useState(1);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<WriterMetadata | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [trashing, setTrashing] = useState<WriterMetadata | null>(null);

  const user = useCurrentUser();
  const accountId = user.data?.id ?? "anonymous";
  const client = useQueryClient();
  const navigate = useNavigate();
  const show = useToastStore((state) => state.show);

  const { sort, order } = parseSort(sortOption);
  const trimmedSearch = search.trim();
  const limit = 10;

  const queryParams: WriterListParams = {
    page,
    limit,
    status,
    sort,
    order,
    ...(trimmedSearch ? { search: trimmedSearch } : {}),
  };

  const documents = useQuery({
    queryKey: ["writer-list", accountId, queryParams],
    queryFn: () => writerApi.list(queryParams),
    placeholderData: keepPreviousData,
  });

  const renameMutation = useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) =>
      writerApi.rename(id, title),
    onMutate: async ({ id, title }) => {
      await client.cancelQueries({ queryKey: ["writer-list", accountId] });
      const previous = client.getQueriesData<PaginatedWriterDocuments>({
        queryKey: ["writer-list", accountId],
      });
      previous.forEach(([key, data]) => {
        if (!data) return;
        client.setQueryData<PaginatedWriterDocuments>(key, {
          ...data,
          items: data.items.map((item) =>
            item.id === id ? { ...item, title: title.trim() } : item,
          ),
        });
      });
      return { previous };
    },
    onError: (err, _vars, context) => {
      context?.previous.forEach(([key, data]) => {
        client.setQueryData(key, data);
      });
      show(err instanceof Error ? err.message : "Rename failed.", "error");
    },
    onSuccess: (updated) => {
      setRenaming(null);
      show("Document renamed.", "success");
      void client.invalidateQueries({
        queryKey: ["writer", accountId, updated.id],
      });
    },
    onSettled: () => {
      void client.invalidateQueries({ queryKey: ["writer-list", accountId] });
    },
  });

  const trashMutation = useMutation({
    mutationFn: (id: string) => writerApi.trash(id),
    onMutate: async (id) => {
      await client.cancelQueries({ queryKey: ["writer-list", accountId] });
      const previous = client.getQueriesData<PaginatedWriterDocuments>({
        queryKey: ["writer-list", accountId],
      });
      previous.forEach(([key, data]) => {
        if (!data) return;
        const filtered = data.items.filter((item) => item.id !== id);
        if (filtered.length !== data.items.length) {
          client.setQueryData<PaginatedWriterDocuments>(key, {
            ...data,
            items: filtered,
            total: Math.max(0, data.total - 1),
          });
        }
      });
      return { previous };
    },
    onError: (err, _id, context) => {
      context?.previous.forEach(([key, data]) => {
        client.setQueryData(key, data);
      });
      show(
        err instanceof Error ? err.message : "Could not move to trash.",
        "error",
      );
    },
    onSuccess: (_data, id) => {
      setTrashing(null);
      if (documents.data && documents.data.items.length <= 1 && page > 1) {
        setPage((p) => Math.max(1, p - 1));
      }
      show("Moved to trash.", "success");
      void client.invalidateQueries({ queryKey: ["writer", accountId, id] });
    },
    onSettled: () => {
      void client.invalidateQueries({ queryKey: ["writer-list", accountId] });
    },
  });

  const restoreMutation = useMutation({
    mutationFn: (id: string) => writerApi.restore(id),
    onMutate: async (id) => {
      await client.cancelQueries({ queryKey: ["writer-list", accountId] });
      const previous = client.getQueriesData<PaginatedWriterDocuments>({
        queryKey: ["writer-list", accountId],
      });
      previous.forEach(([key, data]) => {
        if (!data) return;
        const filtered = data.items.filter((item) => item.id !== id);
        if (filtered.length !== data.items.length) {
          client.setQueryData<PaginatedWriterDocuments>(key, {
            ...data,
            items: filtered,
            total: Math.max(0, data.total - 1),
          });
        }
      });
      return { previous };
    },
    onError: (err, _id, context) => {
      context?.previous.forEach(([key, data]) => {
        client.setQueryData(key, data);
      });
      show(
        err instanceof Error ? err.message : "Could not restore document.",
        "error",
      );
    },
    onSuccess: (_data, id) => {
      if (documents.data && documents.data.items.length <= 1 && page > 1) {
        setPage((p) => Math.max(1, p - 1));
      }
      show("Document restored.", "success");
      void client.invalidateQueries({ queryKey: ["writer", accountId, id] });
    },
    onSettled: () => {
      void client.invalidateQueries({ queryKey: ["writer-list", accountId] });
    },
  });

  const items = documents.data?.items ?? [];
  const total = documents.data?.total ?? 0;
  const totalPages = Math.max(1, documents.data?.totalPages ?? 1);

  return (
    <section
      className={
        embedded
          ? "writer-dashboard writer-dashboard-embedded"
          : "dashboard-section writer-dashboard"
      }
      aria-label="Papertrail Writer library"
    >
      <div className="section-title-row">
        <div>
          <h2>Papertrail Writer</h2>
          <p className="muted">
            Start from a blank document. Write, save, and export to PDF.
          </p>
        </div>
        <button
          type="button"
          className="primary-button"
          onClick={() => setCreateOpen(true)}
        >
          <Plus size={16} /> Create document
        </button>
      </div>

      <div className="writer-library-controls">
        <div
          className="writer-status-tabs"
          role="tablist"
          aria-label="Writer document status"
        >
          <button
            type="button"
            role="tab"
            aria-selected={status === "active"}
            className={
              status === "active"
                ? "writer-status-tab active"
                : "writer-status-tab"
            }
            onClick={() => {
              setStatus("active");
              setPage(1);
            }}
          >
            Created documents
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={status === "trash"}
            className={
              status === "trash"
                ? "writer-status-tab active"
                : "writer-status-tab"
            }
            onClick={() => {
              setStatus("trash");
              setPage(1);
            }}
          >
            Trash
          </button>
        </div>

        <div className="writer-filter-bar">
          <label className="writer-search-field">
            <Search size={14} aria-hidden="true" />
            <input
              type="search"
              aria-label="Search created documents"
              placeholder="Search by title…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </label>
          <label className="writer-sort-field">
            <span className="sr-only">Sort created documents</span>
            <select
              aria-label="Sort created documents"
              value={sortOption}
              onChange={(e) => {
                setSortOption(e.target.value as SortOption);
                setPage(1);
              }}
            >
              <option value="updatedAt:desc">Recently edited</option>
              <option value="createdAt:asc">Oldest</option>
              <option value="title:asc">Name A–Z</option>
            </select>
          </label>
        </div>
      </div>

      <div className="writer-library-meta">
        <span>
          {total} {total === 1 ? "document" : "documents"}
          {status === "trash" ? " in trash" : ""}
        </span>
        {documents.isFetching && !documents.isPending && (
          <span role="status" className="writer-fetching-indicator">
            Updating…
          </span>
        )}
      </div>

      {documents.isError ? (
        <div className="writer-library-error" role="alert">
          <span>Unable to load Writer documents.</span>
          <button
            type="button"
            className="toolbar-button bordered"
            onClick={() => void documents.refetch()}
          >
            Retry
          </button>
        </div>
      ) : documents.isPending ? (
        <div
          className="writer-library-skeletons"
          aria-label="Loading created documents"
        >
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton writer-skeleton-row" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="writer-empty-state">
          <FileText size={28} />
          {trimmedSearch ? (
            <>
              <h3>No documents match “{trimmedSearch}”</h3>
              <p className="muted">
                Try a different title or clear the search filter.
              </p>
              <button
                type="button"
                className="toolbar-button bordered"
                onClick={() => {
                  setSearch("");
                  setPage(1);
                }}
              >
                Clear search
              </button>
            </>
          ) : status === "trash" ? (
            <>
              <h3>Trash is empty</h3>
              <p className="muted">
                Writer documents you move to trash will appear here so you can
                restore them.
              </p>
            </>
          ) : (
            <>
              <h3>No created documents yet</h3>
              <p className="muted">
                Create a document from scratch and export it as PDF when
                you&apos;re ready.
              </p>
              <button
                type="button"
                className="primary-button"
                onClick={() => setCreateOpen(true)}
              >
                <Plus size={16} /> Create document
              </button>
            </>
          )}
        </div>
      ) : (
        <>
          <div className="writer-recent writer-library-list" role="list">
            {items.map((doc) => (
              <div key={doc.id} className="writer-doc-row" role="listitem">
                {status === "active" ? (
                  <Link
                    to={`/writer/${doc.id}`}
                    className="writer-doc-main"
                    title={doc.title}
                  >
                    <span className="writer-doc-icon" aria-hidden="true">
                      <FileText size={16} />
                    </span>
                    <span className="writer-doc-info">
                      <strong className="writer-doc-title">{doc.title}</strong>
                      <span className="writer-doc-sub">
                        <span className="writer-doc-badge">
                          Created document
                        </span>
                        <span>{formatPageBadge(doc.pageSettings)}</span>
                        <time
                          dateTime={doc.updatedAt}
                          title={new Date(doc.updatedAt).toLocaleString()}
                        >
                          Edited {formatRelativeTime(doc.updatedAt)}
                        </time>
                      </span>
                    </span>
                    <ArrowUpRight
                      size={15}
                      className="writer-doc-arrow"
                      aria-hidden="true"
                    />
                  </Link>
                ) : (
                  <div className="writer-doc-main writer-doc-trashed">
                    <span className="writer-doc-icon" aria-hidden="true">
                      <FileText size={16} />
                    </span>
                    <span className="writer-doc-info">
                      <strong className="writer-doc-title" title={doc.title}>
                        {doc.title}
                      </strong>
                      <span className="writer-doc-sub">
                        <span className="writer-doc-badge">
                          Created document
                        </span>
                        <span>{formatPageBadge(doc.pageSettings)}</span>
                        <time
                          dateTime={doc.deletedAt || doc.updatedAt}
                          title={new Date(
                            doc.deletedAt || doc.updatedAt,
                          ).toLocaleString()}
                        >
                          Trashed{" "}
                          {formatRelativeTime(doc.deletedAt || doc.updatedAt)}
                        </time>
                      </span>
                    </span>
                  </div>
                )}

                <div className="writer-doc-actions">
                  {status === "trash" && (
                    <button
                      type="button"
                      className="toolbar-button bordered writer-restore-inline"
                      disabled={restoreMutation.isPending}
                      onClick={() => restoreMutation.mutate(doc.id)}
                    >
                      <RotateCcw size={14} /> Restore
                    </button>
                  )}
                  <WriterRowMenu
                    doc={doc}
                    status={status}
                    isOpen={openMenuId === doc.id}
                    onToggle={() =>
                      setOpenMenuId(openMenuId === doc.id ? null : doc.id)
                    }
                    onClose={() => setOpenMenuId(null)}
                    onOpen={() => navigate(`/writer/${doc.id}`)}
                    onRename={() => {
                      setRenaming(doc);
                      setNewTitle(doc.title);
                    }}
                    onTrash={() => setTrashing(doc)}
                    onRestore={() => restoreMutation.mutate(doc.id)}
                  />
                </div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <nav
              className="writer-pagination"
              aria-label="Created documents pagination"
            >
              <span className="writer-pagination-summary">
                Page {page} of {totalPages}
              </span>
              <div className="writer-pagination-buttons">
                <button
                  type="button"
                  className="toolbar-button bordered"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft size={15} /> Previous
                </button>
                <button
                  type="button"
                  className="toolbar-button bordered"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next <ChevronRight size={15} />
                </button>
              </div>
            </nav>
          )}
        </>
      )}

      {createOpen && <CreateWriter onClose={() => setCreateOpen(false)} />}

      {renaming && (
        <Dialog
          title="Rename document"
          description="Choose a clear title for this created document."
          onClose={() => {
            if (!renameMutation.isPending) setRenaming(null);
          }}
        >
          <form
            className="writer-create"
            onSubmit={(e) => {
              e.preventDefault();
              if (!newTitle.trim() || renameMutation.isPending) return;
              renameMutation.mutate({
                id: renaming.id,
                title: newTitle.trim(),
              });
            }}
          >
            <label>
              Document title
              <input
                autoFocus
                aria-label="New document title"
                maxLength={160}
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
              />
            </label>
            <div className="writer-dialog-actions">
              <button
                type="button"
                className="toolbar-button bordered"
                onClick={() => setRenaming(null)}
                disabled={renameMutation.isPending}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="primary-button"
                disabled={!newTitle.trim() || renameMutation.isPending}
              >
                {renameMutation.isPending ? "Saving…" : "Save title"}
              </button>
            </div>
          </form>
        </Dialog>
      )}

      {trashing && (
        <Dialog
          title="Move to trash?"
          description={`“${trashing.title}” will be moved to trash. You can restore it anytime from the Trash tab.`}
          onClose={() => {
            if (!trashMutation.isPending) setTrashing(null);
          }}
        >
          <div className="writer-dialog-actions">
            <button
              type="button"
              className="toolbar-button bordered"
              onClick={() => setTrashing(null)}
              disabled={trashMutation.isPending}
            >
              Cancel
            </button>
            <button
              type="button"
              className="primary-button writer-danger-button"
              disabled={trashMutation.isPending}
              onClick={() => trashMutation.mutate(trashing.id)}
            >
              {trashMutation.isPending ? "Moving…" : "Move to trash"}
            </button>
          </div>
        </Dialog>
      )}
    </section>
  );
}

function WriterRowMenu({
  doc,
  status,
  isOpen,
  onToggle,
  onClose,
  onOpen,
  onRename,
  onTrash,
  onRestore,
}: {
  doc: WriterMetadata;
  status: "active" | "trash";
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  onOpen: () => void;
  onRename: () => void;
  onTrash: () => void;
  onRestore: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("mousedown", handleOutside);
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("mousedown", handleOutside);
      window.removeEventListener("keydown", handleKey);
    };
  }, [isOpen, onClose]);

  return (
    <div className="writer-menu-container" ref={containerRef}>
      <button
        type="button"
        className="writer-menu-trigger"
        aria-label={`Actions for ${doc.title}`}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
      >
        <MoreHorizontal size={16} />
      </button>
      {isOpen && (
        <div className="writer-menu-popover" role="menu">
          {status === "active" ? (
            <>
              <button
                type="button"
                role="menuitem"
                className="writer-menu-item"
                onClick={() => {
                  onClose();
                  onOpen();
                }}
              >
                <ArrowUpRight size={14} /> Open
              </button>
              <button
                type="button"
                role="menuitem"
                className="writer-menu-item"
                onClick={() => {
                  onClose();
                  onRename();
                }}
              >
                <Pencil size={14} /> Rename
              </button>
              <button
                type="button"
                role="menuitem"
                className="writer-menu-item writer-menu-item-danger"
                onClick={() => {
                  onClose();
                  onTrash();
                }}
              >
                <Trash2 size={14} /> Move to trash
              </button>
            </>
          ) : (
            <button
              type="button"
              role="menuitem"
              className="writer-menu-item"
              onClick={() => {
                onClose();
                onRestore();
              }}
            >
              <RotateCcw size={14} /> Restore
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function CreateWriter({ onClose }: { onClose: () => void }) {
  const [title, setTitle] = useState("Untitled document");
  const [size, setSize] = useState<PageSettings["size"]>("A4");
  const [orientation, setOrientation] =
    useState<PageSettings["orientation"]>("portrait");
  const spec = useQuery({
    queryKey: ["writer-spec"],
    queryFn: writerApi.spec,
    staleTime: Infinity,
  });
  const client = useQueryClient();
  const navigate = useNavigate();
  const create = useMutation({
    mutationFn: writerApi.create,
    onSuccess(doc) {
      void client.invalidateQueries({ queryKey: ["writer-list"] });
      void client.invalidateQueries({ queryKey: ["writer"] });
      navigate(`/writer/${doc.id}`);
    },
  });
  return (
    <Dialog
      title="Create document"
      description="A blank page, ready for your next idea."
      onClose={() => {
        if (!create.isPending) onClose();
      }}
    >
      <form
        className="writer-create"
        onSubmit={(e) => {
          e.preventDefault();
          if (spec.data)
            create.mutate({
              title: title.trim() || "Untitled document",
              pageSettings: { ...spec.data.defaultPage, size, orientation },
            });
        }}
      >
        <label>
          Document title
          <input
            autoFocus
            maxLength={160}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label>
          Page size
          <select
            value={size}
            onChange={(e) => setSize(e.target.value as PageSettings["size"])}
          >
            <option>A4</option>
            <option value="Letter">US Letter</option>
          </select>
        </label>
        <label>
          Orientation
          <select
            value={orientation}
            onChange={(e) =>
              setOrientation(e.target.value as PageSettings["orientation"])
            }
          >
            <option value="portrait">Portrait</option>
            <option value="landscape">Landscape</option>
          </select>
        </label>
        {(create.isError || spec.isError) && (
          <p role="alert">
            {create.error?.message || "Unable to load page settings."}
          </p>
        )}
        <button
          className="primary-button"
          disabled={!spec.data || create.isPending}
        >
          {create.isPending ? "Creating…" : "Create"}
        </button>
      </form>
    </Dialog>
  );
}

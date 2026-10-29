import { useRef, useState } from "react";
import { ImagePlus } from "lucide-react";
import type { Editor } from "@tiptap/react";
import { writerApi } from "./writer.api";

const ALLOWED_IMAGE_MIMES = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export function WriterImageButton({
  editor,
  documentId,
  disabled,
  onError,
}: {
  editor: Editor;
  documentId: string;
  disabled?: boolean;
  onError: (message: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!ALLOWED_IMAGE_MIMES.has(file.type)) {
      onError(
        "Unsupported image format. Please choose a PNG, JPEG, or WebP image.",
      );
      return;
    }

    if (file.size <= 0) {
      onError("Selected image file is empty.");
      return;
    }

    if (file.size > MAX_IMAGE_BYTES) {
      onError("Image exceeds the 10 MB maximum file size.");
      return;
    }

    setUploading(true);
    onError("");
    try {
      const asset = await writerApi.uploadAsset(documentId, file);
      if (!editor.isDestroyed) {
        const defaultWidth = Math.min(560, Math.max(80, asset.width || 400));
        editor.commands.insertWriterImage({
          assetId: asset.assetId,
          alt: file.name.replace(/\.[^.]+$/, "").slice(0, 240) || "Image",
          width: defaultWidth,
          align: "center",
        });
      }
    } catch (err) {
      onError(
        err instanceof Error
          ? err.message
          : "Unable to upload image. Please try again.",
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        aria-label="Choose image file"
        disabled={disabled || uploading}
        onChange={(e) => void handleFileChange(e)}
      />
      <button
        type="button"
        title="Insert image"
        aria-label="Insert image"
        disabled={disabled || uploading}
        onClick={() => inputRef.current?.click()}
      >
        <ImagePlus size={15} aria-hidden="true" />
        {uploading ? "Uploading…" : "Image"}
      </button>
    </>
  );
}

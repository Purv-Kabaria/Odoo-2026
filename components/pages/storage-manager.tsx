"use client";

import * as React from "react";
import { Download, File, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { readApiResponse } from "@/lib/api-client";

type StoredObject = {
  id: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  createdAt: string;
  uploadedBy?: {
    name: string;
    email: string;
  };
};

type StorageResponse = {
  data?: StoredObject[];
  meta?: { totalPages?: number; total?: number };
};

const MAX_CLIENT_UPLOAD_BYTES = 20 * 1024 * 1024;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function StorageManager() {
  const [objects, setObjects] = React.useState<StoredObject[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isUploading, setIsUploading] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const loadObjects = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/storage?limit=24", { cache: "no-store" });
      const json = await readApiResponse<StorageResponse>(response, "Failed to load objects");
      setObjects(json.data ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load objects");
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    const frame = window.requestAnimationFrame(() => void loadObjects());
    return () => window.cancelAnimationFrame(frame);
  }, [loadObjects]);

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size <= 0) {
      toast.error("Choose a non-empty file.");
      return;
    }
    if (file.size > MAX_CLIENT_UPLOAD_BYTES) {
      toast.error("Files must be 20 MB or smaller.");
      return;
    }

    setIsUploading(true);
    try {
      const form = new FormData();
      form.set("file", file);
      const response = await fetch("/api/storage", {
        method: "POST",
        body: form,
      });
      await readApiResponse(response, "Failed to upload object");
      toast.success("Object uploaded");
      await loadObjects();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to upload object");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/storage/${id}`, { method: "DELETE" });
      if (response.status !== 204) {
        await readApiResponse(response, "Failed to delete object");
      }
      setObjects((current) => current.filter((object) => object.id !== id));
      toast.success("Object deleted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete object");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 border border-border bg-card p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold">Object storage</h2>
          <p className="text-xs text-muted-foreground">
            Upload files to local MinIO or any S3-compatible provider.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            ref={fileInputRef}
            type="file"
            onChange={(event) => void handleUpload(event)}
            disabled={isUploading}
            className="hidden"
            id="storage-upload"
          />
          <Button asChild className="w-full cursor-pointer sm:w-auto">
            <label htmlFor="storage-upload">
              {isUploading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Upload className="size-4" />
              )}
              Upload
            </label>
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-28 animate-pulse border border-border bg-muted/40" />
          ))}
        </div>
      ) : objects.length === 0 ? (
        <div className="flex min-h-56 flex-col items-center justify-center gap-2 border border-dashed border-border bg-muted/20 p-8 text-center">
          <File className="size-8 text-muted-foreground" />
          <p className="text-sm font-medium">No objects yet</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            Upload a PDF, image, text file, or CSV to verify the storage pipeline.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {objects.map((object) => (
            <div key={object.id} className="border border-border bg-card p-3 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center border border-border bg-primary/10 text-primary">
                  <File className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{object.filename}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatBytes(object.sizeBytes)} · {object.contentType}
                  </p>
                  {object.uploadedBy ? (
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {object.uploadedBy.name}
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <Button asChild variant="outline" size="sm" className="flex-1 cursor-pointer">
                  <a href={`/api/storage/${object.id}`}>
                    <Download className="size-4" />
                    Download
                  </a>
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="cursor-pointer"
                  onClick={() => void handleDelete(object.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

import * as React from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { readApiResponse } from "@/lib/api-client";

type Asset = { id: string; assetTag: string; name: string; status: string; isBookable: boolean };

const KIT_MIN_ITEMS = 2;
const KIT_MAX_ITEMS = 50;

export function CreateKitModal({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const [assets, setAssets] = React.useState<Asset[]>([]);
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => {
      setName("");
      setDescription("");
      setSelectedIds(new Set());
    });
    fetch("/api/assets?limit=100")
      .then((res) => readApiResponse<{ data: Asset[] }>(res, "Failed to load assets"))
      .then((json) => setAssets(json.data.filter((a) => !a.isBookable)))
      .catch(() => undefined);
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  const toggleAsset = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < KIT_MAX_ITEMS) next.add(id);
      return next;
    });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/kits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description: description || undefined, assetIds: Array.from(selectedIds) }),
      });
      await readApiResponse(response, "Failed to create kit");
      toast.success("Kit created");
      onCreated();
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create kit");
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSubmit = name.trim().length >= 2 && selectedIds.size >= KIT_MIN_ITEMS && !isSubmitting;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New asset kit</DialogTitle>
          <DialogDescription>Bundle assets that always get allocated together, e.g. a New Hire Kit.</DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => void handleSubmit(e)} className="grid gap-3">
          <div className="grid gap-2">
            <Label htmlFor="kit-name">Kit name</Label>
            <Input id="kit-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="kit-description">Description (optional)</Label>
            <Textarea id="kit-description" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} />
          </div>
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label>Assets in this kit</Label>
              <span className="text-xs text-muted-foreground">
                {selectedIds.size} / {KIT_MAX_ITEMS} selected (min {KIT_MIN_ITEMS})
              </span>
            </div>
            <div className="max-h-56 space-y-1 overflow-y-auto border border-border p-2">
              {assets.length === 0 ? (
                <p className="p-2 text-sm text-muted-foreground">No directly-allocatable assets available.</p>
              ) : (
                assets.map((a) => (
                  <label
                    key={a.id}
                    htmlFor={`kit-asset-${a.id}`}
                    className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent"
                  >
                    <Checkbox
                      id={`kit-asset-${a.id}`}
                      checked={selectedIds.has(a.id)}
                      onCheckedChange={() => toggleAsset(a.id)}
                    />
                    <span className="flex-1">
                      {a.assetTag} — {a.name}
                    </span>
                    {a.status !== "AVAILABLE" && (
                      <Badge variant="secondary" className="text-xs">{a.status.replace("_", " ").toLowerCase()}</Badge>
                    )}
                  </label>
                ))
              )}
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={!canSubmit} className="cursor-pointer">
              {isSubmitting ? "Creating..." : "Create kit"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

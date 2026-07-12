"use client";

import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { VoiceInputButton } from "@/components/forms/voice-input-button";
import { readApiResponse } from "@/lib/api-client";
import { humanizeEnum } from "@/lib/labels";

type Asset = { id: string; assetTag: string; name: string };

const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"];

export function RaiseMaintenanceModal({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const [assets, setAssets] = React.useState<Asset[]>([]);
  const [assetId, setAssetId] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [priority, setPriority] = React.useState("MEDIUM");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    fetch("/api/assets?limit=100")
      .then((res) => readApiResponse<{ data: Asset[] }>(res, "Failed to load assets"))
      .then((json) => setAssets(json.data))
      .catch(() => undefined);
  }, [open]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/maintenance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetId, description, priority }),
      });
      await readApiResponse(response, "Failed to raise request");
      toast.success("Maintenance request raised");
      setAssetId("");
      setDescription("");
      setPriority("MEDIUM");
      onCreated();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to raise request");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Raise maintenance request</DialogTitle>
          <DialogDescription>Requests must be approved before work begins.</DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => void handleSubmit(e)} className="grid gap-3">
          <div className="grid gap-2">
            <Label htmlFor="maint-asset">Asset</Label>
            <SearchableSelect
              id="maint-asset"
              value={assetId}
              onValueChange={setAssetId}
              options={assets.map((a) => ({ value: a.id, label: `${a.assetTag} — ${a.name}` }))}
              placeholder="Select an asset"
              emptyText="No assets found."
            />
          </div>
          <div className="grid gap-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="maint-description">Describe the issue</Label>
              <VoiceInputButton
                label="Dictate issue description"
                onFinalResult={(text) => setDescription((prev) => (prev ? `${prev} ${text}` : text))}
              />
            </div>
            <Textarea id="maint-description" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="maint-priority">Priority</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger id="maint-priority" className="cursor-pointer"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PRIORITIES.map((p) => <SelectItem key={p} value={p}>{humanizeEnum(p)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting || !assetId || !description} className="cursor-pointer">
              {isSubmitting ? "Submitting..." : "Raise request"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

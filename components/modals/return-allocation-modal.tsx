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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { VoiceInputButton } from "@/components/forms/voice-input-button";
import { readApiResponse } from "@/lib/api-client";

const CONDITIONS = ["NEW", "GOOD", "FAIR", "POOR", "DAMAGED"];

type ReturnTarget = { allocationId: string; assetLabel: string };

export function ReturnAllocationModal({
  target,
  onOpenChange,
  onReturned,
}: {
  target: ReturnTarget | null;
  onOpenChange: (open: boolean) => void;
  onReturned: () => void;
}) {
  const [returnCondition, setReturnCondition] = React.useState("GOOD");
  const [checkInNotes, setCheckInNotes] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (!target) return;
    const frame = window.requestAnimationFrame(() => {
      setReturnCondition("GOOD");
      setCheckInNotes("");
    });
    return () => window.cancelAnimationFrame(frame);
  }, [target]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!target) return;
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/allocations/${target.allocationId}/return`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ returnCondition, checkInNotes: checkInNotes.trim() || undefined }),
      });
      await readApiResponse(response, "Failed to process return");
      toast.success("Asset marked as returned");
      onReturned();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to process return");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={target !== null} onOpenChange={(next) => { if (!next) onOpenChange(false); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Return asset</DialogTitle>
          <DialogDescription>{target?.assetLabel}</DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => void handleSubmit(e)} className="grid gap-3">
          <div className="grid gap-2">
            <Label htmlFor="return-condition">Condition on return</Label>
            <Select value={returnCondition} onValueChange={setReturnCondition}>
              <SelectTrigger id="return-condition" className="cursor-pointer"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CONDITIONS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="return-notes">Condition notes</Label>
              <VoiceInputButton
                label="Dictate condition notes"
                onFinalResult={(text) => setCheckInNotes((prev) => (prev ? `${prev} ${text}` : text))}
              />
            </div>
            <Textarea
              id="return-notes"
              value={checkInNotes}
              onChange={(e) => setCheckInNotes(e.target.value)}
              maxLength={1000}
              placeholder="Any scratches, missing parts, or issues to note..."
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting} className="cursor-pointer">
              {isSubmitting ? "Processing..." : "Confirm return"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

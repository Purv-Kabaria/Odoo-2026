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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { readApiResponse } from "@/lib/api-client";

type Category = { id: string; name: string; fieldSchema?: unknown };

type CategoryField = { key: string; label: string; type: string; required?: boolean };

const CONDITIONS = ["NEW", "GOOD", "FAIR", "POOR", "DAMAGED"];

export function AssetFormModal({
  open,
  onOpenChange,
  categories,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: Category[];
  onCreated: () => void;
}) {
  const [name, setName] = React.useState("");
  const [categoryId, setCategoryId] = React.useState("");
  const [serialNumber, setSerialNumber] = React.useState("");
  const [location, setLocation] = React.useState("");
  const [condition, setCondition] = React.useState("GOOD");
  const [isBookable, setIsBookable] = React.useState(false);
  const [customFields, setCustomFields] = React.useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const selectedCategory = categories.find((c) => c.id === categoryId);
  const declaredFields: CategoryField[] = Array.isArray(selectedCategory?.fieldSchema)
    ? (selectedCategory!.fieldSchema as CategoryField[])
    : [];

  React.useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => {
      setName("");
      setCategoryId("");
      setSerialNumber("");
      setLocation("");
      setCondition("GOOD");
      setIsBookable(false);
      setCustomFields({});
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          categoryId,
          serialNumber: serialNumber || null,
          location: location || null,
          condition,
          isBookable,
          customFields,
        }),
      });
      await readApiResponse(response, "Failed to register asset");
      toast.success("Asset registered");
      onCreated();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to register asset");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Register asset</DialogTitle>
          <DialogDescription>Enters the system as Available. A tag is generated automatically.</DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => void handleSubmit(e)} className="grid gap-3">
          <div className="grid gap-2">
            <Label htmlFor="asset-name">Name</Label>
            <Input id="asset-name" value={name} onChange={(e) => setName(e.target.value)} minLength={2} maxLength={140} required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="asset-category">Category</Label>
            <Select value={categoryId} onValueChange={setCategoryId} required>
              <SelectTrigger id="asset-category" className="cursor-pointer"><SelectValue placeholder="Select a category" /></SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="asset-serial">Serial number</Label>
              <Input id="asset-serial" value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} maxLength={120} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="asset-condition">Condition</Label>
              <Select value={condition} onValueChange={setCondition}>
                <SelectTrigger id="asset-condition" className="cursor-pointer"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CONDITIONS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="asset-location">Location</Label>
            <Input id="asset-location" value={location} onChange={(e) => setLocation(e.target.value)} maxLength={160} />
          </div>
          {declaredFields.map((field) => (
            <div key={field.key} className="grid gap-2">
              <Label htmlFor={`asset-field-${field.key}`}>
                {field.label}{field.required ? " *" : ""}
              </Label>
              <Input
                id={`asset-field-${field.key}`}
                value={customFields[field.key] ?? ""}
                onChange={(e) => setCustomFields((prev) => ({ ...prev, [field.key]: e.target.value }))}
                required={field.required}
              />
            </div>
          ))}
          <div className="flex items-center justify-between border border-border p-3">
            <div>
              <p className="text-sm font-medium">Shared / bookable resource</p>
              <p className="text-xs text-muted-foreground">Books via time slots instead of individual allocation.</p>
            </div>
            <Switch checked={isBookable} onCheckedChange={setIsBookable} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting || !name || !categoryId} className="cursor-pointer">
              {isSubmitting ? "Registering..." : "Register asset"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

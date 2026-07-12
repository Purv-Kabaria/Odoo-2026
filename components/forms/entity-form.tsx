"use client";

import { crudFormFieldsClass } from "@/components/modals/crud-modal-styles";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { editableColumns } from "@/lib/entities/types";
import type { EntityConfig } from "@/lib/entities/types";

export type EntityFormValues = Record<string, string | number | boolean | null>;

type EntityFormProps = {
  config: EntityConfig;
  values: EntityFormValues;
  onChange: (values: EntityFormValues) => void;
  disabled?: boolean;
};

function inputTypeFor(columnType: string): string {
  if (columnType === "number") return "number";
  if (columnType === "email") return "email";
  if (columnType === "date") return "date";
  return "text";
}

function displayValue(columnType: string, value: string | number | boolean | null): string {
  if (value === null || value === undefined) return "";
  if (columnType === "date") return String(value).slice(0, 10);
  return String(value);
}

/**
 * Auto-generates a create/edit form from an entity's column config —
 * every entity gets a working form for free, no hand-written JSX per
 * resource. Renders inside CreateModal/EditModal.
 */
export function EntityForm({ config, values, onChange, disabled }: EntityFormProps) {
  const columns = editableColumns(config);

  const setField = (key: string, value: string | number | boolean | null) => {
    onChange({ ...values, [key]: value });
  };

  return (
    <div className={crudFormFieldsClass}>
      {columns.map((column) => {
        const value = values[column.key] ?? null;
        const fieldId = `entity-form-${config.key}-${column.key}`;

        return (
          <div key={column.key} className="grid gap-2">
            <Label htmlFor={fieldId}>{column.label}</Label>
            {column.type === "select" ? (
              <Select
                value={value != null ? String(value) : undefined}
                onValueChange={(next) => setField(column.key, next)}
                disabled={disabled}
              >
                <SelectTrigger id={fieldId} className="cursor-pointer shadow-sm">
                  <SelectValue placeholder={`Select ${column.label.toLowerCase()}...`} />
                </SelectTrigger>
                <SelectContent>
                  {column.options?.map((option) => (
                    <SelectItem key={option.value} value={option.value} className="cursor-pointer">
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : column.type === "boolean" ? (
              <Switch
                id={fieldId}
                checked={Boolean(value)}
                onCheckedChange={(checked) => setField(column.key, checked)}
                disabled={disabled}
                className="cursor-pointer"
              />
            ) : (
              <Input
                id={fieldId}
                type={inputTypeFor(column.type)}
                value={displayValue(column.type, value)}
                onChange={(event) => {
                  const raw = event.target.value;
                  setField(column.key, column.type === "number" ? (raw === "" ? null : Number(raw)) : raw);
                }}
                disabled={disabled}
                className="shadow-sm"
                required
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function defaultFormValues(config: EntityConfig): EntityFormValues {
  const values: EntityFormValues = {};
  for (const column of editableColumns(config)) {
    if (column.type === "select") {
      values[column.key] = column.options?.[0]?.value ?? "";
    } else if (column.type === "boolean") {
      values[column.key] = false;
    } else if (column.type === "number") {
      values[column.key] = 0;
    } else {
      values[column.key] = "";
    }
  }
  return values;
}

export function valuesFromRow(config: EntityConfig, row: Record<string, unknown>): EntityFormValues {
  const values: EntityFormValues = {};
  for (const column of editableColumns(config)) {
    const raw = row[column.key];
    values[column.key] = raw === undefined ? null : (raw as string | number | boolean | null);
  }
  return values;
}

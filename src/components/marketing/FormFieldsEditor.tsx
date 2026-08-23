import { ArrowDown, ArrowUp, GripVertical, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  fieldKeyFromLabel,
  formFieldTypeLabels,
  isChoiceField,
  newFormField,
  type FormFieldDef,
  type FormFieldType,
} from "@/lib/marketing/formFields";

interface FormFieldsEditorProps {
  fields: FormFieldDef[];
  onChange: (fields: FormFieldDef[]) => void;
}

/**
 * Builder for the extra questions shown on a public form, in the same simple
 * style as the tour custom-form builder.
 */
export function FormFieldsEditor({ fields, onChange }: FormFieldsEditorProps) {
  const update = (index: number, patch: Partial<FormFieldDef>) =>
    onChange(fields.map((f, i) => (i === index ? { ...f, ...patch } : f)));

  const move = (index: number, dir: -1 | 1) => {
    const j = index + dir;
    if (j < 0 || j >= fields.length) return;
    const next = [...fields];
    [next[index], next[j]] = [next[j], next[index]];
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>
          Extra questions{" "}
          <span className="text-xs text-muted-foreground">
            (name, email, phone, state and tours are always included)
          </span>
        </Label>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="gap-1.5"
          onClick={() => onChange([...fields, newFormField(fields)])}
        >
          <Plus className="h-3.5 w-3.5" /> Add question
        </Button>
      </div>

      {fields.length === 0 && (
        <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
          No extra questions yet — add the ones you use on your current Keap form.
        </p>
      )}

      {fields.map((field, i) => (
        <div key={`${field.key}-${i}`} className="space-y-3 rounded-md border p-3">
          <div className="flex items-center gap-2">
            <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" />
            <Input
              value={field.label}
              placeholder="Question label"
              onChange={(e) =>
                update(i, {
                  label: e.target.value,
                  key:
                    field.key && field.key !== "field"
                      ? field.key
                      : fieldKeyFromLabel(
                          e.target.value,
                          fields.filter((_, j) => j !== i).map((f) => f.key)
                        ),
                })
              }
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Move question up"
              onClick={() => move(i, -1)}
              disabled={i === 0}
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Move question down"
              onClick={() => move(i, 1)}
              disabled={i === fields.length - 1}
            >
              <ArrowDown className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-destructive"
              aria-label="Remove question"
              onClick={() => onChange(fields.filter((_, j) => j !== i))}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Answer type</Label>
              <Select
                value={field.type}
                onValueChange={(type) => update(i, { type: type as FormFieldType })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(formFieldTypeLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Width</Label>
              <Select
                value={field.width || "full"}
                onValueChange={(width) => update(i, { width: width as "full" | "half" })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full">Full width</SelectItem>
                  <SelectItem value="half">Half width</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              {field.type !== "heading" && (
                <label className="flex items-center gap-2 text-sm">
                  <Switch
                    checked={field.required === true}
                    onCheckedChange={(required) => update(i, { required })}
                  />
                  Required
                </label>
              )}
            </div>
          </div>

          {isChoiceField(field.type) && (
            <div className="space-y-1.5">
              <Label className="text-xs">Options (one per line)</Label>
              <Textarea
                rows={3}
                value={(field.options || []).join("\n")}
                onChange={(e) =>
                  update(i, {
                    options: e.target.value
                      .split("\n")
                      .map((o) => o.trim())
                      .filter(Boolean),
                  })
                }
              />
            </div>
          )}

          {field.type !== "heading" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Placeholder</Label>
                <Input
                  value={field.placeholder || ""}
                  onChange={(e) => update(i, { placeholder: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Helper text</Label>
                <Input
                  value={field.help || ""}
                  onChange={(e) => update(i, { help: e.target.value })}
                />
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

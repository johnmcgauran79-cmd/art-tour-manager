/**
 * Custom field definitions for public marketing forms (register interest /
 * booking). Stored on `landing_pages.fields` and rendered by PublicForm.
 */
export type FormFieldType =
  | "text"
  | "textarea"
  | "email"
  | "phone"
  | "number"
  | "date"
  | "select"
  | "radio"
  | "checkbox"
  | "heading";

export interface FormFieldDef {
  key: string;
  label: string;
  type: FormFieldType;
  required?: boolean;
  options?: string[];
  placeholder?: string;
  help?: string;
  /** Layout width on desktop. */
  width?: "full" | "half";
}

export const formFieldTypeLabels: Record<FormFieldType, string> = {
  text: "Short text",
  textarea: "Long text",
  email: "Email address",
  phone: "Phone number",
  number: "Number",
  date: "Date",
  select: "Dropdown",
  radio: "Multiple choice (pick one)",
  checkbox: "Tick box (yes/no)",
  heading: "Section heading",
};

/** Turn a label into a stable, storage-friendly key. */
export const fieldKeyFromLabel = (label: string, existing: string[] = []): string => {
  const base =
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "")
      .slice(0, 40) || "field";
  let key = base;
  let n = 2;
  while (existing.includes(key)) key = `${base}_${n++}`;
  return key;
};

export const newFormField = (existing: FormFieldDef[] = []): FormFieldDef => ({
  key: fieldKeyFromLabel("question", existing.map((f) => f.key)),
  label: "New question",
  type: "text",
  required: false,
  width: "full",
});

export const isChoiceField = (type: FormFieldType) => type === "select" || type === "radio";

/** Normalise whatever is stored in the DB into a usable field list. */
export const parseFormFields = (raw: unknown): FormFieldDef[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((f): f is Record<string, unknown> => !!f && typeof f === "object")
    .map((f) => ({
      key: String(f.key || ""),
      label: String(f.label || ""),
      type: (String(f.type || "text") as FormFieldType) || "text",
      required: f.required === true,
      options: Array.isArray(f.options) ? f.options.map((o) => String(o)) : undefined,
      placeholder: f.placeholder ? String(f.placeholder) : undefined,
      help: f.help ? String(f.help) : undefined,
      width: f.width === "half" ? ("half" as const) : ("full" as const),
    }))
    .filter((f) => f.key && f.label);
};

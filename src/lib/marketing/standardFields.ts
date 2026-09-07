/**
 * The built-in questions every public form starts with (name, email, tours,
 * room type, …). Staff can switch each one on or off, make it required and
 * rename its label from Marketing → Forms; the settings live on
 * `landing_pages.field_config`.
 */
export type StandardFieldKey =
  | "first_name"
  | "last_name"
  | "email"
  | "phone"
  | "state"
  | "country"
  | "travellers"
  | "previous_traveller"
  | "preferred_contact"
  | "tours"
  | "passengers"
  | "passenger_dietary"
  | "room_type"
  | "bedding"
  | "emergency_contact"
  | "special_requests"
  | "message"
  | "consent";

export interface StandardFieldDef {
  key: StandardFieldKey;
  /** Default wording shown on the public form. */
  label: string;
  /** Which form types the question is available on. */
  forms: "both" | "interest" | "booking";
  /** Always shown and always required (name / email). */
  locked?: boolean;
  /** Can this question be made compulsory? */
  requirable?: boolean;
  defaultEnabled: boolean;
  defaultRequired?: boolean;
  /** Older on/off column kept for forms saved before field settings existed. */
  legacyToggle?: "show_country" | "show_travellers" | "show_previous_traveller" | "show_preferred_contact";
  group: "About them" | "Tours" | "Booking details" | "Finishing up";
}

export interface StandardFieldSetting {
  enabled: boolean;
  required: boolean;
  label?: string;
}

export const STANDARD_FIELDS: StandardFieldDef[] = [
  { key: "first_name", label: "First name", forms: "both", locked: true, defaultEnabled: true, defaultRequired: true, group: "About them" },
  { key: "last_name", label: "Surname", forms: "both", requirable: true, defaultEnabled: true, group: "About them" },
  { key: "email", label: "Email", forms: "both", locked: true, defaultEnabled: true, defaultRequired: true, group: "About them" },
  { key: "phone", label: "Phone", forms: "both", requirable: true, defaultEnabled: true, group: "About them" },
  { key: "state", label: "State", forms: "both", requirable: true, defaultEnabled: true, group: "About them" },
  { key: "country", label: "Country", forms: "both", requirable: true, defaultEnabled: false, legacyToggle: "show_country", group: "About them" },
  { key: "travellers", label: "How many travelling?", forms: "both", requirable: true, defaultEnabled: true, legacyToggle: "show_travellers", group: "About them" },
  { key: "previous_traveller", label: "Travelled with us before?", forms: "both", requirable: true, defaultEnabled: true, legacyToggle: "show_previous_traveller", group: "About them" },
  { key: "preferred_contact", label: "Preferred contact method", forms: "both", requirable: true, defaultEnabled: false, legacyToggle: "show_preferred_contact", group: "About them" },
  { key: "tours", label: "Tours", forms: "both", requirable: true, defaultEnabled: true, group: "Tours" },
  { key: "passengers", label: "Passengers", forms: "booking", requirable: true, defaultEnabled: true, group: "Booking details" },
  { key: "passenger_dietary", label: "Dietary requirements", forms: "booking", defaultEnabled: true, group: "Booking details" },
  { key: "room_type", label: "Room type", forms: "booking", requirable: true, defaultEnabled: true, group: "Booking details" },
  { key: "bedding", label: "Bedding preference", forms: "booking", requirable: true, defaultEnabled: true, group: "Booking details" },
  { key: "emergency_contact", label: "Emergency contact (name and phone)", forms: "booking", requirable: true, defaultEnabled: true, group: "Booking details" },
  { key: "special_requests", label: "Special requests", forms: "booking", requirable: true, defaultEnabled: true, group: "Booking details" },
  { key: "message", label: "Your message", forms: "both", requirable: true, defaultEnabled: true, group: "Finishing up" },
  { key: "consent", label: "Marketing consent", forms: "both", requirable: true, defaultEnabled: true, group: "Finishing up" },
];

export const DEFAULT_ROOM_TYPES = ["Single", "Twin share", "Double", "Triple"];
export const DEFAULT_BEDDING_OPTIONS = ["Single beds", "Double bed", "King bed"];
export const CONTACT_METHOD_OPTIONS = ["Email", "Phone call", "Text message"];

export const fieldsForForm = (formType: string | null | undefined) =>
  STANDARD_FIELDS.filter(
    (f) => f.forms === "both" || f.forms === (formType === "booking" ? "booking" : "interest")
  );

/**
 * Merge saved settings with the defaults (and the older show_* columns) so
 * every form has a complete, predictable set of questions.
 */
export const resolveStandardFields = (
  page: {
    form_type?: string | null;
    field_config?: unknown;
    show_country?: boolean | null;
    show_travellers?: boolean | null;
    show_previous_traveller?: boolean | null;
    show_preferred_contact?: boolean | null;
  } | null | undefined
): Record<StandardFieldKey, StandardFieldSetting> => {
  const saved = (page?.field_config && typeof page.field_config === "object"
    ? (page.field_config as Record<string, any>)
    : {}) as Record<string, Partial<StandardFieldSetting>>;

  const out = {} as Record<StandardFieldKey, StandardFieldSetting>;
  for (const def of STANDARD_FIELDS) {
    const s = saved[def.key];
    const legacy =
      def.legacyToggle && page ? (page as any)[def.legacyToggle] : undefined;
    const enabled = def.locked
      ? true
      : typeof s?.enabled === "boolean"
        ? s.enabled
        : typeof legacy === "boolean"
          ? legacy
          : def.defaultEnabled;
    out[def.key] = {
      enabled,
      required: def.locked ? true : s?.required === true || (!s && def.defaultRequired === true),
      label: s?.label && String(s.label).trim() ? String(s.label).trim() : undefined,
    };
  }
  return out;
};

/** Label to show for a standard question, honouring any custom wording. */
export const standardLabel = (
  key: StandardFieldKey,
  settings: Record<StandardFieldKey, StandardFieldSetting>,
  fallback?: string
) => settings[key]?.label || fallback || STANDARD_FIELDS.find((f) => f.key === key)?.label || key;

/** Clean a textarea of one-per-line options into a list. */
export const parseOptionLines = (raw: string): string[] =>
  raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

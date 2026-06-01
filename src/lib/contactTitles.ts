// Shared list of contact title/prefix options used across add/edit/view contact
// forms and the customer self-service profile update page.
export const CONTACT_TITLE_OPTIONS = [
  "Mr",
  "Mrs",
  "Ms",
  "Miss",
  "Mx",
  "Dr",
  "Prof",
  "Rev",
  "Sir",
  "Lady",
  "Dame",
  "Master",
] as const;

export type ContactTitle = (typeof CONTACT_TITLE_OPTIONS)[number];

// Builds a display name optionally prefixed with the title, e.g. "Mr John Smith".
export const formatNameWithTitle = (
  title: string | null | undefined,
  ...parts: (string | null | undefined)[]
): string => {
  const name = parts.filter(Boolean).join(" ").trim();
  return [title?.trim(), name].filter(Boolean).join(" ").trim();
};
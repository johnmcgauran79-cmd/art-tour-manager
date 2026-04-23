/**
 * Entity link token format used in task descriptions and comments.
 *
 *   [[type:uuid|Display Label]]
 *
 * Example: [[booking:6f0ad9e0-...|John Smith — 2026 Tour]]
 *
 * Triggers in Postgres extract these into the `task_entity_links` table.
 */

export type EntityType = "booking" | "hotel" | "activity" | "tour" | "contact";

export interface ParsedEntityLink {
  type: EntityType;
  id: string;
  label: string;
  /** Character offset in the source string where the token starts */
  start: number;
  /** Character offset in the source string where the token ends (exclusive) */
  end: number;
  /** The full raw token, e.g. `[[booking:uuid|Label]]` */
  raw: string;
}

export const ENTITY_LINK_REGEX =
  /\[\[(booking|hotel|activity|tour|contact):([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:\|([^\]]*))?\]\]/gi;

export function buildEntityToken(type: EntityType, id: string, label: string): string {
  // Strip pipe and bracket characters from label to keep parsing safe
  const safeLabel = (label || "").replace(/[\[\]|]/g, "").trim() || type;
  return `[[${type}:${id}|${safeLabel}]]`;
}

export function parseEntityLinks(text: string | null | undefined): ParsedEntityLink[] {
  if (!text) return [];
  const out: ParsedEntityLink[] = [];
  const re = new RegExp(ENTITY_LINK_REGEX.source, ENTITY_LINK_REGEX.flags);
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    out.push({
      type: m[1].toLowerCase() as EntityType,
      id: m[2],
      label: (m[3] || "").trim() || m[1],
      start: m.index,
      end: m.index + m[0].length,
      raw: m[0],
    });
  }
  return out;
}

/** Get a stable nav route for an entity link, or null if it isn't navigable. */
export function entityLinkHref(type: EntityType, id: string): string | null {
  switch (type) {
    case "booking":
      return `/bookings/${id}`;
    case "tour":
      return `/tours/${id}`;
    case "contact":
      return `/contacts/${id}`;
    case "hotel":
    case "activity":
      // No standalone detail pages — chip is informational only.
      return null;
  }
}

export const ENTITY_LABELS: Record<EntityType, string> = {
  booking: "Booking",
  hotel: "Hotel",
  activity: "Activity",
  tour: "Tour",
  contact: "Contact",
};
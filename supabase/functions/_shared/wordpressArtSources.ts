// Registry of ART-side source fields the mapping UI can pick from.
// Kept in lockstep with src/lib/mcp/wordpress/artSources.ts.
//
// A source is either a raw column on the tours row (`tours.<col>`) or a
// computed value derived from related tables (`computed:<key>`). The
// proxy resolves values by looking the source up in this registry when
// building the diff/push payload.

export type ArtSourceKind = "text" | "number" | "date" | "html";

export interface ArtSource {
  /** Stable identifier stored in wordpress_field_mappings.art_source */
  key: string;
  /** Human label for the mapping UI dropdown */
  label: string;
  /** Grouping in the dropdown (Tour / Hotels / Itinerary / etc) */
  group: string;
  kind: ArtSourceKind;
}

export const ART_SOURCES: ArtSource[] = [
  // Tour columns
  { key: "tours.name",                group: "Tour",  label: "Tour name",              kind: "text"   },
  { key: "tours.location",            group: "Tour",  label: "Location",               kind: "text"   },
  { key: "tours.start_date",          group: "Tour",  label: "Start date",             kind: "date"   },
  { key: "tours.end_date",            group: "Tour",  label: "End date",               kind: "date"   },
  { key: "tours.price_single",        group: "Tour",  label: "Single room price",      kind: "number" },
  { key: "tours.price_twin",          group: "Tour",  label: "Twin room (per person)", kind: "number" },
  { key: "tours.price_double",        group: "Tour",  label: "Double room (per person)", kind: "number" },
  { key: "tours.deposit_amount",      group: "Tour",  label: "Deposit amount",         kind: "number" },
  { key: "tours.instalment_details",  group: "Tour",  label: "Payment / instalment details", kind: "html" },
  { key: "tours.welcome_message",     group: "Tour",  label: "Welcome message",        kind: "html"   },
  { key: "tours.description",         group: "Tour",  label: "Description",            kind: "html"   },
  { key: "tours.brochure_url",        group: "Tour",  label: "Brochure URL",           kind: "text"   },
  { key: "tours.status",              group: "Tour",  label: "Tour status",            kind: "text"   },
  // Computed
  { key: "computed:tour_year",              group: "Computed",  label: "Tour year (from start_date)", kind: "text"   },
  { key: "computed:time_frame",             group: "Computed",  label: "Time frame (Month YYYY)",     kind: "text"   },
  { key: "computed:first_hotel_name",       group: "Hotels",    label: "First hotel: name",           kind: "text"   },
  { key: "computed:first_hotel_nights",     group: "Hotels",    label: "First hotel: nights",         kind: "number" },
  { key: "computed:hotels_summary_html",    group: "Hotels",    label: "All hotels: summary (HTML)",  kind: "html"   },
  { key: "computed:itinerary_summary_html", group: "Itinerary", label: "Itinerary: summary (HTML)",   kind: "html"   },
];

export function findArtSource(key: string | null | undefined): ArtSource | null {
  if (!key) return null;
  return ART_SOURCES.find((s) => s.key === key) ?? null;
}

/** Column names on tours that should be SELECTed to resolve any ART source. */
export function tourColumnsForSources(): string[] {
  const cols = new Set<string>(["id", "name", "start_date", "end_date"]);
  for (const s of ART_SOURCES) {
    if (s.key.startsWith("tours.")) cols.add(s.key.slice("tours.".length));
  }
  return Array.from(cols);
}

function asStr(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v);
}

/** Resolve an ART source key to a WP-ready string given a tour row and related bundles. */
export function resolveArtSourceValue(
  key: string,
  tour: Record<string, unknown>,
  related?: {
    hotels?: Array<{ name?: string | null; nights?: number | null; check_in?: string | null; check_out?: string | null }>;
    itinerary_days?: Array<{ day_number?: number | null; title?: string | null; description?: string | null }>;
  },
): string {
  if (key.startsWith("tours.")) {
    return asStr(tour[key.slice("tours.".length)]);
  }
  if (key === "computed:tour_year") {
    const s = asStr(tour.start_date);
    const m = s.match(/(19|20)\d{2}/);
    return m ? m[0] : "";
  }
  if (key === "computed:time_frame") {
    const s = asStr(tour.start_date);
    if (!s) return "";
    const d = new Date(s);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString("en-AU", { month: "long", year: "numeric" });
  }
  if (key === "computed:first_hotel_name") {
    return asStr(related?.hotels?.[0]?.name);
  }
  if (key === "computed:first_hotel_nights") {
    return asStr(related?.hotels?.[0]?.nights);
  }
  if (key === "computed:hotels_summary_html") {
    const rows = (related?.hotels ?? []).filter((h) => h.name).map(
      (h) => `<li>${h.name}${h.nights ? ` — ${h.nights} nights` : ""}</li>`,
    );
    return rows.length ? `<ul>${rows.join("")}</ul>` : "";
  }
  if (key === "computed:itinerary_summary_html") {
    const rows = (related?.itinerary_days ?? [])
      .slice()
      .sort((a, b) => (a.day_number ?? 0) - (b.day_number ?? 0))
      .map((d) => `<li><strong>Day ${d.day_number ?? "?"}${d.title ? `: ${d.title}` : ""}</strong>${d.description ? `<br>${d.description}` : ""}</li>`);
    return rows.length ? `<ol>${rows.join("")}</ol>` : "";
  }
  return "";
}
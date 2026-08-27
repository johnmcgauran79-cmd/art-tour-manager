// Client mirror of supabase/functions/_shared/wordpressArtSources.ts.
// Keep both files in lockstep.

export type ArtSourceKind = "text" | "number" | "date" | "html";

export interface ArtSource {
  key: string;
  label: string;
  group: string;
  kind: ArtSourceKind;
}

export const ART_SOURCES: ArtSource[] = [
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
  { key: "computed:tour_year",              group: "Computed",  label: "Tour year (from start_date)", kind: "text"   },
  { key: "computed:time_frame",             group: "Computed",  label: "Time frame (Month YYYY)",     kind: "text"   },
  { key: "computed:first_hotel_name",       group: "Hotels",    label: "First hotel: name",           kind: "text"   },
  { key: "computed:first_hotel_nights",     group: "Hotels",    label: "First hotel: nights",         kind: "number" },
  { key: "computed:hotels_summary_html",    group: "Hotels",    label: "All hotels: summary (HTML)",  kind: "html"   },
  { key: "computed:itinerary_summary_html", group: "Itinerary", label: "Itinerary: summary (HTML)",   kind: "html"   },
];

export const ART_SOURCE_GROUPS = Array.from(new Set(ART_SOURCES.map((s) => s.group)));

/**
 * Heuristic auto-suggestion: given a WordPress ACF key, guess the best
 * ART source. Returns null if no confident match.
 */
export function suggestArtSource(wpKey: string): string | null {
  const k = wpKey.toLowerCase();
  const table: Array<[RegExp | string, string]> = [
    [/single.*price|price.*single/, "tours.price_single"],
    [/twin.*price|price.*twin/,     "tours.price_twin"],
    [/double.*price|price.*double/, "tours.price_double"],
    [/start.?date/,                 "tours.start_date"],
    [/end.?date/,                   "tours.end_date"],
    [/^time_frame$|timeframe/,      "computed:time_frame"],
    [/^location$|destination/,      "tours.location"],
    [/payment.?detail|instal/,      "tours.instalment_details"],
    [/brochure/,                    "tours.brochure_url"],
    [/welcome/,                     "tours.welcome_message"],
    [/description|overview|intro/,  "tours.description"],
    [/^status$/,                    "tours.status"],
    [/^year$/,                      "computed:tour_year"],
    [/hotel.*name|^hotel_1_name$/,  "computed:first_hotel_name"],
    [/itinerary/,                   "computed:itinerary_summary_html"],
  ];
  for (const [pat, src] of table) {
    if (typeof pat === "string" ? k === pat : pat.test(k)) return src;
  }
  return null;
}
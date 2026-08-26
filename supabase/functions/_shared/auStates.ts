// Canonical contact state codes shared with the app (src/lib/auStates.ts).
export const AU_STATE_CODES = [
  "NSW",
  "VIC",
  "QLD",
  "WA",
  "SA",
  "TAS",
  "ACT",
  "NT",
  "NZ",
  "Overseas",
];

const LOOKUP: Record<string, string> = {
  "new south wales": "NSW", nsw: "NSW", sydney: "NSW", newcastle: "NSW", blayney: "NSW",
  wollongong: "NSW", "coffs harbour": "NSW",
  victoria: "VIC", vic: "VIC", melbourne: "VIC", geelong: "VIC", ballarat: "VIC", bendigo: "VIC",
  queensland: "QLD", qld: "QLD", brisbane: "QLD", "gold coast": "QLD", cairns: "QLD",
  townsville: "QLD", toowoomba: "QLD",
  "western australia": "WA", wa: "WA", perth: "WA", broome: "WA", fremantle: "WA",
  "south australia": "SA", sa: "SA", adelaide: "SA",
  tasmania: "TAS", tas: "TAS", hobart: "TAS", launceston: "TAS",
  "australian capital territory": "ACT", act: "ACT", canberra: "ACT",
  "northern territory": "NT", nt: "NT", darwin: "NT", "alice springs": "NT",
  "new zealand": "NZ", nz: "NZ", nzl: "NZ", auckland: "NZ", wellington: "NZ",
  christchurch: "NZ", waikato: "NZ", canterbury: "NZ", cambridge: "NZ", hamilton: "NZ",
  tauranga: "NZ", dunedin: "NZ", otago: "NZ", "bay of plenty": "NZ", "hawkes bay": "NZ",
  northland: "NZ", manawatu: "NZ", taranaki: "NZ", southland: "NZ", queenstown: "NZ",
  "palmerston north": "NZ", napier: "NZ", rotorua: "NZ",
  overseas: "Overseas",
};

/** Normalise free-text state/city/country text to a canonical code ("" when unknown). */
export function normaliseStateCode(value?: string | null): string {
  if (!value) return "";
  const raw = String(value).trim();
  if (!raw) return "";
  const key = raw.toLowerCase().replace(/[.]/g, "").replace(/\s+/g, " ");
  if (LOOKUP[key]) return LOOKUP[key];
  if (AU_STATE_CODES.includes(raw.toUpperCase())) return raw.toUpperCase();
  return raw.length >= 2 ? "Overseas" : "";
}

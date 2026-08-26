/** Australian states/territories (plus NZ and Overseas) used for contact segmentation. */
export const AU_STATE_OPTIONS = [
  { value: "NSW", label: "NSW - New South Wales" },
  { value: "VIC", label: "VIC - Victoria" },
  { value: "QLD", label: "QLD - Queensland" },
  { value: "WA", label: "WA - Western Australia" },
  { value: "SA", label: "SA - South Australia" },
  { value: "TAS", label: "TAS - Tasmania" },
  { value: "ACT", label: "ACT - Australian Capital Territory" },
  { value: "NT", label: "NT - Northern Territory" },
  { value: "NZ", label: "NZ - New Zealand" },
  { value: "Overseas", label: "Overseas / Other" },
];

/** Canonical codes, in picker order. */
export const AU_STATE_CODES = AU_STATE_OPTIONS.map((o) => o.value);

const LOOKUP: Record<string, string> = {
  // NSW
  "new south wales": "NSW",
  nsw: "NSW",
  sydney: "NSW",
  newcastle: "NSW",
  blayney: "NSW",
  wollongong: "NSW",
  "coffs harbour": "NSW",
  // VIC
  victoria: "VIC",
  vic: "VIC",
  melbourne: "VIC",
  geelong: "VIC",
  ballarat: "VIC",
  bendigo: "VIC",
  // QLD
  queensland: "QLD",
  qld: "QLD",
  brisbane: "QLD",
  "gold coast": "QLD",
  cairns: "QLD",
  townsville: "QLD",
  toowoomba: "QLD",
  // WA
  "western australia": "WA",
  wa: "WA",
  perth: "WA",
  broome: "WA",
  fremantle: "WA",
  // SA
  "south australia": "SA",
  sa: "SA",
  adelaide: "SA",
  // TAS
  tasmania: "TAS",
  tas: "TAS",
  hobart: "TAS",
  launceston: "TAS",
  // ACT
  "australian capital territory": "ACT",
  act: "ACT",
  canberra: "ACT",
  // NT
  "northern territory": "NT",
  nt: "NT",
  darwin: "NT",
  "alice springs": "NT",
  // NZ
  "new zealand": "NZ",
  nz: "NZ",
  nzl: "NZ",
  auckland: "NZ",
  wellington: "NZ",
  christchurch: "NZ",
  waikato: "NZ",
  canterbury: "NZ",
  cambridge: "NZ",
  hamilton: "NZ",
  tauranga: "NZ",
  dunedin: "NZ",
  otago: "NZ",
  "bay of plenty": "NZ",
  "hawkes bay": "NZ",
  northland: "NZ",
  manawatu: "NZ",
  taranaki: "NZ",
  southland: "NZ",
  queenstown: "NZ",
  "palmerston north": "NZ",
  napier: "NZ",
  rotorua: "NZ",
};

/**
 * Best-effort normalisation of a free-text state/city/country value to one of
 * the canonical codes. Anything recognisably non-Australian falls back to
 * "Overseas"; unrecognised values return "" so they can be filled manually.
 */
export const normaliseAuState = (value?: string | null): string => {
  if (!value) return "";
  const raw = value.trim();
  if (!raw) return "";
  const key = raw.toLowerCase().replace(/[.]/g, "").replace(/\s+/g, " ");
  const hit = LOOKUP[key];
  if (hit) return hit;
  if (AU_STATE_CODES.includes(raw.toUpperCase())) return raw.toUpperCase();
  if (raw.toLowerCase() === "overseas") return "Overseas";
  // Anything else (UK, US states, other countries, unknown cities) is overseas
  // only when it is clearly a place name rather than noise.
  return raw.length >= 2 ? "Overseas" : "";
};
